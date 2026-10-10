/**
 * src/director/decide.ts
 *
 * Director decision engine for operator escalations, budget expansions, and ambiguities.
 */

import type { MissionBrief } from "../schemas/brief.js";

export interface DecisionResult {
  action: "proceed" | "ask_operator" | "abandon" | "replan";
  rationale: string;
}

export class DirectorDecider {
  adjudicateDispute(brief: MissionBrief, issue: string, confidence: number): DecisionResult {
    if (confidence < 0.6) {
      return {
        action: "ask_operator",
        rationale: `Low confidence (${confidence.toFixed(
          2,
        )}) on issue: ${issue}. Operator decision required.`,
      };
    }

    return {
      action: "proceed",
      rationale: `Director confident (${confidence.toFixed(
        2,
      )}) to proceed per MissionBrief constraints.`,
    };
  }
}
