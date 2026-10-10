/**
 * test/unit/doctor.test.ts
 *
 * Acceptance test for M7: regent doctor diagnostics suite.
 */

import { describe, expect, it } from "vitest";
import { runDiagnostics } from "../../src/operator/doctor.js";

describe("M7: Regent Doctor Diagnostics", () => {
  it("probes all core dependencies and verifies runtimes", async () => {
    const checks = await runDiagnostics();
    expect(checks.length).toBeGreaterThanOrEqual(8);

    const checkMap = new Map(checks.map((c) => [c.name, c]));

    // Node.js
    const nodeCheck = checkMap.get("Node.js Runtime");
    expect(nodeCheck).toBeDefined();
    expect(nodeCheck?.status).toBe("ok");

    // Git
    const gitCheck = checkMap.get("Git CLI");
    expect(gitCheck).toBeDefined();
    expect(gitCheck?.status).toBe("ok");

    // Claude Code
    const claudeCheck = checkMap.get("Claude Code CLI");
    expect(claudeCheck).toBeDefined();
    expect(claudeCheck?.status).toBe("ok");

    // Hermes Agent
    const hermesCheck = checkMap.get("Hermes Agent CLI");
    expect(hermesCheck).toBeDefined();
    expect(hermesCheck?.status).toBe("ok");

    // VS Code
    const codeCheck = checkMap.get("VS Code CLI");
    expect(codeCheck).toBeDefined();
    expect(codeCheck?.status).toBe("ok");

    // Google Chrome
    const chromeCheck = checkMap.get("Google Chrome");
    expect(chromeCheck).toBeDefined();
    expect(chromeCheck?.status).toBe("ok");
  });
});
