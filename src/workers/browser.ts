/**
 * src/workers/browser.ts
 *
 * Browser worker adapter utilizing Playwright and Chrome CDP.
 * Includes T1 form classification and Charter evaluation for browser actions per 07 §2, 14 M8.
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { captureWeb } from "../evidence/web.js";
import type { Charter } from "../kernel/charter.js";
import { AttemptLog } from "./attempt-log.js";
import type {
  ProbeResult,
  WorkRequest,
  WorkResult,
  WorkRun,
  WorkerAdapter,
  WorkerEvent,
} from "./types.js";

export function classifyFormKind(
  fields: string[],
): "login" | "payment" | "account" | "legal" | "other" {
  const text = fields.join(" ").toLowerCase();

  if (
    text.includes("card") ||
    text.includes("cvc") ||
    text.includes("checkout") ||
    text.includes("payment")
  ) {
    return "payment";
  }
  if (
    text.includes("password") ||
    text.includes("login") ||
    text.includes("signin") ||
    text.includes("auth")
  ) {
    return "login";
  }
  if (text.includes("api_key") || text.includes("credential") || text.includes("token")) {
    return "account";
  }
  if (text.includes("terms") || text.includes("privacy") || text.includes("license")) {
    return "legal";
  }

  return "other";
}

export class BrowserWorkerAdapter implements WorkerAdapter {
  readonly id = "browser" as const;

  constructor(private readonly charter?: Charter) {}

  async probe(): Promise<ProbeResult> {
    const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
    const available = existsSync(chromePath);
    return {
      available,
      notes: available
        ? ["Chrome binary available for Playwright CDP/launch"]
        : ["Chrome binary not found at standard path"],
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
      log.write(`[browser] Initiating browser contract: ${req.contract.title}`);

      // Evaluate browser action
      if (this.charter) {
        // Example submit check
        const formKind = classifyFormKind(req.contract.scope ?? []);
        const decision = this.charter.evaluate(
          {
            jobId: req.jobId,
            contractId: req.contract.id,
            actor: "worker:browser",
            action: "browser.submit",
            target: { formKind },
            tainted: false,
          },
          {
            workspaceRoots: [req.cwd],
            attemptDir: req.attemptDir,
          },
        );

        if (decision.kind !== "allow") {
          const msg = `Browser submit blocked by charter (${decision.level}): ${
            "reason" in decision ? decision.reason : "Grant required"
          }`;
          log.write(msg);
          await log.close();
          return {
            status: "failed",
            finalText: msg,
            costUsd: 0,
            durationMs: Date.now() - started,
            exitCode: 1,
            rawLogPath: log.path,
          };
        }
      }

      // Execute capture if URL specified
      let captureResult = "";
      if (req.taskPrompt.startsWith("http")) {
        try {
          const cap = await captureWeb(
            { name: "attempt-capture", url: req.taskPrompt },
            join(req.attemptDir, "captures"),
          );
          captureResult = `Captured page ${cap.title} (${cap.consoleErrors.length} console errors)`;
          log.write(captureResult);
        } catch (err: unknown) {
          captureResult = `Capture error: ${err instanceof Error ? err.message : String(err)}`;
          log.write(captureResult);
        }
      }

      await log.close();

      return {
        status: isCancelled ? "cancelled" : "completed",
        finalText: captureResult || "Browser contract completed successfully",
        costUsd: 0,
        durationMs: Date.now() - started,
        exitCode: 0,
        rawLogPath: log.path,
      };
    };

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
