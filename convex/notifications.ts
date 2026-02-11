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

export const listForUser = query({
  args: {
    sessionToken: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await authenticateSession(ctx, args.sessionToken);
    const limit = args.limit || 20;

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q: any) => q.eq("recipientId", userId))
      .order("desc")
      .take(limit);

    return await Promise.all(
      notifications.map(async (n: any) => {
        const actor = await ctx.db.get(n.actorId);
        let articleTitle = null;
        if (n.articleId) {
          const article = await ctx.db.get(n.articleId);
          articleTitle = article?.title || null;
        }
        return {
          ...n,
          actor: actor
            ? {
                username: actor.username || "unknown",
                displayName: actor.displayName || actor.username,
                avatarUrl: actor.avatarUrl || null,
              }
            : { username: "unknown", displayName: "Unknown", avatarUrl: null },
          articleTitle,
        };
      })
    );
  },
});

export const getUnreadCount = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q: any) => q.eq("token", args.sessionToken))
      .first();
    if (!session || session.expiresAt < Date.now()) return 0;

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_unread", (q: any) =>
        q.eq("recipientId", session.userId).eq("isRead", false)
      )
      .collect();

    return unread.length;
  },
});

export const markAsRead = mutation({
  args: {
    sessionToken: v.string(),
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const userId = await authenticateSession(ctx, args.sessionToken);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.recipientId !== userId) {
      throw new Error("Not found");
    }
    await ctx.db.patch(args.notificationId, { isRead: true });
    return { success: true };
  },
});

export const markAllAsRead = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const userId = await authenticateSession(ctx, args.sessionToken);

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_unread", (q: any) =>
        q.eq("recipientId", userId).eq("isRead", false)
      )
      .collect();

    for (const n of unread) {
      await ctx.db.patch(n._id, { isRead: true });
    }

    return { marked: unread.length };
  },
});
