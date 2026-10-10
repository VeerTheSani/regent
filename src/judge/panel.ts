/**
 * src/judge/panel.ts
 *
 * Multi-judge Panel (T3) aggregation per 08 §5.
 * Computes median score, spread, union of cited blockers, and triggers Director adjudication if spread > 1.5.
 */

import type { Defect, Verdict } from "../schemas/verdict.js";

export interface PanelResult {
  composite: number;
  spread: number;
  decision: "APPROVE" | "REVISE" | "REPLAN" | "ESCALATE";
  blockers: string[];
  defects: Defect[];
  needsAdjudication: boolean;
  adjudicationReason?: string;
  individualVerdicts: Verdict[];
}

export function aggregatePanel(verdicts: Verdict[], approveThreshold = 8.5): PanelResult {
  if (verdicts.length === 0) {
    throw new Error("Panel requires at least one verdict");
  }

  const scores = verdicts.map((v) => v.composite).sort((a, b) => a - b);
  const mid = Math.floor(scores.length / 2);
  const median = scores.length % 2 !== 0 ? scores[mid] : (scores[mid - 1] + scores[mid]) / 2;

  const minScore = scores[0];
  const maxScore = scores[scores.length - 1];
  const spread = Math.round((maxScore - minScore) * 10) / 10;

  // Union of blockers and defects
  const blockerSet = new Set<string>();
  const defectMap = new Map<string, Defect>();

  for (const v of verdicts) {
    for (const b of v.blockers) blockerSet.add(b);
    for (const d of v.defects) defectMap.set(d.id, d);
  }

  const blockers = Array.from(blockerSet);
  const defects = Array.from(defectMap.values());

  let needsAdjudication = false;
  let adjudicationReason: string | undefined;

  if (spread > 1.5) {
    needsAdjudication = true;
    adjudicationReason = `Judge disagreement spread (${spread.toFixed(
      1,
    )}) exceeds 1.5 point tolerance ceiling`;
  }

  // Consensus decision
  let decision: "APPROVE" | "REVISE" | "REPLAN" | "ESCALATE" = "APPROVE";
  if (
    blockers.length > 0 ||
    defects.some((d) => d.severity === "BLOCKER") ||
    median < approveThreshold
  ) {
    decision = "REVISE";
  }

  return {
    composite: Math.round(median * 10) / 10,
    spread,
    decision,
    blockers,
    defects,
    needsAdjudication,
    adjudicationReason,
    individualVerdicts: verdicts,
  };
}
