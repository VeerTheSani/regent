/**
 * src/director/plan.ts
 *
 * Task Graph Planner per 04 §1.
 * Decomposes a MissionBrief into a validated DAG of contracts.
 */

import type { MissionBrief } from "../schemas/brief.js";
import type { Contract } from "../schemas/contract.js";
import { type PlanValidationResult, validatePlan } from "./validate-plan.js";

export interface PlanOptions {
  availableWorkers?: string[];
  maxRounds?: number;
}

export function generatePlan(
  brief: MissionBrief,
  _options: PlanOptions = {},
): { contracts: Contract[]; validation: PlanValidationResult } {
  // If brief already has a standard plan shape or is generated
  // Baseline contract decomposition satisfying brief DoD items
  const contracts: Contract[] = [
    {
      id: "CTR-01",
      title: "Core Implementation",
      kind: "code",
      goal: brief.goal,
      context: ["src/**"],
      scope: {
        writePaths: ["src/**"],
        readPaths: ["**"],
        domains: [],
      },
      dependsOn: [],
      acceptance: {
        gates: [
          {
            id: "gate-typecheck",
            kind: "command",
            spec: { cmd: "npm run typecheck" },
          },
        ],
        dodRefs: ["DOD-2"],
        rubric: "code",
        visualTargets: [],
      },
      workerPreference: ["claude-code", "hermes"],
      risk: "medium",
      budget: {
        maxUsd: brief.budget.maxUsd * 0.4,
        maxAttempts: 6,
        maxMinutesPerAttempt: 30,
      },
      outputs: ["src/"],
    },
    {
      id: "CTR-02",
      title: "Verification Suite",
      kind: "test",
      goal: "Write and execute unit tests proving requirements",
      context: ["src/**", "test/**"],
      scope: {
        writePaths: ["test/**"],
        readPaths: ["**"],
        domains: [],
      },
      dependsOn: ["CTR-01"],
      acceptance: {
        gates: [
          {
            id: "gate-test",
            kind: "command",
            spec: { cmd: "npm test" },
          },
        ],
        dodRefs: ["DOD-1"],
        rubric: "test",
        visualTargets: [],
      },
      workerPreference: ["claude-code", "hermes"],
      risk: "low",
      budget: {
        maxUsd: brief.budget.maxUsd * 0.2,
        maxAttempts: 6,
        maxMinutesPerAttempt: 20,
      },
      outputs: ["test/"],
    },
  ];

  const validation = validatePlan(brief, contracts);
  return { contracts, validation };
}
