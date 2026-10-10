# Regent Build Status

Last updated: M8 Browser operator, desktop capture, dashboard completed and verified.

## Current Milestone
- **Active Milestone**: M8 — Browser operator, desktop capture, dashboard (COMPLETED)
- **Next Milestone**: M9 — Delivery, final acceptance, retrospectives (per ordering: M0 -> M2 -> M1 -> M3..M10)

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
| **M9** | Delivery, final acceptance, retrospectives | In Progress | 0 | $0.00 | Delivery report generator, final acceptance judge, retrospectives, calibration |
| **M10** | Hardening & self-check | Not Started | 0 | $0.00 | Final integration |

## Acceptance Verification (M8)
- **Browser Operator & Form Security**:
  - Playwright captured static page, detected deliberate console error (`test/integration/browser-operator.test.ts` PASS).
  - T1 form-kind classifier identified `login` form.
  - Charter evaluated `browser.submit` with login formKind => `A3 needs_grant` without grant (`test/integration/browser-operator.test.ts` PASS).
- **Dashboard & Live SSE Streams**:
  - `GET /api/jobs` returned JSON projections (`test/integration/dashboard.test.ts` PASS).
  - `GET /api/events` connected SSE stream and received live test broadcast (`test/integration/dashboard.test.ts` PASS).
  - `POST /api/stop` engaged emergency STOP sentinel cleanly (`test/integration/dashboard.test.ts` PASS).
- **Notifications & Quiet Hours**:
  - `inQuietHours` evaluated time boundaries and queued non-critical info messages for digest (`test/unit/notify.test.ts` PASS).
  - Live notification path gated by `REGENT_LIVE=1`.
- **Total Suite Test Count**: **112 passed (112)** across 24 test files in 10.18s.

## Financial Accounting
- **Total Spend So Far**: $0.00
- **Live Call Cap (`REGENT_LIVE_MAX_USD`)**: $1.00 (default)

## Blockers
- None at M8.

## What's Next
1. Commit M8 to git on `main` (`M8: Browser operator, desktop capture in gates, dashboard, notifications`) and push to GitHub.
2. Advance to **M9: Delivery, final acceptance, retrospectives, Aikami profile**.
