/**
 * test/unit/gates.test.ts
 *
 * Acceptance tests for M4: Deterministic T0 Gates & Secret Scanning.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type GateContext, GateRunner } from "../../src/evidence/gates.js";

const TEST_DIR = join(process.cwd(), "test", "fixtures", "gates");
if (!existsSync(TEST_DIR)) {
  mkdirSync(TEST_DIR, { recursive: true });
}

describe("M4: T0 Deterministic Gates & Secret Scan", () => {
  const runner = new GateRunner();
  const ctx: GateContext = {
    cwd: process.cwd(),
    attemptDir: TEST_DIR,
  };

  it("secret scan test: a diff containing fake sk-ant-... is flagged and log contains rule, not secret value", async () => {
    const fakeKey = "sk-ant-api03-abcdef12345678901234567890abcdef123";
    const diffWithSecret = `
--- a/src/config.ts
+++ b/src/config.ts
@@ -1,3 +1,4 @@
 export const CONFIG = {
+  apiKey: "${fakeKey}",
 };
`;

    const result = await runner.runGate(
      { id: "gate-secrets", kind: "secret_scan", spec: {} },
      { ...ctx, diffText: diffWithSecret },
    );

    // Must be flagged as failed
    expect(result.passed).toBe(false);
    // Detail must contain the rule name
    expect(result.detail).toContain("Pattern match");
    // Crucial security requirement: detail must NEVER contain the secret value!
    expect(result.detail).not.toContain(fakeKey);
  });

  it("secret scan passes clean diff with zero false positives", async () => {
    const cleanDiff = `
--- a/src/math.ts
+++ b/src/math.ts
@@ -1,2 +1,3 @@
 export function add(a: number, b: number): number {
+  return a + b;
 }
`;

    const result = await runner.runGate(
      { id: "gate-clean", kind: "secret_scan", spec: {} },
      { ...ctx, diffText: cleanDiff },
    );

    expect(result.passed).toBe(true);
    expect(result.detail).toContain("Zero secret matches");
  });

  it("scope gate enforces allowed write paths", async () => {
    const gateSpec = {
      id: "gate-scope",
      kind: "scope" as const,
      spec: { writePaths: ["src/**", "test/**"] },
    };

    // Valid files within scope
    const validResult = await runner.runGate(gateSpec, {
      ...ctx,
      changedFiles: ["src/app.ts", "test/app.test.ts"],
    });
    expect(validResult.passed).toBe(true);

    // Invalid file outside scope (e.g. modifying root package.json)
    const invalidResult = await runner.runGate(gateSpec, {
      ...ctx,
      changedFiles: ["src/app.ts", "package.json"],
    });
    expect(invalidResult.passed).toBe(false);
    expect(invalidResult.detail).toContain("package.json");
  });

  it("file_exists gate verifies required paths", async () => {
    const existingFile = join(TEST_DIR, "required-file.txt");
    writeFileSync(existingFile, "content", "utf-8");

    const passResult = await runner.runGate(
      {
        id: "gate-file-pass",
        kind: "file_exists",
        spec: { paths: ["test/fixtures/gates/required-file.txt"] },
      },
      ctx,
    );
    expect(passResult.passed).toBe(true);

    const failResult = await runner.runGate(
      {
        id: "gate-file-fail",
        kind: "file_exists",
        spec: { paths: ["test/fixtures/gates/non-existent-file-xyz.txt"] },
      },
      ctx,
    );
    expect(failResult.passed).toBe(false);
  });

  it("visual_verify gate captures screen and evaluates result", async () => {
    const res = await runner.runGate(
      {
        id: "gate-visual-test",
        kind: "visual_verify",
        spec: { goal: "Verify desktop is accessible" },
      },
      ctx,
    );
    expect(res.id).toBe("gate-visual-test");
    expect(typeof res.passed).toBe("boolean");
    expect(res.artifacts.length).toBeGreaterThan(0);
  });
});
