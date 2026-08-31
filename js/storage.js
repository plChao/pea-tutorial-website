const STORAGE_KEY = "apcs_tutor_state_v1";

function defaultState() {
  return {
    courses: {},
    badges: {},
    stats: { practiceDates: [] },
    ui: { splitRatio: 0.35 },
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      ...defaultState(),
      ...parsed,
      stats: { ...defaultState().stats, ...(parsed.stats || {}) },
      ui: { ...defaultState().ui, ...(parsed.ui || {}) },
    };
  } catch (err) {
    console.warn("讀取進度失敗，改用預設狀態", err);
    return defaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function recordPracticeToday(state) {
  const today = todayStr();
  if (!state.stats.practiceDates.includes(today)) {
    state.stats.practiceDates.push(today);
  }
  return state;
}

function ensureCourse(state, courseId) {
  state.courses[courseId] = state.courses[courseId] || {
    chapters: {},
    lastVisitedChapter: null,
  };
  return state.courses[courseId];
}

function ensureChapter(state, courseId, chapterId) {
  const course = ensureCourse(state, courseId);
  course.chapters[chapterId] = course.chapters[chapterId] || {
    completed: false,
    perfect: false,
    currentSubtask: 1,
    code: null,
    subtaskPassed: {},
    failStreak: 0,
    hintUsedAny: false,
    failedAny: false,
  };
  return course.chapters[chapterId];
}

export function getChapterProgress(state, courseId, chapterId) {
  return ensureChapter(state, courseId, chapterId);
}

export function setChapterCode(state, courseId, chapterId, code) {
  const ch = ensureChapter(state, courseId, chapterId);
  ch.code = code;
}

export function setLastVisited(state, courseId, chapterId) {
  const course = ensureCourse(state, courseId);
  course.lastVisitedChapter = chapterId;
}

export function recordSubtaskAttempt(state, courseId, chapterId, subtaskId, passed, hintShown) {
  const ch = ensureChapter(state, courseId, chapterId);
  if (passed) {
    ch.subtaskPassed[subtaskId] = true;
    ch.failStreak = 0;
    ch.currentSubtask = Math.max(ch.currentSubtask, subtaskId + 1);
  } else {
    ch.failStreak = (ch.failStreak || 0) + 1;
    ch.failedAny = true;
  }
  if (hintShown) ch.hintUsedAny = true;
  return ch;
}

export function markChapterComplete(state, courseId, chapterId) {
  const ch = ensureChapter(state, courseId, chapterId);
  ch.completed = true;
  ch.perfect = !ch.failedAny && !ch.hintUsedAny;
  return ch;
}

export function isChapterUnlocked(state, courseId, chapters, chapterId) {
  const idx = chapters.findIndex((c) => c.id === chapterId);
  if (idx <= 0) return true;
  const prevId = chapters[idx - 1].id;
  const course = state.courses[courseId];
  return !!(course && course.chapters[prevId] && course.chapters[prevId].completed);
}

export function courseProgress(state, courseId, chapters) {
  if (!chapters.length) return 0;
  const course = state.courses[courseId];
  if (!course) return 0;
  const done = chapters.filter((c) => course.chapters[c.id] && course.chapters[c.id].completed).length;
  return Math.round((done / chapters.length) * 100);
}

export function exportStateAsJSON(state) {
  return JSON.stringify(state, null, 2);
}

export function importStateFromJSON(json) {
  const parsed = JSON.parse(json);
  saveState(parsed);
  return parsed;
}
