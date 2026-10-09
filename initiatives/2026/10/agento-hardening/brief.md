Source: inline argument to /agento new-initiative — 2026-10-09

## Plan: Initiative brief — Agento hardening

Below is the brief for `/agento new-initiative`. It covers targets #1–#5 from the assessment (all axes), gives the Architect the evidence it needs, and states constraints so the decomposition stays additive. Plan mode cannot write files, so paste it inline as the command argument (or save it to a repository-relative file first).

**Brief text**

> Harden Agento across four axes at once — dashboard responsiveness, ship/close reliability, hook maintainability, and visibility into delivery history — by moving the remaining expensive or prose-driven behaviour into the CLI and collapsing duplicated code paths.
> 
> **Why.** The core workflow is stable, but four costs remain. (1) Every dashboard refresh in `extension.ts` spawns `session --pr`, `doctor`, `status --pr`, `initiative`, and `initiative <slug>` per initiative — four-plus Node processes, each re-running `anchorRoot()`, several `git worktree list` calls, and a full roadmap walk; `status --pr` then runs `gh --version` plus `gh pr view` sequentially per non-complete item (twice in companion mode) through `execFileSync`. (2) `/agento ship` and `/agento close-session` are the last large prose procedures (dual audit, dual merge, sync, teardown, epilogue, resume-at-companion-merge) and are where incidents and resume edge cases accumulate (#47, #88, superseded release runs); `start-session-cli` showed that one deterministic CLI call plus a thin prompt removes that class of problem. (3) `delivery-guard.sh` and `session-context.sh` carry byte-identical Python helpers kept in sync by convention, depend on `python3`, and have recorded gaps: the roadmap nudge inspects the companion clone instead of the session's half; `hooks.json` and `.claude-plugin` are outside the `PROTECTED` regex; explicit-refspec pushes of non-default branches from the default branch are still denied. (4) Review and roadmap follow-ups have piled up unfiled: shared `gh` probe, memoised primary-root lookup, `agento.mjs paths` resolving `worktrees.dir` against the current checkout, `concurrent-delivery.instructions.md` not loading in the companion folder, the `gh pr edit --body` failure on gh 2.45, no vendor-suffix warning in `models show`, unverified `handoffs[].model`.
> 
> **What I expect the members to cover.**
> 
> 
> - A single `agento.mjs dashboard [--pr]` subcommand returning session, doctor, status, and every initiative in one JSON document from one process, with worktree lists and the primary root computed once, the `gh` probe run once, and PR lookups executed concurrently; the extension refreshes with one spawn and keeps today's models and views unchanged.
> - `agento.mjs ship <type> <slug>` as an idempotent, resumable state machine (audit → ready/merge code PR → merge companion PR → sync defaults → teardown → epilogue), with the prompt reduced to a formatter the way `start-session` was; `agento.mjs close-session` likewise. Existing `ship-preflight`, `close-decision`, `release`, and `wait-for-checks.sh` are reused, not reimplemented. The user's `/agento ship` remains the only path that marks PRs ready or merges.
> - One source of truth for the hook logic (a shared module both hooks load, or a Node implementation invoked from the hook shell wrappers), with the replay harness and fixtures unchanged, `PROTECTED` extended to `hooks.json` and `.claude-plugin`, the nudge re-targeted to the session's companion half, and the explicit-refspec false positive fixed with fixtures.
> - A follow-up debt batch closing the unfiled items above, each with a test.
> - Derived delivery metrics (`agento.mjs metrics`): cycle time per phase, review rounds, pause durations, and post-ship latency computed from git and roadmap history only, shown as a Timeline row per delivery in the dashboard.
> 
> **Constraints.** All CLI changes are additive JSON; existing subcommands keep their fields and exit codes. The extension never re-derives lifecycle or allowed commands. Prompts and `commands/*.md` mirrors stay byte-identical. Hook edits remain approval-gated. No new runtime dependencies in the extension; Node ≥ 20. The full gate (node tests, both replay-guard runs, shellcheck, extension unit + electron, bundle test) stays green per member.
> 
> **Out of scope.** Observing or cancelling chat in other windows, Windows support, non-GitHub remotes, Marketplace publishing automation, multi-repo dashboards.
> 
> **Definition of done.** A dashboard refresh on this repository is one CLI spawn and measurably faster than today; `/agento ship` and `/agento close-session` each resolve to one CLI call whose every phase resumes from git state; the two hooks share one implementation with the same fixture verdicts; every listed follow-up is closed or filed; the dashboard shows a timeline per delivery.
