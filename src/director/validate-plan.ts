/**
 * src/director/validate-plan.ts
 *
 * Deterministic Task Graph Validator per 04 §1.3.
 */

import picomatch from "picomatch";
import type { MissionBrief } from "../schemas/brief.js";
import type { Contract } from "../schemas/contract.js";

export interface PlanValidationResult {
  ok: boolean;
  errors: string[];
}

function pathsOverlap(pathsA: string[], pathsB: string[]): string | null {
  for (const a of pathsA) {
    for (const b of pathsB) {
      if (a === b) return `${a} === ${b}`;

      const normA = a.replace(/\\/g, "/");
      const normB = b.replace(/\\/g, "/");

      // Test if one glob matches the other or vice-versa
      const matchA = picomatch(normA);
      const matchB = picomatch(normB);

      const baseA = normA.replace(/\*+/g, "");
      const baseB = normB.replace(/\*+/g, "");

      if (
        matchA(normB) ||
        matchB(normA) ||
        matchA(baseB) ||
        matchB(baseA) ||
        (baseA && baseB && (baseA.startsWith(baseB) || baseB.startsWith(baseA)))
      ) {
        return `${normA} overlaps with ${normB}`;
      }
    }
  }
  return null;
}

export function validatePlan(brief: MissionBrief, contracts: Contract[]): PlanValidationResult {
  const errors: string[] = [];
  const contractMap = new Map<string, Contract>();

  for (const c of contracts) {
    if (contractMap.has(c.id)) {
      errors.push(`Duplicate contract ID: ${c.id}`);
    }
    contractMap.set(c.id, c);
  }

  // 1. Dependency Existence & Acyclicity (Topological Sort / Cycle Detection)
  const adj = new Map<string, string[]>();
  for (const c of contracts) {
    adj.set(c.id, []);
    for (const dep of c.dependsOn) {
      if (!contractMap.has(dep)) {
        errors.push(`Contract ${c.id} depends on non-existent contract ${dep}`);
      }
    }
  }

  for (const c of contracts) {
    for (const dep of c.dependsOn) {
      if (contractMap.has(dep)) {
        adj.get(dep)?.push(c.id);
      }
    }
  }

  // Cycle detection via DFS colors (0: unvisited, 1: visiting, 2: visited)
  const color = new Map<string, number>();
  for (const id of contractMap.keys()) {
    color.set(id, 0);
  }

  let hasCycle = false;
  const cyclePath: string[] = [];

  function dfs(curr: string, path: string[]) {
    color.set(curr, 1);
    path.push(curr);

    for (const next of adj.get(curr) ?? []) {
      if (color.get(next) === 1) {
        hasCycle = true;
        cyclePath.push(...path.slice(path.indexOf(next)), next);
        return;
      }
      if (color.get(next) === 0) {
        dfs(next, path);
        if (hasCycle) return;
      }
    }

    path.pop();
    color.set(curr, 2);
  }

  for (const id of contractMap.keys()) {
    if (color.get(id) === 0) {
      dfs(id, []);
      if (hasCycle) break;
    }
  }

  if (hasCycle) {
    errors.push(`Cycle detected in contract DAG: ${cyclePath.join(" -> ")}`);
  }

  // 2. Transitive Dependency Graph for Concurrency
  // If neither A depends on B nor B depends on A (directly or transitively), they can run concurrently
  const reachable = new Map<string, Set<string>>();
  for (const c of contracts) {
    const visited = new Set<string>();
    const q = [...c.dependsOn];
    while (q.length > 0) {
      const dep = q.shift();
      if (dep && !visited.has(dep)) {
        visited.add(dep);
        const node = contractMap.get(dep);
        if (node) {
          q.push(...node.dependsOn);
        }
      }
    }
    reachable.set(c.id, visited);
  }

  // Check parallel siblings for disjoint write scopes
  for (let i = 0; i < contracts.length; i++) {
    for (let j = i + 1; j < contracts.length; j++) {
      const c1 = contracts[i];
      const c2 = contracts[j];

      const c1DependsOnC2 = reachable.get(c1.id)?.has(c2.id) ?? false;
      const c2DependsOnC1 = reachable.get(c2.id)?.has(c1.id) ?? false;

      // Parallel-eligible: neither depends on the other
      if (!c1DependsOnC2 && !c2DependsOnC1) {
        const overlap = pathsOverlap(c1.scope.writePaths, c2.scope.writePaths);
        if (overlap) {
          errors.push(
            `Parallel contracts ${c1.id} and ${c2.id} have overlapping write scopes: ${overlap}. Add a dependency edge or separate write paths.`,
          );
        }
      }
    }
  }

  // 3. Definition of Done Coverage
  const coveredDods = new Set<string>();
  for (const c of contracts) {
    for (const dodRef of c.acceptance.dodRefs) {
      coveredDods.add(dodRef);
    }
  }

  for (const dod of brief.definitionOfDone) {
    if (dod.mustPass && !coveredDods.has(dod.id)) {
      errors.push(
        `Must-pass DoD item ${dod.id} ("${dod.statement}") is not satisfied by any contract in the plan.`,
      );
    }
  }

  // 4. Budget Reserve (Sum of contract maxUsd <= 0.8 * job budget)
  const totalContractBudget = contracts.reduce((sum, c) => sum + c.budget.maxUsd, 0);
  const maxAllowedBudget = brief.budget.maxUsd * 0.8;

  if (totalContractBudget > maxAllowedBudget) {
    errors.push(
      `Total contract budget ($${totalContractBudget.toFixed(
        2,
      )}) exceeds 80% of job budget ($${maxAllowedBudget.toFixed(
        2,
      )} out of $${brief.budget.maxUsd.toFixed(2)}). 20% reserve required for revisions/integration.`,
    );
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
