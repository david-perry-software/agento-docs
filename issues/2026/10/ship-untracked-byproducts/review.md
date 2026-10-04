# Review: ship-untracked-byproducts

Verdict: approve

Round 2, reviewed 2026-10-04 at product `813e368` and companion `847158b`. Both
contain their `origin/main` (`merge-base --is-ancestor` exit 0), equal their
`origin/issue/ship-untracked-byproducts`, and were clean
(`status --porcelain --untracked-files=all` empty). Code PR #89 is `OPEN`, draft,
`CLEAN`/`MERGEABLE`, head `813e368`, `ci/test` passing (50s), and its body starts
with `Fixes #88`. Companion PR #27 is `OPEN`, draft, `CLEAN`, head `847158b`.

All four round-1 findings are resolved. Re-verification found no new defects.

## Round-1 findings

1. **Resolved — literal-pathspec deletion.** `.github/prompts/ship.prompt.md`
   step 3 now prescribes `git -C <owner.path> --literal-pathspecs clean -f --
   <each listed path, single-quoted>`, says why the flag is mandatory, and gives
   the `'\''` escape. Greps: `--literal-pathspecs clean -f --` 1, `clean -f -- `
   1 (no bare form). `CHANGELOG.md` `--literal-pathspecs` 1. `cmp` against
   `commands/ship.md` exit 0. The guard
   `ok 211 - every git clean in prompts, agents, and command mirrors uses
   --literal-pathspecs` passes, and its regex rejects any `clean -f` line without
   the flag. I probed it independently in a throwaway repo (git 2.43.0) with
   untracked `shot[1].png`, `shot1.png`, `keep.png`, and `it's.png`:
   `git --literal-pathspecs clean -f -- 'shot[1].png' 'it'\''s.png'` removed
   exactly those two files. `shot1.png` and `keep.png` survived.
2. **Resolved — worktree-side renames in `splitPorcelain`.**
   `scripts/session-state.mjs` now skips the origin token when either status
   column is `R`/`C` (`/[RC]/.test(xy)`). New unit tests `ok 147` (` R`/` C`
   worktree-side) and `ok 148` (origin `README.md` / `CONTRIBUTING.md` followed
   by `??`) pass. Real-git probe: `mv README.md docs/new.md && git add -N
   docs/new.md` plus untracked `stray.png` emitted
   ` R docs/new.md\0README.md\0?? stray.png\0`, which parses to
   `{"tracked":["docs/new.md"],"untracked":["stray.png"]}`.
   `extension/cli/session-state.mjs` matches (`cmp` 0).
3. **Resolved — unreadable owner tree.** Step 2's hard-reject list now includes
   "`ownerTree === null` while `owner !== null` and `owner.role` is not
   `primary`". This matches `ownerTreeOf()`/`treeState()` in `scripts/agento.mjs`,
   which return `null` for the primary (already a stop) or when the directory is
   missing or `git status` fails. Step 3's post-cleanup re-check requires the exact
   empty `ownerTree`, so a `null` there is also a hard reject.
4. **Resolved — Builder Pause-protocol wording.** It is now one sentence: "Either
   stop leaves this worktree — and, in companion mode, the companion half — clean
   per policy §7 clean handoff, and is a `completed` §9 result …". Greps:
   `Either stop` 1, `Either stop leaves both trees` 0, `§7` 4.

## Acceptance checklist results

- **Pass — exposing regression test.** Full suite `ok 33 - ship-preflight
  reports the owner tree split into tracked and untracked files (#88
  ship-untracked-byproducts)`. Roadmap 1.1 records the failing run before the fix
  (`exit=1`, 86/87, `ownerTree` `undefined`).
- **Pass — `splitPorcelain()` unit tests.** `ok 142`–`ok 148`: empty,
  untracked-only, tracked-only, mixed, index-side rename/copy, worktree-side
  ` R`/` C`, and an origin path starting with `R`/`C` followed by `??`.
- **Pass — `ship-preflight` shapes.** `ownerTree` is `null` without an owner and
  `companionTree` is `null` in the in-repo layout (#88 test). The test asserts
  `Object.keys(owner)` is exactly `path, role, dirPrefix, id`. `companionGaps()`
  and `describeCompanion()` are not in the diff, and every existing `deepEqual`
  on `companion` still passes. The new fields are siblings on both the plain and
  the `--pr` results (`scripts/agento.mjs` `case "ship-preflight"`).
- **Pass — reproduction re-run.** `CLI=<product>/scripts/agento.mjs bash
  evidence/repro.sh` → exit 0. Output: `"ownerTree": { "tracked": [],
  "untracked": ["evidence", "features/2026/09/other-slug/evidence/step-1-1-x.png"],
  "ahead": 0 }`, `"companionTree": null`. It is identical to
  [evidence/repro-output-fixed.txt](evidence/repro-output-fixed.txt) once temp
  paths are normalized (`diff` exit 0).
- **Pass — ship prompt deletion path.** An untracked-only owner tree
  (`ownerTree.untracked` non-empty, `tracked` empty, `ahead` 0) is a
  confirmation-path item that lists every path verbatim, with "default is do not
  proceed". On yes, step 3's first write is the literal-pathspec
  `clean -f --` of exactly those paths. A `ship-preflight --pr` re-run must then
  show an empty `ownerTree` before any other write. Tracked changes, `ahead > 0`,
  or an unreadable owner tree are hard rejects with the Builder handoff. The
  companion `dirty` gap quotes `companionTree` and names commit-or-discard; "ship
  itself never deletes or restores anything in the companion". `cmp` with
  `commands/ship.md` exit 0.
- **Pass — policy §7 clean-handoff rule, cited and not restated.** The
  **Clean handoff.** bullet is in §7 (`untracked-files=all` 1). The Builder cites
  "policy §7 clean handoff" in its Pause protocol and in Completion. The Reviewer
  cites it in step 8. The canary `/delete\s+them, never commit them/` passes in
  the full suite.
- **Pass — docs and changelog.** `docs/commands.md` has `ownerTree` 1 and
  `companionTree` 1. `CHANGELOG.md` `## Unreleased` has one `(#88)` **Fixed.**
  bullet, which now names `git --literal-pathspecs clean -f -- <paths>`.
- **Pass — scoped lint gate (Reviewer half, policy §5).** Fresh runs at
  `813e368`, compared with the `## Research` baseline (277/277, replays 0,
  shellcheck 127):
  - Full node suite: exit 0, `# tests 286`, `# pass 286`, `# fail 0`.
  - `replay-guard.sh < tests/guard-fixtures.txt`: exit 0.
  - `REPLAY_COMPANION=1` replay: exit 0.
  - `cd extension && npm run test:unit`: exit 0, `# tests 114`, `# pass 114`,
    `# fail 0`.
  - `npm run lint:hooks`: exit 127 (`sh: 1: shellcheck: not found`), and
    `git diff --name-only origin/main...HEAD` names 0 shell files among its 14
    paths. The gate's 127 clause applies. CI `ci/test`, which runs shellcheck,
    passes on #89.
  - No new or undocumented findings.
- **Pass — `Fixes #88`.** The first line of #89's body is `Fixes #88`.

## Plan vs implementation

The implementation follows `## Approach` items 1–5, plus the round-1 fixes
recorded in plan.md `## Resolution` **Review fixes**:

- `treeState`, `ownerTreeOf`, and `companionTreeOf` in `scripts/agento.mjs` use
  fixed `execFileSync` argument arrays. They use raw `execFileSync` rather than
  `git()` so the leading space of ` M` survives.
- `ahead` uses the same upstream / `--not --remotes` fallback as
  `describeCompanion`.
- Byte copies match: every `scripts/*.mjs` with an `extension/cli/` copy (5 files,
  `cmp` 0), and all 25 `.github/prompts/*.prompt.md` against `commands/*.md`
  (0 mismatches).

There are no undocumented or out-of-scope changes. `owner` and `companion` keep
their shapes, `close-decision` is untouched, and there are no secrets or
shell-injection paths.

Skills consulted: none — no matching domain (this repository's AGENTS.md has no
`## Agento` skills table, and no `.agents/skills/` covers git CLI or prompt work).

## Roadmap audit

All 13 steps are ticked. I spot-checked each one against the code and re-ran its
checks:

- 1.1, 2.2, and 2.4 against the #88 test and the parser tests, plus a real-git
  rename probe.
- 2.1 against the unit tests.
- 2.3 and 6.3 by re-running the repro.
- 3.1 and 3.2 by their greps, `cmp`, the literal-pathspec guard, and an
  independent `git --literal-pathspecs clean` probe.
- 4.1 and 4.2 by their greps and the customizations test.
- 5.1 by its greps.
- 6.1 and 6.3 by re-running the full scoped gate.
- 6.2 by the PR states, `Fixes #88`, both halves integrated, and both trees
  clean.

Every `verify:` passes as written. No box is falsely ticked, and I made no
repairs. There are no `(manual)` or `(manual, post-ship)` steps.

## Findings

1. **Nit (non-blocking) — the literal-pathspec guard matches only the `clean -f`
   spelling.** In `tests/customizations.test.mjs`, the guard keys on
   `/\bclean -f\b/`, so a future `git clean -fd` or `git clean --force` line in
   a prompt would not be checked. Today the ship prompt and its mirror are the
   only `git clean` users, and both pass. No action required.

## Follow-ups

None.
