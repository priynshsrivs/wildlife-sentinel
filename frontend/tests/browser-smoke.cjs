/* Real API integration with isolated storage and deterministic inference fixtures. */
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { chromium } = require("playwright");
const frontend = path.resolve(__dirname, "..");
const repository = path.resolve(frontend, "..");
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "wildlife-browser-audit-"),
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function freePort() {
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}
(async () => {
  const port = await freePort();
  const api = `http://127.0.0.1:${port}`;
  let server, browser;
  const backend = spawn(
    process.env.PYTHON || "python",
    ["tests/browser_server.py"],
    {
      cwd: repository,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        SENTINEL_BROWSER_TEST_DIR: directory,
        SENTINEL_BROWSER_TEST_PORT: String(port),
      },
    },
  );
  let diagnostic = "";
  backend.stdout.on("data", (chunk) => (diagnostic += chunk.toString()));
  backend.stderr.on("data", (chunk) => (diagnostic += chunk.toString()));
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (backend.exitCode !== null)
        throw new Error("Test backend exited: " + diagnostic);
      try {
        if ((await fetch(api + "/health")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await sleep(250);
    }
    if (!ready) throw new Error("Test backend did not start: " + diagnostic);
    const { createServer } = await import("vite");
    const { localProxy } = await import("../dev-proxy.js");
    server = await createServer({
      root: frontend,
      server: { host: "127.0.0.1", port: 0, proxy: localProxy(api) },
    });
    await server.listen();
    const url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({
      headless: true,
      ...(process.platform === "win32"
        ? { channel: process.env.BROWSER_CHANNEL || "msedge" }
        : {}),
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
      ],
    });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const apiResponse = (suffix) =>
      page.waitForResponse(
        (response) => new URL(response.url()).pathname === suffix,
      );
    async function login(role) {
      await page.goto(url);
      await page
        .getByLabel("Access token", { exact: true })
        .fill("browser-test-" + role);
      await page.getByRole("button", { name: "Open command center" }).click();
      await page.getByRole("button", { name: "Enter Sentinel" }).click();
      await page
        .getByRole("heading", { name: "Dashboard", exact: true, level: 1 })
        .waitFor();
    }
    async function nav(name) {
      if (page.viewportSize().width <= 750) {
        await page
          .getByRole("button", { name: "Open navigation", exact: true })
          .click();
        await page
          .locator("#mobile-navigation")
          .getByRole("button", { name, exact: true })
          .click();
      } else
        await page
          .getByRole("navigation", { name: "Main navigation", exact: true })
          .getByRole("button", { name, exact: true })
          .click();
      await page
        .getByRole("heading", { name, exact: true, level: 1 })
        .waitFor();
      await sleep(350);
    }
    await login("admin");
    await page
      .getByRole("button", { name: "Ingest telemetry", exact: true })
      .click();
    for (const [index, file, suffix] of [
      [0, "sample.jpg", "/api/detect"],
      [1, "sample.avi", "/api/detect/video"],
      [2, "sample.wav", "/api/detect/audio"],
    ]) {
      const responsePromise = apiResponse(suffix);
      await page
        .locator("input[type=file]")
        .nth(index)
        .setInputFiles(path.join(directory, file));
      const response = await responsePromise;
      assert.equal(
        response.status(),
        200,
        file + ": " + (await response.text()),
      );
      await page
        .getByRole("status")
        .filter({ hasText: "ingestion complete" })
        .waitFor();
    }
    await nav("Dashboard");
    let releaseSnapshot, markCaptured;
    const snapshotGate = new Promise((resolve) => {
      releaseSnapshot = resolve;
    });
    const captured = new Promise((resolve) => {
      markCaptured = resolve;
    });
    await page.route("**/api/alerts", async (route) => {
      const response = await route.fetch();
      const snapshot = await response.json();
      markCaptured();
      await snapshotGate;
      await route.fulfill({ response, json: snapshot });
    });
    await page
      .getByRole("button", { name: "Refresh telemetry", exact: true })
      .click();
    await captured;
    const newEvent = await fetch(api + "/api/edge/telemetry", {
      method: "POST",
      headers: {
        Authorization: "Bearer browser-test-admin",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        camera_id: "COMPUTER_2",
        threat_level: "HIGH",
        vision_confidence: 0.85,
        detections: [{ label: "car", confidence: 0.85 }],
      }),
    });
    assert.equal(newEvent.status, 200);
    assert.equal((await newEvent.json()).frontend_notified, true);
    await page.getByText("COMPUTER_2", { exact: true }).waitFor();
    releaseSnapshot();
    await page.waitForFunction(
      () =>
        !document.querySelector('button[aria-label="Refresh telemetry"]')
          .disabled,
    );
    assert.equal(
      await page.getByText("COMPUTER_2", { exact: true }).count(),
      1,
      "A stale refresh must not erase a live alert",
    );
    await page.unroute("**/api/alerts");
    await nav("Threat Alerts");
    const feedbackPromise = page.waitForResponse((response) =>
      response.url().endsWith("/feedback"),
    );
    await page
      .locator(".incident-row")
      .filter({ hasText: "CAM_MANUAL_FEED" })
      .getByRole("button", { name: "False alarm", exact: true })
      .click();
    const feedbackResponse = await feedbackPromise;
    assert.equal(feedbackResponse.status(), 200);
    assert.equal((await feedbackResponse.json()).saved_to_hard_negatives, true);
    await page.getByText("Saved: FALSE POSITIVE", { exact: false }).waitFor();
    const explanationPromise = page.waitForResponse((response) =>
      response.url().endsWith("/explain"),
    );
    await page
      .getByRole("button", { name: "Explain Decision", exact: true })
      .first()
      .click();
    assert.equal((await explanationPromise).status(), 200);
    await page
      .getByRole("dialog")
      .getByText("Recorded model information", { exact: true })
      .waitFor();
    assert.ok(!(await page.getByRole("dialog").innerText()).includes("95%"));
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.getAttribute("aria-label"),
      ),
      "Close decision explanation",
    );
    await page.keyboard.press("Escape");
    await page.route("**/api/alerts/*/explain", (route) =>
      route.fulfill({ status: 503, json: { detail: "Audit unavailable" } }),
    );
    await page
      .getByRole("button", { name: "Explain Decision", exact: true })
      .first()
      .click();
    await page.getByRole("dialog").getByRole("alert").waitFor();
    assert.match(
      await page.getByRole("dialog").innerText(),
      /No explanation could be verified/,
    );
    await page
      .getByRole("button", { name: "Close decision explanation" })
      .click();
    await page.unroute("**/api/alerts/*/explain");
    const resolvePromise = page.waitForResponse((response) =>
      response.url().endsWith("/resolve"),
    );
    await page
      .getByRole("button", { name: "Resolve", exact: true })
      .first()
      .click();
    assert.equal((await resolvePromise).status(), 200);
    await page.getByText("Resolved", { exact: true }).first().waitFor();
    await nav("Settings");
    const settingsPromise = apiResponse("/api/settings");
    await page
      .getByLabel("Core Geofence Radius (meters)", { exact: false })
      .fill("950");
    await page
      .getByLabel("Core Geofence Radius (meters)", { exact: false })
      .blur();
    await settingsPromise;
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const name of [
        "Dashboard",
        "Camera Hub",
        "Threat Alerts",
        "Reserve Map",
        "Analytics",
        "Camera Network",
        "Settings",
        "Live Monitoring",
      ]) {
        await nav(name);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          `${name} overflow at ${width}`,
        );
      }
    }
    await nav("Live Monitoring");
    await page
      .getByText("No remote camera is assigned to this feed", { exact: false })
      .count();
    const badApiCalls = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((item) => item.name)
        .filter((name) => /\/api\/api\/|\/api\/health/.test(name)),
    );
    assert.deepEqual(badApiCalls, []);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await login("viewer");
    assert.equal(
      await page
        .getByRole("button", { name: "Clear all alerts", exact: true })
        .isDisabled(),
      true,
    );
    await nav("Camera Hub");
    assert.equal(
      await page
        .getByRole("button", { name: "Initialize AI", exact: true })
        .isDisabled(),
      true,
    );
    await nav("Settings");
    assert.equal(await page.locator("input[type=number]").isDisabled(), true);
    await nav("Threat Alerts");
    if (
      await page.getByRole("button", { name: "Resolve", exact: true }).count()
    )
      assert.equal(
        await page
          .getByRole("button", { name: "Resolve", exact: true })
          .first()
          .isDisabled(),
        true,
      );
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await login("operator");
    assert.equal(await page.getByRole("button", { name: "AI Research", exact: true }).count(), 0);
    const clearButton = page.getByRole("button", { name: "Clear all alerts", exact: true });
    assert.equal(await clearButton.isDisabled(), false);
    const alertsBeforeClear = await page.evaluate(async () => {
      const response = await fetch('/api/alerts', { headers: { Authorization: 'Bearer browser-test-operator' } });
      return (await response.json()).length;
    });
    assert.ok(alertsBeforeClear > 0);
    await clearButton.click();
    await page.getByRole("dialog", { name: "Clear security logs?" }).waitFor();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(await page.getByRole("dialog").count(), 0);
    await page.route("**/api/alerts/clear", route => route.fulfill({ status: 503, json: { detail: "Database temporarily unavailable" } }));
    await clearButton.click();
    await page.getByRole("button", { name: "Clear logs", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Database temporarily unavailable" }).waitFor();
    await page.unroute("**/api/alerts/clear");
    const cleared = page.waitForResponse(response => response.url().endsWith('/api/alerts/clear') && response.request().method() === 'DELETE');
    await page.getByRole("button", { name: "Clear logs", exact: true }).click();
    assert.equal((await cleared).status(), 200);
    await page.getByText("Security log cleared", { exact: true }).waitFor();
    assert.equal(await page.getByRole("dialog").count(), 0);
    const remaining = await page.evaluate(async () => {
      const response = await fetch('/api/alerts', { headers: { Authorization: 'Bearer browser-test-operator' } });
      return await response.json();
    });
    assert.deepEqual(remaining, []);
    await nav("Settings");
    assert.equal(await page.locator("input[type=number]").isDisabled(), true);
    await nav("Camera Hub");
    assert.equal(
      await page
        .getByRole("button", { name: "Initialize AI", exact: true })
        .isDisabled(),
      false,
    );
    await page.route("**/api/stats", (route) =>
      route.fulfill({
        status: 401,
        json: { detail: "Authentication required" },
      }),
    );
    await page
      .getByRole("button", { name: "Refresh telemetry", exact: true })
      .click();
    await page.getByLabel("Access token", { exact: true }).waitFor();
    await page
      .getByRole("alert")
      .filter({ hasText: "session expired" })
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: actual backend contracts; image/video/audio ingestion; live updates; feedback/export; evidence and failure states; resolve; settings; eight tabs at 1440/390/320px; viewer/operator permissions; clear logs cancellation, failure and retry.",
    );
    console.log("Isolated browser-test data: " + directory);
  } finally {
    await browser?.close();
    await server?.close();
    backend.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
