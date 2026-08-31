import { loadCourseList, loadCourseMetadata } from "../dataLoader.js";
import { loadState, courseProgress, exportStateAsJSON, importStateFromJSON } from "../storage.js";
import { BADGES } from "../badges.js";
import { requireUnlock } from "../authGate.js";

async function renderCourses() {
  const grid = document.getElementById("courseGrid");
  const state = loadState();
  try {
    const courseIds = await loadCourseList();
    const metas = await Promise.all(courseIds.map((id) => loadCourseMetadata(id).catch(() => null)));
    grid.innerHTML = "";
    metas.forEach((meta, i) => {
      if (!meta) return;
      const courseId = courseIds[i];
      const chapters = meta.chapters || [];
      const pct = courseProgress(state, courseId, chapters);
      const course = state.courses[courseId];
      const startChapter = (course && course.lastVisitedChapter) || (chapters[0] && chapters[0].id);
      const card = document.createElement("a");
      card.className = "course-card";
      card.href = startChapter ? `lesson.html?course=${courseId}&doc=${startChapter}` : "#";
      card.innerHTML = `
        <h3>${meta.title}</h3>
        <p>${meta.description || ""}</p>
        <div class="progress-bar"><div class="progress-bar__fill" style="width:${pct}%"></div></div>
        <div class="progress-label">${pct}% 完成（共 ${chapters.length} 章）</div>
      `;
      grid.appendChild(card);
    });
    if (!grid.children.length) {
      grid.innerHTML = "<p>目前還沒有課程。</p>";
    }
  } catch (err) {
    grid.innerHTML = `<p>課程載入失敗：${err.message}</p>`;
  }
}

function renderBadges() {
  const state = loadState();
  const grid = document.getElementById("badgeGrid");
  grid.innerHTML = "";
  const earnedBadges = BADGES.filter((b) => state.badges[b.id]);
  if (!earnedBadges.length) {
    grid.innerHTML = '<p class="badge-empty">尚未解鎖任何徽章，快去闖關拿第一個吧！</p>';
    return;
  }
  earnedBadges.forEach((b) => {
    const card = document.createElement("div");
    card.className = "badge-card badge-card--earned";
    card.innerHTML = `
      <div class="badge-card__icon">${b.icon}</div>
      <div class="badge-card__title">${b.title}</div>
      <div class="badge-card__desc">${b.desc}</div>
    `;
    grid.appendChild(card);
  });
}

function setupImportExport() {
  document.getElementById("exportBtn").addEventListener("click", () => {
    const state = loadState();
    const blob = new Blob([exportStateAsJSON(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "apcs-progress.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  const importBtn = document.getElementById("importBtn");
  const importFile = document.getElementById("importFile");
  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", async () => {
    const file = importFile.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      importStateFromJSON(text);
      renderCourses();
      renderBadges();
      if (window.Swal) window.Swal.fire("匯入成功", "", "success");
    } catch (err) {
      if (window.Swal) window.Swal.fire("匯入失敗", err.message, "error");
    }
    importFile.value = "";
  });
}

requireUnlock(() => {
  renderCourses();
  renderBadges();
  setupImportExport();
});
