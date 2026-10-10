/**
 * test/unit/browser-driver.test.ts
 *
 * TDD test suite for Live Chrome & Media Operator.
 * Verifies tab navigation, DOM element manipulation, in-page JavaScript execution,
 * and media speed control.
 */

import { existsSync, unlinkSync } from "node:fs";
import { type Server, createServer } from "node:http";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ChromeBrowserDriver } from "../../src/engine/browser-driver.js";

const TEST_PORT = 9977;

describe("Live Chrome & Media Operator", () => {
  let server: Server;
  const driver = new ChromeBrowserDriver({ headless: true });

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!DOCTYPE html>
<html>
<head><title>Test Media & DOM Page</title></head>
<body>
  <h1>Media Control Test</h1>
  <div id="content">Extracted Content from Page</div>
  <video id="player" src="" controls></video>
</body>
</html>`);
    });

    await new Promise<void>((resolve) => {
      server.listen(TEST_PORT, "127.0.0.1", resolve);
    });
  });

  afterAll(async () => {
    try {
      await driver.close();
    } catch {}
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("navigates to URL and extracts DOM text", async () => {
    const page = await driver.openTab(`http://127.0.0.1:${TEST_PORT}/`);
    expect(await page.title()).toBe("Test Media & DOM Page");

    const text = await driver.extractText("#content");
    expect(text).toContain("Extracted Content from Page");
  });

  it("controls HTML5 media element: sets playbackRate and inspects state", async () => {
    const result = await driver.controlMediaElement({
      speed: 0.5,
      volume: 0.8,
    });
    expect(result.speed).toBe(0.5);
    expect(result.volume).toBe(0.8);
  });

  it("captures high-fidelity page screenshot", async () => {
    const dest = join(process.cwd(), "test", "fixtures", "browser-driver-snap.png");
    const saved = await driver.takeScreenshot(dest);
    expect(existsSync(saved)).toBe(true);
    try {
      unlinkSync(saved);
    } catch {}
  });
});
