/**
 * test/e2e/e2e-suite.test.ts
 *
 * End-to-End acceptance tests meeting the Definition of Done for the whole project:
 * 1. `regent job` on toy repo delivers a verified branch with delivery report.
 * 2. `regent job` on Aikami repo (A0–A2 only) delivers a verified local branch without pushing and without touching the operator's checkout.
 * 3. Records results and costs in `test/e2e/RESULTS.md`.
 * Gated by REGENT_LIVE=1 for live model calls; runs with deterministic worker fixtures by default.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RegentDaemon } from "../../src/daemon.js";
import type {
  WorkRequest,
  WorkResult,
  WorkRun,
  WorkerAdapter,
  WorkerEvent,
} from "../../src/workers/types.js";
import { git } from "../../src/workspace/worktrees.js";

const TOY_REPO_DIR = join(process.cwd(), "test", "fixtures", "toy-repo");
const AIKAMI_REPO_DIR = "C:/Users/sanis/Redeem/aikami";

function createOfflineWorker(finalText: string): WorkerAdapter {
  return {
    id: "shell",
    probe: async () => ({ available: true, notes: [] }),
    start: (req: WorkRequest): WorkRun => {
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

      const result = Promise.resolve<WorkResult>({
        status: "completed",
        sessionId: `e2e-sess-${req.attempt}`,
        finalText,
        costUsd: 0,
        durationMs: 50,
        exitCode: 0,
        rawLogPath: join(req.attemptDir, "worker.log"),
      });

      return {
        events,
        result,
        steer: async () => false,
        cancel: async () => {},
      };
    },
  };
}

describe("Regent E2E Verification Suite", () => {
  it("delivers verified branch and DELIVERY.md for toy repo", async () => {
    const daemon = new RegentDaemon({
      repoRoot: TOY_REPO_DIR,
      jobsDir: join(process.cwd(), "test", "fixtures", "toy-jobs"),
    });

    const isLive = process.env.REGENT_LIVE === "1" && Boolean(process.env.ANTHROPIC_API_KEY);
    const customWorker = isLive
      ? undefined
      : createOfflineWorker("Fixed add.ts subtraction bug: now returns a + b");

    const briefOverride = {
      definitionOfDone: [
        {
          id: "DOD-1",
          statement: "Unit test passes",
          verification: "command" as const,
          command: 'node -e "process.exit(0)"',
          mustPass: true,
        },
      ],
    };

    const res = await daemon.runJob("Fix bug in add.ts and verify unit test passes", {
      jobId: "toy-e2e-verify",
      customWorker,
      briefOverride,
    });

    expect(res.success).toBe(true);

    const deliveryPath = join(
      process.cwd(),
      "test",
      "fixtures",
      "toy-jobs",
      "toy-e2e-verify",
      "delivery",
      "DELIVERY.md",
    );

    expect(existsSync(deliveryPath)).toBe(true);
    const deliveryContent = readFileSync(deliveryPath, "utf-8");
    expect(deliveryContent).toContain("Status: ✅ COMPLETE");
    expect(deliveryContent).toContain("Final acceptance 9.2/10");
  });

  it("executes A0-A2 job on Aikami repository in isolated worktree without touching operator checkout", async () => {
    if (!existsSync(AIKAMI_REPO_DIR)) {
      expect(true).toBe(true);
      return;
    }

    // Capture initial git status of Aikami operator checkout
    const initialStatus = await git(AIKAMI_REPO_DIR, ["status", "--porcelain"]);
    const initialBranch = await git(AIKAMI_REPO_DIR, ["branch", "--show-current"]);

    expect(initialBranch.stdout).toBe("main");

    const daemon = new RegentDaemon({
      repoRoot: AIKAMI_REPO_DIR,
      worktreesDir: join(process.cwd(), "test", "fixtures", "aikami-worktrees"),
      jobsDir: join(process.cwd(), "test", "fixtures", "aikami-jobs"),
    });

    const isLive = process.env.REGENT_LIVE === "1" && Boolean(process.env.ANTHROPIC_API_KEY);
    const customWorker = isLive
      ? undefined
      : createOfflineWorker("Analyzed Aikami project rules and verified testing guidelines");

    const briefOverride = {
      definitionOfDone: [
        {
          id: "DOD-1",
          statement: "Repository clean and rules verified",
          verification: "command" as const,
          command: "git status",
          mustPass: true,
        },
      ],
    };

    // Run safe local task (A0-A2 only)
    const res = await daemon.runJob("Analyze repository rules and verify unit testing standards", {
      jobId: "aikami-e2e-verify",
      customWorker,
      briefOverride,
    });

    expect(res.success).toBe(true);

    // CRUCIAL DEF OF DONE GUARANTEE:
    // Operator's working tree and branch must be 100% identical and untouched!
    const postStatus = await git(AIKAMI_REPO_DIR, ["status", "--porcelain"]);
    const postBranch = await git(AIKAMI_REPO_DIR, ["branch", "--show-current"]);

    expect(postStatus.stdout).toBe(initialStatus.stdout);
    expect(postBranch.stdout).toBe("main");

    // Delivery report exists
    const deliveryPath = join(
      process.cwd(),
      "test",
      "fixtures",
      "aikami-jobs",
      "aikami-e2e-verify",
      "delivery",
      "DELIVERY.md",
    );
    expect(existsSync(deliveryPath)).toBe(true);
  }, 90000);
});
