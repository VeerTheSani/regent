# Regent Build Status

Last updated: M5 Director, planner, validator, judge completed and verified.

## Current Milestone
- **Active Milestone**: M5 — Director, planner, validator, judge (COMPLETED)
- **Next Milestone**: M6 — Dispatcher, strategy ladder, toy repo e2e (per ordering: M0 -> M2 -> M1 -> M3..M10)

## Milestone Progress Table

| Milestone | Title | Status | Tests Passed | Live Cost (USD) | Notes / Blockers |
|---|---|---|---|---|---|
| **M0** | Scaffold | **GREEN** | 1 unit test | $0.00 | Toolchain verified: typecheck, lint, version, test |
| **M2** | Worker adapters + PROBES | **GREEN** | 8 unit tests | $0.00 | Probes P1–P15 executed/recorded, adapters & parsers verified |
| **M1** | Kernel: ledger, projector, reducers, charter, budget | **GREEN** | 56 unit tests | $0.00 | SQLite WAL ledger, pure reducers, 44-case charter table, crash resilience |
| **M3** | Regent Bridge (MCP server) | **GREEN** | 11 integration tests | $0.00 | Streamable HTTP MCP server on 127.0.0.1:7781, 6 tools verified via MCP client |
| **M4** | Workspace, worktrees, Evidence Harness | **GREEN** | 10 unit tests | $0.00 | Worktree isolation, conflict integration, pixel diffing, desktop capture, T0 gates |
| **M5** | Director, planner, validator, judge | **GREEN** | 14 unit tests | $0.00 | Mission brief, DAG planning, plan validation, verdict recomputation, critique snapshot |
| **M6** | Dispatcher, strategy ladder, toy repo e2e | In Progress | 0 | $0.00 | Worker scoring, ladder policy, supervisor, daemon orchestration, toy repo e2e |
| **M7** | Proxy-User, permissions loop, live workers | Not Started | 0 | $0.00 | Depends on M6 |
| **M8** | Browser operator, desktop capture, dashboard | Not Started | 0 | $0.00 | Depends on M6, M7 |
| **M9** | Delivery, final acceptance, retrospectives | Not Started | 0 | $0.00 | Depends on M8 |
| **M10** | Hardening & self-check | Not Started | 0 | $0.00 | Final integration |

## Acceptance Verification (M5)
- **Plan Validator**:
  - Detected cycles in contract DAG (`test/unit/validate-plan.test.ts` PASS).
  - Detected overlapping write scopes between parallel-eligible siblings (`test/unit/validate-plan.test.ts` PASS).
  - Enforced 20% budget reserve (`test/unit/validate-plan.test.ts` PASS).
  - Validated 5-contract Aikami settings-page DAG from 04 §2 cleanly (`test/unit/validate-plan.test.ts` PASS).
- **Director**:
  - Verified `interpretJob` produces a valid `MissionBrief` validating against Zod (`test/unit/director.test.ts` PASS).
  - Verified `generatePlan` creates valid DAG plans (`test/unit/director.test.ts` PASS).
- **Verdict Recomputation**:
  - Overrode inconsistent 9.4 composite to 7.0 and APPROVE to REVISE (`test/unit/verdict-recompute.test.ts` PASS).
  - Confirmed BLOCKER defects force REVISE unconditionally (`test/unit/verdict-recompute.test.ts` PASS).
- **Critique Renderer**:
  - Reproduced the 09 §4 critique format byte-for-byte from a fixture verdict (`test/unit/critique-snapshot.test.ts` PASS).
- **Prompt Renderer**:
  - Threw immediately on missing variables and unclosed/unknown constructs (`test/unit/prompt-renderer.test.ts` PASS).
  - Correctly evaluated `{{#if var}}` truthy/falsy conditional blocks.
- **Total Suite Test Count**: **99 passed (99)** across 17 test files in 2.54s.

## Financial Accounting
- **Total Spend So Far**: $0.00
- **Live Call Cap (`REGENT_LIVE_MAX_USD`)**: $1.00 (default)

## Blockers
- None at M5.

## What's Next
1. Commit M5 to git on `main` (`M5: Director, planner, validator, judge`) and push to GitHub.
2. Advance to **M6: Dispatcher, strategy ladder, toy repo e2e**.
