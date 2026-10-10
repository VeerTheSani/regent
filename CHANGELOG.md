# Changelog

All notable changes to Regent will be documented in this file.

## [Unreleased]

### Added - M6: Dispatcher, Strategy Ladder & Toy Repo Orchestration
- Implemented `src/dispatcher/select-worker.ts`:
  - Worker capability scoring per contract kind (from 05 §1).
  - Thompson sampling over learned success rates via Beta distribution variates (`sampleBeta`).
- Implemented `src/dispatcher/ladder.ts`:
  - Strategy Ladder anti-loop directives (R1 through R7).
- Implemented `src/dispatcher/compose-request.ts`:
  - Structured `WorkRequest` assembly and prompt template rendering.
- Implemented `src/dispatcher/supervise.ts`:
  - Active attempt supervision: wall-clock ceiling, stall detection (steer -> kill), budget breach monitoring.
- Implemented `src/daemon.ts`:
  - Complete orchestration daemon connecting ledger, bridge, worktrees, gates, judge, and workers.
  - Startup crash recovery identifying interrupted attempts.
- Implemented CLI entry points in `src/operator/cli-commands.ts` and `bin/regent.ts` (`job`, `status`, `stop`, `watch`).
- Created target `test/fixtures/toy-repo/` with deliberate unit test failure in `add.ts`.
- Integration test suite in `test/integration/dispatcher-e2e.test.ts` (3 tests passed):
  - Scripted worker full DAG progression: attempt 1 fails gates, attempt 2 revises, attempt 3 approves, job reaches `DONE`.
  - Strategy ladder progression (R1 -> R2 -> R3) terminating at attempt ceiling without infinite looping.
  - Kill test verifying process tree termination.

### Added - M5: Director, Planner, Validator & Judge
- Implemented Zod schemas in `src/schemas/` (`MissionBrief`, `Contract`, `Verdict`, `GraphPatch`).
- Exported JSON Schema definitions into `schemas/*.json` via `scripts/export-schemas.ts`.
- Implemented Director interpretation, DAG task graph planning, and deterministic plan validator.
- Implemented Judge evaluation, weighted composite recomputation, and critique renderer snapshot matching 09 §4 format.
- Implemented strict 2-construct prompt template engine (`src/prompts/render.ts`).

### Added - M4: Workspace, Worktrees & Evidence Harness
- Implemented `WorktreeManager` providing safe branch worktrees and conflict detection without touching operator checkout.
- Implemented `frameStats` and `diffAgainst` visual analysis without native C++ dependencies.
- Implemented `capture-window.ps1` Win32 DPI-aware desktop capture via PowerShell.
- Implemented T0 deterministic gate runner and secret scanning.
- Implemented SHA-256 evidence package manifests (`manifest.json`, `index.md`).

### Added - M3: Regent Bridge (MCP Server)
- Implemented Streamable HTTP MCP server on `127.0.0.1:7781/mcp` with 256-bit bearer token auth.
- Implemented all 6 core tools and `PermitArbiter`.

### Added - M1: Kernel
- Implemented append-only event store using native `node:sqlite` in WAL mode.
- Implemented pure state machines and authority charter engine.

### Added - M2: Worker Adapters & PROBES
- Built `scripts/probe-workers.ts` exercising and recording probes P1–P15 into `test/fixtures/probes/`.
- Built full worker adapter suite.

### Added - M0: Scaffold
- Initial repository skeleton, toolchain, and CLI stub `0.0.0`.
