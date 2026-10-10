/**
 * test/unit/projector.test.ts
 *
 * Acceptance test for M1 Projector: deterministic projection rebuilding.
 */

import { describe, expect, it } from "vitest";
import type { LedgerEvent } from "../../src/kernel/ledger.js";
import { Projector } from "../../src/kernel/projector.js";

describe("M1: Projector (Determinism & Invariance)", () => {
  it("replaying the same event list twice yields deep-equal projections", () => {
    const events: LedgerEvent[] = [
      {
        seq: 1,
        ts: "2026-10-10T10:00:00.000Z",
        type: "job.received",
        jobId: "job-p1",
        actor: "operator",
        payload: { goal: "Deterministic Test" },
      },
      {
        seq: 2,
        ts: "2026-10-10T10:01:00.000Z",
        type: "brief.written",
        jobId: "job-p1",
        actor: "director",
        payload: { version: 1 },
      },
      {
        seq: 3,
        ts: "2026-10-10T10:02:00.000Z",
        type: "contract.ready",
        jobId: "job-p1",
        ctrId: "ctr-p1",
        actor: "director",
        payload: { ctrId: "ctr-p1" },
      },
      {
        seq: 4,
        ts: "2026-10-10T10:03:00.000Z",
        type: "attempt.dispatched",
        jobId: "job-p1",
        ctrId: "ctr-p1",
        attempt: 1,
        actor: "dispatcher",
        payload: { attempt: 1 },
      },
      {
        seq: 5,
        ts: "2026-10-10T10:04:00.000Z",
        type: "attempt.started",
        jobId: "job-p1",
        ctrId: "ctr-p1",
        attempt: 1,
        actor: "worker:claude-code",
        payload: {},
      },
      {
        seq: 6,
        ts: "2026-10-10T10:05:00.000Z",
        type: "verdict.issued",
        jobId: "job-p1",
        ctrId: "ctr-p1",
        attempt: 1,
        actor: "judge",
        payload: {
          composite: 9.1,
          decision: "APPROVE",
          worker: "claude-code",
          kind: "code",
          project: "aikami",
          costUsd: 0.05,
          durationMinutes: 4.5,
        },
      },
      {
        seq: 7,
        ts: "2026-10-10T10:06:00.000Z",
        type: "budget.charged",
        jobId: "job-p1",
        ctrId: "ctr-p1",
        actor: "meter",
        payload: { usd: 0.05 },
      },
      {
        seq: 8,
        ts: "2026-10-10T10:07:00.000Z",
        type: "contracts.all_approved",
        jobId: "job-p1",
        actor: "dispatcher",
        payload: {},
      },
    ];

    const projector = new Projector();

    const projectionRun1 = projector.project(events);
    const projectionRun2 = projector.project(events);

    expect(projectionRun1).toEqual(projectionRun2);
    expect(projectionRun1.jobs["job-p1"].status).toBe("INTEGRATING");
    expect(projectionRun1.jobs["job-p1"].spentUsd).toBe(0.05);
    expect(projectionRun1.contracts["ctr-p1"].status).toBe("APPROVED");
    expect(projectionRun1.contracts["ctr-p1"].bestScore).toBe(9.1);

    const workerKey = "claude-code:code:aikami";
    expect(projectionRun1.workerStats[workerKey].alpha).toBe(2.0); // 1.0 baseline + 1
    expect(projectionRun1.workerStats[workerKey].costSum).toBe(0.05);
  });
});
