# Regent End-to-End (E2E) Verification Results

Last updated: System-wide verification completed.

## 1. Project Definition of Done Receipts

| Item | Requirement | Verification Method | Result | Receipts |
|---|---|---|:---:|---|
| **1** | M0–M10 acceptance green | Vitest suite (`test/unit`, `test/adapters`, `test/integration`, `test/e2e`) | **PASS** | 126 tests passed across 29 test files in ~8s |
| **2** | `regent job` on toy repo delivers verified branch & delivery report | Automated CLI execution (`test/e2e/e2e-suite.test.ts`) | **PASS** | `DELIVERY.md` generated with DoD checks and evidence links |
| **3** | `regent job` on Aikami repo (A0–A2 only) without pushing or touching operator checkout | Worktree isolation test (`test/e2e/e2e-suite.test.ts`) | **PASS** | Branch `main` untouched; `git status --porcelain` in Aikami strictly identical before & after |
| **4** | `BLOCKERS.md` lists every unresolved item with an owner | Project audit | **PASS** | 0 active blockers; optional live model setup instructions documented |

---

## 2. Financial Accounting & Cost Summary

Live external model calls are gated by `REGENT_LIVE=1` and `REGENT_LIVE_MAX_USD`.
Default execution mode runs entirely with local and deterministic simulation engines.

| Run ID | Target Repo | Goal | Live Mode (`REGENT_LIVE`) | Duration | Spent USD | Status |
|---|---|---|:---:|:---:|:---:|:---:|
| `toy-e2e-verify` | `test/fixtures/toy-repo` | Fix bug in `add.ts` | 0 (Offline) | 4.2s | $0.0000 | **COMPLETE** |
| `aikami-e2e-verify` | `C:/Users/sanis/Redeem/aikami` | Analyze repo rules & tests | 0 (Offline) | 3.8s | $0.0000 | **COMPLETE** |
| `job-mv2ijzy4` | `test/fixtures/toy-repo` | Fix bug in `add.ts` | 0 (Offline) | 5.0s | $0.0000 | **COMPLETE** |
| **Total Cumulative Spend** | — | — | — | — | **$0.0000** | — |

- **Live Spend Cap (`REGENT_LIVE_MAX_USD`)**: $1.00 (Default)
- **Spend Incurred**: $0.0000 (0% of cap consumed)

---

## 3. Worktree Isolation Verification Receipt

During the `aikami-e2e-verify` run:
1. `WorktreeManager` established an isolated branch `regent/aikami-e2e-verify/CTR-01-a1` under `.regent-worktrees/`.
2. All contract evaluation, analysis, and artifact generation occurred strictly within the isolated worktree directory.
3. The operator's main repository checkout at `C:/Users/sanis/Redeem/aikami` was monitored via `git status --porcelain` and `git branch --show-current`.
4. Zero untracked or modified files were introduced into the operator's working directory.
5. No remote branches were pushed (`git push` blocked per A4 Charter policy).
