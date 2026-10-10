/**
 * src/kernel/projector.ts
 *
 * Replays ledger events into read-optimized projections per 12 §1.
 * Pure and deterministic: replaying the same event stream yields deep-equal projections.
 */

import {
  type ContractState,
  createInitialContractState,
  reduceContract,
} from "./contract-machine.js";
import { type JobState, createInitialJobState, reduceJob } from "./job-machine.js";
import type { LedgerEvent } from "./ledger.js";

export interface JobProjection {
  jobId: string;
  status: string;
  spentUsd: number;
  started: string;
  updated: string;
  briefVersion: number;
}

export interface ContractProjection {
  ctrId: string;
  jobId: string;
  status: string;
  attempt: number;
  rung: number;
  bestScore: number;
  spentUsd: number;
}

export interface WorkerStatProjection {
  worker: string;
  kind: string;
  project: string;
  alpha: number;
  beta: number;
  costSum: number;
  costN: number;
  minutesSum: number;
  claimMismatches: number;
}

export interface ProjectionsState {
  jobs: Record<string, JobProjection>;
  contracts: Record<string, ContractProjection>;
  workerStats: Record<string, WorkerStatProjection>;
}

export class Projector {
  project(events: LedgerEvent[]): ProjectionsState {
    const jobs: Record<string, JobState> = {};
    const contracts: Record<string, ContractState> = {};
    const workerStats: Record<string, WorkerStatProjection> = {};

    for (const ev of events) {
      // 1. Job projection
      if (ev.jobId) {
        if (!jobs[ev.jobId]) {
          jobs[ev.jobId] = createInitialJobState(ev.jobId, ev.ts);
        }
        jobs[ev.jobId] = reduceJob(jobs[ev.jobId], ev);
      }

      // 2. Contract projection
      const ctrId = ev.ctrId ?? (ev.payload?.ctrId as string | undefined);
      if (ctrId) {
        if (!contracts[ctrId]) {
          contracts[ctrId] = createInitialContractState(ctrId);
        }
        contracts[ctrId] = reduceContract(contracts[ctrId], ev);
      }

      // 3. Worker stats projection
      if (ev.type === "verdict.issued") {
        const worker = (ev.payload.worker as string) ?? "unknown";
        const kind = (ev.payload.kind as string) ?? "code";
        const project = (ev.payload.project as string) ?? "default";
        const key = `${worker}:${kind}:${project}`;

        if (!workerStats[key]) {
          workerStats[key] = {
            worker,
            kind,
            project,
            alpha: 1.0,
            beta: 1.0,
            costSum: 0,
            costN: 0,
            minutesSum: 0,
            claimMismatches: 0,
          };
        }

        const stat = workerStats[key];
        const approved = ev.payload.decision === "APPROVE";
        if (approved) {
          stat.alpha += 1;
        } else {
          stat.beta += 1;
        }

        if (typeof ev.payload.costUsd === "number") {
          stat.costSum += ev.payload.costUsd;
          stat.costN += 1;
        }
        if (typeof ev.payload.durationMinutes === "number") {
          stat.minutesSum += ev.payload.durationMinutes;
        }
        if (ev.payload.claimMismatch) {
          stat.claimMismatches += 1;
        }
      }
    }

    const jobsView: Record<string, JobProjection> = {};
    for (const [id, j] of Object.entries(jobs)) {
      jobsView[id] = {
        jobId: j.id,
        status: j.status,
        spentUsd: j.spentUsd,
        started: j.startedAt,
        updated: j.updatedAt,
        briefVersion: j.briefVersion,
      };
    }

    const contractsView: Record<string, ContractProjection> = {};
    for (const [id, c] of Object.entries(contracts)) {
      const jobId = events.find((e) => (e.ctrId ?? e.payload?.ctrId) === id)?.jobId ?? "";
      contractsView[id] = {
        ctrId: c.id,
        jobId,
        status: c.status,
        attempt: c.attempt,
        rung: c.rung,
        bestScore: c.bestAttempt?.score ?? 0,
        spentUsd: c.spentUsd,
      };
    }

    return {
      jobs: jobsView,
      contracts: contractsView,
      workerStats,
    };
  }
}
