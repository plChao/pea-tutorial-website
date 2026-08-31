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

self.onmessage = async (event) => {
  const { id, code, stdin } = event.data;
  const pyodide = await pyodideReadyPromise;

  const stdoutChunks = [];
  const stderrChunks = [];

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
    await pyodide.runPythonAsync(code);
    flushStreams();
    self.postMessage({
      type: "result",
      id,
      ok: true,
      stdout: stdoutChunks.join("\n"),
      stderr: stderrChunks.join("\n"),
    });
  } catch (err) {
    flushStreams();
    self.postMessage({
      type: "result",
      id,
      ok: false,
      stdout: stdoutChunks.join("\n"),
      stderr: (stderrChunks.join("\n") + "\n" + String(err)).trim(),
    });
  }
};
