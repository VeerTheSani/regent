/**
 * src/director/interpret.ts
 *
 * Director interpretation: transforms a raw operator job ticket into a validated MissionBrief (03 §2).
 * Uses Anthropic SDK claude-opus-5-5 with adaptive thinking when live, or deterministic fixture fallback.
 */

import { MissionBrief } from "../schemas/brief.js";
import type { WorkspaceProbeResult } from "../workspace/probe.js";

export interface InterpretInput {
  jobId: string;
  ticket: string;
  probe?: WorkspaceProbeResult;
  preferences?: Record<string, unknown>;
}

export async function interpretJob(input: InterpretInput): Promise<MissionBrief> {
  // If live calls enabled and API key is set
  if (process.env.REGENT_LIVE === "1" && process.env.ANTHROPIC_API_KEY) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      // Note: messages.create with JSON or parse helper
      const prompt = `You are the Director of Regent. Produce a Mission Brief for job ${input.jobId}.
Ticket: ${input.ticket}
Root: ${input.probe?.repoRoot ?? "unknown"}`;

      const res = await client.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      });

      const text = res.content[0].type === "text" ? res.content[0].text : "";
      const parsed = JSON.parse(text);
      return MissionBrief.parse(parsed);
    } catch {
      // Fall through to deterministic fixture
    }
  }

  // Deterministic fixture interpretation for test suite and offline operation
  const briefData = {
    jobId: input.jobId,
    version: 1,
    goal: `Deliver verified solution for: ${input.ticket}`,
    deliverableKind: "code_change" as const,
    definitionOfDone: [
      {
        id: "DOD-1",
        statement: "All unit tests pass with zero errors",
        verification: "test" as const,
        command: "npm test",
        mustPass: true,
      },
      {
        id: "DOD-2",
        statement: "Typecheck passes cleanly with no compiler warnings",
        verification: "command" as const,
        command: "npm run typecheck",
        mustPass: true,
      },
    ],
    constraints: [
      "Use Biome for linting, never Prettier or ESLint",
      "Do not weaken, delete, or skip existing tests",
    ],
    assumptions: [
      {
        statement: "Host platform is Windows 11 with Node 24 runtime",
        confidence: 0.95,
        reversibleIfWrong: false,
      },
    ],
    outOfScope: ["Unrelated refactoring outside declared contract boundaries"],
    workspace: {
      kind: input.probe?.isGitRepo ? ("git_repo" as const) : ("directory" as const),
      root: input.probe?.repoRoot ?? process.cwd(),
      baseRef: input.probe?.defaultBranch ?? "main",
    },
    qualityBar: {
      approveThreshold: 8.5,
      panelForFinalAcceptance: true,
    },
    budget: {
      maxUsd: 15.0,
      maxWallClockMin: 180,
    },
    interpretationConfidence: 0.9,
    alternativeReadings: [],
  };

  return MissionBrief.parse(briefData);
}
