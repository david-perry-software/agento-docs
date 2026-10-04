# Review: ship-untracked-byproducts

Verdict: request-changes

Reviewed 2026-10-04 at product `73fcdc8` (contains `origin/main`) and companion
`f05a236` (contains its `origin/main`). Both halves were in sync with their
upstreams and clean. Code PR #89 and companion PR #27 are both `OPEN`, draft,
`CLEAN`. #89's body starts with `Fixes #88`, and its `test` check passes (57s;
the CI job runs shellcheck and the guard replay).

Two defects block approval. Both are in the parts the plan names as risks: rename
handling in the parser and "only the listed paths" deletion.

## Acceptance checklist results

- **Pass — exposing regression test.** `node --test scripts/agento.test.mjs` →
  exit 0; `ok 20 - ship-preflight reports the owner tree split into tracked and
  untracked files (#88 ship-untracked-byproducts)`. Roadmap 1.1 records the earlier
  failing run (`exit=1`, 86/87, `ownerTree` `undefined`).
- **Pass (as specified) — `splitPorcelain()` unit tests.** `node --test
  scripts/session-state.test.mjs` → exit 0. All five `splitPorcelain` tests are
  `ok` (empty, untracked-only, tracked-only, mixed, rename). The rename case only
  covers index-side `R ` and `C ` entries. Finding 2 shows the parser is wrong
  for worktree-side ` R` entries, which the tests don't cover.
- **Pass — `ship-preflight` shapes.** `ownerTree` is `null` without an owner and
  `companionTree` is `null` in the in-repo layout (#88 test). The test asserts
  `Object.keys(owner)` is exactly `path, role, dirPrefix, id`. `companion` and
  `companionGaps` are untouched in the code: `companionGaps()` and
  `describeCompanion()` aren't in the diff. Every existing `deepEqual` on
  `companion` still passes in the full suite. New data appears only as sibling
  fields, on both the plain and the `--pr` results (`scripts/agento.mjs`
  `case "ship-preflight"`).
- **Pass — reproduction re-run.** `CLI=<product>/scripts/agento.mjs bash
  evidence/repro.sh` → exit 0. Output: `"ownerTree": { "tracked": [],
  "untracked": ["evidence", "features/2026/09/other-slug/evidence/step-1-1-x.png"],
  "ahead": 0 }`, `"companionTree": null`. This matches the committed
  [evidence/repro-output-fixed.txt](evidence/repro-output-fixed.txt).
- **Fail — ship prompt deletion path.** Most of the item is met:
  - Grep counts: `ownerTree` 10, `companionTree` 3, `clean -f --` 1, old
    `porcelain. to print nothing` check 0.
  - `cmp .github/prompts/ship.prompt.md commands/ship.md` → exit 0.
  - Tracked changes or `ahead > 0` stay a hard reject with the Builder handoff.
  - The companion `dirty` gap quotes `companionTree` and names commit-or-discard,
    with "ship itself never deletes or restores anything in the companion".
  - Deletion happens only on the user's yes to that item, is the first write of
    step 3, and is followed by a `ship-preflight --pr` re-run that must show an
    empty `ownerTree` before any other write.

  But the command it prescribes, `git -C <owner.path> clean -f -- <each listed
  path>`, treats each path as a **pathspec**, not a literal path. Finding 1 shows
  it deletes untracked files that were never listed. That breaks the item's
  "exact paths listed, deleted … only on an explicit yes" and plan.md `## Risks`
  ("only paths `ownerTree.untracked` listed and the user explicitly confirmed are
  deleted").
- **Pass — policy §7 clean-handoff rule, cited and not restated.**
  - `.github/instructions/delivery-policy.instructions.md` §7 has the
    **Clean handoff.** bullet (`untracked-files=all` count 1).
  - The Builder cites "policy §7 clean handoff" twice, once in the Pause
    protocol and once in Completion. The Reviewer cites it once, in step 8. None
    of them restate the rule.
  - The canary `/delete\s+them, never commit them/` in
    `tests/customizations.test.mjs` is checked as absent outside the policy and
    present in it. The full suite (which includes this test) exits 0.
- **Pass — docs and changelog.** `docs/commands.md` has `ownerTree` 1 and
  `companionTree` 1. `CHANGELOG.md` has one `(#88)` **Fixed.** bullet under
  `## Unreleased`. That bullet repeats the `git clean -f -- <paths>` wording, so it
  needs updating along with Finding 1.
- **Pass — scoped lint gate (Reviewer half, policy §5).** Fresh runs at
  `73fcdc8`, compared with the `## Research` baseline (277/277, replays 0,
  shellcheck 127):
  - Full node suite: exit 0, `# tests 283`, `# pass 283`, `# fail 0` (more than
    277).
  - `replay-guard.sh < tests/guard-fixtures.txt`: exit 0.
  - `REPLAY_COMPANION=1` replay: exit 0.
  - `cd extension && npm run test:unit`: exit 0, 114/114.
  - `npm run lint:hooks`: exit 127 (`sh: 1: shellcheck: not found`), and
    `git diff --name-only origin/main...HEAD` names 0 shell files across the 14
    changed paths. The gate's 127 clause applies; CI's Shellcheck step passed on
    #89.
  - No new or undocumented findings.
- **Pass — `Fixes #88`.** `gh pr view 89 --json body` → the first line is
  `Fixes #88`.

## Plan vs implementation

The implementation follows `## Approach` items 1–5 closely. The parser is in
`scripts/session-state.mjs`. `treeState`, `ownerTreeOf`, and `companionTreeOf` in
`scripts/agento.mjs` use a raw `execFileSync` rather than `git()`, so the leading
space of ` M` survives (the code comments on this). `ahead` uses the same
upstream / `--not --remotes` fallback as `describeCompanion`. `extension/cli/` is
a byte copy (`cmp` of `agento.mjs` and `session-state.mjs` → 0, and every
`scripts/` file with a CLI copy matches). All 25 `.github/prompts/*.prompt.md`
files match `commands/*.md` byte for byte.

Deviations from the plan's intent, as opposed to its wording:

- plan.md `## Research` states that "`git clean -f -- <paths>` removes exactly the
  named untracked files". That holds only for names without pathspec
  metacharacters (Finding 1).
- `## Research` says the parser "must skip" the origin token of `R`/`C` entries.
  It does that only when `X` is `R`/`C`, not when `Y` is (Finding 2).

No undocumented or out-of-scope changes. `owner` and `companion` keep their
shapes, and `close-decision` is untouched.

Skills consulted: none — no matching domain (this repository's AGENTS.md has no
`## Agento` skills table, and no `.agents/skills/` covers git CLI or prompt work).

## Roadmap audit

I spot-checked all nine ticked steps against the code and re-ran their checks:

- 1.1 and 2.2 against the #88 test and its recorded failing run.
- 2.1 against the five unit tests.
- 2.3 by re-running the repro.
- 3.1, 4.1, and 5.1 by re-running their greps, `cmp`, and the customizations
  test.
- 6.1 by re-running the full scoped gate.
- 6.2 by the PR states, `Fixes #88`, both halves integrated, and both trees
  clean.

Each step's `verify:` passes as written, so I unticked nothing. There are no
`(manual)` or `(manual, post-ship)` steps.

Repairs. I added missing-work steps for the two defects and a re-gate:

- **2.4 (added 2026-10-04, review):** `splitPorcelain` skips the origin token when
  either status column is `R`/`C`.
- **3.2 (added 2026-10-04, review):** the ship prompt deletes with literal
  pathspecs; `ownerTree: null` with an owner is a hard reject; the CHANGELOG
  wording follows the prompt.
- **6.3 (added 2026-10-04, review):** re-run the scoped gate, then integrate and
  publish.

`next-step` now points at 2.4. `status` stays `in-review` for the Builder's
resume protocol to move to `in-progress`.

## Findings

1. **Major — ship's cleanup deletes unlisted untracked files whose names contain
   glob characters.** In
   [.github/prompts/ship.prompt.md](https://github.com/david-perry-software/agento/blob/issue/ship-untracked-byproducts/.github/prompts/ship.prompt.md)
   step 3, "Untracked byproducts first" prescribes `git -C <owner.path> clean -f --
   <each listed path>`. Git reads each argument as a pathspec, so `*`, `?`, `[…]`,
   and `:(magic)` prefixes are interpreted. Reproduced in a throwaway repo
   (git 2.43.0) with untracked `shot[1].png`, `shot1.png`, and `keep.png`:
   - `git clean -n -- 'shot[1].png'` → `Would remove shot1.png` **and**
     `Would remove shot[1].png`.
   - With `git --literal-pathspecs clean -n -- 'shot[1].png'` → only
     `shot[1].png`.
   - `git clean -n -- ':(literal)shot[1].png'` → only `shot[1].png`.

   The cleanup would delete `shot1.png`, a file the user never saw or confirmed.
   The re-check runs only after the deletion, so it can't prevent this. Fix:
   - Prescribe `git -C <owner.path> --literal-pathspecs clean -f -- <each listed
     path, single-quoted>`.
   - Add a guard (test or customizations canary) that the prompt's cleanup
     command carries `--literal-pathspecs`.
   - Update the CHANGELOG bullet to match.
2. **Medium — `splitPorcelain` misparses worktree-side rename entries.**
   [scripts/session-state.mjs](https://github.com/david-perry-software/agento/blob/issue/ship-untracked-byproducts/scripts/session-state.mjs)
   skips the origin token only when `xy[0]` is `R`/`C`. In porcelain v1 the
   origin path follows whenever *either* column is `R` or `C`. A worktree-side
   rename (`mv old.js new.js && git add -N new.js`) emits
   ` R new.js\0old.js\0`. The probe ran the real `git status --porcelain=v1 -z
   --untracked-files=all` output through the branch's `splitPorcelain` and got
   `{"tracked":[".js","new.js"],"untracked":[]}`: the origin token `old.js` was
   read as an entry with status `ol` and path `.js`. An origin path that begins
   with `R` or `C` also makes the parser skip the *next real entry*:
   `splitPorcelain(" R docs/new.md\0README.md\0?? stray.png\0")` returns
   `{"tracked":["DME.md","docs/new.md"],"untracked":[]}`. `stray.png` is
   dropped and `DME.md` is invented.

   Ship isn't unsafe here, because any rename makes `tracked` non-empty and so
   hard-rejects. But `ownerTree` and `companionTree` would report invented or
   missing paths, and ship quotes those lists to the user verbatim. Fix: skip
   when `xy[0]` or `xy[1]` is `R`/`C`, and add unit cases for ` R new\0old\0`
   followed by `?? x\0`, and for an origin path starting with `R`.
3. **Minor — `ownerTree: null` with an owner present isn't handled by the
   prompt.** `treeState()` returns `null` when `git status` fails in an existing
   owner directory. Every ship check reads `ownerTree.tracked`, `.untracked`, or
   `.ahead`, so a `null` there leaves the clean check undefined. Add one clause
   to step 2's hard-reject list: `ownerTree === null` while `owner !== null`.
4. **Nit — Builder Pause-protocol wording.**
   [.github/agents/delivery-builder.agent.md](https://github.com/david-perry-software/agento/blob/issue/ship-untracked-byproducts/.github/agents/delivery-builder.agent.md)
   now has "Either stop leaves both trees clean … Either stop is a `completed` §9
   result" back to back. "Both trees" also reads oddly in the in-repo layout,
   which has only one tree. This is optional and doesn't block approval.

No secrets, injection, or shell-quoting issues in the CLI code. `treeState` uses
fixed `execFileSync` argument arrays.

## Follow-ups

None beyond the roadmap steps added above.
