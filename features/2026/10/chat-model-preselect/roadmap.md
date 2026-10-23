```yaml
status: in-progress
branch: feature/chat-model-preselect
last-updated: 2026-10-22
next-step: "3.10 Electron test covering local, copilot, and off"
initiative: "model-profile-manager"
artifact-pr: "#66"
```

## Phase 1: Probe

- [x] 1.1 Add the model probe to `tests/harness-probe/dispatch-probe/` per plan.md `## Approach` item 1.
  - Add a pure `model-variants.js` that exports `buildModelVariants(file, target)` for M1–M5, where `target` is `{ id, vendor, family }`.
  - Add a second command, *Agento Probe: Dispatch with model* (`agentoDispatchProbe.runModelVariant`), in `extension.js` and `package.json`. It logs the `vscode.lm.selectChatModels()` list (`id`, `name`, `vendor`, `family`, `version`) and every `/chat.*model/i` command id to the "Agento Dispatch Probe" channel, asks for a target model, then runs the chosen variant. M5 runs the first discovered model-change command, then V1, and logs `n/a` when there is none.
  - Extend `tests/harness-probe/dispatch-probe.test.mjs`:
    - M1–M4 carry V1's `query`, `attachFiles`, and canonical `/agento delivery-status`;
    - M1 has `modelSelector: { vendor, id }`, M2 `{ vendor, family }`, M3 `{ id }`;
    - M4 has `mode: "📋 Agento Planner"`;
    - ids are unique.

  — verify: `node --test tests/harness-probe/dispatch-probe.test.mjs tests/harness-probe/probe.test.mjs` exits 0
- [x] 1.2 (manual) The Builder first launches `code --new-window --extensionDevelopmentPath=<worktree>/tests/harness-probe/dispatch-probe /home/david/DP/agento` itself. In that window, run each variant M1–M5:
  1. Open a **new** chat with Session Target **Copilot**.
  2. Run **Agento Probe: Dispatch with model** from the Command Palette.
  3. Pick a target model that differs from the picker's current one (the same target for every variant), then pick the variant.
  4. Note whether the model picker switched to the target, whether the request was sent, and which model the reply footer names. You may stop the turn after the receipt.

  Then repeat M1–M5 with Session Target **Local**. Screenshot the model picker and reply footer of each result. The Builder saves the screenshots as `evidence/step-1-2-<harness>-<variant>.png`, and the matrix plus the copied output-channel log as `evidence/step-1-2-model-matrix.md`.

  — verify: the matrix file has a row per variant × harness with picker, sent, and footer columns, and each row links its screenshot (completed 2026-10-22; [matrix](evidence/step-1-2-model-matrix.md), [Copilot M1](evidence/step-1-2-copilot-M1.png), [Copilot M2](evidence/step-1-2-copilot-M2.png), [Copilot M3](evidence/step-1-2-copilot-M3.png), [Copilot M4](evidence/step-1-2-copilot-M4.png), [Copilot M5](evidence/step-1-2-copilot-M5.png), [Local M1](evidence/step-1-2-local-M1.png), [Local M2](evidence/step-1-2-local-M2.png), [Local M3](evidence/step-1-2-local-M3.png), [Local M4](evidence/step-1-2-local-M4.png), [Local M5](evidence/step-1-2-local-M5.png); result: Copilot honors only M3 `{ id }`; Local honors M1/M2/M4, M3 breaks the request, M5 ignored)
- [x] 1.3 ~Apply the selection rule in plan.md `## Approach` item 1 to the matrix. For each harness, record the chosen variant (or `ignored`):
  - in `docs/copilot-harness.md` "Dispatch", as a new "Model preselection (chat-model-preselect)" paragraph that links the matrix;
  - as an `(added <date>)` entry in plan.md `## Decisions` that names the selector shape for `selectorFor`, and which harnesses get the mechanism and which get the banner hint.

  — verify: `node --test tests/harness-probe/probe.test.mjs tests/customizations.test.mjs` exits 0 (relative links resolve), and `grep -n "chat-model-preselect" docs/copilot-harness.md` names the chosen variant or `ignored` for both Copilot and Local~ (obsolete: the per-harness selection rule is undecidable — the extension cannot detect which harness a dispatch lands in (`evidence/step-1-2-model-matrix.md` "Harness-detection finding"); Q6 replaced it with the opt-in `agento.chatModelPreselect` setting, recorded in plan.md `## Decisions` and in step 1.4)
- [x] 1.4 (added 2026-10-22) Record the Q6 decision in plan.md `## Decisions` (the question and option text quoted verbatim from the probe notes' "Q6 decision" section, noting it was the recommended option), add the mismatched-setting/remembered-model risk entry to plan.md `## Risks`, and note in plan.md `## Approach` that Q6 replaces the per-harness selector rule in items 3–6 with the setting — verify: `grep -n "chatModelPreselect" plan.md` names the three values `off`/`local`/`copilot` and the `models alias set` reason, and `grep -n "Q6" plan.md` prints the decision entry (verified 2026-10-22)

## Phase 2: CLI `models resolve`

- [x] 2.1 Add `splitQualified(value)` → `{ name, vendor }` to `scripts/model-profiles.mjs`, built on `vendorOf`, with tests in `scripts/model-profiles.test.mjs`. Cover a qualified value, an unqualified value (`vendor: null`), a name containing parentheses before the suffix, and non-strings (`null`). — verify: `node --test scripts/model-profiles.test.mjs` exits 0 with the new cases passing
- [x] 2.2 In `scripts/agento.mjs`, factor the secondary-profile lookup out of `models pins` into one helper that returns `{ profile, source, warnings, resolved }`. Add the `models resolve <command> [--role primary|secondary]` verb per plan.md `## Approach` item 2.
  - Values come from the role profile's prompt target, or from the file's current `model:` value.
  - The output is `{ command, agent, role, roleSource, windowRole, profile, source, model, qualified, name, vendor, copilotModel, warnings }` plus `modelsReport`.
  - An unknown command returns `not-found` with exit 3. It writes nothing.

  Add tests to `scripts/agento.test.mjs` against a temp `AGENTO_CONFIG_HOME` and a temp plugin clone:
  - primary file pins, including a custom-agent command inheriting a list pin's first entry;
  - a built-in command with `prompts.<name>`, and one falling back to `default`;
  - `--role secondary` with an assigned profile;
  - secondary off → file pins;
  - a dangling assignment, and an invalid roles file → file pins plus a warning;
  - an unpinned command → `null` fields;
  - an unknown command → exit 3;
  - `copilotModel` from `copilotModels`;
  - no file changed (`git status --porcelain` empty in the temp clone).

  — verify: `node --test scripts/agento.test.mjs scripts/model-profiles.test.mjs` exits 0 and every existing `models pins` test still passes
- [x] 2.3 Document the verb:
  - the usage comment at `scripts/agento.mjs` L32 (`read: list | pins [--role …] | resolve <command> [--role …] | show <name>`);
  - `.github/prompts/models.prompt.md` and its byte-identical mirror `skills/agento/commands/models.md` (`resolve` as a read verb: report `qualified` and `source`);
  - the `README.md` command table row.

  Then run `cd extension && npm run copy-cli`. — verify: `node --test tests/customizations.test.mjs` exits 0, `cmp .github/prompts/models.prompt.md skills/agento/commands/models.md` exits 0, and `diff -r scripts extension/cli` prints nothing

## Phase 3: Extension dispatch

- [x] 3.1 ~Add `extension/src/chatModel.ts` (no `vscode` import) with `parseResolveResult(json)` and `selectorFor(resolved, models)` per plan.md `## Approach` item 3, using the selector shape that 1.3 recorded. Add `extension/test/unit/chatModel.test.ts` covering:
  - an exact `vendor` + `name` match;
  - a unique unqualified match, and an ambiguous unqualified one (reason);
  - the `copilotModels` id fallback;
  - no match (reason);
  - an unpinned, `not-found`, and unparseable result (reason).

  — verify: `cd extension && npm run typecheck && npm run test:unit` exits 0 with the new cases passing~ (obsolete: the selector shape is now per-value per Q6 — `local` sends `{ vendor, id }`, `copilot` sends `{ id }`, and the `copilotModels` fallback is used only for `copilot`; replaced by step 3.7)
- [x] 3.3 ~Wire the real resolver in `extension/src/extension.ts` per plan.md `## Approach` item 5:
  - `commandName` → `client.run(["models", "resolve", name, "--role", windowProfileRole(currentWindowRole()), "--plugin-root", root], root)`, bounded at 5 s;
  - `vscode.lm.selectChatModels` → `selectorFor`;
  - a missing plugin root or a timeout is a reason;
  - add the `ExtensionApi.setChatModelSource(source?)` test hook.

  Put the factory (`createChatModelResolver({ pluginRoot, sessionRole, runCli, listModels, timeoutMs })`) in `chatModel.ts` so it is unit-testable. Test that it passes `--role secondary` for `plan`/`build`/`freehand` and `--role primary` otherwise, and that it falls back on timeout, a missing root, and a CLI error. — verify: `cd extension && npm run build && npm run typecheck && npm run test:unit` exits 0~ (obsolete: the wiring now also reads the `agento.chatModelPreselect` setting and routes `local`/`copilot`/`off` per Q6; replaced by step 3.8)
- [x] 3.4 ~Extend `extension/test/electron/suite.ts`: with a stubbed client that answers `models resolve` and a model list injected through `setChatModelSource`, a current-window dashboard dispatch records `workbench.action.chat.open` with the expected `modelSelector`. With no matching model, it records the call without `modelSelector`, and the output channel has the `dispatch: no model for` line. Keep the existing assertions at L439, L1306, and L1351 passing. — verify: `cd extension && DISPLAY=:0 npm run test:electron` exits 0 (`xvfb-run -a npm run test:electron` when no display) and every scenario passes~ (obsolete: replaced by the electron test covering `local`, `copilot`, and `off` in step 3.10)
- [x] 3.5 ~For each harness that 1.3 marked `ignored`, add the banner tooltip hint per plan.md `## Approach` item 6. Build it in the pure model in `extension/src/windowBanner.ts`, with cases in `extension/test/unit/windowBanner.test.ts` for each ignoring harness and for none. If 1.3 marked no harness `ignored`, mark this step obsolete with that reason. — verify: `cd extension && npm run typecheck && npm run test:unit` exits 0 with the new banner cases passing~ (obsolete: the banner hint is now setting-based (`off`/`local`/`copilot`) per Q6; replaced by step 3.9)
- [x] 3.6 (added 2026-10-22) Add the `agento.chatModelPreselect` setting to `extension/package.json` `contributes.configuration` (`type: "string"`, `enum: ["off", "local", "copilot"]`, `default: "off"`, a description naming each value). Extend `extension/test/unit/extensionIntegration.test.ts` to assert the property and its default. — verify: `cd extension && npm run typecheck && npm run test:unit` exits 0 with the manifest assertion passing (verified 2026-10-22: typecheck exit 0; 215/215 unit tests pass including the manifest assertion)
- [x] 3.7 (added 2026-10-22) Add `extension/src/chatModel.ts` (no `vscode` import) with the per-value selector logic per the Q6 decision: `parseResolveResult(json)` (`{ qualified, name, vendor, copilotModel }` or `{ qualified: null, reason }`, the unpinned reason being `no pin for <command> in the <role> role`); `selectorFor(resolved, models)` → `{ selector: { vendor, id } }` from an exact `vendor`+`name` match or a unique unqualified `name` match, else a reason (the `copilotModels` fallback is NOT used here); `selectorForCopilot(resolved)` → `{ selector: { id } }` from `copilotModel`, a null `copilotModel` being a reason naming `agento.mjs models alias set <picker> <id>`; and `preselectFor(setting, resolved, models)` returning a selector, a reason, or the `off` shape. Add `extension/test/unit/chatModel.test.ts` covering: an exact and a unique-unqualified local match, an ambiguous and a no-match local reason, the copilot id and null-copilot cases, `off`, and unpinned/`not-found`/unparseable resolves. — verify: `cd extension && npm run typecheck && npm run test:unit` exits 0 with the new cases passing (verified 2026-10-22: typecheck exit 0; 230/230 unit tests pass — 15 new)
- [x] 3.2 In `extension/src/commandDispatcher.ts`, add the `ChatModelResolver` dependency to `chatOpenOptions` and to every caller's dependency type (types come from `chatModel.ts`, added in 3.7), per plan.md `## Approach` item 4: set `modelSelector` when one is returned; otherwise log `dispatch: no model for <command>: <reason>`; on a `chat.open` throw with a selector, log and retry once without it; a rejecting resolver counts as a reason. In `extension/test/unit/commandDispatcher.test.ts`, add a default fake resolver to the shared test dependencies so the existing payload assertions (L117, L131, L138–L173, L238; `planPlayButtonHandoff.test.ts`; `newInitiativeFlow.test.ts`) stay byte-identical. Add tests for:
  - a selector passed through;
  - a reason logged with no selector;
  - a throw with a selector retried and logged;
  - a throw without a selector propagated;
  - a rejecting resolver;
  - a pending (`consumePendingCommands`) dispatch carrying the selector.

  — verify: `cd extension && npm run typecheck && npm run test:unit` exits 0 with at least 215 tests plus the new ones passing (verified 2026-10-22: typecheck exit 0; 236/236 unit tests pass — 6 new)
- [x] 3.8 (added 2026-10-22) Wire the setting-aware resolver in `extension/src/extension.ts` per the Q6 decision: read `agento.chatModelPreselect` with `vscode.workspace.getConfiguration("agento")`; `commandName` → `client.run(["models", "resolve", name, "--role", windowProfileRole(currentWindowRole()), "--plugin-root", root], root)` bounded at 5 s; for `local` run `vscode.lm.selectChatModels({ vendor })` → `selectorFor`, for `copilot` no `vscode.lm` lookup, for `off` the `off` shape; a missing plugin root or a timeout is a reason; add the `ExtensionApi.setChatModelSource(source?)` test hook. Put the factory (`createChatModelResolver({ pluginRoot, sessionRole, setting, runCli, listModels, timeoutMs })`) in `chatModel.ts` so it is unit-testable. Test that it passes `--role secondary` for `plan`/`build`/`freehand` and `--role primary` otherwise, that `local`/`copilot`/`off` route as above, and that it falls back on timeout, a missing root, and a CLI error. — verify: `cd extension && npm run build && npm run typecheck && npm run test:unit` exits 0 (verified 2026-10-22: build exit 0; typecheck exit 0; 243/243 unit tests pass — 7 new)
- [x] 3.9 (added 2026-10-22) Add the `off` log line and the banner hint per the Q6 decision: in `commandDispatcher.ts`, when the resolver returns the `off` shape, log `dispatch: model for <command>: <qualified> (Copilot id <copilotModel|none>) — preselection off; set it in the model picker` and dispatch without a selector; in the pure `extension/src/windowBanner.ts` model add `modelPreselectHint(setting)` naming the setting and `agento.mjs models resolve <command>` (for `local`/`copilot`, the hint says preselection targets that harness only) and carry it in the banner tooltip. Add cases to `extension/test/unit/commandDispatcher.test.ts` and `extension/test/unit/windowBanner.test.ts`. — verify: `cd extension && npm run typecheck && npm run test:unit` exits 0 with the new cases passing (verified 2026-10-22: typecheck exit 0; 247/247 unit tests pass — 4 new)
- [ ] 3.10 (added 2026-10-22) Extend `extension/test/electron/suite.ts`: with a stubbed client that answers `models resolve` and a model list injected through `setChatModelSource`, drive a current-window dashboard dispatch under each of the three settings and assert `workbench.action.chat.open` receives `{ vendor, id }` for `local`, `{ id }` for `copilot`, and no `modelSelector` plus the `dispatch: model for … — preselection off` line for `off`; keep the existing assertions at L439, L1306, and L1351 passing. — verify: `cd extension && DISPLAY=:0 npm run test:electron` exits 0 (`xvfb-run -a npm run test:electron` when no display) and every scenario passes

## Phase 4: Docs, live check, release, and final gate

- [ ] 4.1 Update the docs per plan.md `## Approach` item 7 and the Q6 decision:
  - `docs/model-profiles.md`: `resolve` in "Applying and clearing"; "Window roles"; the last paragraph of "Subagents and handoffs" replaced with the shipped behavior (the `agento.chatModelPreselect` setting, which selector each value sends, and the mismatched-setting side effects); "Limits";
  - `docs/extension.md` "Command routing": the `{ query, mode, attachFiles, modelSelector }` contract, the `--role` source, the retry, and the `dispatch: no model for` log line; "Settings": `agento.chatModelPreselect` and which selector each value sends;
  - `docs/copilot-harness.md` "Dispatch": a "Model preselection (chat-model-preselect)" paragraph naming `off`/`local`/`copilot` and the mismatched-setting side effects, linking the matrix;
  - `extension/README.md`.

  — verify: `node --test tests/*.test.mjs` exits 0, and `grep -n "later \`chat-model-preselect\`" docs/model-profiles.md` prints nothing
- [x] 4.2 ~(manual) The Builder first builds the extension and assigns a secondary profile whose `default` (or the command's agent) differs from the primary pins (`node scripts/agento.mjs models use <name> --role secondary`, recording the previous assignment to restore afterwards). It then launches `code --new-window --extensionDevelopmentPath=<worktree>/extension <a managed build or plan worktree of /home/david/DP/agento>` itself. In that window:
  1. Open a **new** chat with Session Target **Copilot**.
  2. Click **Delivery Status** (or another dashboard action named by the Builder) in the Agento sidebar.
  3. Note the model picker and the reply footer.
  4. Repeat with Session Target **Local**.

  Screenshot each result. For a harness 1.3 marked `ignored`, also screenshot the banner tooltip showing the hint. The Builder saves the screenshots as `evidence/step-4-2-<harness>.png`, restores the previous secondary assignment, and copies the Agento output-channel `dispatch:` lines into `evidence/step-4-2-dispatch-log.md`.

  — verify: for every harness 1.3 marked as honoring the selector, the screenshot shows the secondary profile's resolved model for the command (matching `node scripts/agento.mjs models resolve <command> --role secondary`'s `qualified`); for every ignoring harness, the tooltip hint is visible; `models list` reports the original `roles.secondary`~ (obsolete: the per-harness live check is undecidable — the extension cannot detect which harness a dispatch lands in; replaced by the setting-based live check in step 4.5)
- [ ] 4.5 (added 2026-10-22) (manual) The Builder first builds the extension and assigns a secondary profile whose `default` (or the command's agent) differs from the primary pins (`node scripts/agento.mjs models use <name> --role secondary`, recording the previous assignment to restore afterwards). It then launches `code --new-window --extensionDevelopmentPath=<worktree>/extension <a managed build or plan worktree of /home/david/DP/agento>` itself. In that window:
  1. Set `agento.chatModelPreselect` to `copilot`, open a **new** chat with Session Target **Copilot**, click **Delivery Status** (or another dashboard action named by the Builder), and note the model picker and reply footer;
  2. Set `agento.chatModelPreselect` to `local`, open a **new** chat with Session Target **Local**, click the same action, and note the picker and footer;
  3. Set `agento.chatModelPreselect` to `off`, and screenshot the banner tooltip showing the hint.

  The Builder saves the screenshots as `evidence/step-4-5-<case>.png`, restores the previous secondary assignment and the setting, and copies the Agento output-channel `dispatch:` lines into `evidence/step-4-5-dispatch-log.md`.

  — verify: the `copilot` screenshot's footer shows the command's resolved `copilotModel` and the `local` screenshot's footer shows the resolved `qualified` (both matching `node scripts/agento.mjs models resolve <command> --role secondary`'s `copilotModel`/`qualified`); the `off` screenshot shows the banner tooltip hint; `models list` reports the original `roles.secondary`
- [ ] 4.3 Bump the version to `0.14.0` in `.claude-plugin/plugin.json`, `package.json`, `extension/package.json`, and `extension/package-lock.json` (via `npm version 0.14.0 --no-git-tag-version` in `extension/`). Add a `## 0.14.0 (unreleased)` entry to `CHANGELOG.md` covering `models resolve`, dispatch model preselection per the `agento.chatModelPreselect` setting, the fallback log line, and the hint. — verify: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exits 0, and `grep -c '"version": "0.14.0"' extension/package.json` prints 1
- [ ] 4.4 Run the full gate and record the counts on this line. Compare against plan.md `## Research`: Shellcheck exit 0 with zero findings; 641 root tests; 215 unit tests.
  - `/tmp/shellcheck-v0.10.0/shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` (or the same release binary);
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`;
  - every guard replay from AGENTS.md (five);
  - `cd extension && npm ci && npm run build && npm run typecheck && npm run test:unit && DISPLAY=:0 npm run test:electron && npm run package`.

  verify: Shellcheck exits 0 with no findings; at least 641 root tests plus the new ones pass; every guard replay passes; at least 215 unit tests plus the new ones pass; every electron scenario passes; `agento-dashboard-0.14.0.vsix` packages; `git status --porcelain --untracked-files=all` is empty in both halves
