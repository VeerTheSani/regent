/**
 * src/bridge/schemas.ts
 *
 * Schemas for Regent Bridge tools per 06 §1.1.
 */

import { z } from "zod";

export const AskInput = {
  question: z.string().describe("The exact question you would ask the user"),
  options: z
    .array(z.string())
    .optional()
    .describe("Candidate answers you are choosing between, if any"),
  context: z.string().optional().describe("Why you need this; what you found so far"),
  blocking: z.boolean().default(true).describe("Can you continue on other parts while waiting?"),
  job: z.string().optional(),
  ctr: z.string().optional(),
  attempt: z.number().optional(),
};

export const AskOutput = z.object({
  answer: z.string(),
  kind: z.enum(["fact", "decision", "assumption", "denied", "deferred"]),
  rationale: z.string(),
  provisional: z.string().optional(),
});
export type AskOutput = z.infer<typeof AskOutput>;

export const PermitInput = {
  tool_name: z.string(),
  input: z.record(z.unknown()),
  tool_use_id: z.string().optional(),
  job: z.string().optional(),
  ctr: z.string().optional(),
  attempt: z.number().optional(),
};

export const PermitOutput = z.object({
  behavior: z.enum(["allow", "deny"]),
  updatedInput: z.record(z.unknown()).optional(),
  message: z.string().optional(),
});
export type PermitOutput = z.infer<typeof PermitOutput>;

export const ReportInput = {
  status: z.enum(["done", "blocked", "partial"]),
  summary: z.string(),
  filesChanged: z.array(z.string()).default([]),
  verificationRun: z
    .array(
      z.object({
        command: z.string(),
        exitCode: z.number(),
        note: z.string().optional(),
      }),
    )
    .default([]),
  openIssues: z.array(z.string()).default([]),
  job: z.string().optional(),
  ctr: z.string().optional(),
  attempt: z.number().optional(),
};
