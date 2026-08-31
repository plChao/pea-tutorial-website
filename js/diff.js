function splitLines(text) {
  const lines = text.split("\n");
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/**
 * Build a tkdiff-like side-by-side row list from two texts.
 * @returns {Array<{left: string|undefined, right: string|undefined, type: 'same'|'diff'|'removed'|'added'}>}
 */
export function buildDiffRows(expected, actual) {
  const parts = window.Diff.diffLines(expected, actual);
  const rows = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.removed) {
      const next = parts[i + 1];
      const leftLines = splitLines(part.value);
      if (next && next.added) {
        const rightLines = splitLines(next.value);
        const max = Math.max(leftLines.length, rightLines.length);
        for (let j = 0; j < max; j++) {
          rows.push({ left: leftLines[j], right: rightLines[j], type: "diff" });
        }
        i++;
      } else {
        leftLines.forEach((l) => rows.push({ left: l, right: undefined, type: "removed" }));
      }
    } else if (part.added) {
      splitLines(part.value).forEach((l) => rows.push({ left: undefined, right: l, type: "added" }));
    } else {
      splitLines(part.value).forEach((l) => rows.push({ left: l, right: l, type: "same" }));
    }
  }
  return rows;
}

function escapeHtml(s) {
  if (s === undefined) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderDiffHtml(expected, actual) {
  const rows = buildDiffRows(expected, actual);
  const rowsHtml = rows
    .map((r) => {
      const leftCls = r.type === "diff" || r.type === "removed" ? "diff-cell--removed" : "";
      const rightCls = r.type === "diff" || r.type === "added" ? "diff-cell--added" : "";
      return `<div class="diff-row">
        <div class="diff-cell ${leftCls}">${escapeHtml(r.left) || "&nbsp;"}</div>
        <div class="diff-cell ${rightCls}">${escapeHtml(r.right) || "&nbsp;"}</div>
      </div>`;
    })
    .join("");
  return `<div class="diff-table">
    <div class="diff-row diff-row--head">
      <div class="diff-cell diff-cell--head">預期輸出</div>
      <div class="diff-cell diff-cell--head">你的輸出</div>
    </div>
    ${rowsHtml}
  </div>`;
}

export function normalizeOutput(text) {
  return text
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");
}

export function outputsMatch(expected, actual) {
  return normalizeOutput(expected) === normalizeOutput(actual);
}
