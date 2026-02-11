import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { rankComments } from "./scoring";

async function authenticateSession(ctx: any, token: string) {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .first();
  if (!session || session.expiresAt < Date.now()) throw new Error("Not authenticated");
  return session.userId;
}

function extractMentions(body: string): string[] {
  const matches = body.match(/@([a-zA-Z0-9_]{3,20})/g);
  if (!matches) return [];
  return [...new Set(matches.map((m: string) => m.slice(1).toLowerCase()))];
}

async function joinAuthorData(ctx: any, authorId: string) {
  const user = await ctx.db.get(authorId);
  if (!user) return { username: "deleted", displayName: "Deleted User", avatarUrl: null };
  return {
    username: user.username || "unknown",
    displayName: user.displayName || user.username || "Unknown",
    avatarUrl: user.avatarUrl || null,
  };
}

export const create = mutation({
  args: {
    sessionToken: v.string(),
    articleId: v.id("articles"),
    parentId: v.optional(v.id("comments")),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await authenticateSession(ctx, args.sessionToken);
    if (args.body.trim().length === 0) throw new Error("Comment cannot be empty");
    if (args.body.length > 2000) throw new Error("Comment too long (max 2000 chars)");

    const mentions = extractMentions(args.body);
    const now = Date.now();

    const commentId = await ctx.db.insert("comments", {
      articleId: args.articleId,
      authorId: userId,
      parentId: args.parentId,
      body: args.body.trim(),
      mentions,
      upvotes: 0,
      downvotes: 0,
      score: 0,
      replyCount: 0,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    });

    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (parent) {
        await ctx.db.patch(args.parentId, { replyCount: parent.replyCount + 1 });
        if (parent.authorId !== userId) {
          await ctx.db.insert("notifications", {
            recipientId: parent.authorId,
            type: "reply",
            actorId: userId,
            commentId,
            articleId: args.articleId,
            isRead: false,
            createdAt: now,
          });
        }
      }
    }

    for (const username of mentions) {
      const mentioned = await ctx.db
        .query("users")
        .withIndex("by_username", (q: any) => q.eq("username", username))
        .first();
      if (mentioned && mentioned._id !== userId) {
        await ctx.db.insert("notifications", {
          recipientId: mentioned._id,
          type: "mention",
          actorId: userId,
          commentId,
          articleId: args.articleId,
          isRead: false,
          createdAt: now,
        });
      }
    }

    return commentId;
  },
});

export const listByArticle = query({
  args: {
    articleId: v.id("articles"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_article", (q: any) => q.eq("articleId", args.articleId))
      .collect();

    const topLevel = comments.filter((c: any) => !c.parentId);
    const ranked = rankComments(topLevel).slice(0, limit);

    return await Promise.all(
      ranked.map(async (comment: any) => ({
        ...comment,
        body: comment.isDeleted ? "[deleted]" : comment.body,
        author: await joinAuthorData(ctx, comment.authorId),
      }))
    );
  },
});

export const listReplies = query({
  args: {
    parentId: v.id("comments"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const replies = await ctx.db
      .query("comments")
      .withIndex("by_parent", (q: any) => q.eq("parentId", args.parentId))
      .collect();

    const ranked = rankComments(replies).slice(0, limit);

    return await Promise.all(
      ranked.map(async (reply: any) => ({
        ...reply,
        body: reply.isDeleted ? "[deleted]" : reply.body,
        author: await joinAuthorData(ctx, reply.authorId),
      }))
    );
  },
});

export const getCommentCount = query({
  args: { articleId: v.id("articles") },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_article", (q: any) => q.eq("articleId", args.articleId))
      .collect();
    return comments.filter((c: any) => !c.isDeleted).length;
  },
});

export const update = mutation({
  args: {
    sessionToken: v.string(),
    commentId: v.id("comments"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await authenticateSession(ctx, args.sessionToken);
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");
    if (comment.authorId !== userId) throw new Error("Not authorized");
    if (comment.isDeleted) throw new Error("Cannot edit deleted comment");

    const mentions = extractMentions(args.body);
    await ctx.db.patch(args.commentId, {
      body: args.body.trim(),
      mentions,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const softDelete = mutation({
  args: {
    sessionToken: v.string(),
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    const userId = await authenticateSession(ctx, args.sessionToken);
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");
    if (comment.authorId !== userId) throw new Error("Not authorized");

    await ctx.db.patch(args.commentId, { isDeleted: true, updatedAt: Date.now() });
    return { success: true };
  },
});

export const listByAuthor = query({
  args: {
    authorId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_author", (q: any) => q.eq("authorId", args.authorId))
      .order("desc")
      .take(limit);

    return await Promise.all(
      comments
        .filter((c: any) => !c.isDeleted)
        .map(async (comment: any) => {
          const article = await ctx.db.get(comment.articleId);
          return {
            ...comment,
            author: await joinAuthorData(ctx, comment.authorId),
            articleTitle: article?.title || "Unknown",
            articleSlug: article?.slug || "",
          };
        })
    );
  },
});
