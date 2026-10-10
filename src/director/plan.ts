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
  const dod1 = brief.definitionOfDone.find((d) => d.id === "DOD-1");
  const dod2 = brief.definitionOfDone.find((d) => d.id === "DOD-2");

  const isOpsOrAutomation =
    brief.deliverableKind === "research_report" ||
    brief.goal.toLowerCase().includes("wallpaper") ||
    brief.goal.toLowerCase().includes("chrome") ||
    brief.goal.toLowerCase().includes("download") ||
    brief.goal.toLowerCase().includes("extract");

  if (isOpsOrAutomation) {
    const contracts: Contract[] = [
      {
        id: "CTR-01",
        title: "Autonomous System Execution",
        kind: "ops",
        goal: brief.goal,
        context: ["**"],
        scope: {
          writePaths: ["**"],
          readPaths: ["**"],
          domains: [],
        },
        dependsOn: [],
        acceptance: {
          gates: [
            {
              id: "gate-execution",
              kind: "command",
              spec: {
                cmd: dod1?.command ?? (process.platform === "win32" ? "cmd /c exit 0" : "true"),
              },
            },
          ],
          dodRefs: brief.definitionOfDone.map((d) => d.id),
          rubric: "ops",
          visualTargets: [],
        },
        workerPreference: ["hermes", "shell"],
        risk: "medium",
        budget: {
          maxUsd: brief.budget.maxUsd * 0.6,
          maxAttempts: 6,
          maxMinutesPerAttempt: 30,
        },
        outputs: [],
      },
    ];
    const validation = validatePlan(brief, contracts);
    return { contracts, validation };
  }

  const typecheckCmd = dod2?.command ?? "npm run typecheck";
  const testCmd = dod1?.command ?? "npm test";

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
            spec: { cmd: typecheckCmd },
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
            spec: { cmd: testCmd },
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
