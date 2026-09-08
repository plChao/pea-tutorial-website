importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

const pyodideReadyPromise = loadPyodide().then((pyodide) => {
  self.postMessage({ type: "ready" });
  return pyodide;
});

// pyodide's `batched` stdout/stderr handler fires once per completed line,
// with the trailing "\n" stripped off (confirmed against the actual pyodide
// runtime, not just its docs) — so chunks must be rejoined with "\n", not "".
// A final line with no trailing newline (e.g. print(x, end="")) is buffered
// on the JS side and is only delivered once the stream is fsync'd, so force
// a flush after running or the last partial line is silently dropped.
const FLUSH_CODE = `import os as __os, sys as __sys
for __f in (__sys.stdout, __sys.stderr):
    try:
        __f.flush()
        __os.fsync(__f.fileno())
    except Exception:
        pass
`;

// The Worker keeps one Python interpreter alive for the whole lesson page (a
// fresh Pyodide boot per Run would cost seconds), so without this, two things
// leak from one run into the next even though pyodide.setStdin()/setStdout()
// are reassigned every time:
//  - sys.stdin is a persistent CPython BufferedReader object, never recreated
//    between runs. It reads ahead eagerly, so a run whose code doesn't
//    consume every byte it was given (e.g. stdin's last line has no trailing
//    "\n") leaves the remainder cached inside sys.stdin itself, invisible to
//    setStdin()'s JS-side reset — the next run's first input() drains that
//    stale leftover before ever seeing its own Ninput.txt.
//  - runPythonAsync(code) with no explicit globals dict executes into
//    pyodide.globals, the same dict every call, so a previous run's variables
//    /functions/imports are still there for the next run to see (or rely on).
// Everything this needs (the "sys" alias, the loop variable) is local to
// __apcs_reset_env itself, and the function's own name gets swept up by its
// own cleanup loop along with everything else non-dunder — so nothing new is
// left behind in globals for the next run to trip over.
const RESET_CODE = `def __apcs_reset_env():
    import sys
    sys.stdin = open(0, "r", closefd=False)
    g = globals()
    for k in [k for k in g if not (k.startswith("__") and k.endswith("__"))]:
        del g[k]
__apcs_reset_env()
`;

// Caps total captured output so a runaway `print()` loop (finishes fast,
// never trips the timeout) can't balloon postMessage payloads / the DOM.
const MAX_OUTPUT_CHARS = 200000;

function makeCappedSink(maxChars) {
  const chunks = [];
  let length = 0;
  let truncated = false;
  return {
    push(s) {
      if (truncated) return;
      const sep = chunks.length ? 1 : 0; // accounts for the "\n" chunks.join("\n") will insert
      const room = maxChars - length - sep;
      if (room <= 0) {
        truncated = true;
        return;
      }
      if (s.length > room) {
        chunks.push(s.slice(0, room));
        truncated = true;
        return;
      }
      chunks.push(s);
      length += sep + s.length;
    },
    get truncated() {
      return truncated;
    },
    toString() {
      return chunks.join("\n");
    },
  };
}

self.onmessage = async (event) => {
  const { id, code, stdin } = event.data;
  const pyodide = await pyodideReadyPromise;

  const stdoutChunks = makeCappedSink(MAX_OUTPUT_CHARS);
  const stderrChunks = makeCappedSink(MAX_OUTPUT_CHARS);

  // Feed the whole stdin blob as a single chunk (autoEOF:false) so input(),
  // sys.stdin.read()/readlines() and `for line in sys.stdin` all behave the
  // same as `python code.py < stdin.txt`, instead of EOF-ing after one line.
  let stdinConsumed = false;
  pyodide.setStdin({
    stdin: () => {
      if (!stdinConsumed) {
        stdinConsumed = true;
        return stdin;
      }
      return undefined;
    },
    autoEOF: false,
  });

  pyodide.setStdout({ batched: (s) => stdoutChunks.push(s) });
  pyodide.setStderr({ batched: (s) => stderrChunks.push(s) });

  function flushStreams() {
    try {
      pyodide.runPython(FLUSH_CODE);
    } catch {
      // best-effort flush; ignore failures (e.g. if the program replaced sys.stdout)
    }
  }

  try {
    // Reset sys.stdin and globals() *inside* the try: a program that already
    // corrupted __builtins__ or similar should still surface as this run's
    // own error, not silently skip straight to running old/broken state.
    pyodide.runPython(RESET_CODE);
    await pyodide.runPythonAsync(code);
    flushStreams();
    self.postMessage({
      type: "result",
      id,
      ok: true,
      stdout: stdoutChunks.toString(),
      stderr: stderrChunks.toString(),
      stdoutTruncated: stdoutChunks.truncated,
      stderrTruncated: stderrChunks.truncated,
    });
  } catch (err) {
    flushStreams();
    self.postMessage({
      type: "result",
      id,
      ok: false,
      stdout: stdoutChunks.toString(),
      stderr: (stderrChunks.toString() + "\n" + String(err)).trim(),
      stdoutTruncated: stdoutChunks.truncated,
      stderrTruncated: stderrChunks.truncated,
    });
  }
};
