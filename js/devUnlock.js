// Hidden developer shortcut: Ctrl+Alt+P, then enter the password, marks every
// chapter (and every subtask inside it) in every course as completed — as if
// a save file for someone who finished the whole thing had just been loaded.
// This deliberately reuses the exact same state shape recordSubtaskAttempt()/
// markChapterComplete() would produce, so every gate that reads it (sidebar
// chapter list, subtask nav, footer "next chapter" button, MC resolved-state
// display) unlocks for real — not a bypass flag those call sites have to know
// to special-case. It never touches the real access-code password gate (see
// authGate.js).
import { loadCourseList, loadCourseMetadata, loadExerciseMeta } from "./dataLoader.js";
import { loadState, saveState } from "./storage.js";

const DEV_PASSWORD = "kk34";

async function buildCompletedCourseState(courseId) {
  const meta = await loadCourseMetadata(courseId);
  const chapters = meta.chapters || [];
  const chapterState = {};

  for (const ch of chapters) {
    let subtaskCount = 0;
    if (ch.exercise) {
      const exMeta = await loadExerciseMeta(courseId, ch.exercise);
      subtaskCount = (exMeta && exMeta.subtaskCount) || 0;
    }
    const subtaskPassed = {};
    for (let i = 1; i <= subtaskCount; i++) subtaskPassed[i] = true;

    chapterState[ch.id] = {
      completed: true,
      perfect: true,
      currentSubtask: subtaskCount + 1,
      code: null,
      subtaskPassed,
      failStreak: 0,
      hintUsedAny: false,
      failedAny: false,
    };
  }

  return {
    chapters: chapterState,
    lastVisitedChapter: chapters.length ? chapters[chapters.length - 1].id : null,
  };
}

async function activateDevUnlock() {
  const state = loadState();
  const courseIds = await loadCourseList();
  for (const courseId of courseIds) {
    state.courses[courseId] = await buildCompletedCourseState(courseId);
  }
  saveState(state);
}

async function promptPassword() {
  if (window.Swal) {
    const { value, isConfirmed } = await window.Swal.fire({
      title: "開發者解鎖",
      input: "password",
      inputPlaceholder: "輸入密碼",
      showCancelButton: true,
      confirmButtonText: "解鎖",
      cancelButtonText: "取消",
    });
    return isConfirmed ? value : null;
  }
  return window.prompt("開發者解鎖密碼：");
}

export function setupDevUnlock() {
  document.addEventListener("keydown", async (e) => {
    if (!e.ctrlKey || !e.altKey || e.key.toLowerCase() !== "p") return;
    e.preventDefault();

    const input = await promptPassword();
    if (input == null || input === "") return;

    if (input !== DEV_PASSWORD) {
      if (window.Swal) window.Swal.fire({ icon: "error", title: "密碼錯誤" });
      return;
    }

    await activateDevUnlock();

    if (window.Swal) {
      await window.Swal.fire({ icon: "success", title: "已解鎖所有章節", confirmButtonText: "重新整理" });
    }
    location.reload();
  });
}
