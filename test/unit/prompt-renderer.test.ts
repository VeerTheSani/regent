/**
 * test/unit/prompt-renderer.test.ts
 *
 * Acceptance tests for M5 Prompt Renderer per 09 §3.
 */

import { describe, expect, it } from "vitest";
import { renderPrompt } from "../../src/prompts/render.js";

describe("M5: Prompt Renderer", () => {
  it("renders simple variables and truthy/falsy conditionals", () => {
    const template = `Goal: {{goal}}
{{#if critique}}
Critique to fix:
{{critique}}
{{/if}}
{{#if emptyNote}}
Should not appear: {{emptyNote}}
{{/if}}
Done.`;

    const output = renderPrompt(template, {
      goal: "Implement authentication",
      critique: "Fix token validation in header",
      emptyNote: "",
    });

    expect(output).toContain("Goal: Implement authentication");
    expect(output).toContain("Critique to fix:\nFix token validation in header");
    expect(output).not.toContain("Should not appear");
    expect(output).toContain("Done.");
  });

  it("throws when variable is missing (no silent blanks allowed)", () => {
    const template = "Execute contract {{contractId}} on job {{missingJobId}}";
    expect(() => renderPrompt(template, { contractId: "CTR-01" })).toThrowError(
      /Missing variable: missingJobId/,
    );
  });

  it("throws when an unknown template construct is encountered", () => {
    const templateWithEach = `Contracts:
{{#each contracts}}
- {{this}}
{{/each}}`;

    expect(() => renderPrompt(templateWithEach, { contracts: ["CTR-1", "CTR-2"] })).toThrowError(
      /Unknown construct in template/,
    );
  });

  it("throws when unclosed or malformed tags are present", () => {
    const badTemplate = "Run task {{contractId and then exit";
    expect(() => renderPrompt(badTemplate, { contractId: "CTR-01" })).toThrowError(
      /Unknown construct in template/,
    );
  });
});
