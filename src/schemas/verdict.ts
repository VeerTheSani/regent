/**
 * src/schemas/verdict.ts
 *
 * Zod schema for Judge Verdict and Defects per 08 §4, 09 §4.
 */

import { z } from "zod";

export const DefectSeverity = z.enum(["BLOCKER", "MAJOR", "MINOR", "NIT"]);
export type DefectSeverity = z.infer<typeof DefectSeverity>;

export const Defect = z.object({
  id: z.string().describe("e.g. D-1"),
  severity: DefectSeverity,
  dimension: z.string().describe("e.g. functional, visual_fidelity, code_quality"),
  evidence: z.string().describe("Exact file:line, screenshot region, or log line"),
  observed: z.string(),
  expected: z.string(),
  fix: z.string().describe("Concrete fix instructions"),
});
export type Defect = z.infer<typeof Defect>;

export const DimensionScore = z.object({
  id: z.string(),
  score: z.number().min(0).max(10),
  rationale: z.string().optional(),
});
export type DimensionScore = z.infer<typeof DimensionScore>;

export const Verdict = z.object({
  contractId: z.string(),
  attempt: z.number().int(),
  dimensions: z.array(DimensionScore),
  composite: z.number().min(0).max(10),
  decision: z.enum(["APPROVE", "REVISE", "REPLAN", "ESCALATE"]),
  blockers: z.array(z.string()).default([]),
  defects: z.array(Defect).default([]),
  verifiedClaims: z.array(z.string()).default([]),
  refutedClaims: z.array(z.string()).default([]),
  summary: z.string(),
  model: z.string().optional(),
  usd: z.number().optional(),
});
export type Verdict = z.infer<typeof Verdict>;
