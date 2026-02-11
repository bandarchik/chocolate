import {
  queryNotifications, getUnreadNotificationCount,
  markNotificationRead, markAllNotificationsRead,
  isAuthenticated
} from "./convex-client.js";

let pollInterval = null;

export async function initNotificationBell() {
  if (!isAuthenticated()) return;

  const slot = document.getElementById("notification-bell-slot");
  if (!slot) return;

  slot.innerHTML = `
    <div class="bb-notif-wrapper" style="position:relative;">
      <button id="bb-notif-bell" style="background:none;border:none;cursor:pointer;position:relative;padding:4px;color:#605dba;font-size:1.2rem;">
        <i class="uil uil-bell"></i>
        <span id="bb-notif-badge" style="display:none;position:absolute;top:-2px;right:-4px;background:#cc0000;color:#fff;font-size:.65rem;font-weight:700;width:16px;height:16px;border-radius:50%;text-align:center;line-height:16px;"></span>
      </button>
      <div id="bb-notif-dropdown" style="display:none;position:absolute;right:0;top:100%;margin-top:8px;width:320px;max-height:400px;overflow-y:auto;background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.15);border:1px solid #e0e0e8;z-index:10000;"></div>
    </div>
  `;

  document.getElementById("bb-notif-bell")?.addEventListener("click", toggleDropdown);

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".bb-notif-wrapper")) {
      hideDropdown();
    }
  });

  await updateBadge();
  pollInterval = setInterval(updateBadge, 30000);
}

async function updateBadge() {
  try {
    const count = await getUnreadNotificationCount();
    const badge = document.getElementById("bb-notif-badge");
    if (badge) {
      badge.style.display = count > 0 ? "block" : "none";
      badge.textContent = count > 9 ? "9+" : count;
    }
  } catch (_) {}
}

async function toggleDropdown() {
  const dropdown = document.getElementById("bb-notif-dropdown");
  if (!dropdown) return;

  if (dropdown.style.display === "none") {
    dropdown.style.display = "block";
    await loadNotifications();
  } else {
    hideDropdown();
  }
}

function hideDropdown() {
  const dropdown = document.getElementById("bb-notif-dropdown");
  if (dropdown) dropdown.style.display = "none";
}

async function loadNotifications() {
  const dropdown = document.getElementById("bb-notif-dropdown");
  if (!dropdown) return;

  dropdown.innerHTML = `<div style="padding:20px;text-align:center;color:#959ca9;font-size:.85rem;">Loading...</div>`;

  try {
    const notifications = await queryNotifications(15);
    renderNotificationDropdown(dropdown, notifications);
  } catch (_) {
    dropdown.innerHTML = `<div style="padding:20px;text-align:center;color:#959ca9;font-size:.85rem;">Unable to load notifications</div>`;
  }
}

function renderNotificationDropdown(dropdown, notifications) {
  if (notifications.length === 0) {
    dropdown.innerHTML = `
      <div style="padding:24px;text-align:center;color:#959ca9;">
        <i class="uil uil-bell-slash" style="font-size:2rem;display:block;margin-bottom:8px;"></i>
        <span style="font-size:.85rem;">No notifications yet</span>
      </div>
    `;
    return;
  }

  const header = `
    <div style="padding:12px 16px;border-bottom:1px solid #f0f0f4;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-weight:700;font-size:.9rem;color:#343f52;">Notifications</span>
      <button id="bb-mark-all-read" style="background:none;border:none;color:#605dba;font-size:.8rem;font-weight:600;cursor:pointer;">Mark all read</button>
    </div>
  `;

  const items = notifications.map((n) => {
    const message = buildNotificationMessage(n);
    const timeAgo = formatTimeAgo(n.createdAt);
    const unreadDot = !n.isRead ? `<span style="width:8px;height:8px;border-radius:50%;background:#605dba;flex-shrink:0;"></span>` : "";

    return `
      <div class="bb-notif-item" data-id="${n._id}" style="padding:10px 16px;border-bottom:1px solid #f8f8fc;cursor:pointer;display:flex;align-items:flex-start;gap:8px;transition:background .15s;${!n.isRead ? "background:#fafaff;" : ""}">
        ${unreadDot}
        <div style="flex:1;min-width:0;">
          <div style="font-size:.85rem;color:#343f52;line-height:1.4;">${message}</div>
          <div style="font-size:.75rem;color:#959ca9;margin-top:2px;">${timeAgo}</div>
        </div>
      </div>
    `;
  }).join("");

  dropdown.innerHTML = header + items;

  dropdown.getElementById?.("bb-mark-all-read")?.addEventListener("click", handleMarkAllRead);
  dropdown.querySelector("#bb-mark-all-read")?.addEventListener("click", handleMarkAllRead);

  dropdown.querySelectorAll(".bb-notif-item").forEach((el) => {
    el.addEventListener("click", () => handleNotifClick(el, notifications));
  });
}

function buildNotificationMessage(notification) {
  const actor = `<strong>${escapeHtml(notification.actor.displayName)}</strong>`;
  switch (notification.type) {
    case "mention": return `${actor} mentioned you in a comment`;
    case "reply": return `${actor} replied to your comment`;
    case "follow": return `${actor} started following you`;
    case "vote": return `${actor} upvoted your comment`;
    default: return `${actor} interacted with you`;
  }
}

async function handleNotifClick(el, notifications) {
  const id = el.dataset.id;
  const notification = notifications.find((n) => n._id === id);
  if (!notification) return;

  if (!notification.isRead) {
    try {
      await markNotificationRead(id);
      el.style.background = "";
      el.querySelector("span[style*='border-radius:50%']")?.remove();
      await updateBadge();
    } catch (_) {}
  }

  if (notification.articleId) {
    // Could navigate to article, but we don't have slug here
  }
}

async function handleMarkAllRead() {
  try {
    await markAllNotificationsRead();
    await updateBadge();
    await loadNotifications();
  } catch (_) {}
}

function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

export function destroyNotificationBell() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
