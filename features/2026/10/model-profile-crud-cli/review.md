# Review: model-profile-crud-cli

Verdict: approve

Reviewed 2026-10-21 (round 2) against plan.md and roadmap.md on
`feature/model-profile-crud-cli` — product HEAD `f2fb19a` (PR
david-perry-software/agento#124, draft), companion HEAD `68a12f8` (PR
david-perry-software/agento-docs#61, draft). `origin/main` is an ancestor of both
HEADs; both trees were clean before and after every check below. Every
verification result here was re-run by the Reviewer in this round, not copied from
the roadmap or from round 1.

**Summary.** Round 1 requested changes for F1 (top-level key order flipped and an
empty `copilotModels: {}` dropped on the first CRUD write), with minor findings F2
(`extension/package.json` reformatted by `npm version`), F3 (dead
`IMPLEMENTED_MODEL_VERBS` scaffold), and F4 (purely numeric names hoisted). The
Builder landed steps 2.8–2.10 (`449a305`, `15137b9`, `f2fb19a`). All four are
resolved and independently reproduced below; no new finding above minor was found.
Full suite 607/607, lint gate green, five guard replays green, extension gate
green (167 unit, 4 electron scenarios).

## Round-1 findings — resolution

- **F1 (moderate) — resolved.** `scripts/agento.mjs` now builds every write through
  `nextProfilesObject(loaded, profiles, copilotModels)` (lines ~3610–3626): it
  spreads `JSON.parse(loaded.raw)` so the file's own top-level order is kept, keeps
  the `copilotModels` key whenever the file already has it (even empty), and only
  appends it after `profiles` for a brand-new file or a first `alias set` on a
  profiles-only file. All six write verbs call it (`create`, `update`, `rename`,
  `delete`, `alias set`, `alias remove`). Reviewer replay
  (`AGENTO_CONFIG_HOME=$(mktemp -d)`, `--plugin-root .`):
  - `init` → `["copilotModels","profiles"]`; then `create x`, `rename x y`,
    `update y` (stdin), `delete y`, `alias set`, `alias remove` — after every one
    the top-level keys stayed `["copilotModels","profiles"]` and `reformatted:
    false`.
  - `{"copilotModels":{},"profiles":{"a":{}}}` → `create b` → keys
    `["copilotModels","profiles"]`, `copilotModels` still `{}`, profiles `["a","b"]`.
  - profiles-only file → `create c` → keys `["profiles"]` (no `copilotModels`
    invented); profiles-only file → `alias set "P (v)" some-id` → keys
    `["profiles","copilotModels"]`.
  - `{"profiles":{"a":{}}}` on one line → `create d` → `reformatted: true`.
  - A file with an unknown top-level key `extra` → `create b` → `status: invalid`
    (`unknown top-level key "extra"`), file byte-identical — the spread cannot
    smuggle an invalid key past `writeProfiles`.
  Tests added in `scripts/agento.test.mjs` (commit `449a305`): "models create
  preserves the template's top-level key order after init", "… keeps an existing
  empty copilotModels key", "… keeps a profiles-first file profiles-first" — all
  pass in the 607 run.
- **F2 (minor) — resolved.** `git diff origin/main -- extension/package.json` shows
  only the `"version": "0.8.0"` → `"0.9.0"` line; `extension/package-lock.json`
  shows only its two version lines (commit `15137b9`).
- **F3 (minor) — resolved.** `grep -n "IMPLEMENTED_MODEL_VERBS\|not implemented
  yet" scripts/agento.mjs extension/cli/agento.mjs` matches nothing.
- **F4 (minor) — resolved by documentation.** `docs/model-profiles.md` `## Limits`
  (lines 322–326) explains that purely numeric names are hoisted by the serializer
  and recommends a name with at least one letter (commit `f2fb19a`).

## Acceptance checklist results

1. **`models create` …** — **pass.** Tests "models create writes only the new
   profile to a missing file", "… empty, from a deep copy, and with --description",
   "… exists and --from not-found exit 3", "… --from an invalid profile is invalid"
   pass (607/607 run). Reviewer smoke: `create a --description x` → `status: ok,
   written: true` on a missing file; `create zz` twice → second is `exists`, exit 3;
   `create q --from nope` → `not-found`, exit 3, `known` quoted.
2. **`models update` …** — **pass.** Tests "models update replaces the profile in
   place from stdin", "… rejects non-JSON and array input without touching the
   file", "… --dry-run validates without writing", "… --expect conflicts after an
   out-of-band write", "… of the applied profile reports reapply and active custom"
   pass. Reviewer smoke: `--dry-run` → `dryRun: true, written: false`, exit 0;
   `--expect <hash from show>` → `written: true`; the same stale hash again →
   `status: conflict`, exit 3, with `expected`/`actual`. The TTY guard is
   `scripts/agento.mjs:4882` (`process.stdin.isTTY` → usage error); this
   environment has no TTY so it was verified by code reading, as in round 1.
3. **`models rename` / `models delete` …** — **pass.** Tests "models rename rejects
   not-found and exists", "… keeps position and active follows by content", "models
   delete rejects not-found and the applied profile without --force", "… --force
   removes the applied profile and active becomes custom", "… of a non-applied
   profile succeeds" pass. Reviewer smoke on a throwaway `git clone` of this
   worktree as `--plugin-root`: `apply act` → `active: "act"`; `delete act` →
   `status: active`, exit 3, message names `models clear` and `--force`; `delete
   act --force` → `ok`; `list` → `active: "custom"`. `rename nope q` → `not-found`.
4. **`models alias set` / `alias remove` …** — **pass.** Tests "models alias set
   creates, updates, and remove deletes a copilotModels entry", "… rejects an
   invalid id or picker", "… picker is one argument with spaces and parentheses",
   "models pins picks up a new alias as copilotModel", "models reports
   profilesFile.hash and list reports copilotModels" pass. Reviewer smoke: `alias
   set "Claude Opus 5.5 (copilot)" claude-opus-5.5` → `ok` with the map; `alias
   remove nope` → `not-found`; `list` reports `copilotModels`.
5. **`profilesFile.hash`, `--expect`/`conflict`, atomic writes, 2-space JSON, key
   order preserved, `reformatted`, file-level errors refused …** — **pass** (round
   1's failing clause is fixed, see F1 above). Hash on every result (`show` hash
   equals the `create` hash; `list` carries `profilesFile.hash`); stale `--expect`
   → `conflict`, exit 3, file untouched; no `.model-profiles.json.*.tmp` left in
   the config dir after any replay (`ls -A` showed only `model-profiles.json`);
   mode kept (test "models create leaves no temp files and keeps the mode");
   2-space + trailing newline (replayed file printed); key order preserved
   (replays above); `reformatted: true` on a hand-formatted file; unparseable or
   unknown-key file refused byte-identical.
6. **Pure helpers unit-tested …** — **pass.** `scripts/model-profiles.test.mjs`
   adds 12 tests (serialize round-trip/order, sha256 vector, aliasErrors ×3,
   createProfile, replaceProfile, renameProfile, deleteProfile, setAlias,
   removeAlias, deep-frozen input untouched); all pass.
7. **Usage errors per verb, existing `models` tests unchanged** — **pass.** Tests
   "models usage errors: options a verb does not accept" and "… new verb arity,
   malformed options, and alias sub-verbs" pass; Reviewer smoke: `list --force`,
   `create "Bad"`, `alias frob`, `create z --expect abc` each exit 1 with a usage
   message. The diff removes no test (`^-test(` count 0; 29 + 12 added). Two
   pre-existing assertions were necessarily adjusted — the `profilesFile` deepEqual
   now includes `hash: null` and the header-usage assertion matches the new comment
   — both are consequences the plan itself mandates (Approach items 2 and 5).
8. **`/agento models` prompt and mirror …** — **pass.** `cmp
   .github/prompts/models.prompt.md skills/agento/commands/models.md` exit 0;
   `tests/customizations.test.mjs` passes inside the 607 run; step 2 drives
   `update` as `show` (hash) → `--dry-run` (heredoc) → `--expect <hash>`; step 4
   covers `exists`/`active`/`conflict`/`invalid`; `next:` rules cover `reapply` →
   `/agento models apply <name>` and other writes → `/agento models`; `Needs:
   terminal` unchanged (line 9).
9. **Docs, README row, usage comment, CHANGELOG, version bumps** — **pass.** `grep
   -n "## Editing profiles" docs/model-profiles.md` → line 71; `grep -n
   "models.*create" README.md` → line 443; `scripts/agento.mjs:32` lists every
   verb; `"version": "0.9.0"` in `package.json:3`, `.claude-plugin/plugin.json:4`,
   `extension/package.json:5`, lock lines 3 and 9; `CHANGELOG.md` opens with
   `## 0.9.0 (unreleased)` + **Added**. `extension/package.json` now differs from
   `origin/main` by the version line only (F2).
10. **`extension/cli/` byte copy** — **pass.** `cmp scripts/agento.mjs
    extension/cli/agento.mjs` and `cmp scripts/model-profiles.mjs
    extension/cli/model-profiles.mjs` exit 0; `tests/extension-bundle.test.mjs`
    passes inside the full run.
11. **Lint gate (§5, full rerun), full suite, guard replays, extension gate** —
    **pass.** `/tmp/shellcheck-v0.10.0/shellcheck scripts/hooks/*.sh
    scripts/wait-for-checks.sh` → exit 0, no findings (equals the plan.md baseline
    at `8e4c41a`; `git diff --name-only origin/main...HEAD` lists no `.sh` file).
    `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → 607 pass / 0
    fail, exit 0 (baseline 566 + 41 new). The five guard replays from AGENTS.md
    (plain, companion, copilot format, copilot + companion, copilot fixtures) each
    exit 0. `cd extension && npm ci && npm run build && npm run typecheck && npm
    run test:unit` → every exit 0, 167/167; `npm run test:electron` → exit 0, 4
    scenarios passed (in-repo, companion, workspace, no-markdown). Both trees clean
    after each.

Score: 11 pass, 0 fail, 0 deferred (the plan has no `(manual, post-ship)` step).

## Plan vs implementation

- **Round-1 deviation (F1) closed.** `nextProfilesObject` honors Q4 ("key order
  kept"), Approach item 1 ("`copilotModels` stays where it was"), acceptance item
  5, and the `## Editing profiles` sentence in `docs/model-profiles.md`.
- **Matches plan:** `writeProfiles` check order (re-read + hash, `--expect`,
  file-level errors, re-parse, temp+fsync+rename with mode kept, cleanup on
  failure, `failed` status) matches Approach item 2; write verbs skip the
  `worktree`/`dirty`/`git-too-old` gates (every smoke ran from this development
  worktree with `--plugin-root .`); per-verb `MODEL_VERBS` spec replaces the arity
  table; `--from`/`--description`/`--expect` parser rules match (lines 106–117).
- **Undocumented changes:** none. `git diff --name-only origin/main...HEAD` lists
  only the files under plan.md "Affected files".
- **Behavior worth a sentence (unchanged from round 1, follow-up):** `models rename`
  of a profile that still carries per-profile errors (the template's `mixed`
  placeholders) answers `invalid` (4 errors), while `delete mixed` succeeds. It
  follows Approach item 2 step 3 literally; a user doing `init` → `rename mixed`
  may be surprised. Minor; not blocking.

## Roadmap audit

Every ticked box was spot-checked against the codebase and by re-running its
`verify:`; none is falsely ticked:

- 1.1, 1.2 — helpers at `scripts/model-profiles.mjs:30–102` with the listed tests.
- 2.1 — `loadProfiles()` returns `raw` and `profilesFile.hash`; `list` emits
  `copilotModels`.
- 2.2 — parser options and `MODEL_VERBS` spec present; usage tests pass.
- 2.3–2.6 — verbs implemented with every listed test present and green.
- 2.7 — header comment updated (line 32); Reviewer replayed the seven smoke calls
  with the recorded statuses (1 ok, 2 ok, 3 dry-run ok + expect ok, 4 ok, 5 ok, 6
  ok, 7 ok); clone untouched.
- 2.8 — `nextProfilesObject` in place, three tests present and green, scaffold
  removed, manual `init` → `create x` replay keeps `copilotModels` first.
- 2.9 — `extension/package.json` and lock diffs are version-only.
- 2.10 — `grep -n "purely numeric" docs/model-profiles.md` → lines 322, 324.
- 3.1–3.3 — `cmp` exit 0, greps as recorded, version/CHANGELOG as recorded.
- 4.1 — Reviewer re-run: 607/607, 5 guard replays exit 0, shellcheck exit 0.
- 4.2 — Reviewer re-run: 167 unit, 4 electron scenarios.

No `(manual)` or `(manual, post-ship)` steps exist, so no evidence files are
required (`evidence/` absent is correct).

**Repairs made:**

- Step 4.1's recorded count (604/604) predates steps 2.8–2.10; the line now also
  records the Reviewer's round-2 re-run (607/607, 5 replays, shellcheck 0) so the
  artifact matches the shipped suite. No box was unticked; no step was added.

## Findings

No finding above minor.

**F5 — minor — `rename` of a profile with per-profile errors is `invalid`.**
`scripts/agento.mjs` rename passes `names: [next]` to `writeProfiles`, so the
renamed profile's pre-existing errors (e.g. template placeholders) block a pure key
swap, while `delete` of the same profile is allowed. Either accept the rename (the
file is no more invalid than before) or document it in `## Editing profiles`.
Carried from round 1's follow-ups; not blocking.

Security: no new network, exec, or secret handling. Temp file created with `wx`
and a random suffix in the target directory, then renamed; `--expect` CAS compares
raw text plus sha256; stdin JSON is parsed then schema-validated before any write;
unknown top-level keys are refused before the spread in `nextProfilesObject` can
persist them. No findings.

## Follow-ups

- F5: decide whether `models rename` of a profile with per-profile errors should
  succeed or stay `invalid` and be documented.
- The `reformatted` flag describes only the old bytes' formatting; a future
  `reordered`-style flag would make any regression of F1 visible in the result
  object.
