# Changelog

All notable changes to Regent will be documented in this file.

## [Unreleased]

### Added - M5: Director, Planner, Validator & Judge
- Implemented Zod schemas in `src/schemas/`:
  - `src/schemas/brief.ts`: `MissionBrief`, `DefinitionOfDoneItem`, `AssumptionItem`.
  - `src/schemas/contract.ts`: `Contract`, `ContractKind`, `GateDefinition`, `VisualTargetDefinition`.
  - `src/schemas/verdict.ts`: `Verdict`, `Defect`, `DefectSeverity`, `DimensionScore`.
  - `src/schemas/graph-patch.ts`: `GraphPatch`.
  - Built `scripts/export-schemas.ts` exporting JSON Schema definitions into `schemas/*.json`.
- Implemented Director interpretation and planning:
  - `src/director/interpret.ts`: Interprets operator tickets into validated `MissionBrief`.
  - `src/director/plan.ts`: Decomposes briefs into contract graphs.
  - `src/director/validate-plan.ts`: Deterministic validator enforcing DAG acyclicity, complete DoD coverage, disjoint parallel write scopes, and 20% budget reserve.
  - `src/director/replan.ts`: 3-round iterative replanning loop with validator feedback.
  - `src/director/decide.ts`: Disputed point adjudication.
- Implemented Judge evaluation suite:
  - `src/judge/judge.ts`: Independent T2 judge evaluation service.
  - `src/judge/judge-cli.ts`: Claude Code read-only CLI backend with `--json-schema`.
  - `src/judge/rubrics.ts`: YAML rubrics loader and weighted score calculator.
  - `src/judge/recompute.ts`: Convergence rule enforcement and weighted composite recomputation.
  - `src/judge/critique.ts`: Deterministic markdown critique renderer matching 09 §4 format.
  - `src/judge/panel.ts`: Multi-judge consensus aggregation, spread calculation, and adjudication triggers.
  - `src/judge/calibration.ts`: Golden set calibration reporter.
- Implemented Prompt Templates and Engine:
  - `src/prompts/render.ts`: Strict prompt template engine (`{{var}}`, `{{#if var}}`).
  - Added template markdown files for interpretation, planning, worker tasks, judge, triage, proxy user, final acceptance, and retrospectives.
- Unit and acceptance tests (14 new tests, 99 total across suite):
  - `test/unit/validate-plan.test.ts`: Cycle detection, parallel scope overlap, budget reserves, and the 5-contract Aikami settings-page example from 04 §2.
  - `test/unit/director.test.ts`: Mission brief validation and DAG planning.
  - `test/unit/verdict-recompute.test.ts`: Recomputed 7.0 and REVISE decision on inconsistent judge score, blocker overrides.
  - `test/unit/critique-snapshot.test.ts`: Byte-for-byte snapshot test reproducing the 09 §4 format.
  - `test/unit/prompt-renderer.test.ts`: Variable interpolation, conditional blocks, and exception throwing on missing variables or unknown constructs.

### Added - M4: Workspace, Worktrees & Evidence Harness
- Implemented `src/workspace/worktrees.ts`: `WorktreeManager` providing safe, isolated branch worktrees for every contract attempt.
- Implemented `src/workspace/probe.ts`: Repository and agent configuration discovery.
- Implemented `src/evidence/pixels.ts`: `frameStats` and `diffAgainst` visual analysis.
- Implemented `src/evidence/desktop.ts` & `src/evidence/capture-window.ps1`: Win32 DPI-aware window and screen capture.
- Implemented `src/evidence/gates.ts`: T0 deterministic gate runner with secret scanning.
- Implemented `src/evidence/manifest.ts`: SHA-256 evidence packages.

### Added - M3: Regent Bridge (MCP Server)
- Implemented `src/bridge/server.ts`: Streamable HTTP MCP server on `127.0.0.1:7781/mcp` with 256-bit bearer token auth.
- Implemented 6 core tools and `PermitArbiter`.

### Added - M1: Kernel
- Implemented `src/kernel/ledger.ts`: Append-only event store using native `node:sqlite` in WAL mode.
- Implemented pure state machines and authority charter engine.

### Added - M2: Worker Adapters & PROBES
- Built `scripts/probe-workers.ts` exercising and recording probes P1–P15 into `test/fixtures/probes/`.
- Built full worker adapter suite.

### Added - M0: Scaffold
- Initial repository skeleton, toolchain, and CLI stub `0.0.0`.
