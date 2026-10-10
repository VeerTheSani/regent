/**
 * test/unit/desktop.test.ts
 *
 * Acceptance tests for M4: Desktop window and virtual screen capture.
 */

import { existsSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { captureDesktop } from "../../src/evidence/desktop.js";

const TEST_DIR = join(process.cwd(), "test", "fixtures", "desktop");
if (!existsSync(TEST_DIR)) {
  mkdirSync(TEST_DIR, { recursive: true });
}

describe("M4: Desktop Capture Harness", () => {
  it("runs capture-window.ps1 without title; output PNG exists and has nonzero size", async () => {
    const outPath = join(TEST_DIR, "desktop-screen-capture.png");
    if (existsSync(outPath)) {
      try {
        unlinkSync(outPath);
      } catch {}
    }

    const res = await captureDesktop(outPath);
    expect(res.success).toBe(true);
    expect(existsSync(outPath)).toBe(true);

    const stat = statSync(outPath);
    expect(stat.size).toBeGreaterThan(0);
  });
});
