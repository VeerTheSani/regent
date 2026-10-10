/**
 * src/workers/vscode.ts
 *
 * VS Code Agent Mode worker adapter.
 * Launches interactive GUI agent in a designated VS Code profile.
 * Calibrated against P10–P11 probe fixtures.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AttemptLog } from "./attempt-log.js";
import { spawnTree } from "./spawn.js";
import type {
  ProbeResult,
  WorkRequest,
  WorkResult,
  WorkRun,
  WorkerAdapter,
  WorkerEvent,
} from "./types.js";

export class VSCodeAdapter implements WorkerAdapter {
  readonly id = "vscode" as const;

  async probe(): Promise<ProbeResult> {
    try {
      const { child } = spawnTree("code", ["--version"]);
      let stdout = "";
      child.stdout?.on("data", (d) => {
        stdout += d.toString();
      });
      const code = await new Promise<number | null>((res) => child.on("close", res));
      return {
        available: code === 0,
        version: stdout.trim().split("\n")[0],
        notes: code === 0 ? ["VS Code CLI operational"] : ["Exit code non-zero"],
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

    const contractFile = join(req.attemptDir, "CONTRACT.md");
    writeFileSync(
      contractFile,
      `# Contract: ${req.contract.title}\n\n${req.taskPrompt}\n`,
      "utf-8",
    );

    const args = [
      "chat",
      "-m",
      "agent",
      "-n",
      "--profile",
      "Regent",
      "--add-file",
      contractFile,
      "-",
    ];

    const { child, killTree } = spawnTree("code", args, {
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

        const status = cancelledReason?.startsWith("wall-clock")
          ? "timeout"
          : cancelledReason
            ? "cancelled"
            : code === 0
              ? "completed"
              : "failed";

        resolve({
          status,
          sessionId: req.resumeSessionId,
          finalText: `VS Code agent execution launched in window (exit code: ${code})`,
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
