export const AUTH_KEY = "dtc_auth_v2";

export function getStoredSession() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getStoredToken() {
  return getStoredSession()?.token || null;
}

export function getStoredUser() {
  return getStoredSession()?.user || null;
}

export function setStoredSession(session) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  localStorage.removeItem(AUTH_KEY);
}

export function emitAuthChanged() {
  window.dispatchEvent(new Event("dtc-auth-changed"));
}
