/**
 * test/unit/charter.test.ts
 *
 * Acceptance table tests for M1 Charter Engine:
 * Requires >= 40 distinct test cases covering:
 * - A0, A1, A2, A3, A4, AX
 * - Tainted A2 action requiring grant
 * - Grant matching, grant expiration, grant use exhaustion
 * - Kill switch override on every level
 * - Unknown actions defaulting to A3 (fail closed)
 */

import { describe, expect, it } from "vitest";
import {
  type ActionRequest,
  Charter,
  type CharterContext,
  type CharterRule,
} from "../../src/kernel/charter.js";
import { GrantStore } from "../../src/kernel/grants.js";
import { KillSwitch } from "../../src/kernel/kill-switch.js";

const DEFAULT_RULES: CharterRule[] = [
  // --- forbidden AX ---
  {
    level: "AX",
    action: "fs.*",
    when: { pathMatches: ["~/.regent/charter.yaml", "~/.regent/STOP", "**/secrets/**"] },
  },
  {
    level: "AX",
    action: "shell.exec",
    when: {
      commandMatches: [
        "(?i)\\bformat\\s+[a-z]:",
        "(?i)rm\\s+-rf\\s+/(\\s|$)",
        "(?i)Remove-Item.*-Recurse.*C:\\\\(Windows|Users)\\\\?$",
        "(?i)reg\\s+delete\\s+HKLM",
      ],
    },
  },
  // --- high stakes A4 ---
  {
    level: "A4",
    action: "git.push",
    when: { branchMatches: ["main", "master", "release/*"] },
  },
  { level: "A4", action: "deploy.*" },
  {
    level: "A4",
    action: "browser.submit",
    when: { formKind: ["payment", "message", "account", "legal"] },
  },
  { level: "A4", action: "message.send" },
  {
    level: "A4",
    action: "shell.exec",
    when: {
      commandMatches: [
        "(?i)wrangler\\s+(deploy|publish)",
        "(?i)npm\\s+publish",
        "(?i)gh\\s+release\\s+create",
      ],
    },
  },
  // --- external reversible A3 ---
  { level: "A3", action: "git.push" },
  { level: "A3", action: "pr.open" },
  { level: "A3", action: "browser.submit" },
  { level: "A3", action: "browser.login" },
  // --- local A1 / A2 ---
  { level: "A1", action: "fs.*", when: { insideAttemptDir: true } },
  { level: "A2", action: "fs.*", when: { insideWorkspace: true } },
  { level: "A1", action: "shell.exec", when: { cwdInsideAttemptDir: true } },
  { level: "A2", action: "git.merge", when: { targetBranchMatches: ["regent/*"] } },
  // --- observe A0 ---
  { level: "A0", action: "fs.read" },
  { level: "A0", action: "browser.navigate" },
  { level: "A0", action: "net.get" },
];

const CTX: CharterContext = {
  workspaceRoots: ["C:/projects/my-app"],
  attemptDir: "C:/projects/my-app/.regent/attempt-1",
};

interface TestCase {
  id: string;
  name: string;
  req: ActionRequest;
  ctx?: CharterContext;
  killSwitchEngaged?: boolean;
  setupGrants?: (grants: GrantStore) => void;
  expectedKind: "allow" | "deny" | "needs_grant";
  expectedLevel: string;
}

const tableCases: TestCase[] = [
  // --- 1. Kill Switch Overrides (6 cases) ---
  {
    id: "KS-1",
    name: "Kill switch overrides A0 fs.read",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "fs.read",
      target: { path: "C:/projects/my-app/README.md" },
      tainted: false,
    },
    killSwitchEngaged: true,
    expectedKind: "deny",
    expectedLevel: "AX",
  },
  {
    id: "KS-2",
    name: "Kill switch overrides A1 fs.write inside attemptDir",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "fs.write",
      target: { path: "C:/projects/my-app/.regent/attempt-1/out.txt" },
      tainted: false,
    },
    killSwitchEngaged: true,
    expectedKind: "deny",
    expectedLevel: "AX",
  },
  {
    id: "KS-3",
    name: "Kill switch overrides A2 fs.write inside workspace",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "fs.write",
      target: { path: "C:/projects/my-app/src/index.ts" },
      tainted: false,
    },
    killSwitchEngaged: true,
    expectedKind: "deny",
    expectedLevel: "AX",
  },
  {
    id: "KS-4",
    name: "Kill switch overrides A3 git.push with grant",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "git.push",
      target: { branch: "regent/feat-1" },
      tainted: false,
    },
    setupGrants: (g) => {
      g.add({ id: "g1", jobId: "j1", action: "git.push", usedCount: 0 });
    },
    killSwitchEngaged: true,
    expectedKind: "deny",
    expectedLevel: "AX",
  },
  {
    id: "KS-5",
    name: "Kill switch overrides A4 deploy with grant",
    req: { jobId: "j1", actor: "worker", action: "deploy.prod", target: {}, tainted: false },
    setupGrants: (g) => {
      g.add({ id: "g2", jobId: "j1", action: "deploy.*", usedCount: 0 });
    },
    killSwitchEngaged: true,
    expectedKind: "deny",
    expectedLevel: "AX",
  },
  {
    id: "KS-6",
    name: "Kill switch overrides unknown action",
    req: { jobId: "j1", actor: "worker", action: "custom.action", target: {}, tainted: false },
    killSwitchEngaged: true,
    expectedKind: "deny",
    expectedLevel: "AX",
  },

  // --- 2. Forbidden AX Rules (6 cases) ---
  {
    id: "AX-1",
    name: "Editing charter.yaml is AX denied",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "fs.write",
      target: { path: "~/.regent/charter.yaml" },
      tainted: false,
    },
    expectedKind: "deny",
    expectedLevel: "AX",
  },
  {
    id: "AX-2",
    name: "Writing STOP file is AX denied",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "fs.write",
      target: { path: "~/.regent/STOP" },
      tainted: false,
    },
    expectedKind: "deny",
    expectedLevel: "AX",
  },
  {
    id: "AX-3",
    name: "Writing to secrets directory is AX denied",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "fs.write",
      target: { path: "C:/projects/secrets/key.pem" },
      tainted: false,
    },
    expectedKind: "deny",
    expectedLevel: "AX",
  },
  {
    id: "AX-4",
    name: "Shell rm -rf / is AX denied",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "shell.exec",
      target: { command: "rm -rf /" },
      tainted: false,
    },
    expectedKind: "deny",
    expectedLevel: "AX",
  },
  {
    id: "AX-5",
    name: "Shell format drive is AX denied",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "shell.exec",
      target: { command: "format c: /q" },
      tainted: false,
    },
    expectedKind: "deny",
    expectedLevel: "AX",
  },
  {
    id: "AX-6",
    name: "Shell reg delete HKLM is AX denied",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "shell.exec",
      target: { command: "reg delete HKLM\\Software" },
      tainted: false,
    },
    expectedKind: "deny",
    expectedLevel: "AX",
  },

  // --- 3. High Stakes A4 Rules & Grants (10 cases) ---
  {
    id: "A4-1",
    name: "Push to main branch is A4; needs grant without grant",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "git.push",
      target: { branch: "main" },
      tainted: false,
    },
    expectedKind: "needs_grant",
    expectedLevel: "A4",
  },
  {
    id: "A4-2",
    name: "Push to main branch is allowed with explicit matching grant",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "git.push",
      target: { branch: "main" },
      tainted: false,
    },
    setupGrants: (g) => {
      g.add({
        id: "g-main",
        jobId: "j1",
        action: "git.push",
        scope: { branch: ["main"] },
        usedCount: 0,
      });
    },
    expectedKind: "allow",
    expectedLevel: "A4",
  },
  {
    id: "A4-3",
    name: "Push to release/* branch is A4",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "git.push",
      target: { branch: "release/v1.0" },
      tainted: false,
    },
    expectedKind: "needs_grant",
    expectedLevel: "A4",
  },
  {
    id: "A4-4",
    name: "deploy.* is A4; needs grant",
    req: { jobId: "j1", actor: "worker", action: "deploy.staging", target: {}, tainted: false },
    expectedKind: "needs_grant",
    expectedLevel: "A4",
  },
  {
    id: "A4-5",
    name: "browser.submit payment form is A4",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "browser.submit",
      target: { formKind: "payment" },
      tainted: false,
    },
    expectedKind: "needs_grant",
    expectedLevel: "A4",
  },
  {
    id: "A4-6",
    name: "browser.submit legal form is A4",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "browser.submit",
      target: { formKind: "legal" },
      tainted: false,
    },
    expectedKind: "needs_grant",
    expectedLevel: "A4",
  },
  {
    id: "A4-7",
    name: "message.send is A4",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "message.send",
      target: { to: "team@company.com" },
      tainted: false,
    },
    expectedKind: "needs_grant",
    expectedLevel: "A4",
  },
  {
    id: "A4-8",
    name: "npm publish command is A4",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "shell.exec",
      target: { command: "npm publish --access public" },
      tainted: false,
    },
    expectedKind: "needs_grant",
    expectedLevel: "A4",
  },
  {
    id: "A4-9",
    name: "wrangler deploy command is A4",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "shell.exec",
      target: { command: "wrangler deploy worker.js" },
      tainted: false,
    },
    expectedKind: "needs_grant",
    expectedLevel: "A4",
  },
  {
    id: "A4-10",
    name: "gh release create command is A4",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "shell.exec",
      target: { command: "gh release create v1.0.0" },
      tainted: false,
    },
    expectedKind: "needs_grant",
    expectedLevel: "A4",
  },

  // --- 4. External Reversible A3 Rules & Grants (8 cases) ---
  {
    id: "A3-1",
    name: "git.push to feature branch is A3; needs grant without grant",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "git.push",
      target: { branch: "regent/job-1" },
      tainted: false,
    },
    expectedKind: "needs_grant",
    expectedLevel: "A3",
  },
  {
    id: "A3-2",
    name: "git.push with matching grant allows",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "git.push",
      target: { branch: "regent/job-1" },
      tainted: false,
    },
    setupGrants: (g) => {
      g.add({ id: "g-push", jobId: "j1", action: "git.push", usedCount: 0 });
    },
    expectedKind: "allow",
    expectedLevel: "A3",
  },
  {
    id: "A3-3",
    name: "git.push with expired grant needs grant",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "git.push",
      target: { branch: "regent/job-1" },
      tainted: false,
    },
    setupGrants: (g) => {
      g.add({
        id: "g-exp",
        jobId: "j1",
        action: "git.push",
        expires: new Date(Date.now() - 10000).toISOString(),
        usedCount: 0,
      });
    },
    expectedKind: "needs_grant",
    expectedLevel: "A3",
  },
  {
    id: "A3-4",
    name: "git.push with exhausted maxUses needs grant",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "git.push",
      target: { branch: "regent/job-1" },
      tainted: false,
    },
    setupGrants: (g) => {
      g.add({ id: "g-exhausted", jobId: "j1", action: "git.push", maxUses: 1, usedCount: 1 });
    },
    expectedKind: "needs_grant",
    expectedLevel: "A3",
  },
  {
    id: "A3-5",
    name: "pr.open without grant is A3 needs_grant",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "pr.open",
      target: { title: "Draft PR" },
      tainted: false,
    },
    expectedKind: "needs_grant",
    expectedLevel: "A3",
  },
  {
    id: "A3-6",
    name: "pr.open with matching grant allows",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "pr.open",
      target: { title: "Draft PR" },
      tainted: false,
    },
    setupGrants: (g) => {
      g.add({ id: "g-pr", jobId: "j1", action: "pr.open", usedCount: 0 });
    },
    expectedKind: "allow",
    expectedLevel: "A3",
  },
  {
    id: "A3-7",
    name: "browser.login without grant is A3 needs_grant",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "browser.login",
      target: { url: "https://site.com/login" },
      tainted: false,
    },
    expectedKind: "needs_grant",
    expectedLevel: "A3",
  },
  {
    id: "A3-8",
    name: "browser.submit non-sensitive form is A3",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "browser.submit",
      target: { formKind: "search" },
      tainted: false,
    },
    expectedKind: "needs_grant",
    expectedLevel: "A3",
  },

  // --- 5. Local Consequential A2 Rules & Taint (4 cases) ---
  {
    id: "A2-1",
    name: "fs.write inside workspace untainted is A2 allow",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "fs.write",
      target: { path: "C:/projects/my-app/src/app.ts" },
      tainted: false,
    },
    expectedKind: "allow",
    expectedLevel: "A2",
  },
  {
    id: "A2-2",
    name: "fs.write inside workspace tainted is A2 needs_grant",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "fs.write",
      target: { path: "C:/projects/my-app/src/app.ts" },
      tainted: true,
    },
    expectedKind: "needs_grant",
    expectedLevel: "A2",
  },
  {
    id: "A2-3",
    name: "git.merge into regent/* untainted is A2 allow",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "git.merge",
      target: { targetBranch: "regent/merged" },
      tainted: false,
    },
    expectedKind: "allow",
    expectedLevel: "A2",
  },
  {
    id: "A2-4",
    name: "git.merge into regent/* tainted is A2 needs_grant",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "git.merge",
      target: { targetBranch: "regent/merged" },
      tainted: true,
    },
    expectedKind: "needs_grant",
    expectedLevel: "A2",
  },

  // --- 6. Local Reversible A1 Rules (3 cases) ---
  {
    id: "A1-1",
    name: "fs.write inside attemptDir is A1 allow",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "fs.write",
      target: { path: "C:/projects/my-app/.regent/attempt-1/temp.js" },
      tainted: false,
    },
    expectedKind: "allow",
    expectedLevel: "A1",
  },
  {
    id: "A1-2",
    name: "fs.write inside attemptDir tainted is still A1 allow",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "fs.write",
      target: { path: "C:/projects/my-app/.regent/attempt-1/temp.js" },
      tainted: true,
    },
    expectedKind: "allow",
    expectedLevel: "A1",
  },
  {
    id: "A1-3",
    name: "shell.exec with cwd inside attemptDir is A1 allow",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "shell.exec",
      target: { cwd: "C:/projects/my-app/.regent/attempt-1", command: "npm test" },
      tainted: false,
    },
    expectedKind: "allow",
    expectedLevel: "A1",
  },

  // --- 7. Observe A0 Rules (3 cases) ---
  {
    id: "A0-1",
    name: "fs.read is A0 allow",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "fs.read",
      target: { path: "C:/anywhere/file.txt" },
      tainted: false,
    },
    expectedKind: "allow",
    expectedLevel: "A0",
  },
  {
    id: "A0-2",
    name: "browser.navigate is A0 allow",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "browser.navigate",
      target: { url: "https://example.com" },
      tainted: false,
    },
    expectedKind: "allow",
    expectedLevel: "A0",
  },
  {
    id: "A0-3",
    name: "net.get is A0 allow",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "net.get",
      target: { url: "https://api.github.com" },
      tainted: false,
    },
    expectedKind: "allow",
    expectedLevel: "A0",
  },

  // --- 8. Unknown Actions Fail Closed to A3 (3 cases) ---
  {
    id: "UNK-1",
    name: "Unknown action database.drop defaults to A3 needs_grant",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "database.drop",
      target: { db: "users" },
      tainted: false,
    },
    expectedKind: "needs_grant",
    expectedLevel: "A3",
  },
  {
    id: "UNK-2",
    name: "Unknown action docker.run defaults to A3 needs_grant",
    req: {
      jobId: "j1",
      actor: "worker",
      action: "docker.run",
      target: { image: "node:24" },
      tainted: false,
    },
    expectedKind: "needs_grant",
    expectedLevel: "A3",
  },
  {
    id: "UNK-3",
    name: "Unknown action with matching grant allows",
    req: { jobId: "j1", actor: "worker", action: "custom.action", target: {}, tainted: false },
    setupGrants: (g) => {
      g.add({ id: "g-custom", jobId: "j1", action: "custom.action", usedCount: 0 });
    },
    expectedKind: "allow",
    expectedLevel: "A3",
  },
];

describe("M1: Charter Table Test (>= 40 cases)", () => {
  it(`covers at least 40 cases across all authority levels (total: ${tableCases.length})`, () => {
    expect(tableCases.length).toBeGreaterThanOrEqual(40);
  });

  for (const tc of tableCases) {
    it(`[${tc.id}] ${tc.name}`, () => {
      const grantStore = new GrantStore();
      if (tc.setupGrants) {
        tc.setupGrants(grantStore);
      }

      // Kill switch setup
      const killSwitch = new KillSwitch("C:/non-existent-kill-switch-path");
      if (tc.killSwitchEngaged) {
        // mock kill switch engaged
        killSwitch.engaged = () => true;
      }

      const charter = new Charter(DEFAULT_RULES, grantStore, killSwitch);
      const decision = charter.evaluate(tc.req, tc.ctx ?? CTX);

      expect(decision.kind).toBe(tc.expectedKind);
      expect(decision.level).toBe(tc.expectedLevel);
    });
  }
});
