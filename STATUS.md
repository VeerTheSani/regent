# Regent Build Status

Last updated: M0 Scaffold completed and verified.

## Current Milestone
- **Active Milestone**: M0 — Scaffold (COMPLETED)
- **Next Milestone**: M2 — Worker adapters + PROBES (per build plan ordering: M0 -> M2 -> M1 -> M3..M10)

## Milestone Progress Table

| Milestone | Title | Status | Tests Passed | Live Cost (USD) | Notes / Blockers |
|---|---|---|---|---|---|
| **M0** | Scaffold | **GREEN** | 1 unit test | $0.00 | Toolchain verified: typecheck, lint, version, test |
| **M2** | Worker adapters + PROBES | In Progress | 0 | $0.00 | Probes P1–P15 to be recorded as fixtures |
| **M1** | Kernel: ledger, projector, reducers, charter, budget | Not Started | 0 | $0.00 | Next after M2 |
| **M3** | Regent Bridge (MCP server) | Not Started | 0 | $0.00 | Depends on M1, M2 |
| **M4** | Workspace, worktrees, Evidence Harness | Not Started | 0 | $0.00 | Depends on M1, M2 |
| **M5** | Director, planner, validator, judge | Not Started | 0 | $0.00 | Depends on M1, M2, M3 |
| **M6** | Dispatcher, strategy ladder, toy repo e2e | Not Started | 0 | $0.00 | Depends on M1–M5 |
| **M7** | Proxy-User, permissions loop, live workers | Not Started | 0 | $0.00 | Depends on M6 |
| **M8** | Browser operator, desktop capture, dashboard | Not Started | 0 | $0.00 | Depends on M6, M7 |
| **M9** | Delivery, final acceptance, retrospectives | Not Started | 0 | $0.00 | Depends on M8 |
| **M10** | Hardening & self-check | Not Started | 0 | $0.00 | Final integration |

## Acceptance Verification (M0)
- `npm install`: PASS (clean dependency tree, Node 24 ESM)
- `npm run typecheck`: PASS (`tsc --noEmit` exits 0)
- `npm run lint`: PASS (`biome check .` 81 files checked, 0 errors)
- `npx tsx bin/regent.ts --version`: PASS (printed `0.0.0`)
- `npm test`: PASS (1/1 unit test green)

## Financial Accounting
- **Total Spend So Far**: $0.00
- **Live Call Cap (`REGENT_LIVE_MAX_USD`)**: $1.00 (default)

## Blockers
- None at M0.

## What's Next
1. Commit M0 to git on `main` (`M0: Scaffold`).
2. Push M0 to GitHub (`https://github.com/VeerTheSani/regent`).
3. Begin M2 (Worker adapters & Probes P1–P15) to record CLI fixtures.
