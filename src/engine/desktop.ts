/**
 * src/engine/desktop.ts
 *
 * Human-Grade Desktop Controller.
 * Adopts Hermes Agent computer_use patterns for visual sensing, window discovery,
 * focus targeting, and native Win32 input generation.
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { RuneKernel, type WindowInfo } from "../rune/kernel.js";
import { RuneRuntime } from "../rune/runtime.js";

export interface DesktopState {
  timestamp: number;
  display: { width: number; height: number; monitors: number };
  windows: WindowInfo[];
  activeWindow?: WindowInfo;
}

export class DesktopController {
  private kernel = new RuneKernel();
  private runtime = new RuneRuntime();

  /**
   * Senses full desktop state: virtual screen dimensions and all visible window boundaries.
   */
  async senseDesktop(): Promise<DesktopState> {
    const [display, windows] = await Promise.all([
      this.kernel.getDisplayInfo(),
      this.kernel.listWindows(),
    ]);

    // First window in list with non-empty title is typically frontmost
    const activeWindow = windows.find((w) => w.title && w.width > 100 && w.height > 100);

    return {
      timestamp: Date.now(),
      display,
      windows,
      activeWindow,
    };
  }

  /**
   * Captures high-resolution virtual screen screenshot.
   */
  async captureScreen(destPath: string): Promise<string> {
    const abs = resolve(destPath);
    const dir = dirname(abs);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return this.runtime.screenshot(abs);
  }

  /**
   * Moves mouse cursor smoothly to coordinates.
   */
  async mouseMove(x: number, y: number): Promise<void> {
    await this.kernel.mouseMove(x, y);
  }

  /**
   * Performs physical mouse click (left, right, middle).
   */
  async mouseClick(button: "left" | "right" | "middle" = "left"): Promise<void> {
    await this.kernel.mouseClick(button);
  }

  /**
   * Performs physical drag and drop between coordinates.
   */
  async mouseDrag(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
    await this.mouseMove(fromX, fromY);
    // Down
    const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinDrag {
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);
}
"@;
[WinDrag]::mouse_event(0x0002, 0, 0, 0, 0);
Start-Sleep -Milliseconds 100;
[WinDrag]::SetCursorPos(${Math.round(toX)}, ${Math.round(toY)});
Start-Sleep -Milliseconds 100;
[WinDrag]::mouse_event(0x0004, 0, 0, 0, 0);
`;
    await this.kernel.runPs(script);
  }

  /**
   * Types Unicode text into active foreground window.
   */
  async keyboardType(text: string): Promise<void> {
    await this.kernel.keyType(text);
  }

  /**
   * Triggers keyboard key combination (e.g. ['Control', 'c'], ['Alt', 'Tab']).
   */
  async keyboardShortcut(keys: string[]): Promise<void> {
    let chord = "";
    for (const k of keys) {
      const lower = k.toLowerCase();
      if (lower === "control" || lower === "ctrl") chord += "^";
      else if (lower === "shift") chord += "+";
      else if (lower === "alt") chord += "%";
      else if (lower === "enter") chord += "{ENTER}";
      else if (lower === "tab") chord += "{TAB}";
      else if (lower === "escape" || lower === "esc") chord += "{ESC}";
      else chord += `{${k.toUpperCase()}}`;
    }
    const script = `
Add-Type -AssemblyName System.Windows.Forms;
[System.Windows.Forms.SendKeys]::SendWait("${chord}");
`;
    await this.kernel.runPs(script);
  }

  /**
   * Focuses application window by title substring.
   */
  async focusWindow(titleSubstring: string): Promise<boolean> {
    return this.runtime.focusWindow(titleSubstring);
  }
}
