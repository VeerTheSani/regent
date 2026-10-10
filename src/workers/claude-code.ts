/**
 * src/workers/claude-code.ts
 *
 * Claude Code CLI worker adapter.
 * Uses stream-json output parsing calibrated against P1–P5 fixtures.
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AttemptLog } from "./attempt-log.js";
import { LineStream } from "./line-stream.js";
import { spawnTree } from "./spawn.js";
import type {
  ProbeResult,
  WorkRequest,
  WorkResult,
  WorkRun,
  WorkerAdapter,
  WorkerEvent,
} from "./types.js";

export interface ClaudeParsedEvent {
  type: string;
  subtype?: string;
  session_id?: string;
  total_cost_usd?: number;
  terminal_reason?: string;
  result?: string;
  message?: {
    content?: Array<{
      type: string;
      text?: string;
      name?: string;
      input?: unknown;
    }>;
  };
}

export function parseClaudeStreamLine(line: string): ClaudeParsedEvent | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith("{")) return null;
  try {
    return JSON.parse(trimmed) as ClaudeParsedEvent;
  } catch {
    return null;
  }
}

export class ClaudeCodeAdapter implements WorkerAdapter {
  readonly id = "claude-code" as const;

  async probe(): Promise<ProbeResult> {
    try {
      const { child } = spawnTree("claude", ["--version"]);
      let stdout = "";
      child.stdout?.on("data", (d) => {
        stdout += d.toString();
      });
      const code = await new Promise<number | null>((res) => child.on("close", res));
      return {
        available: code === 0,
        version: stdout.trim(),
        notes: code === 0 ? ["Claude Code CLI operational"] : ["Exit code non-zero"],
      };
    } catch (err: unknown) {
      return {
        available: false,
        notes: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  start(req: WorkRequest): WorkRun {
    if (!existsSync(req.attemptDir)) {
      mkdirSync(req.attemptDir, { recursive: true });
    }

    const bridgeCfg = join(req.attemptDir, "bridge.mcp.json");
    writeFileSync(
      bridgeCfg,
      JSON.stringify(
        {
          mcpServers: {
            regent: {
              type: "http",
              url: `${req.bridge.url}?job=${encodeURIComponent(req.jobId)}&ctr=${encodeURIComponent(
                req.contract.id,
              )}&attempt=${req.attempt}`,
              headers: { Authorization: `Bearer ${req.bridge.token}` },
            },
          },
        },
        null,
        2,
      ),
      "utf-8",
    );

    const sysPath = join(req.attemptDir, "worker-system.md");
    writeFileSync(sysPath, req.systemPrompt ?? "# Regent Worker Instructions", "utf-8");

    const sessionId = req.resumeSessionId ?? randomUUID();
    const allowedTools = req.contract.allowedTools ?? [
      "Read",
      "Grep",
      "Glob",
      "Edit",
      "Write",
      "mcp__regent__regent_ask",
      "mcp__regent__regent_report",
      "mcp__regent__regent_progress",
    ];

    const usePermissionTool = process.env.REGENT_PERMISSION_PROMPT_TOOL === "1";
    const args = [
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--dangerously-skip-permissions",
      "--allowedTools",
      allowedTools.join(","),
      "--mcp-config",
      bridgeCfg,
      ...(usePermissionTool ? ["--permission-prompt-tool", "mcp__regent__regent_permit"] : []),
      "--append-system-prompt-file",
      sysPath,
      "--max-budget-usd",
      String(req.limits.maxUsd),
      "--name",
      `regent ${req.contract.id} #${req.attempt}`,
      ...(req.resumeSessionId ? ["--resume", sessionId] : ["--session-id", sessionId]),
      ...(req.modelOverride ? ["--model", req.modelOverride] : []),
    ];

    const { child, killTree } = spawnTree("claude", args, {
      cwd: req.cwd,
      env: req.env,
      timeoutMs: req.limits.maxMinutes * 60_000,
    });

    if (child.stdin) {
      child.stdin.write(req.taskPrompt);
      child.stdin.end();
    }

    const log = new AttemptLog(join(req.attemptDir, "worker.log"));
    const eventQueue: WorkerEvent[] = [];
    let queueResolver: (() => void) | null = null;
    let isClosed = false;

    const pushEvent = (ev: WorkerEvent) => {
      eventQueue.push(ev);
      if (queueResolver) {
        queueResolver();
        queueResolver = null;
      }
    };

    let finalText = "";
    let costUsd = 0;
    let resultSubtype = "";
    let terminalReason = "";
    let discoveredSessionId = sessionId;

    if (child.stdout) {
      new LineStream(child.stdout).on("line", (line: string) => {
        log.write(line);
        const parsed = parseClaudeStreamLine(line);
        if (!parsed) return;

        switch (parsed.type) {
          case "system":
            if (parsed.subtype === "init") {
              if (parsed.session_id) discoveredSessionId = parsed.session_id;
              pushEvent({
                type: "started",
                sessionId: discoveredSessionId,
                pid: child.pid,
              });
            }
            break;
          case "assistant":
            for (const block of parsed.message?.content ?? []) {
              if (block.type === "text" && block.text) {
                pushEvent({ type: "text", text: block.text });
              }
              if (block.type === "tool_use" && block.name) {
                pushEvent({
                  type: "tool_call",
                  name: block.name,
                  input: block.input,
                });
              }
            }
            break;
          case "result":
            finalText = parsed.result ?? "";
            costUsd = parsed.total_cost_usd ?? 0;
            resultSubtype = parsed.subtype ?? "";
            terminalReason = parsed.terminal_reason ?? "";
            if (parsed.session_id) discoveredSessionId = parsed.session_id;
            pushEvent({ type: "cost", usd: costUsd });
            break;
        }
      });
    }

    if (child.stderr) {
      new LineStream(child.stderr).on("line", (l: string) => {
        log.write(`[stderr] ${l}`);
        pushEvent({ type: "stderr", line: l });
      });
    }

    const started = Date.now();
    let cancelledReason: string | undefined;

    const cancel = async (reason: string) => {
      cancelledReason = reason;
      await killTree("SIGKILL");
    };

    const resultPromise = new Promise<WorkResult>((resolve) => {
      child.on("close", async (code) => {
        await log.close();
        isClosed = true;
        if (queueResolver) {
          queueResolver();
          queueResolver = null;
        }

        const isBudget = resultSubtype.includes("budget") || terminalReason.includes("budget");
        const status = cancelledReason?.startsWith("wall-clock")
          ? "timeout"
          : cancelledReason
            ? "cancelled"
            : isBudget
              ? "budget_exceeded"
              : code === 0
                ? "completed"
                : "failed";

        resolve({
          status,
          sessionId: discoveredSessionId,
          finalText,
          costUsd,
          durationMs: Date.now() - started,
          exitCode: code,
          rawLogPath: log.path,
        });
      });
    });

    const events: AsyncIterable<WorkerEvent> = {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            while (eventQueue.length === 0) {
              if (isClosed) return { done: true, value: undefined };
              await new Promise<void>((r) => {
                queueResolver = r;
              });
            }
            const item = eventQueue.shift();
            return item ? { done: false, value: item } : { done: true, value: undefined };
          },
        };
      },
    };

    return {
      events,
      result: resultPromise,
      steer: async () => false,
      cancel,
    };
  }
}
