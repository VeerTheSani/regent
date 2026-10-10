/**
 * src/evidence/desktop.ts
 *
 * Windows desktop window and virtual screen capture using PowerShell per 07 §4.
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnTree } from "../workers/spawn.js";

export interface DesktopCaptureResult {
  success: boolean;
  outPath: string;
  error?: string;
}

export async function captureDesktop(
  outPath: string,
  title?: string,
): Promise<DesktopCaptureResult> {
  const dir = dirname(outPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const scriptPath = join(process.cwd(), "src", "evidence", "capture-window.ps1");

  const args = [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    scriptPath,
    "-Out",
    outPath,
  ];

  if (title) {
    args.push("-Title", title);
  }

  const { child } = spawnTree("powershell.exe", args, { timeoutMs: 15000 });
  let stderr = "";

  child.stderr?.on("data", (d) => {
    stderr += d.toString();
  });

  const exitCode = await new Promise<number | null>((res) => child.on("close", res));

  if (exitCode === 0 && existsSync(outPath)) {
    return { success: true, outPath };
  }

  return {
    success: false,
    outPath,
    error: stderr || `PowerShell exited with code ${exitCode}`,
  };
}
