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

// Fixed multiple-choice format: free question text, then one <selectN>...
// </selectN> tag per option (content starts with the option's own letter,
// e.g. "A. 一級分"), then <ans>LETTER</ans>, then optional <detail>...</detail>.
//   題目文字...
//   <select1>A. 一級分</select1>
//   <select2>B. 二級分</select2>
//   <ans>B</ans>
//   <detail>說明...</detail>
const SELECT_TAG = /<select(\d+)>([\s\S]*?)<\/select\1>/g;
const ANS_TAG = /<ans>([\s\S]*?)<\/ans>/;
const DETAIL_TAG = /<detail>([\s\S]*?)<\/detail>/;
const OPTION_LETTER = /^\s*([A-Za-z0-9]+)[.、]?\s*(.*)$/s;

function parseMcRequest(raw) {
  const selectMatches = [...raw.matchAll(SELECT_TAG)];
  if (!selectMatches.length) return null;

  const options = selectMatches.map((m) => {
    const content = m[2].trim();
    const parsed = content.match(OPTION_LETTER);
    return parsed ? { letter: parsed[1], text: parsed[2].trim() } : { letter: content, text: content };
  });

  const ansMatch = raw.match(ANS_TAG);
  if (!ansMatch) {
    throw new Error("選擇題有 <selectN> 但缺少 <ans> 標籤");
  }
  const ansKey = ansMatch[1].trim();
  const matchedOption = options.find((o) => o.letter.toLowerCase() === ansKey.toLowerCase());
  if (!matchedOption) {
    throw new Error(`<ans>${ansKey}</ans> 找不到對應的 <selectN> 選項`);
  }

  const question = raw.slice(0, selectMatches[0].index).trim();
  const detailMatch = raw.match(DETAIL_TAG);

  return {
    type: "mc",
    question,
    options,
    answer: matchedOption.letter,
    explanation: detailMatch ? detailMatch[1].trim() : "",
  };
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
