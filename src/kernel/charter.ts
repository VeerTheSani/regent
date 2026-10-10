/**
 * src/kernel/charter.ts
 *
 * Authority Charter engine per 02 §1, §7.
 */

import { isAbsolute, relative, resolve } from "node:path";
import picomatch from "picomatch";
import { z } from "zod";
import type { GrantStore } from "./grants.js";
import type { KillSwitch } from "./kill-switch.js";

export const AuthorityLevel = z.enum(["A0", "A1", "A2", "A3", "A4", "AX"]);
export type AuthorityLevel = z.infer<typeof AuthorityLevel>;

export interface ActionRequest {
  jobId: string;
  contractId?: string;
  actor: string;
  action: string;
  target: Record<string, unknown>;
  tainted: boolean;
}

export type CharterDecision =
  | { kind: "allow"; level: AuthorityLevel; grantId?: string }
  | { kind: "deny"; level: AuthorityLevel; reason: string }
  | { kind: "needs_grant"; level: AuthorityLevel; reason: string };

export interface CharterRuleWhen {
  pathMatches?: string[];
  commandMatches?: string[];
  branchMatches?: string[];
  targetBranchMatches?: string[];
  formKind?: string[];
  insideAttemptDir?: boolean;
  cwdInsideAttemptDir?: boolean;
  insideWorkspace?: boolean;
}

export interface CharterRule {
  level: AuthorityLevel;
  action: string;
  when?: CharterRuleWhen;
}

export interface CharterContext {
  workspaceRoots: string[];
  attemptDir: string;
}

function isPathInside(parent: string, child: string): boolean {
  if (!parent || !child) return false;
  const rel = relative(resolve(parent), resolve(child));
  return !rel.startsWith("..") && !isAbsolute(rel);
}

export class Charter {
  constructor(
    private readonly rules: CharterRule[],
    private readonly grants: GrantStore,
    private readonly killSwitch: KillSwitch,
  ) {}

  evaluate(req: ActionRequest, ctx: CharterContext): CharterDecision {
    if (this.killSwitch.engaged()) {
      return { kind: "deny", level: "AX", reason: "kill switch engaged" };
    }

    const level = this.classify(req, ctx);
    switch (level) {
      case "A0":
      case "A1":
        return { kind: "allow", level };

      case "A2":
        return req.tainted
          ? {
              kind: "needs_grant",
              level,
              reason: "tainted A2 action requires Director re-validation",
            }
          : { kind: "allow", level };

      case "A3":
      case "A4": {
        const grant = this.grants.match(req.jobId, req.action, req.target);
        if (grant && !this.grants.isExpired(grant) && this.grants.hasUsesLeft(grant)) {
          this.grants.consume(grant.id);
          return { kind: "allow", level, grantId: grant.id };
        }
        return {
          kind: "needs_grant",
          level,
          reason: `${req.action} is ${level} and no matching grant exists`,
        };
      }

      case "AX":
        return {
          kind: "deny",
          level,
          reason: `${req.action} is forbidden by charter`,
        };
    }
  }

  /**
   * Evaluates ordered rules. First match wins. Unknown actions default to A3 (fail closed).
   */
  classify(req: ActionRequest, ctx: CharterContext): AuthorityLevel {
    for (const rule of this.rules) {
      if (this.matchesRule(rule, req, ctx)) {
        return rule.level;
      }
    }
    return "A3";
  }

  private matchesRule(rule: CharterRule, req: ActionRequest, ctx: CharterContext): boolean {
    const actionMatch = picomatch(rule.action);
    if (!actionMatch(req.action) && rule.action !== req.action) {
      return false;
    }

    if (!rule.when) return true;
    const when = rule.when;

    // 1. pathMatches
    if (when.pathMatches && when.pathMatches.length > 0) {
      const targetPath = String(req.target.path ?? "");
      if (!targetPath) return false;
      const normalizedPath = targetPath.replace(/\\/g, "/");
      const userHome = (process.env.USERPROFILE || process.env.HOME || "C:/Users/sanis").replace(
        /\\/g,
        "/",
      );

      const matched = when.pathMatches.some((pattern) => {
        let p = pattern.replace(/\\/g, "/");
        if (p.startsWith("~/")) {
          p = p.replace(/^~/, userHome);
          return (
            normalizedPath.toLowerCase() === p.toLowerCase() ||
            normalizedPath.toLowerCase().endsWith(pattern.replace(/^~\//, "/").toLowerCase())
          );
        }
        const isMatch = picomatch(p, { dot: true });
        return isMatch(normalizedPath) || normalizedPath.includes(p.replace(/\*+/g, ""));
      });
      if (!matched) return false;
    }

    // 2. commandMatches (regex)
    if (when.commandMatches && when.commandMatches.length > 0) {
      const command = String(req.target.command ?? "");
      if (!command) return false;
      const matched = when.commandMatches.some((pattern) => {
        try {
          let regexPattern = pattern;
          let flags = "";
          if (regexPattern.startsWith("(?i)")) {
            flags += "i";
            regexPattern = regexPattern.slice(4);
          }
          const re = new RegExp(regexPattern, flags);
          return re.test(command);
        } catch {
          return command.toLowerCase().includes(pattern.toLowerCase());
        }
      });
      if (!matched) return false;
    }

    // 3. branchMatches
    if (when.branchMatches && when.branchMatches.length > 0) {
      const branch = String(req.target.branch ?? "");
      if (!branch) return false;
      const matched = when.branchMatches.some((pattern) => {
        const isMatch = picomatch(pattern);
        return isMatch(branch) || pattern === branch;
      });
      if (!matched) return false;
    }

    // 4. targetBranchMatches
    if (when.targetBranchMatches && when.targetBranchMatches.length > 0) {
      const targetBranch = String(req.target.targetBranch ?? req.target.branch ?? "");
      if (!targetBranch) return false;
      const matched = when.targetBranchMatches.some((pattern) => {
        const isMatch = picomatch(pattern);
        return isMatch(targetBranch) || pattern === targetBranch;
      });
      if (!matched) return false;
    }

    // 5. formKind
    if (when.formKind && when.formKind.length > 0) {
      const kind = String(req.target.formKind ?? "");
      if (!kind) return false;
      if (!when.formKind.includes(kind)) return false;
    }

    // 6. insideAttemptDir
    if (when.insideAttemptDir) {
      const targetPath = String(req.target.path ?? "");
      if (!targetPath || !ctx.attemptDir) return false;
      if (!isPathInside(ctx.attemptDir, targetPath)) return false;
    }

    // 7. cwdInsideAttemptDir
    if (when.cwdInsideAttemptDir) {
      const cwd = String(req.target.cwd ?? "");
      if (!cwd || !ctx.attemptDir) return false;
      if (!isPathInside(ctx.attemptDir, cwd) && resolve(cwd) !== resolve(ctx.attemptDir)) {
        return false;
      }
    }

    // 8. insideWorkspace
    if (when.insideWorkspace) {
      const targetPath = String(req.target.path ?? "");
      if (!targetPath || !ctx.workspaceRoots || ctx.workspaceRoots.length === 0) {
        return false;
      }
      const isInside = ctx.workspaceRoots.some((root) => isPathInside(root, targetPath));
      if (!isInside) return false;
    }

    return true;
  }
}
