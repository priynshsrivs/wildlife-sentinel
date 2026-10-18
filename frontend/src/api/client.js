// Local development uses the same-origin Vite proxy. Production can override
// VITE_API_BASE; role credentials never belong in the Vite environment.
const defaultApiBase = import.meta.env?.DEV
  ? `${window.location.origin}/api`
  : "http://127.0.0.1:8000/api";
const backend = new URL(
  import.meta.env?.VITE_API_BASE || defaultApiBase,
  globalThis.window?.location?.href || "http://127.0.0.1:5173",
);
backend.pathname = backend.pathname.replace(/\/$/, "");
export const API_BASE = backend.href.replace(/\/$/, "");
export const HEALTH_URL = new URL("/health", backend).href;
export const WS_URL = new URL("/ws/alerts", backend);
WS_URL.protocol = backend.protocol === "https:" ? "wss:" : "ws:";
let token = "";
let session = new AbortController();
const sockets = new Set();
export function setToken(value) {
  session.abort();
  session = new AbortController();
  for (const socket of sockets) socket.close?.();
  sockets.clear();
  token = String(value || "").trim();
}
export async function responseError(response, fallback = "Request failed") {
  try {
    const body = await response.json();
    if (typeof body.detail === "string")
      return `${body.detail} (HTTP ${response.status})`;
  } catch {
    /* A non-JSON failure still reports its actual HTTP status. */
  }
  return `${fallback} (HTTP ${response.status})`;
}
export async function apiFetch(url, options = {}) {
  const target = new URL(url, window.location.href);
  const headers = new Headers(options.headers);
  const isApi =
    target.origin === backend.origin &&
    target.pathname.startsWith(backend.pathname + "/");
  if (isApi) headers.set("Authorization", `Bearer ${token}`);
  const timeoutMs =
    options.timeoutMs ??
    ((options.method || "GET").toUpperCase() === "GET" ? 10000 : 180000);
  const { timeoutMs: _timeoutMs, ...fetchOptions } = options;
  void _timeoutMs;
  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    signal: AbortSignal.any(
      [session.signal, AbortSignal.timeout(timeoutMs), options.signal].filter(
        Boolean,
      ),
    ),
  });
  if (isApi && response.status === 401 && token) {
    setToken("");
    window.dispatchEvent?.(new Event("sentinel-session-expired"));
  }
  return response;
}
export async function openAlertSocket() {
  const response = await apiFetch(`${API_BASE}/auth/ws-ticket`, {
    method: "POST",
    timeoutMs: 10000,
  });
  if (!response.ok) throw new Error("Alert stream authentication failed");
  const { ticket } = await response.json();
  if (typeof ticket !== "string" || !ticket)
    throw new Error("Invalid alert stream ticket");
  const url = new URL(WS_URL);
  url.searchParams.set("ticket", ticket);
  const socket = new WebSocket(url);
  sockets.add(socket);
  socket.addEventListener?.("close", () => sockets.delete(socket), {
    once: true,
  });
  return socket;
}
