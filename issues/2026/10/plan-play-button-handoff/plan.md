# New Plan flow: stay in an unpromoted plan window, attach the command file, wait 300 s

## Problem

Every New Plan entry point in the Agento extension goes through `runNewPlanFlow` in
`extension/src/newPlanFlow.ts`. That covers the initiative member play button
(`agento.planInitiativeMember`), New Feature, and New Issue (`agento.newPlan`). The
flow has three defects that together make the play button look like it loops and fail
even when it works:

1. **It always starts a new session.** The flow always submits
   `/agento start-session` to the primary checkout and waits for a new plan worktree.
   It does this even when the window it runs in is already an unpromoted planning
   session (`role: plan`, detached). Each press creates another `plan-*` worktree,
   opens another window, and hands the plan there. The window the user is in is
   never used.
2. **The start-session dispatch is bare text.** `workbench.action.chat.open` gets
   `{ query, mode }` and no attachment. The agent then searches the plugin clone for
   `commands/start-session.md`, which took about 40 s in the observed run. Every
   other dashboard dispatch has the same gap.
3. **The 120 s handoff poll times out about 2 s early.** A normal start-session takes
   about 2 minutes. The flow times out just before the `.code-workspace` file appears,
   so the user gets "Timed out waiting for a new planning worktree." even though the
   session was created.

## Evidence

GitHub issue: #77

Reproduction (verified 2026-10-02 at `d736a58`, extension built with
`cd extension && npm ci && npm run test:unit`):

1. **Field run (the user's 20:35 transcript).**
   [evidence/transcript-20261002-2035-start-session.jsonl](evidence/transcript-20261002-2035-start-session.jsonl)
   is the 86-line chat transcript `0577c775-aee0-4451-aa5f-f2bbb881d724.jsonl`,
   running 20:35:13 → 20:37:21 UTC. The timeline extracted from it is
   [evidence/transcript-timeline.txt](evidence/transcript-timeline.txt).
   - Line 2: `user.message content='/agento start-session' attachments=[]`. The
     dispatch carried no file.
   - Lines 7–22: `agento.mjs --help`, `ls`, then `ls commands/`. The agent only
     reaches `read_file commands/start-session.md` at 20:35:44, 30 s after the
     submit. The policy read and `doctor` follow until 20:36:04.
   - Line 72 (20:37:04): `git worktree add --detach …/soshiki-worktrees/plan-20261002-203631`.
     Line 82 (20:37:16.5): `agento.mjs workspace plan 20261002-203631 --write`.
   - [evidence/stat-worktree-workspace.txt](evidence/stat-worktree-workspace.txt):
     worktree birth `20:37:05.10`, companion half birth `20:37:11.81`, workspace file
     birth `20:37:17.60` (UTC). The flow's deadline was submit (≈20:35:14) + 120 s
     = **20:37:14**. The workspace file needed by `targetFromSession` in companion
     mode did not exist before the deadline.
2. **Probe.**
   [evidence/repro-plan-play-button.mjs](evidence/repro-plan-play-button.mjs) drives
   the compiled `extension/out/src/newPlanFlow.js` and `commandDispatcher.js`.
   `node evidence/repro-plan-play-button.mjs <agento worktree>` printed
   ([evidence/repro-plan-play-button.txt](evidence/repro-plan-play-button.txt)):

   ```
   DEFECT 1 — plan-role detached window, play button:
     submitted: [{"command":"/agento start-session","target":{"kind":"folder","path":"/repo"}}]
     result: complete {"kind":"folder","path":"/repo-worktrees/plan-new"}
     expected: one submit of the /agento new-feature command to the current window, no /agento start-session
   DEFECT 2 — in-window dispatch of /agento start-session:
     chat.open args: [["workbench.action.chat.open",{"query":"/agento start-session","mode":"agent"}]]
     attachFiles present: false
   DEFECT 3 — production default {"pollIntervalMs":1000,"timeoutMs":120000} against a start-session that finishes at 20:37:16.546Z:
     deadline: 2026-10-02T20:37:14.000Z
     result: timeout — Timed out waiting for a new planning worktree.
   ```

Observed vs expected:

- **Observed:**
  - From a `role: plan`, detached window, the play button and New Plan submit
    `/agento start-session` to the primary checkout and open a different, newly
    created plan window.
  - `chat.open` carries no `attachFiles`.
  - With the 120 s default, a roughly 2-minute start-session ends in the timeout
    recovery prompt.
- **Expected:**
  - From a `role: plan`, detached window, the `/agento new-feature …` or
    `/agento new-issue …` command is submitted in that same window. There is no
    start-session, no pending handoff, and no new window.
  - Every dispatched `/agento <name>` attaches `commands/<name>.md` from the
    resolved plugin root.
  - The default poll timeout is 300 s, the 1 s poll stays, and Retry / Focus target
    recovery stays.

There is no screenshot. Each defect is in the arguments or decisions the extension
passes to injected dependencies, which the probe records exactly. The Builder's
local verification steps drive the real chat UI and add screenshots under
`evidence/`.

## Decisions

Clarifying questions asked 2026-10-02 (numbered-list fallback; the ask-questions
tool was unavailable). Answers verbatim:

1. *Should the in-window path apply to every New Plan entry point, and is the
   condition `role: plan` + detached?* —
   "**Every New Plan entry point, and `role: plan` + `detached` is enough.** All three buttons (initiative member play, generic New Feature, New Issue) funnel into `runNewPlanFlow`, so all three must take the in-window path from an unpromoted plan window. `role: plan` is only reported while the worktree is still on `plan-*` unpromoted (a promoted one reports `build`), and `detached` confirms it's pre-promotion — no delivery and clean don't need separate checks; if the Planner finds a dirty tree when it runs, that's its normal duty, not a routing concern."
2. *Should every dispatched `/agento …` command attach its `commands/<name>.md`, and
   what is the fallback?* —
   "**Every dispatched `/agento …` command attaches its `commands/<name>.md`.** Uniform, and it fixes the slow start everywhere (in-window, cross-window pending, handoff). On unresolved plugin root or unreadable file: dispatch without the attachment and log a `dispatch: no command file for <name>: <reason>` line — same fallback shape as chat mode. Acceptable."
3. *New timeout?* — "**300 s**, keep the 1 s poll and Retry / Focus target recovery."
4. *What counts as verified reproduction?* —
   "**Unit-level exposing tests + the 20:35 timings count as verified reproduction.** The miss is provable from the clock: the extension's 120 s deadline was 20:37:14 and the workspace file landed 20:37:16. No Electron activation-test reproduction needed; the regression tests (plan-role session still submits start-session; `chat.open` args carry no `attachFiles`; a ~2-min start-session outruns the default timeout) are the exposing proof."
5. *One issue or three; where is the transcript?* —
   "**One issue, slug `plan-play-button-handoff`, covering all three defects.** The 20:35 transcript is a chat debug-log file: `0577c775-aee0-4451-aa5f-f2bbb881d724.jsonl` (86 lines, 20:35:13 → 20:37:21). Copy that into `evidence/`, plus a `stat` of the worktree and workspace file showing 20:37:04 / 20:37:16."

   (The file was found under
   `~/.config/Code/User/workspaceStorage/d68d8134…/GitHub.copilot-chat/transcripts/`.
   A secret-pattern scan found 0 matches before it was copied. The `stat` birth
   times are 20:37:05.1 and 20:37:17.6. The tool calls that created the worktree
   and the workspace file started at 20:37:04.1 and 20:37:16.5.)

## Research

Skills consulted: none — no matching domain. The repository has no `.agents/skills/`
directory, and AGENTS.md has no `## Agento` skills table.

Root cause, defect 1. `extension/src/newPlanFlow.ts` `runNewPlanFlow` (≈line 165):

- It reads the current session with `parseSession(await dependencies.readSession())`.
  Then it unconditionally runs `primaryTarget(before)` and
  `submitCommand("/agento start-session", primary)`, and polls for a new
  `isManaged && dirPrefix === "plan"` worktree.
- `parseSession` keeps only `worktrees`, `companion`, and `workspace`. It drops the
  record's `role` and `worktree` (`detached`, `path`), so the flow cannot tell it is
  already in a planning window.
- The production `readSession` in `extension/src/extension.ts`
  (`productionNewPlanDependencies`, ≈line 282) runs `agento.mjs session` in
  `workspaceFolders[0]`, which is the current window's product half. That record is
  exactly the one that reports `role: plan` and `worktree.detached: true` for an
  unpromoted session. This session's own record proves it: `role: "plan"`,
  `worktree.detached: true`, `dirPrefix: "plan"`.
- `submitCommand` already routes in-window correctly when the target path is one of
  `currentTargetPaths()` (workspace file plus folder paths, ≈line 277).
  `dispatchCommandToTarget(..., isCurrentTarget=true)` calls `chatOpenOptions` and
  writes no pending state. So the fix is only a routing decision inside
  `runNewPlanFlow`.

Root cause, defect 2. `extension/src/commandDispatcher.ts` `chatOpenOptions`
(lines 30–42):

- It is the single `workbench.action.chat.open` call site (grep confirms one literal
  in `extension/src`). It builds `{ query, mode? }` only.
- All three dispatch paths go through it: `dispatchCommandToTarget` for the current
  target, the `dispatchCommandAction` submit route, and `consumePendingCommands`.
- VS Code `IChatViewOpenOptions` (`src/vs/workbench/contrib/chat/browser/actions/chatActions.ts`,
  fetched 2026-10-02 from `microsoft/vscode` `main`) declares
  `attachFiles?: (URI | { uri: URI; range: IRange })[]`.
  `OpenChatGlobalAction.run` calls `chatWidget.attachmentModel.addFile(uri, range)`
  for each one that `fileService.exists(uri)`, before `setInput` / `acceptInput`, so
  the file is part of the submitted request.
- Arguments from the extension host are revived from `$mid`-marked objects, so the
  production value must be a `vscode.Uri` (`vscode.Uri.file(path)`), not a string.
- The command name and plugin root are already resolved for chat mode:
  - `extension/src/commandAgent.ts` `commandName` and `resolveChatMode`, with path
    `path.join(pluginRoot, "commands", `${name}.md`)`.
  - `extension/src/extension.ts` `pluginRoot()` (line 101, `resolvePluginRoot` from
    `modelProfiles.ts`).
- `commands/start-session.md` exists in this clone, as do all other command names
  (`commands/` listing in the repository tree).

Root cause, defect 3. `extension/src/extension.ts` `startNewPlan` (≈line 308)
defaults `options: NewPlanFlowOptions = { pollIntervalMs: 1000, timeoutMs: 120000 }`.
The deadline loop in `runNewPlanFlow` is `deadline = now() + timeoutMs`, and Retry
restarts it, which is correct. The value is the defect. Measured in the field: about
122.6 s from submit to the workspace file. In companion mode `targetFromSession`
returns `null` until `workspace.exists`, so the flow keeps polling past worktree
creation until the workspace file lands.

Tests and docs that touch the change:

- `extension/test/unit/newPlanFlow.test.ts` builds sessions without `role` or
  `worktree`, so every existing case stays on the start-session path once the
  in-window branch keys on `role === "plan" && worktree.detached === true`.
- `extension/test/unit/commandDispatcher.test.ts` asserts exact `chat.open` option
  objects (`{ query }`, `{ query, mode }`). Those assertions stay valid when the
  command-file resolver reports no file, and gain `attachFiles` only in new positive
  cases.
- `extension/test/electron/suite.ts`:
  - It asserts `{ query }` with `deepEqual` at lines 270, 439–440, and 460–461. The
    fixture has no plugin root, so the fallback keeps those valid.
  - It constructs `dispatchCommandToTarget` dependencies at ≈line 255, so a new
    required dependency must be added there.
  - Its New Plan cases (lines 170–218) use a primary-only fixture and keep asserting
    the start-session submission.
- `docs/extension.md` "Command routing" (lines 70–89) describes agent-mode dispatch
  and the New Plan action. `CHANGELOG.md` has an `## Unreleased` section (#73, #75
  entries) where this fix adds a **Fixed** entry.

Open delivery branches: `gh pr list --state open` is empty in both `agento` and
`agento-docs`, so there is no concurrent-delivery overlap.

Lint baseline (policy §5), run 2026-10-02 at `d736a58`:

- Shell lint: `shellcheck` is not on PATH. Ran
  `git ls-files '*.sh' | xargs pnpm dlx shellcheck` over
  `scripts/hooks/delivery-guard.sh scripts/hooks/replay-guard.sh scripts/hooks/session-context.sh scripts/wait-for-checks.sh`:
  exit 0, no findings.
- Tests: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`: exit 0, 259
  tests, 259 pass.
- Guard smoke: `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` exit 0;
  `REPLAY_COMPANION=1 … < tests/guard-fixtures-companion.txt` exit 0.
- Extension: `cd extension && npm ci` exit 0; `npm run typecheck` exit 0;
  `npm run test:unit` exit 0, 97 tests, 97 pass.

Overlap decision: the baseline is green, so the **full gate** applies. At the end
the full shellcheck run, the full node test suite, both guard smokes, the extension
typecheck, and the extension unit and electron tests must all be green. No scoped
gate is needed. This delivery changes no shell files.

## Approach

**Defect 1: in-window routing (`extension/src/newPlanFlow.ts`).**

- Extend `Session` and `parseSession` with `role: string | null` and
  `worktree: { path: string; detached: boolean } | null`. These are read from the
  record's `role` and `worktree` fields. Fields that are absent parse as `null`, so
  existing fixtures keep working. A present but malformed field throws, matching
  today's strictness.
- At the top of `runNewPlanFlow`, after reading `before`: when
  `before.role === "plan" && before.worktree?.detached === true`, call
  `submitCommand(request.command, { kind: "folder", path: before.worktree.path })`
  and return `{ kind: "complete", command: request.command, target }`. This path has
  no `start-session`, no polling, and no pending-store write.
- In production `submitCommand` already decides in-window versus cross-window via
  `currentTargetPaths().has(target.path)`. The worktree path is one of the window's
  folders in both layouts, including the companion `.code-workspace` window whose
  first folder is the product half. So the command opens chat in this window with
  the Planner mode.
- Every other role (`primary`, `build`, `freehand`, `unmanaged`) and a non-detached
  `plan` keep today's start-session path unchanged.

**Defect 2: attach the command file (`extension/src/commandAgent.ts`,
`extension/src/commandDispatcher.ts`, `extension/src/extension.ts`).**

- New pure resolver in `commandAgent.ts`:
  `resolveCommandFile(command, { pluginRoot, exists }): { path: string } | { path: null; reason: string }`.
  - Reason `not a canonical /agento command` when `commandName` is `null`.
  - Reason `no plugin root` when the plugin root is unresolved.
  - Reason `missing command file <path>` when `!exists(path)`.
  - Otherwise `{ path: path.join(pluginRoot, "commands", `${name}.md`) }`.
- New required dependency `commandFile: CommandFileResolver` on
  `CommandDispatcherDependencies`, the `dispatchCommandToTarget` pick,
  `consumePendingCommands`, and the internal `chatOpenOptions` helper. The type is
  `(command: string) => { file: unknown } | { file: null; reason: string }`. Making
  it required means every call site has to wire it, rather than a missing wire
  failing silently.
- `chatOpenOptions` adds `attachFiles: [file]` when a file resolves. Otherwise it
  appends `dispatch: no command file for <name>: <reason>` to the output channel and
  omits `attachFiles`. `<name>` is `commandName(command) ?? command`. `query` and
  `mode` behave exactly as today.
- In `extension.ts`, one `commandFile` closure maps `resolveCommandFile(command,
  { pluginRoot: pluginRoot(), exists: fs.existsSync })` to
  `{ file: vscode.Uri.file(path) }`. It is wired into `dispatchAction`,
  `productionNewPlanDependencies.submitCommand`, the new-initiative dispatch
  (≈line 377), and `consumePending` (≈line 520).
- `extension/test/electron/suite.ts` passes a stub `commandFile` that returns
  `{ file: null, reason: "unused" }` where it builds dispatcher dependencies.

**Defect 3: timeout (`extension/src/newPlanFlow.ts`, `extension/src/extension.ts`).**

- Export `NEW_PLAN_FLOW_DEFAULTS: NewPlanFlowOptions` from `newPlanFlow.ts` and use
  it as `startNewPlan`'s default, so the production value is unit-testable.
- Step 1.1 hoists today's value (`{ pollIntervalMs: 1000, timeoutMs: 120000 }`)
  unchanged, so the exposing test compiles and fails on its assertion.
- Step 2.3 changes it to `{ pollIntervalMs: 1000, timeoutMs: 300000 }`.
- The Retry and Focus target recovery code is untouched.

**Exposing tests.** New file `extension/test/unit/planPlayButtonHandoff.test.ts`,
with a header comment naming issue #77 / `plan-play-button-handoff` and this
evidence directory. It has three tests:

- (a) A `role: plan`, detached session record. Asserts that the play-button request
  (`createInitiativePlanRequest`) and a `createNewPlanRequest("issue", …)` request
  are each submitted once to the current worktree path, with no
  `/agento start-session`, no pending-store entry, and no `openTarget` call.
- (b) `dispatchCommandToTarget` for the current window, plus
  `consumePendingCommands`, with a `commandFile` resolver that returns a sentinel
  file. Asserts that `chat.open` options carry `attachFiles: [sentinel]` for
  `/agento start-session`. A second case with `{ file: null, reason: "no plugin
  root" }` asserts the options have no `attachFiles` and the output line is
  `dispatch: no command file for start-session: no plugin root`. The dependencies
  object is built as a variable so the test compiles before `commandFile` exists on
  the type.
- (c) `runNewPlanFlow` with `NEW_PLAN_FLOW_DEFAULTS` and a fake clock. The submit is
  at 20:35:14.000Z, and the session shows the new plan worktree with
  `workspace.exists` only from 20:37:16.546Z. Asserts `result.kind === "complete"`.

**Docs.**

- `docs/extension.md` "Command routing":
  - Dispatches attach `commands/<name>.md` and log the fallback line.
  - New Plan stays in an unpromoted plan window and otherwise starts a session,
    waiting up to 300 s with Retry / Focus target.
- `CHANGELOG.md` `## Unreleased`: a **Fixed** entry citing #77.

## Risks

- **A `role: plan` window may have no workspace folder matching `worktree.path`**
  (for example a window opened on a subfolder). `submitCommand` would then treat it
  as cross-window and open the worktree, writing a pending command, which is still
  correct and not a loop.
  - Mitigation: unit test (a) asserts the in-window target path. Local verification
    step 3.2 drives a real plan window.
- **Attaching a file changes the request content for every dispatch.** A plugin root
  pointing at an older clone would attach an older command file.
  - Mitigation: it is the same file VS Code loads in plugin mode, and the same root
  `resolveChatMode` already trusts. `fileService.exists` guards missing files, and
  the extension checks `exists` first so the log line explains the omission.
- **A longer timeout delays the "timed out" message for a genuinely failed
  start-session by 3 more minutes.**
  - Mitigation: the user's choice (Decisions 3). The progress notification stays
    cancellable, and Retry / Focus target are unchanged.
- **The electron suite's `deepEqual` assertions on `{ query }`** would break if the
  fixture ever resolved a plugin root.
  - Mitigation: the fixture has none, the stub `commandFile` returns no file, and
    step 2.2 verifies `npm run test:electron`.
- **Concurrent deliveries:** no open PRs in either repository at planning time.
  - Mitigation: integrate `origin/main` (and the companion's `origin/main`) before
    every push, per policy §7.

## Out of scope

- Changing `/agento start-session` itself or its runtime (the ~2 min is accepted;
  only the poll window changes).
- Promoting or reusing a `role: build` window, or any role other than an unpromoted
  `plan` window.
- Checking cleanliness or delivery state before the in-window dispatch (the Planner's
  own isolation protocol handles that, per Decisions 1).
- Attaching instruction files (delivery-policy, artifacts) in addition to the command
  file.
- The `paths` CLI's `worktreesDir` value when run from inside a plan worktree (noted
  during planning; unrelated).

## Acceptance checklist

- [ ] The exposing regression test file
  `extension/test/unit/planPlayButtonHandoff.test.ts` (issue #77) fails before the fix
  (step 1.1 records the three failing assertions) and passes after it — verify:
  `cd extension && npm run test:unit` exit 0 with all three tests passing; step 1.1's
  commit message records the pre-fix failures.
- [ ] From a `role: plan`, detached session, `runNewPlanFlow` submits the request's
  `/agento new-feature …` or `/agento new-issue …` command once to the current
  worktree and never submits `/agento start-session`. Every other role keeps the
  start-session path — verify: unit tests (a) and the unchanged
  `newPlanFlow.test.ts` cases pass.
- [ ] Every `workbench.action.chat.open` dispatch carries
  `attachFiles: [<commands/<name>.md>]` when the plugin root resolves. Otherwise it
  omits `attachFiles` and logs `dispatch: no command file for <name>: <reason>` —
  verify: unit test (b), `commandAgent.test.ts` cases for `resolveCommandFile`, and
  `grep -c 'workbench.action.chat.open' extension/src/commandDispatcher.ts` = 1.
- [ ] The production New Plan default is `{ pollIntervalMs: 1000, timeoutMs: 300000 }`
  via `NEW_PLAN_FLOW_DEFAULTS`, and the Retry / Focus target recovery is unchanged —
  verify: unit test (c), plus the existing timeout and recovery tests in
  `newPlanFlow.test.ts`.
- [ ] Locally, pressing an initiative member's play button in an unpromoted plan
  window starts `/agento new-feature initiative:…` in that window's chat with
  `commands/new-feature.md` attached, and no new worktree appears — verify: `local`.
  Step 3.2 screenshot `evidence/step-3-2-plan-window-in-place.png`, and
  `git worktree list` is unchanged.
- [ ] Locally, New Plan from the primary window submits `/agento start-session` with
  `commands/start-session.md` attached, and the handoff to the new plan window
  completes without the timeout prompt — verify: `local`. Step 3.3 screenshot
  `evidence/step-3-3-start-session-attached.png` and the observation on the step
  line.
- [ ] `docs/extension.md` "Command routing" and `CHANGELOG.md` `## Unreleased`
  describe the three fixes — verify: `grep -n 'commands/<name>.md\|300' docs/extension.md`
  and `grep -n '#77' CHANGELOG.md`.
- [ ] Full gate (policy §5) green with no new findings versus the baseline — verify:
  `git ls-files '*.sh' | xargs pnpm dlx shellcheck` exit 0;
  `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exit 0; both guard
  smokes exit 0; `cd extension && npm run typecheck && npm run test:unit && npm run test:electron`
  exit 0.
