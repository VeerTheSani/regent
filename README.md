# Regent: Autonomous Local Orchestrator

[![Status](https://img.shields.io/badge/Status-Complete%20(M0--M10)-brightgreen)](#)
[![Tests](https://img.shields.io/badge/Vitest-124%20passed-brightgreen)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20NodeNext-blue)](#)
[![Runtime](https://img.shields.io/badge/Runtime-Node%2024%20ESM-green)](#)
[![Linter](https://img.shields.io/badge/Linter-Biome%20Clean-success)](#)

> **Regent** is an autonomous local orchestrator daemon and CLI built for Windows 11. It takes high-level software engineering and research goals in plain language, drafts an unambiguous **Mission Brief**, decomposes it into a directed acyclic graph (DAG) of scoped **contracts**, dispatches them across a fleet of specialized local and remote AI workers, answers permission prompts through an in-process **MCP Bridge**, verifies all deliverables using deterministic **T0 gates** and visual evidence, and scores results with an independent **LLM Judge** before assembling a verified, honest **Delivery Package**.

---

## 🏛️ System Architecture

```text
                                  OPERATOR
                                     │
                    ┌────────────────┴────────────────┐
                    │  CLI (regent job/status/stop)   │
                    │  Web Dashboard (127.0.0.1:7780) │
                    └────────────────┬────────────────┘
                                     │
                   ┌─────────────────▼─────────────────┐
                   │           REGENT DAEMON           │
                   │  ┌─────────────────────────────┐  │
                   │  │ SQLite Append-Only Ledger   │  │
                   │  │ (node:sqlite WAL Mode)      │  │
                   │  └──────────────┬──────────────┘  │
                   │                 │                 │
                   │  ┌──────────────▼──────────────┐  │
                   │  │ Deterministic Projector     │  │
                   │  │ (jobs, contracts, stats)    │  │
                   │  └──────────────┬──────────────┘  │
                   └─────────────────┼─────────────────┘
                                     │
       ┌─────────────────────────────┼─────────────────────────────┐
       │                             │                             │
┌──────▼──────┐               ┌──────▼──────┐               ┌──────▼──────┐
│  DIRECTOR   │               │ DISPATCHER  │               │   HARNESS   │
│             │               │             │               │             │
│ • Interpret │               │ • Scheduler │               │ • Worktrees │
│ • Task DAG  │──contracts───▶│ • Thompson  │──dispatches──▶│ • T0 Gates  │
│ • Validator │               │ • Supervision│              │ • Web CDP   │
│ • Replan    │               │ • R1-R7     │               │ • Win32 DPI │
└─────────────┘               └──────┬──────┘               └──────┬──────┘
                                     │                             │
                               ┌─────▼─────┐                       │
                               │  WORKERS  │                       │
                               │           │                       │
                               │ • Claude  │                       │
                               │ • Hermes  │◀───Evidence / Diff────┘
                               │ • VS Code │
                               │ • Browser │
                               │ • Shell   │
                               └─────┬─────┘
                                     │
                       ┌─────────────▼─────────────┐
                       │     REGENT BRIDGE MCP     │
                       │     (127.0.0.1:7781)      │
                       │                           │
                       │ • regent_get_contract     │
                       │ • regent_ask (Proxy-User) │
                       │ • regent_permit (Charter) │
                       │ • regent_progress         │
                       │ • regent_report           │
                       └─────────────┬─────────────┘
                                     │
                       ┌─────────────▼─────────────┐
                       │      JUDGE PIPELINE       │
                       │                           │
                       │ • T0 Deterministic Gates  │
                       │ • T1 Fast Model Triage    │
                       │ • T2 Opus Judge Review    │
                       │ • T3 Multi-Judge Panel    │
                       └─────────────┬─────────────┘
                                     │
                       ┌─────────────▼─────────────┐
                       │     DELIVERY PACKAGE      │
                       │                           │
                       │ • DELIVERY.md (Honesty)   │
                       │ • SHA-256 Manifest        │
                       │ • Integrated Git Branch   │
                       └───────────────────────────┘
```

---

## 🔄 Two Nested State Machines

Regent operates through two pure reducer state machines driven entirely by append-only ledger events (`state = events.reduce(reducer)`), guaranteeing deterministic replay and crash recovery.

### 1. Job Lifecycle
```text
 RECEIVED ──▶ INTERPRETING ──▶ PLANNING ──▶ EXECUTING ──▶ INTEGRATING ──▶ ACCEPTING ──▶ DELIVERING ──▶ DONE
                   │              ▲            │  ▲            │              │
                   │              └─REPLAN─────┘  │            │              └─fail─▶ EXECUTING (fixes)
                   ▼                              │            ▼
           AWAITING_OPERATOR ──answer─────────────┘       (conflict) ─▶ EXECUTING (merge contract)

 Any state ──stop──▶ STOPPING ──▶ STOPPED
 Any state ──budget──▶ PAUSED ──resume──▶ (previous state)
```

### 2. Contract Lifecycle
```text
 PENDING ──deps approved──▶ READY ──slot+budget──▶ DISPATCHED ──spawned──▶ RUNNING
                                                                            │
               ┌────────────────────────────── worker exits / reports ──────┘
               ▼
            GATING (T0 deterministic) ──fail──▶ FAST_REJECT ──▶ (attempt+1) DISPATCHED
               │ pass
               ▼
            CAPTURING (screenshots, HTTP probes, artifacts)
               │
               ▼
            TRIAGE (T1 fast model) ──obviously broken──▶ FAST_REJECT
               │ plausible
               ▼
            JUDGING (T2 judge / T3 panel) ──▶ verdict
               │
      ┌────────┼─────────────┬──────────────┐
   APPROVE   REVISE        REPLAN        ESCALATE
      │        │              │              │
   APPROVED  (strategy     Director       Director decides:
              ladder)      rewrites       operator? partial? abandon?
              ▼            contract
           DISPATCHED
```

---

## 🛡️ Authority Charter & Taint Boundary

Every operation requested by any worker is evaluated against the Authority Charter before execution. No command is ever run through unverified shell strings.

| Level | Classification | Examples | Default Policy |
|:---:|:---|:---|:---|
| **A0** | **Observe** | Read files, list dirs, `git status/diff`, read web pages, take screenshots | **Always allowed** |
| **A1** | **Local, Reversible** | Edit files inside attempt worktree, run builds/tests/linters, commit to `regent/*` | **Always allowed** |
| **A2** | **Local, Consequential** | Merge into local branches, delete worktrees, long runs | **Allowed** (Tainted A2 requires grant) |
| **A3** | **External, Reversible** | `git push` to feature branch, open draft PR, post notifications, web login | **Needs explicit grant**, else parks & asks |
| **A4** | **High Stakes / Irreversible** | Pushing to `main`/`master`, deploying to prod, payments, sending emails, editing `secrets/` | **Needs scoped, expiring grant** |
| **AX** | **Forbidden** | Disabling kill switch, editing `charter.yaml`, `rm -rf /`, formatting drives | **Always denied** (no grant possible) |

### Taint Tracking
Any command, URL, or code derived from untrusted input (web pages, user issues, external READMEs) is tagged `tainted: true`. Tainted A2 actions are automatically blocked from autonomous execution until re-validated by the Director or approved via an operator grant.

---

## 👥 Worker Fleet & Capability Matrix

Regent abstracts heterogeneous agents behind a unified `WorkerAdapter` interface:

| Contract Kind | claude-code | hermes | vscode | chatbot | browser | shell |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **code / refactor / test** | **0.95** | 0.75 | 0.70 | 0.10 | — | 0.50 |
| **ui (code + visual)** | **0.90** | 0.70 | 0.70 | 0.10 | — | — |
| **integration / merge** | **0.90** | 0.60 | 0.40 | — | — | 0.80 |
| **research (web, docs)** | 0.60 | **0.90** | 0.30 | 0.70 | 0.50 | — |
| **document / writing** | 0.70 | 0.70 | 0.30 | **0.85** | — | — |
| **browser_task (web operator)** | 0.50 | **0.85** | — | — | 0.70 | — |
| **ops (scripts, messaging)** | 0.60 | **0.90** | — | — | — | 0.80 |
| **review / second opinion** | 0.60 | 0.60 | — | **0.90** | — | — |

---

## 🪜 Strategy Ladder (Anti-Loop Progression)

When an attempt fails review, Regent avoids repetitive failures by climbing the Strategy Ladder:

```text
Δscore ≥ 0.5 since last attempt  ──▶ Stay on current rung (resumed session, sharper critique)
Δscore < 0.5 for 2 consecutive   ──▶ Climb to next rung:

  R1: Same worker, resumed session, sharper defect-level critique
  R2: Same worker, FRESH session (cleans polluted context) + prior failure explanation
  R3: Higher model tier for same worker (e.g. claude-opus-5-5, high reasoning effort)
  R4: Transfer to a different worker entirely (Claude Code ↔ Hermes ↔ VS Code)
  R5: Consult 2 external chatbot models for root-cause hypotheses
  R6: Director rewrites, splits, or relaxes the contract
  R7: Deliver partial result and escalate to operator
```

---

## 🚀 Operator Quickstart

### 1. Verify Environment
```bash
# Verify CLI binary
npx tsx bin/regent.ts --version

# Run full system diagnostics
npx tsx bin/regent.ts doctor
```

### 2. Initial Setup
```bash
# Onboard and generate ~/.regent configuration files
npx tsx bin/regent.ts setup --channel telegram --max-job-usd 20
```

### 3. Run Autonomous Jobs
```bash
# Run a plain-language goal
npx tsx bin/regent.ts job "Add dark mode toggle to settings route and verify with unit tests"

# Check status of active jobs
npx tsx bin/regent.ts status

# Stream live updates
npx tsx bin/regent.ts watch
```

### 4. Emergency Controls
```bash
# Immediate emergency stop across all running processes
npx tsx bin/regent.ts stop
```

---

## 🖥️ Web Dashboard (Port 7780)

Launch the dashboard to monitor progress, view visual diffs, and manage grants:
- **URL**: `http://127.0.0.1:7780`
- **Features**:
  - Live Server-Sent Events (SSE) log stream
  - Active jobs burndown and spend tracking
  - Visual attempt screenshot diff viewer
  - One-click Emergency STOP kill switch

---

## 📊 Verification & Test Metrics

Every single milestone (M0–M10) is covered by comprehensive automated tests:

```text
 Test Files  28 passed (28)
      Tests  124 passed (124)
   Duration  6.73s
   Coverage  Strict TypeScript (no `any` escapes), Zero Biome Warnings
```

### Milestone Breakdown
- **M0 (Scaffold)**: Toolchain, Biome, Vitest, CLI stub `0.0.0`.
- **M2 (Probes P1–P15 & Adapters)**: Live CLI fixtures recorded and parsers verified.
- **M1 (Kernel)**: SQLite WAL ledger, pure state machines, 44-case charter table, crash resilience.
- **M3 (Regent Bridge MCP)**: Streamable HTTP MCP server on `127.0.0.1:7781` with 6 core tools.
- **M4 (Harness)**: Worktree isolation, T0 gates, pixel diffing, Win32 DPI desktop capture.
- **M5 (Director & Judge)**: DAG planner, acyclicity validator, critique snapshot matching 09 §4.
- **M6 (Dispatcher & E2E)**: Thompson sampling, ladder progression, and toy repo execution.
- **M7 (Onboarding & Doctor)**: Dependency diagnostics, setup scripts, consultant diversity.
- **M8 (Browser & Dashboard)**: Playwright operator, login form gating, dashboard UI, SSE.
- **M9 (Delivery & Memory)**: Honest delivery reports, retrospective learning, decaying worker stats.
- **M10 (Hardening)**: Zero secret leaks, prompt-injection defense, crash recovery, and concurrency load testing.

---

## 📄 License
MIT © 2026 VeerTheSani. Built autonomously with Hermes Agent.
