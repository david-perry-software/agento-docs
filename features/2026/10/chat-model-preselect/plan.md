# Chat model preselect: extension-dispatched commands open on the window role's model

## Problem

Commands the Agento extension dispatches into chat (dashboard and Session & Doctor
actions, the pending cross-window `/agento continue <slug>`, New Plan, the plan-member
play button, and the start-session **Open in chat** fallback) all go through one
function, `chatOpenOptions` in `extension/src/commandDispatcher.ts`. It calls
`workbench.action.chat.open` with `{ query, mode, attachFiles }` and no model. The
chat therefore runs on whatever model the picker happens to show:

- In a **Copilot** session, a directly selected agent ignores its `model:` pin and
  runs on the session's model (`docs/copilot-harness.md` "Agents and models",
  `finding: picker-rejected`). Primary windows lose their file pins as well.
- In a **secondary** window (plan, build, freehand), the role's own profile from
  `role-active-profiles` reaches only router and Autopilot subagents (`models pins`).
  An inline command still reads the clone's file pins, which are the primary's models
  (`docs/model-profiles.md` "Subagents and handoffs", last paragraph).

This feature makes every extension dispatch open on the model the current window
role's profile assigns to that command or its agent. It uses `chat.open`'s
`modelSelector` wherever a harness honors it. Where a harness ignores it, the
feature ships a documented finding and a banner hint instead.

It is the `chat-model-preselect` member of the `model-profile-manager` initiative
([breakdown](../../../../initiatives/2026/10/model-profile-manager/breakdown.md), block
`### chat-model-preselect`). Its requirement `role-active-profiles` is complete, and
so is its recommended predecessor `role-profile-sidebar`.

## Decisions

The ask-questions tool is not available in this Copilot session, so the Planner asked
these on 2026-10-22 as a numbered list in chat (the §10 fallback). The user answered
"go with what you recommend". Every answer is therefore the recommended option, and
the option text is quoted verbatim below.

- **Q1: Which model should a dispatch preselect?** A: `a` — "A new `models resolve
  <command> [--role]` verb that applies the existing Resolution table for the
  window's role: a custom-agent command gets its agent's pin (first entry of a
  list); a built-in-agent command gets `prompts.<name>`, else `default`. Nothing
  resolved → no `modelSelector`, the session model stays. Reason: one rule, the same
  one `apply` uses." (recommended)
- **Q2: Primary windows too, or only secondary?** A: `a` — "Both roles. Primary
  resolves from the clone's file pins (including `custom`); secondary from the
  assigned profile, or the file pins when the role is off — exactly `models pins`'
  semantics. This also fixes primary windows in Copilot sessions, where pins are
  ignored." (recommended)
- **Q3: When the model can't be selected (no `vscode.lm` match, `chat.open` throws,
  CLI error)?** A: `a` — "Retry the same dispatch without `modelSelector` (the command
  always submits), and write one `dispatch: no model for <command>: <reason>` line to
  the Agento output channel, matching the existing `no mode` / `no command file`
  lines. No notification." (recommended)
- **Q4: How does the probe's result shape the feature?** A: `a` — "Per harness: ship
  `modelSelector` wherever the probe shows it works; for a harness that ignores it,
  record the finding in `docs/model-profiles.md` 'Subagents and handoffs' and
  `docs/copilot-harness.md`, and add a banner hint naming the model to pick by hand.
  If it works nowhere, ship only the finding and the hint." (recommended)
- **Q5: How is it verified before review?** A: `a` — "CLI tests for `models
  resolve`; unit tests for the qualified-name → selector mapping and the dispatcher
  (fake `executeCommand`, including the retry); an electron test that `chat.open`
  receives `modelSelector`; the probe itself is a `(manual)` step (I launch the probe
  dev extension, you click each variant in a Copilot and a Local chat and screenshot
  the model picker), plus one final `(manual)` live dashboard dispatch in each
  harness." (recommended)

Inherited from the initiative (breakdown `## Decisions`) and `role-active-profiles`:

- There are two role buckets only: primary, and secondary (plan, build, and freehand
  share one).
- Primary means the clone's file pins.
- When the secondary role is off, secondary windows use the file pins.
- `unmanaged` windows count as primary.
- Changing VS Code or the Copilot harness itself is out of scope. Only the
  extension-dispatch workaround is in scope (follow-up (a)).

- **Q6 (added 2026-10-22): How should preselection ship?** A: `6a` — the user
  answered verbatim `6a`, which is the recommended option (the Autopilot asked Q6
  as a numbered question in chat on 2026-10-22 ~20:04, answered 20:05, because the
  phase 1 probe showed the extension cannot detect which harness a dispatch lands
  in — see the harness-detection finding in
  `evidence/step-1-2-model-matrix.md`). The option text, verbatim:
  "a. (recommended) Opt-in setting. `agento.chatModelPreselect` is `off` by
  default, or `local` / `copilot`. You set it to the harness you dispatch into.
  `local` sends `{ vendor, id }` and `copilot` sends `{ id: <Copilot id> }`, the
  two selectors the probe proved. When it's `off` (or for a harness you don't set),
  the banner tooltip and a log line name the model to pick by hand. A wrong setting
  has the side effects above, and the docs say so. Reason: it's the only option
  that actually automates the Copilot workaround, and nothing changes unless you
  turn it on."
  Other options offered: b. Hint only; c. Always on for Local.

## Research

Skills consulted: none — no matching domain. The repository has no `.agents/skills/`
directory, and its AGENTS.md has no skills table. Verified 2026-10-22 on `main`
`b0968ed`.

**Upstream `workbench.action.chat.open`.** Source:
`src/vs/workbench/contrib/chat/browser/actions/chatActions.ts` on microsoft/vscode
`main`, fetched 2026-10-22.

- `IChatViewOpenOptions.modelSelector?: ILanguageModelChatSelector`. `run()` handles
  it in this order:
  1. Switch the mode with `findModeByName(opts.mode)`.
  2. If `modelSelector` is set, call `languageModelService.selectLanguageModels(selector)`
     and take the first id after sorting. When nothing matches, it **throws**
     ``No language models found matching selector: …``, and it throws
     `Language model not loaded: <id>` when the id has no loaded model.
  3. Call `chatWidget.input.setCurrentLanguageModel({ metadata, identifier }, true)`.
  4. Handle tools, attachments, and the query.

  The model is therefore applied **after** the mode switch. In Local, a custom
  agent's `model:` pin applies on mode selection, and the selector then overrides it.
- `ILanguageModelChatSelector` is `{ name?, id?, vendor?, version?, family?, tokens?,
  extension? }`. Upstream `selectLanguageModels` (`common/languageModels.ts`) matches
  only `vendor`, `family`, `version`, and `id`. **`name` is ignored**, so a selector
  built from a picker name alone would match every model. The extension must
  therefore map a qualified `<name> (<vendor>)` value to `{ vendor, id }` through
  `vscode.lm.selectChatModels({ vendor })` before dispatching.
- Whether the Agent Host (Copilot) session's input honors `setCurrentLanguageModel`
  cannot be settled from source. Phase 1 measures it on the installed VS Code
  `1.142.0` (commit `6d62b1d`), with the extension `agento-dashboard@0.8.0`
  installed.

**Agento surfaces** (code, `main` `b0968ed`):

- `extension/src/commandDispatcher.ts` `chatOpenOptions` (L38–L61) is the only
  `workbench.action.chat.open` call. It is reached from:
  - `dispatchCommandToTarget` for the current window (L71);
  - `dispatchCommandAction` for **Open in chat** (L109) and plain submits (L121);
  - `consumePendingCommands` for pending cross-window commands (L156).

  Changing this one function covers every dispatch. A pending command is consumed
  in the *target* window, so it resolves that window's role.
- `extension/src/commandAgent.ts` holds `commandName`, `resolveChatMode`, and
  `resolveCommandFile`. `extension/src/extension.ts` L291–L302 wires `chatMode` and
  `commandFile` from `pluginRoot()`.
- `extension/src/modelProfilesTree.ts` L129 `windowProfileRole(sessionRole)` maps
  `plan`/`build`/`freehand` to `secondary` and everything else to `primary`. The
  extension keeps the latest session role (`currentWindowRole()`, used by
  `runRoleSelection` around `extension.ts` L716).
- The extension runs the CLI with the plugin root as its cwd (`client.run(args,
  root)`, `runModelsAction` around L710). The CLI's own `currentWindowRole()`
  (`scripts/agento.mjs` L3889) derives the role from the cwd, so it would see the
  plugin clone rather than the workspace window. The dispatch must therefore pass
  `--role` explicitly.
- `extension/src/profileEditorModel.ts` L111–L141 already maps `vscode.lm` entries to
  `{ id, name, vendor, label: "<name> (<vendor>)" }` and derives `copilotModels`
  aliases. `extension/src/profileEditorPanel.ts` L62 calls
  `vscode.lm.selectChatModels()`. `ExtensionApi.setProfileEditorModelSource`
  (`extension.ts` L74–L99) is the existing test hook pattern for injecting a model
  list in electron tests.
- `scripts/agento.mjs`:
  - `models pins` (L5068–L5096) holds the role defaulting (`options.role ??
    roleBucket(currentWindowRole())`), the secondary-profile lookup, and the
    dangling/invalid fallbacks with warnings.
  - `rolePins` (L3903) and `modelsPins` (L3928) resolve **agents only**.
  - `resolveProfile` (L3764) returns targets for every agent, prompt, and mirror.
    `resolveTargets` (`scripts/model-profiles.mjs` L264–L300) writes a custom-agent
    prompt's target as its agent's value and a built-in prompt's as `prompts.<name>`,
    else `default`. The prompt file's target value is therefore the complete
    Resolution-table answer for that command.
  - `modelsState().current` (L3783) holds every file's current `model:` value, which
    is the primary role's answer, including `custom` pins.
  - `vendorOf` (`scripts/model-profiles.mjs`, used by `unqualifiedWarning` L542)
    parses the `(vendor)` suffix.
- Dispatch-payload assertions that must keep passing: `extension/test/unit/commandDispatcher.test.ts`
  L117, L131, L138–L173, L238; `planPlayButtonHandoff.test.ts` L92–L128;
  `newInitiativeFlow.test.ts` L152; `extension/test/electron/suite.ts` L439, L1306,
  L1351.
- `tests/harness-probe/dispatch-probe/` (`extension.js`, `variants.js`,
  `package.json`) and `tests/harness-probe/dispatch-probe.test.mjs` are the
  dependency-free probe extension from `dispatch-copilot-harness`. Its V1 payload
  equals today's `chatOpenOptions` payload and submits in both harnesses
  (`docs/copilot-harness.md` "Dispatch"). The model probe extends this extension.
- Docs that describe the behavior:
  - `docs/model-profiles.md`: "Resolution", "Applying and clearing" (the verb list),
    "Window roles", "Subagents and handoffs" (L354–L391; the last paragraph names
    this member), and "Limits";
  - `docs/extension.md` "Command routing" (L218–L289);
  - `docs/copilot-harness.md` "Dispatch" (L371);
  - `extension/README.md`;
  - the `/agento models` command (`.github/prompts/models.prompt.md`, mirrored byte
    for byte in `skills/agento/commands/models.md`);
  - the `README.md` command table (L443);
  - the usage comment at `scripts/agento.mjs` L32;
  - `CHANGELOG.md`, whose last released section is `0.13.0`.
- `extension/cli/` is a generated byte copy of `scripts/`, refreshed with `npm run
  copy-cli`.

**Lint baseline (policy §5).** The full-repository lint is `shellcheck
scripts/hooks/*.sh scripts/wait-for-checks.sh` (AGENTS.md). On 2026-10-22 at `main`
`b0968ed` it ran with the ShellCheck 0.10.0 release binary
`/tmp/shellcheck-v0.10.0/shellcheck`: **exit 0, zero findings**. CI `ci` run
`39838857039` on `b0968ed` concluded `success`.

Other baselines, recorded 2026-10-22 on `b0968ed`:

- `cd extension && npm ci`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run test:unit`: exit 0, 215 of 215 pass.
- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`: exit 0, 641 of 641
  pass (~331 s).

**Overlap decision:** none. The baseline is green, and this delivery touches no shell
script, so no lint cleanup is in scope. The gate is:

- a full-repository Shellcheck rerun compared against the zero-finding baseline;
- the extension build, typecheck, unit, and electron tests, plus packaging;
- the full node suite and every guard replay listed in AGENTS.md.

**Concurrent deliveries.** `gh pr list --state open` returned `[]` for both
`david-perry-software/agento` and `david-perry-software/agento-docs` on 2026-10-22,
so no file overlaps another delivery.

## Approach

1. **Probe first (phase 1).** Extend `tests/harness-probe/dispatch-probe/` with a
   second command, *Agento Probe: Dispatch with model*.
   - At runtime it lists `vscode.lm.selectChatModels()` (logged with `id`, `name`,
     `vendor`, `family`, `version`) and asks for a target model. Pick one that
     differs from the picker's current model.
   - It also logs every command id matching `/chat.*model/i` from
     `vscode.commands.getCommands(true)`.
   - It then runs one variant from a pure `model-variants.js`:
     - **M1** — V1 + `modelSelector: { vendor, id }`.
     - **M2** — V1 + `modelSelector: { vendor, family }`.
     - **M3** — V1 + `modelSelector: { id: <Copilot task id> }`, for a Copilot
       model: its bare `id`.
     - **M4** — M1 with `mode: "📋 Agento Planner"`, a custom agent, which checks that
       the selector wins over the agent pin applied by the mode switch.
     - **M5** — the first discovered model-change command, run with `{ vendor, id }`,
       followed by V1. It is skipped and recorded as `n/a` when no such command
       exists.

   The query is `/agento delivery-status`. A variant **works** in a harness when, in
   a new chat, the model picker and the reply footer both show the target model.
   **Selection rule:** for each harness, the first working variant in order M1–M5 is
   chosen. M1 is preferred whenever it works in both harnesses. The result goes into
   `docs/copilot-harness.md` "Dispatch" (a new "Model preselection" paragraph) and
   into this plan's `## Decisions` as an `(added <date>)` entry, together with which
   harnesses get the mechanism and which get the hint.
2. **CLI `models resolve <command> [--role primary|secondary]`** (`scripts/agento.mjs`
   `models` block, next to `pins`). It is a read verb and writes nothing.
   - The role defaults exactly as for `pins`: `--role` wins (`roleSource: "flag"`),
     else `roleBucket(currentWindowRole())`. Factor the secondary-profile lookup out
     of `pins` into one helper so the two verbs cannot drift. The helper returns
     `{ profile, source, warnings, resolved }` (the dangling/invalid fallback with
     the same warning text).
   - The command must be the name of a `.github/prompts/<command>.prompt.md` in the
     layout. An unknown name returns `status: "not-found"` with `known[]` and exits 3.
   - The value comes from:
     - **secondary with a valid profile:** the profile's resolved target for
       `.github/prompts/<command>.prompt.md` (`source: "role-profile"`);
     - **otherwise:** the file's current `model:` value, `state.current[file]`
       (`source: "file-pins"`).
   - The output, plus `modelsReport(...)`:

     ```
     { status: "ok", verb: "resolve", command, agent, role, roleSource, windowRole,
       profile, source, model, qualified, name, vendor, copilotModel, warnings }
     ```

     - `agent` is the command's `agent:` value, or `null`.
     - `model` is the raw value: a string, a list, or `null`.
     - `qualified` is the string, or the list's first entry, or `null`.
     - `name` and `vendor` are split from the `<name> (<vendor>)` suffix with
       `vendorOf`. `vendor` is `null` for an unqualified value.
     - `copilotModel` is `copilotModels[qualified] ?? null`.

     An unpinned command is `status: "ok"` with all model fields `null`.
   - Add a pure `splitQualified(value)` export to `scripts/model-profiles.mjs`
     (returns `{ name, vendor }`) with unit tests.
   - Then update the usage comment (L32), the `/agento models` prompt and its mirror,
     and the README command table. Run `npm run copy-cli`.
3. **Pure extension model logic.** Add a new `extension/src/chatModel.ts`, with no
   `vscode` import:
   - `parseResolveResult(json)` → `{ qualified, name, vendor, copilotModel } |
     { qualified: null; reason }`. The reason for an unpinned command is `no pin for
     <command> in the <role> role`. A `not-found`, invalid, or unparseable result
     yields its message.
   - `selectorFor(resolved, models)`, where `models` is `[{ id, name, vendor,
     family, version }]`, returns `{ selector: { vendor, id } } | { selector: null;
     reason }`:
     - **Qualified value:** exact `vendor` + `name` match.
     - **Unqualified value:** a unique `name` match across vendors. An ambiguous match
       is a reason, not a guess.
     - **No match:** when `copilotModel` is set, a `vendor: "copilot"` model whose
       `id` equals it.
     - **Otherwise:** `no installed model matches <qualified>`.

     Phase 1's chosen variant fixes the selector shape. M1 → `{ vendor, id }`; M2 →
     `{ vendor, family }`; M3 → `{ id }`.
4. **Dispatcher.** `chatOpenOptions` gains a `chatModel: ChatModelResolver`
   dependency, `(command) => Promise<{ selector } | { selector: null; reason }>`.
   - It awaits the resolver and sets `options.modelSelector` when a selector came
     back.
   - When no selector came back, it writes `dispatch: no model for <command>:
     <reason>` and dispatches without one.
   - When `chat.open` throws **with** a selector set, it writes `dispatch: no model
     for <command>: <error message>` and retries once with the same options minus
     `modelSelector`. A throw without a selector propagates as today.
   - A resolver that rejects counts as a reason. The command always submits.
   - Every caller (`dispatchCommandToTarget`, `dispatchCommandAction`,
     `consumePendingCommands`) passes the dependency through. Existing tests use a
     default fake resolver that returns `{ selector: null, reason }`, so their
     payload assertions stay unchanged.
5. **Wiring** (`extension/src/extension.ts`). The real resolver:
   1. reads `commandName(command)`;
   2. returns a reason when `pluginRoot()` is `null`;
   3. runs `client.run(["models", "resolve", <name>, "--role",
      windowProfileRole(currentWindowRole()), "--plugin-root", root], root)`, bounded
      at 5 s (a timeout is a reason);
   4. reads `vscode.lm.selectChatModels(vendor ? { vendor } : undefined)`;
   5. returns `selectorFor(...)`.

   A new `ExtensionApi.setChatModelSource(source?)` test hook replaces the
   `vscode.lm` read in electron tests, following `setProfileEditorModelSource`.
6. **Harnesses that ignore preselection (conditional on phase 1, Q4).** For each
   harness the probe marks as ignoring the selector:
   - The window banner's tooltip gains one line: `Model preselection is not applied
     in <harness> sessions — set the model picker by hand (agento.mjs models resolve
     <command> names it)`. It is built in the pure `extension/src/windowBanner.ts`
     model and unit-tested.
   - `docs/model-profiles.md` "Subagents and handoffs" and
     `docs/copilot-harness.md` "Dispatch" record the finding.

   When neither harness honors it, phase 3's dispatcher change still ships, because
   its fallback makes it a harmless no-op that keeps the logs, and the hint covers
   both harnesses. The Builder records that outcome in `## Decisions`.
7. **Docs and release.**
   - `docs/model-profiles.md`: add `resolve` to the "Applying and clearing" verb
     list, replace the last paragraph of "Subagents and handoffs" with the shipped
     behavior per harness, and update "Window roles" and "Limits".
   - `docs/extension.md` "Command routing": document the `{ query, mode,
     attachFiles, modelSelector }` contract, the role used, and the fallback log
     line.
   - `extension/README.md`: describe the behavior.
   - Bump the version to `0.14.0` in `.claude-plugin/plugin.json`, `package.json`,
     `extension/package.json`, and `extension/package-lock.json`, and add a `##
     0.14.0 (unreleased)` CHANGELOG entry.

**(added 2026-10-22)** Q6 replaces the per-harness selector rule in items 3–6 with
an opt-in setting `agento.chatModelPreselect` (`off` default | `local` | `copilot`),
because the phase 1 probe showed the extension cannot detect which harness a
dispatch lands in (`evidence/step-1-2-model-matrix.md` "Harness-detection
finding"). The setting is contributed in `extension/package.json`
`contributes.configuration` and read with
`vscode.workspace.getConfiguration("agento")`. `local` sends `{ vendor, id }` from
an exact `vscode.lm` vendor+name match (unique-unqualified and no-match rules from
`selectorFor` unchanged; the `copilotModels` fallback is not used for `local`);
`copilot` sends `{ id: <copilotModel> }` with no `vscode.lm` lookup (a null
`copilotModel` is a reason naming `agento.mjs models alias set <picker> <id>`);
`off` sends no selector, logs `dispatch: model for <command>: <qualified> (Copilot
id <copilotModel|none>) — preselection off; set it in the model picker`, and the
banner tooltip names the setting and `agento.mjs models resolve <command>`. The Q3
behavior is unchanged: no selector → log `dispatch: no model for <command>:
<reason>` and dispatch; a `chat.open` throw with a selector → log and retry once
without it.

Affected files:

- `scripts/agento.mjs`
- `scripts/model-profiles.mjs`
- `scripts/agento.test.mjs` and `scripts/model-profiles.test.mjs`
- `extension/cli/*` (generated)
- `extension/src/chatModel.ts` (new)
- `extension/src/commandDispatcher.ts`
- `extension/src/extension.ts`
- `extension/src/windowBanner.ts` (conditional)
- `extension/test/unit/chatModel.test.ts` (new)
- `extension/test/unit/commandDispatcher.test.ts`
- `extension/test/unit/windowBanner.test.ts` (conditional)
- `extension/test/electron/suite.ts`
- `tests/harness-probe/dispatch-probe/*`
- `tests/harness-probe/dispatch-probe.test.mjs`
- `.github/prompts/models.prompt.md` and `skills/agento/commands/models.md`
- the docs listed in item 7, and the version files

## Risks

- **`chat.open` throws when the selector matches nothing**, for example a BYOK
  provider that is not activated or a renamed model. Mitigation: the dispatcher
  retries without `modelSelector` and logs the reason (Q3), so a command never fails
  to submit because of preselection. Unit tests and an electron test cover it.
- **The Copilot (Agent Host) input may ignore `setCurrentLanguageModel`.**
  Mitigation: the phase 1 probe measures it on the installed build before any
  extension code changes. Q4 then limits the mechanism to the harnesses where it
  works and adds the banner hint and documented finding elsewhere.
- **The mode switch could reapply a custom agent's pin after the selector.** Upstream
  order says the selector runs second. Probe variant M4 checks this; if the agent
  pin wins, the finding is recorded and that harness gets the hint.
- **Picker names do not map one-to-one to `vscode.lm` ids,** for example duplicate
  names across vendors, or unqualified values. Mitigation: `selectorFor` requires an
  exact `vendor` + `name` match or a unique unqualified match, then falls back to the
  `copilotModels` id. An ambiguous or missing match is a logged reason, never a
  guess.
- **Dispatch latency** from a CLI spawn plus the `vscode.lm` query. Mitigation: the
  resolver is bounded at 5 s and falls back. Typical cost is one `models` CLI call,
  the same as the Model Profiles view.
- **Wrong role.** The CLI's cwd is the plugin clone, not the window. Mitigation: the
  extension always passes `--role` from the session record through
  `windowProfileRole`. A unit test asserts the args.
- **Generated-copy drift** (`extension/cli/`). Mitigation: `npm run copy-cli` after
  every `scripts/` change, plus the existing byte-equality tests.
- **Concurrent deliveries:** none open on 2026-10-22. Integrate `origin/main` by
  merge before every push regardless.
- **Mismatched-setting and remembered-model side effects (added 2026-10-22).** A
  `local` setting in a Copilot session falls back to Auto and the agent-host
  session persists a pending remembered model for later Copilot chats (probe M1);
  a `copilot` setting in a Local session makes the request fail in chat with "The
  selected model 'agent-host-copilotcli:<id>' is not available" and `chat.open`
  does not throw (probe M3), so the throw-based retry cannot catch it. A successful
  preselection is itself remembered by VS Code for later new chats of that session
  type (`persistSelection=true`). Mitigation: the setting defaults to `off` (no
  selector — a banner hint and a `dispatch: model for …` log line name the model to
  pick by hand), the docs state each value's side effects, and the banner hint names
  the setting so a mismatched value is discoverable.

No `(manual, post-ship)` exception is planned. Both harnesses run locally on this
machine.

## Out of scope

- Changing VS Code or the Copilot harness, or making directly selected agents honor
  their `model:` pin.
- Preselecting a model for chats the user opens or types by hand, and for handoff
  buttons. Handoff buttons already carry nested pins (`docs/model-profiles.md`
  "Subagents and handoffs").
- Per-plan, per-build, or per-freehand buckets, or per-worktree profiles (initiative
  follow-up (b)).
- New profile fields, and changes to `copilotModels` resolution or the pin filter.
- Changing which model subagents get. `models pins` and the router/Autopilot dispatch
  are unchanged.

## Acceptance checklist

- [ ] The probe matrix (M1–M5 × Local/Copilot on the recorded VS Code build) is
  saved under this slug's `evidence/` with screenshots of the model picker and reply
  footer. `docs/copilot-harness.md` "Dispatch" names the chosen variant per harness,
  or the ignoring harness. Verified by the evidence files and `grep -n
  "chat-model-preselect" docs/copilot-harness.md`.
- [ ] `agento.mjs models resolve <command> [--role primary|secondary]` returns the
  Resolution-table model for the role:
  - a custom-agent command → the agent's pin, first entry of a list;
  - a built-in command → `prompts.<name>`, else `default`;
  - secondary with a profile → that profile;
  - secondary off, dangling, or invalid → the file pins, with a warning for the last
    two;
  - unpinned → `null` fields;
  - unknown command → `not-found`, exit 3.

  It writes no file. Verified by new tests in `scripts/agento.test.mjs` against a
  temp `AGENTO_CONFIG_HOME` and a temp plugin clone, and by `splitQualified` tests in
  `scripts/model-profiles.test.mjs`.
- [ ] `models pins` and `models resolve` share one role-lookup helper, and every
  existing `models pins` test still passes. Verified by `node --test
  scripts/agento.test.mjs`.
- [ ] `selectorFor` maps a qualified value to the exact `vendor` + `name` model,
  maps a unique unqualified name, falls back to the `copilotModels` id, and returns a
  reason for ambiguous or missing matches. Verified by
  `extension/test/unit/chatModel.test.ts`.
- [ ] The dispatcher adds `modelSelector` when the resolver returns one. Without one,
  it dispatches and logs `dispatch: no model for <command>: <reason>`. A `chat.open`
  that throws with a selector is retried once without it and logged, and every
  existing payload assertion is unchanged. Verified by
  `extension/test/unit/commandDispatcher.test.ts`.
- [ ] The real resolver passes `--role` from the window's session role
  (`plan`/`build`/`freehand` → `secondary`, otherwise `primary`) and falls back on
  timeout, a missing plugin root, or a CLI error. Verified by unit tests of the
  resolver factory and the electron test.
- [ ] In the electron host, a dashboard dispatch with an injected model list calls
  `workbench.action.chat.open` with the expected `modelSelector`. With no matching
  model, it calls it without one and logs the reason. Verified by `cd extension &&
  DISPLAY=:0 npm run test:electron`.
- [ ] For every harness the probe marked as honoring the selector, a live dashboard
  dispatch in a secondary window with a secondary profile assigned opens on that
  profile's model for the command. For every ignoring harness, the banner tooltip
  shows the hint. Verified by the `(manual)` live-dispatch screenshots under
  `evidence/` and, for the hint, by `extension/test/unit/windowBanner.test.ts`.
- [ ] The docs describe the shipped behavior: `docs/model-profiles.md`
  ("Applying and clearing", "Window roles", "Subagents and handoffs", "Limits"),
  `docs/extension.md` "Command routing", `docs/copilot-harness.md` "Dispatch",
  `extension/README.md`, `README.md`, the `/agento models` prompt and its
  byte-identical mirror, and a `## 0.14.0 (unreleased)` CHANGELOG entry. Verified by
  `node --test tests/*.test.mjs` (customizations and mirror equality) and by reading
  the docs.
- [ ] Lint gate (§5, overlap: none):
  - a full-repository `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`
    rerun exits 0 with zero findings, matching the baseline;
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` passes at least 641
    tests plus the new ones;
  - every guard replay listed in AGENTS.md passes;
  - the extension `npm ci && npm run build && npm run typecheck && npm run
    test:unit` passes at least 215 tests plus the new ones;
  - `test:electron` passes;
  - `npm run package` produces `agento-dashboard-0.14.0.vsix`.

  Verified by the final gate step's recorded counts.
