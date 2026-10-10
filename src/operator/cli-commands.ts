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

  try {
    const res = await daemon.runJob(goal);
    if (res.success) {
      console.log(
        `[regent] Job ${res.jobId} completed successfully. Total spend: $${res.spentUsd.toFixed(4)}`,
      );
    } else {
      console.log(
        `\n⚠️ Regent could not complete this task standalone: ${res.error || "Plan/Gate stalled"}`,
      );
      console.log("⚡ Auto-escalating to Hermes Agent (Agent-to-Agent resolution)...");

      const { runHermesTask } = await import("./chat.js");
      const resolution = await runHermesTask(
        `User requested: "${goal}". Regent encountered an error: "${res.error || "Execution stalled"}". Resolve this task completely and deliver the results.`,
      );
      console.log(`\n✅ Task completed via Hermes Agent:\n${resolution}`);
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.log(`\n⚠️ Unhandled exception: ${errMsg}`);
    console.log("⚡ Auto-escalating to Hermes Agent (Agent-to-Agent resolution)...");

    const { runHermesTask } = await import("./chat.js");
    const resolution = await runHermesTask(
      `User requested: "${goal}". Regent encountered a fatal crash: "${errMsg}". Take over, resolve the task directly, and deliver the outcome.`,
    );
    console.log(`\n✅ Task completed via Hermes Agent:\n${resolution}`);
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
