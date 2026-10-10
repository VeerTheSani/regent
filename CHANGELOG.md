# Changelog

All notable changes to Regent will be documented in this file.

## [Unreleased]

### Added - M2: Worker Adapters & PROBES
- Built `scripts/probe-workers.ts` exercising and recording probes P1–P15 into `test/fixtures/probes/`.
- Recorded empirical CLI fixtures for Claude Code (P1, P2, P3, P4, P5), Hermes Agent (P6, P7, P8, P9), VS Code (P10, P11), Playwright MCP (P12), and Chrome CDP (P13).
- Implemented core worker abstractions:
  - `src/workers/types.ts`: worker interfaces, event unions, and request/response contracts.
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
