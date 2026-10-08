# Review: deterministic-release-wait

Verdict: approve

Reviewed 2026-10-07 (round 2, after the `/agento ship` conflict fix) on product
`a1a5311` (code PR #95; merge of `f17fce4` and `origin/main` `9615a72`, PR #94
start-session-cli) and companion `e43514e` (agento-docs PR #31; merge `d6a4012`).
`origin/main` is an ancestor of both halves, both halves are 0 ahead / 0 behind
their `origin` branch, and both trees were clean before review. Skills consulted:
none — no matching domain (no `.agents/skills/`, no AGENTS.md skills table; Node
CLI, Bash, prompt prose).

## Merge audit (round 2 focus)

- **Only this delivery's changes remain on top of `main`.** `git diff --numstat
  origin/main HEAD` lists exactly the 19 files of the round-1 diff; the only line
  `scripts/agento.mjs` removes from `main` is the `usage()` slice `(1, 25)` →
  `(1, 26)`, and `scripts/agento.test.mjs` removes nothing.
  `git diff origin/main HEAD --stat` over `extension/src`, `extension/test`,
  `scripts/session-state{,.test}.mjs`, `.github/prompts/start-session.prompt.md`,
  `commands/start-session.md`, `tests/customizations.test.mjs`,
  `docs/extension.md`, and `docs/model-profiles.md` is empty: start-session-cli
  arrived intact.
- **Both CLI surfaces live.** `scripts/agento.mjs` imports both `release-state.mjs`
  and the widened `session-state.mjs` list (`classifyFetchFailure`,
  `nextSessionId`); `parseArgs` keeps `--resume`/`--no-open` and `--wait`/`--interval`;
  `case "start-session"` and `case "release"` both present. Probes: `release
  abc1234` (agento has no `releaseWorkflow`) → 0 `not-configured`; `release
  ABC1234` → 1; `release abc1234 --wait 61` → 1; `start-session 'Bad Arg!'` → 1
  with the session-id message; `start-session --resume` → 1 "needs a session id";
  `doctor --for start-session` → 0.
- **Usage covers every header line.** Header lines 2–26 are the usage text (17
  subcommand lines incl. `start-session …` and `release …`, then the two-line
  `Options:` paragraph ending "re-anchors on its product checkout)."); `slice(1, 26)`
  emits exactly those and not the blank line 27. A usage-error run printed both
  new lines once each and the full `Options:` paragraph; the models test "the usage
  header lists the subcommand and keeps the full Options paragraph" pins it.
- **`extension/cli/` byte-identical to `scripts/`.** `cmp` of all six files
  (`agento.mjs`, `agento-config.mjs`, `session-state.mjs`,
  `delivery-roadmap-resolver.mjs`, `model-profiles.mjs`, `release-state.mjs`) → equal;
  `npm run build` (which reruns `copy-cli`) left `git status` empty.
- **Prompt mirrors byte-identical.** `cmp` of all 25 `.github/prompts/<n>.prompt.md`
  against `commands/<n>.md` → no differences.
- **CHANGELOG keeps both entries.** `## Unreleased` holds the `agento.mjs release`
  entry followed by main's `start-session` entry, #92 fix, and the rest unchanged
  (`git diff origin/main HEAD -- CHANGELOG.md` is a pure 12-line addition).
  `docs/commands.md` carries both texts (pure addition of the `release` paragraph
  and exit codes).

## Acceptance checklist results

1. **`release-state.test.mjs` covers every verdict** — pass. One test each for exact
   `success` / `pending` / `failed`, `superseded-success`, non-descendant → `failed`,
   pending descendant → `pending`, docs-only → `not-triggered`, grace → `pending` /
   `no-run`, `dispatch-required`, and same-SHA dispatch not shadowing the push run
   (`pickExactRun` test). `globToRegExp` cases for `*`, `**`, `**/` (zero dirs), `?`,
   classes, `!`. `scripts/release-state.mjs` and its tests are untouched by the
   merge. Covered by the full-suite run below.
2. **`agento.mjs release` exit codes and JSON fields** — pass. 13 new
   `agento.test.mjs` cases against a stubbed `gh`: `not-configured` with no `gh` call
   (0), `success` in two API calls (0), `pending` (2), `dispatch-required` (2),
   `failed` (4), `no-run` (4), `not-triggered` (0), `superseded-success` (0), `gh`
   missing / HTTP 401 / unknown SHA (3), usage errors incl. `--wait 61` (1) with
   `usage` listing `release <merge-sha>`, pending→success under `--wait 3
   --interval 1` (0, `polls ≥ 2`), always-pending budget (2), no loop on
   `dispatch-required`. All 13 still pass after the merge alongside the 9
   start-session tests. Round 1 probed live: `--wait 1.5` → 1, unknown 40-hex SHA →
   3 `unknown-sha` (HTTP 422); round 2 re-probed `--wait 61` → 1, uppercase SHA → 1,
   unset workflow → 0 `not-configured`.
3. **`wait-for-checks.sh` 60 s default, change-only poll lines** — pass.
   `max_seconds=60` and the header says so (`scripts/wait-for-checks.sh`); the new
   `report()` suppresses repeated snapshots; new tests "an unchanged pending snapshot
   prints one poll line plus RESULT" and "defaults to a 60 s budget" pass. Live
   (round 2): `scripts/wait-for-checks.sh pr 95` → exit 0, `poll 1 pr #95: pass=1
   fail=0 pending=0 skipped=0 merge=CLEAN`, `RESULT: success`.
4. **Ship prompt mirror and release bullet** — pass. `cmp
   .github/prompts/ship.prompt.md commands/ship.md` → 0. The bullet drives `release
   <merge-sha> --wait 50`, reruns on exit 2 `pending`, does the pre-dispatch
   `gh run list --event workflow_dispatch` check against `mergeDate` and dispatches
   at most once, reports both URLs for `superseded-success`, treats exit 4 as a
   resumable hard stop and exit 3 per policy §1; step 4 reports the verdict.
5. **Policy §6 and AGENTS.md** — pass. §6 third bullet names `agento.mjs release
   <merge-sha> --wait N` (N ≤ 60) and "each call returning within 60 s"; AGENTS.md
   lists `release` and `release-state.mjs` and names both bounded waits.
   `tests/customizations.test.mjs` passes within the full suite.
6. **Docs** — pass. `grep "agento.mjs release\|release <merge-sha>"` matches
   `docs/project-profile.md`, `docs/commands.md`, `README.md`, `CHANGELOG.md` (one
   each); read: verdicts, `paths-ignore`, superseded runs, dispatch, exit codes, and
   the `wait-for-checks.sh` defaults are all described.
7. **Extension CLI copy** — pass. `cmp` of all six `extension/cli/*.mjs` against
   `scripts/` → equal; `tests/extension-bundle.test.mjs` passes in the full suite;
   `cd extension && npm run build` → 0 (tree still clean afterwards), `npm run
   test:unit` → 0, 119/119 (114 + start-session-cli's).
8. **Guard allows the release wait** — pass (re-run round 2).
   `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` → 0 (fixture line
   27 `node scripts/agento.mjs release abc1234 --wait 50 -> allow`); `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh
   < tests/guard-fixtures-companion.txt` → 0. No hook file changed.
9. **Live read-only checks from `/home/david/DP/soshiki`** — pass (round 1; the
   merge did not touch `release-state.mjs` or the `release` case, so not re-driven),
   re-driven independently with this branch's CLI (`checks.releaseWorkflow:
   "staging-release.yml"`):
   - `dfdacce8` (newest first-parent merge, 19 non-docs files) → exit 0, `success`,
     run 37705117632, 1.00 s wall.
   - `38d5f71` (diff: `ROADMAP.md` + three `docs/**` files only) → exit 0,
     `not-triggered`, 1.61 s.
   - `1634ff4` (`gh run view 37025633788` headSha, completed/success) → exit 0,
     `success`, `run.id` 37025633788, 0.90 s.

   These match the Builder's `evidence/release-*.json` and `.time.txt` (1.05 s).
   Soshiki's tree stayed clean (`git status --porcelain` empty).
10. **Full gate vs baseline** — pass (round 2, on `a1a5311`). `node --test
    'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' > file` → exit 0, 340 tests, 340
    pass, 0 fail, 0 cancelled, 0 `not ok` (baseline 289/289; round 1 328; +12 from
    start-session-cli). Shellcheck is not installed locally; PR #95 CI run
    37714541834 on `a1a5311`, job `test`: steps `Shellcheck`, `Unit tests`, `Guard
    fixture replay` → `success` (zero findings); `scripts/wait-for-checks.sh pr 95` →
    exit 0; `gh pr view 95` → `MERGEABLE` / `CLEAN`, still draft. Both guard replays
    exit 0. Extension build 0, unit 119/119. Both halves are clean at handoff.

## Plan vs implementation

- Implementation matches the Approach: pure `scripts/release-state.mjs`, `release`
  case at the end of the switch, lazy fact gathering (a `success` costs two API
  calls, asserted by a test), `Atomics.wait` loop, exit table, extension copy, prompt,
  policy, docs, guard fixture.
- Small, sensible additions beyond the plan, all tested: `tags` / `tags-ignore` are
  parsed so a tag-only push trigger counts as not triggering on a branch;
  `branchTriggered` is exported; a workflow with neither a branch push trigger nor
  `workflow_dispatch` yields `not-triggered` instead of `dispatch-required`; HTTP 422
  on the commit maps to `unknown-sha`; a non-`.yml` workflow name or a missing
  workflow file is treated as `unparsed` (waits, never claims "not needed").
- Out-of-scope items were respected: no hook or guard code changes, no `doctor`
  changes, Phase E kept as a roadmap Follow-up.

## Roadmap audit

All 13 boxes ticked; each spot-checked against the code and re-run where executable
(1.1–1.3 via `release-state.test.mjs`; 2.1–2.2 via `agento.test.mjs` and live
probes; 2.3 via `cmp` + extension build/unit; 3.1 via the new tests and the CI
Shellcheck step; 4.1 via `cmp` and a read; 4.2 via both replays; 4.3 via the grep;
5.1 via the round-1 independent live runs; 5.2 via the round-1 gate). The added
step 5.3 (ship conflict fix) checks out against every clause of its `verify:`: the
merge `a1a5311` has parents `f17fce4` and `9615a72`, the companion merge `d6a4012`
is in the companion history, both suites, both header lines, both CHANGELOG
entries, the `copy-cli` regeneration, the mirrors, 340/340, both replays, extension
build + 119/119, CI 37714541834 green with `Shellcheck`, and PR #95
`MERGEABLE`/`CLEAN` — all reproduced above. No falsely ticked boxes, no missing
steps, no repairs. No `(manual)` or `(manual, post-ship)` steps.

## Findings

The merge introduced no new findings. Carried forward from round 1 (code
unchanged, both still apply):

1. **Minor — `--wait 60` can exceed the 60 s per-call rule.** The loop in
   `scripts/agento.mjs` (`case "release"`, `while (result.verdict === "pending" &&
   waited + interval <= wait)`) counts only sleep time, not snapshot time, so
   `--wait 60 --interval 10` sleeps 60 s plus up to seven snapshots (each 1–6 `gh api`
   calls with a 15 s timeout). `parseArgs` accepts 60, and policy §6 and AGENTS.md
   advertise "N ≤ 60". The ship prompt's `--wait 50` leaves ~10 s headroom, and
   observed snapshots take ~1 s, so the documented path is safe. Not blocking;
   suggested fix in Follow-ups.
2. **Nit — run events outside `push` / `workflow_dispatch` are ignored by
   `pickExactRun`.** A workflow released via `schedule` or `workflow_run` on the merge
   SHA reads as no run and ends `no-run` after grace. This is deliberate (tested in
   `pickExactRun` with `event: "schedule"`) and conservative (a stop, never a false
   success).

No security issues: `gh` is invoked with `execFileSync` and an argument array (no
shell), the SHA is validated against `^[0-9a-f]{7,40}$` before use in API paths, the
workflow name and branch are `encodeURIComponent`-encoded, and nothing prints tokens
(evidence scanned for `token|ghp_|secret`: 0 matches).

## Follow-ups

- Enforce the 60 s per-call budget in `agento.mjs release` against wall-clock time
  (stop polling when `elapsed + interval` would pass `wait`, or cap `--wait` below 60
  to reserve snapshot time), so `--wait 60` honours policy §6 as written.
- Soshiki PR (from the roadmap, Decision 1): copy the new `scripts/wait-for-checks.sh`
  and point its AGENTS.md release-proof paragraph at `agento.mjs release <merge-sha>
  --wait 50`.
