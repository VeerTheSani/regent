/**
 * test/unit/validate-plan.test.ts
 *
 * Acceptance tests for M5 Plan Validator per 04 §1.3.
 */

import { describe, expect, it } from "vitest";
import { validatePlan } from "../../src/director/validate-plan.js";
import type { MissionBrief } from "../../src/schemas/brief.js";
import type { Contract } from "../../src/schemas/contract.js";

const BASE_BRIEF: MissionBrief = {
  jobId: "job-val",
  version: 1,
  goal: "Build settings page with volume sliders and theme switch",
  deliverableKind: "code_change",
  definitionOfDone: [
    {
      id: "DOD-1",
      statement: "Settings store wired",
      verification: "test",
      mustPass: true,
    },
    {
      id: "DOD-2",
      statement: "Settings UI rendered",
      verification: "visual",
      mustPass: true,
    },
  ],
  constraints: [],
  assumptions: [],
  outOfScope: [],
  workspace: { kind: "git_repo" },
  qualityBar: { approveThreshold: 8.5, panelForFinalAcceptance: true },
  budget: { maxUsd: 10.0, maxWallClockMin: 120 },
  interpretationConfidence: 0.95,
  alternativeReadings: [],
};

describe("M5: Plan Validator", () => {
  it("detects cycles in contract DAG and returns error", () => {
    const cyclicContracts: Contract[] = [
      {
        id: "CTR-01",
        title: "C1",
        kind: "code",
        goal: "G1",
        context: [],
        scope: { writePaths: ["src/c1/**"], readPaths: ["**"], domains: [] },
        dependsOn: ["CTR-02"], // Cycle: 1 -> 2 -> 1
        acceptance: { gates: [], dodRefs: ["DOD-1"], rubric: "code", visualTargets: [] },
        workerPreference: ["claude-code"],
        risk: "low",
        budget: { maxUsd: 2.0, maxAttempts: 6, maxMinutesPerAttempt: 20 },
        outputs: [],
      },
      {
        id: "CTR-02",
        title: "C2",
        kind: "code",
        goal: "G2",
        context: [],
        scope: { writePaths: ["src/c2/**"], readPaths: ["**"], domains: [] },
        dependsOn: ["CTR-01"],
        acceptance: { gates: [], dodRefs: ["DOD-2"], rubric: "code", visualTargets: [] },
        workerPreference: ["claude-code"],
        risk: "low",
        budget: { maxUsd: 2.0, maxAttempts: 6, maxMinutesPerAttempt: 20 },
        outputs: [],
      },
    ];

    const res = validatePlan(BASE_BRIEF, cyclicContracts);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("Cycle detected"))).toBe(true);
  });

  it("detects overlapping write scopes between parallel-eligible siblings", () => {
    const overlappingContracts: Contract[] = [
      {
        id: "CTR-A",
        title: "A",
        kind: "code",
        goal: "GA",
        context: [],
        scope: {
          writePaths: ["packages/core/src/**"],
          readPaths: ["**"],
          domains: [],
        },
        dependsOn: [], // Can run in parallel with B
        acceptance: { gates: [], dodRefs: ["DOD-1"], rubric: "code", visualTargets: [] },
        workerPreference: ["claude-code"],
        risk: "low",
        budget: { maxUsd: 2.0, maxAttempts: 6, maxMinutesPerAttempt: 20 },
        outputs: [],
      },
      {
        id: "CTR-B",
        title: "B",
        kind: "code",
        goal: "GB",
        context: [],
        scope: {
          writePaths: ["packages/core/src/index.ts"], // Overlaps with CTR-A!
          readPaths: ["**"],
          domains: [],
        },
        dependsOn: [],
        acceptance: { gates: [], dodRefs: ["DOD-2"], rubric: "code", visualTargets: [] },
        workerPreference: ["claude-code"],
        risk: "low",
        budget: { maxUsd: 2.0, maxAttempts: 6, maxMinutesPerAttempt: 20 },
        outputs: [],
      },
    ];

    const res = validatePlan(BASE_BRIEF, overlappingContracts);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("overlapping write scopes"))).toBe(true);
  });

  it("enforces 20% budget reserve (fails when contract sum > 0.8 * job budget)", () => {
    // Brief budget is $10.0, 80% ceiling is $8.0
    const expensiveContracts: Contract[] = [
      {
        id: "CTR-01",
        title: "C1",
        kind: "code",
        goal: "G1",
        context: [],
        scope: { writePaths: ["src/a/**"], readPaths: ["**"], domains: [] },
        dependsOn: [],
        acceptance: { gates: [], dodRefs: ["DOD-1"], rubric: "code", visualTargets: [] },
        workerPreference: ["claude-code"],
        risk: "low",
        budget: { maxUsd: 5.0, maxAttempts: 6, maxMinutesPerAttempt: 20 },
        outputs: [],
      },
      {
        id: "CTR-02",
        title: "C2",
        kind: "code",
        goal: "G2",
        context: [],
        scope: { writePaths: ["src/b/**"], readPaths: ["**"], domains: [] },
        dependsOn: ["CTR-01"],
        acceptance: { gates: [], dodRefs: ["DOD-2"], rubric: "code", visualTargets: [] },
        workerPreference: ["claude-code"],
        risk: "low",
        budget: { maxUsd: 4.0, maxAttempts: 6, maxMinutesPerAttempt: 20 }, // 5 + 4 = $9 > $8!
        outputs: [],
      },
    ];

    const res = validatePlan(BASE_BRIEF, expensiveContracts);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("exceeds 80% of job budget"))).toBe(true);
  });

  it("validates the 5-contract Aikami settings-page example from 04 §2 cleanly", () => {
    const brief: MissionBrief = {
      ...BASE_BRIEF,
      definitionOfDone: [
        { id: "DOD-1", statement: "Settings store wired", verification: "test", mustPass: true },
        { id: "DOD-2", statement: "UI route rendered", verification: "visual", mustPass: true },
        {
          id: "DOD-3",
          statement: "E2E persistence verified",
          verification: "test",
          mustPass: true,
        },
        { id: "DOD-4", statement: "Integrated CI pass", verification: "command", mustPass: true },
      ],
      budget: { maxUsd: 20.0, maxWallClockMin: 180 },
    };

    // Example from 04 §2:
    // CTR-01 research -> CTR-02 code || CTR-03 ui -> CTR-04 test -> CTR-05 integration
    const aikamiGraph: Contract[] = [
      {
        id: "CTR-01",
        title: "Find existing settings store + theme mechanism",
        kind: "research",
        goal: "Discover settings store API and token conventions",
        context: ["packages/**"],
        scope: { writePaths: [], readPaths: ["**"], domains: [] },
        dependsOn: [],
        acceptance: { gates: [], dodRefs: [], rubric: "research", visualTargets: [] },
        workerPreference: ["hermes", "claude-code"],
        risk: "low",
        budget: { maxUsd: 1.0, maxAttempts: 3, maxMinutesPerAttempt: 15 },
        outputs: ["settings_store_path", "theme_tokens"],
      },
      {
        id: "CTR-02",
        title: "Wire volume + theme into settings store",
        kind: "code",
        goal: "Add volume and theme fields to store",
        context: ["packages/frontend/services/**"],
        scope: {
          writePaths: ["packages/frontend/services/**"],
          readPaths: ["**"],
          domains: [],
        },
        dependsOn: ["CTR-01"],
        acceptance: { gates: [], dodRefs: ["DOD-1"], rubric: "code", visualTargets: [] },
        workerPreference: ["claude-code"],
        risk: "medium",
        budget: { maxUsd: 3.5, maxAttempts: 6, maxMinutesPerAttempt: 30 },
        outputs: ["settings_service"],
      },
      {
        id: "CTR-03",
        title: "Build /settings route UI per aikami-ui",
        kind: "ui",
        goal: "Render volume slider and theme switch in settings page",
        context: ["apps/frontend/client/src/routes/settings/**"],
        scope: {
          writePaths: ["apps/frontend/client/src/routes/settings/**"], // Disjoint from CTR-02!
          readPaths: ["**"],
          domains: [],
        },
        dependsOn: ["CTR-01"],
        acceptance: { gates: [], dodRefs: ["DOD-2"], rubric: "ui", visualTargets: [] },
        workerPreference: ["claude-code"],
        risk: "medium",
        budget: { maxUsd: 4.0, maxAttempts: 6, maxMinutesPerAttempt: 30 },
        outputs: ["settings_page"],
      },
      {
        id: "CTR-04",
        title: "E2E: sliders persist, toggle switches theme",
        kind: "test",
        goal: "Automate user flow and state persistence test",
        context: ["apps/e2e/**"],
        scope: { writePaths: ["apps/e2e/**"], readPaths: ["**"], domains: [] },
        dependsOn: ["CTR-02", "CTR-03"],
        acceptance: { gates: [], dodRefs: ["DOD-3"], rubric: "test", visualTargets: [] },
        workerPreference: ["claude-code"],
        risk: "medium",
        budget: { maxUsd: 3.0, maxAttempts: 6, maxMinutesPerAttempt: 25 },
        outputs: ["e2e_spec"],
      },
      {
        id: "CTR-05",
        title: "Merge, run bun moon ci, capture final screenshots",
        kind: "integration",
        goal: "Full integration gate pass across all packages",
        context: ["**"],
        scope: { writePaths: ["**"], readPaths: ["**"], domains: [] },
        dependsOn: ["CTR-04"],
        acceptance: { gates: [], dodRefs: ["DOD-4"], rubric: "integration", visualTargets: [] },
        workerPreference: ["claude-code"],
        risk: "high",
        budget: { maxUsd: 2.5, maxAttempts: 6, maxMinutesPerAttempt: 30 },
        outputs: ["integration_branch"],
      },
    ];

    const res = validatePlan(brief, aikamiGraph);
    expect(res.ok).toBe(true);
    expect(res.errors).toEqual([]);
  });
});
