/**
 * src/operator/chat.ts
 *
 * Autonomous conversational chat session with Regent powered by Gemini 3.8.
 * Regent acts as the coordinator/planner, while Hermes Agent serves as the
 * full-capability execution middleman with browser, terminal, and desktop tools.
 * When ANY command fails, Regent automatically escalates to Hermes to fix it
 * and complete the task like a human.
 */

import * as readline from "node:readline";
import spawn from "cross-spawn";
import { getActiveModel, getOpenRouterKey } from "../config/keys.js";
import { type ChatMessage, callOpenRouter } from "../config/openrouter.js";
import { KillSwitch } from "../kernel/kill-switch.js";
import { RuneInterpreter } from "../rune/interpreter.js";
import { runDiagnostics } from "./doctor.js";

/**
 * Spawns Hermes Agent to execute an open-ended system, browser, or desktop task.
 */
export function runHermesTask(taskPrompt: string): Promise<string> {
  return new Promise((resolve) => {
    console.log("\n⚡ Dispatching Hermes Agent (Browser & System Tools)...");
    console.log(`🎯 Goal: "${taskPrompt}"`);
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
  const rune = new RuneInterpreter();

  console.log("==========================================================");
  console.log("       🛡️ Regent Autonomous Console (Gemini 3.8)           ");
  console.log("==========================================================");
  console.log(`Coordinator: ${model}`);
  console.log("Execution Middleman: Hermes Agent (Chrome, Terminal, Win32)");
  console.log("Commands: /doctor, /stop, /exit\n");
  console.log("Just tell me what to do in plain English. I'll execute it.\n");

  const conversationHistory: ChatMessage[] = [
    {
      role: "system",
      content: `You are Regent, the autonomous orchestrator on Windows 11.
You have an execution middleman: HERMES AGENT, which has full human-like browser control, terminal tools, and vision analysis.

RULES OF ENGAGEMENT:
1. NEVER dump errors on the operator. NEVER give instructions or tell them to open PowerShell.
2. For BROWSER, YOUTUBE, SONGS, DOWNLOADING ASSETS, or MULTI-STEP AUTOMATION:
   DO NOT write complicated PowerShell commands.
   EMIT A \`\`\`hermes BLOCK containing the exact instructions.
   Hermes will open Chrome, navigate, analyze, execute, and deliver results like a human.
   Example:
   \`\`\`hermes
   Open the slowed 0.5x version of Memory Reboot on YouTube in the background.
   \`\`\`
3. For SIMPLE OS ACTIONS (beep, wallpaper, clip, processes, notifications):
   EMIT A \`\`\`rune BLOCK.
   Available RUNE primitives:
   - browser.open "<url>"
   - media.play "<query or url>"
   - wallpaper "<path>"
   - audio.beep <freq> <durationMs>
   - notify "<title>" "<message>"
   - snap "<dest.png>"
   - clip "<text>" (or clip to read)
   - sys.ps <limit>
   - sys.kill <pid|name>
4. If a RUNE command fails, the system will automatically dispatch Hermes to fix it and get it done.
5. Answer conversational questions directly and concisely.`,
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
    process.stdout.write("\nRegent is coordinating... ");

    try {
      const res = await callOpenRouter(conversationHistory, {
        model,
        apiKey: openRouterKey,
        temperature: 0.2,
      });

      // Clear the "thinking..." line
      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 0);

      const responseText = res.text.trim();

      const runeMatch = responseText.match(/```rune\s*([\s\S]*?)```/i);
      const hermesMatch = responseText.match(/```hermes\s*([\s\S]*?)```/i);
      const shellMatch = responseText.match(/```(?:shell|bash|powershell|cmd)\s*([\s\S]*?)```/i);

      if (hermesMatch) {
        const hermesTask = hermesMatch[1].trim();
        const nonCodeText = responseText.replace(/```hermes[\s\S]*?```/i, "").trim();
        if (nonCodeText) {
          console.log(`\n${nonCodeText}\n`);
        }

        rl.pause();
        const hermesResult = await runHermesTask(hermesTask);
        rl.resume();

        conversationHistory.push({
          role: "assistant",
          content: `${responseText}\n\n[Hermes Execution Output]:\n${hermesResult}`,
        });
      } else if (runeMatch) {
        const runeCode = runeMatch[1].trim();
        const nonCodeText = responseText.replace(/```rune[\s\S]*?```/i, "").trim();
        if (nonCodeText) {
          console.log(`\n${nonCodeText}\n`);
        }

        console.log("⚡ Executing RUNE native action...");
        rl.pause();
        try {
          const runeResult = await rune.run(runeCode);
          console.log(`\n✅ Result: ${runeResult || "Completed"}\n`);
          conversationHistory.push({
            role: "assistant",
            content: `${responseText}\n\n[RUNE Output]:\n${runeResult || "Completed"}`,
          });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.log(`\n⚠️ Direct RUNE action encountered: ${errMsg}`);
          console.log(
            "⚡ Auto-escalating to Hermes Agent to fix and complete the task like a human...",
          );

          // Automatic self-healing escalation to Hermes Agent
          const recoveryTask = `The user requested: "${input}". A low-level action encountered an error: "${errMsg}". Use your full toolbelt (open Chrome, search YouTube/web, execute scripts, or Win32) to fulfill the user's request completely and cleanly.`;
          const hermesResult = await runHermesTask(recoveryTask);

          conversationHistory.push({
            role: "assistant",
            content: `The initial command had an issue, but I auto-escalated to Hermes Agent who completed it:\n${hermesResult}`,
          });
        }
        rl.resume();
      } else if (shellMatch) {
        const shellCmd = shellMatch[1].trim();
        rl.pause();
        try {
          const out = await rune.runtime.exec(shellCmd);
          console.log(out || "[Command finished with no output]");
          console.log();
          conversationHistory.push({
            role: "assistant",
            content: `${responseText}\n\n[Command Output]:\n${out}`,
          });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.log(`\n⚠️ Shell command failed: ${errMsg}`);
          console.log("⚡ Auto-escalating to Hermes Agent to solve it directly...");
          const recoveryTask = `The user wanted: "${input}". The shell command failed with "${errMsg}". Execute this task directly on the system.`;
          const hermesResult = await runHermesTask(recoveryTask);
          conversationHistory.push({
            role: "assistant",
            content: `Command recovered by Hermes Agent:\n${hermesResult}`,
          });
        }
        rl.resume();
      } else {
        // Plain conversational answer
        console.log(`\n${responseText}\n`);
        conversationHistory.push({ role: "assistant", content: responseText });
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
