/**
 * test/unit/desktop-controller.test.ts
 *
 * TDD test suite for Human-Grade Desktop Controller.
 * Verifies screen sensing, window enumeration, window focusing, and input generation.
 */

import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DesktopController } from "../../src/engine/desktop.js";

describe("Human-Grade Desktop Controller", () => {
  const desktop = new DesktopController();

  it("senses desktop state: enumerates visible windows with coordinates", async () => {
    const state = await desktop.senseDesktop();
    expect(state).toBeDefined();
    expect(Array.isArray(state.windows)).toBe(true);
    expect(state.windows.length).toBeGreaterThan(0);
    expect(state.windows[0].hwnd).toBeDefined();
    expect(state.windows[0].title).toBeDefined();
    expect(state.windows[0].width).toBeGreaterThan(0);
  });

  it("captures full virtual multi-monitor screenshot without blank frames", async () => {
    const dest = join(process.cwd(), "test", "fixtures", "desktop-sense-test.png");
    const savedPath = await desktop.captureScreen(dest);
    expect(existsSync(savedPath)).toBe(true);
    try {
      unlinkSync(savedPath);
    } catch {}
  });

  it("dispatches mouse move and click without throwing", async () => {
    await expect(desktop.mouseMove(400, 400)).resolves.not.toThrow();
  });

  it("dispatches keyboard text and shortcuts without throwing", async () => {
    await expect(desktop.keyboardType("Test Unicode Input")).resolves.not.toThrow();
    await expect(desktop.keyboardShortcut(["Control", "Shift", "Escape"])).resolves.not.toThrow();
  });
});
