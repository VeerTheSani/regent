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
