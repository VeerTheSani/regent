/**
 * src/bridge/permits.ts
 *
 * Permission arbiter for Claude Code and other worker tool calls (06 §3).
 * Maps worker tool invocations to Charter actions.
 */

import type { Charter, CharterContext } from "../kernel/charter.js";
import type { Ledger } from "../kernel/ledger.js";

export interface CorrelationIds {
  job: string;
  ctr: string;
  attempt: number;
}

export interface PermitRequest {
  tool_name: string;
  input: Record<string, unknown>;
  tool_use_id?: string;
  tainted?: boolean;
}

export interface PermitResponse {
  behavior: "allow" | "deny";
  updatedInput?: Record<string, unknown>;
  message?: string;
}

export function toAction(
  toolName: string,
  input: Record<string, unknown>,
): { name: string; target: Record<string, unknown> } {
  switch (toolName) {
    case "Bash": {
      const command = String(input.command ?? "");
      const cwd = input.cwd ? String(input.cwd) : undefined;
      // Extract git command specifics if applicable
      if (/^git\s+push/i.test(command)) {
        const parts = command.split(/\s+/);
        const branch = parts[parts.length - 1];
        return {
          name: "git.push",
          target: { command, cwd, branch, remote: "origin" },
        };
      }
      if (/^git\s+merge/i.test(command)) {
        const parts = command.split(/\s+/);
        const targetBranch = parts[parts.length - 1];
        return {
          name: "git.merge",
          target: { command, cwd, targetBranch },
        };
      }
      return {
        name: "shell.exec",
        target: { command, cwd },
      };
    }

    case "Write":
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit": {
      const path = String(input.file_path ?? input.path ?? "");
      return {
        name: "fs.write",
        target: { path, ...input },
      };
    }

    case "Read":
    case "Grep":
    case "Glob":
    case "LS": {
      const path = String(input.file_path ?? input.path ?? "");
      return {
        name: "fs.read",
        target: { path, ...input },
      };
    }

    case "WebFetch":
      return {
        name: "net.get",
        target: { url: input.url },
      };

    default:
      if (toolName.startsWith("mcp__playwright__") || toolName.startsWith("browser_")) {
        if (toolName.includes("submit") || toolName.includes("click")) {
          return {
            name: "browser.submit",
            target: { formKind: input.formKind, url: input.url, ...input },
          };
        }
        if (toolName.includes("navigate") || toolName.includes("open")) {
          return {
            name: "browser.navigate",
            target: { url: input.url },
          };
        }
        return {
          name: "browser.action",
          target: { ...input },
        };
      }

      return {
        name: toolName,
        target: { ...input },
      };
  }
}

export class PermitArbiter {
  constructor(
    private readonly charter: Charter,
    private readonly ledger: Ledger,
    private readonly getContext: (ids: CorrelationIds) => CharterContext,
  ) {}

  async decide(ids: CorrelationIds, req: PermitRequest): Promise<PermitResponse> {
    const action = toAction(req.tool_name, req.input);
    const tainted = Boolean(req.tainted);
    const ctx = this.getContext(ids);

    const d = this.charter.evaluate(
      {
        jobId: ids.job,
        contractId: ids.ctr,
        actor: "worker",
        action: action.name,
        target: action.target,
        tainted,
      },
      ctx,
    );

    this.ledger.append({
      type: "permission.decided",
      jobId: ids.job,
      ctrId: ids.ctr,
      attempt: ids.attempt,
      actor: "permit_arbiter",
      payload: {
        tool: req.tool_name,
        action: action.name,
        target: action.target,
        decision: d,
      },
    });

    if (d.kind === "allow") {
      return { behavior: "allow", updatedInput: req.input };
    }

    if (d.kind === "deny") {
      return {
        behavior: "deny",
        message: `Regent charter: ${d.reason}. Find another way that stays inside your contract scope.`,
      };
    }

    // needs_grant
    if (d.level === "A2") {
      // In M3: tainted A2 without Director re-validation is denied with explanation
      return {
        behavior: "deny",
        message:
          "Regent charter: tainted A2 action requires Director re-validation. Forbidden without grant.",
      };
    }

    // A3 / A4
    return {
      behavior: "deny",
      message: `This needs operator approval (${d.level}). It has been requested. Do not retry; finish everything else and report status "blocked" if this is essential.`,
    };
  }
}
