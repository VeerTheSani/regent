/**
 * src/director/replan.ts
 *
 * Iterative replanning loop running up to 3 rounds with validator errors per 04 §1.
 */

import type { MissionBrief } from "../schemas/brief.js";
import type { Contract } from "../schemas/contract.js";
import { type PlanValidationResult, validatePlan } from "./validate-plan.js";

export interface ReplanResult {
  ok: boolean;
  contracts: Contract[];
  rounds: number;
  errors: string[];
}

export function replanLoop(
  brief: MissionBrief,
  initialContracts: Contract[],
  generator: (brief: MissionBrief, errors: string[]) => Contract[],
  maxRounds = 3,
): ReplanResult {
  let currentContracts = initialContracts;
  let validation = validatePlan(brief, currentContracts);
  let round = 1;

  while (!validation.ok && round <= maxRounds) {
    currentContracts = generator(brief, validation.errors);
    validation = validatePlan(brief, currentContracts);
    round++;
  }

  return {
    ok: validation.ok,
    contracts: currentContracts,
    rounds: round - 1,
    errors: validation.errors,
  };
}
