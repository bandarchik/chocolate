import { login, register, logout, getCurrentUser } from "./convex-client.js";

let cachedUser = null;

export async function initAuthUI() {
  const user = await getCurrentUser();
  cachedUser = user;
  renderAuthNavbarState(user);
  return user;
}

export function getCachedUser() {
  return cachedUser;
}

export function renderAuthNavbarState(user) {
  const slot = document.getElementById("auth-nav-slot");
  if (!slot) return;

  if (user) {
    const initial = (user.displayName || user.username || "U")[0].toUpperCase();
    slot.innerHTML = `
      <div class="bb-auth-nav" style="display:flex;align-items:center;gap:10px;">
        <div id="notification-bell-slot"></div>
        <a href="/user/${user.username}" class="bb-user-pill" style="display:flex;align-items:center;gap:8px;background:#fff;padding:4px 14px 4px 4px;border-radius:50px;text-decoration:none;box-shadow:0 1px 4px rgba(0,0,0,.08);transition:box-shadow .2s;">
          ${user.avatarUrl
            ? `<img src="${escapeAttr(user.avatarUrl)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" alt="">`
            : `<span style="width:28px;height:28px;border-radius:50%;background:#605dba;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.8rem;">${initial}</span>`
          }
          <span style="font-size:.85rem;font-weight:600;color:#343f52;">${escapeHtml(user.displayName || user.username)}</span>
        </a>
        <button id="bb-logout-btn" style="background:none;border:none;color:#959ca9;cursor:pointer;font-size:.8rem;padding:4px 8px;" title="Sign out">
          <i class="uil uil-signout" style="font-size:1.1rem;"></i>
        </button>
      </div>
    `;
    document.getElementById("bb-logout-btn")?.addEventListener("click", handleLogout);
  } else {
    slot.innerHTML = `
      <div class="bb-auth-nav" style="display:flex;align-items:center;gap:8px;">
        <a href="/login" class="bb-auth-link" style="font-size:.85rem;font-weight:600;color:#605dba;text-decoration:none;padding:6px 12px;">Sign In</a>
        <a href="/register" class="btn btn-sm" style="background:#605dba;color:#fff;border-radius:50px;font-size:.82rem;padding:6px 18px;text-decoration:none;font-weight:600;">Sign Up</a>
      </div>
    `;
  }
}

export function showLoginModal() {
  window.location.href = "/login";
}

export function showRegisterModal() {
  window.location.href = "/register";
}

async function handleLogout() {
  try {
    await logout();
  } catch (_) {}
  cachedUser = null;
  window.location.reload();
}

export async function handleLoginSubmit(email, password) {
  const result = await login(email, password);
  cachedUser = await getCurrentUser();
  return result;
}

export async function handleRegisterSubmit(email, username, password, displayName) {
  const result = await register(email, username, password, displayName);
  cachedUser = await getCurrentUser();
  return result;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function escapeAttr(str) {
  return (str || "").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
