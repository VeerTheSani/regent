/**
 * src/schemas/brief.ts
 *
 * Zod schema for MissionBrief per 03 §2.
 */

import { z } from "zod";

export const DefinitionOfDoneItem = z.object({
  id: z.string().describe("DOD identifier, e.g. DOD-1"),
  statement: z
    .string()
    .describe("Checkable condition, e.g. Route /settings renders without console errors"),
  verification: z.enum(["command", "test", "visual", "http", "file", "judge"]),
  command: z.string().optional().describe("Command when verification = command|test"),
  mustPass: z.boolean().default(true),
});
export type DefinitionOfDoneItem = z.infer<typeof DefinitionOfDoneItem>;

export const AssumptionItem = z.object({
  statement: z.string(),
  confidence: z.number().min(0).max(1),
  reversibleIfWrong: z.boolean(),
});
export type AssumptionItem = z.infer<typeof AssumptionItem>;

export const MissionBrief = z.object({
  jobId: z.string(),
  version: z.number().int().default(1),
  goal: z.string().describe("One paragraph, outcome-focused, in the operator's terms"),
  deliverableKind: z.enum([
    "code_change",
    "new_project",
    "document",
    "research_report",
    "web_task",
    "data",
    "mixed",
  ]),
  definitionOfDone: z.array(DefinitionOfDoneItem).min(1),
  constraints: z.array(z.string()).default([]),
  assumptions: z.array(AssumptionItem).default([]),
  outOfScope: z.array(z.string()).default([]),
  workspace: z.object({
    kind: z.enum(["git_repo", "directory", "none"]),
    root: z.string().optional(),
    baseRef: z.string().optional(),
    profileId: z.string().optional(),
  }),
  qualityBar: z.object({
    approveThreshold: z.number().default(8.5),
    panelForFinalAcceptance: z.boolean().default(true),
  }),
  budget: z.object({
    maxUsd: z.number(),
    maxWallClockMin: z.number(),
  }),
  interpretationConfidence: z.number().min(0).max(1),
  alternativeReadings: z
    .array(z.string())
    .default([])
    .describe("Other plausible readings and why they were rejected"),
});
export type MissionBrief = z.infer<typeof MissionBrief>;
