# Regent

**Regent** is an autonomous local orchestrator daemon and CLI built for Windows 11. It accepts high-level software development and verification jobs in plain language, plans a directed acyclic graph of scoped contracts, dispatches them across a fleet of specialized workers (Claude Code CLI, Hermes Agent, VS Code agent mode, OpenRouter chatbot consultants, a Chrome browser operator over CDP, and a direct shell worker), enforces authority boundaries through a strict Charter engine, verifies deliverables using deterministic gates and evidence bundles (DOM/screenshots/logs), and scores outputs with an independent LLM judge before delivering verified results with an honest report.

## Specification

The complete system specification is documented at:
`C:\Users\sanis\Redeem\aikami\autonomous-reviewer-context\`

- `00-VISION-AND-OPERATING-MODEL.md`
- `01-SYSTEM-ARCHITECTURE.md`
- `02-AUTHORITY-CHARTER.md`
- `03-JOB-LIFECYCLE-AND-STATE-MACHINE.md`
- `04-PLANNING-AND-TASK-GRAPH.md`
- `05-WORKER-FLEET-AND-ADAPTERS.md`
- `06-REGENT-BRIDGE-MCP.md`
- `07-BROWSER-DESKTOP-AND-EVIDENCE.md`
- `08-VERIFICATION-JUDGING-AND-JEV.md`
- `09-PROMPTS-AND-SCHEMAS.md`
- `10-MEMORY-LEARNING-AND-KNOWLEDGE.md`
- `11-OPERATOR-INTERFACE-AND-DELIVERY.md`
- `12-OBSERVABILITY-COST-AND-RECOVERY.md`
- `13-TECH-STACK-REPO-LAYOUT-AND-CONFIG.md`
- `14-BUILD-PLAN-FOR-HERMES.md`
- `HERMES-BUILD-PROMPT.md`

## Quick Start (Operator)

```bash
# Verify CLI version
npx tsx bin/regent.ts --version

# Typecheck and lint
npm run typecheck
npm run lint

# Run unit tests
npm test
```
