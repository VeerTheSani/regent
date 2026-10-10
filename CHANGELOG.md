# Changelog

All notable changes to Regent will be documented in this file.

## [Unreleased]

### Added - M4: Workspace, Worktrees & Evidence Harness
- Implemented `src/workspace/worktrees.ts`:
  - `WorktreeManager` providing safe, isolated branch worktrees for every contract attempt.
  - Conflict detection during branch integration without modifying or checking out branches in the operator's working tree.
  - Safe worktree removal preceding branch deletion.
- Implemented `src/workspace/probe.ts`:
  - Detects Git repository root, current branch, uncommitted working tree modifications, and agent files (`AGENTS.md`, `CLAUDE.md`).
- Implemented `src/evidence/pixels.ts`:
  - `frameStats`: luminance standard deviation and color diversity analysis for blank frame detection.
  - `diffAgainst`: pixel diffing against baselines using `pixelmatch` at 0.1 threshold with visual diff output.
- Implemented `src/evidence/desktop.ts` & `src/evidence/capture-window.ps1`:
  - Win32 DPI-aware window and full virtual screen capture using PowerShell interop (`PrintWindow`, `CopyFromScreen`).
- Implemented `src/evidence/web.ts`:
  - Playwright capture connecting to Chrome CDP (`127.0.0.1:9222`) with headless launch fallback.
  - Settle detection across Web fonts and canvas/WebGL animations.
- Implemented `src/evidence/gates.ts`:
  - T0 deterministic gate runner for `command`, `scope`, `secret_scan`, `file_exists`, `http`, `no_blank_frame`, and `visual_diff`.
  - Secret scanning ensures flagged secret rules are logged without leaking sensitive token values.
- Implemented `src/evidence/manifest.ts`:
  - Generates SHA-256 checksums and file sizes for attempt evidence packages (`manifest.json` and `index.md`).
- Unit and integration tests (10 new tests, 85 total across suite):
  - `test/unit/worktrees.test.ts`: Worktree creation, commit, and deliberate merge conflict reporting.
  - `test/unit/pixels.test.ts`: Solid PNG blank detection, checkerboard non-blank detection, and identical diffing.
  - `test/unit/desktop.test.ts`: Virtual screen capture output verification.
  - `test/unit/gates.test.ts`: Secret detection reporting rule name without leaking token.

### Added - M3: Regent Bridge (MCP Server)
- Implemented `src/bridge/server.ts`:
  - Streamable HTTP MCP server bound to loopback `127.0.0.1:7781/mcp`.
  - 256-bit cryptographic bearer token authentication stored at `~/.regent/token`.
  - Registered all 6 core tools: `regent_get_contract`, `regent_ask`, `regent_permit`, `regent_progress`, `regent_request_evidence`, `regent_report`.
- Implemented `src/bridge/permits.ts`:
  - `PermitArbiter` mapping worker tool invocations to Charter actions.
- Implemented `src/bridge/proxy-user.ts`:
  - Standing in for operator with classification (`fact`, `decision`, `assumption`, `deferred`).
- Implemented `src/bridge/reports.ts`:
  - In-memory registry for worker attempt reports.

### Added - M1: Kernel
- Implemented `src/kernel/ledger.ts`:
  - Append-only event store using native `node:sqlite` in WAL mode with `idem_key` deduplication.
- Implemented `src/kernel/projector.ts`:
  - Deterministic state projector rebuilding `jobs_view`, `contracts_view`, and `worker_stats`.
- Implemented pure state machines (`src/kernel/contract-machine.ts`, `src/kernel/job-machine.ts`).
- Implemented authority & governance engine (`src/kernel/charter.ts`, `src/kernel/grants.ts`, `src/kernel/kill-switch.ts`, `src/kernel/budget.ts`).

### Added - M2: Worker Adapters & PROBES
- Built `scripts/probe-workers.ts` exercising and recording probes P1–P15 into `test/fixtures/probes/`.
- Recorded empirical CLI fixtures and built full worker adapter suite.

### Added - M0: Scaffold
- Initial repository skeleton matching spec layout (13 §2).
- Toolchain, Biome, Vitest, and CLI stub `0.0.0`.
