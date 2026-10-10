/**
 * src/workspace/worktrees.ts
 *
 * Isolated Git worktree manager per 05 §9.
 * Ensures all worker mutations happen in ephemeral worktrees, never touching the operator's checkout.
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import spawn from "cross-spawn";

export interface IntegrationResult {
  ok: boolean;
  branch?: string;
  conflictWith?: string;
  path?: string;
}

export function git(
  cwd: string,
  args: string[],
  options: { allowFail?: boolean } = {},
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd, windowsHide: true });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });

    child.on("close", (code) => {
      const exitCode = code ?? 0;
      if (exitCode !== 0 && !options.allowFail) {
        reject(
          new Error(
            `git ${args.join(" ")} failed in ${cwd} (exit ${exitCode}): ${stderr || stdout}`,
          ),
        );
      } else {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: exitCode });
      }
    });

    child.on("error", (err) => {
      if (!options.allowFail) {
        reject(err);
      } else {
        resolve({ stdout: "", stderr: err.message, code: -1 });
      }
    });
  });
}

export class WorktreeManager {
  constructor(
    readonly repoRoot: string,
    readonly baseDir: string,
  ) {
    if (!existsSync(baseDir)) {
      mkdirSync(baseDir, { recursive: true });
    }
  }

  async create(
    jobId: string,
    ctrId: string,
    attempt: number,
    fromRef: string,
  ): Promise<{ path: string; branch: string }> {
    const branch = `regent/${jobId}/${ctrId}-a${attempt}`;
    const path = join(this.baseDir, jobId, `${ctrId}-a${attempt}`);

    const parentDir = join(this.baseDir, jobId);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }

    // git worktree add -b <branch> <path> <fromRef>
    await git(this.repoRoot, ["worktree", "add", "-b", branch, path, fromRef]);

    return { path, branch };
  }

  /**
   * Remove worktree directory FIRST, then delete branch.
   * Git refuses to delete a checked-out branch.
   */
  async remove(path: string, branch: string, keepBranch = true): Promise<void> {
    if (existsSync(path)) {
      await git(this.repoRoot, ["worktree", "remove", "--force", path], {
        allowFail: true,
      });
    }

    if (!keepBranch) {
      await git(this.repoRoot, ["branch", "-D", branch], { allowFail: true });
    }
  }

  /**
   * Integration happens inside its own worktree, never in operator's working tree.
   */
  async integrate(
    jobId: string,
    approved: Array<{ branch: string }>,
    baseRef: string,
  ): Promise<IntegrationResult> {
    const targetBranch = `regent/${jobId}/integration`;
    const path = join(this.baseDir, jobId, "integration");

    const parentDir = join(this.baseDir, jobId);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }

    // If integration worktree already exists, clean up first
    if (existsSync(path)) {
      await git(this.repoRoot, ["worktree", "remove", "--force", path], {
        allowFail: true,
      });
    }

    // git worktree add -B <targetBranch> <path> <baseRef>
    await git(this.repoRoot, ["worktree", "add", "-B", targetBranch, path, baseRef]);

    // Merge each approved branch
    for (const a of approved) {
      const mergeRes = await git(path, ["merge", "--no-ff", "--no-edit", a.branch], {
        allowFail: true,
      });
      if (mergeRes.code !== 0) {
        // Abort merge to keep worktree clean
        await git(path, ["merge", "--abort"], { allowFail: true });
        return { ok: false, conflictWith: a.branch, path };
      }
    }

    return { ok: true, branch: targetBranch, path };
  }
}
