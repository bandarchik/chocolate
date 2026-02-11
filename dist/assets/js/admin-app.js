import {
  login, logout, verifySession, isAuthenticated, getSessionToken,
  queryAllArticles, createArticle, updateArticle, removeArticle,
} from "./convex-client.js";

let currentArticleId = null;

export async function initAdmin() {
  const loginSection = document.getElementById("login-section");
  const dashSection = document.getElementById("dashboard-section");

  const session = await checkAuth();
  if (session) {
    showDashboard(loginSection, dashSection);
    await loadArticleList();
  } else {
    showLogin(loginSection, dashSection);
  }

  setupLoginForm();
  setupLogoutBtn();
  setupArticleForm();
}

async function checkAuth() {
  if (!isAuthenticated()) return null;
  try {
    return await verifySession();
  } catch {
    return null;
  }
}

function showLogin(loginSection, dashSection) {
  if (loginSection) loginSection.style.display = "block";
  if (dashSection) dashSection.style.display = "none";
}

function showDashboard(loginSection, dashSection) {
  if (loginSection) loginSection.style.display = "none";
  if (dashSection) dashSection.style.display = "block";
}

function setupLoginForm() {
  const form = document.getElementById("login-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const errorEl = document.getElementById("login-error");

    try {
      await login(email, password);
      location.reload();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = "Invalid email or password";
        errorEl.style.display = "block";
      }
    }
  });
}

function setupLogoutBtn() {
  const btn = document.getElementById("logout-btn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    await logout();
    location.reload();
  });
}

async function loadArticleList() {
  const tbody = document.getElementById("articles-tbody");
  if (!tbody) return;

  try {
    const articles = await queryAllArticles();
    tbody.innerHTML = articles.map((a) => `
      <tr>
        <td class="!py-3">${a.title}</td>
        <td class="!py-3"><span class="badge" style="background:${a.status === "published" ? "#45c4a0" : "#f7b731"};color:#fff;">${a.status}</span></td>
        <td class="!py-3">${a.retailer}</td>
        <td class="!py-3">${a.date || ""}</td>
        <td class="!py-3">
          <button class="btn btn-sm btn-outline-primary edit-btn" data-id="${a._id}">Edit</button>
          <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${a._id}">Delete</button>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => editArticle(btn.dataset.id, articles));
    });

    tbody.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => deleteArticle(btn.dataset.id));
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Failed to load articles</td></tr>`;
  }
}

function editArticle(id, articles) {
  const article = articles.find((a) => a._id === id);
  if (!article) return;

  currentArticleId = id;
  document.getElementById("form-title").value = article.title || "";
  document.getElementById("form-slug").value = article.slug || "";
  document.getElementById("form-subtitle").value = article.subtitle || "";
  document.getElementById("form-retailer").value = article.retailer || "";
  document.getElementById("form-date").value = article.date || "";
  document.getElementById("form-readtime").value = article.readTime || "";
  document.getElementById("form-body").value = article.body || "";
  document.getElementById("form-tags").value = (article.tags || []).join(", ");
  document.getElementById("form-savings").value = article.stats?.savingsPercent || "";
  document.getElementById("form-products").value = article.stats?.productsFound || "";
  document.getElementById("form-timewindow").value = article.stats?.timeWindow || "";
  document.getElementById("form-status").value = article.status || "draft";

  document.getElementById("form-heading").textContent = "Edit Article";
  document.getElementById("article-form-section").style.display = "block";
  document.getElementById("article-form-section").scrollIntoView({ behavior: "smooth" });
}

async function deleteArticle(id) {
  if (!confirm("Delete this article?")) return;
  try {
    await removeArticle(id);
    await loadArticleList();
  } catch (err) {
    alert("Failed to delete article: " + err.message);
  }
}

function setupArticleForm() {
  const form = document.getElementById("article-form");
  const newBtn = document.getElementById("new-article-btn");
  const cancelBtn = document.getElementById("cancel-form-btn");

  if (newBtn) {
    newBtn.addEventListener("click", () => {
      currentArticleId = null;
      form?.reset();
      document.getElementById("form-heading").textContent = "New Article";
      document.getElementById("article-form-section").style.display = "block";
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      document.getElementById("article-form-section").style.display = "none";
      currentArticleId = null;
    });
  }

  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = collectFormData();
    const saveBtn = form.querySelector('button[type="submit"]');
    const origText = saveBtn?.textContent;

    try {
      if (saveBtn) saveBtn.textContent = "Saving...";

      if (currentArticleId) {
        await updateArticle(currentArticleId, data);
      } else {
        await createArticle(data);
      }

      document.getElementById("article-form-section").style.display = "none";
      currentArticleId = null;
      await loadArticleList();
    } catch (err) {
      alert("Failed to save: " + err.message);
    } finally {
      if (saveBtn) saveBtn.textContent = origText;
    }
  });
}

function collectFormData() {
  const title = document.getElementById("form-title").value.trim();
  const rawSlug = document.getElementById("form-slug").value.trim();
  const slug = rawSlug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  return {
    title,
    slug,
    subtitle: document.getElementById("form-subtitle").value.trim(),
    retailer: document.getElementById("form-retailer").value.trim(),
    date: document.getElementById("form-date").value.trim(),
    readTime: document.getElementById("form-readtime").value.trim(),
    body: document.getElementById("form-body").value,
    tags: document.getElementById("form-tags").value.split(",").map((t) => t.trim()).filter(Boolean),
    images: [],
    stats: {
      savingsPercent: document.getElementById("form-savings").value.trim(),
      productsFound: document.getElementById("form-products").value.trim(),
      timeWindow: document.getElementById("form-timewindow").value.trim(),
    },
    status: document.getElementById("form-status").value,
  };
}

document.getElementById("form-title")?.addEventListener("input", (e) => {
  const slugField = document.getElementById("form-slug");
  if (slugField && !currentArticleId) {
    slugField.value = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAdmin);
} else {
  initAdmin();
}
