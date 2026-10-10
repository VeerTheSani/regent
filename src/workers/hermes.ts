/**
 * src/workers/hermes.ts
 *
 * Hermes Agent worker adapter.
 * Invokes hermes chat in quiet programmatic mode (-Q) with session isolation.
 * Calibrated against P6–P9 probe fixtures.
 */

import { existsSync, mkdirSync } from "node:fs";
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

export function parseHermesOutput(
  stdout: string,
  stderr: string,
): { sessionId?: string; finalText: string } {
  let sessionId: string | undefined;

  const stderrMatch = /session_id:\s*(\S+)/.exec(stderr);
  if (stderrMatch) {
    sessionId = stderrMatch[1];
  } else {
    const stdoutMatch = /session_id:\s*(\S+)/.exec(stdout);
    if (stdoutMatch) sessionId = stdoutMatch[1];
  }

  // stdout contains the clean answer text
  const finalText = stdout.trim();
  return { sessionId, finalText };
}

export class HermesAdapter implements WorkerAdapter {
  readonly id = "hermes" as const;

  async probe(): Promise<ProbeResult> {
    try {
      const vProc = spawnTree("hermes", ["--version"]);
      let vStdout = "";
      vProc.child.stdout?.on("data", (d) => {
        vStdout += d.toString();
      });
      const vCode = await new Promise<number | null>((res) => vProc.child.on("close", res));

      const sProc = spawnTree("hermes", ["status"]);
      let sStdout = "";
      sProc.child.stdout?.on("data", (d) => {
        sStdout += d.toString();
      });
      await new Promise<number | null>((res) => sProc.child.on("close", res));

      const isPaused = sStdout.includes("PAUSED");
      return {
        available: vCode === 0 && !isPaused,
        version: vStdout.trim().split("\n")[0],
        notes: isPaused ? ["Hermes is paused (ESTOP sentinel present)"] : ["Hermes operational"],
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

    const toolsets =
      req.contract.kind === "research"
        ? ["browser", "web"]
        : req.contract.kind === "ops"
          ? ["terminal", "file", "web", "browser"]
          : undefined;

    const args = [
      "chat",
      "-Q",
      "--query-file",
      "-",
      "--in",
      req.cwd,
      "--source",
      "tool",
      "--pass-session-id",
      "--max-turns",
      String(req.limits.maxTurns ?? 50),
      "--run-budget",
      String(req.limits.maxMinutes * 60),
      "--checkpoints",
      ...(toolsets ? ["-t", toolsets.join(",")] : []),
      ...(req.resumeSessionId ? ["--resume", req.resumeSessionId] : []),
      ...(req.modelOverride ? ["-m", req.modelOverride] : []),
    ];

    const { child, killTree } = spawnTree("hermes", args, {
      cwd: req.cwd,
      env: {
        ...process.env,
        ...req.env,
        HERMES_PROFILE: "regent",
      },
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

    let fullStdout = "";
    let fullStderr = "";

    if (child.stdout) {
      new LineStream(child.stdout).on("line", (line: string) => {
        log.write(line);
        fullStdout += `${line}\n`;
        pushEvent({ type: "text", text: line });
      });
    }

    if (child.stderr) {
      new LineStream(child.stderr).on("line", (line: string) => {
        log.write(`[stderr] ${line}`);
        fullStderr += `${line}\n`;
        pushEvent({ type: "stderr", line });
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

        const { sessionId, finalText } = parseHermesOutput(fullStdout, fullStderr);

        const status = cancelledReason?.startsWith("wall-clock")
          ? "timeout"
          : cancelledReason
            ? "cancelled"
            : code === 0
              ? "completed"
              : "failed";

        resolve({
          status,
          sessionId: sessionId ?? req.resumeSessionId,
          finalText,
          costUsd: 0, // Hermes local session tracking
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
