/**
 * src/workers/shell.ts
 *
 * Direct shell execution worker adapter for deterministic tasks and verification gates.
 */

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

export class ShellWorkerAdapter implements WorkerAdapter {
  readonly id = "shell" as const;

  async probe(): Promise<ProbeResult> {
    return {
      available: true,
      notes: ["Direct shell worker operational"],
    };
  }

  start(req: WorkRequest): WorkRun {
    if (!existsSync(req.attemptDir)) {
      mkdirSync(req.attemptDir, { recursive: true });
    }

    const log = new AttemptLog(join(req.attemptDir, "worker.log"));
    const started = Date.now();

    // On Windows, use Git Bash or cmd
    const isWindows = process.platform === "win32";
    const shellCmd = isWindows ? "bash.exe" : "bash";
    const shellArgs = ["-c", req.taskPrompt];

    const { child, killTree } = spawnTree(shellCmd, shellArgs, {
      cwd: req.cwd,
      env: req.env,
      timeoutMs: req.limits.maxMinutes * 60_000,
    });

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

    let outputText = "";

    if (child.stdout) {
      new LineStream(child.stdout).on("line", (line: string) => {
        log.write(line);
        outputText += `${line}\n`;
        pushEvent({ type: "text", text: line });
      });
    }

    if (child.stderr) {
      new LineStream(child.stderr).on("line", (line: string) => {
        log.write(`[stderr] ${line}`);
        pushEvent({ type: "stderr", line });
      });
    }

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

        const status = cancelledReason?.startsWith("wall-clock")
          ? "timeout"
          : cancelledReason
            ? "cancelled"
            : code === 0
              ? "completed"
              : "failed";

        resolve({
          status,
          finalText: outputText.trim(),
          costUsd: 0,
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
