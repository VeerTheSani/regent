# Regent Build Status

Last updated: M1 Kernel completed and verified.

## Current Milestone
- **Active Milestone**: M1 — Kernel (COMPLETED)
- **Next Milestone**: M3 — Regent Bridge (MCP server) (per ordering: M0 -> M2 -> M1 -> M3..M10)

## Milestone Progress Table

| Milestone | Title | Status | Tests Passed | Live Cost (USD) | Notes / Blockers |
|---|---|---|---|---|---|
| **M0** | Scaffold | **GREEN** | 1 unit test | $0.00 | Toolchain verified: typecheck, lint, version, test |
| **M2** | Worker adapters + PROBES | **GREEN** | 8 unit tests | $0.00 | Probes P1–P15 executed/recorded, adapters & parsers verified |
| **M1** | Kernel: ledger, projector, reducers, charter, budget | **GREEN** | 56 unit tests | $0.00 | SQLite WAL ledger, pure reducers, 44-case charter table, crash resilience |
| **M3** | Regent Bridge (MCP server) | In Progress | 0 | $0.00 | Streamable HTTP MCP server on 127.0.0.1:7781 |
| **M4** | Workspace, worktrees, Evidence Harness | Not Started | 0 | $0.00 | Depends on M1, M2 |
| **M5** | Director, planner, validator, judge | Not Started | 0 | $0.00 | Depends on M1, M2, M3 |
| **M6** | Dispatcher, strategy ladder, toy repo e2e | Not Started | 0 | $0.00 | Depends on M1–M5 |
| **M7** | Proxy-User, permissions loop, live workers | Not Started | 0 | $0.00 | Depends on M6 |
| **M8** | Browser operator, desktop capture, dashboard | Not Started | 0 | $0.00 | Depends on M6, M7 |
| **M9** | Delivery, final acceptance, retrospectives | Not Started | 0 | $0.00 | Depends on M8 |
| **M10** | Hardening & self-check | Not Started | 0 | $0.00 | Final integration |

## Acceptance Verification (M1)
- **Determinism**: Replaying identical event list yields deep-equal projections (`test/unit/projector.test.ts` PASS).
- **Reducers**:
  - `reduceContract`: APPROVE path, REVISE path, ladder climb on 2 stalled scores, regression guard restores best attempt (`test/unit/state-machines.test.ts` PASS).
  - `reduceJob`: full lifecycle, budget pausing, resuming (`test/unit/state-machines.test.ts` PASS).
- **Charter Table**: 44 distinct test cases covering A0..AX, tainted A2, grant match, expiry, exhaustion, kill switch overrides on all tiers, unknown action fail-closed (`test/unit/charter.test.ts` PASS).
- **Ledger Idempotency**: Duplicate `idem_key` append is a no-op returning existing seq (`test/unit/ledger.test.ts` PASS).
- **Crash Resilience**: Child process killed with `SIGKILL` mid-1000-event append run; reopened database is fully intact with contiguous seq and no corruption (`test/unit/ledger.test.ts` PASS).
- **Total Suite Test Count**: **64 passed (64)** across 7 test files in under 2 seconds.

## Financial Accounting
- **Total Spend So Far**: $0.00
- **Live Call Cap (`REGENT_LIVE_MAX_USD`)**: $1.00 (default)

## Blockers
- None at M1.

## What's Next
1. Commit M1 to git on `main` (`M1: Kernel: ledger, projector, reducers, charter, budget`) and push to GitHub.
2. Advance to **M3 — Regent Bridge (MCP server)**.
