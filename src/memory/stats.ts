/**
 * src/memory/stats.ts
 *
 * Worker statistics tracking with weekly exponential decay per 10 §3.
 */

export interface WorkerStatEntry {
  worker: string;
  kind: string;
  project: string;
  alpha: number;
  beta: number;
  runs: number;
  costSum: number;
  minutesSum: number;
  claimMismatches: number;
}

export class WorkerStatsTracker {
  private stats: Map<string, WorkerStatEntry> = new Map();

  recordRun(
    worker: string,
    kind: string,
    project: string,
    approved: boolean,
    costUsd: number,
    durationMin: number,
    claimMismatch = false,
  ): void {
    const key = `${worker}:${kind}:${project}`;
    const current = this.stats.get(key) ?? {
      worker,
      kind,
      project,
      alpha: 1.0,
      beta: 1.0,
      runs: 0,
      costSum: 0,
      minutesSum: 0,
      claimMismatches: 0,
    };

    if (approved) {
      current.alpha += 1.0;
    } else {
      current.beta += 1.0;
    }

    current.runs += 1;
    current.costSum += costUsd;
    current.minutesSum += durationMin;
    if (claimMismatch) {
      current.claimMismatches += 1;
    }

    this.stats.set(key, current);
  }

  decay(factor = 0.97): void {
    for (const stat of this.stats.values()) {
      stat.alpha = Math.max(1.0, stat.alpha * factor);
      stat.beta = Math.max(1.0, stat.beta * factor);
    }
  }

  get(worker: string, kind: string, project: string): WorkerStatEntry | undefined {
    return this.stats.get(`${worker}:${kind}:${project}`);
  }
}
