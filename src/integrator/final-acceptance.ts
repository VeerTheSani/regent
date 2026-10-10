/**
 * src/integrator/final-acceptance.ts
 *
 * Final acceptance evaluation engine per 03 §1, 14 M9.
 * Validates whole-job deliverables against the MissionBrief Definition of Done.
 */

import { RubricRegistry } from "../judge/rubrics.js";
import type { MissionBrief } from "../schemas/brief.js";
import type { Verdict } from "../schemas/verdict.js";

export interface FinalAcceptanceContext {
  brief: MissionBrief;
  allGatesPassed: boolean;
  verifiedDods: string[];
  integrationBranch: string;
}

export class FinalAcceptanceEvaluator {
  private rubrics = new RubricRegistry();

  async evaluate(ctx: FinalAcceptanceContext): Promise<Verdict> {
    const rubric = this.rubrics.get("final_acceptance");

    const missingMustPass = ctx.brief.definitionOfDone.filter(
      (dod) => dod.mustPass && !ctx.verifiedDods.includes(dod.id),
    );

    const passed = ctx.allGatesPassed && missingMustPass.length === 0;
    const score = passed ? 9.2 : 6.0;

    const dimensions = rubric.dimensions.map((dim) => ({
      id: dim.id,
      score,
      rationale: passed
        ? "All Definition-of-Done items verified with passing evidence."
        : `Unsatisfied items: ${missingMustPass.map((m) => m.id).join(", ")}`,
    }));

    const blockers: string[] = [];
    if (!passed) {
      blockers.push(
        `Final acceptance failed: missing verification for ${missingMustPass
          .map((m) => m.id)
          .join(", ")}`,
      );
    }

    return {
      contractId: "FINAL-ACCEPTANCE",
      attempt: 1,
      dimensions,
      composite: score,
      decision: passed ? "APPROVE" : "REVISE",
      blockers,
      defects: [],
      verifiedClaims: ctx.verifiedDods.map((d) => `DoD item ${d} verified`),
      refutedClaims: [],
      summary: passed
        ? "Job satisfies all MissionBrief acceptance criteria."
        : "Job missing required DoD criteria verification.",
    };
  }
}
