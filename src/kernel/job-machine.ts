/**
 * src/kernel/job-machine.ts
 *
 * Pure reducer for the Job state machine per 03 §1.
 */

import type { LedgerEvent } from "./ledger.js";

export type JobStatus =
  | "RECEIVED"
  | "INTERPRETING"
  | "PLANNING"
  | "EXECUTING"
  | "INTEGRATING"
  | "ACCEPTING"
  | "DELIVERING"
  | "DONE"
  | "AWAITING_OPERATOR"
  | "PAUSED"
  | "STOPPING"
  | "STOPPED"
  | "FAILED";

export interface JobState {
  id: string;
  status: JobStatus;
  previousStatus?: JobStatus;
  spentUsd: number;
  briefVersion: number;
  startedAt: string;
  updatedAt: string;
}

export function createInitialJobState(id: string, startedAt?: string): JobState {
  const now = startedAt ?? new Date().toISOString();
  return {
    id,
    status: "RECEIVED",
    spentUsd: 0,
    briefVersion: 1,
    startedAt: now,
    updatedAt: now,
  };
}

export function reduceJob(s: JobState, e: LedgerEvent): JobState {
  const updatedAt = e.ts ?? new Date().toISOString();

  switch (e.type) {
    case "job.received":
      return { ...s, status: "RECEIVED", updatedAt };

    case "job.interpreting":
      return { ...s, status: "INTERPRETING", updatedAt };

    case "brief.written":
      return {
        ...s,
        status: "PLANNING",
        briefVersion: (e.payload.version as number) ?? s.briefVersion,
        updatedAt,
      };

    case "brief.divergent":
      return { ...s, status: "AWAITING_OPERATOR", updatedAt };

    case "operator.answered":
      return s.status === "AWAITING_OPERATOR"
        ? { ...s, status: "INTERPRETING", updatedAt }
        : { ...s, updatedAt };

    case "plan.approved":
      return { ...s, status: "EXECUTING", updatedAt };

    case "contracts.all_approved":
      return { ...s, status: "INTEGRATING", updatedAt };

    case "integration.passed":
      return { ...s, status: "ACCEPTING", updatedAt };

    case "integration.conflict":
      return { ...s, status: "EXECUTING", updatedAt };

    case "acceptance.passed":
      return { ...s, status: "DELIVERING", updatedAt };

    case "acceptance.failed":
      return { ...s, status: "EXECUTING", updatedAt };

    case "delivery.completed":
      return { ...s, status: "DONE", updatedAt };

    case "budget.exceeded":
      return {
        ...s,
        previousStatus: s.status,
        status: "PAUSED",
        updatedAt,
      };

    case "job.resumed":
      return {
        ...s,
        status: s.previousStatus ?? "EXECUTING",
        previousStatus: undefined,
        updatedAt,
      };

    case "job.stop_requested":
      return { ...s, status: "STOPPING", updatedAt };

    case "job.stopped":
      return { ...s, status: "STOPPED", updatedAt };

    case "job.failed":
      return { ...s, status: "FAILED", updatedAt };

    case "budget.charged": {
      const usd = (e.payload.usd as number) ?? 0;
      return { ...s, spentUsd: s.spentUsd + usd, updatedAt };
    }

    default:
      return s;
  }
}
