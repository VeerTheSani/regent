/**
 * src/engine/polyglot.ts
 *
 * Polyglot Execution Sandbox.
 * Provides safe, zero-escaping execution across Python, Node.js, PowerShell, and Native C#.
 * Passes code via stdin streams or UTF-16LE Base64 EncodedCommands to completely
 * prevent Windows command-line quoting and escaping traps.
 */

import spawn from "cross-spawn";
import { RuneCompiler } from "../rune/compiler.js";

export interface ExecutionResult {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export class PolyglotEngine {
  private compiler = new RuneCompiler();

  /**
   * Run Python code by streaming directly to python stdin.
   */
  async runPython(code: string, args: string[] = []): Promise<ExecutionResult> {
    const started = Date.now();
    return new Promise((resolve) => {
      const child = spawn("python", ["-u", "-", ...args], {
        stdio: ["pipe", "pipe", "pipe"],
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
        const exitCode = code ?? 0;
        resolve({
          ok: exitCode === 0,
          exitCode,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          durationMs: Date.now() - started,
        });
      });

      child.on("error", (err) => {
        resolve({
          ok: false,
          exitCode: 1,
          stdout: "",
          stderr: err.message,
          durationMs: Date.now() - started,
        });
      });

      child.stdin?.write(code);
      child.stdin?.end();
    });
  }

  /**
   * Run Node.js JavaScript code by streaming directly to node stdin.
   */
  async runNode(code: string, args: string[] = []): Promise<ExecutionResult> {
    const started = Date.now();
    return new Promise((resolve) => {
      const child = spawn("node", ["-", ...args], {
        stdio: ["pipe", "pipe", "pipe"],
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
        const exitCode = code ?? 0;
        resolve({
          ok: exitCode === 0,
          exitCode,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          durationMs: Date.now() - started,
        });
      });

      child.on("error", (err) => {
        resolve({
          ok: false,
          exitCode: 1,
          stdout: "",
          stderr: err.message,
          durationMs: Date.now() - started,
        });
      });

      child.stdin?.write(code);
      child.stdin?.end();
    });
  }

  /**
   * Run PowerShell script via UTF-16LE Base64 -EncodedCommand.
   * This is Microsoft's official recommended mechanism for executing arbitrary scripts
   * with zero quote-escaping, backslash, or CLI parsing corruption.
   */
  async runPowerShell(script: string): Promise<ExecutionResult> {
    const started = Date.now();
    const encoded = Buffer.from(script, "utf16le").toString("base64");

    return new Promise((resolve) => {
      const child = spawn(
        "powershell",
        ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
        { stdio: ["ignore", "pipe", "pipe"] },
      );

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (d) => {
        stdout += d.toString();
      });
      child.stderr?.on("data", (d) => {
        stderr += d.toString();
      });

      child.on("close", (code) => {
        const exitCode = code ?? 0;
        resolve({
          ok: exitCode === 0,
          exitCode,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          durationMs: Date.now() - started,
        });
      });

      child.on("error", (err) => {
        resolve({
          ok: false,
          exitCode: 1,
          stdout: "",
          stderr: err.message,
          durationMs: Date.now() - started,
        });
      });
    });
  }

  /**
   * Run Native C# / Win32 code compiled on the fly.
   */
  async runNative(csharpCode: string, args: string[] = []): Promise<ExecutionResult> {
    const started = Date.now();
    try {
      const out = await this.compiler.runNative(csharpCode, args);
      return {
        ok: true,
        exitCode: 0,
        stdout: out,
        stderr: "",
        durationMs: Date.now() - started,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        exitCode: 1,
        stdout: "",
        stderr: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - started,
      };
    }
  }
}
