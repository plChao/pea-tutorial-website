import { loadCourseMetadata, loadCheatsheetHtml } from "../dataLoader.js";

const params = new URLSearchParams(location.search);
const courseId = params.get("course") || "001";
let sectionId = params.get("section");

const els = {
  menuBtn: document.getElementById("menuBtn"),
  closeSidebar: document.getElementById("closeSidebar"),
  sidebar: document.getElementById("sidebar"),
  sidebarOverlay: document.getElementById("sidebarOverlay"),
  sidebarCourseTitle: document.getElementById("sidebarCourseTitle"),
  sectionList: document.getElementById("sectionList"),
  reviewTitle: document.getElementById("reviewTitle"),
  reviewContent: document.getElementById("reviewContent"),
  relatedChapters: document.getElementById("relatedChapters"),
  footerProgress: document.getElementById("footerProgress"),
  footerPrevBtn: document.getElementById("footerPrevBtn"),
  footerNextBtn: document.getElementById("footerNextBtn"),
};

let meta = null;
let sectionOrder = []; // [{ prefix, title }], in the order sections first appear among chapters

function setupSidebarToggle() {
  function open() {
    els.sidebar.hidden = false;
    els.sidebarOverlay.hidden = false;
  }
  function close() {
    els.sidebar.hidden = true;
    els.sidebarOverlay.hidden = true;
  }
  els.menuBtn.addEventListener("click", open);
  els.closeSidebar.addEventListener("click", close);
  els.sidebarOverlay.addEventListener("click", close);
}

// Same rule as lesson.js: a chapter id's first two "-"-joined segments group
// it under a section prefix (e.g. "2-4-2a" -> "2-4").
function chapterSectionPrefix(chapterId) {
  return chapterId.split("-").slice(0, 2).join("-");
}

function buildSectionOrder() {
  const sections = meta.sections || {};
  const seen = new Set();
  const order = [];
  (meta.chapters || []).forEach((ch) => {
    const prefix = chapterSectionPrefix(ch.id);
    if (sections[prefix] && !seen.has(prefix)) {
      seen.add(prefix);
      order.push({ prefix, title: sections[prefix] });
    }
  });
  return order;
}

function chaptersInSection(prefix) {
  return (meta.chapters || []).filter((ch) => chapterSectionPrefix(ch.id) === prefix);
}

function renderSidebar() {
  els.sidebarCourseTitle.textContent = `${meta.title} · 複習整理`;
  els.sectionList.innerHTML = "";
  sectionOrder.forEach((s) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `review.html?course=${courseId}&section=${s.prefix}`;
    a.className = "chapter-list__link";
    if (s.prefix === sectionId) a.classList.add("chapter-list__link--active");
    a.textContent = `${s.prefix} ${s.title}`;
    li.appendChild(a);
    els.sectionList.appendChild(li);
  });
}

function updateFooterNav() {
  const idx = sectionOrder.findIndex((s) => s.prefix === sectionId);
  els.footerProgress.textContent = sectionOrder.length ? `${idx + 1} / ${sectionOrder.length}` : "";

  const prev = sectionOrder[idx - 1];
  els.footerPrevBtn.disabled = !prev;
  els.footerPrevBtn.onclick = prev
    ? () => (location.href = `review.html?course=${courseId}&section=${prev.prefix}`)
    : null;

  const next = sectionOrder[idx + 1];
  els.footerNextBtn.disabled = !next;
  els.footerNextBtn.onclick = next
    ? () => (location.href = `review.html?course=${courseId}&section=${next.prefix}`)
    : null;
}

// Auto-generated "相關章節" quick-jump list, independent of whatever links the
// cheatsheet's own Markdown body happens to include — so every chapter in the
// section is always reachable even if the author forgot to link one.
function renderRelatedChapters() {
  const chapters = chaptersInSection(sectionId);
  if (!chapters.length) {
    els.relatedChapters.innerHTML = "";
    return;
  }
  const pills = chapters
    .map((ch) => `<a class="related-chapters__pill" href="lesson.html?course=${courseId}&doc=${ch.id}">${ch.title}</a>`)
    .join("");
  els.relatedChapters.innerHTML = `
    <div class="related-chapters__label">相關章節</div>
    <div class="related-chapters__list">${pills}</div>
  `;
}

async function loadContent() {
  if (!sectionId) {
    els.reviewContent.innerHTML = "<p>找不到這個複習章節。</p>";
    return;
  }
  const sectionInfo = sectionOrder.find((s) => s.prefix === sectionId);
  const fallbackTitle = sectionInfo ? `${sectionInfo.prefix} ${sectionInfo.title}` : sectionId;
  els.reviewTitle.textContent = `${meta.title} · ${fallbackTitle} 複習整理`;
  document.title = `${fallbackTitle} 複習整理 | APCS 教學網站`;

  try {
    const { meta: sheetMeta, html } = await loadCheatsheetHtml(sectionId);
    els.reviewContent.innerHTML = html;
    if (sheetMeta.title) {
      els.reviewTitle.textContent = `${meta.title} · ${sheetMeta.title}`;
      document.title = `${sheetMeta.title} | APCS 教學網站`;
    }
  } catch (err) {
    els.reviewContent.innerHTML = `<p>這個大章節還沒有整理頁(找不到 data/cheatsheet/${sectionId}-sheet.html)。</p>`;
  }
}

async function init() {
  setupSidebarToggle();

  meta = await loadCourseMetadata(courseId);
  sectionOrder = buildSectionOrder();
  if (!sectionId && sectionOrder[0]) sectionId = sectionOrder[0].prefix;

  renderSidebar();
  updateFooterNav();
  renderRelatedChapters();
  await loadContent();
}

init();
