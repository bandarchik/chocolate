import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 12;
    const articles = await ctx.db
      .query("articles")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .order("desc")
      .take(limit + 1);

    const hasMore = articles.length > limit;
    const page = hasMore ? articles.slice(0, limit) : articles;

    return { articles: page, hasMore };
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("articles")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const listAll = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.sessionToken) {
      const session = await ctx.db
        .query("sessions")
        .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
        .first();
      if (!session || session.expiresAt < Date.now()) {
        throw new Error("Unauthorized");
      }
    }
    return await ctx.db
      .query("articles")
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    sessionToken: v.string(),
    title: v.string(),
    slug: v.string(),
    subtitle: v.string(),
    retailer: v.string(),
    date: v.string(),
    readTime: v.string(),
    heroImage: v.optional(v.string()),
    images: v.array(v.object({ caption: v.string(), urls: v.array(v.string()) })),
    body: v.string(),
    stats: v.object({
      savingsPercent: v.string(),
      productsFound: v.string(),
      timeWindow: v.string(),
    }),
    tags: v.array(v.string()),
    status: v.union(v.literal("draft"), v.literal("published")),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .first();
    if (!session || session.expiresAt < Date.now()) {
      throw new Error("Unauthorized");
    }

    const { sessionToken, ...articleData } = args;
    const now = Date.now();

    return await ctx.db.insert("articles", {
      ...articleData,
      publishedAt: args.status === "published" ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("articles"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    subtitle: v.optional(v.string()),
    retailer: v.optional(v.string()),
    date: v.optional(v.string()),
    readTime: v.optional(v.string()),
    heroImage: v.optional(v.string()),
    images: v.optional(v.array(v.object({ caption: v.string(), urls: v.array(v.string()) }))),
    body: v.optional(v.string()),
    stats: v.optional(v.object({
      savingsPercent: v.string(),
      productsFound: v.string(),
      timeWindow: v.string(),
    })),
    tags: v.optional(v.array(v.string())),
    status: v.optional(v.union(v.literal("draft"), v.literal("published"))),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .first();
    if (!session || session.expiresAt < Date.now()) {
      throw new Error("Unauthorized");
    }

    const { sessionToken, id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Article not found");

    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, val]) => val !== undefined)
    );

    if (filtered.status === "published" && existing.status !== "published") {
      filtered.publishedAt = Date.now();
    }

    await ctx.db.patch(id, { ...filtered, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("articles"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .first();
    if (!session || session.expiresAt < Date.now()) {
      throw new Error("Unauthorized");
    }
    await ctx.db.delete(args.id);
  },
});

export const generateUploadUrl = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .first();
    if (!session || session.expiresAt < Date.now()) {
      throw new Error("Unauthorized");
    }
    return await ctx.storage.generateUploadUrl();
  },
});
