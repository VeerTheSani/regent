#!/usr/bin/env node
import { Command } from "commander";
import {
  handleJobCommand,
  handleStatusCommand,
  handleStopCommand,
  handleWatchCommand,
} from "../src/operator/cli-commands.js";
import { runDiagnostics } from "../src/operator/doctor.js";
import { runSetup } from "../src/operator/setup.js";

const program = new Command();

program.name("regent").description("Autonomous local orchestrator daemon and CLI").version("0.0.0");

program
  .command("job")
  .description("Submit and run an autonomous job")
  .argument("<goal>", "Plain-language goal for Regent to execute")
  .action(async (goal: string) => {
    await handleJobCommand(goal);
  });

program
  .command("status")
  .description("Show status of active jobs or a specific job")
  .argument("[jobId]", "Optional job ID")
  .action((jobId?: string) => {
    handleStatusCommand(jobId);
  });

program
  .command("stop")
  .description("Engage emergency STOP and halt all running processes")
  .argument("[jobId]", "Optional job ID to halt")
  .action((jobId?: string) => {
    handleStopCommand(jobId);
  });

program
  .command("watch")
  .description("Live watch job progress")
  .argument("[jobId]", "Optional job ID")
  .action((jobId?: string) => {
    handleWatchCommand(jobId);
  });

program
  .command("doctor")
  .description("Inspect and verify all system runtimes, workers, and dependencies")
  .action(async () => {
    console.log("=== Regent System Diagnostics (Doctor) ===");
    const results = await runDiagnostics();
    console.table(
      results.map((r) => ({
        Check: r.name,
        Category: r.category,
        Status: r.status.toUpperCase(),
        Detail: r.detail,
      })),
    );
  });

program
  .command("setup")
  .description("Run operator onboarding and generate configuration files")
  .option("--channel <channel>", "Notification channel", "telegram")
  .option("--max-job-usd <amount>", "Maximum dollar budget per job", "20")
  .action((options) => {
    console.log("=== Regent Setup & Onboarding ===");
    const paths = runSetup({
      channel: options.channel,
      maxJobUsd: Number(options.maxJobUsd),
    });
    console.log(`Config written to: ${paths.configPath}`);
    console.log(`Charter written to: ${paths.charterPath}`);
    console.log(`Operator profile written to: ${paths.operatorPath}`);
  });

program.parse(process.argv);
