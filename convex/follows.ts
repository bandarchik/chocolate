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

export const toggleFollow = mutation({
  args: {
    sessionToken: v.string(),
    followingId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const followerId = await authenticateSession(ctx, args.sessionToken);
    if (followerId === args.followingId) throw new Error("Cannot follow yourself");

    const existing = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q: any) => q.eq("followerId", followerId))
      .collect();

    const follow = existing.find((f: any) => f.followingId === args.followingId);

    if (follow) {
      await ctx.db.delete(follow._id);
      return { following: false };
    }

    await ctx.db.insert("follows", { followerId, followingId: args.followingId });

    await ctx.db.insert("notifications", {
      recipientId: args.followingId,
      type: "follow",
      actorId: followerId,
      isRead: false,
      createdAt: Date.now(),
    });

    return { following: true };
  },
});

export const isFollowing = query({
  args: {
    sessionToken: v.string(),
    followingId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q: any) => q.eq("token", args.sessionToken))
      .first();
    if (!session || session.expiresAt < Date.now()) return false;

    const follows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q: any) => q.eq("followerId", session.userId))
      .collect();

    return follows.some((f: any) => f.followingId === args.followingId);
  },
});

export const getFollowerCount = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const followers = await ctx.db
      .query("follows")
      .withIndex("by_following", (q: any) => q.eq("followingId", args.userId))
      .collect();
    return followers.length;
  },
});

export const getFollowingCount = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const following = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q: any) => q.eq("followerId", args.userId))
      .collect();
    return following.length;
  },
});

export const listFollowers = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_following", (q: any) => q.eq("followingId", args.userId))
      .take(limit);

    return await Promise.all(
      follows.map(async (f: any) => {
        const user = await ctx.db.get(f.followerId);
        return user
          ? {
              userId: user._id,
              username: user.username || "unknown",
              displayName: user.displayName || user.username,
              avatarUrl: user.avatarUrl || null,
            }
          : null;
      })
    ).then((results) => results.filter(Boolean));
  },
});

export const listFollowing = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q: any) => q.eq("followerId", args.userId))
      .take(limit);

    return await Promise.all(
      follows.map(async (f: any) => {
        const user = await ctx.db.get(f.followingId);
        return user
          ? {
              userId: user._id,
              username: user.username || "unknown",
              displayName: user.displayName || user.username,
              avatarUrl: user.avatarUrl || null,
            }
          : null;
      })
    ).then((results) => results.filter(Boolean));
  },
});
