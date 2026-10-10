/**
 * test/unit/consultants.test.ts
 *
 * Acceptance test for M7: consultant selection requiring >= 1 non-Anthropic family.
 */

import { describe, expect, it } from "vitest";
import { pickConsultants } from "../../scripts/pick-consultants.js";

describe("M7: Consultant Selection", () => {
  it("selects models and guarantees >= 1 non-Anthropic model family", async () => {
    const consultants = await pickConsultants();
    expect(consultants.length).toBeGreaterThanOrEqual(2);

    const families = new Set(consultants.map((c) => c.family.toLowerCase()));
    expect(families.has("anthropic")).toBe(true);

    // Strictly requires >= 1 non-Anthropic family
    const nonAnthropicFamilies = Array.from(families).filter((f) => f !== "anthropic");
    expect(nonAnthropicFamilies.length).toBeGreaterThanOrEqual(1);
  });
});
