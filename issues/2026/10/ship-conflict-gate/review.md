# Review: ship-conflict-gate

Verdict: approve

Reviewed 2026-10-11 at product `993cd30` (`issue/ship-conflict-gate`, draft PR #108,
`mergeable: MERGEABLE` / `mergeStateStatus: CLEAN`, required check `test` SUCCESS) and
companion `116ecbd` (draft PR #44, `CLEAN`). `origin/main` is an ancestor of both
halves; both trees clean, companion `ahead: 0`, `behind: 0`.

Skills consulted: none — no matching domain (no `## Agento` skills table, no
`.agents/skills/`; the change is the Agento CLI's own Node code, prompts, and docs).

Verification target: CLI and tests only (no user-visible UI, no `(manual)` steps), so
no browser evidence applies; every check below was re-run by the Reviewer in the
product half.

## Acceptance checklist results

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Exposing `#107` test fails before, passes after | pass | Before: roadmap 1.1/1.2 record `exit=1`, 164/163/1, the one `not ok` the #107 test, committed alone in `d9cd354` (`git log` shows it precedes `1dfc537`). After: `node --test --test-name-pattern='#107' scripts/agento.test.mjs` → exit 0, 3/3 (`/tmp/scg-review-107.txt`). |
| 2 | `CONFLICTING`/`DIRTY` → `pr-conflicting`, `companion-pr-conflicting`, preflight `conflicting-pr` | pass | `isConflicting` at `scripts/agento.mjs` L1930, used at L2157, L2159, L2276, L3233; the updated hard-gap, companion-audit, and `ship-preflight --pr` tests pass in the full suite. |
| 3 | No `mergeStateStatus … CONFLICTING` left | pass | `grep -rnE 'mergeStateStatus[^,]{0,6}CONFLICTING\|mergeStateStatus: CONFLICTING' scripts docs .github commands` → no output, exit 1. |
| 4 | `prViewArgs`/`prSummary` carry `mergeable`; `UNKNOWN` → warning, no gap | pass | Diff L642, L1927; test "an open PR whose mergeability GitHub has not computed yet is a warning, not a gap" → ok (`/tmp/scg-review-unit.txt`). |
| 5 | `--confirm` at `checks` with conflicting PR reopens and rejects (both layouts) | pass | Test "ship --confirm at checks with a conflicting PR reopens the roadmap and rejects" → ok: `rejected`/`audit-gaps`, `roadmap-reopened`, `origin/<branch>` `status: in-review`, no accepted-at-ship section, no `pr merge` in the stub log; companion case lands the reopen commit in the half and leaves the product branch untouched. |
| 6 | Merge refused as not mergeable reopens (no-owner path, primary restored) | pass | Test "a merge refused as not mergeable reopens the roadmap on the no-owner path; any other merge failure does not" → ok: primary back on `main` and clean, `rejectTo` `start-session … --resume`; a GraphQL stderr stays `gh-error` with the roadmap `complete`. |
| 7 | Failing required check keeps `checks-failed`, adds `roadmap-reopened`, next send `audit` | pass | Extended test "pending checks … a failing check stops before the merge" → ok, including the no-owner variant. |
| 8 | `reopenRoadmap` unit test | pass | Test "reopenRoadmap restores in-review, sets last-updated and next-step, and removes only the accepted-at-ship follow-ups" → ok (round-trip byte-identical, header-only change, idempotent). |
| 9 | Prompt mirror, docs, policy §9, CHANGELOG | pass | `cmp .github/prompts/ship.prompt.md commands/ship.md` → 0; `roadmap-reopened` count 2; `reopen` count in delivery-policy 2; `(#107)` count 1; `node --test tests/customizations.test.mjs tests/extension-bundle.test.mjs` → exit 0, 42/42. |
| 10 | `extension/cli/` matches `scripts/` | pass | Same run as 9 (`extension-bundle.test.mjs` included), exit 0. |
| 11 | Scoped gate (§5) against the baseline | pass | Full suite `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → 441 tests / 441 pass / 0 fail / 0 cancelled (baseline 436; `/tmp/scg-review-full.txt`); guard replays exit 0 and 0; `cd extension && npm run test:unit` → exit 0, 167/167; `npm run lint:hooks` → 127 `shellcheck: not found` (as at baseline) and `git diff --name-only origin/main...HEAD` names no `scripts/hooks/` or `scripts/wait-for-checks.sh` path. No new finding. |
| 12 | `evidence/repro.sh` against `HEAD` exits 0 | pass | Reviewer re-run (`AGENTO=<product half> bash evidence/repro.sh`, to a temp file) → `exit=0`; matches the committed `evidence/repro-output-fixed.txt`. |

## Plan vs implementation

The implementation follows plan.md `## Approach` items 1–6. Three recorded deviations,
judged on merit:

- **`completeRoadmap` + `reopenRoadmap` live in `scripts/delivery-roadmap-resolver.mjs`.**
  Justified: `scripts/agento.mjs` dispatches its CLI at module top level
  (`switch (command)`), so importing it from a test would execute the CLI. The move
  is behavior-preserving (the header setter is factored into `setRoadmapHeader`, same
  regexes, same appended section), `agento.mjs` imports both, and the bundled copy in
  `extension/cli/` is refreshed. Recorded on step 3.1.
- **`shipStub`'s `refuseMerge` refuses unconditionally** (`true` → GitHub's
  not-mergeable message, a string → that stderr). Justified: the plan's step 3.3
  wording was self-contradictory (refuse only when `mergeable: CONFLICTING`, yet keep
  the PR `MERGEABLE` so the pre-write re-check passes); a static stub cannot flip state
  between the re-check and the merge. The string form also gives the negative case
  (`gh-error`, no reopen). Test-only; recorded on step 3.3.
- **The ship prompt says "a merge GitHub refused as not mergeable", not
  `gh pr merge`.** Required: `tests/customizations.test.mjs` L318 forbids `gh pr merge`
  in prompts ("the CLI merges"). `docs/commands.md` keeps the literal command, which
  is in scope for docs. Recorded on step 4.1.

No undocumented changes: the diff touches exactly the ten files listed in step 5.2.

## Roadmap audit

All 14 ticked steps spot-checked against the code and re-run evidence above; none
falsely ticked, none missing. 5.4's claims hold: `origin/main` is an ancestor of both
halves, PR #108 body is `Fixes #107`, both trees clean. No repairs made.

## Findings

No finding above minor severity.

1. **Minor — reopen does not force a fresh review.** After a `checks-failed` reopen
   (or a conflict reopen resolved without new code), the next audit sees an approving,
   non-stale review and proceeds to confirm again; the `next-step` text ("then
   re-review") is advisory only. Not unsafe — a still-failing check or still-present
   conflict reopens again — but each cycle adds a `ship` + `reopen` commit pair.
   `scripts/agento.mjs` L2244–L2265 (`reopen`) and the audit gap list L2137–L2167.
2. **Minor — no test for the companion-mode no-owner reopen** (`target =
   artifactsClone` via `switchTo(…, "companion")`). The branch is symmetric with the
   tested in-repo no-owner path and the existing confirm path, so risk is low.
   `scripts/agento.mjs` L2245–L2246.
3. **Nit — reopen commits whatever `roadmap.md` holds in the owner tree.** The
   `checks` phase does not re-check owner cleanliness before `reopen` writes and
   stages `roadmap.md`; an uncommitted edit to that one file would ride along in the
   reopen commit. Same exposure as the existing changelog re-stamp at `checks`.
4. **Nit — policy §9 row wording.** "rejects back to the build window" is the owner
   case; without an owner the `rejectTo` is `/agento start-session <type>/<slug>
   --resume` in the primary window (correctly documented in `docs/commands.md`).
   `.github/instructions/delivery-policy.instructions.md` L267.
5. **Nit — `reopen` reports a fast-forward failure as `failed`/`owner-diverged`**
   while the confirm path reports the same condition as `rejected`/`owner-diverged`.
   Both are retry-safe; the status names differ. `scripts/agento.mjs` L2250.

## Follow-ups

- Make a ship reopen sticky until re-review: treat a `next-step` beginning
  `ship reopened (` as a hard `review-stale`-style gap in the audit (or compare the
  reopen commit's time against review.md), so a re-send without a fix and fresh
  review is rejected instead of re-confirming.
- Add a companion-mode, no-owner test for each reopen trigger.
- Re-check owner-tree cleanliness at phase `checks` before any write (reopen and
  changelog re-stamp).
- Policy §9 `/agento ship` row: say "rejects back to the build window (or
  `start-session --resume` without an owner)".
