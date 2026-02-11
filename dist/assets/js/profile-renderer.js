import {
  getPublicProfile, getFollowerCount, getFollowingCount,
  toggleFollow, isFollowing as checkIsFollowing,
  queryCommentsByAuthor, isAuthenticated, getCurrentUser
} from "./convex-client.js";

export async function initProfilePage() {
  const username = extractUsernameFromUrl();
  if (!username) {
    showProfileNotFound();
    return;
  }

  try {
    const profile = await getPublicProfile(username);
    if (!profile) {
      showProfileNotFound();
      return;
    }

    document.title = `${profile.displayName} (@${profile.username}) - Bandar's Bounties`;

    const [followers, following] = await Promise.all([
      getFollowerCount(profile.userId),
      getFollowingCount(profile.userId),
    ]);

    renderProfileHeader(profile, followers, following);
    await renderActivityFeed(profile.userId);
  } catch (err) {
    console.error("Failed to load profile:", err);
    showProfileNotFound();
  }
}

function extractUsernameFromUrl() {
  const path = window.location.pathname;
  const match = path.match(/\/user\/([^/]+)/);
  return match ? match[1] : null;
}

function renderProfileHeader(profile, followerCount, followingCount) {
  const container = document.getElementById("profile-header");
  if (!container) return;

  const initial = (profile.displayName || profile.username || "U")[0].toUpperCase();
  const roleBadge = profile.role === "admin" ? `<span style="background:#605dba;color:#fff;padding:2px 8px;border-radius:12px;font-size:.7rem;font-weight:700;margin-left:6px;">Admin</span>` : "";
  const joinDate = new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  container.innerHTML = `
    <div style="text-align:center;padding:40px 20px;">
      ${profile.avatarUrl
        ? `<img src="${escapeAttr(profile.avatarUrl)}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin-bottom:16px;border:3px solid #605dba;" alt="">`
        : `<div style="width:80px;height:80px;border-radius:50%;background:#605dba;color:#fff;display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:700;margin:0 auto 16px;">${initial}</div>`
      }
      <h1 style="font-size:1.4rem;font-weight:700;color:#343f52;margin:0 0 4px;">${escapeHtml(profile.displayName)}${roleBadge}</h1>
      <p style="color:#959ca9;font-size:.9rem;margin:0 0 12px;">@${escapeHtml(profile.username)}</p>
      ${profile.bio ? `<p style="color:#60697b;font-size:.9rem;max-width:400px;margin:0 auto 16px;line-height:1.5;">${escapeHtml(profile.bio)}</p>` : ""}
      <div style="display:flex;justify-content:center;gap:24px;margin-bottom:16px;">
        <div style="text-align:center;">
          <div style="font-weight:700;color:#343f52;font-size:1.1rem;" id="follower-count">${followerCount}</div>
          <div style="color:#959ca9;font-size:.8rem;">Followers</div>
        </div>
        <div style="text-align:center;">
          <div style="font-weight:700;color:#343f52;font-size:1.1rem;">${followingCount}</div>
          <div style="color:#959ca9;font-size:.8rem;">Following</div>
        </div>
      </div>
      <div id="follow-btn-slot"></div>
      <p style="color:#c5c5d8;font-size:.75rem;margin-top:12px;">Joined ${joinDate}</p>
    </div>
  `;

  renderFollowButton(profile.userId);
}

async function renderFollowButton(userId) {
  const slot = document.getElementById("follow-btn-slot");
  if (!slot) return;

  if (!isAuthenticated()) {
    slot.innerHTML = `<a href="/login" style="background:#605dba;color:#fff;border:none;border-radius:8px;padding:8px 24px;font-weight:600;font-size:.85rem;cursor:pointer;text-decoration:none;display:inline-block;">Follow</a>`;
    return;
  }

  const currentUser = await getCurrentUser();
  if (currentUser && currentUser.userId === userId) {
    slot.innerHTML = `<button onclick="document.getElementById('edit-profile-modal')?.showModal()" style="background:#f0f0f8;color:#605dba;border:2px solid #605dba;border-radius:8px;padding:8px 24px;font-weight:600;font-size:.85rem;cursor:pointer;">Edit Profile</button>`;
    return;
  }

  const following = await checkIsFollowing(userId);
  slot.innerHTML = `
    <button id="bb-follow-btn" data-user="${userId}" style="background:${following ? "#f0f0f8" : "#605dba"};color:${following ? "#605dba" : "#fff"};border:${following ? "2px solid #605dba" : "none"};border-radius:8px;padding:8px 24px;font-weight:600;font-size:.85rem;cursor:pointer;transition:all .2s;">
      ${following ? "Following" : "Follow"}
    </button>
  `;

  document.getElementById("bb-follow-btn")?.addEventListener("click", async (e) => {
    const btn = e.target;
    btn.disabled = true;
    try {
      const result = await toggleFollow(userId);
      btn.style.background = result.following ? "#f0f0f8" : "#605dba";
      btn.style.color = result.following ? "#605dba" : "#fff";
      btn.style.border = result.following ? "2px solid #605dba" : "none";
      btn.textContent = result.following ? "Following" : "Follow";

      const countEl = document.getElementById("follower-count");
      if (countEl) {
        const current = parseInt(countEl.textContent) || 0;
        countEl.textContent = result.following ? current + 1 : Math.max(0, current - 1);
      }
    } catch (_) {}
    btn.disabled = false;
  });
}

async function renderActivityFeed(userId) {
  const container = document.getElementById("activity-feed");
  if (!container) return;

  try {
    const comments = await queryCommentsByAuthor(userId, 10);
    if (comments.length === 0) {
      container.innerHTML = `<p style="text-align:center;color:#959ca9;font-size:.9rem;padding:40px 0;">No activity yet</p>`;
      return;
    }

    container.innerHTML = `
      <h3 style="font-size:1.1rem;font-weight:700;color:#343f52;margin-bottom:16px;">Recent Activity</h3>
      ${comments.map((c) => `
        <a href="/blog/${escapeAttr(c.articleSlug)}" style="display:block;background:#fff;border-radius:10px;padding:14px;margin-bottom:8px;border:1px solid #f0f0f4;text-decoration:none;transition:box-shadow .2s;">
          <div style="font-size:.8rem;color:#959ca9;margin-bottom:4px;">
            Commented on <strong style="color:#605dba;">${escapeHtml(c.articleTitle)}</strong>
            <span style="margin-left:8px;">${formatTimeAgo(c.createdAt)}</span>
          </div>
          <div style="font-size:.9rem;color:#60697b;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(c.body)}</div>
          <div style="font-size:.8rem;color:#959ca9;margin-top:6px;">
            <span style="color:#605dba;">${c.upvotes - c.downvotes} points</span>
            ${c.replyCount > 0 ? ` &middot; ${c.replyCount} replies` : ""}
          </div>
        </a>
      `).join("")}
    `;
  } catch (_) {
    container.innerHTML = `<p style="text-align:center;color:#959ca9;font-size:.9rem;">Unable to load activity</p>`;
  }
}

function showProfileNotFound() {
  const header = document.getElementById("profile-header");
  if (header) {
    header.innerHTML = `
      <div style="text-align:center;padding:60px 20px;">
        <h2 style="font-size:1.5rem;font-weight:700;color:#343f52;margin-bottom:12px;">User Not Found</h2>
        <p style="color:#60697b;margin-bottom:20px;">The profile you're looking for doesn't exist.</p>
        <a href="/blog" style="background:#605dba;color:#fff;padding:8px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:.9rem;">Back to Blog</a>
      </div>
    `;
  }
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

function escapeAttr(str) {
  return (str || "").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initProfilePage);
} else {
  initProfilePage();
}
