(() => {
  const CODE_PREFIX = "BSE1.";
  const LAST_LOGIN_CODE_KEY = "battleSE_last_login_code";

  const state = {
    ready: false,
    buildSnapshot: null,
    buildDefaultSnapshot: null,
    applySnapshot: null,
    onAuthenticated: null,
    currentCode: "",
  };

  function textToBase64Url(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  function base64UrlToText(base64url) {
    let base64 = String(base64url).replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) base64 += "=";

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }

  function encodeSnapshot(snapshot) {
    const json = JSON.stringify(snapshot);
    return CODE_PREFIX + textToBase64Url(json);
  }

  function decodeSnapshot(code) {
    const raw = String(code || "").trim();
    if (!raw) throw new Error("账号代码为空");

    const payload = raw.startsWith(CODE_PREFIX)
      ? raw.slice(CODE_PREFIX.length)
      : raw;

    const json = base64UrlToText(payload);
    const data = JSON.parse(json);

    if (!data || typeof data !== "object") {
      throw new Error("账号代码格式错误");
    }

    return data;
  }

  function el(id) {
    return document.getElementById(id);
  }

  function setDisplay(id, value) {
    const node = el(id);
    if (node) node.style.display = value;
  }

  function hideAuthPanels() {
    setDisplay("loginOverlay", "none");
    setDisplay("newAccountOverlay", "none");
    setDisplay("accountCodeOverlay", "none");
  }

  function showLogin() {
    hideAuthPanels();

    const loginOverlay = el("loginOverlay");
    if (loginOverlay) loginOverlay.style.display = "flex";

    const codeInput = el("loginCodeInput");
    const saved = localStorage.getItem(LAST_LOGIN_CODE_KEY);
    if (codeInput && saved) {
      codeInput.value = saved;
    }

    const errorBox = el("loginErrorText");
    if (errorBox) errorBox.textContent = "";

    if (codeInput) {
      setTimeout(() => codeInput.focus(), 0);
    }
  }

  function showCreateInfo() {
    hideAuthPanels();
    const overlay = el("newAccountOverlay");
    if (overlay) overlay.style.display = "flex";
  }

  function openAccountCodeModal(code) {
    hideAuthPanels();

    const overlay = el("accountCodeOverlay");
    const text = el("accountCodeText");
    const errorBox = el("loginErrorText");

    if (errorBox) errorBox.textContent = "";
    if (text) text.value = code || "";
    if (overlay) overlay.style.display = "flex";

    state.currentCode = code || "";
    localStorage.setItem(LAST_LOGIN_CODE_KEY, state.currentCode);

    if (text) {
      setTimeout(() => {
        text.focus();
        text.select();
      }, 0);
    } else if (code) {
      alert(code);
    }
  }

  async function copyCodeToClipboard(code) {
    const text = String(code || "");
    if (!text) return false;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {
    }

    try {
      const temp = document.createElement("textarea");
      temp.value = text;
      temp.style.position = "fixed";
      temp.style.left = "-9999px";
      temp.style.top = "-9999px";
      document.body.appendChild(temp);
      temp.select();
      document.execCommand("copy");
      document.body.removeChild(temp);
      return true;
    } catch (e) {
      return false;
    }
  }

  function bindDangerSaveButton() {
    const dangerLobbyContent = el("dangerLobbyContent");
    if (!dangerLobbyContent) return;
    if (el("dangerSaveBtn")) return;

    const btn = document.createElement("button");
    btn.id = "dangerSaveBtn";
    btn.type = "button";
    btn.textContent = "保存游戏";
    btn.addEventListener("click", () => {
      const code = exportCurrentCode();
      openAccountCodeModal(code);
    });

    dangerLobbyContent.appendChild(btn);
  }

  function bindLoginUI() {
    const loginEnterBtn = el("loginEnterBtn");
    const loginCreateBtn = el("loginCreateBtn");
    const loginCodeInput = el("loginCodeInput");
    const newAccountBackBtn = el("newAccountBackBtn");
    const newAccountConfirmBtn = el("newAccountConfirmBtn");
    const copyAccountCodeBtn = el("copyAccountCodeBtn");
    const closeAccountCodeBtn = el("closeAccountCodeBtn");

    if (loginEnterBtn) {
      loginEnterBtn.addEventListener("click", () => {
        loginFromInput();
      });
    }

    if (loginCreateBtn) {
      loginCreateBtn.addEventListener("click", () => {
        showCreateInfo();
      });
    }

    if (newAccountBackBtn) {
      newAccountBackBtn.addEventListener("click", () => {
        showLogin();
      });
    }

    if (newAccountConfirmBtn) {
      newAccountConfirmBtn.addEventListener("click", () => {
        createNewAccount();
      });
    }

    if (copyAccountCodeBtn) {
      copyAccountCodeBtn.addEventListener("click", async () => {
        const code = el("accountCodeText")?.value || state.currentCode || "";
        const ok = await copyCodeToClipboard(code);
        if (!ok) {
          alert("复制失败，请手动全选复制。");
        } else {
          alert("已复制账号代码。");
        }
      });
    }

    if (closeAccountCodeBtn) {
      closeAccountCodeBtn.addEventListener("click", () => {
        hideAuthPanels();
        showLogin();
      });
    }

    if (loginCodeInput) {
      loginCodeInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          loginFromInput();
        }
      });
    }
  }

  function loginFromInput() {
    const input = el("loginCodeInput");
    const errorBox = el("loginErrorText");
    const raw = input ? input.value.trim() : "";

    if (errorBox) errorBox.textContent = "";

    if (!raw) {
      if (errorBox) errorBox.textContent = "请先输入账号代码。";
      return;
    }

    try {
      const snapshot = decodeSnapshot(raw);

      if (typeof state.applySnapshot === "function") {
        const ok = state.applySnapshot(snapshot);
        if (ok === false) {
          throw new Error("账号代码无法应用。");
        }
      }

      state.currentCode = raw;
      localStorage.setItem(LAST_LOGIN_CODE_KEY, raw);

      hideAuthPanels();

      if (typeof state.onAuthenticated === "function") {
        state.onAuthenticated(snapshot);
      }
    } catch (err) {
      if (errorBox) {
        errorBox.textContent = "账号代码无效，请检查后再试。";
      }
      console.error(err);
    }
  }

  function buildFallbackSnapshot() {
    return {
      version: 1,
      accountId: state.currentCode || `acc_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      accountName: "危险地带账号",
      updatedAt: Date.now(),
      settings: {
        mobileModeEnabled: false
      },
      warehouse: null
    };
  }

  function createNewAccount() {
    const snapshot = typeof state.buildDefaultSnapshot === "function"
      ? state.buildDefaultSnapshot()
      : buildFallbackSnapshot();

    if (typeof state.applySnapshot === "function") {
      state.applySnapshot(snapshot);
    }

    const code = encodeSnapshot(snapshot);
    state.currentCode = code;
    localStorage.setItem(LAST_LOGIN_CODE_KEY, code);

    hideAuthPanels();

    if (typeof state.onAuthenticated === "function") {
      state.onAuthenticated(snapshot);
    }
  }

  function exportCurrentCode() {
    try {
      let snapshot = null;

      if (typeof state.buildSnapshot === "function") {
        snapshot = state.buildSnapshot();
      }

      if (!snapshot) {
        snapshot = typeof state.buildDefaultSnapshot === "function"
          ? state.buildDefaultSnapshot()
          : buildFallbackSnapshot();
      }

      if (!snapshot.accountId) {
        snapshot.accountId = state.currentCode || `acc_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      }

      const code = encodeSnapshot(snapshot);
      state.currentCode = code;
      localStorage.setItem(LAST_LOGIN_CODE_KEY, code);
      return code;
    } catch (err) {
      console.error(err);

      const snapshot = typeof state.buildDefaultSnapshot === "function"
        ? state.buildDefaultSnapshot()
        : buildFallbackSnapshot();

      const code = encodeSnapshot(snapshot);
      state.currentCode = code;
      localStorage.setItem(LAST_LOGIN_CODE_KEY, code);
      return code;
    }
  }

  function init(options = {}) {
    if (state.ready) return;

    state.buildSnapshot = typeof options.buildSnapshot === "function" ? options.buildSnapshot : null;
    state.buildDefaultSnapshot = typeof options.buildDefaultSnapshot === "function" ? options.buildDefaultSnapshot : null;
    state.applySnapshot = typeof options.applySnapshot === "function" ? options.applySnapshot : null;
    state.onAuthenticated = typeof options.onAuthenticated === "function" ? options.onAuthenticated : null;

    bindLoginUI();
    bindDangerSaveButton();

    state.ready = true;
    showLogin();
  }

  window.SignSystem = {
    init,
    showLogin,
    showCreateInfo,
    openAccountCodeModal,
    exportCurrentCode,
    encodeSnapshot,
    decodeSnapshot,
  };
})();