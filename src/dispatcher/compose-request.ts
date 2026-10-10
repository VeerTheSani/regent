/**
 * src/dispatcher/compose-request.ts
 *
 * Assembles a structured WorkRequest and renders worker prompt templates per 04 §3.3, 09 §3.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderPrompt } from "../prompts/render.js";
import type { MissionBrief } from "../schemas/brief.js";
import type { Contract } from "../schemas/contract.js";
import type { BridgeConfig, WorkLimits, WorkRequest } from "../workers/types.js";

export interface ComposeOptions {
  jobId: string;
  attempt: number;
  cwd: string;
  attemptDir: string;
  contract: Contract;
  brief: MissionBrief;
  limits: WorkLimits;
  bridge: BridgeConfig;
  resumeSessionId?: string;
  modelOverride?: string;
  critiqueText?: string;
  attemptHistoryText?: string;
  guidanceText?: string;
  env?: Record<string, string>;
}

export function composeWorkRequest(opts: ComposeOptions): WorkRequest {
  const promptsDir = join(process.cwd(), "src", "prompts");

  // 1. Render worker system prompt
  const sysTemplatePath = join(promptsDir, "worker-system.md");
  let sysPrompt = "# Regent Worker System Prompt";
  if (existsSync(sysTemplatePath)) {
    const raw = readFileSync(sysTemplatePath, "utf-8");
    sysPrompt = renderPrompt(raw, {
      writeScope: opts.contract.scope.writePaths.join(", ") || "none",
      contractId: opts.contract.id,
      jobId: opts.jobId,
      attempt: opts.attempt,
    });
  }

  // 2. Render worker task prompt
  const taskTemplatePath = join(promptsDir, "worker-task.md");
  let taskPrompt = `# Contract ${opts.contract.id} — ${opts.contract.title}\n\n${opts.contract.goal}`;
  if (existsSync(taskTemplatePath)) {
    const raw = readFileSync(taskTemplatePath, "utf-8");
    taskPrompt = renderPrompt(raw, {
      contractId: opts.contract.id,
      title: opts.contract.title,
      attempt: opts.attempt,
      goal: opts.contract.goal,
      briefExcerpt: opts.brief.goal,
      contextList: opts.contract.context.map((c) => `- \`${c}\``).join("\n") || "None",
      gatesAsChecklist: opts.contract.acceptance.gates
        .map((g) => `- [ ] Gate \`${g.id}\` (${g.kind})`)
        .join("\n"),
      dodItems: opts.contract.acceptance.dodRefs
        .map((d) => `- [ ] Satisfies Definition-of-Done \`${d}\``)
        .join("\n"),
      visualTargets: opts.contract.acceptance.visualTargets
        .map((v) => `- Target: ${v.name} at ${v.url}`)
        .join("\n"),
      constraints:
        opts.brief.constraints.map((c) => `- ${c}`).join("\n") || "Standard conventions apply.",
      critique: opts.critiqueText ?? "",
      prevAttempt: Math.max(1, opts.attempt - 1),
      verifiedClaims: "Prior gate passes",
      attemptHistory: opts.attemptHistoryText ?? "",
      guidance: opts.guidanceText ?? "",
    });
  }

  return {
    jobId: opts.jobId,
    attempt: opts.attempt,
    cwd: opts.cwd,
    attemptDir: opts.attemptDir,
    taskPrompt,
    systemPrompt: sysPrompt,
    limits: opts.limits,
    bridge: opts.bridge,
    env: opts.env,
    resumeSessionId: opts.resumeSessionId,
    modelOverride: opts.modelOverride,
    contract: {
      id: opts.contract.id,
      title: opts.contract.title,
      kind: opts.contract.kind,
      scope: opts.contract.scope.writePaths,
      allowedTools: [
        "Read",
        "Grep",
        "Glob",
        "Edit",
        "Write",
        "mcp__regent__regent_ask",
        "mcp__regent__regent_report",
        "mcp__regent__regent_progress",
      ],
    },
  };
}
