import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

async function authenticateSession(ctx: any, token: string) {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .first();
  if (!session || session.expiresAt < Date.now()) throw new Error("Not authenticated");
  return session.userId;
}

export const castVote = mutation({
  args: {
    sessionToken: v.string(),
    commentId: v.id("comments"),
    value: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.value !== 1 && args.value !== -1) throw new Error("Vote must be 1 or -1");

    const userId = await authenticateSession(ctx, args.sessionToken);
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");
    if (comment.authorId === userId) throw new Error("Cannot vote on own comment");

    const existing = await ctx.db
      .query("votes")
      .withIndex("by_comment_user", (q: any) =>
        q.eq("commentId", args.commentId).eq("userId", userId)
      )
      .first();

    let upDelta = 0;
    let downDelta = 0;

    if (existing) {
      if (existing.value === args.value) {
        await ctx.db.delete(existing._id);
        upDelta = args.value === 1 ? -1 : 0;
        downDelta = args.value === -1 ? -1 : 0;
      } else {
        await ctx.db.patch(existing._id, { value: args.value });
        upDelta = args.value === 1 ? 1 : -1;
        downDelta = args.value === -1 ? 1 : -1;
      }
    } else {
      await ctx.db.insert("votes", {
        commentId: args.commentId,
        userId,
        value: args.value,
      });
      upDelta = args.value === 1 ? 1 : 0;
      downDelta = args.value === -1 ? 1 : 0;
    }

    const newUpvotes = comment.upvotes + upDelta;
    const newDownvotes = comment.downvotes + downDelta;

    await ctx.db.patch(args.commentId, {
      upvotes: newUpvotes,
      downvotes: newDownvotes,
      score: newUpvotes - newDownvotes,
    });

    if (args.value === 1 && !existing && comment.authorId !== userId) {
      await ctx.db.insert("notifications", {
        recipientId: comment.authorId,
        type: "vote",
        actorId: userId,
        commentId: args.commentId,
        articleId: comment.articleId,
        isRead: false,
        createdAt: Date.now(),
      });
    }

    return {
      upvotes: newUpvotes,
      downvotes: newDownvotes,
      score: newUpvotes - newDownvotes,
      userVote: existing && existing.value === args.value ? 0 : args.value,
    };
  },
});

export const getUserVotesForArticle = query({
  args: {
    sessionToken: v.string(),
    articleId: v.id("articles"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q: any) => q.eq("token", args.sessionToken))
      .first();
    if (!session || session.expiresAt < Date.now()) return {};

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_article", (q: any) => q.eq("articleId", args.articleId))
      .collect();

    const commentIds = new Set(comments.map((c: any) => c._id));

    const userVotes = await ctx.db
      .query("votes")
      .withIndex("by_user", (q: any) => q.eq("userId", session.userId))
      .collect();

    const voteMap: Record<string, number> = {};
    for (const vote of userVotes) {
      if (commentIds.has(vote.commentId)) {
        voteMap[vote.commentId] = vote.value;
      }
    }
    return voteMap;
  },
});
