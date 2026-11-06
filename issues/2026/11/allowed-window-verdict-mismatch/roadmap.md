```yaml
status: in-progress
branch: issue/allowed-window-verdict-mismatch
last-updated: 2026-11-06
next-step: "3.2 Full gate (§5)"
github-issue: "#147"
artifact-pr: "#80"
```

## Phase 1: Expose the defect

- [x] 1.1 Implement plan.md `## Approach` item 1, with no behavior change. Move
  `SLUG_COMMANDS` from `scripts/commands/brief.mjs` (line 77) into
  `scripts/session-state.mjs` as an exported frozen `Set`, with a one-line comment
  saying these are the commands whose argument the brief passes to the §11 window
  check as a slug. `brief.mjs` imports it, and `briefArgs` is otherwise unchanged.
  Run `cd extension && npm run copy-cli`. — verify:
  `grep -rn "SLUG_COMMANDS = " scripts` prints exactly one line, in
  `scripts/session-state.mjs`.
  `node --test scripts/commands/brief.test.mjs scripts/session-state.test.mjs tests/extension-bundle.test.mjs`
  exits 0. Counts: brief 9/9, session-state 56/56, extension-bundle 4/4 — 69 pass, 0 fail.
- [x] 1.2 Add the two #147 regression tests from plan.md `## Approach` item 6 to
  `scripts/session-state.test.mjs`:
  - `test("every allowed[] entry passes windowVerdict for its role and every elsewhere[] entry passes in the window it names (#147 allowed-window-verdict-mismatch)")`
    collects every failure as `<role>/<lifecycle> <command> → <reason>` and
    `deepEqual`s the list to `[]`. It also asserts that plan × every lifecycle
    except `no-delivery` derives `{ allowed: [], elsewhere: [] }`.
  - `test("deriveNext in an idle primary window points at /agento start-session (#147 allowed-window-verdict-mismatch)")`.

  Change no production code. — verify:
  `node --test scripts/session-state.test.mjs > /tmp/awvm-1-2.txt 2>&1; echo "exit=$?"`
  prints `exit=1`. `grep '^not ok' /tmp/awvm-1-2.txt` shows only the two #147 tests.
  The table test's actual list has the 13 mismatches in plan.md `## Evidence`
  reproduction 2: 4 primary, 8 plan, 1 freehand. The test stops at that
  `deepEqual`, so its later plan-row assertion is not reached. The next test fails
  on its reason, which names `/agento new-feature`. Every pre-existing test is `ok`.
  Counts: session-state 58 tests, 56 pass, 2 fail (the two #147 tests). Table test
  actual list: 13 mismatches — 4 primary (new-feature/new-issue × no-delivery+shipped),
  8 plan (build-feature/ap × planned+building+paused, review-feature/ap × in-review),
  1 freehand (commit-current-changes); next test failed on the old reason
  "start with /agento new-feature …".

## Phase 2: Make allowed[] agree with the window check

- [x] 2.1 Implement plan.md `## Approach` items 2–5 in `scripts/session-state.mjs`:
  - drop `new-feature` / `new-issue` from `CREATE`;
  - add one shared `secondary` elsewhere pair for them, whose reason names
    `/agento start-session`, to `primary.no-delivery` and `primary.shipped`;
  - keep only `no-delivery` in `TABLE.plan`, with the `roleForManaged` comment;
  - drop `commit-current-changes` from `FREEHAND`;
  - reword the primary `none` reason in `deriveNext`;
  - extend the `WINDOW_ROLES` comment to name the #147 test as the check that keeps
    `TABLE` in agreement.

  Apply `## Approach` item 7 to the pinned tests in `scripts/session-state.test.mjs`
  (lines 619/626, 642–643, 717). Run `cd extension && npm run copy-cli`. — verify:
  `node --test scripts/session-state.test.mjs scripts/commands/next.test.mjs scripts/commands/session.test.mjs scripts/commands/brief.test.mjs scripts/commands/ship.test.mjs tests/extension-bundle.test.mjs`
  exits 0, with both #147 tests `ok` and every other test `ok`. Counts: 158 tests,
  158 pass, 0 fail (6 files); both #147 tests ok. Also updated the primary
  `elsewhere` pin in `scripts/commands/session.test.mjs` line 190 (plan.md item 7
  omitted it; the primary row now lists new-feature/new-issue as secondary).
- [x] 2.2 Re-run plan.md `## Evidence` reproductions 1 and 2 against this branch.
  - **Reproduction 1:** from the primary checkout `~/DP/agento`, run this worktree's
    `scripts/agento.mjs session`, `brief new-feature "demo description"`,
    `brief new-issue "demo description"`, and `next`. Use the same projection as
    `evidence/repro-primary-window.txt` (role, lifecycle, allowed), plus
    `elsewhere`. Save the output, with `/home/david` replaced by `~`, as
    `evidence/after-primary-window.txt`.
  - **Reproduction 2:** copy `evidence/probe-allowed-vs-verdict.mjs` into the
    product worktree root, set its import path to `./scripts/session-state.mjs`, and
    run it. Save the output as `evidence/after-allowed-vs-verdict.txt`, then delete
    the copy.

  — verify:
  - `after-primary-window.txt`: `allowed` has neither `/agento new-feature` nor
    `/agento new-issue`; `elsewhere` lists both with `"window": "secondary"` and a
    reason containing `/agento start-session`.
  - Both briefs are still `Receipt: rejected … exit=3`, and their alternatives show
    `new-feature` / `new-issue` only as `(secondary window)`.
  - The `next` reason contains `/agento start-session`.
  - `after-allowed-vs-verdict.txt` ends with `0 mismatches`.
  - `git status --porcelain --untracked-files=all` in the product worktree prints
    nothing.

  Results: session `allowed` = continue, start-session, start-freehand, new-initiative,
  delivery-status, next-feature (no new-feature/new-issue); `elsewhere` = new-feature +
  new-issue, window secondary, reason "planning runs in a plan worktree; /agento
  start-session opens one". Both briefs `Receipt: rejected … exit=3` with the pair
  shown only as `(secondary window)`. `next` resolved to the in-progress delivery's
  start-session transition (invocation `/agento start-session issue/… --resume`); the
  idle none-reason naming `/agento start-session` is demonstrated in the evidence file
  and asserted by the #147 next test. Probe: `checked 77 allowed entries; 0
  mismatches`. Product worktree clean.

## Phase 3: Docs, gate, resolution

- [x] 3.1 Implement plan.md `## Approach` item 8 docs:
  - `docs/extension.md` line 355: the freehand header actions are only
    `finish-freehand`;
  - `docs/architecture.md`, by the record description (lines 292–296): one sentence
    saying every `allowed[]` entry passes the §11 window check for the record's role
    and every `elsewhere[]` entry passes in the window it names, enforced by the
    #147 test in `scripts/session-state.test.mjs`;
  - `CHANGELOG.md` `## Unreleased`: a `**Fixed.**` entry citing #147.

  — verify:
  - `grep -n "commit-current-changes" docs/extension.md` no longer shows it as a
    freehand header action;
  - `grep -n "#147\|session-state.test" docs/architecture.md` shows the invariant
    sentence;
  - `grep -n '#147' CHANGELOG.md` shows the entry;
  - `node --test tests/customizations.test.mjs` exits 0.

  Line numbers: `docs/extension.md` — `commit-current-changes` no longer matches;
  `docs/architecture.md` 298–299 (invariant sentence); `CHANGELOG.md` 5–10 entry with
  #147 at lines 9–10; customizations test 67/67 pass, 0 fail.
- [ ] 3.2 Run the full gate (§5) and compare it with the plan.md `## Research`
  baseline (943/943, shellcheck clean). — verify:
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'`
    exits 0 with fail 0, and the test count is 943 plus the new tests;
  - `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` exits 0 with no
    findings (use `~/.local/bin/shellcheck` or `pnpm dlx shellcheck` if it is not on
    PATH);
  - `cd extension && npm ci && npm run build && npm run test:unit` exits 0;
  - `git diff --name-only origin/main...HEAD -- scripts/hooks .github/hooks` prints
    nothing.

  Record the results on this line.
- [ ] 3.3 Write plan.md `## Resolution`:
  - the root cause: two hand-kept tables, `TABLE`/`CREATE`/`FREEHAND` vs
    `WINDOW_ROLES`, with no check tying them together;
  - what changed and why, per Decisions 1–5 and the planner refinement;
  - proof: the step 1.2 failure record, the #147 tests `ok` after step 2.1, and both
    `evidence/after-*.txt` files.

  — verify: `## Resolution` names `scripts/session-state.mjs`, both #147 test names,
  and both `evidence/after-*.txt` files, and every relative link in plan.md resolves.
