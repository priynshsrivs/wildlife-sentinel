import test from "node:test";
import assert from "node:assert/strict";
import {
  apiFetch,
  API_BASE,
  setToken,
  openAlertSocket,
} from "../src/api/client.js";
import { mergeAlert } from "../src/utils/alerts.js";

test("credentials go only to configured API", async () => {
  globalThis.window = { location: { href: "http://127.0.0.1:5173" } };
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true };
  };
  setToken("test-secret");
  await apiFetch(`${API_BASE}/alerts`);
  await apiFetch("https://other.example/api/alerts");
  await apiFetch("data:image/jpeg;base64,AA");
  assert.equal(
    calls[0].options.headers.get("Authorization"),
    "Bearer test-secret",
  );
  assert.equal(calls[1].options.headers.has("Authorization"), false);
  assert.equal(calls[2].options.headers.has("Authorization"), false);
});
test("failed responses are not turned into successes", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 403 });
  assert.equal((await apiFetch(`${API_BASE}/settings`)).ok, false);
  await assert.rejects(openAlertSocket(), /authentication failed/);
});
test("websocket uses one-use ticket, never role credential in URL", async () => {
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ ticket: "one-use-ticket" }),
  });
  globalThis.WebSocket = class {
    constructor(url) {
      this.url = String(url);
    }
  };
  const socket = await openAlertSocket();
  assert.match(socket.url, /ticket=one-use-ticket/);
  assert.ok(!socket.url.includes("test-secret"));
});
test("alert update deduplicates and bounds memory", () => {
  const old = { id: "a", timestamp: "2026-01-01T00:00:00Z", resolved: false };
  const next = { ...old, resolved: true };
  assert.deepEqual(mergeAlert([old], next), [next]);
  const newer = { id: "b", timestamp: "2026-01-02T00:00:00Z" };
  assert.deepEqual(mergeAlert([old], newer, 1), [newer]);
});

test("sign-out aborts pending requests and closes authenticated sockets", async () => {
  globalThis.window = { location: { href: "http://127.0.0.1:5173" } };
  setToken("test-session");
  let closed = false;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ ticket: "test-ticket" }),
  });
  globalThis.WebSocket = class {
    close() {
      closed = true;
    }
  };
  await openAlertSocket();
  globalThis.fetch = (_url, options) =>
    new Promise((_resolve, reject) => {
      options.signal.addEventListener(
        "abort",
        () => reject(options.signal.reason),
        { once: true },
      );
    });
  const request = apiFetch(`${API_BASE}/alerts`);
  setToken("");
  await assert.rejects(request, (error) => error.name === "AbortError");
  assert.equal(closed, true);
});

test("expired credentials trigger session reset instead of endless retry", async () => {
  let expired = false;
  globalThis.window = {
    location: { href: "http://127.0.0.1:5173" },
    dispatchEvent: () => {
      expired = true;
    },
  };
  setToken("expired-session");
  globalThis.fetch = async () => ({ ok: false, status: 401 });
  assert.equal((await apiFetch(`${API_BASE}/alerts`)).status, 401);
  assert.equal(expired, true);
});

test("malformed realtime events cannot crash alert sorting", () => {
  const old = [{ id: "a", timestamp: "2026-01-01T00:00:00Z" }];
  assert.equal(mergeAlert(old, null), old);
  assert.equal(mergeAlert(old, []), old);
  assert.deepEqual(
    mergeAlert(old, { id: "b" }).map((alert) => alert.id),
    ["a", "b"],
  );
  const updated = {
    id: "a",
    timestamp: "2026-01-01T00:00:00Z",
    last_seen: "2026-01-03T00:00:00Z",
  };
  assert.equal(
    mergeAlert([{ id: "b", timestamp: "2026-01-02T00:00:00Z" }], updated)[0].id,
    "a",
  );
});
