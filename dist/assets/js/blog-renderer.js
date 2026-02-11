import { queryArticles } from "./convex-client.js";

const CARDS_PER_PAGE = 12;
let currentPage = 0;
let allLoaded = false;
let activeTag = "all";

export async function initBlogListing() {
  const grid = document.getElementById("blog-grid");
  const loadMoreBtn = document.getElementById("load-more-btn");
  const filterContainer = document.getElementById("tag-filters");

  if (!grid) return;

  await loadArticles(grid, loadMoreBtn);

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => loadArticles(grid, loadMoreBtn));
  }

  if (filterContainer) {
    filterContainer.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-tag]");
      if (!btn) return;
      activeTag = btn.dataset.tag;
      filterContainer.querySelectorAll("[data-tag]").forEach((b) => {
        b.classList.toggle("active", b.dataset.tag === activeTag);
      });
      grid.innerHTML = "";
      currentPage = 0;
      allLoaded = false;
      loadArticles(grid, loadMoreBtn);
    });
  }
}

async function loadArticles(grid, loadMoreBtn) {
  if (allLoaded) return;

  try {
    grid.classList.add("loading");
    const result = await queryArticles(CARDS_PER_PAGE);
    const articles = result.articles || [];

    if (!result.hasMore) allLoaded = true;

    const filtered =
      activeTag === "all"
        ? articles
        : articles.filter((a) => a.tags.includes(activeTag));

    filtered.forEach((article) => {
      grid.appendChild(createArticleCard(article));
    });

    currentPage++;

    if (loadMoreBtn) {
      loadMoreBtn.style.display = allLoaded ? "none" : "inline-block";
    }
  } catch (err) {
    console.error("Failed to load articles:", err);
    grid.innerHTML = buildErrorState();
  } finally {
    grid.classList.remove("loading");
  }
}

function createArticleCard(article) {
  const col = document.createElement("div");
  col.className = "col-md-6 col-lg-4 mb-6";
  col.setAttribute("data-tags", article.tags.join(","));

  const retailerColor = getRetailerColor(article.retailer);
  const dateStr = article.date || "";

  col.innerHTML = `
    <a href="/blog/${article.slug}" class="card !rounded-[1rem] !shadow-lg !border-0 h-full hover:!shadow-xl transition-shadow" style="text-decoration:none;">
      <div class="card-body !p-6">
        <div class="!mb-3 flex items-center gap-2 flex-wrap">
          <span class="article-tag" style="background:${retailerColor};font-size:0.75rem;padding:3px 10px;">${article.retailer}</span>
          ${article.tags.slice(0, 2).map((t) => `<span style="background:#f0f0f8;color:#605dba;padding:3px 10px;border-radius:20px;font-size:0.7rem;font-weight:600;">${t}</span>`).join("")}
        </div>
        <h3 class="!text-[1.1rem] !font-bold !mb-2 !text-[#343f52]">${article.title}</h3>
        <p class="!text-[#60697b] !text-[0.85rem] !mb-3 !leading-relaxed" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${article.subtitle}</p>
        <div class="flex items-center gap-3 !text-[0.8rem] !text-[#959ca9]">
          <span><i class="uil uil-calendar-alt before:content-['\\e9ba']"></i> ${dateStr}</span>
          <span class="stat-badge" style="font-size:0.7rem;padding:2px 8px;">${article.stats.savingsPercent}</span>
        </div>
      </div>
    </a>
  `;
  return col;
}

function getRetailerColor(retailer) {
  const colors = {
    Walmart: "#0071ce",
    Amazon: "#ff9900",
    Target: "#cc0000",
    "Best Buy": "#0046be",
    Costco: "#e31837",
    "Home Depot": "#f96302",
    Lowes: "#004990",
    Nike: "#111111",
    Apple: "#555555",
  };
  return colors[retailer] || "#605dba";
}

function buildErrorState() {
  return `
    <div class="col-12 text-center py-12">
      <i class="uil uil-exclamation-triangle text-[3rem] text-[#959ca9] mb-4"></i>
      <p class="text-[#60697b]">Unable to load articles. Please try again later.</p>
      <button onclick="location.reload()" class="btn btn-grape mt-4">Retry</button>
    </div>
  `;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBlogListing);
} else {
  initBlogListing();
}
