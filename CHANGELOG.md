# Changelog

All notable changes to Regent will be documented in this file.

## [Unreleased]

### Added - M3: Regent Bridge (MCP Server)
- Implemented `src/bridge/server.ts`:
  - Streamable HTTP MCP server bound to loopback `127.0.0.1:7781/mcp`.
  - 256-bit cryptographic bearer token authentication stored at `~/.regent/token`.
  - Registered all 6 core tools: `regent_get_contract`, `regent_ask`, `regent_permit`, `regent_progress`, `regent_request_evidence`, `regent_report`.
- Implemented `src/bridge/permits.ts`:
  - `PermitArbiter` mapping worker tool invocations (`Bash`, `Write`, `Edit`, `WebFetch`, browser tools) to Charter actions.
  - Action evaluation against Charter rules with structured responses (`allow` vs `deny` with guidance).
  - Recorded `permission.decided` events in the ledger.
- Implemented `src/bridge/proxy-user.ts`:
  - Standing in for operator with classification (`fact`, `decision`, `assumption`, `deferred`).
  - Recorded `worker.question` and `worker.answered` in the ledger.
- Implemented `src/bridge/reports.ts`:
  - In-memory registry for worker attempt reports.
- Comprehensive integration suite in `test/integration/bridge.test.ts` (11 tests passed):
  - 401 on unauthenticated calls.
  - Strict loopback binding to `127.0.0.1`.
  - Full tool discovery via `tools/list` using official `@modelcontextprotocol/sdk` client.
  - Verification of `regent_permit` behaviors (`rm -rf /` denied, `Write` in attempt dir allowed, `git push origin main` denied with non-retry guidance).

### Added - M1: Kernel
- Implemented `src/kernel/ledger.ts`:
  - Append-only event store using native `node:sqlite` in WAL mode.
  - Idempotent appends with unique `idem_key` checks returning existing sequence IDs.
  - Filtered Node 24 experimental warnings cleanly.
- Implemented `src/kernel/projector.ts`:
  - Deterministic state projector rebuilding `jobs_view`, `contracts_view`, and `worker_stats`.
- Implemented pure state machines:
  - `src/kernel/contract-machine.ts`: `reduceContract`, strategy ladder climbing (`nextRung`), and regression guard.
  - `src/kernel/job-machine.ts`: `reduceJob` lifecycle state transitions, pausing, and resuming.
- Implemented authority & governance engine:
  - `src/kernel/charter.ts`: hierarchical classification (A0–AX), taint tracking, and first-match rule evaluation.
  - `src/kernel/grants.ts`: structured grant matching, scoping with glob support, expiration checks, and use counters.
  - `src/kernel/kill-switch.ts`: STOP sentinel file monitoring and emergency hard-stop enforcement.
  - `src/kernel/budget.ts`: job, contract, and attempt ceiling meters.
  - `src/kernel/secrets.ts`: regex and known-secret scanner with automatic redaction.
  - `src/kernel/router.ts`: model call tracking and ledger budget charging.
  - `src/kernel/scheduler.ts`: contract DAG dependency resolution.
  - `src/kernel/effects.ts`: state-transition subscribed effect bus with idempotency keys.
- Comprehensive unit test coverage across 56 tests.

### Added - M2: Worker Adapters & PROBES
- Built `scripts/probe-workers.ts` exercising and recording probes P1–P15 into `test/fixtures/probes/`.
- Recorded empirical CLI fixtures for Claude Code (P1, P2, P3, P4, P5), Hermes Agent (P6, P7, P8, P9), VS Code (P10, P11), Playwright MCP (P12), and Chrome CDP (P13).
- Implemented core worker abstractions and adapters.

### Added - M0: Scaffold
- Initial repository skeleton matching spec layout (13 §2).
- `package.json`, `tsconfig.json`, `biome.json`, `vitest.config.ts`, `.gitignore`.
- CLI stub in `bin/regent.ts` responding with version `0.0.0`.
