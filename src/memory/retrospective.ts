/**
 * src/memory/retrospective.ts
 *
 * Post-job retrospective analysis extracting lessons from completed ledger histories per 09 §9, 10 §4.
 */

import type { LedgerEvent } from "../kernel/ledger.js";
import type { Lesson } from "./lessons.js";

export function analyzeJobRetrospective(
  jobId: string,
  events: LedgerEvent[],
  project = "default",
): Lesson[] {
  const lessons: Lesson[] = [];

  // Check for repeated gate failures on the same contract
  const gateFailures = events.filter((e) => e.type === "gate.result" && !e.payload.passed);

  if (gateFailures.length >= 2) {
    lessons.push({
      id: `L-${Date.now().toString(36)}`,
      scope: { project, kind: "code" },
      observation: `Contract encountered multiple gate failures during execution (${gateFailures.length} occurrences).`,
      evidence: gateFailures.map((e) => `seq:${e.seq}`),
      change: {
        target: "worker-task",
        add: "Execute full verification command locally and inspect compiler diagnostics before calling regent_report.",
      },
      confidence: 0.85,
      created: new Date().toISOString(),
      uses: 0,
      helped: 0,
    });
  }

  // Check for ladder climbs
  const ladderClimbs = events.filter(
    (e) => e.type === "verdict.issued" && e.payload.decision === "REVISE",
  );

  if (ladderClimbs.length >= 2) {
    lessons.push({
      id: `L-${Date.now().toString(36)}-ladder`,
      scope: { project, kind: "ui" },
      observation: "Multiple revision rounds were triggered before convergence.",
      evidence: ladderClimbs.map((e) => `seq:${e.seq}`),
      change: {
        target: "worker-task",
        add: "Ensure visual targets and tokens strictly match repository style guides on initial attempt.",
      },
      confidence: 0.8,
      created: new Date().toISOString(),
      uses: 0,
      helped: 0,
    });
  }

  return lessons;
}
