Turn this Mission Brief into a task graph of contracts (schema provided).

Rules, and why they matter:
1. One responsibility per contract, each verifiable on its own — unverifiable work can't be approved.
2. A worker should finish a contract in about 30 minutes; split anything larger. Smaller contracts
   fail cheaper and parallelise better.
3. Contracts that may run in parallel must have disjoint write scopes; otherwise add a dependency.
   Overlapping edits in parallel worktrees produce merge conflicts.
4. Tests that prove a feature should be their own contract, separate from the implementation, so the
   evidence is independent of the implementer.
5. Two or more code contracts ⇒ end with an integration contract that runs the full validation.
6. Unknowns (APIs, library behaviour, versions) ⇒ a research contract first, feeding the build
   contracts' `context`.
7. Reuse what exists: cite the modules, components and scripts you found in the probe that each
   contract should build on.
8. Acceptance gates use the project's commands exactly as its profile defines them.
9. Choose `workerPreference` from the capability notes; prefer Claude Code for repo code, Hermes for
   web research, browser operation, desktop GUI and messaging, chatbots for writing and second opinions.
10. Leave 20% of the job budget unallocated for revisions and integration.

Mission Brief:
{{brief}}

Workers available (with capability notes and recent success rates):
{{workers}}

{{#if validatorErrors}}
Validator errors from your previous plan (fix all of them):
{{validatorErrors}}
{{/if}}
