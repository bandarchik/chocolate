import { queryArticleBySlug, queryArticles } from "./convex-client.js";

export async function initArticlePage() {
  const slug = extractSlugFromUrl();
  if (!slug) {
    showNotFound();
    return;
  }

  try {
    const article = await queryArticleBySlug(slug);
    if (!article) {
      showNotFound();
      return;
    }
    renderArticle(article);
    await loadRelatedArticles(article);
  } catch (err) {
    console.error("Failed to load article:", err);
    showNotFound();
  }
}

function extractSlugFromUrl() {
  const path = window.location.pathname;
  const match = path.match(/\/blog\/([^/]+)/);
  return match ? match[1] : null;
}

function renderArticle(article) {
  document.title = `${article.title} - Bandar's Bounties`;

  setTextContent("article-tag", article.retailer);
  setTextContent("article-title", article.title);
  setTextContent("article-subtitle", article.subtitle);
  setTextContent("article-date", article.date);
  setTextContent("article-readtime", article.readTime || "");

  const tagEl = document.getElementById("article-tag");
  if (tagEl) {
    tagEl.style.background = getRetailerColor(article.retailer);
  }

  const statsContainer = document.getElementById("article-stats");
  if (statsContainer) {
    statsContainer.innerHTML = `
      <span class="stat-badge">${article.stats.savingsPercent} Savings</span>
      <span class="stat-badge">${article.stats.timeWindow} Alert</span>
      <span class="stat-badge">${article.stats.productsFound}</span>
    `;
  }

  const bodyContainer = document.getElementById("article-body");
  if (bodyContainer) {
    bodyContainer.innerHTML = article.body;
    initSwipers(bodyContainer);
  }

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.content = article.subtitle;
}

function initSwipers(container) {
  const swipers = container.querySelectorAll(".swiper-container");
  swipers.forEach((el) => {
    if (typeof Swiper !== "undefined") {
      new Swiper(el, {
        slidesPerView: 1,
        pagination: { el: el.querySelector(".swiper-pagination"), clickable: true },
        spaceBetween: 0,
      });
    }
  });
}

async function loadRelatedArticles(currentArticle) {
  const container = document.getElementById("related-articles");
  if (!container) return;

  try {
    const result = await queryArticles(4);
    const related = (result.articles || []).filter(
      (a) => a.slug !== currentArticle.slug
    ).slice(0, 3);

    if (related.length === 0) {
      container.style.display = "none";
      return;
    }

    const html = related.map((article) => `
      <div class="col-md-4">
        <a href="/blog/${article.slug}" class="card !rounded-[1rem] !shadow-lg !border-0 h-full hover:!shadow-xl transition-shadow" style="text-decoration:none;">
          <div class="card-body !p-5">
            <span class="article-tag !mb-2 inline-block" style="background:${getRetailerColor(article.retailer)};font-size:0.7rem;padding:2px 10px;">${article.retailer}</span>
            <h4 class="!text-[0.95rem] !font-bold !mb-1 !text-[#343f52]">${article.title}</h4>
            <p class="!text-[#60697b] !text-[0.8rem] !mb-0" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${article.subtitle}</p>
          </div>
        </a>
      </div>
    `).join("");

    container.querySelector(".row").innerHTML = html;
  } catch (err) {
    container.style.display = "none";
  }
}

function showNotFound() {
  const body = document.getElementById("article-body");
  if (body) {
    body.innerHTML = `
      <div class="text-center py-12">
        <h2 class="!text-[1.5rem] !font-bold !mb-4">Article Not Found</h2>
        <p class="!text-[#60697b] !mb-6">The article you're looking for doesn't exist.</p>
        <a href="/blog" class="btn !text-white !rounded-[0.8rem] !px-6 !py-3" style="background:#605dba;">Back to Blog</a>
      </div>
    `;
  }
  const hero = document.querySelector(".article-hero");
  if (hero) hero.style.display = "none";
}

function setTextContent(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function getRetailerColor(retailer) {
  const colors = {
    Walmart: "#0071ce", Amazon: "#ff9900", Target: "#cc0000",
    "Best Buy": "#0046be", Costco: "#e31837", "Home Depot": "#f96302",
    Lowes: "#004990", Nike: "#111111", Apple: "#555555",
  };
  return colors[retailer] || "#605dba";
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initArticlePage);
} else {
  initArticlePage();
}
