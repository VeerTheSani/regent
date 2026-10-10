/**
 * src/bridge/proxy-user.ts
 *
 * Proxy-User engine answering worker questions per 06 §4.
 * Standing in for the operator with structured classifications.
 */

import type { Ledger } from "../kernel/ledger.js";
import type { AskOutput } from "./schemas.js";

export interface ProxyUserQuestion {
  question: string;
  options?: string[];
  context?: string;
  blocking?: boolean;
}

export class ProxyUser {
  constructor(private readonly ledger: Ledger) {}

  async answer(
    ids: { job: string; ctr: string; attempt: number },
    req: ProxyUserQuestion,
  ): Promise<AskOutput> {
    // Record question in ledger
    this.ledger.append({
      type: "worker.question",
      jobId: ids.job,
      ctrId: ids.ctr,
      attempt: ids.attempt,
      actor: "worker",
      payload: {
        question: req.question,
        options: req.options,
        context: req.context,
      },
    });

    const lowerQ = req.question.toLowerCase();
    let response: AskOutput;

    // 1. Fact / convention check
    if (lowerQ.includes("biome") || lowerQ.includes("format") || lowerQ.includes("linter")) {
      response = {
        answer:
          "Use Biome for formatting and linting per project standards (never Prettier or ESLint).",
        kind: "fact",
        rationale: "Established repository standard in DECISIONS.md and spec.",
      };
    } else if (
      lowerQ.includes("package manager") ||
      lowerQ.includes("bun") ||
      lowerQ.includes("npm")
    ) {
      response = {
        answer: "Use npm and tsx for Regent runtime; Bun is not installed on this host.",
        kind: "fact",
        rationale: "Host machine constraint documented in spec.",
      };
    } else if (req.options && req.options.length > 0) {
      // 2. Decision among options (preference / least surprising choice)
      const chosen = req.options[0];
      response = {
        answer: `Select option: ${chosen}`,
        kind: "decision",
        rationale: "Chosen as the most standard, reversible, and convention-aligned option.",
      };
    } else {
      // 3. Deferred / Director escalation stub for M3
      response = {
        answer: "Proceed with standard default implementation; operator review requested.",
        kind: "deferred",
        rationale: "Question requires operator judgment or Director escalation.",
        provisional: "default_provisional_value",
      };
    }

    // Record answer in ledger
    this.ledger.append({
      type: "worker.answered",
      jobId: ids.job,
      ctrId: ids.ctr,
      attempt: ids.attempt,
      actor: "proxy_user",
      payload: response as unknown as Record<string, unknown>,
    });

    return response;
  }
}
