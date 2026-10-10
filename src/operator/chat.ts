/**
 * src/operator/chat.ts
 *
 * Autonomous conversational chat session with Regent powered by Gemini 3.8.
 * Integrates:
 * - Polyglot Execution Sandbox (Python, Node, PowerShell, C#)
 * - Human-Grade Desktop Controller (Mouse, Keyboard, Windows, Display)
 * - Live Chrome & Media Driver (CDP, Playwright, HTML5 Video Control)
 * - Closed-Loop Self-Healing Engine (Auto-diagnoses and fixes errors across 3 retries)
 * - Hermes Agent Fleet (Multimodal browser and research middleman)
 */

import * as readline from "node:readline";
import spawn from "cross-spawn";
import { getActiveModel, getOpenRouterKey } from "../config/keys.js";
import { type ChatMessage, callOpenRouter } from "../config/openrouter.js";
import { ChromeBrowserDriver } from "../engine/browser-driver.js";
import { DesktopController } from "../engine/desktop.js";
import { PolyglotEngine } from "../engine/polyglot.js";
import { SelfHealingEngine } from "../engine/self-heal.js";
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
  const desktop = new DesktopController();
  const browser = new ChromeBrowserDriver();
  const polyglot = new PolyglotEngine();
  const healing = new SelfHealingEngine();

  console.log("==========================================================");
  console.log("       🛡️ Regent Autonomous Console (Gemini 3.8)           ");
  console.log("==========================================================");
  console.log(`Model: ${model}`);
  console.log("Engine: Self-Healing Desktop Controller + Live Chrome CDP");
  console.log("Commands: /doctor, /stop, /exit\n");
  console.log("Just tell me what to do in plain English. I'll execute it.\n");

  const conversationHistory: ChatMessage[] = [
    {
      role: "system",
      content: `You are Regent, the autonomous orchestrator on Windows 11.
You have full-metal control of this machine through a closed-loop execution engine with self-healing capabilities.
You also have HERMES AGENT as your execution middleman for complex web and multimodal browsing.

CRITICAL OPERATIONAL RULES:
1. NEVER dump errors on the operator. NEVER give instructions or tell them to open PowerShell manually.
2. YOU ARE AN AUTONOMOUS CONTROLLER. YOU EXECUTE DIRECTLY.
3. For BROWSER, YOUTUBE, SONGS, DOWNLOADING ASSETS, or MULTI-STEP AUTOMATION:
   Emit a \`\`\`hermes block or \`\`\`rune block with \`browser.open "<url>"\` or \`media.play "<song>"\`.
   Example for playing a song:
   \`\`\`rune
   media.play "memory reboot 0.5x slowed"
   notify "Regent Audio" "Playing Memory Reboot at 0.5x in background"
   \`\`\`
4. For SYSTEM ACTIONS (wallpaper, sound, processes, windows, screenshots, clipboard):
   Emit a \`\`\`rune block.
   Primitives available:
   - browser.open "<url>"
   - media.play "<query or url>"
   - wallpaper "<path>"
   - audio.beep <freq> <durationMs>
   - notify "<title>" "<message>"
   - snap "<dest.png>"
   - clip "<text>" (or clip to read)
   - sys.ps <limit>
   - sys.kill <pid|name>
   - mouse.move <x> <y>, mouse.click <left|right>
   - key.type "<text>", key.press "<key>"
5. For complex code scripts, emit \`\`\`python, \`\`\`node, or \`\`\`powershell blocks.
6. Answer conversational questions directly and concisely.`,
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

      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 0);

      const responseText = res.text.trim();

      const runeMatch = responseText.match(/```rune\s*([\s\S]*?)```/i);
      const hermesMatch = responseText.match(/```hermes\s*([\s\S]*?)```/i);
      const pyMatch = responseText.match(/```python\s*([\s\S]*?)```/i);
      const psMatch = responseText.match(/```powershell\s*([\s\S]*?)```/i);
      const nodeMatch = responseText.match(/```(?:javascript|node|js)\s*([\s\S]*?)```/i);

      if (hermesMatch) {
        const hermesTask = hermesMatch[1].trim();
        const nonCodeText = responseText.replace(/```hermes[\s\S]*?```/i, "").trim();
        if (nonCodeText) console.log(`\n${nonCodeText}\n`);

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
        if (nonCodeText) console.log(`\n${nonCodeText}\n`);

        rl.pause();
        const healResult = await healing.executeWithHealing({
          goal: input,
          maxRetries: 3,
          executeAttempt: async (att, lastErr, diag) => {
            if (att === 1) {
              console.log("⚡ Executing native RUNE action...");
              return rune.run(runeCode);
            }
            console.log(`\n🔄 Self-Healing Attempt ${att}: ${diag}`);
            // Fallback strategy: delegate to Hermes Agent
            return runHermesTask(
              `User requested: "${input}". Low-level action failed with "${lastErr}". Execute this using your browser/system tools completely.`,
            );
          },
        });

        if (healResult.success) {
          console.log(`\n✅ Action Completed: ${healResult.output || "Done"}\n`);
          conversationHistory.push({
            role: "assistant",
            content: `${responseText}\n\n[Action Completed]:\n${healResult.output || "Done"}`,
          });
        } else {
          console.error(
            `\n❌ Action could not be completed after ${healResult.attempts} self-healing attempts.\n`,
          );
        }
        rl.resume();
      } else if (pyMatch) {
        const code = pyMatch[1].trim();
        rl.pause();
        console.log("⚡ Executing via Python Sandbox...");
        const pyRes = await polyglot.runPython(code);
        if (pyRes.ok) {
          console.log(`\n✅ Result: ${pyRes.stdout || "Done"}\n`);
        } else {
          console.log(`⚠️ Python error, auto-healing via Hermes: ${pyRes.stderr}`);
          await runHermesTask(`Fix and run: ${input}`);
        }
        rl.resume();
      } else if (psMatch) {
        const script = psMatch[1].trim();
        rl.pause();
        console.log("⚡ Executing via Base64 PowerShell Sandbox...");
        const psRes = await polyglot.runPowerShell(script);
        if (psRes.ok) {
          console.log(`\n✅ Result: ${psRes.stdout || "Done"}\n`);
        } else {
          console.log(`⚠️ PowerShell error, auto-healing via Hermes: ${psRes.stderr}`);
          await runHermesTask(`Fix and run: ${input}`);
        }
        rl.resume();
      } else if (nodeMatch) {
        const code = nodeMatch[1].trim();
        rl.pause();
        console.log("⚡ Executing via Node.js Sandbox...");
        const nodeRes = await polyglot.runNode(code);
        console.log(`\n✅ Result: ${nodeRes.stdout || "Done"}\n`);
        rl.resume();
      } else {
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
