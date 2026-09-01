import {
  loadCourseMetadata,
  loadDocumentHtml,
  loadExerciseMeta,
  loadInitCode,
  loadSubtask,
} from "../dataLoader.js";
import {
  loadState,
  saveState,
  getChapterProgress,
  setChapterCode,
  setLastVisited,
  recordSubtaskAttempt,
  markChapterComplete,
  isChapterUnlocked,
  recordPracticeToday,
} from "../storage.js";
import { evaluateBadges, celebrateBadges } from "../badges.js";
import { renderDiffHtml, outputsMatch } from "../diff.js";
import { createCodeEditor, setupStdinTextarea } from "../editor.js";
import { initPyodideRunner, runPython } from "../pyodideRunner.js";
import { requireUnlock } from "../authGate.js";

const params = new URLSearchParams(location.search);
const courseId = params.get("course") || "001";
let docId = params.get("doc");

const els = {
  chapterTitle: document.getElementById("chapterTitle"),
  progressDots: document.getElementById("progressDots"),
  menuBtn: document.getElementById("menuBtn"),
  closeSidebar: document.getElementById("closeSidebar"),
  sidebar: document.getElementById("sidebar"),
  sidebarOverlay: document.getElementById("sidebarOverlay"),
  sidebarCourseTitle: document.getElementById("sidebarCourseTitle"),
  chapterList: document.getElementById("chapterList"),
  lessonContent: document.getElementById("lessonContent"),
  taskPanel: document.getElementById("taskPanel"),
  prevSubtaskBtn: document.getElementById("prevSubtaskBtn"),
  nextSubtaskBtn: document.getElementById("nextSubtaskBtn"),
  taskStep: document.getElementById("taskStep"),
  codeTaskView: document.getElementById("codeTaskView"),
  taskDesc: document.getElementById("taskDesc"),
  hintBtn: document.getElementById("hintBtn"),
  hintText: document.getElementById("hintText"),
  mcTaskView: document.getElementById("mcTaskView"),
  mcQuestion: document.getElementById("mcQuestion"),
  mcOptions: document.getElementById("mcOptions"),
  mcExplanation: document.getElementById("mcExplanation"),
  workspace: document.getElementById("workspace"),
  footerProgress: document.getElementById("footerProgress"),
  footerPrevBtn: document.getElementById("footerPrevBtn"),
  footerNextBtn: document.getElementById("footerNextBtn"),
  paneLesson: document.getElementById("paneLesson"),
  paneEditor: document.getElementById("paneEditor"),
  paneIo: document.getElementById("paneIo"),
  paneDividerA: document.getElementById("paneDividerA"),
  paneDividerB: document.getElementById("paneDividerB"),
  codeEditorEl: document.getElementById("codeEditor"),
  runBtn: document.getElementById("runBtn"),
  pyodideStatus: document.getElementById("pyodideStatus"),
  stdinBox: document.getElementById("stdinBox"),
  ioDivider: document.getElementById("ioDivider"),
  ioStdin: document.getElementById("ioStdin"),
  outputBox: document.getElementById("outputBox"),
  diffBox: document.getElementById("diffBox"),
};

let state = loadState();
let editor = null;
let pyodideReady = false;
let pyodideInitStarted = false;
let meta = null;
let chapters = [];
let exerciseMeta = null;
let currentSubtaskId = 1;
let currentSubtask = null;

function persist() {
  saveState(state);
}

function md(text) {
  return text ? window.marked.parse(text) : "";
}

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

function renderSidebarAndTopbar() {
  els.sidebarCourseTitle.textContent = meta.title;
  els.chapterList.innerHTML = "";
  els.progressDots.innerHTML = "";

  chapters.forEach((ch) => {
    const unlocked = isChapterUnlocked(state, courseId, chapters, ch.id);
    const progress = getChapterProgress(state, courseId, ch.id);
    const isCurrent = ch.id === docId;

    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `lesson.html?course=${courseId}&doc=${ch.id}`;
    a.className = "chapter-list__link";
    if (isCurrent) a.classList.add("chapter-list__link--active");
    if (!unlocked) a.classList.add("chapter-list__link--locked");
    const icon = progress.completed ? "✅" : unlocked ? "📘" : "🔒";
    a.textContent = `${icon} ${ch.title}`;
    li.appendChild(a);
    els.chapterList.appendChild(li);

    const dot = document.createElement("div");
    dot.className = "progress-dots__dot";
    if (progress.completed) dot.classList.add("progress-dots__dot--done");
    if (isCurrent) dot.classList.add("progress-dots__dot--current");
    els.progressDots.appendChild(dot);
  });

  updateFooterNav();
}

// Footer's "下一章" stays clickable even when locked (not a native `disabled`
// button) so clicking it can explain *why* via SweetAlert, instead of a real
// disabled button that would just silently eat the click.
function updateFooterNav() {
  const idx = chapters.findIndex((c) => c.id === docId);
  els.footerProgress.textContent = `${idx + 1} / ${chapters.length}`;

  const prevChapter = chapters[idx - 1];
  els.footerPrevBtn.disabled = !prevChapter;

  const nextChapter = chapters[idx + 1];
  if (!nextChapter) {
    els.footerNextBtn.disabled = true;
    els.footerNextBtn.classList.remove("btn--locked");
  } else {
    els.footerNextBtn.disabled = false;
    const progress = getChapterProgress(state, courseId, docId);
    els.footerNextBtn.classList.toggle("btn--locked", !progress.completed);
  }
}

function setupFooterNav() {
  els.footerPrevBtn.addEventListener("click", () => {
    const idx = chapters.findIndex((c) => c.id === docId);
    const prev = chapters[idx - 1];
    if (prev) location.href = `lesson.html?course=${courseId}&doc=${prev.id}`;
  });

  els.footerNextBtn.addEventListener("click", () => {
    const idx = chapters.findIndex((c) => c.id === docId);
    const next = chapters[idx + 1];
    if (!next) return;
    const progress = getChapterProgress(state, courseId, docId);
    if (!progress.completed) {
      if (window.Swal) {
        window.Swal.fire({
          icon: "info",
          title: "還沒完成這一章喔",
          text: "請先完成這一章的所有任務，才能前往下一章。",
          confirmButtonText: "好的",
        });
      }
      return;
    }
    location.href = `lesson.html?course=${courseId}&doc=${next.id}`;
  });
}

async function loadLessonBody() {
  const chapterInfo = chapters.find((c) => c.id === docId);
  if (!chapterInfo) {
    els.lessonContent.innerHTML = "<p>找不到這個章節。</p>";
    return null;
  }
  const { meta: docMeta, html } = await loadDocumentHtml(courseId, chapterInfo.file);
  els.lessonContent.innerHTML = html;
  const title = docMeta.title || chapterInfo.title;
  els.chapterTitle.textContent = `${meta.title} · ${title}`;
  document.title = `${title} | APCS 教學網站`;
  return chapterInfo;
}

// ---------- 3-way resizable panes ----------
let paneRatios = [32, 34, 34];

function applyPaneRatios() {
  els.paneLesson.style.flex = `0 0 ${paneRatios[0]}%`;
  els.paneEditor.style.flex = `0 0 ${paneRatios[1]}%`;
  els.paneIo.style.flex = `0 0 ${paneRatios[2]}%`;
}

function setupPaneResizing() {
  if (Array.isArray(state.ui.paneRatios) && state.ui.paneRatios.length === 3) {
    paneRatios = state.ui.paneRatios.slice();
  }
  applyPaneRatios();

  function dragBoundary(dividerEl, leftIdx, rightIdx) {
    let dragging = false;
    dividerEl.addEventListener("pointerdown", (e) => {
      dragging = true;
      dividerEl.setPointerCapture(e.pointerId);
    });
    dividerEl.addEventListener("pointerup", () => (dragging = false));
    dividerEl.addEventListener("pointercancel", () => (dragging = false));
    dividerEl.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const rect = els.workspace.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const before = paneRatios.slice(0, leftIdx).reduce((a, b) => a + b, 0);
      const pairTotal = paneRatios[leftIdx] + paneRatios[rightIdx];
      let newLeft = xPct - before;
      newLeft = Math.max(10, Math.min(pairTotal - 10, newLeft));
      paneRatios[leftIdx] = newLeft;
      paneRatios[rightIdx] = pairTotal - newLeft;
      applyPaneRatios();
    });
    window.addEventListener("pointerup", () => {
      if (dragging) {
        state.ui.paneRatios = paneRatios;
        persist();
      }
    });
  }

  dragBoundary(els.paneDividerA, 0, 1);
  dragBoundary(els.paneDividerB, 1, 2);
}

// mc-type subtasks don't need the code editor / stdin+output panes at all.
function setPaneVisibility(showCode) {
  const display = showCode ? "" : "none";
  els.paneEditor.style.display = display;
  els.paneIo.style.display = display;
  els.paneDividerA.style.display = display;
  els.paneDividerB.style.display = display;
  els.paneLesson.style.flex = showCode ? "" : "1 1 auto";
  if (showCode) applyPaneRatios();
}

function setupIoDivider() {
  let dragging = false;
  els.ioDivider.addEventListener("pointerdown", (e) => {
    dragging = true;
    e.target.setPointerCapture(e.pointerId);
  });
  els.ioDivider.addEventListener("pointerup", () => (dragging = false));
  els.ioDivider.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const parent = els.ioDivider.parentElement;
    const rect = parent.getBoundingClientRect();
    let ratio = (e.clientY - rect.top) / rect.height;
    ratio = Math.min(0.8, Math.max(0.15, ratio));
    els.ioStdin.style.flex = `0 0 ${ratio * 100}%`;
    state.ui.splitRatio = ratio;
  });
  els.ioDivider.addEventListener("pointercancel", () => (dragging = false));
  window.addEventListener("pointerup", () => {
    if (dragging) persist();
  });
  els.ioStdin.style.flex = `0 0 ${(state.ui.splitRatio || 0.35) * 100}%`;
}

// ---------- lazy code runtime (editor + Pyodide) ----------
async function ensureCodeRuntime() {
  if (!pyodideInitStarted) {
    pyodideInitStarted = true;
    initPyodideRunner(() => {
      pyodideReady = true;
      els.pyodideStatus.textContent = "Python 執行環境已就緒";
      els.runBtn.disabled = false;
    });
  }

  if (!editor) {
    const savedCode = getChapterProgress(state, courseId, docId).code;
    let initCode = "# 請在這裡寫下你的程式碼\n";
    if (exerciseMeta && exerciseMeta.__exerciseId) {
      try {
        initCode = await loadInitCode(courseId, exerciseMeta.__exerciseId);
      } catch {
        // no 0init_code.py for this exercise — keep the generic default
      }
    }
    editor = createCodeEditor(els.codeEditorEl, savedCode != null ? savedCode : initCode, (code) => {
      setChapterCode(state, courseId, docId, code);
      persist();
    });
  }
}

// ---------- subtask navigation & rendering ----------
function maxUnlockedSubtask() {
  if (!exerciseMeta) return 1;
  const progress = getChapterProgress(state, courseId, docId);
  return progress.completed ? exerciseMeta.subtaskCount : Math.min(progress.currentSubtask || 1, exerciseMeta.subtaskCount);
}

function updateSubtaskNavButtons() {
  els.prevSubtaskBtn.disabled = currentSubtaskId <= 1;
  els.nextSubtaskBtn.disabled = currentSubtaskId >= maxUnlockedSubtask();
  updateFooterNav();
}

function renderMcOptions() {
  els.mcOptions.innerHTML = "";
  currentSubtask.options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mc-option";
    btn.textContent = `${opt.letter}. ${opt.text}`;
    btn.dataset.letter = opt.letter;
    btn.addEventListener("click", () => selectMcOption(opt.letter));
    els.mcOptions.appendChild(btn);
  });
}

function showMcExplanation() {
  els.mcExplanation.hidden = false;
  els.mcExplanation.innerHTML = md(currentSubtask.explanation);
}

// Already-resolved view (revisiting a passed subtask via ‹ ›): show the
// correct answer, everything locked.
function renderResolvedMc() {
  Array.from(els.mcOptions.children).forEach((btn) => {
    btn.disabled = true;
    if (btn.dataset.letter === currentSubtask.answer) btn.classList.add("mc-option--correct");
  });
  showMcExplanation();
}

const MC_AUTO_ADVANCE_DELAY_MS = 1100;

// A wrong pick only locks *that* option (red) so the student can keep
// trying the others; a correct pick locks everything (green) and, after a
// short beat to see the explanation, auto-advances to the next subtask.
function selectMcOption(letter) {
  const passed = letter === currentSubtask.answer;
  const btn = Array.from(els.mcOptions.children).find((b) => b.dataset.letter === letter);
  if (btn) {
    btn.disabled = true;
    btn.classList.add(passed ? "mc-option--correct" : "mc-option--incorrect");
  }
  if (passed) {
    Array.from(els.mcOptions.children).forEach((b) => (b.disabled = true));
  }
  showMcExplanation();

  const chProgress = recordSubtaskAttempt(state, courseId, docId, currentSubtaskId, passed, false);
  recordPracticeToday(state);

  const subtaskIdAtAnswer = currentSubtaskId;
  const isLastSubtask = currentSubtaskId >= exerciseMeta.subtaskCount;

  const events = [];
  if (passed) {
    if (isLastSubtask) {
      markChapterComplete(state, courseId, docId);
      events.push({ type: "chapter-complete", perfect: chProgress.perfect });
    }
  } else {
    events.push({ type: "submit-fail", failStreak: chProgress.failStreak });
  }

  renderSidebarAndTopbar();
  updateSubtaskNavButtons();
  handleBadgeEvents(events);

  if (passed && !isLastSubtask) {
    setTimeout(() => {
      // Only jump if the student hasn't already navigated away manually
      // during the delay (e.g. clicked ‹ to review an earlier subtask).
      if (currentSubtaskId === subtaskIdAtAnswer) goToSubtask(subtaskIdAtAnswer + 1);
    }, MC_AUTO_ADVANCE_DELAY_MS);
  }
}

async function renderSubtaskPanel() {
  els.taskPanel.hidden = false;
  els.taskStep.textContent = `任務 ${currentSubtaskId} / ${exerciseMeta.subtaskCount}`;

  const progress = getChapterProgress(state, courseId, docId);
  const alreadyPassed = !!progress.subtaskPassed[currentSubtaskId];

  if (currentSubtask.type === "mc") {
    setPaneVisibility(false);
    els.codeTaskView.hidden = true;
    els.mcTaskView.hidden = false;
    els.mcQuestion.innerHTML = md(currentSubtask.question);
    els.mcExplanation.hidden = true;
    renderMcOptions();
    if (alreadyPassed) renderResolvedMc();
  } else {
    setPaneVisibility(true);
    els.codeTaskView.hidden = false;
    els.mcTaskView.hidden = true;
    els.taskDesc.innerHTML = md(currentSubtask.description);
    els.hintText.hidden = true;
    els.hintText.innerHTML = md(currentSubtask.hint);
    els.hintBtn.hidden = !currentSubtask.hint;
    els.hintBtn.textContent = "💡 顯示提示";
    els.stdinBox.value = currentSubtask.stdin || "";
    await ensureCodeRuntime();
  }

  updateSubtaskNavButtons();
}

async function goToSubtask(n) {
  currentSubtaskId = n;
  currentSubtask = await loadSubtask(courseId, exerciseMeta.__exerciseId, n);
  await renderSubtaskPanel();
}

async function setupExercise(chapterInfo) {
  if (!chapterInfo.exercise) {
    els.taskPanel.hidden = true;
    if (!getChapterProgress(state, courseId, docId).completed) {
      markChapterComplete(state, courseId, docId);
      persist();
    }
    await ensureCodeRuntime();
    return;
  }

  exerciseMeta = await loadExerciseMeta(courseId, chapterInfo.exercise);
  if (!exerciseMeta) {
    els.taskPanel.hidden = true;
    await ensureCodeRuntime();
    return;
  }
  exerciseMeta.__exerciseId = chapterInfo.exercise;

  await goToSubtask(maxUnlockedSubtask());
}

function setOutput(text, isError) {
  els.diffBox.hidden = true;
  els.outputBox.hidden = false;
  els.outputBox.textContent = text || "(沒有輸出)";
  els.outputBox.classList.toggle("output-box--error", !!isError);
}

function showDiff(expected, actual) {
  els.outputBox.hidden = true;
  els.diffBox.hidden = false;
  els.diffBox.innerHTML = renderDiffHtml(expected, actual);
}

async function handleBadgeEvents(events) {
  let newly = [];
  for (const ev of events) {
    newly = newly.concat(evaluateBadges(state, ev));
  }
  persist();
  if (newly.length) await celebrateBadges(newly);
}

// RUN always executes with whatever is in the stdin box, so free experimenting
// with custom input still works. It ALSO auto-checks the current code subtask,
// but only when the stdin box still matches that subtask's official test data
// — editing stdin to try something else never gets mis-graded against the
// wrong expected output, it just runs.
function setupRunButton() {
  els.runBtn.addEventListener("click", async () => {
    if (!pyodideReady) return;
    els.runBtn.disabled = true;
    setOutput("執行中…");
    const code = editor.getCode();
    const stdinValue = els.stdinBox.value;
    const result = await runPython(code, stdinValue);
    const truncatedNote =
      result.stdoutTruncated || result.stderrTruncated
        ? "\n\n⚠ 輸出過長，已截斷顯示(可能是無窮迴圈持續印出內容)。"
        : "";
    setOutput(result.stdout + (result.stderr ? "\n" + result.stderr : "") + truncatedNote, !result.ok);
    recordPracticeToday(state);

    const events = [{ type: "run" }];

    if (currentSubtask && currentSubtask.type === "code" && stdinValue === (currentSubtask.stdin || "")) {
      const passed =
        result.ok &&
        !result.stdoutTruncated &&
        !result.stderrTruncated &&
        outputsMatch(currentSubtask.expectout, result.stdout);
      const hintShown = !els.hintText.hidden;
      const chProgress = recordSubtaskAttempt(state, courseId, docId, currentSubtaskId, passed, hintShown);

      if (passed) {
        if (currentSubtaskId >= exerciseMeta.subtaskCount) {
          markChapterComplete(state, courseId, docId);
          events.push({ type: "chapter-complete", perfect: chProgress.perfect });
          updateSubtaskNavButtons();
        } else {
          await goToSubtask(currentSubtaskId + 1);
        }
        renderSidebarAndTopbar();
      } else {
        events.push({ type: "submit-fail", failStreak: chProgress.failStreak });
        showDiff(currentSubtask.expectout, result.stdout);
        if (chProgress.failStreak >= 2 && currentSubtask.hint) {
          els.hintText.hidden = false;
        }
      }
    }

    await handleBadgeEvents(events);
    els.runBtn.disabled = false;
  });

  els.hintBtn.addEventListener("click", () => {
    els.hintText.hidden = !els.hintText.hidden;
  });

  els.prevSubtaskBtn.addEventListener("click", () => {
    if (currentSubtaskId > 1) goToSubtask(currentSubtaskId - 1);
  });
  els.nextSubtaskBtn.addEventListener("click", () => {
    if (currentSubtaskId < maxUnlockedSubtask()) goToSubtask(currentSubtaskId + 1);
  });
}

async function init() {
  setupSidebarToggle();
  setupPaneResizing();
  setupIoDivider();
  setupStdinTextarea(els.stdinBox);
  setupRunButton();
  setupFooterNav();

  meta = await loadCourseMetadata(courseId);
  chapters = meta.chapters || [];

  if (!docId && chapters[0]) {
    location.replace(`lesson.html?course=${courseId}&doc=${chapters[0].id}`);
    return;
  }

  setLastVisited(state, courseId, docId);
  persist();

  renderSidebarAndTopbar();
  const chapterInfo = await loadLessonBody();
  if (!chapterInfo) return;

  await setupExercise(chapterInfo);
  renderSidebarAndTopbar();
}

requireUnlock(init);
