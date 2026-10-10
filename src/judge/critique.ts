/**
 * src/judge/critique.ts
 *
 * Deterministic critique renderer by code per 09 §4.
 * Turns structured Verdict defects and scores into a consistent markdown critique.
 */

import type { Defect, Verdict } from "../schemas/verdict.js";

export function renderCritique(verdict: Verdict, approveThreshold = 8.5): string {
  const parts: string[] = [];

  // Header line
  parts.push(
    `Score: ${verdict.composite.toFixed(1)} / 10 (need ${approveThreshold.toFixed(
      1,
    )}). Decision: ${verdict.decision}.\n`,
  );

  const severities = ["BLOCKER", "MAJOR", "MINOR", "NIT"] as const;

  for (const sev of severities) {
    const sevDefects = verdict.defects.filter((d) => d.severity === sev);
    if (sevDefects.length === 0) continue;

    parts.push(sev);
    for (const d of sevDefects) {
      parts.push(
        `- ${d.id} [${d.dimension}] evidence: ${d.evidence}\n  Observed: ${d.observed}\n  Expected: ${d.expected}\n  Fix: ${d.fix}`,
      );
    }
    parts.push(""); // blank line after severity group
  }

  // Verified claims
  if (verdict.verifiedClaims.length > 0) {
    parts.push(`Verified (keep these): ${verdict.verifiedClaims.join("; ")}.`);
  }

  // Refuted claims
  if (verdict.refutedClaims.length > 0) {
    parts.push(`Refuted claims: ${verdict.refutedClaims.join("; ")}.`);
  }

  return `${parts.join("\n").trim()}\n`;
}
