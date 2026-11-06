# Review: allowed-window-verdict-mismatch

Verdict: approve

Reviewed 2026-11-06 (round 1) against product `issue/allowed-window-verdict-mismatch`
@ `1d94351` (origin/main `58c49fd` is an ancestor; branch pushed, `ahead 0`) and
companion @ `89dcc4a`. Both halves were `git status --porcelain --untracked-files=all`
clean at the start and at the end of the review. Every check below was run by the
Reviewer; the Builder's figures were not reused.

Skills consulted: none — no matching domain. The repository has no `.agents/skills/`
and no AGENTS.md skills table; the change is plain Node.js in the CLI core and
`node --test` tests.

## Acceptance checklist results

1. **Exposing regression test fails before the fix and passes after** — **pass.**
   Before: `git archive dafcc57` (step 1.2 commit: tests added, no production change)
   extracted to `/tmp/awvm-prefix`, `node --test scripts/session-state.test.mjs` →
   exit 1, `tests 58, pass 56, fail 2`, the two `not ok` lines being exactly the two
   #147 tests. The table test's `actual` listed 13 mismatches (indices 0–12: 4
   primary new-feature/new-issue × no-delivery/shipped, 8 plan build-feature/ap ×
   planned/building/paused + review-feature/ap × in-review, 1 freehand
   commit-current-changes), and the next test failed on the old reason
   `start with /agento new-feature …`. This matches plan.md `## Evidence`
   reproduction 2 and the step 1.2 record. After, on HEAD: both #147 tests `ok`
   (`ok 153`/`ok 154` in the six-file run, `ok 708`/`ok 709` in the full suite),
   `scripts/session-state.test.mjs` contained in a 158/158 run with exit 0. Both
   test names carry `#147 allowed-window-verdict-mismatch`.
2. **Real primary window: `allowed[]` without new-feature/new-issue; `elsewhere[]`
   lists both as secondary with a start-session reason** — **pass.** Re-driven from
   `~/DP/agento` (on `main`, clean) with this worktree's `agento.mjs session`:
   `allowed` = continue, start-session, start-freehand, new-initiative,
   delivery-status, next-feature; `elsewhere` = `/agento new-feature` and
   `/agento new-issue`, both `window: "secondary"`, reason `planning runs in a plan
   worktree; /agento start-session opens one`. Identical to
   `evidence/after-primary-window.txt`.
3. **`brief new-feature` still rejected; alternatives list it only as `(secondary
   window)`** — **pass.** Re-driven: `brief new-feature "demo description"` and
   `brief new-issue "demo description"` both print `Receipt: rejected — wrong window:
   role=primary (…, branch main); allowed: … /agento new-feature (secondary window),
   /agento new-issue (secondary window)` and exit 3.
4. **`next` in that window gives a `none` reason naming `/agento start-session`** —
   **pass** (via the test and a direct call). The real primary window is not idle
   while this delivery is in flight (`next` resolves `status: ok`, reason
   `issue/allowed-window-verdict-mismatch is in-review: reopen its worktree window`),
   the same situation the Builder recorded. Direct `deriveNext` with an idle primary
   record and `candidates: []` returns `none | nothing is in flight and no initiative
   member is ready; open a plan worktree with /agento start-session (then …), or
   start an initiative with /agento new-initiative`; the #147 next test asserts the
   same and passes.
5. **Plan role derives only `no-delivery`; freehand drops `commit-current-changes`**
   — **pass.** Diff of `scripts/session-state.mjs`: `TABLE.plan` keeps only
   `no-delivery` with the `roleForManaged` comment; `FREEHAND.allowed` is
   `finish-freehand <slug>`, `delivery-status`. The #147 table test asserts
   `{ allowed: [], elsewhere: [] }` for plan × every other lifecycle and passes. The
   probe (`evidence/probe-allowed-vs-verdict.mjs`, copied to the product root with
   its import repointed, then deleted) printed `checked 77 allowed entries; 0
   mismatches`, matching `evidence/after-allowed-vs-verdict.txt`.
6. **`SLUG_COMMANDS` defined once in `scripts/session-state.mjs`, imported by
   `brief.mjs`** — **pass.** `grep -rn "SLUG_COMMANDS = " scripts` → exactly
   `scripts/session-state.mjs:444`; `brief.mjs` line 20 imports it and
   `briefArgs` is otherwise unchanged (diff). `scripts/commands/brief.test.mjs` is
   in the 158/158 run.
7. **`extension/cli/` matches `scripts/`** — **pass.** `tests/extension-bundle.test.mjs`
   `ok` in the six-file run and the full suite; the diff shows
   `extension/cli/session-state.mjs` and `extension/cli/commands/brief.mjs` changed
   in step with their sources.
8. **Docs and changelog** — **pass.** `grep -n "commit-current-changes"
   docs/extension.md` → no match (exit 1); `docs/architecture.md` 296–299 states the
   invariant and names `scripts/session-state.test.mjs`; `CHANGELOG.md` 5–10 carries
   the `**Fixed.**` entry citing #147; `tests/customizations.test.mjs` 67/67.
9. **Full gate (§5) green** — **pass.** Fresh runs in the product worktree:
   `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'`
   → exit 0, `tests 945, pass 945, fail 0` (baseline 943 + the two #147 tests; no
   new or undocumented findings); `~/.local/bin/shellcheck` (v0.10.0)
   `scripts/hooks/*.sh scripts/wait-for-checks.sh` → exit 0, no output;
   `cd extension && npm ci && npm run build && npm run test:unit` → all exit 0,
   `tests 252, pass 252, fail 0`; `git diff --name-only origin/main...HEAD --
   scripts/hooks .github/hooks` → empty.
10. **Clean handoff in both halves** — **pass.** `git status --porcelain
    --untracked-files=all` empty in the product worktree (after the probe copy was
    removed and after the extension build) and in the companion half; session record
    `companion.dirty: false, ahead: 0, behind: 0`.

## Plan vs implementation

- The diff implements `## Approach` items 1–8 as written: `SLUG_COMMANDS` moved and
  exported frozen; `CREATE` loses the two planners; `PLAN_ELSEWHERE` defined once and
  shared by `primary.no-delivery` and `primary.shipped`; `TABLE.plan` reduced to
  `no-delivery`; `FREEHAND` trimmed; `deriveNext` reason reworded keeping the
  `nothing is in flight` prefix; `WINDOW_ROLES` comment names the #147 test; the
  two regression tests and the item-7 pin updates are present; docs/changelog
  updated.
- **Deviation (accepted): commit `1d94351 test(session-context): update primary
  Session: line pin for new allowed/elsewhere (3.2)`**, not named in plan.md. It
  changes one regex in `tests/session-context.test.mjs:133`, whose old form asserted
  `elsewhere=\[\]$` for the primary window and therefore necessarily fails once
  `PLAN_ELSEWHERE` exists. It is a direct consequence of the planned behavior
  change, discovered in the step 3.2 full gate, recorded on the roadmap 3.2 line
  ("plan.md Research omitted it") and in `## Resolution`, and the new pin asserts
  the exact post-fix `Session:` line. In scope; no action. The same kind of
  omission (the `session.test.mjs:190` `elsewhere` pin) is recorded on step 2.1.
- `## Resolution` is written and consistent with the diff: root cause (two
  hand-kept tables, no tying check), each change mapped to Decisions 1–5 and the
  planner refinement, the step 1.2 failure record, and both `evidence/after-*.txt`
  files. All 5 relative links in plan.md resolve.
- No undocumented changes: the 10 changed files are exactly the production file,
  the brief, their two `extension/cli/` copies, four test files, and three docs.

## Roadmap audit

- All 7 boxes spot-checked against the codebase and re-run as described above; none
  is falsely ticked. No `(manual)` or `(manual, post-ship)` steps exist, so no
  evidence links are required.
- Step records are specific (counts, line numbers, the two unplanned pin updates)
  and matched my re-runs: 1.1 grep single line; 2.1 158/158; 3.1 67/67; 3.2
  945/945, shellcheck 0, extension 252/252, hook diff empty; 2.2 evidence files
  reproduced byte-for-byte in content.
- No repairs made; no steps added.

## Findings

No findings above minor.

- **Minor / nit** — `scripts/session-state.mjs` `PLAN_ELSEWHERE`: the reason string
  is written twice. A shared constant would keep the two entries from drifting; not
  worth a change on its own.
- **Minor / observation** — the table test's `slugFor` mirrors `briefArgs` for slug
  extraction but skips `requireType`/`requireSlug` validation and the
  `IMPLIED_TYPE` fallback; for the fixed `TABLE` strings this is faithful, and a
  divergence would surface as a test failure rather than a false pass.
- **Observation** — the Mission Control header (`canvas/…/public/actions.js`
  `headerActions`) now lists `new-feature`/`new-issue` disabled in the primary
  window with `runs in secondary window — planning runs in a plan worktree; /agento
  start-session opens one` and no handoff checkout (secondary entries carry
  `checkout: null`). This is the behavior `## Risks` describes as intended.

## Follow-ups

- None required. (Optional: fold the `PLAN_ELSEWHERE` reason into one constant the
  next time `session-state.mjs` is touched.)
