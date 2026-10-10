/**
 * src/dispatcher/supervise.ts
 *
 * Supervises in-flight worker execution: wall-clock, stall detection, budget kill, interruption handling.
 */

import type { Ledger } from "../kernel/ledger.js";
import type { WorkResult, WorkRun } from "../workers/types.js";

export interface SuperviseOptions {
  jobId: string;
  ctrId: string;
  attempt: number;
  maxMinutes: number;
  stallMinutes?: number;
  maxUsd: number;
}

export class RunSupervisor {
  constructor(private readonly ledger: Ledger) {}

  async supervise(run: WorkRun, options: SuperviseOptions): Promise<WorkResult> {
    const started = Date.now();
    let lastActivityTime = Date.now();
    let accumulatedUsd = 0;
    const stallLimitMs = (options.stallMinutes ?? 8) * 60_000;
    const wallClockLimitMs = options.maxMinutes * 60_000;

    // Background watcher for events
    (async () => {
      try {
        for await (const ev of run.events) {
          lastActivityTime = Date.now();
          if (ev.type === "cost") {
            accumulatedUsd = ev.usd;
            if (accumulatedUsd > options.maxUsd) {
              await run.cancel("budget_exceeded");
              this.ledger.append({
                type: "attempt.budget_kill",
                jobId: options.jobId,
                ctrId: options.ctrId,
                attempt: options.attempt,
                actor: "supervisor",
                payload: { spentUsd: accumulatedUsd, limit: options.maxUsd },
              });
              break;
            }
          }
        }
      } catch {}
    })();

    // Polling supervisor timer
    const interval = setInterval(async () => {
      const now = Date.now();

      // 1. Wall-clock limit check
      if (now - started > wallClockLimitMs) {
        clearInterval(interval);
        await run.cancel("wall-clock limit exceeded");
        return;
      }

      // 2. Stall limit check
      if (now - lastActivityTime > stallLimitMs) {
        // Attempt to steer once
        const steered = await run.steer(
          "Progress check: wrap up current edits and report findings.",
        );
        if (!steered || now - lastActivityTime > stallLimitMs + 60_000) {
          clearInterval(interval);
          await run.cancel("stall limit exceeded");
        }
      }
    }, 5000);

    try {
      const result = await run.result;
      clearInterval(interval);
      return result;
    } finally {
      clearInterval(interval);
    }
  }
}
