/**
 * test/unit/budget.test.ts
 *
 * Acceptance tests for M1 Budget Meter.
 */

import { describe, expect, it } from "vitest";
import { BudgetMeter, DEFAULT_BUDGET_LIMITS } from "../../src/kernel/budget.js";

describe("M1: Budget Metering & Ceilings", () => {
  it("tracks spend and allows charging within ceiling", () => {
    const meter = new BudgetMeter({
      job: { maxUsd: 10, maxHours: 2 },
      contract: { maxAttempts: 5 },
      attempt: { maxUsd: 2, maxMinutes: 30 },
    });

    const res1 = meter.charge(4.5);
    expect(res1.allowed).toBe(true);
    expect(res1.spentUsd).toBe(4.5);

    const res2 = meter.charge(3.0);
    expect(res2.allowed).toBe(true);
    expect(res2.spentUsd).toBe(7.5);

    // Charge that exceeds $10 cap
    const res3 = meter.charge(3.5);
    expect(res3.allowed).toBe(false);
    expect(res3.spentUsd).toBe(11.0);
    expect(res3.reason).toContain("Job budget exceeded");
  });

  it("checks contract attempt ceiling", () => {
    const meter = new BudgetMeter(DEFAULT_BUDGET_LIMITS);
    expect(meter.checkContractAttempts(3).allowed).toBe(true);
    expect(meter.checkContractAttempts(6).allowed).toBe(true);
    expect(meter.checkContractAttempts(7).allowed).toBe(false);
  });

  it("checks attempt budget and duration ceilings", () => {
    const meter = new BudgetMeter(DEFAULT_BUDGET_LIMITS); // maxUsd: 3, maxMinutes: 45
    expect(meter.checkAttemptBudget(1.5, 20).allowed).toBe(true);
    expect(meter.checkAttemptBudget(3.5, 20).allowed).toBe(false);
    expect(meter.checkAttemptBudget(1.0, 50).allowed).toBe(false);
  });
});
