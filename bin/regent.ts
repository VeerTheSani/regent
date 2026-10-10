#!/usr/bin/env node
import { Command } from "commander";
import {
  handleJobCommand,
  handleStatusCommand,
  handleStopCommand,
  handleWatchCommand,
} from "../src/operator/cli-commands.js";

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

program.parse(process.argv);
