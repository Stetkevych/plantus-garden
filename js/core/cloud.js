// cloud.js — accounts (Cognito), the PlantUs API, and syncing the garden save.
//
// Everything here is optional. If cloud-config.json is missing (opened from a
// plain static server, or the single-file build) the game runs exactly as
// before: local save, no camera scans, no herbarium.

import * as S from './state.js';

const SESSION_KEY = 'plantus.session.v1';
const OWNER_KEY = 'plantus.owner.v1';

let config = null;
let session = readSession();
const authListeners = new Set();
let syncStatus = 'idle';                  // idle | syncing | synced | error | offline
const syncListeners = new Set();

export const onAuth = (fn) => { authListeners.add(fn); return () => authListeners.delete(fn); };
export const onSync = (fn) => { syncListeners.add(fn); return () => syncListeners.delete(fn); };
const emitAuth = () => authListeners.forEach((f) => f(user()));
const setSync = (s) => { syncStatus = s; syncListeners.forEach((f) => f(s)); };

export const isConfigured = () => !!config;
export const user = () => (session ? { email: session.email, sub: session.sub } : null);
export const getSyncStatus = () => syncStatus;

/* ------------------------------------------------------------------ config */

export async function init() {
  try {
    const res = await fetch('cloud-config.json', { cache: 'no-cache' });
    if (res.ok) {
      const c = await res.json();
      if (c.apiUrl && c.clientId) config = c;
    }
  } catch { /* file:// or offline */ }
  if (!config) { setSync('offline'); return false; }
  emitAuth();          // views rendered before config arrived; let them redraw
  if (session) pull().catch(() => setSync('error'));
  return true;
}

/* ------------------------------------------------------------------ session */

function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch { return null; }
}
function writeSession(s) {
  session = s;
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* private mode: session lives for this tab only */ }
}

function decodeJwt(token) {
  const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(decodeURIComponent(escape(atob(part))));
}

function adoptTokens(auth, refreshToken) {
  const claims = decodeJwt(auth.IdToken);
  writeSession({
    idToken: auth.IdToken,
    refreshToken: auth.RefreshToken || refreshToken,
    exp: claims.exp * 1000,
    email: claims.email,
    sub: claims.sub,
  });
}

/* ------------------------------------------------------------------ cognito */

const FRIENDLY = {
  UsernameExistsException: 'There is already an account with that email. Try signing in.',
  UserNotFoundException: 'Email or password is wrong.',
  NotAuthorizedException: 'Email or password is wrong.',
  UserNotConfirmedException: 'Check your email for the verification code first.',
  CodeMismatchException: 'That code does not match. Check the latest email.',
  ExpiredCodeException: 'That code has expired. Send a new one.',
  InvalidPasswordException: 'Use at least 8 characters, including a number.',
  LimitExceededException: 'Too many tries. Wait a few minutes and try again.',
  TooManyRequestsException: 'Too many tries. Wait a few minutes and try again.',
  InvalidParameterException: 'Check the email and password and try again.',
};

async function cognito(action, body) {
  if (!config) throw new Error('Accounts are not available in this build.');
  const endpoint = config.cognitoEndpoint || `https://cognito-idp.${config.region}.amazonaws.com/`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-amz-json-1.1',
      'x-amz-target': `AWSCognitoIdentityProviderService.${action}`,
    },
    body: JSON.stringify({ ClientId: config.clientId, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const type = String(data.__type || '').split('#').pop();
    const err = new Error(FRIENDLY[type] || data.message || 'Something went wrong. Try again.');
    err.code = type;
    throw err;
  }
  return data;
}

export async function signUp(email, password) {
  await cognito('SignUp', {
    Username: email.trim().toLowerCase(),
    Password: password,
    UserAttributes: [{ Name: 'email', Value: email.trim().toLowerCase() }],
  });
}

export const confirmSignUp = (email, code) =>
  cognito('ConfirmSignUp', { Username: email.trim().toLowerCase(), ConfirmationCode: code.trim() });

export const resendCode = (email) =>
  cognito('ResendConfirmationCode', { Username: email.trim().toLowerCase() });

export const forgotPassword = (email) =>
  cognito('ForgotPassword', { Username: email.trim().toLowerCase() });

export const confirmForgotPassword = (email, code, password) =>
  cognito('ConfirmForgotPassword', { Username: email.trim().toLowerCase(), ConfirmationCode: code.trim(), Password: password });

export async function signIn(email, password) {
  const data = await cognito('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: { USERNAME: email.trim().toLowerCase(), PASSWORD: password },
  });
  if (!data.AuthenticationResult) throw new Error('Extra sign-in steps are not supported yet.');
  adoptTokens(data.AuthenticationResult);
  emitAuth();
  await pull();
}

export function signOut() {
  // Pushing first means nothing played since the last sync is lost.
  const last = session;
  if (last) pushNow(true);
  writeSession(null);
  try { localStorage.removeItem(OWNER_KEY); } catch { /* ignore */ }
  // Start the next person on this device with a fresh garden rather than the
  // signed-out account's progress.
  suppressPush = true;
  S.reset();
  suppressPush = false;
  setSync('idle');
  emitAuth();
}

async function refresh() {
  if (!session?.refreshToken) throw new Error('signed out');
  const data = await cognito('InitiateAuth', {
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    AuthParameters: { REFRESH_TOKEN: session.refreshToken },
  });
  adoptTokens(data.AuthenticationResult, session.refreshToken);
}

async function idToken() {
  if (!session) throw Object.assign(new Error('Sign in first.'), { status: 401 });
  if (Date.now() > session.exp - 60000) {
    try { await refresh(); } catch {
      writeSession(null); emitAuth();
      throw Object.assign(new Error('Your session expired. Sign in again.'), { status: 401 });
    }
  }
  return session.idToken;
}

/* ------------------------------------------------------------------ api */

export async function api(method, path, body, { keepalive = false } = {}) {
  if (!config) throw new Error('The PlantUs cloud is not configured for this build.');
  const res = await fetch(config.apiUrl.replace(/\/$/, '') + path, {
    method,
    keepalive,
    headers: {
      authorization: await idToken(),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.message || `Request failed (${res.status}).`);
    err.status = res.status;
    err.data = data;
    if (res.status === 401) { writeSession(null); emitAuth(); }
    throw err;
  }
  return data;
}

export const identify = (image, extra = {}) => api('POST', '/identify', { image, ...extra });
export const listFinds = () => api('GET', '/finds');
export const deleteFind = (id) => api('DELETE', `/finds/${id}`);

/* ------------------------------------------------------------------ save sync */

let pushTimer = null;
let suppressPush = false;
let lastPushed = 0;                      // updatedAt of the last save the server has

/**
 * On sign-in: decide whose garden wins. If this device last synced this same
 * account, the newer save wins. Otherwise (guest progress, or a new device)
 * the save that has come further wins, so nobody loses a real garden to an
 * empty one.
 */
async function pull() {
  if (!session) return;
  setSync('syncing');
  const remote = await api('GET', '/save');
  const local = S.state;
  let owner = null;
  try { owner = localStorage.getItem(OWNER_KEY); } catch { /* ignore */ }

  let useRemote = false;
  if (remote.state) {
    if (owner === session.sub) useRemote = (remote.updatedAt || 0) > (local.updatedAt || 0);
    else useRemote = S.progressOf(remote.state) >= S.progressOf(local);
  }

  try { localStorage.setItem(OWNER_KEY, session.sub); } catch { /* ignore */ }
  if (useRemote) {
    suppressPush = true;
    S.replaceState({ ...remote.state, updatedAt: remote.updatedAt });
    suppressPush = false;
    lastPushed = remote.updatedAt;
    setSync('synced');
  } else {
    await pushNow();
  }
}

async function pushNow(keepalive = false) {
  if (!session || !config) return;
  clearTimeout(pushTimer);
  try {
    setSync('syncing');
    const at = S.state.updatedAt;
    await api('PUT', '/save', { state: S.state, updatedAt: at }, { keepalive });
    lastPushed = at;
    setSync('synced');
  } catch {
    setSync('error');
  }
}

S.onChange(() => {
  if (suppressPush || !session || !config) return;
  // Moisture ticking over is derived state; only real changes bump updatedAt.
  if (S.state.updatedAt === lastPushed) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, 1500);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && pushTimer) pushNow(true);
});
