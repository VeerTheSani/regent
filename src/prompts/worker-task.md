# Contract {{contractId}} — {{title}}  (attempt {{attempt}})

## Goal
{{goal}}

## Why this matters (from the Mission Brief)
{{briefExcerpt}}

## Read first
{{contextList}}

## Acceptance — Regent will verify all of this
{{gatesAsChecklist}}
{{dodItems}}
{{visualTargets}}

## Constraints
{{constraints}}

{{#if critique}}
## What the reviewer found in attempt {{prevAttempt}} — fix every item
{{critique}}
Do not regress what was already right: {{verifiedClaims}}
{{/if}}

{{#if attemptHistory}}
## Earlier attempts and why they failed
{{attemptHistory}}
Try a different approach from the ones above.
{{/if}}

{{#if guidance}}
## Guidance from Regent
{{guidance}}
{{/if}}

When done, run the acceptance commands yourself, then call `regent_report`.
