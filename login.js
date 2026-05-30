// ─────────────────────────────────────────────────────────────
//  HELPING HANDS — Microsoft Authentication (MSAL.js v2)
//  login.js
//
//  SETUP:
//   1. Replace CLIENT_ID with your Azure App Registration's
//      "Application (client) ID"
//   2. Replace TENANT_ID with your "Directory (tenant) ID"
//      OR use "common" to allow any Microsoft account
//   3. REDIRECT_URI must exactly match what you registered
//      in Azure under Authentication → Redirect URIs
// ─────────────────────────────────────────────────────────────

const MSAL_CONFIG = {
  CLIENT_ID:   "651a15cc-51f3-4b6d-9c59-d650aadc37be",           // e.g. "a1b2c3d4-..."
  TENANT_ID:   "common",                        // or your tenant ID / "organizations"
  REDIRECT_URI: window.location.origin + "/",   // auto-detects localhost vs GitHub Pages
};

// ── MSAL instance ─────────────────────────────────────────────
const msalConfig = {
  auth: {
    clientId:    MSAL_CONFIG.CLIENT_ID,
    authority:   `https://login.microsoftonline.com/${MSAL_CONFIG.TENANT_ID}`,
    redirectUri: MSAL_CONFIG.REDIRECT_URI,
  },
  cache: {
    cacheLocation: "sessionStorage",   // sessionStorage = cleared on tab close
    storeAuthStateInCookie: false,
  },
};

const msalInstance = new msal.PublicClientApplication(msalConfig);

// Scopes — openid/profile/email is enough; add more if you need
// e.g. "User.Read" to fetch profile photo from Microsoft Graph
const loginRequest = {
  scopes: ["openid", "profile", "email"],
};

// ── Handle redirect response on page load ─────────────────────
(async () => {
  try {
    const response = await msalInstance.handleRedirectPromise();

    if (response && response.account) {
      // User just completed sign-in redirect
      storeUserAndRedirect(response.account);
      return;
    }

    // Check if already signed in (cached session)
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      storeUserAndRedirect(accounts[0]);
    }

  } catch (err) {
    showError(err.message || "Authentication error. Please try again.");
    console.error("MSAL handleRedirectPromise error:", err);
  }
})();

// ── Sign-in button handler ─────────────────────────────────────
async function signIn() {
  const btn     = document.getElementById("signInBtn");
  const btnText = document.getElementById("signInBtnText");
  const spinner = document.getElementById("signInSpinner");

  btn.disabled       = true;
  btnText.textContent = "Redirecting…";
  spinner.style.display = "block";
  hideError();

  try {
    // Redirect flow works best for SPA on GitHub Pages
    await msalInstance.loginRedirect(loginRequest);
    // Page navigates away — code below won't run until redirect returns
  } catch (err) {
    showError(err.message || "Sign-in failed. Please try again.");
    btn.disabled          = false;
    btnText.textContent   = "Sign in with Microsoft";
    spinner.style.display = "none";
    console.error("MSAL loginRedirect error:", err);
  }
}

// ── Store session and go to portal ────────────────────────────
function storeUserAndRedirect(account) {
  // Minimal user info stored — no tokens, no sensitive data
  const user = {
    name:     account.name || account.username,
    email:    account.username,
    tenantId: account.tenantId,
    loginAt:  new Date().toISOString(),
  };
  localStorage.setItem("clinic_user", JSON.stringify(user));
  window.location.href = "index.html";
}

// ── UI helpers ────────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById("loginError");
  el.textContent  = msg;
  el.style.display = "block";
}
function hideError() {
  document.getElementById("loginError").style.display = "none";
}
