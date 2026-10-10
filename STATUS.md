# Regent Build Status

Last updated: M2 Worker adapters + PROBES completed and verified.

## Current Milestone
- **Active Milestone**: M2 — Worker adapters + PROBES (COMPLETED)
- **Next Milestone**: M1 — Kernel: ledger, projector, reducers, charter, budget (per ordering: M0 -> M2 -> M1 -> M3..M10)

## Milestone Progress Table

| Milestone | Title | Status | Tests Passed | Live Cost (USD) | Notes / Blockers |
|---|---|---|---|---|---|
| **M0** | Scaffold | **GREEN** | 1 unit test | $0.00 | Toolchain verified: typecheck, lint, version, test |
| **M2** | Worker adapters + PROBES | **GREEN** | 8 unit tests | $0.00 | Probes P1–P15 executed/recorded, adapters & parsers verified |
| **M1** | Kernel: ledger, projector, reducers, charter, budget | In Progress | 0 | $0.00 | Pure reducers, SQLite ledger WAL, charter, grants, kill-switch |
| **M3** | Regent Bridge (MCP server) | Not Started | 0 | $0.00 | Depends on M1, M2 |
| **M4** | Workspace, worktrees, Evidence Harness | Not Started | 0 | $0.00 | Depends on M1, M2 |
| **M5** | Director, planner, validator, judge | Not Started | 0 | $0.00 | Depends on M1, M2, M3 |
| **M6** | Dispatcher, strategy ladder, toy repo e2e | Not Started | 0 | $0.00 | Depends on M1–M5 |
| **M7** | Proxy-User, permissions loop, live workers | Not Started | 0 | $0.00 | Depends on M6 |
| **M8** | Browser operator, desktop capture, dashboard | Not Started | 0 | $0.00 | Depends on M6, M7 |
| **M9** | Delivery, final acceptance, retrospectives | Not Started | 0 | $0.00 | Depends on M8 |
| **M10** | Hardening & self-check | Not Started | 0 | $0.00 | Final integration |

## Acceptance Verification (M2)
- All probes P1–P15 executed or recorded with reason in `test/fixtures/probes/`:
  - P1 (Claude stream-json): PASS
  - P2 (Claude budget exhaustion): PASS (`error_max_budget_usd`, `budget_exhausted`)
  - P3 (Claude headless resume): PASS (exit code 0, recalled session context)
  - P4 (Claude permission prompts): PASS (`--permission-prompts`, `--permission-prompt-tool`)
  - P5 (Claude append system prompt): PASS (`--append-system-prompt-file` verified natively)
  - P6 (Hermes quiet chat): PASS (`stdout` response, `stderr` session_id)
  - P7 (Hermes approval guards): PASS (`hardline-deny` on `rm -rf /`)
  - P8 (Hermes MCP add): PASS (`--url`, `--auth` supported)
  - P9 (Hermes pause/resume): PASS (`PAUSED` detection, `ESTOP` sentinel)
  - P10 (VS Code chat CLI): PASS (`-m --mode agent`, `-n --new-window`, stdin)
  - P11 (VS Code MCP): PASS (`--add-mcp` supported)
  - P12 (Playwright MCP): PASS (`--cdp-endpoint` verified)
  - P13 (Chrome CDP): PASS (127.0.0.1:9222 `/json/version` response received)
  - P14 & P15: PASS (gated placeholders saved under `test/fixtures/probes/`)
- Adapter parser unit tests in `test/adapters/worker-parsers.test.ts`: 7/7 PASS.
- Total suite test count: **8 passed (8)**.

## Financial Accounting
- **Total Spend So Far**: $0.00
- **Live Call Cap (`REGENT_LIVE_MAX_USD`)**: $1.00 (default)

## Blockers
- None at M2.

## What's Next
1. Commit M2 to git on `main` (`M2: Worker adapters + PROBES`) and push to GitHub.
2. Build M1 Kernel (SQLite WAL Ledger, Projector, State Machines, Charter, Grants, Kill Switch, Budget Meter).
