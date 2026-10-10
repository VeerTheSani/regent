/**
 * test/unit/setup.test.ts
 *
 * Acceptance test for M7: regent setup onboarding.
 */

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { runSetup } from "../../src/operator/setup.js";

describe("M7: Operator Setup & Onboarding", () => {
  it("writes valid config.yaml, charter.yaml, and operator.yaml", () => {
    const paths = runSetup({ channel: "telegram", maxJobUsd: 25 });

    expect(existsSync(paths.configPath)).toBe(true);
    expect(existsSync(paths.charterPath)).toBe(true);
    expect(existsSync(paths.operatorPath)).toBe(true);

    const config = parse(readFileSync(paths.configPath, "utf-8"));
    expect(config.version).toBe(1);
    expect(config.budgets.job.maxUsd).toBe(25);

    const charter = parse(readFileSync(paths.charterPath, "utf-8"));
    expect(charter.version).toBe(1);

    const operator = parse(readFileSync(paths.operatorPath, "utf-8"));
    expect(operator.version).toBe(1);
    expect(operator.channel).toBe("telegram");
  });
});
