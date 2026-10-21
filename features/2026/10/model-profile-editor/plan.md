# Model profile editor: a webview form that creates and edits profiles through the CLI

## Problem

The **Model Profiles** sidebar view (`model-profiles-view`, shipped in 0.10.0) can
apply, create, duplicate, rename, and delete profiles. Its **Edit** action still opens
`model-profiles.json` and puts the cursor on the profile key
(`extension/src/extension.ts:843-854`, `openProfilesFile`). To change what a profile
pins, the user has to hand-edit JSON. That means knowing the six agent aliases, which
commands can carry their own pin, the qualified `<name> (<vendor>)` model form, and the
fallback-list syntax. Mistakes only show up as CLI `invalid` results after saving.

This feature adds a form editor in a webview panel. It edits the profile's name,
description, default model, the six agent pins, and per-command overrides. Each value
is a single model or an ordered fallback list. Model choices come from the models VS
Code knows about (`vscode.lm.selectChatModels()`), and free text is always allowed.
Errors and warnings from a CLI dry run appear as you type. **Save** and **Save &
Apply** write only through the CLI (`models update` / `rename`). A concurrent change
to the profiles file shows a conflict banner instead of overwriting it. The view's
Edit, New, and Duplicate actions open the editor, and so does a new *Agento: Edit
Model Profile* palette command.

This is the `model-profile-editor` member of the
[model-profile-manager initiative](../../../../initiatives/2026/10/model-profile-manager/breakdown.md)
(its `### model-profile-editor` block, wave 3). Brief: "We should be able
create/edit/update delete profiles."

## Decisions

The ask-questions tool was not available in this session, so the Planner asked these
on 2026-10-21 as a numbered list in chat (the §10 fallback). The user answered
"1. a 2. a 3. a 4. a 5. a". Every answer is the recommended option, and the option
text is quoted verbatim below.

- **Q1: Where do the model choices come from?** A: `a` — "Every model
  `vscode.lm.selectChatModels()` returns (all vendors, including BYOK), grouped by
  vendor and shown as `<name> (<vendor>)`; free text always allowed; an empty list
  shows a 'type a model name' hint" (recommended).
- **Q2: How are per-command pins (`prompts.<command>`) shown?** A: `a` — "A 'Command
  overrides' section listing only the pins that are set, with an 'Add override'
  picker offering the commands the CLI reports as pinnable (a new additive
  `pinnable` field on `models list`); unset commands inherit `default`"
  (recommended).
- **Q3: `copilotModels` aliases in the editor?** A: `a` — "Next to each chosen model,
  show its current alias, or the alias suggested when `vscode.lm` gives a Copilot
  id, with an 'Add alias' action that runs `models alias set`; no general alias
  editing in the panel" (recommended).
- **Q4: Unsaved edits and `--expect` conflicts?** A: `a` — "One panel per profile
  (revealed if already open), a ● dirty marker in its title, the draft kept in the
  webview state; on a conflict a banner names the changed fields with 'Reload'
  (discard the draft and load the latest version) — no overwrite" (recommended).
- **Q5: How is the editor verified before review?** A: `a` — "Unit tests for the
  pure form model (profile↔form mapping, message-schema validation, alias
  derivation, CSP/nonce HTML); an electron test that opens the panel through the
  commands and drives the host message handler through an `ExtensionApi` test hook
  against a temp `AGENTO_CONFIG_HOME` and temp plugin clone (load, dry-run, Save,
  rename, Save & Apply, conflict); plus a headless-browser screenshot of the form HTML
  with a stubbed `acquireVsCodeApi` saved under `evidence/`. No manual step"
  (recommended).

Carried over from the initiative breakdown: the editor reads through `models show` /
`list` and writes only through `models update` / `create` (plus `rename` and `alias
set`), adds no new storage, and is the first script-enabled webview (strict CSP with
a nonce, no remote resources, schema-checked messages). The CLI exposes which commands
can carry their own pin, so the form never hard-codes the list.

## Research

Skills consulted: none — no matching domain. This repository's AGENTS.md has no
`## Agento` skills table, there is no `.agents/skills/` directory, and the available
skills (Python, Railway, agent customization, the `agento` router) do not cover VS
Code webview work.

**Profile schema** (`scripts/model-profiles.mjs:9-27`, `:102-169`).

- The file is `{ profiles: { <name>: Profile }, copilotModels?: { <picker>: <id> } }`.
  Any other top-level key is an error.
- `Profile` is `{ description?, default?, agents?: { <alias>: Value }, prompts?: {
  <command>: Value } }`. Any other key is an error.
- `Value` is a non-empty string or a non-empty array of non-empty strings (a fallback
  list). Values with `<`/`>` or control characters are rejected.
- The agent aliases are fixed (`AGENT_ALIASES`): `planner`, `builder`, `reviewer`,
  `autopilot`, `mechanic`, `architect`.
- `copilotModels` is top level, not part of a profile. It maps a qualified picker
  name to a Copilot `task` id: a bare id for Copilot-hosted models, `<vendor>/<id>`
  for BYOK (`docs/model-profiles.md:43-52`).

**CLI contract** (`scripts/agento.mjs`, `case "models"`, verb table at `:4792-4813`).

- `show <name>` (`:4868-4877`) returns `description`, the resolved `targets[]`,
  `errors`, `warnings`, and the common report (`profilesFile { path, exists, hash
  }`, `active`, …). It does **not** return the stored profile body (`default`,
  `agents`, `prompts` as written). The form needs that body.
- `list` (`:4845-4866`) returns `profiles[]` as `{ name, description, errors,
  warnings, targets }`, top-level `copilotModels`, and file-level `errors`. Nothing
  in it says which commands can be pinned.
- `update <name>` (`:4893-4915`) reads the full profile object from stdin. It returns
  `not-found` for a missing profile, so an unsaved new profile cannot be dry-run.
  - `--dry-run` reports `errors`, `warnings`, `dryRun: true`, and `written: false`.
  - A real write accepts `--expect <sha256>` and answers `conflict` on a stale hash.
  - Updating the applied profile adds `reapply` to the result.
- `rename <old> <new> --expect` and `alias set "<picker> (<vendor>)" <id> --expect`
  are separate writes. Every write is validated and atomic (temp file, fsync,
  rename) (`docs/model-profiles.md:71-109`).
- **Pinnable commands** are derived, not exposed. `resolveTargets`
  (`scripts/model-profiles.mjs:215-251`) treats a prompt as pinnable unless its
  `agent:` is a custom agent known by `name:` (`agent && agent !== "agent" &&
  byName.has(agent)`). Setting `prompts.<command>` on a custom-agent command is an
  error. `modelTargetFiles` (`scripts/agento.mjs:3575-3590`) supplies `{ agents,
  prompts: [{ file, name, agent }] }` as `state.layout` in `modelsState`
  (`:3701-3726`).

**Extension today.**

- `CliClient.run(args, root, { timeoutMs })` (`extension/src/cliClient.ts:63-90`)
  uses `execFile` and cannot pass stdin. No extension code calls `models update`.
- Model profile helpers are in `extension/src/modelProfiles.ts`: arg builders
  `createProfileArgs`, `renameProfileArgs`, `deleteProfileArgs`, and
  `initProfilesArgs`, plus `summarizeModelsResult` (`:80-151`). The tree model is
  `modelProfilesTree.ts` and the provider is `modelProfilesProvider.ts`.
- Commands are registered at `extension.ts:764-856`.
  - `new` (`:773-790`) asks for a name, then Empty or Copy from…, then runs
    `create`.
  - `edit` (`:843-854`) runs `openProfilesFile`.
  - `ExtensionApi` (`:49-90`) exposes `modelProfiles` and the
    `setModelProfilePrompts` stub hook.
  - `runModelsSelection` is the shared apply path. It handles `dirty`, success
    reloads, and `scheduler.refreshNow`.
- The only webview is the window banner (`windowBannerProvider.ts:22-40`). Its
  scripts are disabled and its `localResourceRoots` is empty. There is no CSP or
  nonce helper to reuse.
- `vscode.lm` is not used anywhere. `engines.vscode` and `@types/vscode` are
  `^1.125.0` (`extension/package.json:13-15`), which is well above the 1.90 that
  `lm.selectChatModels` needs.
- `LanguageModelChat` exposes `id`, `name`, `vendor`, and `family`.
- Contributions live in `extension/package.json:50-300`:
  - `agento.modelProfiles.edit` has title "Edit", appears in the view's
    `view/item/context` (`:243-246`), and is hidden from the palette (`:281-283`).
- Packaging: `extension/.vscodeignore` excludes `src/**`, `test/**`, `out/test/**`,
  and `out/src/**`, but not `media/**`. A webview script and stylesheet under
  `extension/media/` ship in the VSIX. `npm run test:vsix` smoke-tests an installed
  VSIX.
- Tests:
  - Unit tests are in `extension/test/unit/*.test.ts` (compiled to
    `out/test/unit`, run by `node --test`), including `modelProfiles`,
    `modelProfilesTree`, and `cliClient`.
  - Electron tests are in `extension/test/electron/{runTest,suite}.ts`. Since
    `model-profiles-view`, every scenario gets a temp `AGENTO_CONFIG_HOME`, and the
    in-repo scenario drives the model-profile commands against a temp plugin clone
    (`AGENTO_E2E_PLUGIN_ROOT`).
  - The root CLI tests are `scripts/agento.test.mjs` and
    `scripts/model-profiles.test.mjs`. `tests/extension-bundle.test.mjs` requires
    `extension/cli/` to be a byte copy of `scripts/` (`npm run copy-cli`).
- Docs:
  - `docs/model-profiles.md` `## Editing profiles` (`:71-120`);
  - `docs/extension.md` `## Model profiles` (`:302-320`);
  - `extension/README.md` `## Model Profiles` (`:68-90`);
  - `CHANGELOG.md`, whose top section `## 0.10.0 (2026-10-21)` is stamped.
  - The version is `0.10.0` in `package.json`, `extension/package.json`, and
    `.claude-plugin/plugin.json`. Each member feature has bumped the minor version
    (0.9.0, 0.10.0), so this one moves to `0.11.0`.
- Per-slug ports (`agento.mjs ports model-profile-editor`): `WEB_PORT` 3177, used to
  serve the webview harness for the screenshot evidence.

**Lint baseline (§5)**, run in the product checkout at `956eace` (`origin/main`) on
2026-10-21:

- Full-repository lint (the AGENTS.md shell lint): `shellcheck scripts/hooks/*.sh
  scripts/wait-for-checks.sh`.
  - `shellcheck` is not on `PATH`, so it ran as the official static binary v0.10.0
    at `/tmp/shellcheck-v0.10.0/shellcheck`.
  - Result: **exit 0, no findings.**
- The repository has no JavaScript or TypeScript linter. The behavioral gates are the
  suites and the extension typecheck:
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`: exit 0, 609/609
    pass.
  - `cd extension && npm ci && npm run typecheck && npm run test:unit`: exit 0,
    183/183 pass.
  - `cd extension && npm run test:electron` (on `DISPLAY=:0`, since `xvfb-run` is
    not installed on this machine): exit 0, all four scenarios passed (in-repo,
    companion, workspace, no-markdown).
- Overlap decision: the baseline is green and this feature changes no shell file, so
  there is nothing to clean up. The gate is the full lint rerun (exit 0) plus every
  suite above. It is not a scoped gate.

**Concurrent deliveries.** `gh pr list --state open` returned no open PRs in
`david-perry-software/agento` or `david-perry-software/agento-docs` on 2026-10-21, so
there is no file overlap. `role-active-profiles` (wave 4, `ready`) will also touch
the `models` dispatch, `docs/model-profiles.md`, and `CHANGELOG.md` if it is planned
in parallel.

## Approach

1. **CLI: additive read fields** (`scripts/model-profiles.mjs`,
   `scripts/agento.mjs`).
   - Export `isPinnablePrompt(prompt, agentNames)` from `model-profiles.mjs`, with
     the exact rule `resolveTargets` uses, and make `resolveTargets` call it so the
     two cannot drift.
   - `models list` gains top-level `pinnable: { agents: [<the six aliases>],
     prompts: [<sorted pinnable command names>] }`, computed from `state.layout`.
     It is reported even when there is no profiles file.
   - `models show <name>` gains `body`: the stored profile object exactly as it is in
     the file (`{}` for an empty profile).
   - Existing fields are unchanged. Add tests to `scripts/model-profiles.test.mjs`
     and `scripts/agento.test.mjs`, document both fields in `docs/model-profiles.md`,
     and run `npm run copy-cli`.
2. **CliClient stdin** (`extension/src/cliClient.ts`).
   - `CliRunOptions` gains `input?: string`. When it is set, `run` writes it to the
     child's stdin and ends the stream. When it is unset, stdin is closed
     immediately, so an accidental `update` without input fails fast instead of
     hanging until the timeout.
   - Add `updateProfileArgs(name, { dryRun, expect })` and `aliasSetArgs(picker, id,
     expect)` to `modelProfiles.ts`. Extend `summarizeModelsResult` for the
     `update`, `rename`, and alias results, including `reapply`.
   - Extend the unit tests in `cliClient.test.ts` and `modelProfiles.test.ts`.
3. **Pure editor model: `extension/src/profileEditorModel.ts`** (no `vscode`
   import, unit-tested).
   - `profileToForm(body, pinnable)` and `formToProfile(form)` convert between the
     profile body and the form.
     - Every value becomes an ordered `string[]`. A one-item list is written back as
       a string.
     - Empty entries are dropped. Empty `agents`/`prompts` objects and an empty
       `description`/`default` are omitted.
     - Key order is stable: `description`, `default`, `agents` in alias order, then
       `prompts` in insertion order.
     - An unknown key in the stored body is kept and reported as a form-level notice,
       so a hand-edited key is never silently dropped.
   - `modelChoices(models)` turns `{ id, name, vendor, family }[]` into choices
     grouped by vendor, labelled `<name> (<vendor>)`, sorted, and de-duplicated.
   - `suggestAlias(choice)`:
     - vendor `copilot` → `id`;
     - an id already containing `/` → `id`;
     - any other vendor → `<vendor>/<id>`;
     - `null` when there is no id.
   - `aliasStatus(value, copilotModels, choices)` returns `existing`, `suggested`
     (with the id), or `none`.
   - `parseWebviewMessage(raw)` validates every webview→host message against a closed
     schema. The types are `ready`, `change` (form plus dirty flag), `validate`,
     `save`, `saveAndApply`, `addAlias`, `reload`, and `openFile`. Any message with an
     unknown type, extra keys, or values of the wrong type is rejected and logged,
     never acted on.
   - `diffFields(base, latest)` lists the changed field paths for the conflict
     banner.
   - `validateRename(name, existing)` reuses `validateProfileName`.
4. **Webview HTML and assets.**
   - `extension/src/profileEditorHtml.ts` exports `renderEditorHtml({ nonce,
     cspSource, scriptUri, styleUri, title })`.
     - Its CSP is `default-src 'none'; style-src ${cspSource}; script-src
       'nonce-${nonce}'; img-src ${cspSource} data:; font-src ${cspSource}`.
     - It has no inline handlers and no remote URLs.
     - `makeNonce()` uses `crypto.randomBytes`.
   - The form script `extension/media/profileEditor.js` is plain browser JS with
     `// @ts-check`. It:
     - renders the form from host `state` messages;
     - keeps the draft and the base hash in `vscode.setState`;
     - shows the dirty state;
     - debounces (about 400 ms) `validate` posts while typing;
     - renders errors and warnings, the conflict banner (changed fields plus
       Reload), and the alias hint with **Add alias**;
     - posts only schema-conforming messages.
   - Each model field is a text input bound to a `<datalist>` of the vendor-grouped
     choices, so free text always works. A value can grow into an ordered fallback
     list with add, remove, move-up, and move-down controls.
   - An empty choice list shows the hint "No models reported by VS Code — type a model
     name such as `Claude Opus 4.5 (copilot)`".
   - The "Command overrides" section lists only the overrides that are set, plus an
     **Add override** select over the pinnable commands that are not yet used.
   - Styling is `extension/media/profileEditor.css` with VS Code theme variables.
5. **Panel host: `extension/src/profileEditorPanel.ts`.**
   - `ProfileEditorPanels` keeps one `WebviewPanel` per profile name and reveals an
     existing panel instead of opening a second one.
     - Panel options: `enableScripts: true`, `localResourceRoots: [<extension>/media]`,
       and no `retainContextWhenHidden`, because the draft lives in `setState`.
     - Panel title: `Profile: <name>`, prefixed with `● ` while the webview reports
       a dirty draft.
   - **Load** runs `models show <name>` (`body`, `hash`) and `models list`
     (`pinnable`, `copilotModels`, `profilesFile`), and gets models from a
     `ModelSource`. The default source wraps `vscode.lm.selectChatModels()` and is
     replaceable through a test hook. Load posts `state`.
   - **validate** runs `update <name> --dry-run` with the form body on stdin and
     posts the `errors` and `warnings`.
   - **save**:
     1. Dry-run first. Stop on errors.
     2. If the name changed: `rename <old> <new> --expect <hash>`, then re-key the
        panel and take the new hash from that result.
     3. `update <name> --expect <hash>` with the body on stdin.
     4. On success: post the new state, clear dirty, reload the tree view, and show
        `reapply` as an info message when the applied profile was edited.
   - **saveAndApply** saves, then calls the existing `runModelsSelection({ apply:
     <name> })`, so `dirty`-clone handling stays the same.
   - **conflict** (from any write) runs `models show` again and posts `conflict` with
     `diffFields(base, latest)`. The webview shows the banner, and only **Reload**
     (discard the draft and load the latest) clears it. There is no overwrite.
   - **addAlias** runs `alias set "<picker>" <id> --expect <hash>`. On success the
     panel takes the new hash, since a guarded write cannot hide a concurrent
     change. A conflict goes down the conflict path.
   - When the profiles-file watcher fires (`model-profiles-view`'s debounced reload),
     every open panel that is **not** dirty reloads. A dirty panel waits until Save
     shows the conflict. A panel whose profile disappeared shows a "deleted
     elsewhere" state that offers to close.
   - `handleMessage(name, message)` is exported for tests. Panels are disposed of
     with the extension.
6. **Commands and contributions** (`extension/src/extension.ts`,
   `extension/package.json`).
   - `agento.modelProfiles.edit` (row) opens the editor instead of the profiles file.
   - A new palette command `agento.editModelProfile` (*Agento: Edit Model Profile*)
     offers a quick pick of profiles, then opens the editor. It uses
     `missingPluginRootMessage` when no clone is found and offers `models init` when
     there is no file.
   - `agento.modelProfiles.new` and `duplicate` keep their name prompts and `create`
     call, then open the editor on the created profile.
   - **Open Profiles File** stays for raw editing, and the panel offers it as a link
     (`openFile`).
   - `ExtensionApi` gains `profileEditor` (open panel names, `handleMessage`, and the
     last posted state per panel) and `setProfileEditorModelSource`. The electron
     command-registration assertions gain `agento.editModelProfile`.
7. **Verification.**
   - Unit tests:
     - `extension/test/unit/profileEditorModel.test.ts`: round-trip, omission,
       fallback lists, unknown keys, choices, `suggestAlias`/`aliasStatus`, every
       message type accepted and malformed variants rejected, and `diffFields`.
     - `extension/test/unit/profileEditorHtml.test.ts`: the CSP string, the nonce on
       the only script tag, no `http(s):` URLs, and no inline `on*=` handlers.
   - In-repo electron scenario (temp `AGENTO_CONFIG_HOME`, temp plugin clone, stubbed
     `ModelSource`):
     1. Edit opens one panel, and a second Edit reveals the same one.
     2. Load posts `state` with `pinnable` and the stubbed choices.
     3. A dry run reports an error for a custom-agent command override.
     4. Save writes `body` (checked through `models show`).
     5. Rename plus Save re-keys the panel.
     6. Save & Apply changes the clone's `model:` lines.
     7. A stale hash posts `conflict` with the changed fields.
     8. `addAlias` writes `copilotModels`.
     9. New and Duplicate open the editor.
     10. *Agento: Edit Model Profile* opens via the stubbed quick pick.
   - Screenshot: `extension/test/webview/profileEditorHarness.html` loads
     `media/profileEditor.js` and `.css` with a stubbed `acquireVsCodeApi` and posts
     a fixture `state`. The fixture includes an error, a warning, a fallback list, a
     command override, an alias suggestion, and a conflict-banner variant selected by
     `?conflict=1`.
     - The Builder serves `extension/` on `local:3177` (`python3 -m http.server 3177
       --bind 127.0.0.1`).
     - It renders the harness in a headless browser.
     - It saves `evidence/step-6-2-editor-form.png` and
       `evidence/step-6-2-editor-conflict.png` in this slug directory.
8. **Docs and release.**
   - `docs/model-profiles.md` `## Editing profiles`: the editor and the `body` and
     `pinnable` fields.
   - `docs/extension.md` `## Model profiles`: the editor, Save / Save & Apply,
     conflicts, aliases, and the free-text and empty-model-list behavior.
   - `extension/README.md`: the `## Model Profiles` section and the Commands list.
   - `CHANGELOG.md`: a `## 0.11.0 (unreleased)` **Added** entry.
   - The version moves to `0.11.0` in `package.json`, `extension/package.json`,
     `extension/package-lock.json`, and `.claude-plugin/plugin.json`.

Affected files:

- CLI: `scripts/model-profiles.mjs`, `scripts/agento.mjs`,
  `scripts/model-profiles.test.mjs`, `scripts/agento.test.mjs`, and `extension/cli/*`
  (generated).
- Extension source: `extension/src/{cliClient,modelProfiles,profileEditorModel,profileEditorHtml,profileEditorPanel,extension}.ts`
  and `extension/media/profileEditor.{js,css}`.
- Extension tests: `extension/test/unit/{cliClient,modelProfiles,profileEditorModel,profileEditorHtml}.test.ts`,
  `extension/test/electron/suite.ts`, and
  `extension/test/webview/profileEditorHarness.html`.
- Manifests and docs: `extension/package.json`, `extension/package-lock.json`,
  `package.json`, `.claude-plugin/plugin.json`, `docs/model-profiles.md`,
  `docs/extension.md`, `extension/README.md`, and `CHANGELOG.md`.

## Risks

- **First script-enabled webview (security).** Mitigations:
  - a strict CSP with a per-render nonce, no remote content, and no inline handlers;
  - `localResourceRoots` limited to `extension/media`;
  - every inbound message checked by `parseWebviewMessage` (a closed schema; unknown
    messages are rejected and logged);
  - no file or shell access from the webview. Every write goes through the CLI, which
    validates again;
  - values are passed to the CLI as JSON on stdin or as `execFile` arguments, never
    through a shell.
  - Unit tests pin the CSP and the absence of remote URLs and inline handlers.
- **Rename plus update is two writes.** If `update` fails after a successful
  `rename`, the profile has its new name and its old content. Mitigations: a dry run
  validates the body before the rename; `update` uses the hash returned by `rename`,
  so nothing can slip in between; on failure the panel re-keys to the new name, keeps
  the draft, and shows the error, so Save can be retried.
- **`vscode.lm` metadata may not map cleanly** to qualified picker names or Copilot
  `task` ids, especially for BYOK vendors. It can also return nothing when Copilot is
  signed out or still loading. Mitigations:
  - free text is always allowed, and the CLI validates every value;
  - the alias is only a suggestion the user confirms with **Add alias**, and it is
    never written automatically;
  - an empty model list shows a hint;
  - the electron tests use a stubbed `ModelSource`, so they do not depend on Copilot
    sign-in.
- **Concurrent writers** (another window, the tree view, or a terminal). Mitigation:
  every write passes `--expect`. A conflict shows the changed fields, and the only
  way out is **Reload**, so another writer's change is never silently clobbered. The
  draft can still be copied from the form before reloading.
- **Lost drafts.** Without `retainContextWhenHidden`, a hidden panel is re-rendered.
  Mitigation: the draft and the base hash live in `vscode.setState` and are restored
  on re-render. Closing the panel discards the draft. That is documented, and the ●
  title marker makes it visible.
- **Breakdown order.** `model-profiles-view` is complete, so the Edit, New, and
  Duplicate entry points exist now. `role-active-profiles` (wave 4) may be planned
  concurrently and touches the `models` dispatch, `docs/model-profiles.md`, and
  `CHANGELOG.md`. Mitigation: integrate `origin/main` by merge before every push and
  keep the CLI changes additive.
- **Generated-copy drift.** Mitigation: `npm run copy-cli` after every CLI step,
  guarded by `tests/extension-bundle.test.mjs`.
- **Headless screenshot fidelity.** The harness renders the real script and CSS, but
  outside VS Code, so theme variables are stubbed. Mitigation: the screenshot is
  supporting evidence of layout and states. Behavior is verified by the electron
  suite, which the Reviewer re-runs.

## Out of scope

- Per-window-role active profiles and their sidebar presentation
  (`role-active-profiles`, `role-profile-sidebar`).
- Chat model preselection (`chat-model-preselect`).
- A general `copilotModels` alias table editor (Q3): only the per-value Add alias
  action. Removing aliases stays in the CLI (`models alias remove`).
- Editing several profiles in one panel, side-by-side diffs, or overwriting on a
  conflict (Q4).
- Any change to CLI write semantics, validation rules, resolution, the pin filter, or
  `models apply`.
- Team-shared, per-project, import/export, and cost-estimation features (initiative
  out of scope).

## Acceptance checklist

- [ ] CLI:
  - `models list` reports `pinnable: { agents, prompts }`, where `prompts` is exactly
    the commands `resolveTargets` lets a profile pin (custom-agent commands
    excluded), including when no profiles file exists;
  - `models show <name>` reports the stored `body`;
  - every existing field is unchanged;
  - `resolveTargets` and `pinnable` share `isPinnablePrompt`.

  Verified by new cases in `scripts/model-profiles.test.mjs` and
  `scripts/agento.test.mjs`, plus `tests/extension-bundle.test.mjs` after `npm run
  copy-cli`.
- [ ] `CliClient.run` passes `input` to the child's stdin and closes stdin when there
  is no input. `updateProfileArgs` and `aliasSetArgs` append `--dry-run` and
  `--expect` correctly. Verified by `extension/test/unit/cliClient.test.ts` and
  `modelProfiles.test.ts`.
- [ ] The pure editor model passes `extension/test/unit/profileEditorModel.test.ts`,
  which covers:
  - the profile↔form round trip, with a one-item list written as a string and empty
    fields omitted;
  - unknown stored keys preserved with a notice;
  - vendor-grouped choices;
  - `suggestAlias` and `aliasStatus` for Copilot, BYOK, already-qualified, and
    id-less models;
  - every message type accepted, and malformed or unknown messages rejected;
  - `diffFields`.
- [ ] `renderEditorHtml` emits the strict CSP, a nonce on its only script tag, no
  `http:`/`https:` URL, and no inline event handler. Verified by
  `extension/test/unit/profileEditorHtml.test.ts`.
- [ ] Editor behavior in the in-repo electron scenario (temp `AGENTO_CONFIG_HOME`,
  temp plugin clone, stubbed `ModelSource`):
  - row Edit opens one panel per profile, and a repeat Edit reveals it;
  - load posts `state` with `pinnable` and the stubbed choices;
  - a dry run surfaces CLI errors;
  - Save writes the body (confirmed through `models show`);
  - rename plus Save re-keys the panel;
  - Save & Apply changes the clone's `model:` lines;
  - a stale hash posts `conflict` with the changed fields and writes nothing;
  - Add alias writes `copilotModels`;
  - New and Duplicate open the editor on the created profile;
  - *Agento: Edit Model Profile* opens through its quick pick.
- [ ] The electron suite asserts that the profiles-file path is under the temp
  `AGENTO_CONFIG_HOME` before any write. `git status --porcelain
  --untracked-files=all` in the product checkout is empty after the full electron
  run.
- [ ] Visual evidence: `evidence/step-6-2-editor-form.png` and
  `evidence/step-6-2-editor-conflict.png` show:
  - the grouped model datalist;
  - a fallback list;
  - a command override;
  - inline errors and warnings;
  - the alias suggestion;
  - the conflict banner with only Reload.

  They are a headless render of the real `media/profileEditor.js`/`.css` through the
  committed harness on `local:3177`. The Reviewer re-renders the harness and captures
  their own screenshot.
- [ ] The VSIX ships the webview assets: `npm run package` succeeds, `unzip -l` on the
  VSIX lists `extension/media/profileEditor.js` and `profileEditor.css`, and `npm run
  test:vsix` passes.
- [ ] Docs and release:
  - `docs/model-profiles.md`, `docs/extension.md`, and `extension/README.md` describe
    the editor and the new `show`/`list` fields;
  - `CHANGELOG.md` has a `## 0.11.0 (unreleased)` Added entry;
  - the version is `0.11.0` in all four version files (both `package-lock.json`
    fields).

  Verified by review and `node --test tests/customizations.test.mjs`.
- [ ] Lint gate (§5, full rerun): `shellcheck scripts/hooks/*.sh
  scripts/wait-for-checks.sh` exits 0 with no findings, as in the baseline. The
  following also exit 0:
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`, with at least 609
    tests plus the new ones;
  - all five guard smoke replays from AGENTS.md;
  - `cd extension && npm ci && npm run build && npm run typecheck && npm run
    test:unit && npm run test:electron`, with at least 183 unit tests plus the new
    ones and all four electron scenarios passing.
