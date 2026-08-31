async function fetchText(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`無法載入 ${path}（${res.status}）`);
  return res.text();
}

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`無法載入 ${path}（${res.status}）`);
  return res.json();
}

export async function loadCourseList() {
  const data = await fetchJSON("data/courses.json");
  return data.courses;
}

export async function loadCourseMetadata(courseId) {
  const raw = await fetchText(`data/document/${courseId}/metadata.md`);
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error(`data/document/${courseId}/metadata.md 缺少 YAML front matter`);
  const meta = window.jsyaml.load(match[1]);
  meta.chapters = meta.chapters || [];
  return meta;
}

// Document files are Markdown, with raw HTML (e.g. <details>) passed through
// as-is by marked() — so plain HTML like the old lesson pages still works
// unchanged, but authoring can also just use "## heading" / "**bold**" /
// tables / links directly, as in 1-1-1.html and 2-1-1.html.
export async function loadDocumentHtml(courseId, file) {
  const raw = await fetchText(`data/document/${courseId}/${file}`);
  let meta = {};
  let body = raw;
  const metaMatch = raw.match(/<script type="application\/json" id="meta">([\s\S]*?)<\/script>/);
  if (metaMatch) {
    try {
      meta = JSON.parse(metaMatch[1]);
    } catch (err) {
      console.warn(`${file} 的 meta script 不是合法 JSON`, err);
    }
    body = raw.slice(0, metaMatch.index) + raw.slice(metaMatch.index + metaMatch[0].length);
  }
  return { meta, html: window.marked.parse(body.trim()) };
}

export async function loadExerciseMeta(courseId, exerciseId) {
  try {
    return await fetchJSON(`data/exercise/${courseId}/${exerciseId}/meta.json`);
  } catch {
    return null;
  }
}

export async function loadInitCode(courseId, exerciseId) {
  return fetchText(`data/exercise/${courseId}/${exerciseId}/0init_code.py`);
}

const HINT_MARKER = "---HINT---";
const STDIN_MARKER = "---STDIN---";
const DETAILS_BLOCK = /<details[^>]*>\s*<summary>[^<]*<\/summary>([\s\S]*?)<\/details>/i;
const ANSWER_LINE = /\*{0,2}答案[:：]\s*\*{0,2}\s*([A-D])\s*\*{0,2}/;

// Multiple-choice subtasks are authored as: scenario/question text, then a
// run of "A. ..." / "B. ..." / ... option lines, then the answer — either
// bare ("答案：X" + explanation) or wrapped in <details><summary>查看答案
// </summary>...</details>. This parses that exact human-authored shape
// directly (both variants) rather than forcing a stricter structured format
// that would require rewriting existing content.
function parseMcRequest(raw) {
  const lines = raw.split(/\r?\n/);
  const firstOptIdx = lines.findIndex((l) => /^[A-D][.、]\s*/.test(l));
  if (firstOptIdx === -1) return null;

  const options = [];
  let i = firstOptIdx;
  while (i < lines.length) {
    const m = lines[i].match(/^([A-D])[.、]\s*(.+)$/);
    if (m) {
      options.push({ letter: m[1], text: m[2].trim() });
      i++;
    } else if (lines[i].trim() === "" && options.length > 0) {
      i++;
      break;
    } else {
      break;
    }
  }
  if (options.length < 2) return null;

  const question = lines.slice(0, firstOptIdx).join("\n").trim();
  let rest = lines.slice(i).join("\n").trim();

  const detailsMatch = rest.match(DETAILS_BLOCK);
  let explanation = detailsMatch ? detailsMatch[1].trim() : rest;

  const answerMatch = explanation.match(ANSWER_LINE);
  const answer = answerMatch ? answerMatch[1] : options[0].letter;
  if (answerMatch) {
    explanation = (
      explanation.slice(0, answerMatch.index) + explanation.slice(answerMatch.index + answerMatch[0].length)
    ).trim();
  }

  return { type: "mc", question, options, answer, explanation };
}

function parseCodeRequest(raw) {
  let rest = raw;
  let stdin = "";
  const stdinIdx = rest.indexOf(STDIN_MARKER);
  if (stdinIdx !== -1) {
    stdin = rest.slice(stdinIdx + STDIN_MARKER.length).replace(/^\r?\n/, "");
    rest = rest.slice(0, stdinIdx);
  }

  let hint = "";
  const hintIdx = rest.indexOf(HINT_MARKER);
  let description = rest;
  if (hintIdx !== -1) {
    hint = rest.slice(hintIdx + HINT_MARKER.length).replace(/^\r?\n/, "").trim();
    description = rest.slice(0, hintIdx);
  }

  return { type: "code", description: description.trim(), hint, stdin };
}

function parseRequest(raw) {
  return parseMcRequest(raw) || parseCodeRequest(raw);
}

export async function loadSubtask(courseId, exerciseId, n) {
  const base = `data/exercise/${courseId}/${exerciseId}/${n}`;
  const requestRaw = await fetchText(`${base}request`);
  const parsed = parseRequest(requestRaw);
  if (parsed.type === "code") {
    const expectout = await fetchText(`${base}expectout.txt`);
    return { ...parsed, expectout };
  }
  return parsed;
}
