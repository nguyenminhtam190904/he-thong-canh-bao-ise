export const UNAUTHORIZED_EVENT = 'nguard:unauthorized';

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...options.headers },
  });
  const result = await response.json().catch(() => null);
  return { response, result };
}

export async function fetchCurrentUser() {
  const { response, result } = await request('/api/auth/me');
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(result?.error || `Could not check the session (${response.status}).`);
  return result.user;
}

export async function login(username, password) {
  const { response, result } = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error(result?.error || `Could not sign in (${response.status}).`);
  return result.user;
}

export async function logout() {
  await request('/api/auth/logout', { method: 'POST' });
}

export async function changePassword(currentPassword, newPassword) {
  const { response, result } = await request('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!response.ok) throw new Error(result?.error || `Could not change the password (${response.status}).`);
  return result;
}

// Called by other API helpers when the server answers 401 so the app returns to the login page.
export function notifyUnauthorized(response) {
  if (response.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}
