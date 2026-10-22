```yaml
status: in-progress
branch: feature/role-active-profiles
last-updated: 2026-10-22
next-step: "2.4 Keep roles consistent on rename and delete"
initiative: "model-profile-manager"
artifact-pr: "#64"
```

## Phase 1: Pure role helpers

- [x] 1.1 In `scripts/model-profiles.mjs`, add the following, per plan.md `## Approach` item 1:
  - `rolesFile(env, home)`: `model-roles.json` in the directory `profilesFile` resolves.
  - `parseRoles(text)`: returns `{ secondary, errors }`. The only allowed key is `secondary`, holding a `[a-z0-9-]+` name or `null`. Non-JSON, a non-object, an unknown key, or a bad value is an error.
  - `serializeRoles(data)`: 2-space JSON plus a trailing newline.
  - `ROLE_BUCKETS`.
  - `roleBucket(windowRole)`: `plan`/`build`/`freehand` → `secondary`; `primary`/`unmanaged`/anything else → `primary`.

  Add tests to `scripts/model-profiles.test.mjs` for:
  - path resolution under `AGENTO_CONFIG_HOME`, `XDG_CONFIG_HOME`, and home;
  - valid `{ "secondary": "x" }` and `{ "secondary": null }`;
  - unknown key, numeric value, uppercase name, array, and invalid JSON are errors;
  - the serialize round-trip;
  - `roleBucket` for all five window roles and an unknown value.

  Then run `cd extension && npm run copy-cli` — verify: `node --test scripts/model-profiles.test.mjs tests/extension-bundle.test.mjs` exits 0

## Phase 2: CLI

- [x] 2.1 In `scripts/agento.mjs`, add `loadRoles()` and `writeRoles(loaded, next, { expect })` per plan.md `## Approach` item 2. The writer re-reads and compares (`conflict`), checks `--expect`, refuses an invalid file and leaves it untouched (`invalid`), and writes atomically (`wx` temp named `.model-roles.json.*.tmp`, fsync, rename, mode kept, temp cleanup). Add `--role <value>` to the global option parser (values `primary`/`secondary`; anything else or a missing value is exit 1). Add `role` to the `models` accepted-option check. Make `models list` report `roles: { primary: <active>, secondary }`, `rolesFile`, and `rolesErrors`. Tests in `scripts/agento.test.mjs`:
  - `list` without a roles file → `roles.secondary: null` and `rolesFile.exists: false`;
  - `list` after `apply a` → `roles.primary: "a"`;
  - an invalid roles file → `rolesErrors` non-empty while `list` still exits 0;
  - `--role bogus` and `--role` with no value exit 1;
  - `--role` on a verb that does not accept it exits 1.

  Then run copy-cli — verify: `node --test scripts/agento.test.mjs tests/extension-bundle.test.mjs` exits 0 and every pre-existing `models` test still passes
- [x] 2.2 Implement `models use <name|none> --role <primary|secondary> [--expect]` per plan.md `## Approach` item 5. Factor the apply/adopt/clear tail (`scripts/agento.mjs` from `// apply | adopt | clear`, around line 4954) into a function that `apply`, `adopt`, `clear`, and `use --role primary` share. Reserve `none` in `create` and `rename`. Tests:
  - `use a --role secondary` writes `{ "secondary": "a" }` and reports `secondaryBefore`/`roles`/`written`;
  - `use none --role secondary` writes `null`;
  - `use missing --role secondary` → `not-found` (exit 3), and `use bad --role secondary` with an invalid profile → `invalid` (exit 3), both with no roles file written;
  - a stale `--expect` → `conflict` with the roles file byte-identical, while a matching one succeeds;
  - no `.model-roles.json.*.tmp` is left, and the mode is kept;
  - `use a --role primary` changes the same files as `apply a`, and `use none --role primary` the same as `clear`;
  - `use a --role primary` from a linked worktree → `worktree`;
  - `use a` without `--role`, and `use a --role primary --expect <hash>`, exit 1;
  - `create none` and `rename a none` exit 1.

  Then run copy-cli — verify: `node --test scripts/agento.test.mjs tests/extension-bundle.test.mjs` exits 0
- [x] 2.3 Implement role-resolved `models pins [--role]` per plan.md `## Approach` item 6. Add `currentWindowRole()`, which calls `deriveRole` with the `sessionContext` inputs, never calls `gh`, and returns `unmanaged` on any failure. Build pins from the secondary profile's resolved agent targets when it applies; otherwise use `modelsPins`. Add `role`, `roleSource`, `windowRole`, `profile`, and `source`, and keep `pins`/`warnings` shaped as today. Tests in `scripts/agento.test.mjs`, using a fixture with a primary checkout plus a managed `plan-<id>` worktree on `feature/x` (role `build`) and a `freehand-<id>` worktree:
  - in the build worktree with secondary `b` → `windowRole: "build"`, `role: "secondary"`, `roleSource: "window"`, `source: "role-profile"`, `profile: "b"`, and builder/reviewer `subagentModel` and `copilotModel` from `b` (alias mapped via `copilotModels`, a list taking its first entry);
  - the freehand worktree → also `secondary`;
  - the primary checkout → `role: "primary"`, `source: "file-pins"`;
  - `--role primary` in the build worktree → file pins, with `roleSource: "flag"`;
  - `--role secondary` in the primary checkout → the role profile;
  - no roles file, or `secondary: null` → output `pins` deep-equal to the pre-feature `modelsPins` output;
  - a dangling assignment (profile deleted by hand-editing the file in the test), and an invalid roles file → `file-pins` plus a warning naming the fix;
  - outside any git repository (cwd = tmp dir) → `windowRole: "unmanaged"`, `role: "primary"`.

  Then run copy-cli — verify: `node --test scripts/agento.test.mjs scripts/session-state.test.mjs tests/extension-bundle.test.mjs` exits 0
- [ ] 2.4 Keep roles consistent on rename and delete per plan.md `## Approach` item 7. Tests:
  - with secondary `a`, `rename a b` → the profiles file has `b`, the roles file has `secondary: "b"`, and the result reports `secondaryBefore: "a"`;
  - renaming a non-assigned profile leaves the roles file byte-identical;
  - with secondary `a`, `delete a` → `status: "assigned"` (exit 3), and both files are byte-identical;
  - `delete a --force` → the profile is gone and `secondary: null`;
  - an applied **and** secondary profile still reports `active` first without `--force`;
  - deleting a non-assigned profile leaves the roles file untouched.

  Then run copy-cli — verify: `node --test scripts/agento.test.mjs tests/extension-bundle.test.mjs` exits 0
- [ ] 2.5 Extend doctor's `model-profile` check per plan.md `## Approach` item 8. The `detail` names `primary: <active|none>; secondary: <name|off>`. A dangling secondary, a secondary profile with errors, and an invalid roles file each → `warn` with a fallback naming `models use none --role secondary` or `models use <name> --role secondary`. Tests:
  - healthy with secondary set → `ok`, and the detail names both;
  - dangling → `warn`;
  - invalid roles file → `warn`;
  - the existing doctor check-list test (around `scripts/agento.test.mjs:1442`) is unchanged and passes.

  Then run copy-cli — verify: `node --test scripts/agento.test.mjs tests/extension-bundle.test.mjs` exits 0
- [ ] 2.6 Update the header usage comment (`scripts/agento.mjs:32`) and the `models` usage messages to list `use <name|none> --role primary|secondary` and `pins [--role …]`, then run copy-cli. Smoke the real CLI in this build worktree against a throwaway config home, without touching the clone's pins. Run `AGENTO_CONFIG_HOME=$(mktemp -d)`, then in order:
  1. `models create a --description primary-ish`
  2. `models create b`, then `models update b` with stdin `{"agents":{"builder":"Claude Opus 5.5 (copilot)","reviewer":["GPT-5 (copilot)","Claude Opus 5.5 (copilot)"]}}`
  3. `models alias set "Claude Opus 5.5 (copilot)" claude-opus-5.5`
  4. `models use b --role secondary`
  5. `models list` (check `roles`)
  6. `models pins` (expect `windowRole: build`, `role: secondary`, `source: role-profile`, builder `copilotModel: claude-opus-5.5`, reviewer `subagentModel: GPT-5 (copilot)`)
  7. `models pins --role primary` (expect `source: file-pins`)
  8. `models delete b` (expect `assigned`, exit 3)
  9. `models use none --role secondary`
  10. `models pins` (expect `source: file-pins`)

  Record each status on this line — smoke statuses: (fill in) — verify: every call returns the expected `status`/fields, `git status --porcelain --untracked-files=all` shows only the intended `scripts/` and `extension/cli/` edits, and `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exits 0

## Phase 3: Instructions and docs

- [ ] 3.1 Update `skills/agento/commands/models.md`, then copy it byte-for-byte to `.github/prompts/models.prompt.md` (per plan.md `## Approach` item 9):
  - argument shapes for `use <name|none> --role primary|secondary` and `pins [--role …]`;
  - report `roles` for `list`, `role`/`roleSource`/`windowRole`/`profile`/`source` for `pins`, and `secondaryBefore`/`roles` for `use`, `rename`, and `delete`;
  - the `assigned` finding;
  - the `next:` rules for `use`;
  - the argument hint in the frontmatter, if it lists verbs.

  Keep `Needs: terminal` — verify: `diff -q skills/agento/commands/models.md .github/prompts/models.prompt.md` is silent and `node --test tests/customizations.test.mjs` exits 0
- [ ] 3.2 Add one sentence to `skills/agento/SKILL.md` (step 5, Subagent mode) and one to `.github/agents/delivery-autopilot.agent.md` (Preflight step 2). Each says that `models pins` resolves the current window role's profile (the secondary profile in plan, build, and freehand windows; the clone's file pins otherwise), so the call stays as written, without `--role` — verify: `grep -n "window role" skills/agento/SKILL.md .github/agents/delivery-autopilot.agent.md` finds both, and `node --test tests/customizations.test.mjs` exits 0
- [ ] 3.3 Update the user docs per plan.md `## Approach` item 10:
  - **`docs/model-profiles.md`:**
    - add a "Window roles" section covering the buckets, `models use`, `model-roles.json` and its location, `pins` resolution and `--role`, off behavior, rename/delete/`--force`, the reserved `none`, and doctor;
    - replace the "Limits" bullet "One profile is active per clone…" with the role model;
    - add the secondary-window direct-selection note to "Subagents and handoffs".
  - **`README.md`:** the `/agento models` row adds `use <name|none> --role primary|secondary`.
  - **`CHANGELOG.md`:** a new top `## 0.12.0 (unreleased)` section with an **Added** entry.

  verify: `grep -n "## Window roles" docs/model-profiles.md`, `grep -c "One profile is active per clone" docs/model-profiles.md` prints 0, `grep -n "use <name" README.md`, and `grep -n "0.12.0 (unreleased)" CHANGELOG.md` all match as stated

## Phase 4: Final verification

- [ ] 4.1 Run the lint gate and the full suite against the recorded baseline:
  - `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`, using the v0.10.0 release binary from plan.md `## Research` if `shellcheck` is not installed;
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`.

  Record both results on this line — verify: shellcheck exits 0 with no findings (baseline: exit 0, none), the suite exits 0 with every test passing (baseline: 612/612), and `node --test tests/extension-bundle.test.mjs` exits 0
- [ ] 4.2 Integrate `origin/main` into the product branch and the companion `origin/main` into the companion branch, by merge. Re-run the full suite if the merge brought changes, then push both halves — verify: `git status --porcelain --untracked-files=all` prints nothing in either half, both report `ahead: 0` in `node <agento-root>/scripts/agento.mjs session`, and the full suite exits 0
