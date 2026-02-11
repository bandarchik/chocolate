import { ConvexHttpClient } from "https://esm.sh/convex@1.31.7/browser";
import { api } from "https://esm.sh/convex@1.31.7/api";

const CONVEX_URL = window.__CONVEX_URL || "https://trustworthy-deer-695.convex.cloud";

const client = new ConvexHttpClient(CONVEX_URL);

const ADMIN_SESSION_KEY = "bb_admin_session";
const SESSION_KEY = "bb_session";

export function getClient() {
  return client;
}

// --- Session helpers ---

export function getSessionToken() {
  return localStorage.getItem(SESSION_KEY) || localStorage.getItem(ADMIN_SESSION_KEY);
}

export function getAdminSessionToken() {
  return localStorage.getItem(ADMIN_SESSION_KEY);
}

export function isAuthenticated() {
  return !!getSessionToken();
}

// --- Articles ---

export async function queryArticles(limit = 12) {
  return await client.query(api.articles.list, { limit });
}

export async function queryArticleBySlug(slug) {
  return await client.query(api.articles.getBySlug, { slug });
}

export async function queryAllArticles() {
  const token = getAdminSessionToken();
  return await client.query(api.articles.listAll, {
    sessionToken: token || undefined,
  });
}

export async function createArticle(data) {
  const token = getAdminSessionToken();
  if (!token) throw new Error("Not authenticated");
  return await client.mutation(api.articles.create, { ...data, sessionToken: token });
}

export async function updateArticle(id, data) {
  const token = getAdminSessionToken();
  if (!token) throw new Error("Not authenticated");
  return await client.mutation(api.articles.update, { ...data, id, sessionToken: token });
}

export async function removeArticle(id) {
  const token = getAdminSessionToken();
  if (!token) throw new Error("Not authenticated");
  return await client.mutation(api.articles.remove, { id, sessionToken: token });
}

// --- Auth ---

export async function login(email, password) {
  const result = await client.mutation(api.auth.login, { email, password });
  localStorage.setItem(SESSION_KEY, result.token);
  return result;
}

export async function adminLogin(email, password) {
  const result = await client.mutation(api.auth.login, { email, password });
  localStorage.setItem(ADMIN_SESSION_KEY, result.token);
  return result;
}

export async function register(email, username, password, displayName) {
  const args = { email, username, password };
  if (displayName) args.displayName = displayName;
  const result = await client.mutation(api.auth.register, args);
  localStorage.setItem(SESSION_KEY, result.token);
  return result;
}

export async function verifySession() {
  const token = getSessionToken();
  if (!token) return null;
  return await client.query(api.auth.verifySession, { token });
}

export async function getCurrentUser() {
  return await verifySession();
}

export async function logout() {
  const token = getSessionToken();
  if (token) {
    await client.mutation(api.auth.logout, { token });
  }
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

// --- Profiles ---

export async function getPublicProfile(username) {
  return await client.query(api.auth.getPublicProfile, { username });
}

export async function updateProfile(displayName, bio, avatarUrl) {
  const token = getSessionToken();
  if (!token) throw new Error("Not authenticated");
  const args = { sessionToken: token };
  if (displayName !== undefined) args.displayName = displayName;
  if (bio !== undefined) args.bio = bio;
  if (avatarUrl !== undefined) args.avatarUrl = avatarUrl;
  return await client.mutation(api.auth.updateProfile, args);
}

export async function searchUsers(prefix) {
  return await client.query(api.auth.searchUsersByUsername, { prefix });
}

// --- Comments ---

export async function queryComments(articleId, limit) {
  const args = { articleId };
  if (limit) args.limit = limit;
  return await client.query(api.comments.listByArticle, args);
}

export async function queryReplies(parentId, limit) {
  const args = { parentId };
  if (limit) args.limit = limit;
  return await client.query(api.comments.listReplies, args);
}

export async function createComment(articleId, body, parentId) {
  const token = getSessionToken();
  if (!token) throw new Error("Not authenticated");
  const args = { sessionToken: token, articleId, body };
  if (parentId) args.parentId = parentId;
  return await client.mutation(api.comments.create, args);
}

export async function getCommentCount(articleId) {
  return await client.query(api.comments.getCommentCount, { articleId });
}

export async function queryCommentsByAuthor(authorId, limit) {
  const args = { authorId };
  if (limit) args.limit = limit;
  return await client.query(api.comments.listByAuthor, args);
}

// --- Votes ---

export async function castVote(commentId, value) {
  const token = getSessionToken();
  if (!token) throw new Error("Not authenticated");
  return await client.mutation(api.votes.castVote, { sessionToken: token, commentId, value });
}

export async function getUserVotesForArticle(articleId) {
  const token = getSessionToken();
  if (!token) return {};
  return await client.query(api.votes.getUserVotesForArticle, { sessionToken: token, articleId });
}

// --- Follows ---

export async function toggleFollow(followingId) {
  const token = getSessionToken();
  if (!token) throw new Error("Not authenticated");
  return await client.mutation(api.follows.toggleFollow, { sessionToken: token, followingId });
}

export async function isFollowing(followingId) {
  const token = getSessionToken();
  if (!token) return false;
  return await client.query(api.follows.isFollowing, { sessionToken: token, followingId });
}

export async function getFollowerCount(userId) {
  return await client.query(api.follows.getFollowerCount, { userId });
}

export async function getFollowingCount(userId) {
  return await client.query(api.follows.getFollowingCount, { userId });
}

// --- Notifications ---

export async function queryNotifications(limit) {
  const token = getSessionToken();
  if (!token) return [];
  const args = { sessionToken: token };
  if (limit) args.limit = limit;
  return await client.query(api.notifications.listForUser, args);
}

export async function getUnreadNotificationCount() {
  const token = getSessionToken();
  if (!token) return 0;
  return await client.query(api.notifications.getUnreadCount, { sessionToken: token });
}

export async function markNotificationRead(notificationId) {
  const token = getSessionToken();
  if (!token) throw new Error("Not authenticated");
  return await client.mutation(api.notifications.markAsRead, { sessionToken: token, notificationId });
}

export async function markAllNotificationsRead() {
  const token = getSessionToken();
  if (!token) throw new Error("Not authenticated");
  return await client.mutation(api.notifications.markAllAsRead, { sessionToken: token });
}
