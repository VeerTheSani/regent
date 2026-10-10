/**
 * src/kernel/budget.ts
 *
 * Budget and ceiling metering per 02 §3.
 */

export interface BudgetLimits {
  job: {
    maxUsd: number;
    maxHours: number;
  };
  contract: {
    maxAttempts: number;
  };
  attempt: {
    maxUsd: number;
    maxMinutes: number;
    stallMinutes?: number;
  };
}

export const DEFAULT_BUDGET_LIMITS: BudgetLimits = {
  job: { maxUsd: 20, maxHours: 6 },
  contract: { maxAttempts: 6 },
  attempt: { maxUsd: 3, maxMinutes: 45, stallMinutes: 8 },
};

export class BudgetMeter {
  private spentUsd = 0;
  private readonly startedAt: number;

  constructor(
    private readonly limits: BudgetLimits = DEFAULT_BUDGET_LIMITS,
    initialSpend = 0,
  ) {
    this.spentUsd = initialSpend;
    this.startedAt = Date.now();
  }

  getSpend(): number {
    return this.spentUsd;
  }

  charge(usd: number): { allowed: boolean; spentUsd: number; reason?: string } {
    this.spentUsd += usd;
    if (this.spentUsd > this.limits.job.maxUsd) {
      return {
        allowed: false,
        spentUsd: this.spentUsd,
        reason: `Job budget exceeded: spent $${this.spentUsd.toFixed(
          4,
        )} exceeds ceiling $${this.limits.job.maxUsd}`,
      };
    }
    return { allowed: true, spentUsd: this.spentUsd };
  }

  checkJobCeiling(): { allowed: boolean; reason?: string } {
    if (this.spentUsd > this.limits.job.maxUsd) {
      return {
        allowed: false,
        reason: `Job budget exceeded: spent $${this.spentUsd.toFixed(4)} > $${
          this.limits.job.maxUsd
        }`,
      };
    }

    const elapsedHours = (Date.now() - this.startedAt) / (1000 * 60 * 60);
    if (elapsedHours > this.limits.job.maxHours) {
      return {
        allowed: false,
        reason: `Job wall-clock exceeded: ${elapsedHours.toFixed(
          2,
        )}h > ${this.limits.job.maxHours}h`,
      };
    }

    return { allowed: true };
  }

  checkContractAttempts(attemptCount: number): {
    allowed: boolean;
    reason?: string;
  } {
    if (attemptCount > this.limits.contract.maxAttempts) {
      return {
        allowed: false,
        reason: `Contract attempt ceiling reached: ${attemptCount} > ${this.limits.contract.maxAttempts}`,
      };
    }
    return { allowed: true };
  }

  checkAttemptBudget(
    attemptUsd: number,
    durationMinutes: number,
  ): { allowed: boolean; reason?: string } {
    if (attemptUsd > this.limits.attempt.maxUsd) {
      return {
        allowed: false,
        reason: `Attempt spend $${attemptUsd.toFixed(4)} exceeded ceiling $${
          this.limits.attempt.maxUsd
        }`,
      };
    }

    if (durationMinutes > this.limits.attempt.maxMinutes) {
      return {
        allowed: false,
        reason: `Attempt duration ${durationMinutes.toFixed(1)}m exceeded ceiling ${
          this.limits.attempt.maxMinutes
        }m`,
      };
    }

    return { allowed: true };
  }
}
