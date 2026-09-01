// Pattern-matches common CPython exception messages to short, actionable
// zh-TW explanations, so students get a hint instead of a raw traceback.
// Ported from apcs-judge's translateError() (https://github.com/Yu-0312/apcs-judge).

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const RULES = [
  {
    re: /NameError: name '(.+?)' is not defined/,
    msg: (m) =>
      `<b>變數沒定義</b>：你用了 <code>${escapeHtml(m[1])}</code>，但前面從沒設定它的值。檢查拼字、或在使用前先 <code>${escapeHtml(m[1])} = ...</code>。`,
  },
  {
    re: /IndentationError|unexpected indent|expected an indented block/,
    msg: () => `<b>縮排錯了</b>：Python 用空白來分組，<code>if</code>/<code>for</code>/<code>def</code> 下一行一定要往內縮 4 個空白。同一段也要對齊。`,
  },
  {
    re: /SyntaxError: invalid syntax/,
    msg: () => `<b>語法錯誤</b>：通常是漏冒號 <code>:</code>、漏括號、引號沒成對。看一下錯誤指到的那一行附近。`,
  },
  {
    re: /SyntaxError: EOL while scanning string literal|unterminated string/,
    msg: () => `<b>字串沒收尾</b>：開了 <code>"</code> 或 <code>'</code> 但沒關起來。`,
  },
  {
    re: /SyntaxError: '([([{])' was never closed/,
    msg: (m) => `<b>括號沒收尾</b>：開了 <code>${escapeHtml(m[1])}</code> 但沒有對應的收尾括號。檢查那一行(或往後幾行)是不是少打了。`,
  },
  {
    re: /SyntaxError: unmatched '([)\]}])'/,
    msg: (m) => `<b>括號多了一個</b>：出現了一個沒有對應開頭的 <code>${escapeHtml(m[1])}</code>。檢查括號數量是否配對。`,
  },
  {
    re: /SyntaxError: expected ':'/,
    msg: () => `<b>少了冒號</b>：<code>if</code>/<code>for</code>/<code>while</code>/<code>def</code> 這一行結尾要加 <code>:</code>。`,
  },
  {
    re: /SyntaxError/,
    msg: () => `<b>語法錯誤</b>：程式碼的寫法不符合 Python 規則，通常是漏冒號、括號沒配對、或引號沒收尾。看一下錯誤指到的那一行附近。`,
  },
  {
    re: /ZeroDivisionError/,
    msg: () => `<b>除以 0 了</b>：檢查除號右邊的值是不是 0，或先用 if 擋掉。`,
  },
  {
    re: /TypeError: unsupported operand type.*'(\w+)'.* and '(\w+)'/,
    msg: (m) =>
      `<b>型別不能相加/相減</b>：<code>${escapeHtml(m[1])}</code> 和 <code>${escapeHtml(m[2])}</code> 不能直接運算。常見：字串 + 數字 → 要先 <code>str()</code> 或 <code>int()</code>。`,
  },
  {
    re: /TypeError: '(\w+)' object is not (subscriptable|iterable|callable)/,
    msg: (m) =>
      `<b>型別錯用</b>：<code>${escapeHtml(m[1])}</code> 物件不能被「${m[2] === "subscriptable" ? "用 []" : m[2] === "iterable" ? "用 for 走訪" : "呼叫"}」。`,
  },
  {
    re: /TypeError/,
    msg: () => `<b>型別錯誤</b>：兩邊型別不合(例如字串 + 數字)。用 <code>int(x)</code>/<code>str(x)</code> 轉換看看。`,
  },
  {
    re: /ValueError: invalid literal for int\(\)/,
    msg: () => `<b>int() 收到不是數字的字串</b>：例如 <code>int("abc")</code> 會錯。檢查 input 是不是有空白或非數字字元。`,
  },
  {
    re: /ValueError/,
    msg: () => `<b>值不合法</b>：函式收到它不接受的值。看看你傳了什麼。`,
  },
  {
    re: /IndexError: list index out of range/,
    msg: () => `<b>list 索引超出範圍</b>：list 只有 0 到 len(list)-1。檢查迴圈條件是不是寫成 <code><=</code> 變成多跑一格。`,
  },
  {
    re: /IndexError/,
    msg: () => `<b>索引超出範圍</b>：要存取的位置不存在。`,
  },
  {
    re: /KeyError: '?(.+?)'?$/,
    msg: (m) =>
      `<b>字典找不到這個 key</b>：<code>${escapeHtml(m[1])}</code> 不在字典裡。用 <code>d.get(key, 預設值)</code> 比較安全。`,
  },
  {
    re: /AttributeError: '(\w+)' object has no attribute '(\w+)'/,
    msg: (m) =>
      `<b>物件沒這個方法</b>：<code>${escapeHtml(m[1])}</code> 沒有 <code>.${escapeHtml(m[2])}()</code>。檢查拼字，或是不是用錯型別(例如把 str 當 list 用)。`,
  },
  {
    re: /RecursionError/,
    msg: () => `<b>遞迴太深</b>：函式呼叫自己沒有終止條件，或終止條件永遠到不了。檢查 base case。`,
  },
  {
    re: /ModuleNotFoundError|ImportError/,
    msg: () => `<b>找不到模組</b>：可能是這個套件瀏覽器版 Python 沒有。試試標準函式庫的功能。`,
  },
];

export function translateError(stderr) {
  if (!stderr) return "";
  const lines = stderr.split("\n");
  let last = "";
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim()) {
      last = lines[i];
      break;
    }
  }
  for (const rule of RULES) {
    const m = last.match(rule.re);
    if (m) return rule.msg(m);
  }
  return "";
}
