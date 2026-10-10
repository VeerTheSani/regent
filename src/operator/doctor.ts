/**
 * src/operator/doctor.ts
 *
 * System diagnostic and dependency verifier per 14 M7.
 * Probes claude, hermes, code, Chrome, Node 24, Git, ports, and API keys.
 */

import { existsSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import spawn from "cross-spawn";

export interface DiagnosticCheck {
  name: string;
  category: "runtimes" | "workers" | "network" | "secrets";
  status: "ok" | "warn" | "fail";
  detail: string;
}

function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => {
      s.close();
      resolve(true);
    });
    s.listen(port, "127.0.0.1");
  });
}

function checkCommand(cmd: string, args: string[]): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("close", (code) => {
      resolve({ ok: code === 0, output: (stdout || stderr).trim().split("\n")[0] });
    });
    child.on("error", (err) => {
      resolve({ ok: false, output: err.message });
    });
  });
}

export async function runDiagnostics(): Promise<DiagnosticCheck[]> {
  const checks: DiagnosticCheck[] = [];

  // 1. Node 24
  const nodeVersion = process.version;
  const isNode24 = nodeVersion.startsWith("v24") || nodeVersion.startsWith("v22");
  checks.push({
    name: "Node.js Runtime",
    category: "runtimes",
    status: isNode24 ? "ok" : "warn",
    detail: `Installed: ${nodeVersion} (target: Node >=22)`,
  });

  // 2. Git
  const gitCheck = await checkCommand("git", ["--version"]);
  checks.push({
    name: "Git CLI",
    category: "runtimes",
    status: gitCheck.ok ? "ok" : "fail",
    detail: gitCheck.output || "Git CLI not detected on PATH",
  });

  // 3. Claude Code
  const claudeCheck = await checkCommand("claude", ["--version"]);
  checks.push({
    name: "Claude Code CLI",
    category: "workers",
    status: claudeCheck.ok ? "ok" : "fail",
    detail: claudeCheck.ok ? claudeCheck.output : "Claude Code CLI not found",
  });

  // 4. Hermes Agent
  const hermesCheck = await checkCommand("hermes", ["--version"]);
  checks.push({
    name: "Hermes Agent CLI",
    category: "workers",
    status: hermesCheck.ok ? "ok" : "fail",
    detail: hermesCheck.ok ? hermesCheck.output : "Hermes Agent CLI not found",
  });

  // 5. VS Code
  const codeCheck = await checkCommand("code", ["--version"]);
  checks.push({
    name: "VS Code CLI",
    category: "workers",
    status: codeCheck.ok ? "ok" : "fail",
    detail: codeCheck.ok ? codeCheck.output : "VS Code CLI not found",
  });

  // 6. Chrome Browser
  const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
  const chromeExists = existsSync(chromePath);
  checks.push({
    name: "Google Chrome",
    category: "workers",
    status: chromeExists ? "ok" : "fail",
    detail: chromeExists
      ? `Found at ${chromePath}`
      : "Chrome binary not found at standard location",
  });

  // 7. CDP Endpoint (port 9222)
  const cdpReachable = await new Promise<boolean>((resolve) => {
    const req = http.get("http://127.0.0.1:9222/json/version", (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(500, () => req.destroy());
  });
  checks.push({
    name: "Chrome CDP Remote Debugging (9222)",
    category: "network",
    status: cdpReachable ? "ok" : "warn",
    detail: cdpReachable
      ? "CDP endpoint reachable on http://127.0.0.1:9222"
      : "CDP not running; start with scripts/setup-chrome.ps1",
  });

  // 8. Bridge port 7781
  const port7781Free = await checkPortAvailable(7781);
  checks.push({
    name: "Bridge Port (7781)",
    category: "network",
    status: port7781Free ? "ok" : "warn",
    detail: port7781Free ? "Port 7781 available" : "Port 7781 currently in use",
  });

  // 9. Dashboard port 7780
  const port7780Free = await checkPortAvailable(7780);
  checks.push({
    name: "Dashboard Port (7780)",
    category: "network",
    status: port7780Free ? "ok" : "warn",
    detail: port7780Free ? "Port 7780 available" : "Port 7780 currently in use",
  });

  // 10. API Keys
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  const openRouterKey =
    process.env.OPENROUTER_API_KEY || (await import("../config/keys.js")).getOpenRouterKey();
  const hasOpenRouter = Boolean(openRouterKey);
  checks.push({
    name: "API Keys (Environment / Hermes)",
    category: "secrets",
    status: hasAnthropic || hasOpenRouter ? "ok" : "warn",
    detail: `Anthropic: ${hasAnthropic ? "set" : "not set"}, OpenRouter (Gemini): ${
      hasOpenRouter ? "configured" : "not set"
    }`,
  });

  return checks;
}
