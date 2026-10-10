/**
 * src/evidence/gates.ts
 *
 * Deterministic T0 gate evaluation engine per 07 §1.
 * Pure code: no models, no cost, no subjective bias.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { join } from "node:path";
import spawn from "cross-spawn";
import picomatch from "picomatch";
import { SecretsManager } from "../kernel/secrets.js";
import { diffAgainst, frameStats } from "./pixels.js";

export interface GateSpec {
  id: string;
  kind:
    | "command"
    | "scope"
    | "secret_scan"
    | "file_exists"
    | "http"
    | "no_blank_frame"
    | "console_clean"
    | "visual_diff";
  spec: Record<string, unknown>;
}

export interface GateResult {
  id: string;
  kind: string;
  passed: boolean;
  detail: string;
  durationMs: number;
  artifacts: string[];
}

export interface GateContext {
  cwd: string;
  attemptDir: string;
  diffText?: string;
  changedFiles?: string[];
}

export class GateRunner {
  private secrets = new SecretsManager();

  async runGate(gate: GateSpec, ctx: GateContext): Promise<GateResult> {
    const started = Date.now();
    const artifacts: string[] = [];

    switch (gate.kind) {
      case "command": {
        const cmd = String(gate.spec.cmd ?? "");
        const timeoutMs = Number(gate.spec.timeoutSec ?? 600) * 1000;

        const isWindows = process.platform === "win32";
        const gitBash = "C:\\Program Files\\Git\\bin\\bash.exe";
        const shellCmd = isWindows
          ? existsSync(gitBash)
            ? gitBash
            : process.env.ComSpec || "cmd.exe"
          : "bash";
        const shellArgs = shellCmd.toLowerCase().endsWith("cmd.exe")
          ? ["/d", "/s", "/c", cmd]
          : ["-c", cmd];

        const child = spawn(shellCmd, shellArgs, {
          cwd: ctx.cwd,
          windowsHide: true,
        });

        let stdout = "";
        let stderr = "";

        const timer = setTimeout(() => {
          try {
            child.kill("SIGKILL");
          } catch {}
        }, timeoutMs);

        child.stdout?.on("data", (d) => {
          stdout += d.toString();
        });
        child.stderr?.on("data", (d) => {
          stderr += d.toString();
        });

        const code = await new Promise<number | null>((res) => child.on("close", res));
        clearTimeout(timer);

        const gatesDir = join(ctx.attemptDir, "gates");
        if (!existsSync(gatesDir)) {
          mkdirSync(gatesDir, { recursive: true });
        }
        const logPath = join(gatesDir, `${gate.id}.log`);
        writeFileSync(
          logPath,
          `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}\nEXIT CODE: ${code}\n`,
          "utf-8",
        );
        artifacts.push(logPath);

        const passed = code === 0;
        const detail = passed
          ? "Command executed successfully"
          : (stderr || stdout).slice(-300).trim();

        return {
          id: gate.id,
          kind: gate.kind,
          passed,
          detail,
          durationMs: Date.now() - started,
          artifacts,
        };
      }

      case "scope": {
        const writePaths = (gate.spec.writePaths as string[]) ?? [];
        const changed = ctx.changedFiles ?? [];

        const outside = changed.filter((file) => {
          const norm = file.replace(/\\/g, "/");
          return !writePaths.some((p) => {
            const isMatch = picomatch(p.replace(/\\/g, "/"));
            return isMatch(norm) || norm.startsWith(p);
          });
        });

        const passed = outside.length === 0;
        return {
          id: gate.id,
          kind: gate.kind,
          passed,
          detail: passed
            ? "All changed files within permitted scope"
            : `Outside allowed scope: ${outside.join(", ")}`,
          durationMs: Date.now() - started,
          artifacts,
        };
      }

      case "secret_scan": {
        const diff = ctx.diffText ?? "";
        // Extract added lines
        const addedLines = diff
          .split("\n")
          .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
          .join("\n");

        const matches = this.secrets.scan(addedLines);
        const passed = matches.length === 0;

        // Ensure the report contains ONLY rule names and line indices, NEVER secret values!
        const detail = passed
          ? "Zero secret matches detected"
          : `Secrets detected: ${matches.map((m) => m.rule).join("; ")}`;

        return {
          id: gate.id,
          kind: gate.kind,
          passed,
          detail,
          durationMs: Date.now() - started,
          artifacts,
        };
      }

      case "file_exists": {
        const paths = (gate.spec.paths as string[]) ?? [];
        const missing: string[] = [];

        for (const p of paths) {
          const full = join(ctx.cwd, p);
          if (!existsSync(full)) {
            missing.push(p);
          }
        }

        const passed = missing.length === 0;
        return {
          id: gate.id,
          kind: gate.kind,
          passed,
          detail: passed ? "All required files exist" : `Missing files: ${missing.join(", ")}`,
          durationMs: Date.now() - started,
          artifacts,
        };
      }

      case "http": {
        const urlStr = String(gate.spec.url ?? "");
        const expectStatus = Number(gate.spec.expectStatus ?? 200);

        const status = await new Promise<number>((resolve) => {
          const client = urlStr.startsWith("https") ? https : http;
          const req = client.get(urlStr, (res) => resolve(res.statusCode ?? 0));
          req.on("error", () => resolve(0));
          req.setTimeout(5000, () => req.destroy());
        });

        const passed = status === expectStatus;
        return {
          id: gate.id,
          kind: gate.kind,
          passed,
          detail: passed
            ? `HTTP status ${status} matched expected ${expectStatus}`
            : `HTTP status ${status} did not match expected ${expectStatus}`,
          durationMs: Date.now() - started,
          artifacts,
        };
      }

      case "no_blank_frame": {
        const pngPath = String(gate.spec.pngPath ?? "");
        if (!existsSync(pngPath)) {
          return {
            id: gate.id,
            kind: gate.kind,
            passed: false,
            detail: `Screenshot file not found: ${pngPath}`,
            durationMs: Date.now() - started,
            artifacts,
          };
        }

        const stats = frameStats(pngPath);
        return {
          id: gate.id,
          kind: gate.kind,
          passed: !stats.blank,
          detail: stats.blank
            ? `Frame detected as blank (std: ${stats.std.toFixed(2)}, colors: ${stats.distinctColours})`
            : "Frame visually valid (not blank)",
          durationMs: Date.now() - started,
          artifacts,
        };
      }

      case "console_clean": {
        const errors = (gate.spec.consoleErrors as string[]) ?? [];
        const passed = errors.length === 0;
        return {
          id: gate.id,
          kind: gate.kind,
          passed,
          detail: passed
            ? "Console clean with zero errors"
            : `Console errors detected: ${errors.join("; ")}`,
          durationMs: Date.now() - started,
          artifacts,
        };
      }

      case "visual_diff": {
        const baseline = String(gate.spec.baseline ?? "");
        const current = String(gate.spec.current ?? "");
        const outPng = String(gate.spec.outPng ?? join(ctx.attemptDir, "diff.png"));
        const threshold = Number(gate.spec.threshold ?? 0.002);

        if (!existsSync(baseline) || !existsSync(current)) {
          return {
            id: gate.id,
            kind: gate.kind,
            passed: false,
            detail: "Baseline or current image missing",
            durationMs: Date.now() - started,
            artifacts,
          };
        }

        const res = diffAgainst(baseline, current, outPng);
        if (!res.comparable) {
          return {
            id: gate.id,
            kind: gate.kind,
            passed: false,
            detail: "Images have non-matching dimensions; not comparable",
            durationMs: Date.now() - started,
            artifacts,
          };
        }

        artifacts.push(outPng);
        const passed = res.changedRatio <= threshold;
        return {
          id: gate.id,
          kind: gate.kind,
          passed,
          detail: `Changed ratio ${(res.changedRatio * 100).toFixed(3)}% (threshold ${(threshold * 100).toFixed(3)}%)`,
          durationMs: Date.now() - started,
          artifacts,
        };
      }
    }
  }

  async runAll(gates: GateSpec[], ctx: GateContext): Promise<GateResult[]> {
    const results: GateResult[] = [];
    for (const g of gates) {
      results.push(await this.runGate(g, ctx));
    }
    return results;
  }
}
