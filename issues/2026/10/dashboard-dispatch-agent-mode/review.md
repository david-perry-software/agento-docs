# Review: dashboard-dispatch-agent-mode

Verdict: approve

## Acceptance checklist results

- [x] **Exposing regression test fails before the fix, passes after** — **PASS.**
  `extension/test/unit/commandDispatcher.test.ts` contains
  `dashboard dispatch submits the command's agent as chat.open mode (issue #73 /
  dashboard-dispatch-agent-mode)`. Commit `cee7fd0` records the pre-fix failure
  (`AssertionError: expected { query: '/agento new-feature widget', mode: '📋 Agento
  Planner' }, actual { query: '/agento new-feature widget' }`). Re-run
  `cd extension && npm run test:unit` → `ok 20`, `# tests 97`, `# pass 97`, `# fail 0`.
- [x] **Every `workbench.action.chat.open` call carries `mode` when the agent resolves;
      single options builder** — **PASS.**
  `grep -c 'workbench.action.chat.open' extension/src/commandDispatcher.ts` → `1`
  (the `chatOpenOptions` builder is the only literal, used by all three call sites).
  The #73 unit test asserts all three paths (`dispatchCommandAction`,
  `dispatchCommandToTarget` current-target, `consumePendingCommands`) submit
  `{ query, mode }`. (The pre-fix `evidence/repro-dispatch-mode.mjs` captured the
  defect at 3/3 no-mode; the equivalent unit assertion is the post-fix check.)
- [x] **Planner → `📋 Agento Planner`, `delivery-status` → `agent`, missing `agent:`
      line → `agent`** — **PASS.** `extension/test/unit/commandAgent.test.ts` passes
  (`ok 9`–`ok 18`): `resolveChatMode` maps a planner command to its `agent:` name
  verbatim and maps `"agent"`/missing `agent:` to `"agent"`.
- [x] **No plugin root → `{ query }` + one output line; electron suite passes** — **PASS.**
  The rewritten fallback unit test asserts `{ query }` plus
  `dispatch: no mode for /agento delivery-status: no plugin root`. `npm run
  test:electron` → all three scenarios pass (`in-repo`, `companion`, `workspace`),
  each extension host exits code 0.
- [x] **Docs describe agent-mode dispatch + fallback; `commands/*.md` `model:` no-op
      note; node tests green** — **PASS.** `grep -n 'mode' docs/extension.md` → lines
  77–86; `grep -n 'no-op' docs/model-profiles.md` → line 65; `node --test
  'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → 259 pass / 0 fail.
- [x] **`CHANGELOG.md` `## Unreleased` **Fixed** entry referencing #73** — **PASS.**
  `grep -n '#73' CHANGELOG.md` → line 11.
- [x] **Pre-review local verification: dispatching a planner action switches Chat to
      `📋 Agento Planner`** — **PASS.** `evidence/step-3-2-planner-mode.png` shows the
  chat model picker on `Agento Planner` / `Claude Opus 5.5` after a `/agento
  new-feature` dispatch; `evidence/step-3-3-built-in-agent.png` shows the built-in
  `Agent` mode with `DeepSeek V4 Pro` for `/agento delivery-status`. Both screenshots
  verified by inspection. The electron suite is the independent re-drive of the
  dispatcher paths (fallback branch); the positive `mode` path is covered by the #73
  unit test plus the Builder's end-to-end screenshot.
- [x] **Full gate (policy §5)** — **PASS.** Re-run by the reviewer: `git ls-files
  '*.sh' | xargs pnpm dlx shellcheck` → exit 0 (4 scripts, no findings);
  `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → 259/259;
  `cd extension && npm run typecheck` → exit 0; `cd extension && npm run test:unit`
  → 97/97. No new findings versus the plan.md baseline.

## Plan vs implementation

The implementation matches plan.md `## Approach` exactly: new pure module
`extension/src/commandAgent.ts` (`commandName`, `readCommandAgent`, `resolveChatMode`);
a single `chatOpenOptions(command)` builder in `extension/src/commandDispatcher.ts`
used by all three `workbench.action.chat.open` call sites; production `chatMode`
wired in `extension/src/extension.ts` from `pluginRoot()` + `fs.readFileSync`.

The only files outside the approach's explicit list are the two test fixtures
(`extension/test/unit/newInitiativeFlow.test.ts`, `extension/test/electron/suite.ts`),
whose `CommandDispatcherDependencies`/`Pick<…>` object literals had to gain the new
required `chatMode` (and, where needed, `output`) fields — a mechanical consequence of
the interface change, with no behavioral deviation. The electron `deepEqual`
assertions keep `{ query }` and now carry the explanatory comments the approach calls
for (fixture resolves no plugin root → fallback).

`## Research` states `Skills consulted: none — no matching domain`; confirmed: the
repository has no `.agents/skills/` directory and AGENTS.md carries no `## Agento`
skills table.

## Roadmap audit

All 10 steps are ticked; each `verify:` was re-run or corroborated above.

- **Repair made:** step 4.2 recorded `npm run test:unit` as `96 pass / 0 fail`; the
  actual run is 97 pass / 0 fail (and plan.md `## Resolution` already says 97).
  Corrected the roadmap to `97 pass / 0 fail`.
- Ticked `(manual)` steps 3.2 and 3.3 each link their evidence files
  (`step-3-2-planner-mode.png`, `step-3-3-built-in-agent.png`) and carry completion
  notes with dates — policy §3 satisfied.
- No falsely ticked boxes found; no missing-work steps needed.

## Findings

- (none above minor)

## Follow-ups

- (none)
