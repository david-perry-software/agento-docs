```yaml
status: in-progress
branch: feature/model-profiles-view
last-updated: 2026-10-21
next-step: "2.1 Add modelProfilesTree.ts pure model and tests"
initiative: "model-profile-manager"
artifact-pr: "#62"
```

## Phase 1: CLI list fields

- [x] 1.1 In `scripts/agento.mjs` `models list`, add `warnings` (from `tierWarnings` over the resolved targets) and `targets` (`[{ file, value }]` from `state.resolved`, or `[]` when the profile has errors) to each `profiles[]` entry, leaving existing fields unchanged. Add `scripts/agento.test.mjs` cases asserting that both fields equal `models show <name>` for a valid profile, that an invalid profile has `targets: []` and its errors, and that the entry keys keep their existing fields — verify: `node --test scripts/agento.test.mjs` exits 0 with the new cases passing
- [x] 1.2 Run `cd extension && npm run copy-cli` and document the two new `list` fields in `docs/model-profiles.md` — verify: `node --test tests/extension-bundle.test.mjs` exits 0

## Phase 2: Pure model and helpers

- [ ] 2.1 Add `extension/src/modelProfilesTree.ts` (no `vscode` import), per plan.md `## Approach` item 2:
  - `createModelProfilesModel`, with the states `no-plugin-root`, `no-file`, `error`, and `ready`, plus the `custom` info row;
  - `profileItemSpec` (label, description, icon, contextValue, Markdown tooltip);
  - `summarizePins` (agents by name, command files collapsed by value, fallback lists as `A → B`);
  - `validateProfileName` and `suggestCopyName`.

  Add `extension/test/unit/modelProfilesTree.test.ts` covering every state and branch — verify: `cd extension && npm run test:unit` exits 0 with the new tests passing
- [ ] 2.2 In `extension/src/modelProfiles.ts`, add arg builders for `create` (`--from`, `--description`), `rename`, `delete` (`--force` when applied), and `init`. Every write appends `--expect <hash>` when a hash is known. Extend `summarizeModelsResult` with messages for `exists`, `not-found`, `active`, `conflict`, and `invalid`, and expose `dirty` files and a `conflict` flag separately. Extend `extension/test/unit/modelProfiles.test.ts`, keeping the existing quick-pick cases green — verify: `cd extension && npm run test:unit` exits 0

## Phase 3: View, commands, and watchers

- [ ] 3.1 Add `extension/src/modelProfilesProvider.ts`, a `TreeDataProvider` over the model with `current` and `update(model)` that sets the context key `agento.modelProfiles.state`. Contribute the following in `extension/package.json`, following plan.md `## Approach` item 6:
  - the `agento.modelProfiles` view (after Session & Doctor);
  - every `agento.modelProfiles.*` command with its icon;
  - the `view/title` entries (New, Clear when ready, Refresh via `agento.refresh`, and the overflow Open Profiles File);
  - the `view/item/context` entries (inline Apply hidden on `.applied`, and the context-menu Edit, Duplicate, Rename, and Delete);
  - the two `viewsWelcome` entries;
  - `commandPalette` hiding for the row-only commands.

  Register the view in `extension.ts`, add `modelProfiles` to `ExtensionApi`, and reload it with `models list --plugin-root <root>` on every `scheduler.onDidRefresh` behind a latest-wins guard — verify: `cd extension && npm run build && npm run typecheck && npm run test:unit` exits 0
- [ ] 3.2 Extract `runModelsSelection(selection)` from `agento.selectModelProfile`. On `dirty`, it shows an error listing the files, with the Open Output and Show in Source Control actions. On success, it reloads the view and calls `scheduler.refreshNow("model profile")`. Implement these commands against it and the Phase 2 helpers, each prompt routed through a `setModelProfilePrompts` hook on `ExtensionApi`:
  - `agento.modelProfiles.apply` and `clear`;
  - `new` (name input, then Empty / Copy from…);
  - `duplicate`;
  - `rename`;
  - `delete` (modal; the applied wording plus `--force`);
  - `edit` (open the profiles file at the profile key);
  - `openFile` and `init`.

  A `conflict` result shows the retry message and reloads — verify: `cd extension && npm run build && npm run typecheck && npm run test:unit` exits 0
- [ ] 3.3 Add the profile watchers. Use absolute `RelativePattern`s on `dirname(profilesFile.path)`/`model-profiles.json` and `<pluginRoot>`/`.github/agents/*.agent.md`, rebuilt whenever either path changes, feeding a dedicated debounced (about 500 ms) model-profiles reload that never runs `dashboard`. Also reload when the view becomes visible and on window focus. Dispose of the watchers with the extension — verify: `cd extension && npm run build && npm run typecheck && npm run test:unit` exits 0

## Phase 4: Electron coverage

- [ ] 4.1 In `extension/test/electron/runTest.ts`, create a temp `AGENTO_CONFIG_HOME` for every scenario and pass it in `extensionTestsEnv`. Also create a temp git plugin clone holding `.claude-plugin/plugin.json`, `.github/agents`, `.github/prompts`, `skills/agento/commands`, and `templates/model-profiles.json`, committed once and passed as `AGENTO_E2E_PLUGIN_ROOT`. Remove both in the scenario's `finally` block, and add both to the existing removal assertion. Add the new commands to the registration assertions in `suite.ts` — verify: `cd extension && xvfb-run -a npm run test:electron` exits 0 with all four scenarios passing, and `git status --porcelain --untracked-files=all` is empty afterwards
- [ ] 4.2 In the in-repo scenario of `suite.ts`, set `agento.pluginRoot` to `AGENTO_E2E_PLUGIN_ROOT` and assert that `profilesFile.path` is under the temp `AGENTO_CONFIG_HOME` before any write. Then drive the view through the registered commands with stubbed prompts:
  1. the `no-file` state, then `init`;
  2. write valid profiles through the CLI and check the listed rows and the tooltip pins;
  3. New (empty and copy-from), Duplicate, and Rename;
  4. Apply: the applied marker and description, and the clone's `model:` lines changed;
  5. Clear;
  6. Delete of the applied profile, which confirms and passes `--force`, leaving `active: custom`;
  7. a stale-`--expect` conflict that reloads;
  8. a profile created by a direct CLI call that appears without `agento.refresh`, through the watcher;
  9. the `agento.selectModelProfile` quick pick still applying.

  Restore the setting afterwards — verify: `cd extension && xvfb-run -a npm run test:electron` exits 0 and the in-repo scenario log names the model-profiles checks

## Phase 5: Docs, release, and gate

- [ ] 5.1 Document the view:
  - `extension/README.md`: a new `## Model Profiles` section (rows, badges, tooltip, actions, empty states, refresh behavior) and the Commands list entry;
  - `docs/extension.md`: rewrite `## Model profiles` around the view and keep the quick pick;
  - `docs/model-profiles.md`: a pointer to the view from `## Editing profiles` and `## Applying and clearing`.

  Write only canonical `/agento <name>` command spellings — verify: `node --test tests/customizations.test.mjs` exits 0
- [ ] 5.2 Bump the version to `0.10.0` in `.claude-plugin/plugin.json`, `package.json`, `extension/package.json`, and `extension/package-lock.json` (both version fields, via `npm version 0.10.0 --no-git-tag-version` in `extension/`), and add a `## 0.10.0 (unreleased)` **Added** entry for the Model Profiles view and the new `models list` fields at the top of `CHANGELOG.md` — verify: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exits 0 and `git diff origin/main -- extension/package.json` shows only the version and the view/command/menu contributions
- [ ] 5.3 Full gate (§5), each run with its status captured:
  - `/tmp/shellcheck-v0.10.0/shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` (download v0.10.0 if absent);
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`;
  - the five guard smoke replays from AGENTS.md;
  - `cd extension && npm ci && npm run build && npm run typecheck && npm run test:unit && xvfb-run -a npm run test:electron`.

  Record the counts in this step's line — verify: shellcheck exits 0 with no findings, at least 607 root tests plus the new ones pass, every guard replay passes, at least 167 unit tests plus the new ones pass, all four electron scenarios pass, and `git status --porcelain --untracked-files=all` is empty in both halves
