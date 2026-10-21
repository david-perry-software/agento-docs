```yaml
status: in-progress
branch: feature/model-profile-crud-cli
last-updated: 2026-10-21
next-step: "2.8 preserve top-level key order and an existing empty copilotModels on every write (review round 1)"
initiative: "model-profile-manager"
artifact-pr: "#61"
```

## Phase 1: Pure helpers

- [x] 1.1 In `scripts/model-profiles.mjs`, add `serializeProfiles(data)` (2-space JSON plus a trailing newline, key order kept), `profilesHash(text)` (sha256 hex via `node:crypto`), and `aliasErrors(picker, id)` (the existing `copilotModels` value rules applied to both). Add tests to `scripts/model-profiles.test.mjs` for: round-trip stability, a known hash vector, and alias errors (empty, placeholder `<…>`, control character, valid) — verify: `node --test scripts/model-profiles.test.mjs` exits 0 with the new tests passing
- [x] 1.2 Add `createProfile(data, name, { from, description })`, `replaceProfile`, `renameProfile`, `deleteProfile`, `setAlias`, and `removeAlias` per plan.md `## Approach` item 1. All are pure, never mutate their input, preserve order, and do in-place replace and rename. Add tests to `scripts/model-profiles.test.mjs` for each, including:
  - position kept on replace and rename;
  - a `--from` copy is deep, so mutating the copy leaves the source unchanged;
  - `description` overrides a copied one;
  - `setAlias` creates `copilotModels` when absent and updates in place;
  - a frozen (`structuredClone` + `Object.freeze` deep) input is untouched;

  then run `cd extension && npm run copy-cli` — verify: `node --test scripts/model-profiles.test.mjs tests/extension-bundle.test.mjs` exits 0

## Phase 2: CLI verbs and write path

- [x] 2.1 Make `loadProfiles()` in `scripts/agento.mjs` return `raw` and `profilesFile.hash` (`null` when the file is absent), and add `copilotModels` to `models list` output. In `scripts/agento.test.mjs`, assert:
  - `profilesFile.hash` is `null` without a file;
  - after `writeProfiles`, it equals the sha256 of the file bytes;
  - `list` reports `copilotModels`.

  Then run copy-cli — verify: `node --test scripts/agento.test.mjs tests/extension-bundle.test.mjs` exits 0 and every pre-existing `models` test still passes
- [x] 2.2 Add the global options `--from <name>`, `--description <text>`, and `--expect <hash>` (64 lowercase hex) to the argument parser. Replace the `models` arity table with a per-verb spec (positional count, accepted options, writes): `list`, `pins`, `show`, `apply`, `adopt`, `clear`, `init`, `create`, `update`, `rename`, `delete`, `alias set`, `alias remove`. Verbs not yet implemented return a usage error until their step lands. Give `runWith` in `scripts/agento.test.mjs` an optional `input` (spawnSync `input`). Extend the models usage test (around line 3155): an option a verb does not accept, wrong arity for each new verb, a malformed `--expect`, `--from` with no value, and `alias` with an unknown sub-verb each exit 1. Then run copy-cli — verify: `node --test scripts/agento.test.mjs tests/extension-bundle.test.mjs` exits 0
- [x] 2.3 Implement `writeProfiles(loaded, next, { expect })` per plan.md `## Approach` item 2: re-read and hash compare (`conflict`), refuse file-level errors (`invalid`, file untouched), re-parse the serialized result, atomic temp-plus-fsync-plus-rename keeping the mode, temp cleanup on failure, and the `written`/`previousHash`/`reformatted`/`activeBefore`/`active` report. Implement `models create <name> [--from] [--description] [--expect]` on top of it. Tests in `scripts/agento.test.mjs`:
  - create on a missing file → a file with only that profile and no placeholders;
  - create empty, with `--from` (deep copy), and with `--description`;
  - `exists` and `not-found` (exit 3);
  - `--from` an invalid profile → `invalid`;
  - a stale `--expect` → `conflict` with the file byte-identical;
  - a matching `--expect` succeeds;
  - an unparseable file → `invalid` with the file byte-identical;
  - a hand-formatted file → `reformatted: true`;
  - no `.model-profiles.json.*.tmp` left in the directory;
  - file mode kept (chmod 600 before, 600 after);
  - create while the template's placeholder `mixed` profile exists still succeeds;

  then run copy-cli — verify: `node --test scripts/agento.test.mjs tests/extension-bundle.test.mjs` exits 0
- [x] 2.4 Implement `models update <name> [--dry-run] [--expect]`: stdin JSON, TTY stdin is a usage error, `not-found`, and `invalid` with `parseProfiles` plus `resolveProfile` errors (for example a `prompts.<custom-agent-prompt>` key, a placeholder, an unknown agent alias). `--dry-run` reports `errors`/`warnings`/`written: false`/`dryRun: true` and does not write. Updating the applied profile reports `activeBefore`/`active`/`reapply`. Tests include:
  - `init` then `update mixed` with real models succeeds while keeping position;
  - non-JSON and array input → `invalid`, file byte-identical;
  - a dry run leaves the file byte-identical;
  - a conflict between `show` (hash) and `update --expect` after an out-of-band write;
  - apply `a`, then update `a` → `active` turns `custom` and `reapply` is set;

  then run copy-cli — verify: `node --test scripts/agento.test.mjs tests/extension-bundle.test.mjs` exits 0
- [x] 2.5 Implement `models rename <old> <new>` and `models delete <name> [--force]` (both with `--expect`). Rename keeps the position, and `active` follows by content. Deleting the applied profile without `--force` → `status: active` (exit 3, message names `models clear` and `--force`, file byte-identical); with `--force` it deletes and `active` becomes `custom`. Tests:
  - `not-found` and `exists` for rename;
  - `not-found` for delete;
  - apply `a`, rename `a b` → `active: "b"`;
  - apply `a`, delete `a` → `active`, then with `--force` → deleted and `custom`;
  - deleting a non-applied profile succeeds;

  then run copy-cli — verify: `node --test scripts/agento.test.mjs tests/extension-bundle.test.mjs` exits 0
- [x] 2.6 Implement `models alias set <picker> <id>` and `models alias remove <picker>` (both with `--expect`): `aliasErrors` → `invalid`, unknown picker on remove → `not-found`, and the result reports `copilotModels`. Tests:
  - set on a file without `copilotModels`;
  - update an existing alias in place;
  - remove;
  - invalid id (`<x>`) and empty picker → `invalid`;
  - a picker with spaces and parentheses as one argument;
  - `models pins` picks up a new alias as `copilotModel`;

  then run copy-cli — verify: `node --test scripts/agento.test.mjs tests/extension-bundle.test.mjs` exits 0
- [x] 2.7 Update the header usage comment (`scripts/agento.mjs:32`) and the `models` usage messages to list every verb and option, and run copy-cli. Smoke the real CLI against a throwaway config home without touching the clone. Run `AGENTO_CONFIG_HOME=$(mktemp -d)`, then in order:
  1. `models create a --description x`
  2. `models show a` (keep the hash)
  3. `models update a --dry-run` and `models update a --expect <hash>`, each with JSON on stdin
  4. `models rename a b`
  5. `models alias set "Claude Opus 5.5 (copilot)" claude-opus-5.5`
  6. `models list`
  7. `models delete b`

  Record each status on this line — smoke statuses: 1 ok, 2 ok, 3 dry-run ok + expect ok, 4 ok, 5 ok, 6 ok, 7 ok — verify: every smoke call exits 0 with the expected `status`, `git status --porcelain --untracked-files=all` is empty apart from the intended `scripts/`/`extension/cli/` edits, and `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exits 0
- [ ] 2.8 (added 2026-10-21) Preserve the file's top-level key order and an existing empty `copilotModels: {}` on every write (review round 1, finding F1). In `scripts/agento.mjs` the `create`/`update`/`rename`/`delete` verbs (lines 4854–4904) build `next` as `{ profiles, copilotModels? }`, so after `models init` (the template is `copilotModels` first) the first CRUD write flips the top-level order to `profiles`, `copilotModels` and drops an empty map, while `reformatted` stays `false` — contradicting plan.md Q4 ("key order kept"), Approach item 1, acceptance item 5, and `docs/model-profiles.md:98`. Build `next` from the parsed file's own key order (e.g. spread `JSON.parse(loaded.raw)` or iterate its `Object.keys`) and keep an existing `copilotModels` key even when empty; `alias set`/`alias remove` and a brand-new file keep `profiles` first. Add tests in `scripts/agento.test.mjs`: `init` then `create` leaves top-level keys `["copilotModels","profiles"]`; a file with `copilotModels: {}` keeps the key after `create`; a `profiles`-first file stays `profiles`-first. Optionally drop the dead `IMPLEMENTED_MODEL_VERBS` scaffold (F3). Then run `cd extension && npm run copy-cli` — verify: `node --test scripts/agento.test.mjs tests/extension-bundle.test.mjs` exits 0 and a manual `AGENTO_CONFIG_HOME=$(mktemp -d)` replay of `models init` → `models create x` keeps `copilotModels` as the first top-level key. Also remove the dead `IMPLEMENTED_MODEL_VERBS` scaffold (finding F3).
- [ ] 2.9 (added 2026-10-21) Restore `extension/package.json` to its `origin/main` formatting so only the `"version"` line changes (review round 1, finding F2). The `npm version` bump in step 3.3 expanded ~100 one-line `defaults` objects; the precedent bump `8c81f88` changed only the version line. Reapply `origin/main`'s file with `"version": "0.9.0"` as the only change, and keep `extension/package-lock.json` at its minimal two-line version change — verify: `git diff origin/main -- extension/package.json` shows only the version line and `git diff origin/main -- extension/package-lock.json` shows only the two version lines
- [ ] 2.10 (added 2026-10-21) Document the purely-numeric profile-name limit in `docs/model-profiles.md` `## Limits` (review round 1, finding F4): JSON serializes integer-like keys first regardless of insertion order, so a name like `42` is hoisted to the front of `profiles` and its position is not preserved — verify: `grep -n "purely numeric" docs/model-profiles.md` prints a line

## Phase 3: Command, docs, and release

- [x] 3.1 Update `.github/prompts/models.prompt.md` and copy it byte for byte to `skills/agento/commands/models.md`. Cover `description`, `argument-hint` (every verb), step 1 parsing, and step 3 reporting for `create`/`update`/`rename`/`delete`/`alias`. `update` is driven through `show` (hash) → `update --dry-run` (heredoc stdin) → `update --expect <hash>`. Step 4 covers the findings `exists`/`active`/`conflict`/`invalid`, and the `next:` rules cover `reapply` → `/agento models apply <name>` and other writes → `/agento models`. Never hand-edit the file, and keep `Needs: terminal` — verify: `cmp .github/prompts/models.prompt.md skills/agento/commands/models.md` exits 0 and `node --test tests/customizations.test.mjs` exits 0
- [x] 3.2 Add `## Editing profiles` to `docs/model-profiles.md` after "The profiles file". Cover each verb, `profilesFile.hash`/`--expect`/`conflict`, atomic writes and `reformatted`, the active-profile rules (rename follows; delete needs `--force`; update sets `reapply`; clone-scoped), and the exit-3 statuses, and mention `create` next to `init` in "The profiles file". Update the `README.md` command-table row for `/agento models` — verify: `grep -n "## Editing profiles" docs/model-profiles.md` and `grep -n "models.*create" README.md` each print a line, and `node --test tests/customizations.test.mjs` exits 0
- [x] 3.3 Bump the version to 0.9.0 in `package.json` and `.claude-plugin/plugin.json`, and run `cd extension && npm version 0.9.0 --no-git-tag-version` (updates `extension/package.json` and `extension/package-lock.json`). Add `## 0.9.0 (unreleased)` at the top of `CHANGELOG.md` with an **Added** entry for the CRUD verbs, `--expect`, `profilesFile.hash`, and `copilotModels` on `list` — verify: `grep -n '"version": "0.9.0"' package.json .claude-plugin/plugin.json extension/package.json` prints three lines, `sed -n 1,5p CHANGELOG.md` shows the unreleased heading, and `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exits 0

## Phase 4: Final gate

- [x] 4.1 Integrate `origin/main` by merge into both halves (product `feature/model-profile-crud-cli`, companion same branch), run `cd extension && npm run copy-cli`, then run the full gate:
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`;
  - the five guard smoke replays from AGENTS.md;
  - `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` (install the static v0.10.0 binary to `/tmp` if `shellcheck` is missing, as in plan.md `## Research`).

  Record pass counts on this line — 604/604 tests pass, 5 guard smoke replays exit 0, shellcheck 0 findings — verify: every command exits 0, the test count is ≥ 566 plus the new tests, and shellcheck reports no findings (matches the baseline)
- [x] 4.2 Run the extension regression check: `cd extension && npm ci && npm run build && npm run typecheck && npm run test:unit && npm run test:electron`, and record unit pass and electron scenario counts on this line — 167 unit tests pass, 4 electron scenarios pass (in-repo, companion, workspace, no-markdown) — verify: every command exits 0, and `git status --porcelain --untracked-files=all` is empty in both halves after committing
