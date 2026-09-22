export const API_BASE = (import.meta.env?.VITE_API_BASE || 'http://127.0.0.1:8000/api').replace(/\/$/, '');
const backend = new URL(API_BASE);
export const WS_URL = new URL('/ws/alerts', backend);
WS_URL.protocol = backend.protocol === 'https:' ? 'wss:' : 'ws:';
let token = '';
export function setToken(value) { token = value; }
export async function apiFetch(url, options = {}) {
  const target = new URL(url, window.location.href);
  const headers = new Headers(options.headers);
  if (target.origin === backend.origin && target.pathname.startsWith('/api/')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(url, { ...options, headers, signal: options.signal || AbortSignal.timeout(180000) });
  return response;
}
export async function openAlertSocket() {
  const response = await apiFetch(`${API_BASE}/auth/ws-ticket`, { method: 'POST' });
  if (!response.ok) throw new Error('Alert stream authentication failed');
  const { ticket } = await response.json();
  const url = new URL(WS_URL);
  url.searchParams.set('ticket', ticket);
  return new WebSocket(url);
}
