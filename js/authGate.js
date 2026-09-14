const UNLOCK_KEY = "apcs_tutor_unlocked_v1";

// sha256("kk34") — a fixed, throwaway password so `python -m http.server`
// on localhost unlocks out of the box with no setup. Only ever used as a
// fallback on localhost (see below); the real deployed site always requires
// js/auth-config.js and never falls back to this.
const LOCAL_DEV_PASSWORD_HASH = "977857c6549e3da2c96e93a8407f6a90b9107066077f7067082c368499434dda";
const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// js/auth-config.js is generated at deploy time from a GitHub Actions secret
// (see .github/workflows/deploy.yml) and is gitignored — if it's ever missing
// on the deployed site (e.g. a deploy step was skipped) we fail CLOSED:
// PASSWORD_HASH stays null, which no real SHA-256 hash can ever equal, so the
// gate just never unlocks instead of crashing the page or accidentally
// letting everyone in. On localhost only, missing auth-config.js instead
// falls back to the fixed dev password above, so local testing needs no setup.
let PASSWORD_HASH = null;
try {
  ({ PASSWORD_HASH } = await import("./auth-config.js"));
} catch {
  if (LOCAL_DEV_HOSTS.has(location.hostname)) {
    PASSWORD_HASH = LOCAL_DEV_PASSWORD_HASH;
    console.warn("auth-config.js missing — using local dev default password (kk34).");
  } else {
    console.warn("auth-config.js missing — access gate will not unlock.");
  }
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isUnlocked() {
  return localStorage.getItem(UNLOCK_KEY) === "1";
}

/**
 * Runs `onUnlock` once the visitor is past the password gate — immediately
 * if already unlocked this browser, otherwise after they enter the right
 * password. Nothing else on the page (course data, exercises) is fetched
 * until this fires.
 */
export function requireUnlock(onUnlock) {
  if (isUnlocked()) {
    onUnlock();
    return;
  }
  renderGate(onUnlock);
}

function renderGate(onUnlock) {
  const overlay = document.createElement("div");
  overlay.className = "auth-gate";
  overlay.innerHTML = `
    <div class="auth-gate__box">
      <h2>請輸入密碼</h2>
      <input type="password" id="authGateInput" class="auth-gate__input" autocomplete="off" autofocus />
      <button type="button" id="authGateSubmit" class="btn btn--primary">進入</button>
      <p id="authGateError" class="auth-gate__error" hidden>密碼錯誤，請再試一次。</p>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = overlay.querySelector("#authGateInput");
  const submitBtn = overlay.querySelector("#authGateSubmit");
  const errorEl = overlay.querySelector("#authGateError");

  async function trySubmit() {
    if (!input.value) return;
    submitBtn.disabled = true;
    const hash = await sha256Hex(input.value);
    if (PASSWORD_HASH && hash === PASSWORD_HASH) {
      localStorage.setItem(UNLOCK_KEY, "1");
      overlay.remove();
      onUnlock();
      return;
    }
    errorEl.hidden = false;
    input.value = "";
    input.focus();
    submitBtn.disabled = false;
  }

  submitBtn.addEventListener("click", trySubmit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") trySubmit();
  });
  input.focus();
}
