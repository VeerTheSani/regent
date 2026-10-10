# Regent Build Status

Last updated: M9 Delivery, final acceptance, retrospectives completed and verified.

## Current Milestone
- **Active Milestone**: M9 — Delivery, final acceptance, retrospectives (COMPLETED)
- **Next Milestone**: M10 — Hardening & self-check (per ordering: M0 -> M2 -> M1 -> M3..M10)

## Milestone Progress Table

| Milestone | Title | Status | Tests Passed | Live Cost (USD) | Notes / Blockers |
|---|---|---|---|---|---|
| **M0** | Scaffold | **GREEN** | 1 unit test | $0.00 | Toolchain verified: typecheck, lint, version, test |
| **M2** | Worker adapters + PROBES | **GREEN** | 8 unit tests | $0.00 | Probes P1–P15 executed/recorded, adapters & parsers verified |
| **M1** | Kernel: ledger, projector, reducers, charter, budget | **GREEN** | 56 unit tests | $0.00 | SQLite WAL ledger, pure reducers, 44-case charter table, crash resilience |
| **M3** | Regent Bridge (MCP server) | **GREEN** | 11 integration tests | $0.00 | Streamable HTTP MCP server on 127.0.0.1:7781, 6 tools verified via MCP client |
| **M4** | Workspace, worktrees, Evidence Harness | **GREEN** | 10 unit tests | $0.00 | Worktree isolation, conflict integration, pixel diffing, desktop capture, T0 gates |
| **M5** | Director, planner, validator, judge | **GREEN** | 14 unit tests | $0.00 | Mission brief, DAG planning, plan validation, verdict recomputation, critique snapshot |
| **M6** | Dispatcher, strategy ladder, toy repo e2e | **GREEN** | 3 integration tests | $0.00 | Worker scoring, Thompson sampling, strategy ladder, daemon orchestration, toy repo e2e |
| **M7** | Proxy-User, permissions loop, live workers | **GREEN** | 3 unit tests | $0.00 | Profile setup scripts, regent doctor diagnostics, operator setup onboarding, consultant selection |
| **M8** | Browser operator, desktop capture, dashboard | **GREEN** | 7 tests | $0.00 | Playwright browser operator, form classification & charter, dashboard UI & SSE, notifications |
| **M9** | Delivery, final acceptance, retrospectives | **GREEN** | 8 unit tests | $0.00 | Delivery report generator, final acceptance judge, retrospectives, calibration, Aikami profile |
| **M10** | Hardening & self-check | In Progress | 0 | $0.00 | Secret leak audit, prompt injection resistance, recovery resilience, load concurrency, docs |

## Acceptance Verification (M9)
- **Delivery Report Generator**:
  - Rendered complete `DELIVERY.md` with Definition-of-Done table, evidence links, costs, caveats (`test/unit/delivery.test.ts` PASS).
  - Enforced strict honesty: throws an error if any DoD claimed verified or judged lacks a verifiable `evidenceLink`.
  - Partial deliverables automatically marked `PARTIAL`.
- **Final Acceptance Evaluator**:
  - Evaluated job against MissionBrief DoD items, issuing `APPROVE` when verified or `REVISE` with cited blockers when items are missing (`test/unit/final-acceptance.test.ts` PASS).
- **Durable Memory & Retrospectives**:
  - `WorkerStatsTracker` tracks run counts, costs, durations, and applies exponential weekly decay (`test/unit/retrospective.test.ts` PASS).
  - `LessonStore` appends and queries scoped lessons in `~/.regent/memory/lessons.jsonl`.
  - `analyzeJobRetrospective` extracts durable insights from repeated gate failures or ladder climbs.
- **Aikami Project Profile**:
  - Configured at `~/.regent/memory/projects/aikami.yaml` with verified task scripts.
- **Total Suite Test Count**: **120 passed (120)** across 27 test files in 6.41s.

## Financial Accounting
- **Total Spend So Far**: $0.00
- **Live Call Cap (`REGENT_LIVE_MAX_USD`)**: $1.00 (default)

## Blockers
- None at M9.

## What's Next
1. Commit M9 to git on `main` (`M9: Delivery, final acceptance, retrospectives, Aikami profile`) and push to GitHub.
2. Advance to **M10 — Hardening & self-check**:
   - Secrets leakage audit across attempt folders and logs.
   - Prompt-injection resistance test.
   - Mid-job crash and recovery resumption test.
   - Parallel multi-worker load concurrency test.
   - Comprehensive professional documentation with architectural diagrams, visual layout, and operator quick start.
