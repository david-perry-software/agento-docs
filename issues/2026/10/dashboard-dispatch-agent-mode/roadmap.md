```yaml
status: in-review
branch: issue/dashboard-dispatch-agent-mode
last-updated: 2026-10-02
next-step: ""
github-issue: "#73"
artifact-pr: "#19"
```

## Phase 1: Expose the defect

- [x] 1.1 Add the exposing regression test to
  `extension/test/unit/commandDispatcher.test.ts` — one test named for issue #73 /
  `dashboard-dispatch-agent-mode` that injects a `chatMode` dependency returning
  `{ mode: "📋 Agento Planner" }` for `/agento new-feature widget` and
  `{ mode: "agent" }` for `/agento delivery-status`, and asserts that
  `dispatchCommandAction`, `dispatchCommandToTarget` (current target), and
  `consumePendingCommands` each submit `workbench.action.chat.open` with
  `{ query, mode }` — verify: `cd extension && npm run test:unit` exits nonzero with
  only this test failing (today's dispatcher ignores `chatMode` and passes
  `{ query }`); record the failing assertion in the commit message.

## Phase 2: Fix the dispatcher

- [x] 2.1 Create `extension/src/commandAgent.ts` with `commandName`,
  `readCommandAgent`, and `resolveChatMode` as designed in plan.md `## Approach`
  (quoted or bare `agent:` scalar; missing `agent:` or `"agent"` → `"agent"`;
  `pluginRoot === null` or unreadable file → `{ mode: null, reason }`), plus
  `extension/test/unit/commandAgent.test.ts` covering each branch — verify:
  `cd extension && npm run typecheck` exit 0 and the new unit file passes under
  `npm run test:unit` (the 1.1 test still fails).
- [x] 2.2 Thread `chatMode` through `CommandDispatcherDependencies` in
  `extension/src/commandDispatcher.ts`, add a single `chatOpenOptions(command)`
  builder used by all three `workbench.action.chat.open` calls, and append
  `dispatch: no mode for <command>: <reason>` to the output channel when it falls
  back to `{ query }`; rewrite the existing "without forcing a mode" and
  pending-command tests to exercise the fallback — verify: `cd extension && npm run
  test:unit` exit 0 including the 1.1 test; `grep -c 'workbench.action.chat.open'
  extension/src/commandDispatcher.ts` reports exactly one literal.
- [x] 2.3 Wire the production `chatMode` in `extension/src/extension.ts` from
  `pluginRoot()` and `fs.readFileSync` for `dispatchAction`,
  `productionNewPlanDependencies.submitCommand`, and `consumePending`; add a
  comment to the `deepEqual` assertions in `extension/test/electron/suite.ts`
  explaining that the fixture has no plugin root so `{ query }` is the expected
  fallback — verify: `cd extension && npm run build && npm run test:electron`
  exit 0.

## Phase 3: Verify the behaviour locally

- [x] 3.1 Package the fixed extension and install it into the local VS Code
  (`cd extension && npm run package && code --install-extension
  agento-dashboard-*.vsix --force`) — verify: `code --list-extensions --show-versions
  | grep agento-dashboard` shows the packaged version.
- [x] 3.2 (manual, added 2026-10-02) In a VS Code window on an initialized Agento project with the plugin clone
  resolvable (`agento.pluginRoot` or `chat.pluginLocations`), select a non-planner
  agent in Chat, then dispatch a planner action (`/agento new-feature …` or
  `/agento new-issue …`) from the Deliveries or Session view; capture the chat
  header showing `📋 Agento Planner` selected (and, if a model profile is applied,
  the Planner's pinned model in the picker) as
  [evidence/step-3-2-planner-mode.png](evidence/step-3-2-planner-mode.png) in the
  companion artifact directory — verify: `local` — screenshot linked here and the
  Agento output channel shows no `dispatch: no mode` line for that command.
  Completed 2026-10-02: dispatching `/agento new-feature` from the Deliveries view
  switched Chat to `📋 Agento Planner` (Claude Opus 5.5); the Agento output channel
  showed no `dispatch: no mode` line for the command.
- [x] 3.3 (manual, added 2026-10-02) Dispatch a built-in-agent action
  (`/agento delivery-status`) from the Session view in the same window — verify:
  `local` — Chat is in the built-in Agent mode when the request is submitted; note
  the observation on this line. Completed 2026-10-02: the request submitted in the
  built-in Agent mode (DeepSeek V4 Pro) —
  [evidence/step-3-3-built-in-agent.png](evidence/step-3-3-built-in-agent.png).

## Phase 4: Docs, changelog, gate

- [x] 4.1 Update `docs/extension.md` ("Command routing": agent-mode dispatch with its
  fallback and the `agento.pluginRoot` hint), `docs/model-profiles.md`
  ("Resolution": `commands/*.md` `model:` pins are no-ops for plugin commands; the
  agent's `model:` applies through the dispatch's agent switch; mirrors stay
  byte-identical), and `CHANGELOG.md` (new `## Unreleased` **Fixed** entry
  referencing #73) — verify: `grep -n 'no-op' docs/model-profiles.md`, `grep -n
  '#73' CHANGELOG.md`, and `node --test 'tests/**/*.test.mjs'` exit 0.
- [x] 4.2 Full gate (policy §5): `git ls-files '*.sh' | xargs pnpm dlx shellcheck`
  exit 0 (no findings, 4 scripts); `node --test 'scripts/**/*.test.mjs'
  'tests/**/*.test.mjs'` 259 pass / 0 fail; `cd extension && npm run typecheck`
  exit 0; `cd extension && npm run test:unit` 97 pass / 0 fail; no new findings
  versus the plan.md baseline — verify: the recorded statuses are all 0.
- [x] 4.3 Write plan.md `## Resolution` (root cause, what changed, proof the 1.1
  test passes), merge `origin/main` into the product branch and the companion's
  `origin/main` into the companion branch, push both, and set the roadmap to
  `status: in-review` with `next-step: ""` — verify: `node <agento-root>/scripts/agento.mjs
  session --pr` shows `dirty: false`, `ahead: 0` for the companion half and both
  PRs open. Completed 2026-10-02.

## Follow-ups

(none yet)
