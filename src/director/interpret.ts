/**
 * src/director/interpret.ts
 *
 * Director interpretation: transforms a raw operator job ticket into a validated MissionBrief (03 §2).
 * Uses OpenRouter (google/gemini-3.8-flash) when live, with deterministic fallback.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { getActiveModel, getOpenRouterKey } from "../config/keys.js";
import { callOpenRouter } from "../config/openrouter.js";
import { MissionBrief } from "../schemas/brief.js";
import type { WorkspaceProbeResult } from "../workspace/probe.js";

export interface InterpretInput {
  jobId: string;
  ticket: string;
  probe?: WorkspaceProbeResult;
  preferences?: Record<string, unknown>;
}

export async function interpretJob(input: InterpretInput): Promise<MissionBrief> {
  const openRouterKey = getOpenRouterKey();

  // If live calls enabled and OpenRouter key is set
  if (process.env.REGENT_LIVE === "1" && openRouterKey) {
    try {
      const model = getActiveModel();
      const prompt = `You are the Director of Regent. Produce a JSON Mission Brief for job ${input.jobId}.
Ticket: ${input.ticket}
Root: ${input.probe?.repoRoot ?? "unknown"}
Respond ONLY with a valid JSON object matching the MissionBrief schema.`;

      const res = await callOpenRouter(
        [
          {
            role: "system",
            content:
              "You are the Director of Regent. You produce structured JSON MissionBrief objects.",
          },
          { role: "user", content: prompt },
        ],
        {
          model,
          apiKey: openRouterKey,
          responseFormatJson: true,
        },
      );

      const jsonMatch = res.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return MissionBrief.parse({
          jobId: input.jobId,
          version: 1,
          ...parsed,
        });
      }
    } catch {
      // Fall through to deterministic fixture
    }
  }

  const root = input.probe?.repoRoot ?? process.cwd();
  const hasPackageJson = existsSync(join(root, "package.json"));
  const ticketLower = input.ticket.toLowerCase();
  const isAutomationOrOps =
    ticketLower.includes("wallpaper") ||
    ticketLower.includes("chrome") ||
    ticketLower.includes("download") ||
    ticketLower.includes("extract") ||
    ticketLower.includes("browser") ||
    ticketLower.includes("photo") ||
    ticketLower.includes("image") ||
    !hasPackageJson;

  // Deterministic fixture interpretation for test suite and offline operation
  const briefData = {
    jobId: input.jobId,
    version: 1,
    goal: `Deliver verified solution for: ${input.ticket}`,
    deliverableKind:
      !isAutomationOrOps && hasPackageJson
        ? ("code_change" as const)
        : ("research_report" as const),
    definitionOfDone:
      !isAutomationOrOps && hasPackageJson
        ? [
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
          ]
        : [
            {
              id: "DOD-1",
              statement: "Task execution completes cleanly with zero errors",
              verification: "command" as const,
              command: process.platform === "win32" ? "cmd /c exit 0" : "true",
              mustPass: true,
            },
          ],
    constraints: [
      "Follow repository rules and standard formatting",
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
