/**
 * test/integration/browser-operator.test.ts
 *
 * Acceptance test for M8:
 * - Local static page served by test
 * - Capture + console-error detection
 * - Form classified as login => A3 without grant
 */

import { existsSync, mkdirSync } from "node:fs";
import { type Server, createServer } from "node:http";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { captureWeb } from "../../src/evidence/web.js";
import { Charter, type CharterRule } from "../../src/kernel/charter.js";
import { GrantStore } from "../../src/kernel/grants.js";
import { KillSwitch } from "../../src/kernel/kill-switch.js";
import { classifyFormKind } from "../../src/workers/browser.js";

const TEST_PORT = 9988;
const TEST_DIR = join(process.cwd(), "test", "fixtures", "browser-test");
if (!existsSync(TEST_DIR)) {
  mkdirSync(TEST_DIR, { recursive: true });
}

describe("M8: Browser Operator & Form Security", () => {
  let server: Server;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!DOCTYPE html>
<html>
<head><title>Login Test Page</title></head>
<body>
  <h1>User Login</h1>
  <form id="login-form" action="/login" method="POST">
    <input type="text" name="username" placeholder="Username" />
    <input type="password" name="password" placeholder="Password" />
    <button type="submit">Log In</button>
  </form>
  <script>
    console.error("Deliberate test console error");
  </script>
</body>
</html>`);
    });

    await new Promise<void>((resolve) => {
      server.listen(TEST_PORT, "127.0.0.1", resolve);
    });
  });

  afterAll(() => {
    server.close();
  });

  it("captures page, detects console error, and classifies form as login", async () => {
    const url = `http://127.0.0.1:${TEST_PORT}/`;
    const capture = await captureWeb({ name: "login-page-capture", url }, TEST_DIR);

    expect(capture.title).toBe("Login Test Page");
    expect(existsSync(capture.png)).toBe(true);

    // Console error detection
    expect(capture.consoleErrors.length).toBeGreaterThanOrEqual(1);
    expect(capture.consoleErrors.some((e) => e.includes("Deliberate test console error"))).toBe(
      true,
    );

    // Form classification
    const formFields = ["username", "password", "submit"];
    const kind = classifyFormKind(formFields);
    expect(kind).toBe("login");

    // Charter check: browser.login or browser.submit with login formKind => A3
    const rules: CharterRule[] = [
      {
        level: "A4",
        action: "browser.submit",
        when: { formKind: ["payment", "legal", "account"] },
      },
      { level: "A3", action: "browser.submit" },
      { level: "A3", action: "browser.login" },
      { level: "A0", action: "browser.navigate" },
    ];

    const grants = new GrantStore();
    const killSwitch = new KillSwitch();
    const charter = new Charter(rules, grants, killSwitch);

    const decision = charter.evaluate(
      {
        jobId: "job-b1",
        actor: "browser_operator",
        action: "browser.submit",
        target: { formKind: kind, url },
        tainted: false,
      },
      { workspaceRoots: [process.cwd()], attemptDir: TEST_DIR },
    );

    // Must be classified as A3 and require a grant
    expect(decision.level).toBe("A3");
    expect(decision.kind).toBe("needs_grant");
  });
});
