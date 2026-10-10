# Changelog

All notable changes to Regent will be documented in this file.

## [Unreleased]

### Added - M8: Browser Operator, Dashboard & Notification Infrastructure
- Implemented `src/workers/browser.ts`:
  - Browser worker adapter using Playwright over CDP (`127.0.0.1:9222`) or headless Chrome launch.
  - T1 form-kind classifier (`login`, `payment`, `account`, `legal`, `other`).
  - Charter boundary enforcement on `browser.submit` (login forms fail closed to `A3 needs_grant`).
- Implemented `src/operator/dashboard/`:
  - `src/operator/dashboard/server.ts`: Dashboard HTTP server on `127.0.0.1:7780`.
  - `src/operator/dashboard/sse.ts`: Server-Sent Events (SSE) stream manager (`/api/events`).
  - `src/operator/dashboard/static/index.html`: Zero-build single static dashboard UI with active jobs table, live event stream, and emergency stop button.
  - Emergency stop API endpoint (`/api/stop`) engaging the `~/.regent/STOP` sentinel.
- Implemented `src/operator/notify.ts`:
  - Hermes messaging integration (`hermes send -t <channel> -q --file -`).
  - Quiet hours window filtering (`inQuietHours`) and digest queue.
- Acceptance integration tests in `test/integration/browser-operator.test.ts`, `test/integration/dashboard.test.ts`, and `test/unit/notify.test.ts` (112 tests passed across 24 test files).

### Added - M7: Operator Onboarding, Diagnostics & Consultant Selection
- Implemented `src/operator/doctor.ts` (`regent doctor` CLI).
- Implemented `src/operator/setup.ts` (`regent setup` CLI).
- Implemented profile setup scripts (`setup-hermes-profile.ps1`, `setup-vscode-profile.ps1`, `setup-chrome.ps1`).
- Implemented consultant selection (`scripts/pick-consultants.ts`).

### Added - M6: Dispatcher, Strategy Ladder & Toy Repo Orchestration
- Implemented worker capability scoring, Thompson sampling (`sampleBeta`), strategy ladder (R1–R7), active supervision, and daemon orchestration.
- Verified scripted worker full DAG completion, ladder climbing, and process termination.

### Added - M5: Director, Planner, Validator & Judge
- Implemented Zod schemas, JSON Schema exports, DAG planner, deterministic plan validator, judge service, verdict recomputation, and critique snapshot matching 09 §4.

### Added - M4: Workspace, Worktrees & Evidence Harness
- Implemented `WorktreeManager`, visual analysis (`frameStats`, `diffAgainst`), `capture-window.ps1`, T0 gates, and SHA-256 evidence manifests.

### Added - M3: Regent Bridge (MCP Server)
- Implemented Streamable HTTP MCP server on `127.0.0.1:7781/mcp` with 256-bit bearer token auth and 6 core tools.

### Added - M1: Kernel
- Implemented append-only event store using native `node:sqlite` in WAL mode, pure state machines, and authority charter engine.

### Added - M2: Worker Adapters & PROBES
- Built `scripts/probe-workers.ts` exercising and recording probes P1–P15 into `test/fixtures/probes/`.
- Built full worker adapter suite.

### Added - M0: Scaffold
- Initial repository skeleton, toolchain, and CLI stub `0.0.0`.
