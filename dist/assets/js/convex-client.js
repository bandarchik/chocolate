import { ConvexHttpClient } from "https://esm.sh/convex@1.31.7/browser";
import { api } from "https://esm.sh/convex@1.31.7/api";

const CONVEX_URL = window.__CONVEX_URL || "https://trustworthy-deer-695.convex.cloud";

const client = new ConvexHttpClient(CONVEX_URL);

const SESSION_KEY = "bb_admin_session";

export function getClient() {
  return client;
}

export function setConvexUrl(url) {
  client.setAdminAuth(url);
}

export async function queryArticles(limit = 12) {
  return await client.query(api.articles.list, { limit });
}

export async function queryArticleBySlug(slug) {
  return await client.query(api.articles.getBySlug, { slug });
}

export async function queryAllArticles() {
  const token = getSessionToken();
  return await client.query(api.articles.listAll, {
    sessionToken: token || undefined,
  });
}

export async function createArticle(data) {
  const token = getSessionToken();
  if (!token) throw new Error("Not authenticated");
  return await client.mutation(api.articles.create, {
    ...data,
    sessionToken: token,
  });
}

export async function updateArticle(id, data) {
  const token = getSessionToken();
  if (!token) throw new Error("Not authenticated");
  return await client.mutation(api.articles.update, {
    ...data,
    id,
    sessionToken: token,
  });
}

export async function removeArticle(id) {
  const token = getSessionToken();
  if (!token) throw new Error("Not authenticated");
  return await client.mutation(api.articles.remove, {
    id,
    sessionToken: token,
  });
}

export async function login(email, password) {
  const result = await client.mutation(api.auth.login, { email, password });
  localStorage.setItem(SESSION_KEY, result.token);
  return result;
}

export async function verifySession() {
  const token = getSessionToken();
  if (!token) return null;
  return await client.query(api.auth.verifySession, { token });
}

export async function logout() {
  const token = getSessionToken();
  if (token) {
    await client.mutation(api.auth.logout, { token });
  }
  localStorage.removeItem(SESSION_KEY);
}

export function getSessionToken() {
  return localStorage.getItem(SESSION_KEY);
}

export function isAuthenticated() {
  return !!getSessionToken();
}
