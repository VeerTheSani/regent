/**
 * test/unit/worktrees.test.ts
 *
 * Acceptance tests for M4: Worktree isolation, creation, and conflict integration.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WorktreeManager, git } from "../../src/workspace/worktrees.js";

const FIXTURES_DIR = join(process.cwd(), "test", "fixtures", "worktrees-sandbox");
const REPO_ROOT = join(FIXTURES_DIR, "repo");
const WORKTREES_BASE = join(FIXTURES_DIR, "worktrees");

describe("M4: Worktree Manager & Isolation", () => {
  beforeAll(async () => {
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
    mkdirSync(REPO_ROOT, { recursive: true });
    mkdirSync(WORKTREES_BASE, { recursive: true });

    // Initialize git repository
    await git(REPO_ROOT, ["init", "-b", "main"]);
    await git(REPO_ROOT, ["config", "user.name", "Regent Test"]);
    await git(REPO_ROOT, ["config", "user.email", "test@regent.local"]);

    // Create baseline commit
    const baseFile = join(REPO_ROOT, "shared.txt");
    writeFileSync(baseFile, "INITIAL SHARED CONTENT\n", "utf-8");
    await git(REPO_ROOT, ["add", "shared.txt"]);
    await git(REPO_ROOT, ["commit", "-m", "Initial commit"]);
  });

  afterAll(async () => {
    if (existsSync(FIXTURES_DIR)) {
      try {
        rmSync(FIXTURES_DIR, { recursive: true, force: true });
      } catch {}
    }
  });

  it("creates worktree, writes, commits, and detects deliberate conflict on integration without altering operator repo", async () => {
    const wm = new WorktreeManager(REPO_ROOT, WORKTREES_BASE);

    // 1. Create worktree for contract 1
    const wt1 = await wm.create("job-wt", "ctr-1", 1, "main");
    expect(existsSync(wt1.path)).toBe(true);
    expect(wt1.branch).toBe("regent/job-wt/ctr-1-a1");

    // Modify shared.txt on branch 1 and commit
    writeFileSync(join(wt1.path, "shared.txt"), "MUTATION FROM CONTRACT 1\n", "utf-8");
    await git(wt1.path, ["add", "shared.txt"]);
    await git(wt1.path, ["commit", "-m", "Contract 1 edit"]);

    // 2. Create worktree for contract 2 (from main)
    const wt2 = await wm.create("job-wt", "ctr-2", 1, "main");
    expect(existsSync(wt2.path)).toBe(true);
    expect(wt2.branch).toBe("regent/job-wt/ctr-2-a1");

    // Conflicting edit on shared.txt on branch 2 and commit
    writeFileSync(join(wt2.path, "shared.txt"), "CONFLICTING CONTENT FROM CONTRACT 2\n", "utf-8");
    await git(wt2.path, ["add", "shared.txt"]);
    await git(wt2.path, ["commit", "-m", "Contract 2 conflicting edit"]);

    // 3. Attempt to integrate both branches into regent/job-wt
    const intResult = await wm.integrate(
      "job-wt",
      [{ branch: wt1.branch }, { branch: wt2.branch }],
      "main",
    );

    // Conflict MUST be flagged with the conflicting branch
    expect(intResult.ok).toBe(false);
    expect(intResult.conflictWith).toBe(wt2.branch);

    // 4. Crucial guarantee: operator checkout in REPO_ROOT remains 100% clean and on main
    const status = await git(REPO_ROOT, ["status", "--porcelain"]);
    expect(status.stdout).toBe("");

    const currentBranch = await git(REPO_ROOT, ["branch", "--show-current"]);
    expect(currentBranch.stdout).toBe("main");

    // 5. Cleanup worktrees
    await wm.remove(wt1.path, wt1.branch, false);
    await wm.remove(wt2.path, wt2.branch, false);
    expect(existsSync(wt1.path)).toBe(false);
    expect(existsSync(wt2.path)).toBe(false);
  });
});
