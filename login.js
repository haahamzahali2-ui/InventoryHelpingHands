// ─────────────────────────────────────────────────────────────
//  HELPING HANDS — Microsoft Authentication (MSAL.js v2)
//  login.js
//
//  SETUP: Replace CLIENT_ID with your Azure App Registration's
//  "Application (client) ID". That's the only thing you need.
// ─────────────────────────────────────────────────────────────

const MSAL_CONFIG = {
  CLIENT_ID:    "651a15cc-51f3-4b6d-9c59-d650aadc37be",
  TENANT_ID:    "common",
 REDIRECT_URI: "https://haahamzahali2-ui.github.io/InventoryHelpingHands/login.html",
};

// ── MSAL setup ────────────────────────────────────────────────
const msalInstance = new msal.PublicClientApplication({
  auth: {
    clientId:    MSAL_CONFIG.CLIENT_ID,
    authority:   `https://login.microsoftonline.com/${MSAL_CONFIG.TENANT_ID}`,
    redirectUri: MSAL_CONFIG.REDIRECT_URI,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
});

const loginRequest = {
  scopes: ["openid", "profile", "email"],
};

// ── Init: must call initialize() before anything else ─────────
async function init() {
  await msalInstance.initialize();

  try {
    const response = await msalInstance.handleRedirectPromise();

    if (response && response.account) {
      // Returning from Microsoft login redirect
      storeUserAndRedirect(response.account);
      return;
    }

    // Already signed in from a previous session?
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      storeUserAndRedirect(accounts[0]);
    }

  } catch (err) {
    showError(err.message || "Authentication error. Please try again.");
    console.error("MSAL init error:", err);
  }
}

init();

// ── Sign-in button ─────────────────────────────────────────────
async function signIn() {
  const btn     = document.getElementById("signInBtn");
  const btnText = document.getElementById("signInBtnText");
  const spinner = document.getElementById("signInSpinner");

  btn.disabled          = true;
  btnText.textContent   = "Redirecting…";
  spinner.style.display = "block";
  hideError();

  try {
    await msalInstance.loginRedirect(loginRequest);
  } catch (err) {
    showError(err.message || "Sign-in failed. Please try again.");
    btn.disabled          = false;
    btnText.textContent   = "Sign in with Microsoft";
    spinner.style.display = "none";
    console.error("MSAL loginRedirect error:", err);
  }
}

// ── Store session and redirect to portal ──────────────────────
function storeUserAndRedirect(account) {
  localStorage.setItem("clinic_user", JSON.stringify({
    name:    account.name || account.username,
    email:   account.username,
    loginAt: new Date().toISOString(),
  }));
  window.location.href = "index.html";
}

// ── UI helpers ────────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById("loginError");
  el.textContent   = msg;
  el.style.display = "block";
}
function hideError() {
  document.getElementById("loginError").style.display = "none";
}
