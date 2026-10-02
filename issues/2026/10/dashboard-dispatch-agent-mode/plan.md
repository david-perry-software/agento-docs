# Dashboard dispatch must open Chat in the command's agent

## Problem

The Agento extension's dashboard (Deliveries tree, Session & Doctor view, New Plan
flow, cross-window pending commands) submits every `/agento …` command to Copilot
Chat with `workbench.action.chat.open` and `{ query }` only. VS Code therefore runs the
command in whatever agent the chat widget currently has selected, not in the agent
the command's `agent:` frontmatter names — `/agento new-feature` lands in the Builder
or the built-in agent if that is what the window last used, and the Planner's
`model:` pin from the active model profile never applies. The user-visible effect is
a plugin command running under the wrong agent and the wrong model whenever the
dashboard, rather than the chat input, launched it.

The fix is to pass the command's agent name as `mode` on every chat.open call
(`"📋 Agento Planner"` for planner commands, `"agent"` for built-in-agent commands)
and to document that `model:` pins written into the `commands/*.md` mirrors are
no-ops for plugin commands — the agent's own `model:` is what takes effect once the
dispatch switches agents.

## Evidence

GitHub issue: #73

Reproduction (verified 2026-10-02 against the extension built at `a90fc9a`):

1. `cd extension && npm run build` — exit 0.
2. Drive the three dispatch paths of `extension/out/commandDispatcher.js` with a
   recording `executeCommand`
   ([evidence/repro-dispatch-mode.mjs](evidence/repro-dispatch-mode.mjs)):
   `dispatchCommandAction` (in-window action), `dispatchCommandToTarget` with the
   current window as target, and `consumePendingCommands` (the New Plan handoff
   consumed in the new planning window).
3. Output ([evidence/repro-dispatch-mode.txt](evidence/repro-dispatch-mode.txt)):

   ```
   {"command":"workbench.action.chat.open","options":{"query":"/agento new-feature widget"},"hasMode":false}
   {"command":"workbench.action.chat.open","options":{"query":"/agento review-feature widget"},"hasMode":false}
   {"command":"workbench.action.chat.open","options":{"query":"/agento new-issue widget"},"hasMode":false}
   3/3 chat.open submissions carry no mode (expected 0 once fixed)
   exit=1
   ```

Call sites ([evidence/call-sites.txt](evidence/call-sites.txt)):
`extension/src/commandDispatcher.ts` lines 33, 66, and 101 — each
`executeCommand("workbench.action.chat.open", { query })`.

- **Observed:** Chat opens in the currently selected agent and submits the query
  there; the request runs on that agent's model.
- **Expected:** Chat switches to the command's agent before submitting (`mode` =
  the `agent:` value of `commands/<name>.md`, or `"agent"` for built-in-agent
  commands) so the agent's `model:` pin applies.

No screenshot is attached: the defect is in the arguments the extension passes to a
VS Code command, which the recorded `executeCommand` captures exactly; the Builder's
pre-review step drives the real chat UI and lands a screenshot under `evidence/`.

## Decisions

Intake decisions (from the issue description, adopted as given):

- `workbench.action.chat.open` must receive the command's `agent:` frontmatter as
  `mode`; built-in-agent commands pass `"agent"`.
- `docs/model-profiles.md` records that `commands/*.md` `model:` pins are no-ops for
  plugin commands.

Clarifying questions asked 2026-10-02; the user was unavailable ("The user is not
available to respond and will review your work later. Work autonomously and make
good decisions."), so the recommended option was taken for each and is recorded here
for review:

1. *Where should the extension get each command's agent name from?* — **Read
   `commands/<name>.md` frontmatter from the resolved plugin root** (the existing
   `resolvePluginRoot()` in `extension/src/modelProfiles.ts`: `agento.pluginRoot`,
   else the first enabled `chat.pluginLocations` entry). No second source of truth:
   the file VS Code itself loads in plugin mode is the file read. Alternatives
   rejected: extending the CLI (`session`/`next`) — the bundled CLI's `PLUGIN_ROOT`
   is `extension/`, which ships no `commands/`, so it would need `--plugin-root`
   plumbing on every call; a static map in the extension — a parallel truth that
   drifts.
2. *When the plugin root cannot be resolved or the command file has no `agent:`
   line, what should dispatch do?* — **Omit `mode` (today's behaviour) and write one
   line to the Agento output channel.** Passing `"agent"` blindly would send a
   planner command to the built-in agent with no way to tell; refusing to submit
   would make the dashboard unusable without a registered plugin.
3. *What exactly was observed?* — not answered; the Evidence section records the
   machine-captured behaviour (no `mode` on any submission) in place of the user's
   wording.
4. *Should `models apply` stop writing `model:` into the `commands/*.md` mirrors?*
   — **Docs only; keep the mirrors byte-identical to the prompt.**
   `tests/customizations.test.mjs` requires `commands/<name>.md` to equal
   `.github/prompts/<name>.prompt.md`, and `models apply` relies on that to rewrite
   both; changing the CLI is out of scope for this fix.

## Research

Skills consulted: none — no matching domain (the repository has no
`.agents/skills/` directory and AGENTS.md carries no `## Agento` skills table).

VS Code source (fetched 2026-10-02 from `microsoft/vscode` `main`):

- `src/vs/workbench/contrib/chat/browser/actions/chatActions.ts` —
  `IChatViewOpenOptions.mode?: ChatModeKind | string` ("The mode ID or name to open
  the chat in"). `OpenChatGlobalAction.run` resolves it with
  `chatWidget.input.currentChatModesObs.get().findModeByName(opts.mode)` and calls
  `handleSwitchToMode` *before* `setInput(opts.query)` / `acceptInput()`, so the
  agent (and, through the mode switch, its `model:`) is in place when the request is
  sent. VS Code's own `GenerateInstructionsAction` and friends pass
  `{ mode: 'agent', query: '/init' }`.
- `src/vs/workbench/contrib/chat/common/chatModes.ts` — `findModeByName(name)`
  matches built-in modes by `name` (a `BuiltinChatMode`'s `name` is its kind:
  `agent`, `ask`, `edit`) and custom modes by `name` **or** `id`. A custom agent's
  name is its `name:` frontmatter, so `"📋 Agento Planner"` resolves. An unknown
  name yields `undefined` and the current mode is kept — a wrong value degrades to
  today's behaviour rather than failing.
- `src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts` —
  `_applyPromptFileIfSet` → `_applyPromptMetadata` switches agent from a prompt
  file's `agent:` only when the parsed input carries a `ChatRequestSlashPromptPart`;
  the dashboard's submissions evidently do not take that path (Evidence), which is
  why passing `mode` explicitly is required.

Codebase findings:

- **Call sites.** `extension/src/commandDispatcher.ts`: `dispatchCommandToTarget`
  (line 33, current-window target), `dispatchCommandAction` (line 66, `submit`
  route), `consumePendingCommands` (line 101, pending command consumed on
  activation/focus). All three pass `{ query }` only. `CommandDispatcherDependencies`
  (lines 15–24) is the injection seam; `extension.ts` wires it at lines 251–270
  (`dispatchAction`), 281–291 (`productionNewPlanDependencies.submitCommand`), and
  501 (`consumePending`).
- **Command → agent mapping.** `commands/<name>.md` frontmatter `agent:` is the
  truth in plugin mode (`.claude-plugin/plugin.json` points `commands` there). Today:
  `ap` → `🤖 Agento Autopilot`; `build-feature`, `build-issue` → `🔨 Agento
  Builder`; `new-feature`, `new-issue` → `📋 Agento Planner`; `new-initiative` →
  `🏛️ Agento Architect`; `review-feature`, `review-issue` → `🔍 Agento Reviewer`;
  `extend-copilot`, `fix-copilot` → `🛠️ Agento Mechanic`; `commit-current-changes`,
  `continue`, `delivery-status`, `doctor`, `finish-freehand`, `models`,
  `next-feature`, `quick-fix`, `ship`, `start-freehand`, `triage-followups` →
  `agent`; `agento-init`, `close-session`, `install-skills`, `start-session` carry
  no `agent:` line (built-in agent by default). `scripts/agento.mjs` `dispatchFor`
  (line 1076) already reads the same field with
  `/^agent:\s*"([^"\n]+)"/m` for `/agento continue`.
- **Plugin root resolution.** `extension/src/modelProfiles.ts` `resolvePluginRoot`
  (line 44) takes `{ configured, pluginLocations, homedir, exists, readJson }` and
  returns the clone whose `.claude-plugin/plugin.json` is named `agento`, or `null`;
  `extension.ts` exposes it as the `pluginRoot()` closure (line 100).
  `frontmatterField` in `scripts/model-profiles.mjs` (also bundled as
  `extension/cli/model-profiles.mjs`) parses a quoted frontmatter scalar, but the
  extension's TypeScript sources do not import from `cli/`; a small TS helper is the
  consistent choice.
- **Command text shape.** `extension/src/commandActions.ts`
  `isCanonicalAgentoCommand` enforces `/^\/agento [a-z][a-z-]*(?: [^\r\n]+)?$/`, so
  the command name is always the second whitespace-separated token.
- **Tests asserting today's shape.** `extension/test/unit/commandDispatcher.test.ts`
  — "submits in-window commands to Chat without forcing a mode" (line 40) asserts
  `[["workbench.action.chat.open", { query }]]`; `consumePendingCommands` test (line
  ~105) likewise. `extension/test/electron/suite.ts` lines 267, 435–436, 455–456
  assert `options: { query: … }` by `deepEqual`; the electron fixture has no plugin
  root, so with the chosen fallback those stay valid, but a unit test must cover the
  positive path with a fake file reader.
- **Docs.** `docs/extension.md` "Command routing" (line 76) says current-window
  actions "open Copilot Chat in agent mode with the exact canonical … query";
  `docs/model-profiles.md` "Resolution" table (lines 56–61) and the sentence "Each
  prompt's plugin-mode mirror `commands/<name>.md` receives the same bytes as the
  prompt" (line 63) are where the no-op note belongs. `CHANGELOG.md` top section is
  `## 0.7.0 (2026-10-02)`; this fix adds a new `## Unreleased` **Fixed** entry (no
  version bump in scope).
- **Open delivery branches:** `gh pr list --state open` is empty in both `agento`
  and `agento-docs` — no concurrent-delivery overlap.

Lint baseline (policy §5), run 2026-10-02 at `a90fc9a`:

- Shell lint: `shellcheck` is not on PATH (exit 127); run as
  `git ls-files '*.sh' | xargs pnpm dlx shellcheck` over
  `scripts/hooks/delivery-guard.sh scripts/hooks/replay-guard.sh
  scripts/hooks/session-context.sh scripts/wait-for-checks.sh` — exit 0, no
  findings.
- Tests: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` — exit 0,
  259 tests, 259 pass.
- Extension: `cd extension && npm ci && npm run typecheck` — exit 0.

Overlap decision: the baseline is green, so the **full gate** applies — the final
full shellcheck run, the full node test suite, the extension typecheck, and the
extension unit tests must all be green; no scoped gate is needed. This delivery
changes no shell files.

## Approach

**Extension (`extension/src/`).**

- New pure module `extension/src/commandAgent.ts`:
  - `commandName(command: string): string | null` — the `<name>` of a canonical
    `/agento <name> …` string (reuse `isCanonicalAgentoCommand`), else `null`.
  - `readCommandAgent(text: string): string | null` — the `agent:` frontmatter
    scalar of a `commands/<name>.md` body (quoted or bare), `null` when the file has
    no frontmatter or no `agent:` line.
  - `resolveChatMode(command, { pluginRoot, readFile })`:
    `{ mode: string } | { mode: null; reason: string }` — `pluginRoot === null` →
    reason `no plugin root`; file unreadable → reason naming the path; `agent:`
    absent or `"agent"` → `"agent"` (built-in commands are dispatched explicitly to
    the built-in agent, per intake); any other value → that name verbatim.
- `commandDispatcher.ts`: add `chatMode: (command: string) => { mode: string } |
  { mode: null; reason: string }` to `CommandDispatcherDependencies` (and to the
  `Pick<…>` of `dispatchCommandToTarget` / `consumePendingCommands`). One helper
  `chatOpenOptions(command)` builds `{ query, mode }` when a mode resolves and
  `{ query }` plus an output-channel line
  (`dispatch: no mode for <command>: <reason>`) otherwise; all three call sites use
  it so the shape cannot drift again.
- `extension.ts`: build the production `chatMode` once from `pluginRoot()` and
  `fs.readFileSync`, pass it in `dispatchAction`, `productionNewPlanDependencies`,
  and `consumePending`.

**Tests.**

- `extension/test/unit/commandAgent.test.ts` (new) — name extraction, quoted/bare
  `agent:`, missing frontmatter, built-in default, unreadable file.
- `extension/test/unit/commandDispatcher.test.ts` — the exposing regression test
  (issue #73, slug `dashboard-dispatch-agent-mode` in its name) asserts that each of
  the three paths submits `{ query, mode: "📋 Agento Planner" }` for a planner
  command and `{ query, mode: "agent" }` for `/agento delivery-status`; it fails on
  the current code (`mode` absent). The existing "without forcing a mode" test is
  rewritten to cover the fallback (`chatMode` returns `{ mode: null, reason }` →
  `{ query }` and one output line).
- `extension/test/electron/suite.ts` — the `deepEqual` assertions stay as they are
  (fixture has no plugin root → fallback) and gain a comment saying so.

**Docs and changelog.**

- `docs/extension.md` "Command routing": current-window actions open Chat **in the
  command's agent** (`mode` = the `agent:` of `commands/<name>.md`, `"agent"` for
  built-in-agent commands), falling back to the current agent with an output-channel
  line when no plugin clone is resolvable; the same applies to pending cross-window
  commands.
- `docs/model-profiles.md`: in "Resolution", note that a `model:` line in a
  `commands/*.md` mirror is a no-op for plugin commands — a command on a custom agent
  inherits that agent's `model:` through the dispatch's agent switch, and a
  `prompts.<name>` pin takes effect only where `.github/prompts/<name>.prompt.md`
  is loaded (workspace mode); the mirrors keep receiving the same bytes so `apply`
  and the byte-equality test are unchanged.
- `CHANGELOG.md`: new `## Unreleased` with one **Fixed** entry referencing #73.

**Pre-review verification (policy §2, local).** The Builder installs the built VSIX
in a window whose chat has a non-planner agent selected, dispatches a planner action
from the Deliveries tree, and captures the chat header showing the Planner agent
selected before the response starts (screenshot under `evidence/`); if the user has
a model profile applied, the picker shows the Planner's pinned model.

## Risks

- **Plugin root unresolved on some machines** (plugin installed from VSIX or a
  non-registered clone): dispatch keeps today's behaviour with an output line. The
  doc change tells users to set `agento.pluginRoot`. Mitigation: the fallback path is
  unit-tested and the log line names the fix.
- **Agent renamed without updating VS Code's cached modes:** `findModeByName`
  returns `undefined` and Chat keeps the current agent — identical to today, no
  crash. The name is read from the same file VS Code loads, so drift is limited to
  a VS Code cache lag.
- **`mode` switch confirmation dialog:** `handleSwitchToMode` can prompt when
  leaving Edit mode with undecided edits. Dashboard dispatch is a user-initiated
  action, so the prompt is appropriate; no automation depends on an unattended
  switch.
- **Claim that mirror `model:` pins are no-ops** comes from the issue intake, not
  from a test here; the doc wording attributes the effect to how plugin commands are
  loaded and the pre-review step observes the applied model in the picker.
- **Concurrent delivery:** no open PRs in either repository; integrate `origin/main`
  before every push as usual.

## Out of scope

- Changing `models apply` to skip the `commands/*.md` mirrors or otherwise altering
  the CLI's model-profile behaviour.
- Emitting the agent name from the CLI (`session`, `next`) or the SessionStart hook.
- Any change to how `/agento continue` or handoffs select agents inside chat.
- A version bump; the fix lands under `## Unreleased`.

## Acceptance checklist

- [ ] The exposing regression test in
      `extension/test/unit/commandDispatcher.test.ts` (named for issue #73 /
      `dashboard-dispatch-agent-mode`) fails before the fix and passes after it —
      verify: `cd extension && npm run test:unit` red at the test-adding step, green
      after the dispatcher change.
- [ ] Every `workbench.action.chat.open` call in `extension/src/commandDispatcher.ts`
      carries `mode` when the command's agent resolves — verify:
      `node evidence/repro-dispatch-mode.mjs` adapted with a `chatMode` dependency
      reports `0/3` missing (or the equivalent unit assertion), and `grep -n
      'chat.open' extension/src/commandDispatcher.ts` shows a single options builder.
- [ ] A planner command resolves to `mode: "📋 Agento Planner"`, a built-in-agent
      command (`delivery-status`) to `mode: "agent"`, and a command whose
      `commands/<name>.md` has no `agent:` line to `mode: "agent"` — verify: unit
      tests in `extension/test/unit/commandAgent.test.ts`.
- [ ] With no resolvable plugin root the dispatcher submits `{ query }` and writes
      one line to the output channel; `npm run test:electron` still passes —
      verify: fallback unit test and the electron run.
- [ ] `docs/extension.md` describes the agent-mode dispatch and its fallback;
      `docs/model-profiles.md` states that `commands/*.md` `model:` pins are no-ops
      for plugin commands — verify: `grep -n 'mode' docs/extension.md` and `grep -n
      'no-op' docs/model-profiles.md`; `node --test 'tests/**/*.test.mjs'` green.
- [ ] `CHANGELOG.md` has an `## Unreleased` **Fixed** entry referencing #73 — verify:
      `grep -n '#73' CHANGELOG.md`.
- [ ] Pre-review local verification: dispatching a planner action from the
      Deliveries tree in a window whose chat had another agent selected switches
      the chat to `📋 Agento Planner` before submitting — verify: screenshot
      `evidence/step-3-2-planner-mode.png`.
- [ ] Full gate (policy §5): `git ls-files '*.sh' | xargs pnpm dlx shellcheck`
      exit 0; `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` all
      pass; `cd extension && npm run typecheck && npm run test:unit` exit 0 —
      verify: recorded exit statuses in roadmap step 4.1.
