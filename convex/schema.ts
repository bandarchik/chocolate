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
    role: v.union(v.literal("admin"), v.literal("editor"), v.literal("member")),
    username: v.optional(v.string()),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_username", ["username"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

  comments: defineTable({
    articleId: v.id("articles"),
    authorId: v.id("users"),
    parentId: v.optional(v.id("comments")),
    body: v.string(),
    mentions: v.array(v.string()),
    upvotes: v.number(),
    downvotes: v.number(),
    score: v.number(),
    replyCount: v.number(),
    isDeleted: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_article", ["articleId"])
    .index("by_article_score", ["articleId", "score"])
    .index("by_parent", ["parentId"])
    .index("by_author", ["authorId"]),

  votes: defineTable({
    commentId: v.id("comments"),
    userId: v.id("users"),
    value: v.number(),
  })
    .index("by_comment_user", ["commentId", "userId"])
    .index("by_user", ["userId"]),

  follows: defineTable({
    followerId: v.id("users"),
    followingId: v.id("users"),
  })
    .index("by_follower", ["followerId"])
    .index("by_following", ["followingId"]),

  notifications: defineTable({
    recipientId: v.id("users"),
    type: v.union(
      v.literal("mention"),
      v.literal("reply"),
      v.literal("follow"),
      v.literal("vote")
    ),
    actorId: v.id("users"),
    commentId: v.optional(v.id("comments")),
    articleId: v.optional(v.id("articles")),
    isRead: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_recipient", ["recipientId"])
    .index("by_recipient_unread", ["recipientId", "isRead"]),
});
