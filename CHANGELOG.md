# Changelog

All notable changes to Regent will be documented in this file.

## [Unreleased]

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
- Comprehensive unit test coverage across 64 tests:
  - `test/unit/ledger.test.ts`: WAL mode, duplicate idempotency, and child-process crash resilience.
  - `test/unit/projector.test.ts`: determinism test replaying identical event sequences.
  - `test/unit/state-machines.test.ts`: contract approve/revise/climb/regression guard and job lifecycle.
  - `test/unit/charter.test.ts`: 44-case table test covering all authority tiers, grants, taints, and kill-switch overrides.
  - `test/unit/budget.test.ts`: budget metering and ceiling breach detection.

### Added - M2: Worker Adapters & PROBES
- Built `scripts/probe-workers.ts` exercising and recording probes P1–P15 into `test/fixtures/probes/`.
- Recorded empirical CLI fixtures for Claude Code (P1, P2, P3, P4, P5), Hermes Agent (P6, P7, P8, P9), VS Code (P10, P11), Playwright MCP (P12), and Chrome CDP (P13).
- Implemented core worker abstractions:
  - `src/workers/types.ts`: worker interfaces, event unions, and request/result types.
  - `src/workers/spawn.ts`: `spawnTree()` with cross-spawn and tree-kill.
  - `src/workers/line-stream.ts`: safe stream-to-line chunking.
  - `src/workers/attempt-log.ts`: teeing output to `attempt-<n>/worker.log`.
  - `src/workers/claude-code.ts`: Claude Code adapter using recorded stream-json parser.
  - `src/workers/hermes.ts`: Hermes Agent quiet invocation adapter with stdout/stderr separation.
  - `src/workers/vscode.ts`: VS Code Agent Mode GUI adapter.
  - `src/workers/chatbot.ts`: OpenRouter / API consultant adapter.
  - `src/workers/shell.ts`: direct deterministic shell worker adapter.
  - `src/workers/browser.ts`: Chrome CDP / Playwright operator adapter.
- Unit tests in `test/adapters/worker-parsers.test.ts` verifying parser behavior against all recorded probe fixtures.
- Documented findings and spec corrections in `DECISIONS.md`.

### Added - M0: Scaffold
- Initial repository skeleton matching spec layout (13 §2).
- `package.json`, `tsconfig.json`, `biome.json`, `vitest.config.ts`, `.gitignore`.
- CLI stub in `bin/regent.ts` responding with version `0.0.0`.
- Baseline configuration files: `charter/charter.default.yaml` and default rubrics in `rubrics/`.
- Project documentation: `README.md`, `DECISIONS.md`, `STATUS.md`, `BLOCKERS.md`.
