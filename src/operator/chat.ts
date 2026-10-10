/**
 * src/operator/chat.ts
 *
 * Autonomous conversational chat session with Regent powered by Gemini 3.8.
 * The operator just speaks in natural language; Regent autonomously chooses
 * and executes host actions (via RUNE 2.0 full-metal engine) or agentic
 * browser/research tasks (via Hermes Agent) without making the user copy-paste anything.
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
  const rune = new RuneInterpreter();

  console.log("==========================================================");
  console.log("       🛡️ Regent Autonomous Console (Gemini 3.8)           ");
  console.log("==========================================================");
  console.log(`Model: ${model}`);
  console.log("Capabilities: RUNE 2.0 Native Engine + Hermes Agent Fleet");
  console.log("Commands: /doctor, /stop, /exit\n");
  console.log("Just tell me what to do in plain English. I'll execute it.\n");

  const conversationHistory: ChatMessage[] = [
    {
      role: "system",
      content: `You are Regent, an elite autonomous system and engineering orchestrator running on Windows 11.
You serve the operator with absolute competence and direct execution.

CRITICAL OPERATIONAL RULES:
1. NEVER tell the operator to open PowerShell, write scripts, or run commands manually.
2. NEVER say "Step 1: do X, Step 2: do Y". YOU ARE AN AUTONOMOUS CONTROLLER. YOU DO IT YOURSELF.
3. If the user asks for ANY system action (set wallpaper, beep, audio, inspect processes, move/close windows, take screenshot, clipboard, download file, run command, click mouse, type text):
   YOU MUST EMIT A \`\`\`rune CODE BLOCK.
   Regent's runtime will execute your RUNE code immediately on the host machine!
   Available RUNE primitives:
   - wallpaper "<path>"
   - audio.beep <freq> <durationMs>
   - notify "<title>" "<message>"
   - snap "<dest.png>"
   - clip "<text>" (or clip to read)
   - sys.ps <limit>
   - sys.kill <pid|name>
   - win.list
   - win.move "<title>" <x> <y> <w> <h>
   - win.close "<title>"
   - mouse.move <x> <y>, mouse.click <left|right>
   - key.type "<text>", key.press "<key>"
   - fetch "<url>" -> "<dest>"
   - exec "<cmd>"
   - def <name> <args> { ... }
   - native <name> { <raw C# code> }
4. If the user asks for deep web research, browsing web pages, or multi-step agent tasks:
   EMIT A \`\`\`hermes BLOCK containing the exact instruction.
   Regent will dispatch Hermes Agent with its full browser and web tools to execute it.
5. If the user is having a casual conversation or asking an architectural question, answer directly in natural, friendly English.`,
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
        temperature: 0.2,
      });

      // Clear the "thinking..." line
      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 0);

      const responseText = res.text.trim();

      // 1. Detect and execute RUNE code blocks automatically
      const runeMatch = responseText.match(/```rune\s*([\s\S]*?)```/i);
      // 2. Detect and execute Hermes tasks automatically
      const hermesMatch = responseText.match(/```hermes\s*([\s\S]*?)```/i);
      // 3. Detect and execute Shell blocks
      const shellMatch = responseText.match(/```(?:shell|bash|powershell|cmd)\s*([\s\S]*?)```/i);

      if (runeMatch) {
        const runeCode = runeMatch[1].trim();
        const nonCodeText = responseText.replace(/```rune[\s\S]*?```/i, "").trim();
        if (nonCodeText) {
          console.log(`\n${nonCodeText}\n`);
        }

        console.log("⚡ Executing RUNE native system actions...");
        console.log("──────────────────────────────────────────────────────────");
        console.log(runeCode);
        console.log("──────────────────────────────────────────────────────────");

        rl.pause();
        try {
          const runeResult = await rune.run(runeCode);
          console.log(`\n✅ Execution Result: ${runeResult || "Done"}\n`);
          conversationHistory.push({
            role: "assistant",
            content: `${responseText}\n\n[RUNE Execution Output]:\n${runeResult || "Done"}`,
          });
        } catch (err: unknown) {
          console.error(`\n❌ RUNE Error: ${err instanceof Error ? err.message : String(err)}\n`);
        }
        rl.resume();
      } else if (hermesMatch) {
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
      } else if (shellMatch) {
        const shellCmd = shellMatch[1].trim();
        console.log(`\n⚡ Executing native shell command: ${shellCmd}\n`);
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
          console.error(
            `\n❌ Command Error: ${err instanceof Error ? err.message : String(err)}\n`,
          );
        }
        rl.resume();
      } else {
        // Plain natural response
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
