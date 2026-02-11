import { castVote, isAuthenticated } from "./convex-client.js";

export function initVoteButtons(container) {
  if (!container) return;

  container.addEventListener("click", async (e) => {
    const btn = e.target.closest(".bb-vote-btn");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated()) {
      window.location.href = "/login";
      return;
    }

    const commentId = btn.dataset.comment;
    const value = parseInt(btn.dataset.value);
    if (!commentId || isNaN(value)) return;

    btn.disabled = true;
    try {
      const result = await handleVoteAction(commentId, value);
      updateVoteDisplay(btn.closest(".bb-comment"), result.score, result.userVote);
    } catch (err) {
      if (!err.message?.includes("own comment")) {
        console.error("Vote error:", err);
      }
    } finally {
      btn.disabled = false;
    }
  });
}

async function handleVoteAction(commentId, value) {
  return await castVote(commentId, value);
}

export function updateVoteDisplay(commentEl, newScore, userVote) {
  if (!commentEl) return;

  const scoreEl = commentEl.querySelector(".bb-score");
  if (scoreEl) {
    scoreEl.textContent = newScore;
    scoreEl.style.color = newScore > 0 ? "#605dba" : newScore < 0 ? "#cc0000" : "#959ca9";
  }

  const upBtn = commentEl.querySelector(".bb-upvote");
  const downBtn = commentEl.querySelector(".bb-downvote");

  if (upBtn) {
    upBtn.style.color = userVote === 1 ? "#605dba" : "#c5c5d8";
  }
  if (downBtn) {
    downBtn.style.color = userVote === -1 ? "#cc0000" : "#c5c5d8";
  }
}

export function setOptimisticVote(commentEl, value) {
  if (!commentEl) return;
  const scoreEl = commentEl.querySelector(".bb-score");
  if (!scoreEl) return;

  const currentScore = parseInt(scoreEl.textContent) || 0;
  scoreEl.textContent = currentScore + value;
}
