# Review: plan-play-button-handoff

Verdict: approve

## Acceptance checklist results

1. **Exposing regression test fails before the fix and passes after it — PASS.**
   `extension/test/unit/planPlayButtonHandoff.test.ts` exists with a header naming
   issue #77 / `plan-play-button-handoff` and the evidence directory. Commit
   `6bd4834` (`test(plan-play-button-handoff): hoist NEW_PLAN_FLOW_DEFAULTS and add
   exposing regression tests`) records the three pre-fix failures verbatim: (a) a
   plan-role detached session still reported `failed` ("Expected one primary
   checkout, found 0."); (b) `chat.open` options omitted `attachFiles` for
   `/agento start-session`; (c) a start-session finishing at 20:37:16.546Z after a
   20:35:14.000Z submit yielded `timeout` under the 120 s default. Re-run:
   `cd extension && npm run test:unit` → **106 tests, 106 pass, 0 fail**.

2. **In-window routing for `role: plan` + detached; other roles keep start-session —
   PASS.** `runNewPlanFlow` (in `extension/src/newPlanFlow.ts`) parses `role` and
   `worktree { path, detached }` and, when `role === "plan" &&
   worktree.detached === true`, submits `request.command` to the current worktree
   path and returns `complete` with no start-session, polling, or pending state.
   Unit test (a) asserts the in-window submission for both the initiative and the
   issue request; the new `newPlanFlow.test.ts` cases assert non-plan roles and an
   attached plan window keep the start-session path, and that malformed `role` /
   `worktree` fields throw. All pass (106/106).

3. **Every `workbench.action.chat.open` dispatch attaches `commands/<name>.md` or
   logs the fallback — PASS.** `commandAgent.ts` gained `resolveCommandFile`
   (canonical name / plugin root / `exists`), and `commandDispatcher.ts` gained the
   required `commandFile` dependency whose `chatOpenOptions` sets
   `attachFiles: [file]` when resolved or appends
   `dispatch: no command file for <name>: <reason>` otherwise. Unit test (b)
   asserts both paths; `commandAgent.test.ts` covers the four resolver branches.
   `grep -c 'workbench.action.chat.open' extension/src/commandDispatcher.ts` → **1**
   (the single shared call site, so the attachment covers every dispatch path).

4. **300 s default with unchanged recovery — PASS.** `NEW_PLAN_FLOW_DEFAULTS` is
   `{ pollIntervalMs: 1000, timeoutMs: 300000 }` and is `startNewPlan`'s default;
   Retry / Focus target recovery code is untouched. Unit test (c) drives the
   20:35:14 → 20:37:16.546Z field timeline under the production default and asserts
   `complete`. Passes.

5. **Local play button in an unpromoted plan window — PASS.**
   `evidence/step-3-2-plan-window-in-place.png` (inspected) shows plan window
   `plan-20261002-213543` with Session & Doctor `Role plan`, `Branch detached`,
   `Lifecycle no-delivery`, and the chat panel submitting
   `/agento new-feature initiative:codebase-modularization/api-shared-kernel` under
   `Agento Planner` with the `new-feature.md` chip attached — in the same window, no
   new session.

6. **Local New Plan from primary: start-session attached, no timeout — PASS
   (minor evidence note below).**
   `evidence/step-3-3-start-session-attached.png` (inspected) shows the primary
   window's chat completing `/agento start-session` in **1m 31s** with
   `Result: completed — plan session plan-20261002-214011 created`, and no
   "Timed out waiting for a new planning worktree." prompt. The `start-session.md`
   attachment chip is not clearly visible in this screenshot; the attachment is
   nevertheless substantiated by the single shared `chatOpenOptions` call site
   (grep = 1), unit test (b) which asserts `attachFiles: [commands/start-session.md]`
   specifically for `/agento start-session`, and step 3.2's screenshot showing the
   chip on that same path. Scored on substance per the evidence on disk.

7. **Docs and changelog — PASS.** `docs/extension.md` "Command routing" now
   documents the attachment + `dispatch: no command file` fallback (line 86) and the
   in-window path plus the 300 s handoff (line 94). `CHANGELOG.md` `## Unreleased`
   carries a **Fixed** entry citing #77 (line 21). Greps pass.

8. **Full gate green vs. baseline — PASS.** Independent re-run in the product
   checkout at `0d328aa`: `git ls-files '*.sh' | xargs pnpm dlx shellcheck` exit 0
   (no findings); `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` →
   259 tests, 259 pass, exit 0; both guard smokes exit 0;
   `cd extension && npm run typecheck` exit 0; `npm run test:unit` → 106/106 exit 0;
   `npm run test:electron` → all three scenarios (in-repo, companion, workspace)
   passed, exit 0. No findings beyond the plan's green baseline.

## Plan vs implementation

The implementation matches `plan.md ## Approach` exactly: the three defects are
fixed in `newPlanFlow.ts`, `commandDispatcher.ts`, `commandAgent.ts`, and
`extension.ts`; the four command-file resolver tests, the two new
`newPlanFlow.test.ts` parse cases, the dispatcher/initiative test helper updates,
and the electron-suite stub were all added as planned. The diff
(`git diff origin/main...HEAD`) is 12 files, +353/−14, all within the planned
scope; no undocumented or unrelated changes. Docs and changelog edits match step
4.1. No deviations found.

## Roadmap audit

Spot-checked all 10 ticked steps against the codebase and evidence on disk:

- 1.1, 2.1, 2.2, 2.3 — ticked correctly; commits `6bd4834`, `dcb0fe9`, `969232e`,
  `526ef8f` implement the claimed changes and the tests pass.
- 3.1 — `extension/agento-dashboard-0.7.0.vsix` exists and
  `code --list-extensions --show-versions` reports
  `david-perry-software.agento-dashboard@0.7.0`.
- 3.2, 3.3 — `(manual)` steps ticked with linked evidence files
  (`step-3-2-plan-window-in-place.png`, `step-3-3-start-session-attached.png`) and
  completion dates; both screenshots were inspected.
- 4.1, 4.2, 4.3 — ticked correctly; greps pass, the full gate is green, plan.md
  `## Resolution` is complete, `origin/main` was merged (already up to date), and
  `session` shows the companion half `dirty: false`, ahead/behind 0/0 with both
  PRs open (code PR #78, companion PR #21, both draft).

No falsely ticked boxes; no missing steps added; no repairs required.

## Findings

None above minor severity. Minor observation (does not block approval):

- **Evidence note — step 3.3.** The `start-session.md` attachment chip is not
  clearly visible in `step-3-3-start-session-attached.png`. The attachment on that
  path is substantiated by the shared `chatOpenOptions` call site (single call
  site), unit test (b), and step 3.2's screenshot; no code change is warranted.

## Follow-ups

(none)
