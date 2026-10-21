# Review: model-profile-crud-cli

Verdict: request-changes

Reviewed 2026-10-21 (round 1) against plan.md and roadmap.md on
`feature/model-profile-crud-cli` — product HEAD `2bf7c13` (PR
david-perry-software/agento#124, draft), companion HEAD `a3ca46a` (PR
david-perry-software/agento-docs#61, draft). `origin/main` is an ancestor of both
HEADs; both trees were clean before and after every check below. Every
verification result here was re-run by the Reviewer, not copied from the roadmap.

**Summary.** The implementation is complete, well tested (38 new tests, 604/604
green, lint and extension gates green), and matches the plan in every respect but
one: the write path does not preserve the profiles file's **top-level key order**
and silently drops an existing empty `copilotModels: {}`. On the documented
bootstrap path (`models init` → any CRUD verb) the first write flips the template's
`copilotModels`, `profiles` order to `profiles`, `copilotModels` and reports
`reformatted: false`. That contradicts the user's Q4 decision ("key order kept"),
Approach item 1 ("`copilotModels` stays where it was"), acceptance item 5, and the
new `docs/model-profiles.md` text. The fix is small and localized (roadmap step 2.8,
added). Everything else passes.

## Acceptance checklist results

1. **`models create` …** — **pass.** `scripts/agento.test.mjs` tests "models create
   writes only the new profile to a missing file", "… empty, from a deep copy, and
   with --description", "… exists and --from not-found exit 3", "… --from an invalid
   profile is invalid" all pass in the 604/604 run. Reviewer smoke
   (`AGENTO_CONFIG_HOME=$(mktemp -d)`, `--plugin-root .`): `create a --description x`
   → `status: ok, written: true`, file contains only `a`, no `<…>`.
2. **`models update` …** — **pass.** Tests "models update replaces the profile in
   place from stdin", "… rejects non-JSON and array input without touching the
   file", "… --dry-run validates without writing", "… --expect conflicts after an
   out-of-band write", "… of the applied profile reports reapply and active custom"
   pass. Reviewer smoke: `--dry-run` → `dryRun: true, written: false`; `--expect
   <hash from show>` → `written: true`; TTY guard at `scripts/agento.mjs:4864`.
3. **`models rename` / `models delete` …** — **pass.** Tests "models rename rejects
   not-found and exists", "… keeps position and active follows by content", "models
   delete rejects not-found and the applied profile without --force", "… --force
   removes the applied profile and active becomes custom", "… of a non-applied
   profile succeeds" pass. Reviewer smoke: `rename a b` → `ok`; `delete b` → `ok`.
4. **`models alias set` / `alias remove` …** — **pass.** Tests "models alias set
   creates, updates, and remove deletes a copilotModels entry", "… rejects an
   invalid id or picker", "… picker is one argument with spaces and parentheses",
   "models pins picks up a new alias as copilotModel", and "models reports
   profilesFile.hash and list reports copilotModels" pass. Reviewer smoke: `alias
   set "Claude Opus 5.5 (copilot)" claude-opus-5.5` → `ok` with the map; `list`
   reports `copilotModels`.
5. **`profilesFile.hash`, `--expect`/`conflict`, atomic writes, 2-space JSON, key
   order preserved, `reformatted`, file-level errors refused …** — **fail** on the
   "key order preserved" clause; every other clause passes.
   - Passing clauses: hash on every result (test "models reports profilesFile.hash
     …"; smoke `show` hash equals `create` hash); stale `--expect` → `status:
     conflict`, exit 3, file byte-identical (test "models create honors --expect
     with conflict and success", "models update --expect conflicts …"; Reviewer
     smoke 3c exit 3 with `expected`/`actual`); no `.model-profiles.json.*.tmp`
     left and mode 600 kept (test "models create leaves no temp files and keeps the
     mode"; smoke dir had 0 tmp files); 2-space + trailing newline; `reformatted:
     true` on a hand-formatted file (test "… on a hand-formatted file reports
     reformatted"); unparseable file refused untouched (test "… refuses an
     unparseable file without touching it").
   - **Failing clause — evidence.** Reviewer replay: `models init` → top-level keys
     `['copilotModels','profiles']` (from `templates/model-profiles.json`); `models
     create zz --description t` → `status: ok, reformatted: false`; file now has
     top-level keys `['profiles','copilotModels']`. Second replay: a file
     `{"copilotModels":{},"profiles":{"a":{}}}` → `models create b` → `ok,
     reformatted: false`; the written file is `{"profiles":{"a":{},"b":{}}}` — the
     `copilotModels` key is gone. Cause: `scripts/agento.mjs:4854–4855`,
     `4873–4874`, `4893–4894`, `4903–4904` build `next` as `{ profiles }` and append
     `copilotModels` only when non-empty. No test asserts top-level order (the
     closest, "models create works alongside the template's placeholder mixed
     profile" at `scripts/agento.test.mjs:3247`, checks profile keys only). See
     Finding F1 and roadmap step 2.8.
6. **Pure helpers unit-tested …** — **pass.** `scripts/model-profiles.test.mjs`
   adds 12 tests (serialize round-trip/order, sha256 vector, aliasErrors ×3,
   createProfile, replaceProfile, renameProfile, deleteProfile, setAlias,
   removeAlias, deep-frozen input untouched); all pass.
7. **Usage errors per verb, existing `models` tests unchanged** — **pass.** Tests
   "models usage errors: options a verb does not accept" and "… new verb arity,
   malformed options, and alias sub-verbs" pass; the diff adds to, and does not
   modify, pre-existing `models` tests (`git diff origin/main...HEAD --
   scripts/agento.test.mjs` is additive apart from the `runWith` `input` option).
8. **`/agento models` prompt and mirror …** — **pass.** `cmp
   .github/prompts/models.prompt.md skills/agento/commands/models.md` exit 0;
   `tests/customizations.test.mjs` passes inside the 604 run; the prompt's step 2
   drives `update` as `show` → `--dry-run` (heredoc) → `--expect <hash>`, step 4
   covers `exists`/`active`/`conflict`/`invalid`, `next:` rules cover `reapply`;
   `Needs: terminal` unchanged (line 9).
9. **Docs, README row, usage comment, CHANGELOG, version bumps** — **pass.** `grep
   -n "## Editing profiles" docs/model-profiles.md` → line 71; `grep -n
   "models.*create" README.md` → line 443; `scripts/agento.mjs:32` lists every verb;
   `"version": "0.9.0"` in `package.json:3`, `.claude-plugin/plugin.json:4`,
   `extension/package.json:5`, `extension/package-lock.json:3,9`; `CHANGELOG.md`
   opens with `## 0.9.0 (unreleased)` + **Added**. (See F2 for the formatting churn
   in `extension/package.json`; F1 for the doc sentence at line 98 that the code
   does not yet honor.)
10. **`extension/cli/` byte copy** — **pass.** `tests/extension-bundle.test.mjs`
    passes inside the full run.
11. **Lint gate (§5), full suite, guard replays, extension gate** — **pass.**
    `/tmp/shellcheck-v0.10.0/shellcheck scripts/hooks/*.sh
    scripts/wait-for-checks.sh` → exit 0, no findings (equals the plan.md baseline
    at `8e4c41a`; no shell file changed). `node --test 'scripts/**/*.test.mjs'
    'tests/**/*.test.mjs'` → 604 pass / 0 fail, exit 0 (baseline 566 + 38 new). The
    five guard smoke replays from AGENTS.md each exit 0. `cd extension && npm ci &&
    npm run build && npm run typecheck && npm run test:unit` → exit 0, 167/167;
    `npm run test:electron` → exit 0, 4 scenarios passed (in-repo, companion,
    workspace, no-markdown). Tree clean after each.

Score: 10 pass, 1 fail (item 5, "key order preserved" clause). No item is deferred
to post-ship (the plan has no `(manual, post-ship)` step).

## Plan vs implementation

- **Deviation (blocking): top-level key order and empty `copilotModels`.** plan.md
  Decisions Q4 ("key order kept"), Approach 1 ("`copilotModels` stays where it
  was"), and acceptance item 5 promise order preservation; `docs/model-profiles.md:98`
  now documents it. The write verbs reconstruct the top level in a fixed order and
  drop an empty map (details in F1). `serializeProfiles` itself is order-preserving;
  the loss happens in the per-verb `next` construction in `scripts/agento.mjs`.
- **Deviation (minor, out of scope of the plan): `extension/package.json`
  reformatted.** `npm version 0.9.0 --no-git-tag-version` (step 3.3, as planned)
  rewrote ~100 lines of one-line `defaults` objects into multi-line form. JSON is
  semantically identical apart from `version` (verified by parsing both and
  comparing with `version` normalized). The precedent bump `8c81f88` touched only
  the version line. Policy §7 says to keep unrelated changes out (F2).
- **Matches plan:** `writeProfiles` order of checks (re-read + hash, `--expect`,
  file-level errors, re-parse, temp+fsync+rename with mode kept, cleanup on
  failure, `failed` status) matches Approach item 2 exactly; `candidateErrors`/
  `names` filtering lets `init` → `update mixed` work while placeholder profiles
  elsewhere remain (test "models create works alongside the template's placeholder
  mixed profile"); write verbs skip the `worktree`/`dirty`/`git-too-old` gates per
  Approach item 3 (verified: the whole smoke ran from this development worktree with
  `--plugin-root .`); the per-verb spec table replaces the arity table; `--from`,
  `--description`, `--expect` parser rules match (lines 106–117).
- **Behavior worth a sentence in the docs (not a deviation):** `models rename` of a
  profile that still carries per-profile errors (e.g. the template's `mixed`
  placeholders) answers `invalid` because the renamed profile counts as "the profile
  being written" (`names: [next]`, `scripts/agento.mjs:4895`), while `delete` of
  the same profile succeeds. This follows Approach item 2 step 3 literally, but a
  user who runs `init` then tries to rename `mixed` will be surprised. Follow-up.
- **Undocumented changes:** none found. The diff touches only the files listed under
  "Affected files" in plan.md.

## Roadmap audit

Every ticked box was spot-checked against the codebase and by re-running its
`verify:`; none is falsely ticked:

- 1.1, 1.2 — helpers exist in `scripts/model-profiles.mjs` with the
  listed tests (`serializeProfiles` … `removeAlias`, lines 30–102);
  `node --test scripts/model-profiles.test.mjs` passes (inside the full run).
- 2.1 — `loadProfiles()` returns `raw` and `profilesFile.hash` (lines 3592–3599);
  `list` emits `copilotModels` (line 4832).
- 2.2 — parser options (lines 106–117), `MODEL_VERBS` spec (lines 4775–4789), usage
  tests pass.
- 2.3–2.6 — verbs implemented at lines 4850–4926 with every listed test present and
  green.
- 2.7 — header comment updated (line 32); Reviewer replayed the seven smoke calls
  with the recorded statuses (1 ok, 2 ok, 3 dry-run ok + expect ok, 4 ok, 5 ok, 6
  ok, 7 ok); clone untouched.
- 3.1–3.3 — `cmp` exit 0, greps as recorded, version/CHANGELOG as recorded.
- 4.1 — 604/604, 5 guard replays exit 0, shellcheck exit 0 (Reviewer re-run).
- 4.2 — 167 unit, 4 electron scenarios (Reviewer re-run).

No `(manual)` or `(manual, post-ship)` steps exist, so no evidence files are
required (`evidence/` absent is correct).

**Repairs made:**

- Added `- [ ] 2.8 (added 2026-10-21)` — preserve top-level key order and an
  existing empty `copilotModels` on every write, with the three tests to add and
  the copy-cli step (fixes F1; optionally F3).
- `next-step` changed from `"all steps complete"` to name step 2.8. `status` left
  at `in-review` for the Builder fix handoff to resume from.

## Findings

**F1 — moderate — top-level key order not preserved; empty `copilotModels`
dropped.** `scripts/agento.mjs:4854–4855` (`create`), `4873–4874` (`update`),
`4893–4894` (`rename`), `4903–4904` (`delete`): `const next = { profiles: … }; if
(Object.keys(loaded.copilotModels ?? {}).length) next.copilotModels = …`. Effects
(Reviewer-reproduced): after `models init` the first CRUD write reorders the
template's `copilotModels`/`profiles` to `profiles`/`copilotModels`; a file with
`"copilotModels": {}` loses the key. In both cases `reformatted` is `false`
(`scripts/agento.mjs:3651` compares `serializeProfiles(JSON.parse(currentRaw))`
with the old bytes, which says nothing about what `next` does). Contradicts Q4,
Approach 1, acceptance 5, and `docs/model-profiles.md:98`. Fix: derive `next` from
the parsed file's own key order (e.g. `const base = JSON.parse(loaded.raw ?? '{}')`
and `{ ...base, profiles: …, copilotModels: base.copilotModels ?? loaded.copilotModels }`
only when the key exists), and add the order/empty-map tests named in step 2.8.
Why moderate rather than minor: it violates an explicit user decision on the
default bootstrap path and the result object misreports it — a user who keeps the
profiles file under version control sees an unexplained reorder on their first
CLI write.

**F2 — minor — unrelated whitespace churn in `extension/package.json`.**
~100 lines of `defaults` objects were expanded from one-line to multi-line by `npm
version`. Semantically identical (verified). Policy §7 "keep unrelated changes out";
precedent `8c81f88` changed only the version line. Fix: restore the original
formatting with only `"version"` changed (the same for `extension/package-lock.json`
if it was reformatted — it was not: 4 lines changed). Not blocking on its own.

**F3 — minor — dead scaffold.** `scripts/agento.mjs:4772` `IMPLEMENTED_MODEL_VERBS`
now lists every verb in `MODEL_VERBS`, so the guard at line 4805 (`not implemented
yet`) can never fire. Remove the set and the check (step 2.2's placeholder has done
its job). Not blocking.

**F4 — minor — digit-only profile names are hoisted.** `PROFILE_NAME` accepts
`^[a-z0-9-]+$`, so a profile named `42` is legal; `JSON.stringify` orders
integer-like keys first regardless of insertion order. Reviewer replay: a file with
`profiles: { zeta, 42 }` → `create alpha` → `[ '42', 'zeta', 'alpha' ]` (here
`reformatted: true` is correctly reported because the raw text differed). Document
as a limit in `docs/model-profiles.md` `## Limits` or reject purely numeric names
at creation. Not blocking.

Security: no new network, exec, or secret handling. The temp file is created with
`wx` (no clobber) and a random suffix in the same directory, then renamed; the
`--expect` CAS uses the full raw-text comparison plus the sha256 — sound. Stdin JSON
is `JSON.parse`d and then schema-validated through `parseProfiles` + `resolveProfile`
before any write. No findings.

## Follow-ups

- Decide whether `models rename` of a profile with per-profile errors (template
  placeholders) should succeed — it is a pure key swap and `delete` of the same
  profile is allowed — or stay `invalid` and be documented in `## Editing profiles`.
- Document (or reject) purely numeric profile names (F4).
- The `reformatted` flag describes only the old bytes' formatting; consider renaming
  or extending it (e.g. `reordered`) once F1 is fixed, so a future regression is
  visible in the result object.
- Restore the one-line `defaults` formatting in `extension/package.json` if the
  Builder does not fold F2 into step 2.8 (or adopt `npm version`'s formatting as the
  repository style once, in its own change).
