# Changelog

All notable changes to Regent will be documented in this file.

## [Unreleased]

### Added - M7: Operator Onboarding, Diagnostics & Consultant Selection
- Implemented `src/operator/doctor.ts` (`regent doctor` CLI):
  - Comprehensive dependency diagnostic probing Node 24, Git, Claude Code, Hermes, VS Code, Chrome, port 7780/7781 bindings, and API keys.
- Implemented `src/operator/setup.ts` (`regent setup` CLI):
  - Operator onboarding writing `~/.regent/config.yaml`, `charter.yaml`, and `operator.yaml`.
- Implemented profile setup scripts:
  - `scripts/setup-hermes-profile.ps1`: Registers Regent Bridge MCP on dedicated `regent` profile.
  - `scripts/setup-vscode-profile.ps1`: Configures Regent profile with Bridge MCP definition.
  - `scripts/setup-chrome.ps1`: Launches dedicated Chrome instance on port 9222.
- Implemented consultant selection:
  - `scripts/pick-consultants.ts`: Model selection from OpenRouter enforcing $\ge 1$ non-Anthropic family.
- Acceptance unit tests in `test/unit/doctor.test.ts`, `test/unit/setup.test.ts`, and `test/unit/consultants.test.ts` (105 tests passed across 21 test files).

### Added - M6: Dispatcher, Strategy Ladder & Toy Repo Orchestration
- Implemented `src/dispatcher/select-worker.ts`: Worker capability scoring and Thompson sampling.
- Implemented `src/dispatcher/ladder.ts`: Strategy Ladder anti-loop directives (R1 through R7).
- Implemented `src/dispatcher/compose-request.ts`: Structured `WorkRequest` assembly and prompt rendering.
- Implemented `src/dispatcher/supervise.ts`: Active attempt supervision.
- Implemented `src/daemon.ts`: Complete orchestration daemon with boot recovery.
- Implemented CLI entry points in `src/operator/cli-commands.ts` and `bin/regent.ts`.
- Created target `test/fixtures/toy-repo/` and verified full DAG completion in `test/integration/dispatcher-e2e.test.ts`.

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
