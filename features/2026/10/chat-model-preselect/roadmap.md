```yaml
status: paused
branch: feature/chat-model-preselect
last-updated: 2026-10-22
next-step: "1.2 (manual) Run the model probe M1–M5 in Copilot and Local harnesses"
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
- [ ] 1.2 (manual) The Builder first launches `code --new-window --extensionDevelopmentPath=<worktree>/tests/harness-probe/dispatch-probe /home/david/DP/agento` itself. In that window, run each variant M1–M5:
  1. Open a **new** chat with Session Target **Copilot**.
  2. Run **Agento Probe: Dispatch with model** from the Command Palette.
  3. Pick a target model that differs from the picker's current one (the same target for every variant), then pick the variant.
  4. Note whether the model picker switched to the target, whether the request was sent, and which model the reply footer names. You may stop the turn after the receipt.

  Then repeat M1–M5 with Session Target **Local**. Screenshot the model picker and reply footer of each result. The Builder saves the screenshots as `evidence/step-1-2-<harness>-<variant>.png`, and the matrix plus the copied output-channel log as `evidence/step-1-2-model-matrix.md`.

  — verify: the matrix file has a row per variant × harness with picker, sent, and footer columns, and each row links its screenshot
- [ ] 1.3 Apply the selection rule in plan.md `## Approach` item 1 to the matrix. For each harness, record the chosen variant (or `ignored`):
  - in `docs/copilot-harness.md` "Dispatch", as a new "Model preselection (chat-model-preselect)" paragraph that links the matrix;
  - as an `(added <date>)` entry in plan.md `## Decisions` that names the selector shape for `selectorFor`, and which harnesses get the mechanism and which get the banner hint.

  — verify: `node --test tests/harness-probe/probe.test.mjs tests/customizations.test.mjs` exits 0 (relative links resolve), and `grep -n "chat-model-preselect" docs/copilot-harness.md` names the chosen variant or `ignored` for both Copilot and Local

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

- [ ] 3.1 Add `extension/src/chatModel.ts` (no `vscode` import) with `parseResolveResult(json)` and `selectorFor(resolved, models)` per plan.md `## Approach` item 3, using the selector shape that 1.3 recorded. Add `extension/test/unit/chatModel.test.ts` covering:
  - an exact `vendor` + `name` match;
  - a unique unqualified match, and an ambiguous unqualified one (reason);
  - the `copilotModels` id fallback;
  - no match (reason);
  - an unpinned, `not-found`, and unparseable result (reason).

  — verify: `cd extension && npm run typecheck && npm run test:unit` exits 0 with the new cases passing
- [ ] 3.2 In `extension/src/commandDispatcher.ts`, add the `ChatModelResolver` dependency to `chatOpenOptions` and to every caller's dependency type, per plan.md `## Approach` item 4: set `modelSelector` when one is returned; otherwise log `dispatch: no model for <command>: <reason>`; on a `chat.open` throw with a selector, log and retry once without it; a rejecting resolver counts as a reason. In `extension/test/unit/commandDispatcher.test.ts`, add a default fake resolver to the shared test dependencies so the existing payload assertions (L117, L131, L138–L173, L238; `planPlayButtonHandoff.test.ts`; `newInitiativeFlow.test.ts`) stay byte-identical. Add tests for:
  - a selector passed through;
  - a reason logged with no selector;
  - a throw with a selector retried and logged;
  - a throw without a selector propagated;
  - a rejecting resolver;
  - a pending (`consumePendingCommands`) dispatch carrying the selector.

  — verify: `cd extension && npm run typecheck && npm run test:unit` exits 0 with at least 215 tests plus the new ones passing
- [ ] 3.3 Wire the real resolver in `extension/src/extension.ts` per plan.md `## Approach` item 5:
  - `commandName` → `client.run(["models", "resolve", name, "--role", windowProfileRole(currentWindowRole()), "--plugin-root", root], root)`, bounded at 5 s;
  - `vscode.lm.selectChatModels` → `selectorFor`;
  - a missing plugin root or a timeout is a reason;
  - add the `ExtensionApi.setChatModelSource(source?)` test hook.

  Put the factory (`createChatModelResolver({ pluginRoot, sessionRole, runCli, listModels, timeoutMs })`) in `chatModel.ts` so it is unit-testable. Test that it passes `--role secondary` for `plan`/`build`/`freehand` and `--role primary` otherwise, and that it falls back on timeout, a missing root, and a CLI error. — verify: `cd extension && npm run build && npm run typecheck && npm run test:unit` exits 0
- [ ] 3.4 Extend `extension/test/electron/suite.ts`: with a stubbed client that answers `models resolve` and a model list injected through `setChatModelSource`, a current-window dashboard dispatch records `workbench.action.chat.open` with the expected `modelSelector`. With no matching model, it records the call without `modelSelector`, and the output channel has the `dispatch: no model for` line. Keep the existing assertions at L439, L1306, and L1351 passing. — verify: `cd extension && DISPLAY=:0 npm run test:electron` exits 0 (`xvfb-run -a npm run test:electron` when no display) and every scenario passes
- [ ] 3.5 For each harness that 1.3 marked `ignored`, add the banner tooltip hint per plan.md `## Approach` item 6. Build it in the pure model in `extension/src/windowBanner.ts`, with cases in `extension/test/unit/windowBanner.test.ts` for each ignoring harness and for none. If 1.3 marked no harness `ignored`, mark this step obsolete with that reason. — verify: `cd extension && npm run typecheck && npm run test:unit` exits 0 with the new banner cases passing

## Phase 4: Docs, live check, release, and final gate

- [ ] 4.1 Update the docs per plan.md `## Approach` item 7:
  - `docs/model-profiles.md`: `resolve` in "Applying and clearing"; "Window roles"; the last paragraph of "Subagents and handoffs" replaced with the shipped behavior per harness; "Limits";
  - `docs/extension.md` "Command routing": the `{ query, mode, attachFiles, modelSelector }` contract, the `--role` source, the retry, and the `dispatch: no model for` log line;
  - `extension/README.md`.

  — verify: `node --test tests/*.test.mjs` exits 0, and `grep -n "later \`chat-model-preselect\`" docs/model-profiles.md` prints nothing
- [ ] 4.2 (manual) The Builder first builds the extension and assigns a secondary profile whose `default` (or the command's agent) differs from the primary pins (`node scripts/agento.mjs models use <name> --role secondary`, recording the previous assignment to restore afterwards). It then launches `code --new-window --extensionDevelopmentPath=<worktree>/extension <a managed build or plan worktree of /home/david/DP/agento>` itself. In that window:
  1. Open a **new** chat with Session Target **Copilot**.
  2. Click **Delivery Status** (or another dashboard action named by the Builder) in the Agento sidebar.
  3. Note the model picker and the reply footer.
  4. Repeat with Session Target **Local**.

  Screenshot each result. For a harness 1.3 marked `ignored`, also screenshot the banner tooltip showing the hint. The Builder saves the screenshots as `evidence/step-4-2-<harness>.png`, restores the previous secondary assignment, and copies the Agento output-channel `dispatch:` lines into `evidence/step-4-2-dispatch-log.md`.

  — verify: for every harness 1.3 marked as honoring the selector, the screenshot shows the secondary profile's resolved model for the command (matching `node scripts/agento.mjs models resolve <command> --role secondary`'s `qualified`); for every ignoring harness, the tooltip hint is visible; `models list` reports the original `roles.secondary`
- [ ] 4.3 Bump the version to `0.14.0` in `.claude-plugin/plugin.json`, `package.json`, `extension/package.json`, and `extension/package-lock.json` (via `npm version 0.14.0 --no-git-tag-version` in `extension/`). Add a `## 0.14.0 (unreleased)` entry to `CHANGELOG.md` covering `models resolve`, dispatch model preselection per harness, the fallback log line, and the hint if any. — verify: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exits 0, and `grep -c '"version": "0.14.0"' extension/package.json` prints 1
- [ ] 4.4 Run the full gate and record the counts on this line. Compare against plan.md `## Research`: Shellcheck exit 0 with zero findings; 641 root tests; 215 unit tests.
  - `/tmp/shellcheck-v0.10.0/shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` (or the same release binary);
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`;
  - every guard replay from AGENTS.md (five);
  - `cd extension && npm ci && npm run build && npm run typecheck && npm run test:unit && DISPLAY=:0 npm run test:electron && npm run package`.

  verify: Shellcheck exits 0 with no findings; at least 641 root tests plus the new ones pass; every guard replay passes; at least 215 unit tests plus the new ones pass; every electron scenario passes; `agento-dashboard-0.14.0.vsix` packages; `git status --porcelain --untracked-files=all` is empty in both halves
