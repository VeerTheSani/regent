/**
 * src/kernel/contract-machine.ts
 *
 * Pure reducer for the Contract state machine per 03 §3, §5, §6.
 */

import type { LedgerEvent } from "./ledger.js";

export type ContractStatus =
  | "PENDING"
  | "READY"
  | "DISPATCHED"
  | "RUNNING"
  | "GATING"
  | "CAPTURING"
  | "TRIAGE"
  | "JUDGING"
  | "APPROVED"
  | "BLOCKED_ON_GRANT"
  | "ABANDONED"
  | "FAILED"
  | "CANCELLED"
  | "ESCALATED";

export interface BestAttemptInfo {
  n: number;
  score: number;
  branch?: string;
}

export interface ContractState {
  id: string;
  status: ContractStatus;
  attempt: number;
  rung: number; // strategy ladder position, 1..7
  bestAttempt?: BestAttemptInfo;
  scoreHistory: number[];
  spentUsd: number;
  regressionRestored?: boolean;
}

export function nextRung(rung: number, history: number[]): number {
  if (history.length < 3) return rung;
  const [a, b, c] = history.slice(-3);
  const stalled = b - a < 0.5 && c - b < 0.5;
  return stalled ? Math.min(rung + 1, 7) : rung;
}

export function createInitialContractState(id: string): ContractState {
  return {
    id,
    status: "PENDING",
    attempt: 0,
    rung: 1,
    scoreHistory: [],
    spentUsd: 0,
    regressionRestored: false,
  };
}

export function reduceContract(s: ContractState, e: LedgerEvent): ContractState {
  switch (e.type) {
    case "contract.ready":
      return { ...s, status: "READY" };

    case "attempt.dispatched":
      return {
        ...s,
        status: "DISPATCHED",
        attempt: (e.payload.attempt as number) ?? e.attempt ?? s.attempt + 1,
      };

    case "attempt.started":
      return { ...s, status: "RUNNING" };

    case "attempt.finished":
      return { ...s, status: "GATING" };

    case "gate.result": {
      const passed = Boolean(e.payload.passed);
      return passed ? { ...s, status: "CAPTURING" } : { ...s, status: "READY" };
    }

    case "evidence.captured":
      return { ...s, status: "TRIAGE" };

    case "triage.result": {
      const plausible = Boolean(e.payload.plausible);
      return plausible ? { ...s, status: "JUDGING" } : { ...s, status: "READY" };
    }

    case "verdict.issued": {
      const composite = (e.payload.composite as number) ?? 0;
      const decision = (e.payload.decision as string) ?? "REVISE";
      const branch = (e.payload.branch as string) ?? undefined;
      const attemptNum = (e.payload.attempt as number) ?? e.attempt ?? s.attempt;

      const scoreHistory = [...s.scoreHistory, composite];

      // Regression guard: if score drops by > 1.0 from best attempt
      let regressionRestored = false;
      if (s.bestAttempt && s.bestAttempt.score - composite > 1.0) {
        regressionRestored = true;
      }

      const best =
        !s.bestAttempt || composite > s.bestAttempt.score
          ? { n: attemptNum, score: composite, branch }
          : s.bestAttempt;

      if (decision === "APPROVE") {
        return {
          ...s,
          status: "APPROVED",
          scoreHistory,
          bestAttempt: best,
          regressionRestored,
        };
      }

      if (decision === "ESCALATE") {
        return {
          ...s,
          status: "ESCALATED",
          scoreHistory,
          bestAttempt: best,
          regressionRestored,
        };
      }

      return {
        ...s,
        status: "READY",
        scoreHistory,
        bestAttempt: best,
        rung: nextRung(s.rung, scoreHistory),
        regressionRestored,
      };
    }

    case "permission.decided": {
      const decision = e.payload.decision as string;
      return decision === "needs_grant" ? { ...s, status: "BLOCKED_ON_GRANT" } : s;
    }

    case "grant.issued":
    case "grant.added":
      return s.status === "BLOCKED_ON_GRANT" ? { ...s, status: "READY" } : s;

    case "budget.charged": {
      const usd = (e.payload.usd as number) ?? 0;
      return { ...s, spentUsd: s.spentUsd + usd };
    }

    case "contract.abandoned":
      return { ...s, status: "ABANDONED" };

    case "contract.escalated":
      return { ...s, status: "ESCALATED" };

    case "contract.cancelled":
      return { ...s, status: "CANCELLED" };

    default:
      return s;
  }
}
