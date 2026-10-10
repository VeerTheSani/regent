/**
 * src/operator/cli-commands.ts
 *
 * Handler implementations for CLI commands (regent job, status, stop, watch) per 11 §1.
 */

import { RegentDaemon } from "../daemon.js";
import { KillSwitch } from "../kernel/kill-switch.js";

export async function handleJobCommand(goal: string): Promise<void> {
  console.log(`[regent] Submitting job: "${goal}"`);
  const daemon = new RegentDaemon();
  const res = await daemon.runJob(goal);
  if (res.success) {
    console.log(
      `[regent] Job ${res.jobId} completed successfully. Total spend: $${res.spentUsd.toFixed(4)}`,
    );
  } else {
    console.error(`[regent] Job ${res.jobId} failed or was abandoned.`);
    process.exit(1);
  }
}

export function handleStatusCommand(jobId?: string): void {
  const daemon = new RegentDaemon();
  const projections = daemon.getProjections();

  if (jobId) {
    const job = projections.jobs[jobId];
    if (!job) {
      console.log(`[regent] Job ${jobId} not found.`);
      return;
    }
    console.log(
      `Job: ${job.jobId} | Status: ${job.status} | Spend: $${job.spentUsd.toFixed(4)} | Updated: ${job.updated}`,
    );
  } else {
    console.log("=== Active Regent Jobs ===");
    for (const job of Object.values(projections.jobs)) {
      console.log(`- ${job.jobId}: ${job.status} ($${job.spentUsd.toFixed(4)})`);
    }
  }
}

export function handleStopCommand(_jobId?: string): void {
  console.log("[regent] Engaging emergency STOP sentinel...");
  const killSwitch = new KillSwitch();
  killSwitch.engage();
  console.log("[regent] STOP engaged. All active worker processes will terminate.");
}

export function handleWatchCommand(jobId?: string): void {
  console.log(`[regent] Watching ${jobId ?? "active jobs"}... (press Ctrl+C to exit)`);
  handleStatusCommand(jobId);
}
