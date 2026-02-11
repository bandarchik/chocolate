import {
  queryComments, queryReplies, createComment,
  castVote, getUserVotesForArticle, getCommentCount,
  isAuthenticated
} from "./convex-client.js";
import { getCachedUser } from "./user-auth-ui.js";
import { initMentionAutocomplete } from "./mention-autocomplete.js";

let currentArticleId = null;
let userVotes = {};

export async function initCommentSection(articleId) {
  currentArticleId = articleId;
  const anchor = document.getElementById("comments-section");
  if (!anchor) return;

  anchor.innerHTML = `
    <div class="bb-comments" style="margin-top:32px;">
      <h3 class="bb-comments-title" style="font-size:1.3rem;font-weight:700;color:#343f52;margin-bottom:20px;">
        <i class="uil uil-comment-dots" style="color:#605dba;"></i>
        Comments <span id="bb-comment-count" style="color:#959ca9;font-weight:400;font-size:1rem;"></span>
      </h3>
      <div id="bb-comment-form-root"></div>
      <div id="bb-comment-list" style="margin-top:24px;"></div>
    </div>
  `;

  await loadComments();
}

async function loadComments() {
  const listEl = document.getElementById("bb-comment-list");
  const countEl = document.getElementById("bb-comment-count");
  if (!listEl) return;

  try {
    const [comments, count] = await Promise.all([
      queryComments(currentArticleId),
      getCommentCount(currentArticleId),
    ]);
    if (isAuthenticated()) {
      userVotes = await getUserVotesForArticle(currentArticleId);
    }
    if (countEl) countEl.textContent = `(${count})`;

    renderCommentForm(document.getElementById("bb-comment-form-root"), currentArticleId, null);
    listEl.innerHTML = "";
    renderCommentList(listEl, comments, 0);
  } catch (err) {
    listEl.innerHTML = `<p style="color:#959ca9;font-size:.9rem;">Unable to load comments.</p>`;
  }
}

function renderCommentForm(container, articleId, parentId) {
  if (!container) return;
  const user = getCachedUser();

  if (!user) {
    container.innerHTML = `
      <div style="background:#f8f8fc;border-radius:12px;padding:20px;text-align:center;">
        <p style="color:#60697b;margin:0 0 10px;font-size:.9rem;">Sign in to join the conversation</p>
        <a href="/login" class="btn btn-sm" style="background:#605dba;color:#fff;border-radius:8px;padding:6px 20px;font-weight:600;text-decoration:none;font-size:.85rem;">Sign In</a>
      </div>
    `;
    return;
  }

  const formId = parentId ? `reply-form-${parentId}` : "bb-main-comment-form";
  container.innerHTML = `
    <form id="${formId}" style="margin-bottom:16px;">
      <textarea id="${formId}-input" placeholder="${parentId ? "Write a reply..." : "Share your thoughts..."}"
        style="width:100%;min-height:${parentId ? "60px" : "80px"};padding:12px;border:2px solid #e0e0e8;border-radius:10px;font-size:.9rem;resize:vertical;font-family:inherit;transition:border-color .2s;"
        maxlength="2000"></textarea>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
        ${parentId ? `<button type="button" class="bb-cancel-reply" style="background:none;border:1px solid #e0e0e8;border-radius:8px;padding:6px 14px;font-size:.8rem;cursor:pointer;color:#60697b;">Cancel</button>` : ""}
        <button type="submit" style="background:#605dba;color:#fff;border:none;border-radius:8px;padding:6px 18px;font-weight:600;font-size:.85rem;cursor:pointer;">Post</button>
      </div>
    </form>
  `;

  const textarea = document.getElementById(`${formId}-input`);
  if (textarea) initMentionAutocomplete(textarea);

  document.getElementById(formId)?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handleCommentSubmit(textarea, articleId, parentId);
  });

  container.querySelector(".bb-cancel-reply")?.addEventListener("click", () => {
    container.innerHTML = "";
  });
}

async function handleCommentSubmit(textarea, articleId, parentId) {
  const body = textarea.value.trim();
  if (!body) return;

  const btn = textarea.closest("form").querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = "Posting...";

  try {
    await createComment(articleId, body, parentId);
    await loadComments();
  } catch (err) {
    alert(err.message || "Failed to post comment");
  } finally {
    btn.disabled = false;
    btn.textContent = "Post";
  }
}

function renderCommentList(container, comments, depth) {
  comments.forEach((comment) => {
    const el = createCommentElement(comment, depth);
    container.appendChild(el);
  });
}

function createCommentElement(comment, depth) {
  const el = document.createElement("div");
  el.className = "bb-comment";
  el.dataset.commentId = comment._id;

  const indent = Math.min(depth, 2) * 24;
  const vote = userVotes[comment._id] || 0;
  const score = comment.upvotes - comment.downvotes;

  el.style.cssText = `margin-left:${indent}px;padding:14px;background:#fff;border-radius:10px;margin-bottom:10px;border:1px solid #f0f0f4;`;

  el.innerHTML = `
    <div style="display:flex;gap:10px;">
      <div class="bb-vote-col" style="display:flex;flex-direction:column;align-items:center;gap:2px;min-width:32px;">
        <button class="bb-vote-btn bb-upvote" data-comment="${comment._id}" data-value="1"
          style="background:none;border:none;cursor:pointer;padding:2px;color:${vote === 1 ? "#605dba" : "#c5c5d8"};font-size:1.1rem;">
          <i class="uil uil-arrow-up"></i>
        </button>
        <span class="bb-score" style="font-size:.8rem;font-weight:700;color:${score > 0 ? "#605dba" : score < 0 ? "#cc0000" : "#959ca9"};">${score}</span>
        <button class="bb-vote-btn bb-downvote" data-comment="${comment._id}" data-value="-1"
          style="background:none;border:none;cursor:pointer;padding:2px;color:${vote === -1 ? "#cc0000" : "#c5c5d8"};font-size:1.1rem;">
          <i class="uil uil-arrow-down"></i>
        </button>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <a href="/user/${comment.author.username}" style="font-weight:700;font-size:.85rem;color:#343f52;text-decoration:none;">${escapeHtml(comment.author.displayName)}</a>
          <span style="color:#959ca9;font-size:.75rem;">@${escapeHtml(comment.author.username)}</span>
          <span style="color:#c5c5d8;font-size:.75rem;">${formatTimeAgo(comment.createdAt)}</span>
        </div>
        <div class="bb-comment-body" style="font-size:.9rem;color:#60697b;line-height:1.5;word-break:break-word;">${formatMentions(escapeHtml(comment.body))}</div>
        <div style="margin-top:8px;display:flex;gap:12px;">
          <button class="bb-reply-btn" data-comment="${comment._id}" style="background:none;border:none;color:#605dba;font-size:.8rem;font-weight:600;cursor:pointer;padding:0;">Reply</button>
          ${comment.replyCount > 0 ? `<button class="bb-load-replies" data-comment="${comment._id}" style="background:none;border:none;color:#959ca9;font-size:.8rem;cursor:pointer;padding:0;">${comment.replyCount} ${comment.replyCount === 1 ? "reply" : "replies"}</button>` : ""}
        </div>
        <div class="bb-reply-form-slot" data-for="${comment._id}"></div>
        <div class="bb-replies-slot" data-for="${comment._id}"></div>
      </div>
    </div>
  `;

  el.querySelectorAll(".bb-vote-btn").forEach((btn) => {
    btn.addEventListener("click", () => handleVote(comment._id, parseInt(btn.dataset.value)));
  });

  el.querySelector(".bb-reply-btn")?.addEventListener("click", () => {
    const slot = el.querySelector(`.bb-reply-form-slot[data-for="${comment._id}"]`);
    if (slot && !slot.hasChildNodes()) {
      renderCommentForm(slot, currentArticleId, comment._id);
    }
  });

  el.querySelector(".bb-load-replies")?.addEventListener("click", async (e) => {
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = "Loading...";
    await loadReplies(comment._id, el.querySelector(`.bb-replies-slot[data-for="${comment._id}"]`), depth);
    btn.style.display = "none";
  });

  return el;
}

async function handleVote(commentId, value) {
  if (!isAuthenticated()) {
    window.location.href = "/login";
    return;
  }
  try {
    const result = await castVote(commentId, value);
    userVotes[commentId] = result.userVote;
    updateVoteDisplay(commentId, result.score, result.userVote);
  } catch (err) {
    if (err.message?.includes("own comment")) return;
    console.error("Vote failed:", err);
  }
}

function updateVoteDisplay(commentId, score, userVote) {
  const el = document.querySelector(`[data-comment-id="${commentId}"]`);
  if (!el) return;
  const scoreEl = el.querySelector(".bb-score");
  if (scoreEl) {
    scoreEl.textContent = score;
    scoreEl.style.color = score > 0 ? "#605dba" : score < 0 ? "#cc0000" : "#959ca9";
  }
  const upBtn = el.querySelector(".bb-upvote");
  const downBtn = el.querySelector(".bb-downvote");
  if (upBtn) upBtn.style.color = userVote === 1 ? "#605dba" : "#c5c5d8";
  if (downBtn) downBtn.style.color = userVote === -1 ? "#cc0000" : "#c5c5d8";
}

async function loadReplies(parentId, container, parentDepth) {
  if (!container) return;
  try {
    const replies = await queryReplies(parentId);
    container.innerHTML = "";
    renderCommentList(container, replies, parentDepth + 1);
  } catch (_) {
    container.innerHTML = `<p style="color:#959ca9;font-size:.8rem;">Failed to load replies.</p>`;
  }
}

function formatMentions(text) {
  return text.replace(/@([a-zA-Z0-9_]{3,20})/g, '<a href="/user/$1" style="color:#605dba;font-weight:600;text-decoration:none;">@$1</a>');
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
