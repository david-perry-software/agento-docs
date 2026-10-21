# Model Profiles sidebar view: list, one-click apply, and profile lifecycle actions

## Problem

Today the only UI for model profiles is the *Agento: Select Model Profile* quick pick
in the Command Palette (`extension/src/extension.ts:522-560`). It can apply or clear a
profile, but it cannot show what a profile pins, flag a broken one before you apply
it, or create, duplicate, rename, or delete profiles. Those need a terminal
(`agento.mjs models create|rename|delete`, shipped by `model-profile-crud-cli`) or
hand-editing `~/.config/agento/model-profiles.json`. Nothing in the sidebar shows
which profile is applied to the plugin clone.

This feature adds a **Model Profiles** tree view to the Agento sidebar container.
It has one row per profile, showing the description, an *applied* marker, and error
and warning badges, with a tooltip listing the profile's resolved models. Each row
has an inline Apply button. The context menu offers Duplicate, Rename, Delete, and
Edit, and the title bar offers New Profile, Clear, Refresh, and Open Profiles File.
An empty state offers to create the profiles file. The view refreshes when the
profiles file or the clone's pins change, so an apply from another window or a
terminal shows up without a manual refresh.

This is the `model-profiles-view` member of the
[model-profile-manager initiative](../../../../initiatives/2026/10/model-profile-manager/breakdown.md)
(its `### model-profiles-view` block, wave 2). Brief: "I want to make it so we can
easily switch between profiles through the UI sidebar."

## Decisions

The Planner asked these with the ask-questions tool on 2026-10-21. The answers are
verbatim, and each one is the recommended option.

- **Q1: What does clicking a profile row do?** A: `inline-apply` — "Inline Apply
  button (hover icon) applies; clicking the row only selects it and shows pins in the
  tooltip" (recommended).
- **Q2: How much of each profile's pins should a row show?** A: `tooltip` — "Flat
  rows: description + badges; the tooltip lists the resolved per-agent models from
  `models show`" (recommended).
- **Q3: Deleting the currently applied profile (the CLI refuses without --force).**
  A: `confirm-force` — "One modal warns it is applied (its pins stay, now 'custom')
  and retries with --force on confirm" (recommended).
- **Q4: When Apply fails because the clone's agent/prompt files are dirty or hold
  custom pins.** A: `actionable` — "Error notification listing the dirty files, with
  'Open Output' and 'Show in Source Control' actions" (recommended).
- **Q5: How should the sidebar UI be verified before review?** A: `electron-only` —
  "Electron integration tests drive every view command against a temp
  AGENTO_CONFIG_HOME and a fixture plugin clone; no manual step" (recommended).

Carried over from the initiative breakdown: until `model-profile-editor` ships,
**Edit** opens the profiles file. The existing quick pick keeps working through the
same code path as the view's Apply and Clear.

## Research

Skills consulted: none — no matching domain. This repository's AGENTS.md has no
`## Agento` skills table, there is no `.agents/skills/` directory, and the only
user-level skills (`agento`, `use-railway`) do not cover VS Code extension work.

**CLI contract (shipped by `model-profile-crud-cli`, merged in #124 at `9f84ec7`).**

- The `case "models"` dispatch is at `scripts/agento.mjs:4792`. Its verb table is at
  `:4795-4809`: `list`, `pins`, `show`, `apply`, `adopt`, `clear`, `init`, `create
  [--from] [--description]`, `update [--dry-run]`, `rename`, `delete [--force]`,
  `alias set|remove`. Every write verb accepts `--expect <sha256>`. Profile names
  must match `[a-z0-9-]+` (`:4822`).
- `models list` (`:4840-4848`) returns `profiles[]` as `{ name, description,
  errors }`, plus `copilotModels`, the file-level `errors`, and the common report
  (`modelsReport`, `:3790-3802`). The common report carries `profilesFile { path,
  exists, hash }`, `active`, `dirty`, `filter`, and `hint`.
  - `active` is a profile name, the string `"custom"` (pins that match no profile),
    or `null`. A probe against the template with a temp `AGENTO_CONFIG_HOME` gave
    `active: "custom"` in this clone.
  - Per-profile `warnings` and `targets` are **not** in `list`. They come only from
    `models show <name>` (`:4852-4858`), which returns `targets: [{ file, value }]`.
    `value` is a string, or a string array for a fallback list. A probe returned 56
    targets: agent, prompt, and router-command files.
  - `modelsState` (`:3701-3726`) already resolves every profile's `targets`
    (`state.resolved`), so `list` can add per-profile `warnings` (`tierWarnings`,
    `:3837`) and `targets` with no extra I/O.
- `models list` with no profiles file exits 0 with `profilesFile.exists: false` and
  `profiles: []` (`:3593-3600`). `init` copies `templates/model-profiles.json` and
  reports `created`.
- Statuses the view must handle (all exit 3):
  - `create`: `exists`, `not-found` (`--from` source missing), `invalid`.
  - `rename`: `not-found`, `exists`.
  - `delete`: `not-found`, and `active` when the profile is applied and there is no
    `--force` (`:4917`). With `--force` it rewrites only the profiles file, so the
    applied pins stay and `active` becomes `custom`.
  - `apply`/`clear`: `dirty` (with `dirty[]`), `worktree`, `git-too-old`, `invalid`,
    `not-found`, `failed`.
  - Any write: `conflict` on a stale `--expect` (`:3635-3650`).
  - `rename` has no applied-profile check. After a rename, the pins still match the
    renamed profile, so `active` follows the new name.

**Extension today.**

- Pure helpers live in `extension/src/modelProfiles.ts`: `resolvePluginRoot`,
  `missingPluginRootMessage`, `toQuickPickItems`, `selectionToArgs`, and
  `summarizeModelsResult`. Their unit tests are in
  `extension/test/unit/modelProfiles.test.ts`.
- `agento.selectModelProfile` (`extension.ts:522-560`) resolves the plugin root, runs
  `models list` and then `apply`/`clear` through `CliClient` (`extension.ts:121-126`,
  bundled CLI `extension/cli/agento.mjs`), and calls `scheduler.refreshNow("model
  profile")` on success.
- There are three tree views: deliveries, initiatives, and session doctor
  (`extension.ts:574-576`). Each separates a pure model or presentation module from
  its provider. For example, `initiativeTreePresentation.ts:56-166` builds item specs
  that `initiativeTreeProvider.ts` converts to `TreeItem`s.
  - Refresh replaces a snapshot and fires `onDidChangeTreeData(undefined)`.
  - Empty and error states are model rows. There is no `viewsWelcome` contribution
    yet.
  - Views are registered in `extension/package.json:24-55`. Title-bar Refresh entries
    reuse `agento.refresh` (`:110-128`). Inline item actions use `group: "inline"`
    with `viewItem ==` when-clauses (`:151-168`).
- Watchers live in `extension/src/watchers.ts:11-48` and cover only roadmap, review,
  and git-ref patterns. Nothing watches the profiles file, which lives outside the
  workspace (`~/.config/agento` or `AGENTO_CONFIG_HOME`), or the plugin clone's pins.
- Applying is clone-wide. It rewrites `model:` lines in the plugin clone, so a second
  window on the same clone sees the change only after it refreshes.
- `ExtensionApi` (`extension.ts:49`) exposes providers for the electron suite
  (`extension/test/electron/suite.ts`). The suite checks command registration at
  `:643-654`. `runTest.ts:260-280` runs four scenarios (`in-repo`, `companion`,
  `workspace`, `no-markdown`) with `extensionTestsEnv: { ...process.env, … }`.
  - Nothing isolates `AGENTO_CONFIG_HOME` or the plugin root today. A test that
    applied or created a profile would write the developer's real profiles file and
    pins.
- `tests/extension-bundle.test.mjs:20-30` requires `extension/cli/` to be a byte copy
  of `scripts/` (`npm run copy-cli`).
- Docs:
  - `extension/README.md`: `## Commands` at line 68 (quick pick at 88) and
    `## Settings` at line 96.
  - `docs/extension.md`: `## Model profiles` at line 302.
  - `docs/model-profiles.md`: `## Editing profiles` at line 71 and `## Applying and
    clearing` at line 147.
  - `CHANGELOG.md`: the top section is `## 0.9.0 (2026-10-21)`, already stamped. The
    last bump (`2bf7c13`) touched `.claude-plugin/plugin.json`, `package.json`,
    `extension/package.json`, `extension/package-lock.json`, and `CHANGELOG.md`.

**Lint baseline (§5).** The full-repository lint is the AGENTS.md shell lint:
`shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`.

- `shellcheck` is not on `PATH`. It ran as the official static binary v0.10.0 from
  the koalaman/shellcheck GitHub release (`/tmp/shellcheck-v0.10.0/shellcheck`).
- Result at product `9f84ec7` (origin/main): **exit 0, no findings.**
- The repository has no JavaScript or TypeScript linter. The behavioral gates are
  the test suites and the extension typecheck. Baselines at `9f84ec7`:
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`: exit 0, 607/607
    pass.
  - `cd extension && npm ci && npm run typecheck && npm run test:unit`: exit 0,
    167/167 pass.
  - `cd extension && npm run test:electron` (under `xvfb-run -a`): exit 0, all four
    scenarios passed.
- Overlap decision: the baseline is green and this feature changes no shell file, so
  there is nothing to clean up. The gate is the full lint rerun (exit 0) plus every
  suite above, not a scoped gate.

**Concurrent deliveries.** `gh pr list --state open` returned no open PRs on
2026-10-21, so there is no file overlap.

## Approach

1. **CLI: richer `models list` entries (additive).** In `scripts/agento.mjs`, add two
   fields to each `models list` profile entry: `warnings` (the same `tierWarnings`
   output `show` reports) and `targets` (the same `[{ file, value }]` shape as
   `show`, or `[]` when the profile has errors). This lets the view render badges
   and tooltips from one CLI call instead of one `show` per profile. Existing fields
   are unchanged. Add `scripts/agento.test.mjs` coverage, document the fields in
   `docs/model-profiles.md`, and run `npm run copy-cli`.
2. **Pure model: `extension/src/modelProfilesTree.ts`.** No `vscode` import, unit
   tested.
   - `createModelProfilesModel(input)` takes the `models list` JSON or an error, plus
     the plugin-root state. It returns `{ state, profiles, messages, active,
     profilesFile }`. `state` is one of:
     - `no-plugin-root`: the `missingPluginRootMessage` case.
     - `no-file`: `profilesFile.exists: false`.
     - `error`: CLI failure or file-level `errors`, shown as message rows with the
       error text.
     - `ready`.
   - A `custom` `active` adds a leading info row: "Custom pins — no profile matches".
     Its tooltip says to Apply a profile or Clear.
   - `profileItemSpec(profile, active)` returns:
     - **label:** the name.
     - **description:** `applied · <description>` when `active === name`, otherwise
       the description.
     - **icon:** `pass-filled` (applied), `error` (has errors), `warning` (has
       warnings), or `symbol-misc`.
     - **contextValue:** `agento.modelProfile`, with a `.applied` and/or `.invalid`
       suffix.
     - **tooltip:** Markdown with the description, every error, every warning, and
       the pins summary.
   - `summarizePins(targets)` groups `targets` for the tooltip. It lists each
     `.github/agents/<name>.agent.md` value by agent name. Command files
     (`.github/prompts/*.prompt.md` and `skills/agento/commands/*.md` share a basename)
     are collapsed to one line per distinct value: `<value> — <n> commands`. A
     fallback list is rendered as `A → B`.
   - Name helpers: `validateProfileName(value, existing)` (`[a-z0-9-]+`, not
     existing) and `suggestCopyName(name, existing)` (`<name>-copy`, then
     `-copy-2`, …).
3. **Args and result helpers in `extension/src/modelProfiles.ts`.**
   - Arg builders for `create`, `rename`, `delete` (`--force` when applied), and
     `init`. Every write passes `--expect <profilesFile.hash>` from the snapshot the
     action was taken on, when a hash exists.
   - Extend `summarizeModelsResult` to give a clear message for `exists`,
     `not-found`, `active`, `conflict`, and `invalid`.
   - For `dirty`, return the file list separately so the caller can show it.
4. **Provider: `extension/src/modelProfilesProvider.ts`.** A `TreeDataProvider` over
   the model, mirroring `initiativeTreeProvider.ts`. It exposes `current` and
   `update(model)` and sets the context key `agento.modelProfiles.state`.
   - The provider returns no children in the `no-plugin-root` and `no-file` states.
     The `viewsWelcome` content then shows:
     - `no-file`: `[Create Profiles File](command:agento.modelProfiles.init)`.
     - `no-plugin-root`: the setting hint, with
       `[Open Settings](command:workbench.action.openSettings?%5B%22agento.pluginRoot%22%5D)`.
5. **Commands and wiring in `extension/src/extension.ts`.**
   - Extract the apply/clear body of `agento.selectModelProfile` into one
     `runModelsSelection(selection)` function. The quick pick and the view both call
     it.
   - On `dirty`, `runModelsSelection` shows an error that lists the dirty files, with
     two actions: **Open Output** (the full list is in the output channel) and **Show
     in Source Control** (`workbench.view.scm`). On success it reloads the view and
     calls `scheduler.refreshNow("model profile")`.
   - New commands:
     - `agento.modelProfiles.apply` (inline, `$(check)`, hidden on the applied row).
     - `agento.modelProfiles.duplicate`: name input prefilled by `suggestCopyName`,
       then `create <new> --from <row>`.
     - `agento.modelProfiles.rename`: name input prefilled with the current name.
     - `agento.modelProfiles.delete`: modal confirm. When the row is applied, the
       modal says the pins stay in the clone and will show as custom, and the
       command passes `--force`.
     - `agento.modelProfiles.edit`: opens the profiles file with the cursor on the
       profile's `"<name>":` key.
     - `agento.modelProfiles.new` (title, `$(add)`): name input, then a quick pick
       of "Empty profile" or "Copy from <profile>…".
     - `agento.modelProfiles.clear` (title, `$(clear-all)`).
     - `agento.modelProfiles.openFile` (title overflow).
     - `agento.modelProfiles.init` (welcome).
     - Title-bar Refresh reuses `agento.refresh`.
   - Reload model profiles with `models list --plugin-root <root>`:
     - on every `scheduler.onDidRefresh`, which covers `agento.refresh`, activation,
       and post-apply;
     - from a dedicated debounced reload (about 500 ms) fed by file watchers;
     - when the view becomes visible, and on window focus.
   - Reloads run through a latest-wins guard (the `LatestDeliveryRefresh` pattern).
     They never trigger the full `dashboard` refresh.
   - Watchers use absolute `RelativePattern`s, rebuilt whenever the profiles-file
     path or the plugin root changes:
     - `new vscode.RelativePattern(vscode.Uri.file(dirname(profilesFile.path)),
       "model-profiles.json")`;
     - `new vscode.RelativePattern(vscode.Uri.file(pluginRoot),
       ".github/agents/*.agent.md")`, so an apply from another window or a terminal
       updates the *applied* marker.
   - On a `conflict` result: show "The profiles file changed since the view loaded —
     refreshed; try again" and reload.
   - Every view command handles the missing-plugin-root case with
     `missingPluginRootMessage`.
   - Add `modelProfiles: ModelProfilesProvider` to `ExtensionApi`.
6. **Contributions in `extension/package.json`.**
   - The `agento.modelProfiles` view goes in the `agento` container, after Session &
     Doctor.
   - Declare the commands with icons.
   - `view/title`:
     - `navigation`: New, Clear, Refresh. Clear is shown only when
       `agento.modelProfiles.state == ready`.
     - Overflow: Open Profiles File.
   - `view/item/context`:
     - Inline Apply when `viewItem =~ /^agento\.modelProfile(\.invalid)?$/`, so it is
       hidden on applied rows and shown on invalid rows, where the CLI's `invalid`
       message explains the failure.
     - Context menu: Edit, Duplicate, Rename, Delete.
   - `viewsWelcome` entries for the two empty states.
   - `commandPalette` `when: false` for the row-only commands.
   - The electron command-registration test is updated to match.
7. **Electron coverage, isolated.**
   - `extension/test/electron/runTest.ts` creates, per scenario:
     - a temp `AGENTO_CONFIG_HOME`, passed in `extensionTestsEnv` for **every**
       scenario so no test can touch the developer's real profiles file;
     - a temp git plugin clone. It holds a copy of the files `models` reads
       (`.claude-plugin/plugin.json`, `.github/agents`, `.github/prompts`,
       `skills/agento/commands`, and `templates/model-profiles.json`), committed
       once and passed as `AGENTO_E2E_PLUGIN_ROOT`.
   - The in-repo scenario in `suite.ts` sets `agento.pluginRoot` to that clone, then:
     1. asserts the `no-file` welcome state and runs `agento.modelProfiles.init`;
     2. writes valid profiles through the CLI and checks that the view lists them;
     3. drives New, Duplicate, Rename, Apply (applied marker and changed pins), Clear,
        and Delete (including the applied `--force` path);
     4. checks the watcher: a profile created by a direct CLI call appears without an
        explicit refresh;
     5. checks the quick-pick path still applies through `runModelsSelection`.
   - Input boxes, quick picks, and modals are stubbed through a `setModelProfilePrompts`
     hook on `ExtensionApi`, following the existing `setNewPlanPrompts` pattern.
8. **Docs and release notes.**
   - `extension/README.md`: a new `## Model Profiles` section, plus the Commands list.
   - `docs/extension.md`: rewrite `## Model profiles` around the view and keep the
     quick-pick paragraph.
   - `docs/model-profiles.md`: the new `list` fields, and a pointer to the view from
     `## Editing profiles` and `## Applying and clearing`.
   - `CHANGELOG.md`: a `## 0.10.0 (unreleased)` **Added** entry.
   - Bump the version to `0.10.0` in the same five files as `2bf7c13`.

Affected files: `scripts/agento.mjs`, `scripts/agento.test.mjs`, `extension/cli/*`
(generated), `extension/src/{modelProfiles,modelProfilesTree,modelProfilesProvider,extension}.ts`,
`extension/test/unit/{modelProfiles,modelProfilesTree}.test.ts`,
`extension/test/electron/{runTest,suite}.ts`, `extension/package.json`,
`extension/package-lock.json`, `package.json`, `.claude-plugin/plugin.json`,
`extension/README.md`, `docs/extension.md`, `docs/model-profiles.md`, and
`CHANGELOG.md`.

## Risks

- **Electron tests writing real user state.** Today's `extensionTestsEnv` inherits
  `process.env`, so an apply or create in a test would hit
  `~/.config/agento/model-profiles.json` and the real plugin clone. Mitigation: a
  temp `AGENTO_CONFIG_HOME` for every scenario and a temp git plugin clone via
  `agento.pluginRoot`. A suite assertion checks that `profilesFile.path` starts with
  the temp dir before any write.
- **Watching files outside the workspace.** `createFileSystemWatcher` with an
  absolute `RelativePattern` is supported but non-recursive, and it can miss events
  on some file systems. Mitigation: the patterns are single-directory globs, and the
  view also reloads on visibility, on window focus, after every action, and on
  `agento.refresh`.
- **Clone-wide apply surprises another window.** Apply rewrites pins every window on
  that clone reads. Mitigation: per Q1, Apply is an explicit inline button and a row
  click does nothing destructive. The *applied* marker updates in other windows
  through the agent-file watcher. Per-window roles are `role-active-profiles`.
- **Stale writes from two windows.** Mitigation: every write passes `--expect` with
  the snapshot hash, and a `conflict` reloads the view and tells the user to retry.
- **The `models list` payload grows** with `targets` per profile (about 56 entries
  each). Mitigation: it is local JSON on stdout, measured in kilobytes, and one
  `list` replaces N `show` calls.
- **Generated-copy drift.** Mitigation: `npm run copy-cli` after the CLI step, guarded
  by `tests/extension-bundle.test.mjs`.

## Out of scope

- The form-based editor (`model-profile-editor`). Edit opens the profiles file until
  it ships.
- Per-window-role active profiles and their sidebar badges (`role-active-profiles`,
  `role-profile-sidebar`).
- Chat model preselection (`chat-model-preselect`).
- Editing `copilotModels` aliases from the view (CLI `models alias` only).
- `models adopt` from the view.
- Any change to the CLI's write semantics, validation, or the pin filter.

## Acceptance checklist

- [ ] `models list` entries carry `warnings` and `targets`, matching `models show`
  for the same profile, and every existing field is unchanged. Verified by new
  `scripts/agento.test.mjs` cases, the full root suite passing, and
  `tests/extension-bundle.test.mjs` passing after `npm run copy-cli`.
- [ ] The pure model covers every state (`no-plugin-root`, `no-file`, `error`,
  `ready`, and `custom` active), row specs (applied, invalid, and warning icons and
  context values), the `summarizePins` grouping (including fallback lists), and the
  name validation and copy-name helpers. Verified by
  `extension/test/unit/modelProfilesTree.test.ts`.
- [ ] The extended `summarizeModelsResult` and the args helpers (`--expect`, `--force`
  on applied delete) are covered by `extension/test/unit/modelProfiles.test.ts`.
- [ ] The **Model Profiles** view is registered in the Agento container. It has the
  inline Apply action (hidden on the applied row), the context-menu Edit, Duplicate,
  Rename, and Delete actions, the title-bar New, Clear, Refresh, and Open Profiles
  File actions, and `viewsWelcome` content for both empty states. Verified by
  `extension/package.json` review and the electron command-registration assertions.
- [ ] Electron (in-repo scenario, temp `AGENTO_CONFIG_HOME` and temp plugin clone),
  each step driven through the registered commands:
  - init from the empty state;
  - New, Duplicate, and Rename update the list;
  - Apply moves the applied marker and changes the clone's pins;
  - Clear removes the marker;
  - Delete of the applied profile confirms and succeeds with `--force`;
  - a profile created by a direct CLI call appears through the watcher without a
    refresh;
  - the quick pick still applies.
- [ ] A dirty-clone Apply shows an error that lists the dirty files, with the Open
  Output and Show in Source Control actions, and a stale `--expect` reloads the view
  with the retry message. Verified by unit tests of the result summary and an
  electron case for the conflict path.
- [ ] No test writes outside its temp dirs. The electron suite asserts that the
  profiles-file path is under the temp `AGENTO_CONFIG_HOME` before any write, and
  `git status` in the product checkout is clean after the full electron run.
- [ ] Docs and release:
  - `extension/README.md`, `docs/extension.md`, and `docs/model-profiles.md` describe
    the view and the new `list` fields;
  - `CHANGELOG.md` has a `## 0.10.0 (unreleased)` Added entry;
  - the version is `0.10.0` in all five version files.

  Verified by review and `node --test tests/customizations.test.mjs`.
- [ ] Lint gate (§5, full rerun): `shellcheck scripts/hooks/*.sh
  scripts/wait-for-checks.sh` exits 0, as in the baseline. The following also exit
  0:
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`, with at least
    607 tests plus the new ones;
  - all guard smoke replays;
  - `cd extension && npm ci && npm run build && npm run typecheck && npm run
    test:unit && npm run test:electron`, with at least 167 unit tests plus the new
    ones and all four electron scenarios passing.
