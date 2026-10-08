# Review: deterministic-release-wait

Verdict: approve

Reviewed 2026-10-07 on product `f17fce4` (code PR #95) and companion
`feature/deterministic-release-wait` (agento-docs PR #31). `origin/main` is an
ancestor of both halves. Skills consulted: none — no matching domain (no
`.agents/skills/`, no AGENTS.md skills table; Node CLI, Bash, prompt prose).

## Acceptance checklist results

1. **`release-state.test.mjs` covers every verdict** — pass. One test each for exact
   `success` / `pending` / `failed`, `superseded-success`, non-descendant → `failed`,
   pending descendant → `pending`, docs-only → `not-triggered`, grace → `pending` /
   `no-run`, `dispatch-required`, and same-SHA dispatch not shadowing the push run
   (`pickExactRun` test). `globToRegExp` cases for `*`, `**`, `**/` (zero dirs), `?`,
   classes, `!`. Covered by the full-suite run below.
2. **`agento.mjs release` exit codes and JSON fields** — pass. 13 new
   `agento.test.mjs` cases against a stubbed `gh`: `not-configured` with no `gh` call
   (0), `success` in two API calls (0), `pending` (2), `dispatch-required` (2),
   `failed` (4), `no-run` (4), `not-triggered` (0), `superseded-success` (0), `gh`
   missing / HTTP 401 / unknown SHA (3), usage errors incl. `--wait 61` (1) with
   `usage` listing `release <merge-sha>`, pending→success under `--wait 3
   --interval 1` (0, `polls ≥ 2`), always-pending budget (2), no loop on
   `dispatch-required`. Independently probed live: `--wait 61` → 1, `--wait 1.5` → 1,
   uppercase SHA → 1, unknown 40-hex SHA → 3 `unknown-sha` (GitHub answered HTTP 422,
   which `ghApi` maps correctly).
3. **`wait-for-checks.sh` 60 s default, change-only poll lines** — pass.
   `max_seconds=60` and the header says so (`scripts/wait-for-checks.sh`); the new
   `report()` suppresses repeated snapshots; new tests "an unchanged pending snapshot
   prints one poll line plus RESULT" and "defaults to a 60 s budget" pass. Live:
   `scripts/wait-for-checks.sh pr 95` → exit 0, `poll 1 … RESULT: success`.
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
7. **Extension CLI copy** — pass. `cmp` of `scripts/agento.mjs` and
   `scripts/release-state.mjs` against `extension/cli/` → 0 and 0;
   `tests/extension-bundle.test.mjs` passes in the full suite; `cd extension && npm
   run build` → 0, `npm run test:unit` → 0, 114/114.
8. **Guard allows the release wait** — pass. `./scripts/hooks/replay-guard.sh <
   tests/guard-fixtures.txt` → 0 (fixture line 27 `node scripts/agento.mjs release
   abc1234 --wait 50 -> allow`); `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh
   < tests/guard-fixtures-companion.txt` → 0. No hook file changed.
9. **Live read-only checks from `/home/david/DP/soshiki`** — pass, re-driven
   independently with this branch's CLI (`checks.releaseWorkflow:
   "staging-release.yml"`):
   - `dfdacce8` (newest first-parent merge, 19 non-docs files) → exit 0, `success`,
     run 37705117632, 1.00 s wall.
   - `38d5f71` (diff: `ROADMAP.md` + three `docs/**` files only) → exit 0,
     `not-triggered`, 1.61 s.
   - `1634ff4` (`gh run view 37025633788` headSha, completed/success) → exit 0,
     `success`, `run.id` 37025633788, 0.90 s.

   These match the Builder's `evidence/release-*.json` and `.time.txt` (1.05 s).
   Soshiki's tree stayed clean (`git status --porcelain` empty).
10. **Full gate vs baseline** — pass. `node --test 'scripts/**/*.test.mjs'
    'tests/**/*.test.mjs'` → exit 0, 328 tests, 328 pass, 0 fail (baseline 289/289).
    Shellcheck is not installed locally; PR #95 CI run 37709879200 on `f17fce4`, job
    `test`: steps `Shellcheck`, `Unit tests`, `Guard fixture replay` → `success`
    (clean baseline, zero findings). Both guard replays exit 0. Both halves are clean
    at handoff.

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

All 12 boxes ticked; each spot-checked against the code and re-run where executable
(1.1–1.3 via `release-state.test.mjs`; 2.1–2.2 via `agento.test.mjs` and live
probes; 2.3 via `cmp` + extension build/unit; 3.1 via the new tests and the CI
Shellcheck step; 4.1 via `cmp` and a read; 4.2 via both replays; 4.3 via the grep;
5.1 via the independent live runs; 5.2 via the full gate). No falsely ticked boxes,
no missing steps, no repairs. No `(manual)` or `(manual, post-ship)` steps.

## Findings

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
