/**
 * test/unit/director.test.ts
 *
 * Acceptance tests for M5 Director: interpretation and task graph planning.
 */

import { describe, expect, it } from "vitest";
import { interpretJob } from "../../src/director/interpret.js";
import { generatePlan } from "../../src/director/plan.js";
import { MissionBrief } from "../../src/schemas/brief.js";
import { Contract } from "../../src/schemas/contract.js";

describe("M5: Director (Interpretation & Planning)", () => {
  it("interprets raw ticket into a valid MissionBrief schema", async () => {
    const brief = await interpretJob({
      jobId: "job-int-1",
      ticket: "Add volume slider and dark-mode toggle to settings page",
      probe: {
        isGitRepo: true,
        repoRoot: "C:/projects/app",
        defaultBranch: "main",
        isDirty: false,
        dirtyFiles: [],
        packageScripts: { test: "vitest run" },
        hasAgentsMd: true,
        hasClaudeMd: true,
      },
    });

    // Validates against Zod schema without throwing
    expect(() => MissionBrief.parse(brief)).not.toThrow();
    expect(brief.jobId).toBe("job-int-1");
    expect(brief.definitionOfDone.length).toBeGreaterThanOrEqual(1);
    expect(brief.budget.maxUsd).toBeGreaterThan(0);
    expect(brief.interpretationConfidence).toBeGreaterThanOrEqual(0.6);
  });

  it("generates a valid DAG plan from a MissionBrief", async () => {
    const brief = await interpretJob({
      jobId: "job-int-2",
      ticket: "Build user profile endpoint and test suite",
    });

    const { contracts, validation } = generatePlan(brief);

    expect(contracts.length).toBeGreaterThanOrEqual(1);
    for (const c of contracts) {
      expect(() => Contract.parse(c)).not.toThrow();
    }

    expect(validation.ok).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it("live Director call produces valid brief when REGENT_LIVE=1", async () => {
    if (process.env.REGENT_LIVE !== "1" || !process.env.ANTHROPIC_API_KEY) {
      // Gated offline test
      expect(true).toBe(true);
      return;
    }

    const liveBrief = await interpretJob({
      jobId: "job-live-1",
      ticket: "Implement health check endpoint",
    });

    expect(() => MissionBrief.parse(liveBrief)).not.toThrow();
  });
});
