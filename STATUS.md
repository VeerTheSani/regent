# Regent Build Status

Last updated: M6 Dispatcher, strategy ladder, toy repo e2e completed and verified.

## Current Milestone
- **Active Milestone**: M6 — Dispatcher, strategy ladder, toy repo e2e (COMPLETED)
- **Next Milestone**: M7 — Proxy-User, permissions in the loop, live workers (per ordering: M0 -> M2 -> M1 -> M3..M10)

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
| **M7** | Proxy-User, permissions loop, live workers | In Progress | 0 | $0.00 | Profile setup scripts, live worker loops, doctor command |
| **M8** | Browser operator, desktop capture, dashboard | Not Started | 0 | $0.00 | Depends on M6, M7 |
| **M9** | Delivery, final acceptance, retrospectives | Not Started | 0 | $0.00 | Depends on M8 |
| **M10** | Hardening & self-check | Not Started | 0 | $0.00 | Final integration |

## Acceptance Verification (M6)
- **Scripted Worker DAG Completion**:
  - Attempt 1 failed gates, attempt 2 revised, attempt 3 approved.
  - Job reached status `DONE` with full event trail in ledger (`test/integration/dispatcher-e2e.test.ts` PASS).
- **Strategy Ladder (Anti-Loop)**:
  - Stalled judge evaluations climbed R1 -> R2 -> R3 and gracefully terminated at attempt ceiling without infinite looping (`test/integration/dispatcher-e2e.test.ts` PASS).
- **Process Termination (Kill Test)**:
  - Process tree killed on stop signal within sub-second timeout (`test/integration/dispatcher-e2e.test.ts` PASS).
- **Toy Repo Target**:
  - `test/fixtures/toy-repo/` initialized with failing `add.ts` test case.
- **Total Suite Test Count**: **102 passed (102)** across 18 test files in 6.8s.

## Financial Accounting
- **Total Spend So Far**: $0.00
- **Live Call Cap (`REGENT_LIVE_MAX_USD`)**: $1.00 (default)

## Blockers
- None at M6.

## What's Next
1. Commit M6 to git on `main` (`M6: Dispatcher, strategy ladder, toy repo e2e`) and push to GitHub.
2. Advance to **M7: Proxy-User, permissions in the loop, Hermes + VS Code + chatbot workers live**.
