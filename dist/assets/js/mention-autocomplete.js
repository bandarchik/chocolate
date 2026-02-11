import { searchUsers } from "./convex-client.js";

let activeDropdown = null;
let debounceTimer = null;

export function initMentionAutocomplete(textarea) {
  if (!textarea) return;

  textarea.addEventListener("input", () => handleInput(textarea));
  textarea.addEventListener("keydown", (e) => handleKeydown(e));
  textarea.addEventListener("blur", () => {
    setTimeout(dismissDropdown, 200);
  });
}

function handleInput(textarea) {
  clearTimeout(debounceTimer);

  const mentionQuery = extractMentionQuery(textarea);
  if (!mentionQuery) {
    dismissDropdown();
    return;
  }

  debounceTimer = setTimeout(async () => {
    try {
      const users = await searchUsers(mentionQuery);
      if (users.length > 0) {
        showSuggestions(textarea, users, mentionQuery);
      } else {
        dismissDropdown();
      }
    } catch (_) {
      dismissDropdown();
    }
  }, 200);
}

function extractMentionQuery(textarea) {
  const value = textarea.value;
  const cursor = textarea.selectionStart;
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/@([a-zA-Z0-9_]{1,20})$/);
  return match ? match[1] : null;
}

function showSuggestions(textarea, users, query) {
  dismissDropdown();

  const rect = textarea.getBoundingClientRect();
  const dropdown = document.createElement("div");
  dropdown.className = "bb-mention-dropdown";
  dropdown.style.cssText = `
    position:fixed;
    z-index:10000;
    background:#fff;
    border:1px solid #e0e0e8;
    border-radius:10px;
    box-shadow:0 4px 16px rgba(0,0,0,.12);
    max-height:200px;
    overflow-y:auto;
    min-width:200px;
    left:${rect.left}px;
    top:${rect.bottom + 4}px;
  `;

  users.forEach((user, index) => {
    const item = document.createElement("div");
    item.className = "bb-mention-item";
    item.dataset.index = index;
    item.style.cssText = `
      padding:8px 14px;
      cursor:pointer;
      display:flex;
      align-items:center;
      gap:8px;
      transition:background .15s;
      ${index === 0 ? "background:#f8f8fc;" : ""}
    `;

    const initial = (user.displayName || user.username || "?")[0].toUpperCase();
    item.innerHTML = `
      ${user.avatarUrl
        ? `<img src="${escapeAttr(user.avatarUrl)}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;" alt="">`
        : `<span style="width:24px;height:24px;border-radius:50%;background:#605dba;color:#fff;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;">${initial}</span>`
      }
      <div>
        <div style="font-size:.85rem;font-weight:600;color:#343f52;">${escapeHtml(user.displayName)}</div>
        <div style="font-size:.75rem;color:#959ca9;">@${escapeHtml(user.username)}</div>
      </div>
    `;

    item.addEventListener("mouseenter", () => {
      dropdown.querySelectorAll(".bb-mention-item").forEach((el) => el.style.background = "");
      item.style.background = "#f8f8fc";
    });

    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      insertMention(textarea, user.username, query);
    });

    dropdown.appendChild(item);
  });

  document.body.appendChild(dropdown);
  activeDropdown = { element: dropdown, users, selectedIndex: 0, query };
}

function handleKeydown(e) {
  if (!activeDropdown) return;

  const { element, users, selectedIndex } = activeDropdown;
  const items = element.querySelectorAll(".bb-mention-item");

  if (e.key === "ArrowDown") {
    e.preventDefault();
    const next = Math.min(selectedIndex + 1, users.length - 1);
    updateSelection(items, next);
    activeDropdown.selectedIndex = next;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    const prev = Math.max(selectedIndex - 1, 0);
    updateSelection(items, prev);
    activeDropdown.selectedIndex = prev;
  } else if (e.key === "Enter" || e.key === "Tab") {
    if (users[selectedIndex]) {
      e.preventDefault();
      insertMention(e.target, users[selectedIndex].username, activeDropdown.query);
    }
  } else if (e.key === "Escape") {
    dismissDropdown();
  }
}

function updateSelection(items, index) {
  items.forEach((el, i) => {
    el.style.background = i === index ? "#f8f8fc" : "";
  });
}

function insertMention(textarea, username, query) {
  const value = textarea.value;
  const cursor = textarea.selectionStart;
  const beforeCursor = value.slice(0, cursor);
  const afterCursor = value.slice(cursor);

  const mentionStart = beforeCursor.lastIndexOf("@" + query);
  if (mentionStart === -1) return;

  const newValue = beforeCursor.slice(0, mentionStart) + "@" + username + " " + afterCursor;
  textarea.value = newValue;

  const newCursor = mentionStart + username.length + 2;
  textarea.setSelectionRange(newCursor, newCursor);
  textarea.focus();

  dismissDropdown();
  textarea.dispatchEvent(new Event("input"));
}

function dismissDropdown() {
  if (activeDropdown) {
    activeDropdown.element.remove();
    activeDropdown = null;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function escapeAttr(str) {
  return (str || "").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
