import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  articles: defineTable({
    title: v.string(),
    slug: v.string(),
    subtitle: v.string(),
    retailer: v.string(),
    date: v.string(),
    readTime: v.string(),
    heroImage: v.optional(v.string()),
    images: v.array(
      v.object({
        caption: v.string(),
        urls: v.array(v.string()),
      })
    ),
    body: v.string(),
    stats: v.object({
      savingsPercent: v.string(),
      productsFound: v.string(),
      timeWindow: v.string(),
    }),
    tags: v.array(v.string()),
    status: v.union(v.literal("draft"), v.literal("published")),
    publishedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_publishedAt", ["publishedAt"]),

  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    role: v.union(v.literal("admin"), v.literal("editor")),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),
});
