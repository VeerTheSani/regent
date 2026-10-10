/**
 * src/dispatcher/select-worker.ts
 *
 * Worker selection scoring and Thompson sampling per 04 §3.1, 05 §1, 10 §3.
 */

import type { ContractKind } from "../schemas/contract.js";
import type { WorkerId } from "../workers/types.js";

// Prior capability matrix from 05 §1
export const CAPABILITY_MATRIX: Record<ContractKind, Partial<Record<WorkerId, number>>> = {
  code: {
    "claude-code": 0.95,
    hermes: 0.75,
    vscode: 0.7,
    chatbot: 0.1,
    shell: 0.5,
  },
  ui: { "claude-code": 0.9, hermes: 0.7, vscode: 0.7, chatbot: 0.1 },
  test: { "claude-code": 0.95, hermes: 0.75, vscode: 0.7, chatbot: 0.1 },
  refactor: { "claude-code": 0.95, hermes: 0.75, vscode: 0.7, chatbot: 0.1 },
  integration: { "claude-code": 0.9, hermes: 0.6, vscode: 0.4, shell: 0.8 },
  merge: { "claude-code": 0.9, hermes: 0.6, vscode: 0.4, shell: 0.8 },
  research: { hermes: 0.9, chatbot: 0.7, "claude-code": 0.6, browser: 0.5 },
  document: { chatbot: 0.85, "claude-code": 0.7, hermes: 0.7, vscode: 0.3 },
  browser_task: { hermes: 0.85, browser: 0.7, "claude-code": 0.5 },
  data: { "claude-code": 0.8, hermes: 0.7, chatbot: 0.6 },
  ops: { hermes: 0.9, shell: 0.8, "claude-code": 0.6 },
  review: { chatbot: 0.9, "claude-code": 0.6, hermes: 0.6 },
};

export interface WorkerStatRecord {
  alpha: number;
  beta: number;
  runs: number;
  avgCostUsd: number;
}

/**
 * Standard Beta distribution sampler using Johnk's generator algorithm.
 */
export function sampleBeta(alpha: number, beta: number): number {
  if (alpha <= 0 || beta <= 0) return 0.5;
  while (true) {
    const u1 = Math.random();
    const u2 = Math.random();
    if (u1 === 0 || u2 === 0) continue;
    const x = u1 ** (1 / alpha);
    const y = u2 ** (1 / beta);
    if (x + y <= 1) {
      return x / (x + y);
    }
  }
}

export interface WorkerSelectionInput {
  kind: ContractKind;
  workerPreferences: WorkerId[];
  maxUsd: number;
  availableWorkers: WorkerId[];
  activeWorkerCounts: Record<WorkerId, number>;
  workerConcurrencyCaps: Record<WorkerId, number>;
  stats?: Record<string, WorkerStatRecord>;
}

export function selectWorker(input: WorkerSelectionInput): {
  worker: WorkerId;
  score: number;
  breakdown: Record<string, number>;
} {
  let bestWorker: WorkerId = input.workerPreferences[0] ?? "claude-code";
  let maxScore = Number.NEGATIVE_INFINITY;
  let bestBreakdown: Record<string, number> = {};

  for (const worker of input.availableWorkers) {
    // 1. Availability and concurrency cap check
    const active = input.activeWorkerCounts[worker] ?? 0;
    const cap = input.workerConcurrencyCaps[worker] ?? 2;
    if (active >= cap) continue;

    // 2. Capability fit
    const capability = CAPABILITY_MATRIX[input.kind]?.[worker] ?? 0.3;

    // 3. Learned success rate (Thompson sampling if runs >= 5, else posterior mean)
    const statKey = `${worker}:${input.kind}`;
    const stat = input.stats?.[statKey] ?? {
      alpha: 1,
      beta: 1,
      runs: 0,
      avgCostUsd: 0.05,
    };
    const successFactor =
      stat.runs >= 5 ? sampleBeta(stat.alpha, stat.beta) : stat.alpha / (stat.alpha + stat.beta);

    const learnedScore = 0.5 + 0.5 * successFactor;

    // 4. Expected cost factor
    const costRatio = 1 + stat.avgCostUsd / Math.max(0.1, input.maxUsd);

    // 5. Worker preference bonus
    const prefRank = input.workerPreferences.indexOf(worker);
    const prefBonus = prefRank !== -1 ? Math.max(0, 0.3 - prefRank * 0.1) : 0;

    // Total score
    const score = (capability * learnedScore) / costRatio + prefBonus;

    if (score > maxScore) {
      maxScore = score;
      bestWorker = worker;
      bestBreakdown = {
        capability,
        learnedScore,
        costRatio,
        prefBonus,
        totalScore: score,
      };
    }
  }

  return { worker: bestWorker, score: maxScore, breakdown: bestBreakdown };
}
