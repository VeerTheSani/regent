/**
 * src/judge/recompute.ts
 *
 * Recomputes verdict composite and decision from rubric weights and convergence rules per 03 §4, 08 §4.
 * Overrides inconsistent judge outputs and logs discrepancies.
 */

import type { Verdict } from "../schemas/verdict.js";
import type { RubricDefinition } from "./rubrics.js";

export interface RecomputeOptions {
  approveThreshold?: number;
  allGatesPassed?: boolean;
  dodVerified?: boolean;
}

export interface RecomputedVerdictResult {
  verdict: Verdict;
  overridden: boolean;
  log: string[];
}

export function recomputeVerdict(
  verdict: Verdict,
  rubric: RubricDefinition,
  options: RecomputeOptions = {},
): RecomputedVerdictResult {
  const threshold = options.approveThreshold ?? 8.5;
  const allGatesPassed = options.allGatesPassed ?? true;
  const dodVerified = options.dodVerified ?? true;
  const log: string[] = [];
  let overridden = false;

  // 1. Calculate true weighted composite from dimensions
  let weightedSum = 0;
  let totalWeight = 0;
  const scoreMap = new Map<string, number>();
  for (const dim of verdict.dimensions) {
    scoreMap.set(dim.id, dim.score);
  }

  for (const dim of rubric.dimensions) {
    const s = scoreMap.get(dim.id) ?? 0;
    weightedSum += s * dim.weight;
    totalWeight += dim.weight;
  }

  const calculatedComposite =
    totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;

  let finalComposite = verdict.composite;
  if (Math.abs(verdict.composite - calculatedComposite) >= 0.1) {
    log.push(
      `Composite override: judge reported ${verdict.composite}, recomputed weighted score is ${calculatedComposite}`,
    );
    finalComposite = calculatedComposite;
    overridden = true;
  }

  // 2. Check for BLOCKER defects
  const hasBlockers =
    verdict.blockers.length > 0 || verdict.defects.some((d) => d.severity === "BLOCKER");

  // 3. Determine true decision per convergence rules
  let trueDecision: "APPROVE" | "REVISE" | "REPLAN" | "ESCALATE";
  if (!allGatesPassed || !dodVerified || hasBlockers || finalComposite < threshold) {
    // If judge requested REPLAN or ESCALATE, preserve it; otherwise must be REVISE
    if (verdict.decision === "REPLAN" || verdict.decision === "ESCALATE") {
      trueDecision = verdict.decision;
    } else {
      trueDecision = "REVISE";
    }
  } else {
    trueDecision = "APPROVE";
  }

  let finalDecision = verdict.decision;
  if (verdict.decision !== trueDecision) {
    log.push(
      `Decision override: judge reported ${verdict.decision}, convergence rule demands ${trueDecision} (composite: ${finalComposite}, blockers: ${hasBlockers}, threshold: ${threshold})`,
    );
    finalDecision = trueDecision;
    overridden = true;
  }

  const updatedVerdict: Verdict = {
    ...verdict,
    composite: finalComposite,
    decision: finalDecision,
  };

  return {
    verdict: updatedVerdict,
    overridden,
    log,
  };
}
