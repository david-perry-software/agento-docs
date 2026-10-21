# Model profile CRUD verbs: create, update, rename, delete, and alias editing in `agento.mjs models`

## Problem

Today the only way to create, change, rename, or delete a model profile is to
hand-edit `~/.config/agento/model-profiles.json`. `agento.mjs models` can list,
show, apply, adopt, clear, and `init`, and `init` is the only verb that writes the
profiles file (it copies the template once). Hand-editing is error-prone: a typo
invalidates the whole file. It is also what the rest of the initiative wants to
remove. The sidebar view, the form editor, and per-role profiles all need a
validated, conflict-safe CLI to write through.

This feature is the wave-1 member `model-profile-crud-cli` of the
[model-profile-manager breakdown](../../../../initiatives/2026/10/model-profile-manager/breakdown.md)
(block `### model-profile-crud-cli`). Brief: "We should be able create/edit/update
delete profiles." Summary: CLI verbs that create, update, duplicate, rename, and
delete profiles in the profiles file, validated and written atomically, exposed
through `/agento models`.

After this feature, a terminal or `/agento models` user can:

- create a profile, empty or copied from another;
- replace a profile with a new JSON body after a dry-run check;
- rename and delete profiles;
- add and remove `copilotModels` aliases.

All of this works without opening the JSON file. Every write is validated, atomic,
and guarded by an optional hash compare-and-swap (`--expect`).

## Decisions

The Planner asked these questions as a numbered list in chat on 2026-10-21. The
ask-questions tool was not available in this session (§10 fallback). The user's
answers are below verbatim, followed by the option each picked; every answer was
the recommended option.

- **Q1: Deleting or renaming the profile the clone currently has applied
  (`active`).** Answer: "1.a". Option A (recommended): Rename always works, and
  `active` follows it automatically. Deleting the active profile is refused with
  `status: active` (exit 3) unless you add `--force`. A forced delete leaves the
  pins in place, now reported as `custom`.
- **Q2: How `models update <name>` takes its input.** Answer: "2. a". Option A
  (recommended): The full profile object as JSON on stdin, with `--dry-run` to
  validate without writing. The whole file is validated before anything is saved.
- **Q3: Editing `copilotModels` aliases.** Answer: "3.a". Option A (recommended):
  Separate verbs: `models alias set "<picker name> (<vendor>)" <copilot-id>` and
  `models alias remove "<picker name> (<vendor>)"`. *Correction recorded during
  research:* the option text said `list` and `show` already report the aliases.
  They do not; they only use the map for warnings. This plan therefore adds the
  `copilotModels` map to `models list` output (Approach item 4), which is what the
  option promised.
- **Q4: Write safety and formatting.** Answer: "4. a". Option A (recommended):
  Every `models` JSON result includes `profilesFile.hash` (a sha256 of the file's
  bytes, or `null` when the file doesn't exist). Write verbs accept an optional
  `--expect <hash>` and return `status: conflict` (exit 3) if the file has changed
  since. Files are written as 2-space-indented JSON with a trailing newline and key
  order kept. Writes go to a temporary file and are then renamed into place. If the
  first write reformats a hand-formatted file, the result says
  `reformatted: true`.
- **Q5: Creating and duplicating profiles.** Answer: "5. a". Option A
  (recommended): `models create <name> [--from <profile>] [--description <text>]`.
  `--from` also covers duplicating a profile, so there's no separate `duplicate`
  verb. Creating a profile when the profiles file doesn't exist yet makes a new
  file with just that profile, without the template's `<…>` placeholders. Creating
  a name that already exists returns `status: exists` (exit 3).

Initiative-level decisions that bind this member (breakdown `## Decisions`):

- Q2 `webview-form`: the CLI stays the only writer of the profiles file.
- Q4 `cli-first`: CRUD verbs ship first.
- Q5: team-shared profiles are out of scope.

## Research

Skills consulted: none — no matching domain. This repository's AGENTS.md has no
`## Agento` skills table and there is no `.agents/skills/` directory. The suites are
`node:test`, so no installed test-framework skill applies.

**Lint baseline (§5).** The full-repository lint is the shell lint from AGENTS.md
and `package.json` `lint:hooks`, also run in CI (`.github/workflows/ci.yml`):

- Command: `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`.
- `shellcheck` is not installed on this machine. It ran as the official static
  binary v0.10.0, downloaded from the koalaman/shellcheck GitHub release to
  `/tmp/shellcheck-v0.10.0/shellcheck`.
- Result at product `8e4c41a` (origin/main): **exit 0, no findings.**
- Overlap decision: the baseline is green and this feature changes no shell file,
  so there is nothing to clean up. The gate is the full lint rerun (exit 0), not a
  scoped gate.
- The repository has no JavaScript linter. The test suites are the behavioral
  gate. Baseline: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exits
  0 with 566/566 passing.

**Concurrent-delivery overlap.** `gh pr list --state open` is empty in both
`david-perry-software/agento` and `david-perry-software/agento-docs`
(2026-10-21), so no open delivery overlaps.

**Current code.**

- `scripts/model-profiles.mjs` holds the pure helpers.
  - `profilesFile()` (line 12) resolves `AGENTO_CONFIG_HOME`, then
    `$XDG_CONFIG_HOME/agento`, then `~/.config/agento`.
  - `PROFILE_NAME` (line 8) is `/^[a-z0-9-]+$/`. The profile keys are
    `description`, `default`, `agents`, and `prompts`.
  - `parseProfiles(text)` (line 44) returns `{ profiles, copilotModels, errors }`.
    Errors prefixed `profiles.<name>` belong to that profile; any other error
    invalidates the whole file. `errorsFor(errors, name)` (line 100) splits them.
  - `valueErrors` (line 27) and the inline `copilotModels` checks (lines 58–70)
    define what a valid model value and alias are.
  - `detectActive` (line 347) decides `active` by content. It returns the first
    valid profile, in file order, whose rendering matches every pinned file.
    Otherwise it returns `custom`, or `null` when nothing is pinned. Consequences
    for this feature:
    - renaming an applied profile keeps it active under the new name;
    - deleting it, or updating it to new values, turns `active` into `custom`
      unless another identical profile exists.
- `scripts/agento.mjs`, the `case "models"` block (line 4697):
  - The verb table `{ list, pins, show, apply, adopt, clear, init }` has arity 0
    or 1, and names are checked against `[a-z0-9-]+`.
  - Every verb requires `--plugin-root` (default `PLUGIN_ROOT`) to contain
    `.github/agents`.
  - `init` is the only writer. It uses `copyFileSync` with `COPYFILE_EXCL`.
  - `apply`, `adopt`, and `clear` add the `worktree`, `git-too-old`, and `dirty`
    gates because they rewrite clone files.
- Helpers in `scripts/agento.mjs`:
  - `loadProfiles()` (line 3580) returns `{ profilesFile: { path, exists },
    profiles, copilotModels, errors }`.
  - `resolveProfile(loaded, name, layout)` (line 3589) adds the layout-dependent
    errors, for example a `prompts.<name>` key on a custom-agent prompt.
  - `modelsState()` (line 3606) derives `active`.
  - `modelsReport()` (line 3695) spreads `profilesFile`, `pluginRoot`, `active`,
    `legacySkipWorktree`, `filter`, `dirty`, and `hint` into every result.
  - `tierWarnings()` (line 3742) produces the BYOK-tier, vendor-suffix, and
    missing-alias warnings.
- Option parsing is global (`scripts/agento.mjs` around lines 98–140): `--force`
  and `--dry-run` already exist; `--from`, `--description`, and `--expect` do not.
  Stdin is already read for `--message-file -` and `--body-file -`.
- `models list` does **not** emit `copilotModels`. The map feeds only `pins`'
  `copilotModel` and the warnings.
- Consumers of `models` JSON:
  - `extension/src/extension.ts:533` (`models list`) and
    `extension/src/modelProfiles.ts:94–95` (`apply`/`clear`).
  - Doctor's `model-profile` check (`scripts/agento.mjs` around 947–1011).
  All new fields are additive, so they keep working.
- Tests:
  - `scripts/model-profiles.test.mjs` covers the pure helpers.
  - `scripts/agento.test.mjs` from line 3056 has `modelsFixture()`: a temporary
    plugin clone plus `AGENTO_CONFIG_HOME`. Its `runWith` (line 88) has no stdin
    input, so `update` tests need an `input` option.
  - `tests/extension-bundle.test.mjs` enforces that `extension/cli/` is a byte
    copy of `scripts/` (`cd extension && npm run copy-cli`).
  - `.github/prompts/models.prompt.md` and `skills/agento/commands/models.md` are
    byte-identical today.
  - `tests/customizations.test.mjs` enforces `Needs:` against `COMMAND_NEEDS`
    (`models: ["terminal"]`, line 1145) and forbids committed `model:` lines.
- Docs and release:
  - `docs/model-profiles.md` (sections: The profiles file, Resolution, Applying
    and clearing, The pin filter, …, Limits).
  - `README.md:443` (the command-table row).
  - The header usage comment at `scripts/agento.mjs:32`.
  - Release convention: a feature bumps the version in `package.json`,
    `.claude-plugin/plugin.json`, `extension/package.json`, and
    `extension/package-lock.json`, and adds `## <version> (unreleased)` to
    `CHANGELOG.md`, which `/agento ship` stamps. Examples: commits `8c81f88` and
    `dbd9ddf`. The current version is 0.8.0.

## Approach

All changes are in the product repository. The artifacts live in the companion
repository.

1. **Pure mutation helpers (`scripts/model-profiles.mjs`).** These are new exports
   with no `fs`. Each takes the parsed file object (`{ profiles, copilotModels? }`)
   and returns a new object; the input is never mutated.
   - `serializeProfiles(data)` → `JSON.stringify(data, null, 2) + "\n"`. Key order
     is insertion order, and `copilotModels` stays where it was.
   - `profilesHash(text)` → sha256 hex of the UTF-8 bytes (`node:crypto`).
   - `createProfile(data, name, { from, description })`:
     - The new profile is appended last.
     - With `from`, it is a deep copy of the source profile.
     - With `description`, that value is set or overrides the copied one.
     - Otherwise it is `{}`.
   - `replaceProfile(data, name, body)` replaces the profile in place and keeps its
     position.
   - `renameProfile(data, old, next)` rebuilds `profiles` with the same order and
     the key swapped.
   - `deleteProfile(data, name)`.
   - `setAlias(data, picker, id)` inserts a new alias or updates an existing one in
     place, creating `copilotModels` when absent. `removeAlias(data, picker)`
     removes one and leaves an empty `copilotModels: {}` in place.
   - `aliasErrors(picker, id)` reuses the `copilotModels` value rules: non-empty,
     no `<`/`>`, no control character. The picker name gets the same rules.
   - These helpers handle structure only. Callers check that names exist or are
     free, so a helper cannot fail halfway.
2. **Write path (`scripts/agento.mjs`, next to `loadProfiles`).**
   - `loadProfiles()` also returns `raw` (the file text or `null`) and
     `profilesFile.hash` (`profilesHash(raw)`, or `null` when absent). Because
     `modelsReport` spreads `profilesFile`, every `models` result carries
     `profilesFile.hash`.
   - New `writeProfiles(loaded, next, { expect })` runs these checks in order:
     1. Re-read the raw bytes. A hash different from `loaded`'s, or from
        `--expect` when given, → `status: conflict` (exit 3). The result carries
        `expected` and `actual`, and the file is untouched. An absent file never
        matches an `--expect` value.
     2. Refuse a current file with file-level errors → `status: invalid` (exit 3),
        file untouched. File-level errors are unparseable JSON, a non-object top
        level, unknown top-level keys, a bad `copilotModels` shape, or a
        non-object `profiles`.
     3. Serialize `next`. Re-parse it, and require that it introduces no new
        file-level errors and no errors for the profile or alias being written.
     4. Write `<dir>/.model-profiles.json.<pid>.<random>.tmp` with the existing
        file's mode, `fsync` it, and `rename` it over the target. On any error,
        unlink the temp file and return `status: failed` (exit 3, "re-send is
        safe"). `mkdir -p` the directory when the file is new.
   - The result reports:
     - `written` (boolean);
     - `previousHash` and `profilesFile.hash` (new);
     - `reformatted`: true when the previous bytes were not already
       `serializeProfiles(JSON.parse(raw))`, so the write also normalized
       formatting;
     - `activeBefore` and `active`, from `modelsState` before and after the write.
   - Other profiles' existing per-profile errors (for example the template's
     `<…>` placeholders left in `mixed` after `init`) do not block writes to a
     different profile. They are carried over unchanged and still reported by
     `list`. This keeps `init` → `update mixed` working.
3. **Verbs (`case "models"`).** Replace the arity table with a per-verb spec
   covering positional count, accepted options, and whether the verb writes.
   Options a verb does not accept are usage errors (exit 1). New parser options
   (around line 98): `--from <name>`, `--description <text>`, and
   `--expect <hash>` (must match `^[0-9a-f]{64}$`). Each takes a value that does
   not start with `--`.
   - `create <name> [--from <src>] [--description <text>] [--expect <hash>]`:
     - `exists` when the name is taken;
     - `not-found` when `--from` names no profile (quote `known`);
     - a missing file is created as `{ "profiles": { "<name>": … } }`, with no
       template and no placeholders;
     - the new profile is validated through `resolveProfile`, so a `--from` source
       with errors → `invalid`.
   - `update <name> [--dry-run] [--expect <hash>]`:
     - reads the full profile object from stdin;
     - when stdin is a TTY, it is a usage error ("update reads the profile JSON
       from stdin") instead of hanging;
     - non-JSON input, a non-object, or a profile with errors → `invalid` (exit 3)
       with `errors` from `parseProfiles` plus `resolveProfile` against the
       clone's layout;
     - `not-found` when the profile does not exist (`create` comes first);
     - `--dry-run` runs all validation and reports `errors`, `warnings`
       (`tierWarnings`), `written: false`, and `dryRun: true` without writing;
     - updating the active profile is allowed. When `active` changes, the result
       carries `reapply: "agento.mjs models apply <name> --plugin-root <root>"`.
   - `rename <old> <new> [--expect <hash>]`: `not-found` or `exists` checks; the
     position is kept, and `active` follows by content (`activeBefore` → `active`).
   - `delete <name> [--force] [--expect <hash>]`:
     - `not-found` when the profile does not exist;
     - when `modelsState().active === name` for the given `--plugin-root` and
       `--force` is absent → `status: active` (exit 3), with a message naming
       `agento.mjs models clear` or `--force`;
     - with `--force`, the profile is deleted and `active` becomes `custom` (or
       another identical profile).
   - `alias set <picker> <id> [--expect <hash>]` and
     `alias remove <picker> [--expect <hash>]`:
     - the picker is one argv element (quoted, may contain spaces and
       parentheses);
     - `aliasErrors` → `invalid`;
     - `remove` of an unknown picker → `not-found`;
     - results report the resulting `copilotModels`.
   - The write verbs touch only the user-level profiles file, never clone files.
     They therefore skip the `worktree`, `dirty`, and `git-too-old` gates and work
     from an Agento development worktree too. They still require a valid
     `--plugin-root`, because validation and `active` depend on its layout.
4. **Read verbs.** `list` adds `copilotModels`, which keeps the Q3 promise. Every
   result gains `profilesFile.hash`. Nothing existing is renamed or removed.
5. **Usage and help.** Update the header usage comment at `scripts/agento.mjs:32`
   and the `models` usage messages to list every verb.
6. **`/agento models` command** (`.github/prompts/models.prompt.md` and its
   byte-identical mirror `skills/agento/commands/models.md`):
   - `argument-hint`, `description`, step 1 verb parsing, step 3 reporting for
     each new verb, and step 4 for the new findings `exists`, `active`,
     `conflict`, and `invalid` on write. The command still never edits the file
     itself.
   - For `update`, the agent runs `models show <name>` and keeps `profilesFile.hash`.
     It composes the full profile object from the user's request, runs
     `update <name> --dry-run` with the JSON on stdin (heredoc), and shows the
     result. It then writes with `--expect <hash>`.
   - `next:` rules gain `/agento models apply <name>` after a write that sets
     `reapply`, and `/agento models` after the other writes.
7. **Docs and release.**
   - `docs/model-profiles.md`: a new `## Editing profiles` section after "The
     profiles file", covering each verb, `--expect`/`profilesFile.hash`, atomic
     write and formatting, active-profile rules, and exit-3 statuses. "The
     profiles file" mentions `create` as an alternative to `init`.
   - `README.md:443` command row.
   - Version 0.9.0 in `package.json`, `.claude-plugin/plugin.json`, and
     `extension/package.json` plus its lock (`npm version 0.9.0
     --no-git-tag-version` in `extension/`).
   - `CHANGELOG.md` `## 0.9.0 (unreleased)` with an **Added** entry.
   - `cd extension && npm run copy-cli` after every `scripts/` change.

Affected files: `scripts/model-profiles.mjs`, `scripts/model-profiles.test.mjs`,
`scripts/agento.mjs`, `scripts/agento.test.mjs`, `extension/cli/*` (generated),
`.github/prompts/models.prompt.md`, `skills/agento/commands/models.md`,
`docs/model-profiles.md`, `README.md`, `CHANGELOG.md`, `package.json`,
`.claude-plugin/plugin.json`, `extension/package.json`, and
`extension/package-lock.json`.

Verification target: none of these behaviors is a UI. Every step is verified with
CLI runs and `node:test`, so no `local:`/`dev-stack`/preview target applies.
Extension unit and electron tests run once at the end as a regression check that
the additive JSON fields break no consumer.

## Risks

- **Two writers at once** (two windows, or the later editor and the CLI).
  Mitigation: the hash is re-checked right before rename, `--expect`
  compare-and-swap with `status: conflict`, and atomic temp-plus-rename, so a
  reader never sees a half-written file. Without `--expect`, the last writer wins
  after a fresh re-read. This is documented, and `/agento models` always passes
  `--expect`.
- **The first write reformats a hand-formatted file** (JSON has no comments, but
  indentation and spacing change). Mitigation: `reformatted: true` in the result,
  documented. Key order and values are preserved.
- **`active` is clone-scoped.** The delete guard checks only the `--plugin-root`
  clone. Another clone with the same profile applied would turn `custom`.
  Mitigation: document it. Role-aware tracking arrives in `role-active-profiles`.
- **Breaking existing consumers of `models` JSON** (extension quick pick, doctor).
  Mitigation: changes are additive only (`profilesFile.hash`, `copilotModels` on
  `list`, new fields on the new verbs). The extension unit and electron suites run
  in the final phase.
- **Usage-parser regressions** for the existing verbs. Mitigation: the existing
  models usage test (`scripts/agento.test.mjs` around line 3155) stays green and
  is extended for the new verbs and options.
- **Version collision.** Another delivery could ship 0.9.0 first. Mitigation:
  integrate `origin/main` before every push. On a collision, move this entry to
  the next minor version and re-bump.
- **Generated-copy drift.** Mitigation: every `scripts/` step ends with
  `npm run copy-cli`, and `tests/extension-bundle.test.mjs` checks the byte
  equality.

## Out of scope

- The Model Profiles sidebar view, the webview editor, per-role active profiles,
  role-aware `models pins`, and chat-model preselection (later initiative members).
- Field-level edit flags (`--set`/`--unset`) for `update` (Q2 chose stdin JSON).
- A separate `duplicate` verb (Q5: `create --from` covers it).
- Making `--expect` mandatory (Q4).
- Changes to doctor's `model-profile` check, the pin filter, `apply`/`adopt`/`clear`
  semantics, or `copilotModels` resolution rules.
- Team-shared, per-project, or imported/exported profiles (initiative out of
  scope).

## Acceptance checklist

- [ ] `models create <name>` adds an empty profile, `--from <src>` deep-copies
  another, and `--description` sets the description. A taken name → `exists`
  (exit 3), an unknown `--from` → `not-found` (exit 3), and a missing profiles
  file is created with only the new profile. Verified by new tests in
  `scripts/agento.test.mjs`.
- [ ] `models update <name>` replaces the profile from stdin JSON in its original
  position. `--dry-run` validates without writing. Invalid JSON or schema/layout
  errors → `invalid` (exit 3) with the file byte-identical. Updating the applied
  profile reports `activeBefore`/`active` and `reapply`. A TTY stdin is a usage
  error. Verified by tests.
- [ ] `models rename` keeps the position and the applied profile stays `active`
  under the new name. `models delete` of the applied profile → `active` (exit 3)
  without `--force`, and deletes with it (`active` becomes `custom`). Both reject
  unknown or taken names. Verified by tests.
- [ ] `models alias set` adds or updates and `models alias remove` removes a
  `copilotModels` entry. Invalid picker names or ids → `invalid`, unknown picker on
  remove → `not-found`, and `models list` reports `copilotModels`. Verified by
  tests.
- [ ] Every `models` result carries `profilesFile.hash` (sha256 of the bytes, or
  `null`). Every write verb honors `--expect` with `status: conflict` (exit 3) and
  leaves the file untouched. Writes are atomic (no leftover temp file, the mode is
  kept), output is 2-space JSON with a trailing newline and key order preserved,
  and `reformatted` is reported. A file with file-level errors is refused without
  being clobbered. Verified by tests, including a conflict test that changes the
  file between `show` and `update`.
- [ ] Pure helpers in `scripts/model-profiles.mjs` are unit-tested in
  `scripts/model-profiles.test.mjs` (serialize, hash, create, replace, rename,
  delete, alias set and remove, aliasErrors, no input mutation).
- [ ] Unsupported options per verb and bad arities are usage errors (exit 1), and
  every existing `models` test still passes unchanged.
- [ ] `/agento models` (prompt and mirror, byte-identical) documents and reports
  every new verb and finding, and drives `update` through `show` → `--dry-run` →
  `--expect`. Verified by `cmp` and `node --test tests/customizations.test.mjs`.
- [ ] `docs/model-profiles.md` has the `## Editing profiles` section,
  `README.md`'s command row and the `scripts/agento.mjs` usage comment list the new
  verbs, and `CHANGELOG.md` carries `## 0.9.0 (unreleased)` with the version bumped
  in `package.json`, `.claude-plugin/plugin.json`, `extension/package.json`, and its
  lock. Verified by reading the files and `grep`.
- [ ] `extension/cli/` is a byte copy of `scripts/`
  (`node --test tests/extension-bundle.test.mjs`).
- [ ] Lint gate (§5, full rerun): `shellcheck scripts/hooks/*.sh
  scripts/wait-for-checks.sh` exits 0 as in the baseline. The full suite
  `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exits 0 with at least
  566 tests plus the new ones, and all guard smoke replays pass. `cd extension &&
  npm ci && npm run build && npm run typecheck && npm run test:unit && npm run
  test:electron` exits 0.
