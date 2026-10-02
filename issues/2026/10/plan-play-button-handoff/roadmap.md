```yaml
status: paused
branch: issue/plan-play-button-handoff
last-updated: 2026-10-02
next-step: "3.2 (manual) In an unpromoted planning window, press the initiative member play button and capture the in-window new-feature dispatch as evidence/step-3-2-plan-window-in-place.png"
github-issue: "#77"
artifact-pr: "#21"
```

## Phase 1: Expose the defect

- [x] 1.1 Export `NEW_PLAN_FLOW_DEFAULTS` from `extension/src/newPlanFlow.ts` with today's
  unchanged value `{ pollIntervalMs: 1000, timeoutMs: 120000 }` and use it as
  `startNewPlan`'s default in `extension/src/extension.ts` (pure hoist, no behaviour
  change); add `extension/test/unit/planPlayButtonHandoff.test.ts` whose header comment
  names issue #77 / `plan-play-button-handoff` and the evidence directory, with the three
  tests (a) plan-role detached session submits the new-feature / new-issue command
  in-window with no `/agento start-session`, (b) `chat.open` options carry
  `attachFiles` from a `commandFile` resolver (and the no-file fallback logs
  `dispatch: no command file for start-session: no plugin root`), (c) a start-session
  whose workspace appears at 20:37:16.546Z after a 20:35:14.000Z submit completes under
  `NEW_PLAN_FLOW_DEFAULTS` — as designed in plan.md `## Approach` — verify:
  `cd extension && npm run typecheck` exit 0 and `npm run test:unit` exits nonzero with
  exactly these three tests failing on their assertions (all 97 existing tests pass);
  record the three failure messages in the commit message.

## Phase 2: Fix

- [x] 2.1 In-window routing: extend `Session`/`parseSession` in
  `extension/src/newPlanFlow.ts` with `role` and `worktree { path, detached }` (absent →
  `null`, malformed → throw) and, when `role === "plan"` and `worktree.detached === true`,
  submit `request.command` to `{ kind: "folder", path: worktree.path }` and return
  `complete` without start-session, polling, or pending state; add parse cases to
  `newPlanFlow.test.ts` (non-plan roles and attached `plan` keep the start-session path)
  — verify: `cd extension && npm run test:unit` — test (a) passes, all existing
  `newPlanFlow.test.ts` cases pass, (b) and (c) still fail.
- [x] 2.2 Command-file attachment: add `resolveCommandFile` to
  `extension/src/commandAgent.ts` (with `commandAgent.test.ts` cases for non-canonical,
  no plugin root, missing file, resolved path); add the required `commandFile`
  dependency to `extension/src/commandDispatcher.ts` (`CommandDispatcherDependencies`,
  the `dispatchCommandToTarget` and `consumePendingCommands` picks, `chatOpenOptions`)
  that sets `attachFiles: [file]` or logs
  `dispatch: no command file for <name>: <reason>`; wire the production closure
  (`vscode.Uri.file`, `fs.existsSync`, `pluginRoot()`) into every dispatcher dependency
  set in `extension/src/extension.ts`; give the electron suite's dispatcher dependencies
  a no-file stub and update existing unit dependency helpers — verify:
  `cd extension && npm run typecheck` exit 0; `npm run test:unit` — (a) and (b) pass,
  (c) still fails; `grep -c 'workbench.action.chat.open' extension/src/commandDispatcher.ts`
  prints 1; `npm run test:electron` exit 0.
- [x] 2.3 Timeout: change `NEW_PLAN_FLOW_DEFAULTS` to
  `{ pollIntervalMs: 1000, timeoutMs: 300000 }`, leaving the Retry / Focus target
  recovery untouched — verify: `cd extension && npm run test:unit` exit 0 with all three
  `planPlayButtonHandoff.test.ts` tests passing.

## Phase 3: Verify locally

- [x] 3.1 Package the fixed extension and install it into the local VS Code
  (`cd extension && npm run package && code --install-extension agento-dashboard-*.vsix --force`)
  — verify: `code --list-extensions --show-versions | grep agento-dashboard` shows the
  packaged version.
- [ ] 3.2 (manual) In an unpromoted planning window (`/agento start-session` from the
  primary, Session & Doctor shows `role: plan`, detached) of a project with a ready
  initiative member and the plugin clone resolvable (`agento.pluginRoot` or
  `chat.pluginLocations`), press the member's play button in the Initiatives view;
  capture the chat showing `/agento new-feature initiative:<initiative>/<member>`
  submitted in that same window under `📋 Agento Planner` with `new-feature.md` attached,
  as `evidence/step-3-2-plan-window-in-place.png` — verify: `local` — screenshot linked
  here; `git worktree list` in the primary shows no new `plan-*` entry; the Agento
  output channel shows no `dispatch: no command file` line.
- [ ] 3.3 (manual) In the primary window, run **Agento: New Plan** (feature) and let the
  handoff run to completion; capture the primary window's chat showing
  `/agento start-session` with `start-session.md` attached as
  `evidence/step-3-3-start-session-attached.png` — verify: `local` — the new planning
  window opens and receives the `/agento new-feature …` command with no "Timed out
  waiting for a new planning worktree." prompt; note the observed start-session
  duration on this line.

## Phase 4: Docs, changelog, gate

- [x] 4.1 Update `docs/extension.md` "Command routing" (command-file attachment and its
  `dispatch: no command file` fallback; New Plan stays in an unpromoted plan window,
  otherwise starts a session and waits up to 300 s with Retry / Focus target) and add a
  **Fixed** entry citing #77 under `CHANGELOG.md` `## Unreleased` — verify:
  `grep -n 'no command file' docs/extension.md`, `grep -n '300' docs/extension.md`,
  `grep -n '#77' CHANGELOG.md`, and `node --test 'tests/**/*.test.mjs'` exit 0.
- [x] 4.2 Full gate (policy §5): `git ls-files '*.sh' | xargs pnpm dlx shellcheck`
  exit 0; `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exit 0;
  `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` and
  `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt`
  exit 0; `cd extension && npm run typecheck && npm run test:unit && npm run test:electron`
  exit 0 — verify: every recorded status is 0 and there are no findings beyond the
  plan.md baseline (none).
- [ ] 4.3 Write plan.md `## Resolution` (root cause, what changed, proof the 1.1 tests
  pass), merge `origin/main` into the product branch and the companion's `origin/main`
  into the companion branch, push both, and set this roadmap to `status: in-review`
  with `next-step: ""` — verify: `node <agento-root>/scripts/agento.mjs session --pr`
  shows the companion half `dirty: false`, `ahead: 0` and both PRs open.

## Follow-ups

(none yet)
