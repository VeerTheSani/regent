/**
 * test/unit/ledger.test.ts
 *
 * Acceptance tests for M1 Ledger: SQLite WAL mode, idempotency, and crash resilience.
 */

import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Ledger } from "../../src/kernel/ledger.js";
import { spawnTree } from "../../src/workers/spawn.js";

describe("M1: Ledger (SQLite WAL mode & Idempotency)", () => {
  it("initializes in-memory database and writes/reads events", () => {
    const ledger = new Ledger(":memory:");
    const res = ledger.append({
      type: "job.received",
      actor: "operator",
      jobId: "job-101",
      payload: { goal: "Build Regent" },
    });

    expect(res.seq).toBe(1);
    expect(res.duplicate).toBe(false);

    const events = ledger.read("job-101");
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("job.received");
    expect(events[0].jobId).toBe("job-101");
    expect(events[0].payload.goal).toBe("Build Regent");
    ledger.close();
  });

  it("duplicate idem_key append is a no-op and returns existing seq", () => {
    const ledger = new Ledger(":memory:");
    const res1 = ledger.append({
      type: "attempt.started",
      actor: "dispatcher",
      jobId: "job-102",
      ctrId: "ctr-1",
      attempt: 1,
      idemKey: "dispatch:ctr-1:1",
      payload: { worker: "claude-code" },
    });

    expect(res1.seq).toBe(1);
    expect(res1.duplicate).toBe(false);

    // Append again with exact same idemKey
    const res2 = ledger.append({
      type: "attempt.started",
      actor: "dispatcher",
      jobId: "job-102",
      ctrId: "ctr-1",
      attempt: 1,
      idemKey: "dispatch:ctr-1:1",
      payload: { worker: "claude-code", duplicateAttempt: true },
    });

    expect(res2.seq).toBe(1);
    expect(res2.duplicate).toBe(true);

    const allEvents = ledger.read("job-102");
    expect(allEvents.length).toBe(1);
    ledger.close();
  });

  it("crash test: mid-run kill leaves ledger uncorrupted with contiguous seq", async () => {
    const dbPath = join(process.cwd(), "test", "fixtures", "crash-test.db");
    for (const ext of ["", "-wal", "-shm"]) {
      if (existsSync(dbPath + ext)) {
        try {
          unlinkSync(dbPath + ext);
        } catch {}
      }
    }

    const workerScript = join(process.cwd(), "scripts", "crash-worker.ts");
    const { child, killTree } = spawnTree("npx", ["tsx", workerScript, dbPath]);

    // Wait until child emits WRITING_ACTIVE (after 150 events written)
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 8000);
      child.stdout?.on("data", (d) => {
        if (d.toString().includes("WRITING_ACTIVE")) {
          clearTimeout(timer);
          resolve();
        }
      });
    });

    // Kill mid-run immediately
    await killTree("SIGKILL");

    // Wait for process and filesystem handles to clear
    await new Promise((r) => setTimeout(r, 200));

    // Open ledger and verify integrity
    const ledger = new Ledger(dbPath);
    const events = ledger.read("crash-job");

    expect(events.length).toBeGreaterThan(0);
    // Verify seq is strictly contiguous and all payloads are valid
    for (let i = 0; i < events.length; i++) {
      expect(events[i].seq).toBe(i + 1);
      expect(events[i].payload.index).toBe(i);
    }

    ledger.close();

    // Cleanup
    for (const ext of ["", "-wal", "-shm"]) {
      if (existsSync(dbPath + ext)) {
        try {
          unlinkSync(dbPath + ext);
        } catch {}
      }
    }
  });
});
