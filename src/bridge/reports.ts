/**
 * src/bridge/reports.ts
 *
 * In-memory registry for worker reports submitted via regent_report.
 */

import type { WorkerReport } from "../workers/types.js";

export class BridgeReportsStore {
  private reports: Map<string, WorkerReport> = new Map();

  private key(jobId: string, ctrId: string, attempt: number): string {
    return `${jobId}:${ctrId}:${attempt}`;
  }

  put(ids: { job: string; ctr: string; attempt: number }, report: WorkerReport): void {
    this.reports.set(this.key(ids.job, ids.ctr, ids.attempt), report);
  }

  take(jobId: string, ctrId: string, attempt: number): WorkerReport | undefined {
    const k = this.key(jobId, ctrId, attempt);
    const rep = this.reports.get(k);
    if (rep) {
      this.reports.delete(k);
    }
    return rep;
  }
}
