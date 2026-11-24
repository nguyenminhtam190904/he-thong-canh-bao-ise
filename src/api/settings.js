import { notifyUnauthorized } from '@/api/auth';

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...options.headers },
  });
  notifyUnauthorized(response);
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || `Request failed (${response.status}).`);
  return result;
}

export function fetchSettings() {
  return request('/api/settings');
}

export function updateSettings(values) {
  return request('/api/settings', { method: 'PUT', body: JSON.stringify(values) });
}

export function testIseConnection() {
  return request('/api/settings/test-ise', { method: 'POST' });
}
