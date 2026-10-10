# Regent Build Status

Last updated: M4 Workspace, worktrees, Evidence Harness completed and verified.

## Current Milestone
- **Active Milestone**: M4 — Workspace, worktrees, Evidence Harness (COMPLETED)
- **Next Milestone**: M5 — Director, planner, validator, judge (per ordering: M0 -> M2 -> M1 -> M3..M10)

## Milestone Progress Table

| Milestone | Title | Status | Tests Passed | Live Cost (USD) | Notes / Blockers |
|---|---|---|---|---|---|
| **M0** | Scaffold | **GREEN** | 1 unit test | $0.00 | Toolchain verified: typecheck, lint, version, test |
| **M2** | Worker adapters + PROBES | **GREEN** | 8 unit tests | $0.00 | Probes P1–P15 executed/recorded, adapters & parsers verified |
| **M1** | Kernel: ledger, projector, reducers, charter, budget | **GREEN** | 56 unit tests | $0.00 | SQLite WAL ledger, pure reducers, 44-case charter table, crash resilience |
| **M3** | Regent Bridge (MCP server) | **GREEN** | 11 integration tests | $0.00 | Streamable HTTP MCP server on 127.0.0.1:7781, 6 tools verified via MCP client |
| **M4** | Workspace, worktrees, Evidence Harness | **GREEN** | 10 unit tests | $0.00 | Worktree isolation, conflict integration, pixel diffing, desktop capture, T0 gates |
| **M5** | Director, planner, validator, judge | In Progress | 0 | $0.00 | Mission brief, DAG planning, plan validation, judge and critique rendering |
| **M6** | Dispatcher, strategy ladder, toy repo e2e | Not Started | 0 | $0.00 | Depends on M1–M5 |
| **M7** | Proxy-User, permissions loop, live workers | Not Started | 0 | $0.00 | Depends on M6 |
| **M8** | Browser operator, desktop capture, dashboard | Not Started | 0 | $0.00 | Depends on M6, M7 |
| **M9** | Delivery, final acceptance, retrospectives | Not Started | 0 | $0.00 | Depends on M8 |
| **M10** | Hardening & self-check | Not Started | 0 | $0.00 | Final integration |

## Acceptance Verification (M4)
- **Worktree Isolation & Conflict Detection**:
  - Created isolated worktrees, committed independently, integrated with deliberate conflict => `{ ok: false, conflictWith }` (`test/unit/worktrees.test.ts` PASS).
  - Confirmed operator checkout working tree remains 100% clean and on `main` branch.
- **Visual Frame & Pixel Diffing**:
  - `frameStats` on solid PNG detected `blank: true` (`test/unit/pixels.test.ts` PASS).
  - `frameStats` on multi-color pattern detected `blank: false` (`test/unit/pixels.test.ts` PASS).
  - `diffAgainst` on identical PNGs yielded `changedRatio: 0` (`test/unit/pixels.test.ts` PASS).
- **Desktop Window & Screen Capture**:
  - `captureDesktop` executed `capture-window.ps1` without title; produced physical pixel PNG of nonzero size (`test/unit/desktop.test.ts` PASS).
- **T0 Gates & Secret Scanning**:
  - `secret_scan` flagged fake `sk-ant-...` key in diff; verified detail output logged the rule without leaking the secret value (`test/unit/gates.test.ts` PASS).
  - Scope gate and file existence gates verified.
- **Total Suite Test Count**: **85 passed (85)** across 12 test files in 2.55s.

## Financial Accounting
- **Total Spend So Far**: $0.00
- **Live Call Cap (`REGENT_LIVE_MAX_USD`)**: $1.00 (default)

## Blockers
- None at M4.

## What's Next
1. Commit M4 to git on `main` (`M4: Workspace, worktrees, Evidence Harness`) and push to GitHub.
2. Advance to **M5: Director, planner, validator, judge**.
