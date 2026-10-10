# Regent Build Status

Last updated: M3 Regent Bridge (MCP server) completed and verified.

## Current Milestone
- **Active Milestone**: M3 — Regent Bridge (MCP server) (COMPLETED)
- **Next Milestone**: M4 — Workspace, worktrees, Evidence Harness (per ordering: M0 -> M2 -> M1 -> M3..M10)

## Milestone Progress Table

| Milestone | Title | Status | Tests Passed | Live Cost (USD) | Notes / Blockers |
|---|---|---|---|---|---|
| **M0** | Scaffold | **GREEN** | 1 unit test | $0.00 | Toolchain verified: typecheck, lint, version, test |
| **M2** | Worker adapters + PROBES | **GREEN** | 8 unit tests | $0.00 | Probes P1–P15 executed/recorded, adapters & parsers verified |
| **M1** | Kernel: ledger, projector, reducers, charter, budget | **GREEN** | 56 unit tests | $0.00 | SQLite WAL ledger, pure reducers, 44-case charter table, crash resilience |
| **M3** | Regent Bridge (MCP server) | **GREEN** | 11 integration tests | $0.00 | Streamable HTTP MCP server on 127.0.0.1:7781, 6 tools verified via MCP client |
| **M4** | Workspace, worktrees, Evidence Harness | In Progress | 0 | $0.00 | Git worktrees, gates, CDP web capture, pixel diffs, window capture |
| **M5** | Director, planner, validator, judge | Not Started | 0 | $0.00 | Depends on M1, M2, M3 |
| **M6** | Dispatcher, strategy ladder, toy repo e2e | Not Started | 0 | $0.00 | Depends on M1–M5 |
| **M7** | Proxy-User, permissions loop, live workers | Not Started | 0 | $0.00 | Depends on M6 |
| **M8** | Browser operator, desktop capture, dashboard | Not Started | 0 | $0.00 | Depends on M6, M7 |
| **M9** | Delivery, final acceptance, retrospectives | Not Started | 0 | $0.00 | Depends on M8 |
| **M10** | Hardening & self-check | Not Started | 0 | $0.00 | Final integration |

## Acceptance Verification (M3)
- **Loopback binding**: Verified server binds strictly to `127.0.0.1:7781` (`test/integration/bridge.test.ts` PASS).
- **Authentication**: Unauthenticated calls yield 401 Unauthorized (`test/integration/bridge.test.ts` PASS).
- **Tool Listing**: Official `@modelcontextprotocol/sdk` client discovers all 6 registered tools (`test/integration/bridge.test.ts` PASS).
- **Tool Execution**:
  - `regent_get_contract` returns contract details.
  - `regent_ask` returns Proxy-User classified decisions/facts.
  - `regent_progress` records progress to ledger and resets stall timers.
  - `regent_request_evidence` handles evidence capture requests.
  - `regent_report` records worker report.
  - `regent_permit`:
    - `rm -rf /` => `deny` (AX).
    - `Write` in attempt directory => `allow` (A1).
    - `git push origin main` => `deny` with guidance not to retry.
- **Total Suite Test Count**: **75 passed (75)** across 8 test files in 2.34s.

## Financial Accounting
- **Total Spend So Far**: $0.00
- **Live Call Cap (`REGENT_LIVE_MAX_USD`)**: $1.00 (default)

## Blockers
- None at M3.

## What's Next
1. Commit M3 to git on `main` (`M3: Regent Bridge (MCP server)`) and push to GitHub.
2. Advance to **M4: Workspace, worktrees, Evidence Harness**.
