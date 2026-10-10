/**
 * test/unit/retrospective.test.ts
 *
 * Acceptance tests for M9: Memory lessons and retrospective analysis.
 */

import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { LedgerEvent } from "../../src/kernel/ledger.js";
import { LessonStore } from "../../src/memory/lessons.js";
import { analyzeJobRetrospective } from "../../src/memory/retrospective.js";
import { WorkerStatsTracker } from "../../src/memory/stats.js";

const TEST_DIR = join(process.cwd(), "test", "fixtures", "memory");
if (!existsSync(TEST_DIR)) {
  mkdirSync(TEST_DIR, { recursive: true });
}

describe("M9: Memory, Lessons & Retrospective", () => {
  it("extracts lessons from repeated gate failures and ladder climbs", () => {
    const events: LedgerEvent[] = [
      {
        seq: 1,
        ts: "2026-10-10T12:00:00Z",
        type: "gate.result",
        actor: "gates",
        payload: { passed: false, detail: "syntax error" },
      },
      {
        seq: 2,
        ts: "2026-10-10T12:15:00Z",
        type: "gate.result",
        actor: "gates",
        payload: { passed: false, detail: "typecheck error" },
      },
      {
        seq: 3,
        ts: "2026-10-10T12:30:00Z",
        type: "verdict.issued",
        actor: "judge",
        payload: { composite: 6.0, decision: "REVISE" },
      },
      {
        seq: 4,
        ts: "2026-10-10T12:45:00Z",
        type: "verdict.issued",
        actor: "judge",
        payload: { composite: 6.2, decision: "REVISE" },
      },
    ];

    const lessons = analyzeJobRetrospective("job-retro-1", events, "aikami");
    expect(lessons.length).toBeGreaterThanOrEqual(2);
    expect(lessons.some((l) => l.observation.includes("multiple gate failures"))).toBe(true);
    expect(lessons.some((l) => l.observation.includes("Multiple revision rounds"))).toBe(true);
  });

  it("saves and retrieves lessons by project and kind scope", () => {
    const lessonsPath = join(TEST_DIR, "test-lessons.jsonl");
    if (existsSync(lessonsPath)) {
      unlinkSync(lessonsPath);
    }

    const store = new LessonStore(lessonsPath);
    store.saveLesson({
      id: "L-101",
      scope: { project: "aikami", kind: "ui" },
      observation: "UI buttons need aikami-ui styling tokens",
      evidence: ["seq:42"],
      change: { target: "worker-task", add: "Use aikami-ui tokens" },
      confidence: 0.9,
      created: "2026-10-10",
      uses: 1,
      helped: 1,
    });

    const retrieved = store.getLessons({ project: "aikami", kind: "ui" });
    expect(retrieved.length).toBe(1);
    expect(retrieved[0].id).toBe("L-101");
    expect(retrieved[0].change.add).toContain("aikami-ui tokens");
  });

  it("tracks and decays worker statistics", () => {
    const tracker = new WorkerStatsTracker();
    tracker.recordRun("claude-code", "code", "aikami", true, 0.05, 15);
    tracker.recordRun("claude-code", "code", "aikami", false, 0.04, 10);

    const stat = tracker.get("claude-code", "code", "aikami");
    expect(stat).toBeDefined();
    expect(stat?.runs).toBe(2);
    expect(stat?.alpha).toBe(2.0); // 1 + 1
    expect(stat?.beta).toBe(2.0); // 1 + 1

    tracker.decay(0.95);
    const decayed = tracker.get("claude-code", "code", "aikami");
    expect(decayed?.alpha).toBe(1.9); // 2.0 * 0.95
  });
});
