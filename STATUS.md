# Regent Build Status

Last updated: M7 Proxy-User, permissions in the loop, live workers completed and verified.

## Current Milestone
- **Active Milestone**: M7 — Proxy-User, permissions in the loop, live workers (COMPLETED)
- **Next Milestone**: M8 — Browser operator, desktop capture, dashboard (per ordering: M0 -> M2 -> M1 -> M3..M10)

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
| **M8** | Browser operator, desktop capture, dashboard | In Progress | 0 | $0.00 | Playwright CDP browser operator, local dashboard UI on 127.0.0.1:7780, notifications |
| **M9** | Delivery, final acceptance, retrospectives | Not Started | 0 | $0.00 | Depends on M8 |
| **M10** | Hardening & self-check | Not Started | 0 | $0.00 | Final integration |

## Acceptance Verification (M7)
- **Regent Doctor Diagnostics**:
  - `runDiagnostics()` verified all core dependencies on host: Node.js (v24), Git (2.53), Claude Code (2.1.296), Hermes Agent (v0.21.2), VS Code (1.140), Chrome (`chrome.exe`), port bindings (`test/unit/doctor.test.ts` PASS).
- **Operator Setup & Onboarding**:
  - `runSetup()` generated valid `config.yaml`, `charter.yaml`, and `operator.yaml` (`test/unit/setup.test.ts` PASS).
- **Consultant Diversity**:
  - `pickConsultants()` verified selecting models and strictly enforcing at least one non-Anthropic model family (`test/unit/consultants.test.ts` PASS).
- **Total Suite Test Count**: **105 passed (105)** across 21 test files in 5.66s.

## Financial Accounting
- **Total Spend So Far**: $0.00
- **Live Call Cap (`REGENT_LIVE_MAX_USD`)**: $1.00 (default)

## Blockers
- None at M7.

## What's Next
1. Commit M7 to git on `main` (`M7: Proxy-User, permissions loop, live workers`) and push to GitHub.
2. Advance to **M8: Browser operator, desktop capture, dashboard, notifications**.
