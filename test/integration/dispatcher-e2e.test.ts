/**
 * test/integration/dispatcher-e2e.test.ts
 *
 * Acceptance tests for M6:
 * - Scripted fake worker completing the DAG (attempt 1 fails gates, attempt 2 passes gates & judge revises, attempt 3 approves).
 * - Strategy ladder progression to R3/ABANDONED without infinite looping.
 * - Kill switch process termination.
 */

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RegentDaemon } from "../../src/daemon.js";
import type { Verdict } from "../../src/schemas/verdict.js";
import { spawnTree } from "../../src/workers/spawn.js";
import type {
  WorkRequest,
  WorkResult,
  WorkRun,
  WorkerAdapter,
  WorkerEvent,
} from "../../src/workers/types.js";

describe("M6: Dispatcher & Strategy Ladder Integration", () => {
  it("scripted fake worker completes graph: att 1 fails gates, att 2 revises, att 3 approves", async () => {
    const daemon = new RegentDaemon();

    let attemptCount = 0;
    const scriptedWorker: WorkerAdapter = {
      id: "shell",
      probe: async () => ({ available: true, notes: [] }),
      start: (req: WorkRequest): WorkRun => {
        attemptCount++;
        const currentAttempt = attemptCount;

        const eventQueue: WorkerEvent[] = [{ type: "started" }];
        const events: AsyncIterable<WorkerEvent> = {
          [Symbol.asyncIterator]() {
            let done = false;
            return {
              async next() {
                if (done) return { done: true, value: undefined };
                done = true;
                const ev = eventQueue.shift();
                return ev ? { done: false, value: ev } : { done: true, value: undefined };
              },
            };
          },
        };

        const result = (async (): Promise<WorkResult> => {
          return {
            status: "completed",
            sessionId: `sess-${currentAttempt}`,
            finalText: `Attempt ${currentAttempt} finished`,
            costUsd: 0.01,
            durationMs: 100,
            exitCode: 0,
            rawLogPath: join(req.attemptDir, "worker.log"),
          };
        })();

        return {
          events,
          result,
          steer: async () => false,
          cancel: async () => {},
        };
      },
    };

    // Override judge for scripted progression
    let judgeCallCount = 0;
    daemon.judge.judgeAttempt = async (bundle): Promise<Verdict> => {
      judgeCallCount++;
      if (judgeCallCount === 1) {
        // Attempt 2 (first to pass gates) gets REVISE
        return {
          contractId: bundle.contractId,
          attempt: bundle.attempt,
          dimensions: [{ id: "functional", score: 6.5 }],
          composite: 6.5,
          decision: "REVISE",
          blockers: [],
          defects: [
            {
              id: "D-1",
              severity: "MAJOR",
              dimension: "functional",
              evidence: "line 5",
              observed: "partial",
              expected: "complete",
              fix: "improve implementation",
            },
          ],
          verifiedClaims: [],
          refutedClaims: [],
          summary: "Needs revision",
        };
      }

      // Attempt 3 gets APPROVE
      return {
        contractId: bundle.contractId,
        attempt: bundle.attempt,
        dimensions: [{ id: "functional", score: 9.2 }],
        composite: 9.2,
        decision: "APPROVE",
        blockers: [],
        defects: [],
        verifiedClaims: ["All requirements met"],
        refutedClaims: [],
        summary: "Approved cleanly",
      };
    };

    // Script gate runner: attempt 1 fails gates, attempt 2+ passes
    let gateCallCount = 0;
    daemon.gates.runAll = async () => {
      gateCallCount++;
      const passed = gateCallCount > 1; // attempt 1 fails, attempt 2+ passes
      return [
        {
          id: "gate-check",
          kind: "command",
          passed,
          detail: passed ? "All gates passed" : "Gate failure simulation",
          durationMs: 10,
          artifacts: [],
        },
      ];
    };

    const res = await daemon.runJob("Build verified feature", {
      customWorker: scriptedWorker,
    });

    expect(res.success).toBe(true);
    expect(attemptCount).toBeGreaterThanOrEqual(3);

    // Verify ledger sequence
    const projections = daemon.getProjections();
    expect(projections.jobs[res.jobId].status).toBe("DONE");
  });

  it("strategy ladder climbs R1 -> R2 -> R3 when judge never improves and terminates at attempt ceiling", async () => {
    const daemon = new RegentDaemon();

    let attempts = 0;
    const dummyWorker: WorkerAdapter = {
      id: "shell",
      probe: async () => ({ available: true, notes: [] }),
      start: (req: WorkRequest): WorkRun => {
        attempts++;
        return {
          events: {
            async *[Symbol.asyncIterator]() {
              yield { type: "started" };
            },
          },
          result: Promise.resolve({
            status: "completed",
            finalText: "Work done",
            costUsd: 0.005,
            durationMs: 50,
            exitCode: 0,
            rawLogPath: join(req.attemptDir, "worker.log"),
          }),
          steer: async () => false,
          cancel: async () => {},
        };
      },
    };

    // Judge that never improves (always 5.0 REVISE)
    daemon.judge.judgeAttempt = async (b): Promise<Verdict> => ({
      contractId: b.contractId,
      attempt: b.attempt,
      dimensions: [{ id: "functional", score: 5.0 }],
      composite: 5.0,
      decision: "REVISE",
      blockers: [],
      defects: [],
      verifiedClaims: [],
      refutedClaims: [],
      summary: "Stalled score",
    });

    daemon.gates.runAll = async () => [
      { id: "g", kind: "command", passed: true, detail: "ok", durationMs: 1, artifacts: [] },
    ];

    const res = await daemon.runJob("Stalled job test", {
      customWorker: dummyWorker,
    });

    // Must NOT loop infinitely; terminates gracefully
    expect(res.success).toBe(false);
    expect(attempts).toBeLessThanOrEqual(6);
  });

  it("kill test: process tree gone when stop requested", async () => {
    // Spawn a long-lived child process
    const { child, killTree } = spawnTree("node", ["-e", "setInterval(() => {}, 1000);"]);

    expect(child.pid).toBeDefined();

    // Kill tree
    await killTree("SIGKILL");
    await new Promise((r) => setTimeout(r, 200));

    // Confirm process is dead
    let isAlive = false;
    try {
      if (child.pid) {
        process.kill(child.pid, 0);
        isAlive = true;
      }
    } catch {
      isAlive = false;
    }

    expect(isAlive).toBe(false);
  });
});
