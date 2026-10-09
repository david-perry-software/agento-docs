# Review: dashboard-cli

Verdict: request-changes

Reviewed 2026-10-09 at product `feature/dashboard-cli` `8e93487` (code PR #101) and
companion `feature/dashboard-cli` `6d4bd99` (artifact PR #38). Both halves were in sync
with `origin/feature/dashboard-cli`, and `origin/main` was an ancestor in each.
Skills consulted: none (no matching domain). The repository has no `.agents/skills/`
and no `## Agento` skills table.

The implementation is sound and every gate is green. The verdict rests on one
acceptance item whose named verification is missing for `dashboard` itself (see
Findings 1). The fix is a two-line test change, added to the roadmap as step 3.6.

### Verification run by the Reviewer

| Check | Result |
| --- | --- |
| `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | 347 tests, 347 pass, 0 fail |
| `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` | exit 0 |
| `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` | exit 0 |
| `git ls-files '*.sh' \| xargs pnpm dlx shellcheck` | exit 0, no findings (matches the zero-finding baseline) |
| `cd extension && npm run build` | exit 0 |
| `npm run test:unit` | 160 tests, 160 pass |
| `npm run test:electron` (`local:3165/4165`) | exit 0. All four scenarios passed: in-repo, companion, workspace, no-markdown |
| `npm run package` | exit 0, VSIX archive assertion passed |
| `cmp extension/cli/*.mjs scripts/*.mjs` (6 files) | all identical |
| `git status --porcelain --untracked-files=all` after the gate | empty |
| PR #101 / #38 | both OPEN, draft, MERGEABLE. #101 CI `test` SUCCESS at `8e93487` |

The `worktree list --porcelain` count was checked by hand. A logging `git` wrapper
was put first on PATH, and each command ran in the build worktree against this
repository, which runs in companion mode. Each of `dashboard`, `dashboard --pr`,
`session`, `status --pr`, and `initiative` produced exactly 1 call with
`-C <build worktree>` and exactly 1 with `-C /home/david/DP/agento-docs`, and every
command exited 0.

Timing re-measurement: three wall-clock runs of each command, using
`spawnSync("node", [cli, …])` with the branch CLI against the live `gh`. Times are in ms.

| cwd | `session --pr` | `doctor` | `status --pr` | `initiative` | `initiative agento-hardening` | `dashboard --pr` |
| --- | --- | --- | --- | --- | --- | --- |
| build worktree | 1358/1279/1409 (med 1358) | 1214/1290/1213 (1214) | 1452/1394/1407 (1407) | 67/66/69 (67) | 73/74/74 (74) | 917/938/688 (917) |
| primary `/home/david/DP/agento` | 1043/856/899 (899) | 1206/1168/1176 (1176) | 1297/1372/1307 (1307) | 64/67/65 (65) | 72/76/71 (72) | 1115/979/966 (979) |

- **Build worktree:** slowest standalone median 1 407, sum 4 120, `dashboard --pr`
  median 917. It is ≤ the slowest (yes) and ≤ the sum (yes).
- **Primary:** slowest standalone median 1 307, sum 3 519, `dashboard --pr` median
  979. It is ≤ the slowest (yes) and ≤ the sum (yes).

These numbers agree with `evidence/timings.md` round 2.

## Acceptance checklist results

1. **pass:** `dashboard` returns the envelope and every section deep-equals its
   standalone subcommand. The test `dashboard sections deep-equal session, doctor,
   status, and initiative in in-repo and companion fixtures`
   (scripts/agento.test.mjs L3726) covers both layouts, primary and build cwd, with and
   without `--pr`, and the OPEN, NONE, and no-`gh` cases. It also asserts the key order
   `status, session, doctor, deliveries, initiatives, timings, root, configSource` and
   that each timing is a number.
2. **pass, interpreted.** With `--pr`: one `gh --version` and one `pr view` per
   distinct `(clone, branch)`, covered by the test at L3745. Without `--pr`: no
   `gh pr view`. The doctor section still runs `gh --version`/`gh auth status`, as
   standalone `doctor` does. That reading is the only one consistent with item 1,
   which requires the doctor section to deep-equal `doctor` and so to run the `gh`
   check. It also matches Approach step 5's "(no `gh` process without `--pr`, as
   today)", because today's refresh already runs `doctor`. Departure (b) is acceptable.
3. **fail.** The item requires that `dashboard` from a product cwd runs
   `git worktree list --porcelain` once per clone, "verified by a logging `git`
   wrapper in `scripts/agento.test.mjs`". The only such test (L3632, loops at
   L3638–L3641 and L3648–L3651) covers `session`, `status --pr`, and `initiative`, but
   not `dashboard`. The behaviour itself is correct (Reviewer's hand check above), but
   the item's named, durable verification for the feature's own subcommand does not
   exist. A missing verification is a failing verification. See Findings 1 and
   roadmap step 3.6.
4. **pass:** The test at L3793 (`chmod 000` on a roadmap, skipped as root) asserts
   exit 0, `status: "ok"`, `deliveries.status === "error"` with an `EACCES` message,
   and the doctor section intact. It ran (not skipped) in the 347-test run.
5. **pass:** The test at L3810 asserts that `dashboard --plugin-root` and
   `doctor --plugin-root` produce equal `model-profile` checks, and that the result
   differs without the flag.
6. **pass:** 347/347. The diff of `scripts/agento.test.mjs` removes only the old
   `prStub` signature and comment. `prStub` gains an optional `logVersion`
   (default `false`), so existing callers produce the same stub. No pre-existing
   assertion changed, and `tests/` and the other `scripts/*.test.mjs` files are
   untouched.
7. **pass:** extension/src/extension.ts makes one
   `client.run(["dashboard", "--pr", ...(root ? ["--plugin-root", root] : [])])` per
   refresh under a single `LatestDeliveryRefresh`. `extensionIntegration.test.ts`
   asserts exactly one `client.run(` in the refresh handler and no
   `session`/`doctor`/`status`/`initiative` spawns, and checks that
   `latestInitiativeRefresh` is gone. The Electron suite asserts `pending.length === 2`
   after two refreshes and `start + 1` per further refresh. Both passed.
8. **pass, with departure (c) accepted.** `dashboardDocument.test.ts` (5 tests) and
   the Electron in-repo/companion scenarios cover the per-section error rendering. In
   the initiatives-error case only Initiatives errors. In the doctor-error case only
   Session & Doctor errors, and the gate stays open. Session & Doctor also errors when
   the `deliveries` section fails. That follows from `createSessionDoctorModel`
   needing the status document for the active count, and extension/README.md and
   CHANGELOG.md document it. "Only that view" therefore means only the views that
   read the failing section, which is acceptable.
9. **pass:** `evidence/timings.md` records both rounds, and the Reviewer's own
   measurement above reproduces `yes` for both comparisons from both cwds.
10. **pass:** `grep -c dashboard` finds the term in docs/commands.md (2), AGENTS.md
    (2), extension/README.md (6), docs/extension.md (7), and CHANGELOG.md (12), and
    `tests/customizations.test.mjs` passes within the 347.
11. **pass:** The six `cmp` checks are identical, also after the Reviewer's
    `npm run build`, which runs `copy-cli`.
12. **pass:** The full gate is green. See the verification table.

## Plan vs implementation

The implementation follows `## Approach` steps 1–8. The departures the Builder
reported:

- **(a)** The 2.1 pool/lookup helpers are tested through `dashboard --pr`.
  **Acceptable.** `agento.mjs` runs its `switch` at import and calls
  `process.exit`, so it cannot be imported. The tests still show the step's intent:
  - L3773: eight lookups complete, peak concurrency is between 2 and 4, and results
    are correct.
  - L3726: async lookups deep-equal the synchronous `session --pr`/`status --pr`
    results under OPEN, NONE, and no-`gh`.
  The roadmap 2.1 note records the substitution.
- **(b)** "No `gh` without `--pr`" was checked as no `gh pr view`. **Acceptable**;
  see acceptance item 2.
- **(c)** Session & Doctor errors on a failed `session`, `doctor`, or `deliveries`
  section. **Acceptable**; see acceptance item 8. The gate is closed only when the
  `session` section fails (`gate: session instanceof Error ? CLOSED_GATE : …`).
- **(d)** The assertion in `gateDashboardPlanActions.test.ts` was updated.
  **Acceptable.** The old assertion pinned the removed source text
  (`windowGate(sessionResult.json)`). The new one still enforces fail-closed
  behaviour for a failed session section. Acceptance item 6's no-modification rule
  covers the `scripts/` and `tests/` suites, not extension source-regex tests.
- **(e)** Step 2.7 was added to reorder the probe and lookup work. **Acceptable.**
  It is exactly the mitigation `## Risks` prescribes when round 1 missed the target,
  and the measurement is recorded.

Undocumented behaviour changes, all harmless:

- `probe()` now memoises per command and arguments for the process.
- `runDoctor` memoises each check, which only affects `dashboard`, where the local
  checks run early.
- The `gh --version` probe used by `lookupPullRequest` and `release` now has the
  doctor probe's 10 s timeout and `GIT_TERMINAL_PROMPT=0` instead of 15 s.

## Roadmap audit

Every ticked box (1.1–1.4, 2.1–2.7, 3.1–3.5) was spot-checked against the code, and
none is falsely ticked:

- `productWorktrees()` and the memoised `primaryWorktreesDir`, and the
  `{ fresh: true }` read after `worktree add` in `start-session`.
- `ghVersion()` used in `lookupPullRequest`, the doctor `gh` check, and `release`.
- The document builders.
- `runPool`, `lookupPullRequests`, and `doctorProbes`.
- `dashboardDocument` with per-section try/catch and `timings`.
- The usage line, with the slice widened to 27.
- `splitDashboardDocument`, the single-spawn refresh, the Electron fixture changes,
  and the docs.

Repairs made:

- **Added step 3.6 (added 2026-10-09):** extend the logging-`git` test to
  `dashboard` and `dashboard --pr`, closing acceptance item 3.
- **Header:** `status: in-progress` and `next-step: "3.6"`, so the Builder resumes
  at the new step.

There are no `(manual)` or `(manual, post-ship)` steps.

## Findings

1. **Medium: acceptance item 3 has no test for `dashboard`.** The `dashboard`
   worktree-list count, the headline "computed once" claim, has no regression test.
   scripts/agento.test.mjs L3632–L3652 loops over
   `[["session"], ["status", "--pr"], ["initiative"]]` only, so a later change to
   `dashboardDocument` (scripts/agento.mjs L1870) that re-reads the list would go
   unnoticed. Fix: add `["dashboard"]` and `["dashboard", "--pr"]` to both loops (the
   `prStub`-less `restrictedPath` from `gitLoggingPath` already has no `gh`, so
   `--pr` lookups degrade to warnings and still exit 0).
2. **Minor: an unreadable issue roadmap also fails the initiatives section.**
   `dashboardDocument` walks all roadmaps once (scripts/agento.mjs L1880) and the
   initiatives section reads that walk (L1913). If an issue roadmap is unreadable,
   `initiatives` becomes `{ status: "error" }`, while standalone `initiative`, which
   walks features only, would succeed. This is an edge case (I/O errors only) and
   does not block, but it is a small departure from "each section identical to its
   subcommand".
3. **Minor: "byte-for-byte" overstates what the tests check.** docs/commands.md L160
   says each section is "byte-for-byte what that subcommand prints". The sections are
   nested and re-indented inside the envelope, and the tests check JSON deep equality.
   "the same JSON document" would be accurate.

## Follow-ups

- Consider walking feature and issue roadmaps separately in `dashboardDocument`, so
  an unreadable issue roadmap cannot fail the initiatives section (Finding 2).
