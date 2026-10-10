# Changelog

All notable changes to Regent will be documented in this file.

## [1.0.0] - 2026-10-10

### Added - M10: Hardening, Security & Final Self-Check
- Comprehensive hardening integration test suite (`test/integration/hardening.test.ts`):
  - **Secrets Leak Audit**: Full job execution with planted token audited; confirmed 0 plaintext hits across all logs and attempt folders.
  - **Prompt-Injection Defense**: Adversarial README payload attempting charter bypass intercepted; action flagged as `tainted` and blocked (`A4 / AX`).
  - **Crash Recovery Resilience**: Interrupted attempts detected on daemon boot; verified idempotent replaying prevents duplicate dispatches.
  - **High Concurrency Load Test**: 20 concurrent contracts across 3 worker queues completed with 0 database corruption and strictly contiguous SQLite WAL sequences.
- Updated `README.md` into executive-grade production documentation with ASCII architecture diagrams, state machines, authority matrices, and CLI workflows.
- Completed full M0–M10 milestone roadmap with 124 passing tests.

### Added - M9: Delivery Reporting, Final Acceptance & Retrospective Memory
- Implemented `src/reporter/delivery.ts`: `generateDeliveryReport` rendering complete `DELIVERY.md` per 11 §3.
- Enforced strict honesty checks: throws error if any `verified` or `judged` DoD item lacks an `evidenceLink`.
- Implemented `src/integrator/final-acceptance.ts`: Evaluates job against MissionBrief DoD items.
- Implemented durable memory system (`stats.ts`, `lessons.ts`, `retrospective.ts`).
- Authored Aikami project profile at `~/.regent/memory/projects/aikami.yaml`.

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
