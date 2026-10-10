/**
 * test/unit/state-machines.test.ts
 *
 * Acceptance tests for M1 State Machines:
 * - Contract state machine (approve path, revise path, strategy rung climbing, regression guard)
 * - Job state machine lifecycle
 */

import { describe, expect, it } from "vitest";
import {
  createInitialContractState,
  nextRung,
  reduceContract,
} from "../../src/kernel/contract-machine.js";
import { createInitialJobState, reduceJob } from "../../src/kernel/job-machine.js";
import type { LedgerEvent } from "../../src/kernel/ledger.js";

function makeEvent(
  type: string,
  payload: Record<string, unknown> = {},
  extra: Partial<LedgerEvent> = {},
): LedgerEvent {
  return {
    seq: 1,
    ts: new Date().toISOString(),
    type,
    actor: "test",
    payload,
    ...extra,
  };
}

describe("M1: Contract State Machine", () => {
  it("executes the APPROVE path cleanly", () => {
    let state = createInitialContractState("ctr-1");
    expect(state.status).toBe("PENDING");

    state = reduceContract(state, makeEvent("contract.ready"));
    expect(state.status).toBe("READY");

    state = reduceContract(state, makeEvent("attempt.dispatched", { attempt: 1 }));
    expect(state.status).toBe("DISPATCHED");
    expect(state.attempt).toBe(1);

    state = reduceContract(state, makeEvent("attempt.started"));
    expect(state.status).toBe("RUNNING");

    state = reduceContract(state, makeEvent("attempt.finished"));
    expect(state.status).toBe("GATING");

    state = reduceContract(state, makeEvent("gate.result", { passed: true }));
    expect(state.status).toBe("CAPTURING");

    state = reduceContract(state, makeEvent("evidence.captured"));
    expect(state.status).toBe("TRIAGE");

    state = reduceContract(state, makeEvent("triage.result", { plausible: true }));
    expect(state.status).toBe("JUDGING");

    state = reduceContract(
      state,
      makeEvent("verdict.issued", {
        composite: 9.0,
        decision: "APPROVE",
        branch: "regent/ctr-1-att1",
      }),
    );
    expect(state.status).toBe("APPROVED");
    expect(state.bestAttempt?.score).toBe(9.0);
    expect(state.bestAttempt?.branch).toBe("regent/ctr-1-att1");
    expect(state.rung).toBe(1);
  });

  it("climbs the strategy ladder after 2 consecutive stalled scores", () => {
    let state = createInitialContractState("ctr-stalled");
    state = reduceContract(state, makeEvent("contract.ready"));

    // Attempt 1: score 6.0
    state = reduceContract(state, makeEvent("attempt.dispatched", { attempt: 1 }));
    state = reduceContract(
      state,
      makeEvent("verdict.issued", { composite: 6.0, decision: "REVISE" }),
    );
    expect(state.status).toBe("READY");
    expect(state.rung).toBe(1); // not enough history

    // Attempt 2: score 6.2 (delta +0.2 < 0.5)
    state = reduceContract(state, makeEvent("attempt.dispatched", { attempt: 2 }));
    state = reduceContract(
      state,
      makeEvent("verdict.issued", { composite: 6.2, decision: "REVISE" }),
    );
    expect(state.rung).toBe(1); // 2 scores, still not 3

    // Attempt 3: score 6.3 (delta +0.1 < 0.5 -> 2 consecutive stalled deltas!)
    state = reduceContract(state, makeEvent("attempt.dispatched", { attempt: 3 }));
    state = reduceContract(
      state,
      makeEvent("verdict.issued", { composite: 6.3, decision: "REVISE" }),
    );
    // Should climb from rung 1 to rung 2!
    expect(state.rung).toBe(2);

    // Attempt 4: score 7.0 (delta +0.7 >= 0.5 -> progress!)
    state = reduceContract(state, makeEvent("attempt.dispatched", { attempt: 4 }));
    state = reduceContract(
      state,
      makeEvent("verdict.issued", { composite: 7.0, decision: "REVISE" }),
    );
    // Stays at rung 2 because delta was significant
    expect(state.rung).toBe(2);
  });

  it("regression guard restores best attempt if score drops by > 1.0", () => {
    let state = createInitialContractState("ctr-regress");
    state = reduceContract(state, makeEvent("contract.ready"));

    // Attempt 1: score 8.0, branch att1
    state = reduceContract(state, makeEvent("attempt.dispatched", { attempt: 1 }));
    state = reduceContract(
      state,
      makeEvent("verdict.issued", {
        composite: 8.0,
        decision: "REVISE",
        branch: "branch-att1",
      }),
    );
    expect(state.bestAttempt?.score).toBe(8.0);
    expect(state.bestAttempt?.branch).toBe("branch-att1");
    expect(state.regressionRestored).toBe(false);

    // Attempt 2: bad attempt regresses to score 6.5 (drop of 1.5 > 1.0)
    state = reduceContract(state, makeEvent("attempt.dispatched", { attempt: 2 }));
    state = reduceContract(
      state,
      makeEvent("verdict.issued", {
        composite: 6.5,
        decision: "REVISE",
        branch: "branch-att2-broken",
      }),
    );

    // Best attempt remains attempt 1
    expect(state.bestAttempt?.n).toBe(1);
    expect(state.bestAttempt?.score).toBe(8.0);
    expect(state.bestAttempt?.branch).toBe("branch-att1");
    // Regression guard triggered!
    expect(state.regressionRestored).toBe(true);
  });
});

describe("M1: Job State Machine", () => {
  it("transitions through full job lifecycle to DONE", () => {
    let job = createInitialJobState("job-1");
    expect(job.status).toBe("RECEIVED");

    job = reduceJob(job, makeEvent("job.interpreting"));
    expect(job.status).toBe("INTERPRETING");

    job = reduceJob(job, makeEvent("brief.written", { version: 1 }));
    expect(job.status).toBe("PLANNING");

    job = reduceJob(job, makeEvent("plan.approved"));
    expect(job.status).toBe("EXECUTING");

    job = reduceJob(job, makeEvent("contracts.all_approved"));
    expect(job.status).toBe("INTEGRATING");

    job = reduceJob(job, makeEvent("integration.passed"));
    expect(job.status).toBe("ACCEPTING");

    job = reduceJob(job, makeEvent("acceptance.passed"));
    expect(job.status).toBe("DELIVERING");

    job = reduceJob(job, makeEvent("delivery.completed"));
    expect(job.status).toBe("DONE");
  });

  it("handles budget exceed pause and resume", () => {
    let job = createInitialJobState("job-2");
    job = reduceJob(job, makeEvent("plan.approved"));
    expect(job.status).toBe("EXECUTING");

    job = reduceJob(job, makeEvent("budget.exceeded", { reason: "Cap reached" }));
    expect(job.status).toBe("PAUSED");
    expect(job.previousStatus).toBe("EXECUTING");

    job = reduceJob(job, makeEvent("job.resumed"));
    expect(job.status).toBe("EXECUTING");
    expect(job.previousStatus).toBeUndefined();
  });
});
