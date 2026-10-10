/**
 * test/unit/critique-snapshot.test.ts
 *
 * Acceptance test for M5: Critique renderer snapshot byte-for-byte matching 09 §4.
 */

import { describe, expect, it } from "vitest";
import { renderCritique } from "../../src/judge/critique.js";
import type { Verdict } from "../../src/schemas/verdict.js";

describe("M5: Critique Snapshot", () => {
  it("reproduces the 09 §4 critique format example byte-for-byte from a fixture verdict", () => {
    const fixtureVerdict: Verdict = {
      contractId: "CTR-0042-03",
      attempt: 1,
      dimensions: [
        { id: "functional", score: 7.0 },
        { id: "visual_fidelity", score: 7.0 },
        { id: "code_quality", score: 8.5 },
      ],
      composite: 7.6,
      decision: "REVISE",
      blockers: [],
      defects: [
        {
          id: "D-1",
          severity: "BLOCKER",
          dimension: "functional",
          evidence: "captures/settings-390x844.png (bottom)",
          observed: "dark-mode toggle not visible at 390px width (overflows container).",
          expected: "toggle visible and operable at 390×844 and 1280×800.",
          fix: "let the settings row wrap; see apps/frontend/client/src/routes/settings/+page.svelte:42.",
        },
        {
          id: "D-2",
          severity: "MAJOR",
          dimension: "visual_fidelity",
          evidence: "diff.patch apps/.../VolumeSlider.svelte:18",
          observed: "slider track colour hard-coded as #3b82f6.",
          expected: "use the design token from the aikami-ui skill.",
          fix: "replace the literal with the theme token used by other sliders.",
        },
      ],
      verifiedClaims: ["volume persists across reload (e2e test passes)", "no console errors"],
      refutedClaims: ['"responsive on mobile" — contradicted by D-1'],
      summary: "Revision required due to mobile responsiveness blocker.",
    };

    const rendered = renderCritique(fixtureVerdict, 8.5);

    const expected = `Score: 7.6 / 10 (need 8.5). Decision: REVISE.

BLOCKER
- D-1 [functional] evidence: captures/settings-390x844.png (bottom)
  Observed: dark-mode toggle not visible at 390px width (overflows container).
  Expected: toggle visible and operable at 390×844 and 1280×800.
  Fix: let the settings row wrap; see apps/frontend/client/src/routes/settings/+page.svelte:42.

MAJOR
- D-2 [visual_fidelity] evidence: diff.patch apps/.../VolumeSlider.svelte:18
  Observed: slider track colour hard-coded as #3b82f6.
  Expected: use the design token from the aikami-ui skill.
  Fix: replace the literal with the theme token used by other sliders.

Verified (keep these): volume persists across reload (e2e test passes); no console errors.
Refuted claims: "responsive on mobile" — contradicted by D-1.`;

    expect(rendered.trim()).toBe(expected.trim());
  });
});
