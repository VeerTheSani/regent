# Architecture & Engineering Decisions

## M0: Scaffold & Base Toolchain

### D1: Single-package Node 24 ESM layout
- **Decision**: Single package with `"type": "module"`, `NodeNext` TypeScript configuration, and `tsx` execution.
- **Why**: Keeps execution lightweight and transparent on Windows without monorepo orchestration overhead. `tsx` enables running TS files directly with ESM imports without prior compile step.
- **Alternatives Rejected**: Monorepo with npm workspaces (unneeded complexity for single-machine local orchestrator daemon); `bun` (not installed on host system).

### D2: Biome for formatting and linting
- **Decision**: Use `@biomejs/biome` 1.9.4 for linting and formatting.
- **Why**: Sub-millisecond formatting and linting compatible with Aikami repository standards.
- **Alternatives Rejected**: ESLint + Prettier (significantly slower, complex plugin matrix on Windows ESM).

### D3: Vitest for testing
- **Decision**: Use `vitest` 3.x with Node environment.
- **Why**: Native ESM support, fast worker-based execution, compatible with TypeScript types and `tsx`.
- **Alternatives Rejected**: Jest (notoriously difficult ESM setup on Windows).

### D4: Dependency pinning
- **Decision**: Fixed versions for core runtime dependencies:
  - `@anthropic-ai/sdk`: `^0.39.0`
  - `@modelcontextprotocol/sdk`: `^1.6.1`
  - `commander`: `^13.1.0`
  - `cross-spawn`: `^7.0.6`
  - `tree-kill`: `^1.2.2`
  - `pino`: `^9.6.0`
  - `playwright`: `^1.50.1`
  - `pngjs`: `^7.0.0`
  - `pixelmatch`: `^7.1.0`
  - `picomatch`: `^4.0.2`
  - `yaml`: `^2.7.0`
  - `zod`: `^3.24.2`
- **Why**: Stable, tested versions that avoid breaking changes during active build phases.

## M2: Worker Probes & CLI Ground Truth (P1–P15)

### D5: Hermes stream separation (Spec Correction)
- **Observation**: Probe P6 revealed that when invoking `hermes chat -Q`, `stdout` emits solely the clean final text response, whereas `session_id: <id>` is written to `stderr`.
- **Decision**: The Hermes adapter consumes `stdout` directly as `finalText` without requiring regex line-stripping, and parses `session_id` from `stderr`.
- **Spec Correction**: 05 §4.2 noted that `stdout` contained the final response + session info together; in reality they are cleanly separated across file descriptors.

### D6: Claude Code append system prompt flag
- **Observation**: Probe P5 verified that `--append-system-prompt-file <path>` is natively supported by Claude Code 2.1.296.
- **Decision**: Pass system prompts via temporary markdown files (`worker-system.md`) and `--append-system-prompt-file`, avoiding CLI length constraints and Windows shell quoting hazards.

### D7: Claude Code budget exhaustion representation
- **Observation**: Probe P2 established that budget exhaustion manifests as `result.subtype: "error_max_budget_usd"`, `result.terminal_reason: "budget_exhausted"`, and exit code 1.
- **Decision**: Claude Code adapter checks both `subtype` and `terminal_reason` for `"budget"` to mark status as `budget_exceeded`.

### D8: Cross-spawn requirement on Windows
- **Observation**: Running commands like `claude`, `code`, or `npx` via standard `node:child_process.spawn` without shell fails with `ENOENT` due to Windows `.cmd`/`.bat` wrappers.
- **Decision**: Wrap all child process spawns in `spawnTree` via `cross-spawn` without setting `shell: true`, preserving security while resolving Windows execution shims.

### D9: Hermes Pause Sentinel & Health Detection
- **Observation**: Probe P9 verified that `hermes pause` creates `~/.hermes/ESTOP` and `hermes status` renders `⏸️  PAUSED (global emergency stop — reason: ...; hermes resume to lift)`.
- **Decision**: `HermesAdapter.probe()` checks for `PAUSED` in status output to prevent dispatching work to a halted Hermes instance.

## M1: Kernel Architecture (Ledger, Reducers, Charter & Budget)

### D10: Native node:sqlite in WAL mode
- **Decision**: Used Node 24's built-in `node:sqlite` (`DatabaseSync`) configured with `PRAGMA journal_mode = WAL` and `PRAGMA synchronous = NORMAL`.
- **Why**: Zero external native compilation on Windows, robust crash recovery, contiguous auto-incrementing sequences, and thread-safe WAL reads. Filtered `ExperimentalWarning` cleanly at the process warning boundary.

### D11: Fail-closed Charter Engine with Taint Detection
- **Decision**: Rules are ordered with first-match-wins semantics. Any unknown action defaults to `A3` (fail closed, requiring an operator grant). Tainted `A2` actions automatically require an operator grant. The `KillSwitch` sentinel (`~/.regent/STOP`) immediately overrides all actions with `AX deny`.

### D12: Pure State Machine Reducers & Deterministic Projections
- **Decision**: Implemented `reduceContract` and `reduceJob` as pure functions without side effects. Side effects are executed via `EffectBus` using idempotent keys (`idem_key`).
- **Why**: Allows deterministic projection replaying from the append-only event ledger and reliable recovery on crash or restart.

## M3: Regent Bridge (MCP Server)

### D13: MCP SDK Version Verification & Transport Binding
- **Observation**: Verified `@modelcontextprotocol/sdk` version `1.6.1`.
- **Import Paths**:
  - `McpServer`: `@modelcontextprotocol/sdk/server/mcp.js`
  - `StreamableHTTPServerTransport`: `@modelcontextprotocol/sdk/server/streamableHttp.js`
  - `Client`: `@modelcontextprotocol/sdk/client/index.js`
  - `StreamableHTTPClientTransport`: `@modelcontextprotocol/sdk/client/streamableHttp.js`
- **Method Signature**: `server.registerTool(name, { description, inputSchema }, callback)`.
- **Transport Configuration**: Used `sessionIdGenerator: () => randomUUID()` and `enableJsonResponse: true` for direct JSON and SSE compatibility across standard MCP clients.

### D14: 256-Bit Bearer Token & Windows ACL
- **Decision**: On first boot, Regent generates a cryptographic 256-bit hex token (`crypto.randomBytes(32).toString("hex")`) saved to `%USERPROFILE%\.regent\token`.
- **Windows Security Note**: On Windows 11, `%USERPROFILE%\.regent` inherits the user's private ACL (`NT AUTHORITY\SYSTEM` and `<User>` have Full Control, other users denied). All attempt configs referencing the token are created within this user boundary, bound exclusively to loopback (`127.0.0.1:7781`).

## M4: Workspace, Worktrees & Evidence Harness

### D15: Git Ref Hierarchy and Integration Branch Naming
- **Observation**: In Git ref storage, a branch name cannot be a prefix directory of another branch name (`fatal: cannot lock ref 'refs/heads/regent/job': 'refs/heads/regent/job/ctr-1-a1' exists`).
- **Decision**: Integration branches are named `regent/<jobId>/integration`, coexisting cleanly alongside attempt branches within the `refs/heads/regent/<jobId>/` hierarchy.

### D16: Deterministic Visual Analysis without Native Dependencies
- **Decision**: Used pure TypeScript luminance computation and color binning (`pngjs` + `pixelmatch`) for blank frame detection and pixel diffing, eliminating native C++ dependencies like node-canvas.

### D17: Desktop Capture via PowerShell DPI-Aware Win32 Interop
- **Decision**: Window and screen captures execute through `capture-window.ps1` utilizing `SetProcessDPIAware()`, `GetWindowRect()`, and `PrintWindow(PW_RENDERFULLCONTENT)` with fallback to `CopyFromScreen()`.
