/**
 * src/schemas/contract.ts
 *
 * Zod schema for Contract per 04 §1.1.
 */

import { z } from "zod";

export const ContractKind = z.enum([
  "code",
  "ui",
  "test",
  "refactor",
  "integration",
  "merge",
  "research",
  "document",
  "browser_task",
  "data",
  "ops",
  "review",
]);
export type ContractKind = z.infer<typeof ContractKind>;

export const GateDefinition = z.object({
  id: z.string(),
  kind: z.enum([
    "command",
    "scope",
    "file_exists",
    "http",
    "no_blank_frame",
    "console_clean",
    "secret_scan",
    "visual_diff",
  ]),
  spec: z.record(z.unknown()),
});
export type GateDefinition = z.infer<typeof GateDefinition>;

export const VisualTargetDefinition = z.object({
  url: z.string(),
  viewport: z.object({
    width: z.number(),
    height: z.number(),
  }),
  waitFor: z.string().optional(),
  selector: z.string().optional(),
  name: z.string(),
});
export type VisualTargetDefinition = z.infer<typeof VisualTargetDefinition>;

export const Contract = z.object({
  id: z.string().describe("Contract ID, e.g. CTR-01"),
  title: z.string(),
  kind: ContractKind,
  goal: z.string().describe("Outcome, not implementation steps"),
  context: z.array(z.string()).default([]),
  scope: z.object({
    writePaths: z.array(z.string()).default([]),
    readPaths: z.array(z.string()).default(["**"]),
    domains: z.array(z.string()).default([]),
  }),
  dependsOn: z.array(z.string()).default([]),
  acceptance: z.object({
    gates: z.array(GateDefinition).default([]),
    dodRefs: z.array(z.string()).default([]),
    rubric: z.string().default("code"),
    visualTargets: z.array(VisualTargetDefinition).default([]),
  }),
  workerPreference: z.array(
    z.enum(["claude-code", "hermes", "vscode", "chatbot", "browser", "shell"]),
  ),
  risk: z.enum(["low", "medium", "high"]).default("medium"),
  budget: z.object({
    maxUsd: z.number(),
    maxAttempts: z.number().int().default(6),
    maxMinutesPerAttempt: z.number().default(30),
  }),
  outputs: z.array(z.string()).default([]),
});
export type Contract = z.infer<typeof Contract>;
