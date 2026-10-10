/**
 * src/judge/rubrics.ts
 *
 * Rubrics loader and weighted score calculations per 08 §3.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

export interface RubricDimension {
  id: string;
  weight: number;
  anchors?: Record<string | number, string>;
}

export interface RubricDefinition {
  kind: string;
  dimensions: RubricDimension[];
  blockers?: string[];
}

export class RubricRegistry {
  private cache: Map<string, RubricDefinition> = new Map();
  private readonly rubricsDir: string;

  constructor(rubricsDir?: string) {
    this.rubricsDir = rubricsDir ?? join(process.cwd(), "rubrics");
  }

  get(kind: string): RubricDefinition {
    const cached = this.cache.get(kind);
    if (cached) {
      return cached;
    }

    const filePath = join(this.rubricsDir, `${kind}.yaml`);
    if (existsSync(filePath)) {
      try {
        const parsed = parse(readFileSync(filePath, "utf-8")) as RubricDefinition;
        if (parsed.dimensions && Array.isArray(parsed.dimensions)) {
          this.cache.set(kind, parsed);
          return parsed;
        }
      } catch {}
    }

    // Default fallback rubric
    const fallback: RubricDefinition = {
      kind,
      dimensions: [
        { id: "functional", weight: 0.4 },
        { id: "code_quality", weight: 0.3 },
        { id: "robustness", weight: 0.2 },
        { id: "scope_discipline", weight: 0.1 },
      ],
      blockers: [
        "Requirement claimed but not visible in evidence",
        "Test weakened, skipped, or deleted",
      ],
    };

    this.cache.set(kind, fallback);
    return fallback;
  }

  computeComposite(kind: string, scores: Array<{ id: string; score: number }>): number {
    const rubric = this.get(kind);
    let weightedSum = 0;
    let totalWeight = 0;

    const scoreMap = new Map<string, number>();
    for (const s of scores) {
      scoreMap.set(s.id, s.score);
    }

    for (const dim of rubric.dimensions) {
      const score = scoreMap.get(dim.id) ?? 0;
      weightedSum += score * dim.weight;
      totalWeight += dim.weight;
    }

    if (totalWeight <= 0) return 0;
    const raw = weightedSum / totalWeight;
    // Round to 1 decimal place
    return Math.round(raw * 10) / 10;
  }
}
