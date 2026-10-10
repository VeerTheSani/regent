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
  .command("job [goal...]")
  .description("Submit and run an autonomous job")
  .action(async (goalParts: string[] | string) => {
    const goal = Array.isArray(goalParts) ? goalParts.join(" ") : String(goalParts || "");
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

program
  .command("chat")
  .description("Start an interactive chat session with Regent powered by Gemini 3.8")
  .action(async () => {
    const { startChatSession } = await import("../src/operator/chat.js");
    await startChatSession();
  });

program
  .command("ui")
  .alias("dashboard")
  .description("Start the Regent Web Dashboard server")
  .option("-p, --port <number>", "Dashboard port", "7780")
  .action(async (opts) => {
    const { startDashboardServer } = await import("../src/operator/dashboard/server.js");
    const { RegentDaemon } = await import("../src/daemon.js");
    const daemon = new RegentDaemon();
    const port = Number(opts.port);
    await startDashboardServer(daemon, port);
    console.log(`[regent] Web Dashboard running at http://127.0.0.1:${port}`);
    console.log(`[regent] Real-time event stream at http://127.0.0.1:${port}/api/events`);
  });

program
  .command("test-gemini")
  .description("Run a live multi-role test of google/gemini-3.8-flash (Director, Triage, Judge)")
  .action(async () => {
    const { spawn } = await import("node:child_process");
    const child = spawn("npx", ["tsx", "scripts/test-gemini.ts"], {
      stdio: "inherit",
      shell: true,
    });
    await new Promise<void>((resolve) => child.on("close", () => resolve()));
  });

program.argument("[query...]", "Chat query or question").action(async (queryParts: string[]) => {
  if (queryParts && queryParts.length > 0) {
    const query = queryParts.join(" ");
    console.log(`[regent] Launching chat console for query: "${query}"\n`);
    const { startChatSession } = await import("../src/operator/chat.js");
    await startChatSession();
  }
});

program.exitOverride();

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (err: unknown) {
    const rawArgs = process.argv.slice(2);
    if (
      rawArgs.length === 0 ||
      rawArgs.includes("-h") ||
      rawArgs.includes("--help") ||
      rawArgs.includes("-V") ||
      rawArgs.includes("--version")
    ) {
      return;
    }

    const cleanInput = rawArgs.join(" ").replace(/^job\s+/i, "");
    console.log(`\n⚡ Agent-to-Agent Recovery: Routing "${cleanInput}" to Hermes Agent...`);
    const { runHermesTask } = await import("../src/operator/chat.js");
    const result = await runHermesTask(cleanInput);
    console.log(`\n✅ Completed via Hermes Agent:\n${result}\n`);
  }
}

main().catch(console.error);
