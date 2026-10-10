/**
 * src/workers/chatbot.ts
 *
 * Chatbot consultant worker adapter via OpenRouter / Anthropic HTTP API.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AttemptLog } from "./attempt-log.js";
import type {
  ProbeResult,
  WorkRequest,
  WorkResult,
  WorkRun,
  WorkerAdapter,
  WorkerEvent,
} from "./types.js";

export class ChatbotAdapter implements WorkerAdapter {
  readonly id = "chatbot" as const;

  async probe(): Promise<ProbeResult> {
    const hasKey = Boolean(process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY);
    return {
      available: hasKey,
      notes: hasKey
        ? ["API key detected for chatbot consultant"]
        : ["No OPENROUTER_API_KEY or ANTHROPIC_API_KEY set"],
    };
  }

  start(req: WorkRequest): WorkRun {
    if (!existsSync(req.attemptDir)) {
      mkdirSync(req.attemptDir, { recursive: true });
    }

    const log = new AttemptLog(join(req.attemptDir, "worker.log"));
    const started = Date.now();
    let isCancelled = false;

    const cancel = async (_reason: string) => {
      isCancelled = true;
    };

    const runWork = async (): Promise<WorkResult> => {
      const apiKey = process.env.OPENROUTER_API_KEY;
      const model = req.modelOverride ?? "typesafe/jev-router";

      if (!apiKey || isCancelled) {
        const finalText = isCancelled
          ? "Execution cancelled"
          : "Chatbot simulated response (no live key provided)";
        log.write(finalText);
        await log.close();
        return {
          status: isCancelled ? "cancelled" : "completed",
          finalText,
          costUsd: 0,
          durationMs: Date.now() - started,
          exitCode: 0,
          rawLogPath: log.path,
        };
      }

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://regent.local",
            "X-Title": "Regent Autonomous Local Orchestrator",
          },
          body: JSON.stringify({
            model,
            messages: [
              ...(req.systemPrompt ? [{ role: "system", content: req.systemPrompt }] : []),
              { role: "user", content: req.taskPrompt },
            ],
          }),
        });

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          usage?: { total_tokens?: number };
        };

        const content = data.choices?.[0]?.message?.content ?? "";
        log.write(content);
        await log.close();

        return {
          status: "completed",
          finalText: content,
          costUsd: 0.001,
          durationMs: Date.now() - started,
          exitCode: 0,
          rawLogPath: log.path,
        };
      } catch (err: unknown) {
        const errText = err instanceof Error ? err.message : String(err);
        log.write(`Error: ${errText}`);
        await log.close();
        return {
          status: "failed",
          finalText: errText,
          costUsd: 0,
          durationMs: Date.now() - started,
          exitCode: 1,
          rawLogPath: log.path,
        };
      }
    };

    const eventQueue: WorkerEvent[] = [];
    const events: AsyncIterable<WorkerEvent> = {
      [Symbol.asyncIterator]() {
        let sent = false;
        return {
          async next() {
            if (sent) return { done: true, value: undefined };
            sent = true;
            return { done: false, value: { type: "started" } };
          },
        };
      },
    };

    return {
      events,
      result: runWork(),
      steer: async () => false,
      cancel,
    };
  }
}
