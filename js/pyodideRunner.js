let worker = null;
let idCounter = 0;
const pending = new Map();
let onReadyCallback = null;

function spawnWorker() {
  worker = new Worker("js/pyodide-worker.js");
  worker.onmessage = (event) => {
    const data = event.data;
    if (data.type === "ready") {
      if (onReadyCallback) onReadyCallback();
      return;
    }
    if (data.type === "result") {
      const entry = pending.get(data.id);
      if (entry) {
        pending.delete(data.id);
        clearTimeout(entry.timer);
        entry.resolve(data);
      }
    }
  };
  worker.onerror = (event) => {
    for (const [, entry] of pending) {
      clearTimeout(entry.timer);
      entry.resolve({ ok: false, stdout: "", stderr: "執行環境發生錯誤：" + event.message });
    }
    pending.clear();
  };
}

export function initPyodideRunner(onReady) {
  onReadyCallback = onReady;
  spawnWorker();
}

export function runPython(code, stdin, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const id = ++idCounter;
    const timer = setTimeout(() => {
      pending.delete(id);
      worker.terminate();
      spawnWorker();
      if (onReadyCallback) {
        // worker needs to re-load pyodide; caller's status indicator can listen again
      }
      resolve({
        ok: false,
        timeout: true,
        stdout: "",
        stderr: "執行逾時(可能是無窮迴圈)，已重新啟動執行環境，請再試一次。",
      });
    }, timeoutMs);
    pending.set(id, { resolve, timer });
    worker.postMessage({ id, code, stdin });
  });
}
