/**
 * test/unit/verdict-recompute.test.ts
 *
 * Acceptance test for M5: Verdict recomputation and convergence rule enforcement.
 */

import { describe, expect, it } from "vitest";
import { recomputeVerdict } from "../../src/judge/recompute.js";
import type { RubricDefinition } from "../../src/judge/rubrics.js";
import type { Verdict } from "../../src/schemas/verdict.js";

describe("M5: Verdict Recomputation", () => {
  const testRubric: RubricDefinition = {
    kind: "code",
    dimensions: [
      { id: "functional", weight: 0.5 },
      { id: "code_quality", weight: 0.5 },
    ],
  };

  it("recomputes composite 7.0 and decision REVISE when judge reported 9.4 with weights implying 7.0", () => {
    // functional (score 6.0 * 0.5 = 3.0) + code_quality (score 8.0 * 0.5 = 4.0) = true composite 7.0
    // But judge erroneously claimed composite 9.4 and APPROVE
    const rawVerdict: Verdict = {
      contractId: "CTR-01",
      attempt: 1,
      dimensions: [
        { id: "functional", score: 6.0 },
        { id: "code_quality", score: 8.0 },
      ],
      composite: 9.4,
      decision: "APPROVE",
      blockers: [],
      defects: [],
      verifiedClaims: [],
      refutedClaims: [],
      summary: "Inconsistent judge evaluation",
    };

    const res = recomputeVerdict(rawVerdict, testRubric, {
      approveThreshold: 8.5,
    });

    expect(res.overridden).toBe(true);
    expect(res.verdict.composite).toBe(7.0);
    expect(res.verdict.decision).toBe("REVISE");
    expect(res.log.some((l) => l.includes("Composite override"))).toBe(true);
    expect(res.log.some((l) => l.includes("Decision override"))).toBe(true);
  });

  it("forces REVISE when a BLOCKER defect is present, even with composite 9.5", () => {
    const rawVerdict: Verdict = {
      contractId: "CTR-01",
      attempt: 1,
      dimensions: [
        { id: "functional", score: 9.5 },
        { id: "code_quality", score: 9.5 },
      ],
      composite: 9.5,
      decision: "APPROVE",
      blockers: [],
      defects: [
        {
          id: "D-1",
          severity: "BLOCKER",
          dimension: "functional",
          evidence: "apps/app.ts:20",
          observed: "Crash on start",
          expected: "Starts cleanly",
          fix: "Add null check",
        },
      ],
      verifiedClaims: [],
      refutedClaims: [],
      summary: "High score but blocker found",
    };

    const res = recomputeVerdict(rawVerdict, testRubric, {
      approveThreshold: 8.5,
    });

    expect(res.overridden).toBe(true);
    expect(res.verdict.composite).toBe(9.5);
    expect(res.verdict.decision).toBe("REVISE");
  });
});
