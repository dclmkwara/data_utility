/** Church_server-backed session handling with offline identity continuity. */
(function () {
  const LOGIN_PATH = "/login";
  let refreshPromise = null;
  let currentUser = null;
  let resolveReady;
  window.DCLM_AUTH_READY = new Promise((resolve) => { resolveReady = resolve; });

  async function request(path, options = {}) {
    return fetch(path, { credentials: "same-origin", ...options });
  }

  function userErrorMessage(value) {
    let message = String(value || "Unable to complete this request. Please try again.");
    try {
      if (/^\s*[\[{]/.test(message)) {
        const payload = JSON.parse(message);
        message = payload.detail || payload.message || payload.msg || payload.error || "Unable to complete this request. Please try again.";
        if (typeof message !== "string") message = message.msg || message.message || "Unable to complete this request. Please try again.";
      }
    } catch (_) {
      message = "Unable to complete this request. Please try again.";
    }
    return String(message).replace(/Church_server/gi, "church records service")
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "record ID")
      .slice(0, 320);
  }

  async function apiFetch(path, options = {}, retry = true) {
    let response = await request(path, options);
    if (response.status === 401 && retry && path !== "/api/auth/refresh") {
      refreshPromise ||= request("/api/auth/refresh", { method: "POST" }).finally(() => { refreshPromise = null; });
      const refreshed = await refreshPromise;
      if (refreshed.ok) response = await request(path, options);
    }
    return response;
  }

  async function saveOfflineUser(user) {
    currentUser = user;
    window.DCLM_CURRENT_USER = user;
    const accountLabel = document.querySelector("#auth-user-name");
    if (accountLabel) {
      accountLabel.textContent = user?.name || "";
      accountLabel.title = user?.roles?.length ? `${user.name} · ${user.roles.join(", ")}` : (user?.name || "Signed-in field account");
    }
    try { await window.DCLM_DB?.saveAuthState(user); } catch (error) { console.warn("Could not cache field identity", error); }
  }

  async function login(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("#login-submit");
    const errorBox = form.querySelector("#login-error");
    const email = form.querySelector("#login-email").value.trim();
    const password = form.querySelector("#login-password").value;
    button.disabled = true;
    button.textContent = "Signing in…";
    errorBox.classList.add("d-none");
    try {
      const response = await request("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email, password }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Sign in failed.");
      await saveOfflineUser(result.user);
      window.location.replace("/");
    } catch (error) {
      errorBox.textContent = userErrorMessage(error.message || "Unable to sign in. Check your connection and try again.");
      errorBox.classList.remove("d-none");
      button.disabled = false;
      button.textContent = "Sign in";
    }
  }

  async function logout() {
    try { await window.DCLM_DB?.markSignedOut(); } catch (_) { /* Continue to the sign-in screen even if local storage fails. */ }
    try { await request("/api/auth/logout", { method: "POST" }); } catch (_) { /* Local logout must work offline. */ }
    currentUser = null;
    window.DCLM_CURRENT_USER = null;
    const accountLabel = document.querySelector("#auth-user-name");
    if (accountLabel) accountLabel.textContent = "";
    window.location.replace(LOGIN_PATH);
  }

  async function initialize() {
    const loginForm = document.querySelector("#login-form");
    const locallySignedOut = await window.DCLM_DB?.isSignedOut();
    if (loginForm) {
      document.body.dataset.authState = "ready";
      resolveReady(null);
      loginForm.addEventListener("submit", login);
      try {
        const state = await request("/api/auth/state");
        const data = await state.json();
        if (data.authenticated && !locallySignedOut) window.location.replace("/");
      } catch (_) { /* Login still renders; submission will explain connectivity. */ }
      return;
    }

    if (locallySignedOut) {
      window.location.replace(LOGIN_PATH);
      resolveReady(null);
      return;
    }

    let user = null;
    try {
      const response = await request("/api/auth/state");
      if (response.ok) {
        const state = await response.json();
        if (state.authenticated) user = state.user;
        else if (location.pathname !== LOGIN_PATH) { window.location.replace(LOGIN_PATH); return; }
      }
    } catch (_) {
      // Offline startup can use only the profile from a previous authorized session.
      user = await window.DCLM_DB?.getAuthState();
      if (!user) {
        document.body.textContent = "Connect to the internet and sign in once to enable offline access.";
        resolveReady(null);
        return;
      }
    }
    if (user) await saveOfflineUser(user);
    document.body.dataset.authState = "ready";
    document.querySelector("#btn-sign-out")?.addEventListener("click", (event) => {
      event.preventDefault();
      logout();
    });
    resolveReady(user);
  }

  window.DCLM_AUTH = { apiFetch, logout, get user() { return currentUser; } };
  document.addEventListener("DOMContentLoaded", initialize, { once: true });
})();
