/**
 * src/rune/compiler.ts
 *
 * RUNE Dynamic Native C / C# Compiler.
 * Allows agents to synthesize arbitrary low-level Win32 routines in real time,
 * compiles them via Roslyn csc.exe into native executables in ~300ms,
 * and caches them by SHA-256 hash for 0ms subsequent execution.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import spawn from "cross-spawn";

export interface CompileResult {
  binaryPath: string;
  cached: boolean;
  compileMs: number;
}

export class RuneCompiler {
  private cacheDir: string;
  private cscPath = "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe";

  constructor(customCacheDir?: string) {
    const userHome = process.env.USERPROFILE || process.env.HOME || "C:/Users/sanis";
    this.cacheDir = customCacheDir ?? join(userHome, ".regent", "rune-bin");
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Compiles source code to a native Windows executable.
   * If already compiled, returns cached binary immediately.
   */
  async compile(sourceCode: string): Promise<CompileResult> {
    const hash = createHash("sha256").update(sourceCode).digest("hex").slice(0, 16);
    const exePath = join(this.cacheDir, `rune_native_${hash}.exe`);
    const srcPath = join(this.cacheDir, `rune_native_${hash}.cs`);

    if (existsSync(exePath)) {
      return { binaryPath: exePath, cached: true, compileMs: 0 };
    }

    writeFileSync(srcPath, sourceCode, "utf-8");
    const started = Date.now();

    return new Promise((resolve, reject) => {
      const child = spawn(
        this.cscPath,
        ["/nologo", "/target:exe", "/optimize+", "/platform:anycpu", `/out:${exePath}`, srcPath],
        { stdio: ["ignore", "pipe", "pipe"] },
      );

      let stderr = "";
      child.stderr?.on("data", (d) => {
        stderr += d.toString();
      });
      child.stdout?.on("data", (d) => {
        stderr += d.toString();
      });

      child.on("close", (code) => {
        const compileMs = Date.now() - started;
        if (code === 0 && existsSync(exePath)) {
          resolve({ binaryPath: exePath, cached: false, compileMs });
        } else {
          reject(new Error(`Native compilation failed (exit ${code}):\n${stderr}`));
        }
      });

      child.on("error", reject);
    });
  }

  /**
   * Compiles and immediately executes native source code with optional arguments.
   */
  async runNative(sourceCode: string, args: string[] = []): Promise<string> {
    const compiled = await this.compile(sourceCode);
    return new Promise((resolve, reject) => {
      const child = spawn(compiled.binaryPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (d) => {
        stdout += d.toString();
      });
      child.stderr?.on("data", (d) => {
        stderr += d.toString();
      });
      child.on("close", (code) => {
        if (code === 0) resolve(stdout.trim());
        else reject(new Error(`Execution error (exit ${code}): ${stderr.trim() || stdout.trim()}`));
      });
      child.on("error", reject);
    });
  }
}
