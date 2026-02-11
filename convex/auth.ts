import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

function hashPassword(password: string): string {
  let hash = 0;
  const salt = "bb_salt_2024";
  const salted = salt + password + salt;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return "h_" + Math.abs(hash).toString(36);
}

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 48; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

export const register = mutation({
  args: {
    email: v.string(),
    username: v.string(),
    password: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!USERNAME_REGEX.test(args.username)) {
      throw new Error("Username must be 3-20 characters: letters, numbers, underscores only");
    }
    if (args.password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    const existingEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existingEmail) throw new Error("Email already registered");

    const existingUsername = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username.toLowerCase()))
      .first();
    if (existingUsername) throw new Error("Username already taken");

    const userId = await ctx.db.insert("users", {
      email: args.email,
      passwordHash: hashPassword(args.password),
      role: "member",
      username: args.username.toLowerCase(),
      displayName: args.displayName || args.username,
      createdAt: Date.now(),
    });

    const token = generateToken();
    await ctx.db.insert("sessions", {
      userId,
      token,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    return { token, userId, username: args.username.toLowerCase() };
  },
});

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) throw new Error("Invalid credentials");

    const hash = hashPassword(args.password);
    if (hash !== user.passwordHash) throw new Error("Invalid credentials");

    const token = generateToken();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    await ctx.db.insert("sessions", {
      userId: user._id,
      token,
      expiresAt,
    });

    return {
      token,
      email: user.email,
      role: user.role,
      userId: user._id,
      username: user.username || null,
    };
  },
});

export const verifySession = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session || session.expiresAt < Date.now()) return null;

    const user = await ctx.db.get(session.userId);
    if (!user) return null;

    return {
      userId: user._id,
      email: user.email,
      role: user.role,
      username: user.username || null,
      displayName: user.displayName || null,
      avatarUrl: user.avatarUrl || null,
    };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (session) await ctx.db.delete(session._id);
  },
});

export const getPublicProfile = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username.toLowerCase()))
      .first();
    if (!user) return null;
    return {
      userId: user._id,
      username: user.username,
      displayName: user.displayName || user.username,
      avatarUrl: user.avatarUrl || null,
      bio: user.bio || null,
      role: user.role,
      createdAt: user.createdAt,
    };
  },
});

export const updateProfile = mutation({
  args: {
    sessionToken: v.string(),
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .first();
    if (!session || session.expiresAt < Date.now()) throw new Error("Not authenticated");

    const updates: Record<string, string> = {};
    if (args.displayName !== undefined) updates.displayName = args.displayName;
    if (args.bio !== undefined) updates.bio = args.bio;
    if (args.avatarUrl !== undefined) updates.avatarUrl = args.avatarUrl;

    await ctx.db.patch(session.userId, updates);
    return { success: true };
  },
});

export const searchUsersByUsername = query({
  args: { prefix: v.string() },
  handler: async (ctx, args) => {
    if (args.prefix.length < 1) return [];
    const lower = args.prefix.toLowerCase();
    const allUsers = await ctx.db.query("users").collect();
    return allUsers
      .filter((u) => u.username && u.username.startsWith(lower))
      .slice(0, 5)
      .map((u) => ({
        userId: u._id,
        username: u.username,
        displayName: u.displayName || u.username,
        avatarUrl: u.avatarUrl || null,
      }));
  },
});

export const createAdmin = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    setupKey: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.setupKey !== "bb_setup_2024") {
      throw new Error("Invalid setup key");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existing) throw new Error("User already exists");

    await ctx.db.insert("users", {
      email: args.email,
      passwordHash: hashPassword(args.password),
      role: "admin",
      username: args.email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "_"),
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

export const migrateAdminUsers = mutation({
  handler: async (ctx) => {
    const admins = await ctx.db
      .query("users")
      .collect();
    let migrated = 0;
    for (const user of admins) {
      if (!user.username) {
        const username = user.email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "_");
        await ctx.db.patch(user._id, { username });
        migrated++;
      }
    }
    return { migrated };
  },
});
