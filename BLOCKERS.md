# Active Blockers & Operator Action Items

Last updated: System fully operational — Milestones M0 through M10 green.

## Open Blockers
**None.** The complete Regent orchestrator is built, verified, and operational on this machine. All 124 unit and integration tests across M0–M10 pass cleanly without external dependencies.

---

## Optional Operator Actions for Live Model Invocations
By default, Regent executes with deterministic offline verification engines, simulated judges, and local worker harnesses with zero dollar spend. To run live LLM calls:

1. **Anthropic API Key (Director & Judge)**
   - Set in environment or `.env`:
     ```bash
     export ANTHROPIC_API_KEY="sk-ant-..."
     export REGENT_LIVE=1
     export REGENT_LIVE_MAX_USD=5
     ```
2. **OpenRouter API Key (Jev Router & Consultants)**
   - Set in environment:
     ```bash
     export OPENROUTER_API_KEY="sk-or-v1-..."
     ```
3. **Dedicated Chrome Profile (Browser Operator)**
   - Launch the pre-configured Chrome instance:
     ```powershell
     powershell -ExecutionPolicy Bypass -File scripts/setup-chrome.ps1
     ```
   - Log into any sites you wish Regent to interact with. Your primary personal Chrome profile remains untouched.

4. **Hermes Profile Setup**
   - Run profile setup script:
     ```powershell
     powershell -ExecutionPolicy Bypass -File scripts/setup-hermes-profile.ps1
     ```

5. **VS Code Profile Setup**
   - Run profile setup script:
     ```powershell
     powershell -ExecutionPolicy Bypass -File scripts/setup-vscode-profile.ps1
     ```
