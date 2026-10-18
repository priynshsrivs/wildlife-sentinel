import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { createServer } from "vite";
import {
  allowedLocalOrigin,
  localProxy,
  localProxyGuard,
} from "../dev-proxy.js";

test("proxy accepts its local origin and rejects foreign origins and hosts", () => {
  assert.equal(
    allowedLocalOrigin({
      host: "127.0.0.1:5174",
      origin: "http://127.0.0.1:5174",
    }),
    true,
  );
  assert.equal(
    allowedLocalOrigin({
      host: "127.0.0.1:5174",
      origin: "https://evil.example",
    }),
    false,
  );
  assert.equal(
    allowedLocalOrigin({ host: "evil.example", origin: "http://evil.example" }),
    false,
  );
});

test("alternate-port proxy forwards API/health and blocks hostile WebSocket origins", async () => {
  const received = [];
  const backend = http.createServer((request, response) => {
    received.push(request.url);
    response.writeHead(request.url.startsWith("/api/") ? 401 : 200, {
      "Content-Type": "application/json",
    });
    response.end(JSON.stringify({ status: "test" }));
  });
  let upgraded = false;
  backend.on("upgrade", (_request, socket) => {
    upgraded = true;
    socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
  });
  await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
  const upstream = `http://127.0.0.1:${backend.address().port}`;
  const vite = await createServer({
    configFile: false,
    plugins: [localProxyGuard()],
    server: { host: "127.0.0.1", port: 0, proxy: localProxy(upstream) },
  });
  try {
    await vite.listen();
    const port = vite.httpServer.address().port,
      origin = `http://127.0.0.1:${port}`;
    assert.equal(
      (await fetch(origin + "/api/auth/me", { headers: { Origin: origin } }))
        .status,
      401,
    );
    assert.equal((await fetch(origin + "/health")).status, 200);
    assert.equal(
      (
        await fetch(origin + "/api/auth/me", {
          headers: { Origin: "https://evil.example" },
        })
      ).status,
      403,
    );
    const handshake = await new Promise((resolve, reject) => {
      const socket = net.connect(port, "127.0.0.1", () =>
        socket.write(
          `GET /ws/alerts?ticket=test HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nOrigin: https://evil.example\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n`,
        ),
      );
      socket.setTimeout(3000, () => {
        socket.destroy();
        reject(new Error("Proxy origin check timed out"));
      });
      socket.on("data", (chunk) => {
        resolve(chunk.toString());
        socket.destroy();
      });
      socket.on("error", reject);
    });
    assert.match(handshake, /403/);
    assert.equal(upgraded, false);
    assert.deepEqual(received, ["/api/auth/me", "/health"]);
  } finally {
    await vite.close();
    await new Promise((resolve) => backend.close(resolve));
  }
});
