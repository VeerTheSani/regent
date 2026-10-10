/**
 * src/workspace/probe.ts
 *
 * Probes repository environment, default branch, clean/dirty state, and agent configuration files.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { git } from "./worktrees.js";

export interface WorkspaceProbeResult {
  isGitRepo: boolean;
  repoRoot?: string;
  defaultBranch?: string;
  isDirty: boolean;
  dirtyFiles: string[];
  packageScripts: Record<string, string>;
  hasAgentsMd: boolean;
  hasClaudeMd: boolean;
}

export async function probeWorkspace(cwd: string): Promise<WorkspaceProbeResult> {
  let isGitRepo = false;
  let repoRoot: string | undefined;
  let defaultBranch = "main";
  let isDirty = false;
  const dirtyFiles: string[] = [];
  const packageScripts: Record<string, string> = {};

  try {
    const rootRes = await git(cwd, ["rev-parse", "--show-toplevel"]);
    if (rootRes.code === 0) {
      isGitRepo = true;
      repoRoot = rootRes.stdout.replace(/\\/g, "/");
    }
  } catch {}

  if (isGitRepo && repoRoot) {
    // Check dirty state
    const statusRes = await git(repoRoot, ["status", "--porcelain"], { allowFail: true });
    if (statusRes.stdout.length > 0) {
      isDirty = true;
      for (const line of statusRes.stdout.split("\n")) {
        const trimmed = line.trim();
        if (trimmed) {
          dirtyFiles.push(trimmed.slice(3).trim());
        }
      }
    }

    // Determine default branch
    const branchRes = await git(repoRoot, ["branch", "--show-current"], { allowFail: true });
    if (branchRes.stdout) {
      defaultBranch = branchRes.stdout;
    }
  }

  // Check package.json scripts
  const pkgPath = repoRoot ? join(repoRoot, "package.json") : join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (pkg.scripts && typeof pkg.scripts === "object") {
        Object.assign(packageScripts, pkg.scripts);
      }
    } catch {}
  }

  const checkDir = repoRoot ?? cwd;
  const hasAgentsMd = existsSync(join(checkDir, "AGENTS.md"));
  const hasClaudeMd = existsSync(join(checkDir, "CLAUDE.md"));

  return {
    isGitRepo,
    repoRoot,
    defaultBranch,
    isDirty,
    dirtyFiles,
    packageScripts,
    hasAgentsMd,
    hasClaudeMd,
  };
}
