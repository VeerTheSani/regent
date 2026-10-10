/**
 * test/unit/self-heal.test.ts
 *
 * TDD test suite for Closed-Loop Self-Healing Engine.
 * Verifies that actions which encounter errors on attempt 1 are automatically
 * diagnosed, rectified with an alternative strategy, and succeed on attempt 2.
 */

import { describe, expect, it } from "vitest";
import { SelfHealingEngine } from "../../src/engine/self-heal.js";

describe("Closed-Loop Self-Healing Engine", () => {
  const engine = new SelfHealingEngine();

  it("recovers from an initial command failure by diagnosing and applying a working alternative", async () => {
    let attemptCount = 0;

    // Simulate an action where attempt 1 fails (e.g. invalid syntax), and attempt 2 succeeds
    const result = await engine.executeWithHealing({
      goal: "Produce output token 42",
      maxRetries: 3,
      executeAttempt: async (attempt, lastError) => {
        attemptCount++;
        if (attempt === 1) {
          throw new Error("Syntax error: Unknown command '\\Start-Process'");
        }
        return `SUCCESS_ON_ATTEMPT_${attempt}_AFTER_${lastError?.slice(0, 12)}`;
      },
    });

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.output).toContain("SUCCESS_ON_ATTEMPT_2");
    expect(attemptCount).toBe(2);
  });

  it("handles browser fallback when native shell execution fails", async () => {
    const result = await engine.executeWithHealing({
      goal: "Open media stream",
      maxRetries: 2,
      executeAttempt: async (attempt) => {
        if (attempt === 1) {
          throw new Error("Access is denied (0x80070005)");
        }
        return "Opened media via browser CDP fallback";
      },
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain("browser CDP fallback");
  });
});
