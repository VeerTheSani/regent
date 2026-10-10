# Changelog

All notable changes to Regent will be documented in this file.

## [Unreleased]

### Added - M9: Delivery Reporting, Final Acceptance & Retrospective Memory
- Implemented `src/reporter/delivery.ts`:
  - `generateDeliveryReport` rendering complete `DELIVERY.md` per 11 §3.
  - Enforced strict honesty checks: throws error if any `verified` or `judged` DoD item lacks an `evidenceLink`.
  - Marks title and status as `PARTIAL` when complete status is not achieved.
  - Aggregates true costs directly from ledger events.
- Implemented `src/integrator/final-acceptance.ts`:
  - Evaluates job against MissionBrief DoD items, issuing `APPROVE` or `REVISE` with blockers.
- Implemented durable memory system:
  - `src/memory/stats.ts`: Worker stats tracking with weekly decay factor.
  - `src/memory/lessons.ts`: Storage and query retrieval of lessons in `~/.regent/memory/lessons.jsonl`.
  - `src/memory/retrospective.ts`: Automatic extraction of learnings from gate failures and ladder revisions.
- Authored Aikami project profile at `~/.regent/memory/projects/aikami.yaml`.
- Acceptance unit tests in `test/unit/delivery.test.ts`, `test/unit/final-acceptance.test.ts`, and `test/unit/retrospective.test.ts` (120 tests passed across 27 test files).

### Added - M8: Browser Operator, Dashboard & Notification Infrastructure
- Implemented `src/workers/browser.ts`: Playwright browser operator with form classification and Charter gating.
- Implemented dashboard server on port 7780 with SSE stream (`/api/events`), static UI, and emergency stop API (`/api/stop`).
- Implemented notification dispatcher (`src/operator/notify.ts`) with quiet hours filtering.

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
