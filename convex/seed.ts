import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const seedArticles = mutation({
  args: {
    articles: v.array(
      v.object({
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
      })
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    for (const article of args.articles) {
      const existing = await ctx.db
        .query("articles")
        .withIndex("by_slug", (q) => q.eq("slug", article.slug))
        .first();

      if (!existing) {
        const now = Date.now();
        await ctx.db.insert("articles", {
          ...article,
          status: "published",
          publishedAt: now - inserted * 86400000,
          createdAt: now,
          updatedAt: now,
        });
        inserted++;
      }
    }
    return { inserted, total: args.articles.length };
  },
});
