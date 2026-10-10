/**
 * src/operator/chat.ts
 *
 * Interactive conversational chat session with Regent powered by Gemini 3.8.
 * Allows operators to talk directly to Regent, inquire about status, dispatch jobs,
 * and seamlessly delegate OS/multimodal/desktop tasks to Hermes Agent.
 */

import * as readline from "node:readline";
import spawn from "cross-spawn";
import { getActiveModel, getOpenRouterKey } from "../config/keys.js";
import { type ChatMessage, callOpenRouter } from "../config/openrouter.js";
import { KillSwitch } from "../kernel/kill-switch.js";
import { runDiagnostics } from "./doctor.js";

/**
 * Spawns Hermes Agent to execute an open-ended system, browser, or desktop task.
 */
export function runHermesTask(taskPrompt: string): Promise<string> {
  return new Promise((resolve) => {
    console.log(`\n⚡ Delegating to Hermes Agent: "${taskPrompt}"`);
    console.log("──────────────────────────────────────────────────────────");

    const child = spawn("hermes", ["chat", "-Q", "--query-file", "-"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let output = "";
    child.stdout?.on("data", (d) => {
      const s = d.toString();
      output += s;
      process.stdout.write(s);
    });

    child.stderr?.on("data", (d) => {
      const s = d.toString();
      if (!s.includes("ExperimentalWarning") && !s.includes("DeprecationWarning")) {
        process.stdout.write(s);
      }
    });

    child.on("close", (code) => {
      console.log("\n──────────────────────────────────────────────────────────");
      console.log(`[Hermes Agent finished with exit code ${code ?? 0}]\n`);
      resolve(output.trim());
    });

    child.stdin?.write(taskPrompt);
    child.stdin?.end();
  });
}

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
  console.log("Commands: /hermes <task>, /doctor, /stop, /exit\n");
  console.log("Ask me anything, or give me a task to execute.\n");

  const conversationHistory: ChatMessage[] = [
    {
      role: "system",
      content: `You are Regent, an elite, autonomous software engineering orchestrator running on Windows 11.
You assist the operator with planning jobs, reviewing code, inspecting system state, and coordinating worker models.
When an operator gives you an actionable OS, browser, desktop, or download task that requires active tool execution (like downloading files, opening browsers, changing settings, running scripts), YOU MUST EXECUTE IT by replying with:
DELEGATE_HERMES: <exact task instructions>
Be direct, helpful, and technically precise.`,
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

    if (input.startsWith("/hermes ")) {
      const task = input.slice(8).trim();
      rl.pause();
      await runHermesTask(task);
      rl.resume();
      rl.prompt();
      return;
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
        temperature: 0.3,
      });

      // Clear the "thinking..." line
      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 0);

      // Check if Gemini decided to delegate to Hermes
      if (res.text.includes("DELEGATE_HERMES:")) {
        const parts = res.text.split("DELEGATE_HERMES:");
        const prefix = parts[0].trim();
        const task = parts[1].trim();

        if (prefix) {
          console.log(`\n${prefix}\n`);
        }

        rl.pause();
        const hermesResult = await runHermesTask(task);
        rl.resume();

        conversationHistory.push({
          role: "assistant",
          content: `Task executed by Hermes Agent:\n${hermesResult}`,
        });
      } else {
        console.log(`\n${res.text}\n`);
        conversationHistory.push({ role: "assistant", content: res.text });
      }
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
