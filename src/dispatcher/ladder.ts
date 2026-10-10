/**
 * src/dispatcher/ladder.ts
 *
 * Strategy Ladder (R1–R7) anti-loop progression per 03 §5.
 */

import type { WorkerId } from "../workers/types.js";

export interface LadderContext {
  rung: number;
  attempt: number;
  currentWorker: WorkerId;
  previousSessionId?: string;
  critiqueText?: string;
  attemptHistory?: Array<{ attempt: number; score: number; whyFailed: string }>;
  availableWorkers: WorkerId[];
}

export interface LadderDirectives {
  worker: WorkerId;
  resumeSessionId?: string;
  modelOverride?: string;
  guidance?: string;
  shouldReplan?: boolean;
  shouldEscalate?: boolean;
}

export function applyLadder(ctx: LadderContext): LadderDirectives {
  switch (ctx.rung) {
    case 1:
      // R1: Same worker, resumed session, sharper critique
      return {
        worker: ctx.currentWorker,
        resumeSessionId: ctx.previousSessionId,
        guidance:
          "Fix specific defects highlighted in reviewer critique without regressing passing checks.",
      };

    case 2:
      // R2: Same worker, FRESH session, critique + explanation of prior failure
      return {
        worker: ctx.currentWorker,
        resumeSessionId: undefined, // Fresh session
        guidance:
          "Previous attempt context discarded. Review previous failure mode and take an alternative clean implementation approach.",
      };

    case 3:
      // R3: Different model for the same worker (e.g. claude-opus-5-5 or higher effort)
      return {
        worker: ctx.currentWorker,
        resumeSessionId: undefined,
        modelOverride: "claude-opus-5-5",
        guidance: "Escalated model tier assigned for deeper reasoning and synthesis.",
      };

    case 4: {
      // R4: Different worker entirely (Claude Code <-> Hermes <-> VS Code)
      const otherWorkers = ctx.availableWorkers.filter((w) => w !== ctx.currentWorker);
      const nextWorker = otherWorkers.length > 0 ? otherWorkers[0] : ctx.currentWorker;
      return {
        worker: nextWorker,
        resumeSessionId: undefined,
        guidance: `Transferred contract execution to ${nextWorker} with full attempt history context.`,
      };
    }

    case 5:
      // R5: Consult 2 chatbot consultants for root-cause hypotheses
      return {
        worker: ctx.currentWorker,
        resumeSessionId: undefined,
        guidance:
          "Independent consultant analysis suggests checking underlying framework configuration and state boundaries.",
      };

    case 6:
      // R6: Replan: Director splits / rescopes
      return {
        worker: ctx.currentWorker,
        shouldReplan: true,
        guidance: "Contract flagged for Director replanning and scope division.",
      };

    default:
      // R7: Escalate: deliver partial or ask operator / abandon
      return {
        worker: ctx.currentWorker,
        shouldEscalate: true,
        guidance: "Strategy ladder exhausted (Rung 7). Escalated to operator judgment.",
      };
  }
}
