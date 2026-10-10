/**
 * test/unit/delivery.test.ts
 *
 * Acceptance tests for M9: Delivery report generation and strict honesty rules per 11 §3.
 */

import { describe, expect, it } from "vitest";
import type { LedgerEvent } from "../../src/kernel/ledger.js";
import { generateDeliveryReport } from "../../src/reporter/delivery.js";

describe("M9: Delivery Report & Honesty Enforcement", () => {
  const fakeEvents: LedgerEvent[] = [
    {
      seq: 1,
      ts: "2026-10-10T10:00:00.000Z",
      type: "budget.charged",
      actor: "director:plan",
      payload: { usd: 1.1 },
    },
    {
      seq: 2,
      ts: "2026-10-10T10:15:00.000Z",
      type: "budget.charged",
      actor: "judge:opus",
      payload: { usd: 1.85 },
    },
    {
      seq: 3,
      ts: "2026-10-10T10:20:00.000Z",
      type: "budget.charged",
      actor: "triage:jev",
      payload: { usd: 0.06 },
    },
    {
      seq: 4,
      ts: "2026-10-10T10:30:00.000Z",
      type: "budget.charged",
      actor: "worker:claude-code",
      payload: { usd: 4.39 },
    },
  ];

  it("generates honest complete delivery report matching 11 §3 format with evidence links", () => {
    const report = generateDeliveryReport({
      jobId: "job-0042",
      goal: "Settings page with volume + dark mode",
      isComplete: true,
      finalScore: 9.1,
      durationMinutes: 46,
      branch: "regent/job-0042",
      commitsCount: 7,
      linesAdded: 412,
      linesRemoved: 38,
      filesChangedCount: 9,
      dods: [
        {
          id: "DOD-1",
          statement: "/settings renders without console errors",
          status: "verified",
          evidenceLink: "captures/settings-1280x800.png, console: 0 errors",
        },
        {
          id: "DOD-2",
          statement: "volumes persist across reload",
          status: "verified",
          evidenceLink: "e2e settings.spec.ts › persists volume (pass)",
        },
        {
          id: "DOD-3",
          statement: "toggle switches theme, persists",
          status: "verified",
          evidenceLink: "captures/settings-dark.png; e2e › theme toggle",
        },
        {
          id: "DOD-4",
          statement: "matches aikami-ui",
          status: "judged",
          evidenceLink: "verdict CTR-03 a3",
          verdictScore: 9.0,
        },
      ],
      decisionsMade: [
        {
          id: "Q-1",
          text: "Volume stored as 0–1 float, shown as 0–100 (matches audio service).",
        },
        {
          id: "Q-2",
          text: "Dark mode defaults to system preference; user override persists.",
        },
      ],
      caveats: ["Not pushed, no PR opened (A3; grant git.push + pr.open to let Regent do it)."],
      events: fakeEvents,
    });

    expect(report).toContain("# DELIVERY — job-0042: Settings page with volume + dark mode");
    expect(report).toContain("Status: ✅ COMPLETE");
    expect(report).toContain("Final acceptance 9.1/10");
    expect(report).toContain("Cost: Director $1.10 · Judges $1.85 · T1 $0.06 · Workers $4.39");
    expect(report).toContain("## What you got");
    expect(report).toContain("## Definition of done");
    expect(report).toContain("## Decisions Regent made for you");
    expect(report).toContain("## What was not done / caveats");
    expect(report).toContain("## Evidence index");
  });

  it("fails honesty test if any claimed verified or judged item lacks an evidence link", () => {
    expect(() =>
      generateDeliveryReport({
        jobId: "job-bad",
        goal: "Dishonest test",
        isComplete: true,
        finalScore: 9.0,
        durationMinutes: 20,
        dods: [
          {
            id: "DOD-FAKE",
            statement: "Claimed verified without evidence link",
            status: "verified",
            evidenceLink: undefined, // Dishonest claim!
          },
        ],
        decisionsMade: [],
        caveats: [],
        events: fakeEvents,
      }),
    ).toThrowError(
      /Honesty violation: DoD item DOD-FAKE claimed verified but lacks required evidenceLink/,
    );
  });

  it("labels partial delivery report as PARTIAL when job is not complete", () => {
    const report = generateDeliveryReport({
      jobId: "job-partial",
      goal: "Incomplete task",
      isComplete: false,
      finalScore: 6.5,
      durationMinutes: 30,
      dods: [
        {
          id: "DOD-1",
          statement: "Core logic",
          status: "verified",
          evidenceLink: "test.log",
        },
      ],
      decisionsMade: [],
      caveats: ["CTR-02 abandoned at attempt ceiling"],
      events: fakeEvents,
    });

    expect(report).toContain("# DELIVERY (PARTIAL) — job-partial");
    expect(report).toContain("Status: ⚠️ PARTIAL");
  });
});
