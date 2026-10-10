/**
 * src/operator/chat.ts
 *
 * Interactive conversational chat session with Regent powered by Gemini 3.8.
 * Allows operators to talk directly to Regent, inquire about status, and dispatch jobs.
 */

import * as readline from "node:readline";
import { getActiveModel, getOpenRouterKey } from "../config/keys.js";
import { type ChatMessage, callOpenRouter } from "../config/openrouter.js";
import { KillSwitch } from "../kernel/kill-switch.js";
import { runDiagnostics } from "./doctor.js";

export async function startChatSession(): Promise<void> {
  const openRouterKey = getOpenRouterKey();
  if (!openRouterKey) {
    console.error(
      "Error: OPENROUTER_API_KEY is not configured. Please set it in your environment or Hermes .env.",
    );
    return;
  }

  const model = getActiveModel();
  const killSwitch = new KillSwitch();

  console.log("==========================================================");
  console.log("       🛡️ Regent Interactive Console (Gemini 3.8)         ");
  console.log("==========================================================");
  console.log(`Connected to: ${model}`);
  console.log("Commands: /doctor, /stop, /exit\n");
  console.log("Ask me anything about your project or describe a job to run.\n");

  const conversationHistory: ChatMessage[] = [
    {
      role: "system",
      content: `You are Regent, an elite, autonomous local software engineering orchestrator running on Windows 11.
You assist the operator with planning jobs, reviewing code, inspecting system state, and coordinating worker models.
Be direct, helpful, and technically precise. Match your tone to the operator's style.`,
    },
  ];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "Regent > ",
  });

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    if (input === "/exit" || input === "exit" || input === "quit") {
      console.log("\nEnding Regent chat session. Goodbye!");
      process.exit(0);
    }

    if (input === "/doctor") {
      console.log("\nRunning system diagnostics...");
      const checks = await runDiagnostics();
      for (const c of checks) {
        console.log(` [${c.status === "ok" ? "✓" : "!"}] ${c.name}: ${c.detail}`);
      }
      console.log();
      rl.prompt();
      return;
    }

    if (input === "/stop") {
      console.log("\nTriggering emergency stop...");
      killSwitch.engage();
      console.log("Emergency stop requested. All workers halting.\n");
      rl.prompt();
      return;
    }

    conversationHistory.push({ role: "user", content: input });
    process.stdout.write("\nRegent is thinking... ");

    try {
      const res = await callOpenRouter(conversationHistory, {
        model,
        apiKey: openRouterKey,
        temperature: 0.4,
      });

      // Clear the "thinking..." line
      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 0);

      console.log(`\n${res.text}\n`);
      conversationHistory.push({ role: "assistant", content: res.text });
    } catch (err: unknown) {
      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 0);
      console.error(`\nError: ${err instanceof Error ? err.message : String(err)}\n`);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log("\nExiting Regent session.");
    process.exit(0);
  });
}
