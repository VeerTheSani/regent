/**
 * test/unit/final-acceptance.test.ts
 *
 * Acceptance tests for M9: Final Acceptance evaluation against MissionBrief DoD.
 */

import { describe, expect, it } from "vitest";
import { FinalAcceptanceEvaluator } from "../../src/integrator/final-acceptance.js";
import type { MissionBrief } from "../../src/schemas/brief.js";

const TEST_BRIEF: MissionBrief = {
  jobId: "job-fa-1",
  version: 1,
  goal: "Add settings page",
  deliverableKind: "code_change",
  definitionOfDone: [
    {
      id: "DOD-1",
      statement: "/settings renders",
      verification: "visual",
      mustPass: true,
    },
    {
      id: "DOD-2",
      statement: "volumes persist",
      verification: "test",
      mustPass: true,
    },
  ],
  constraints: [],
  assumptions: [],
  outOfScope: [],
  workspace: { kind: "git_repo" },
  qualityBar: { approveThreshold: 8.5, panelForFinalAcceptance: true },
  budget: { maxUsd: 15.0, maxWallClockMin: 120 },
  interpretationConfidence: 0.95,
  alternativeReadings: [],
};

describe("M9: Final Acceptance Evaluator", () => {
  const evaluator = new FinalAcceptanceEvaluator();

  it("produces APPROVE verdict when all gates and must-pass DoDs are verified", async () => {
    const verdict = await evaluator.evaluate({
      brief: TEST_BRIEF,
      allGatesPassed: true,
      verifiedDods: ["DOD-1", "DOD-2"],
      integrationBranch: "regent/job-fa-1",
    });

    expect(verdict.decision).toBe("APPROVE");
    expect(verdict.composite).toBeGreaterThanOrEqual(8.5);
    expect(verdict.blockers.length).toBe(0);
    expect(verdict.verifiedClaims).toContain("DoD item DOD-1 verified");
    expect(verdict.verifiedClaims).toContain("DoD item DOD-2 verified");
  });

  it("produces REVISE verdict with blockers when must-pass DoD item is missing", async () => {
    const verdict = await evaluator.evaluate({
      brief: TEST_BRIEF,
      allGatesPassed: true,
      verifiedDods: ["DOD-1"], // Missing DOD-2!
      integrationBranch: "regent/job-fa-1",
    });

    expect(verdict.decision).toBe("REVISE");
    expect(verdict.composite).toBeLessThan(8.5);
    expect(verdict.blockers.length).toBeGreaterThan(0);
    expect(verdict.blockers[0]).toContain("DOD-2");
  });
});
