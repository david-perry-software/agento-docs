# Session allowed[] lists commands the §11 window check rejects

## Problem

The session record's `allowed[]` comes from `deriveAllowed` in
`scripts/session-state.mjs`. The same list feeds the SessionStart hook's `Session:`
line, every `Receipt: rejected` alternative list, the extension's action picker, and
the Mission Control header. In several windows it names commands that the §11 window
check (`WINDOW_ROLES` + `windowVerdict`, same file) refuses in that very window.

The reported case: in a primary window with no delivery, the `Session:` line lists
`/agento new-feature` and `/agento new-issue` as allowed. Both come from `CREATE`,
but `WINDOW_ROLES` gives them `PLAN_OR_PROMOTED`, so `brief new-feature` rejects with
`wrong window: role=primary`. The model is told to run a command that is then
refused. The rejection's own `allowed:` alternatives even repeat the command it just
rejected, and `agento.mjs next` in that window gives the same wrong advice.

Checking every row shows the two tables drift elsewhere too. 13 of 111 `allowed[]`
entries fail their own window check. Nothing keeps the hand-written `TABLE`, `CREATE`,
and `FREEHAND` rows in agreement with `WINDOW_ROLES`.

## Evidence

GitHub issue: #147

Reproduced on 2026-11-06 at `origin/main` `58c49fd`, node v22.23.2.

**Reproduction 1: the real primary window** ([evidence/repro-primary-window.txt](evidence/repro-primary-window.txt))

Run from the primary checkout `~/DP/agento` (on `main`, clean):

1. `node <agento>/scripts/agento.mjs session` gives `role: primary` and
   `lifecycle: no-delivery`, with `allowed` = `continue`, `start-session`,
   `start-freehand`, **`new-feature`**, **`new-issue`**, `new-initiative`,
   `delivery-status`, `next-feature`.
2. `node <agento>/scripts/agento.mjs brief new-feature "demo description"` (the
   same happens for `new-issue`) prints
   `Receipt: rejected — wrong window: role=primary (~/DP/agento, branch main);
   allowed: /agento continue, /agento start-session, /agento start-freehand,
   /agento new-feature, /agento new-issue, …` and exits 3.
3. `node <agento>/scripts/agento.mjs next` gives `none: nothing is in flight and no
   initiative member is ready; start with /agento new-feature <description>,
   /agento new-issue, or /agento new-initiative`.

Observed: the record and `next` both recommend `new-feature` / `new-issue` in a
window where the brief rejects them.
Expected: every command `allowed[]` names passes the window check in that window,
and `next` names a command that works there.

**Reproduction 2: every row against the window check** ([evidence/repro-allowed-vs-verdict.txt](evidence/repro-allowed-vs-verdict.txt), script [evidence/probe-allowed-vs-verdict.mjs](evidence/probe-allowed-vs-verdict.mjs))

The script runs each `deriveAllowed` entry (role × lifecycle) through `windowVerdict`.
Each role gets a realistic record: primary on `main` and clean; plan detached; build
on `issue/demo`; freehand on `changes/demo` with no delivery. A slug is passed only
for the commands the brief passes a slug to (`SLUG_COMMANDS` in
`scripts/commands/brief.mjs`). Result: `checked 111 allowed entries; 13 mismatches`.

| Role / lifecycle | Listed command | Window rule it fails |
| --- | --- | --- |
| primary / no-delivery, shipped (`CREATE`) | `new-feature`, `new-issue` (4) | `PLAN_OR_PROMOTED`: roles plan, build |
| plan / planned, building, paused | `build-issue demo`, `ap demo` (6) | `BUILD_SLUG`: role build |
| plan / in-review | `review-issue demo`, `ap demo` (2) | `BUILD_SLUG`: role build |
| freehand | `commit-current-changes` (1) | role primary on a non-default branch |

**Control:** a second probe ran all 29 `elsewhere[]` entries against the window each
one names (primary → role primary; secondary → plan or build). All 29 pass, so today
the drift is only in `allowed[]`.

## Decisions

Asked on 2026-11-06 with the ask-questions tool. Answers are recorded verbatim, and
the recommended option is marked on each.

1. **How should the primary new-feature/new-issue conflict be fixed?** Options:
   (recommended) drop them from `CREATE`, since the primary window already offers
   `/agento start-session` to open a plan worktree; or relax `WINDOW_ROLES` so
   new-feature/new-issue accept role primary.
   Answer: `drop`, the recommended option.
2. **Scope of the fix?** Options: (recommended) fix every mismatch the new test
   exposes (primary, plan rows, freehand), because otherwise the requested test
   fails; or fix only the primary conflict and let the test allowlist the rest as
   known Follow-ups.
   Answer: `all`, the recommended option.
3. **What should happen to the plan-role rows that require a delivery (they look
   unreachable)?** Options: (recommended) remove them, so the plan role keeps only
   `no-delivery` and the test asserts that rule; or keep them and have the test check
   only role/lifecycle pairs that can actually occur.
   Answer: `remove`, the recommended option.
4. **Should the test also check `elsewhere` entries against the window they name
   (primary or secondary)?** Recommended: yes.
   Answer: `true`.
5. **Should the `deriveNext` wording for the primary window be fixed too?** It would
   point at `/agento start-session` instead of telling the user to run
   new-feature/new-issue directly. Recommended: yes.
   Answer: `true`.

**Planner refinement within Decision 1:** "drop" removes the two commands from the
primary rows' `allowed[]`. It also adds them to those rows' `elsewhere[]` as
`secondary` entries whose reason names `/agento start-session`. The extension, the
canvas, and rejected receipts then still show where planning runs instead of
silently dropping it (see `## Approach` item 2 and `## Risks`).

## Research

- **Two hand-kept tables.** `scripts/session-state.mjs` defines `CREATE` (line 364)
  and the `TABLE` of role × lifecycle rows (lines 387–417): primary rows `no-delivery`
  and `shipped` use `CREATE`, and `plan` has eight rows (lines 408–416). It also
  defines `FREEHAND` (line 419), and a loop that puts `/agento continue` first and
  `/agento next-feature` last in every row (lines 422–427). `deriveAllowed`
  (line 430) fills the placeholders. The §11 rules are a separate table:
  `WINDOW_ROLES` (lines 448–480; `PLAN_OR_PROMOTED` at line 451, `BUILD_SLUG` at
  line 450), applied by `windowVerdict` (line 484). Its comment says only the
  customizations test keeps prompts and agents in agreement with it. No test ties
  `TABLE` to `WINDOW_ROLES`. That missing check is the root cause.
- **The plan rows with a delivery are unreachable.** `roleForManaged` (line 128)
  returns `build` for any managed worktree on a `feature/` or `issue/` branch.
  `deriveDelivery` (line 295) yields a delivery only from such a branch, or from a
  `feature-`/`issue-` dirPrefix with no branch. A `plan-*` worktree therefore has a
  delivery only when it is already role `build`. Hosted records (line 199) are
  `build` or `primary`, and companion halves use the same `roleForManaged`
  (line 184). `deriveNext` (line 621) has a `plan`-with-delivery branch that is
  equally dead code; it is left alone (see `## Out of scope`).
- **Freehand.** `commit-current-changes` requires role primary on a non-default
  branch (`WINDOW_ROLES`, and `.github/prompts/commit-current-changes.prompt.md`
  line 27). Its step 1 says a `freehand` role "is rejected per §11 with the record's
  alternatives — they already name … `/agento finish-freehand`". The freehand row
  should therefore not list it. `finish-freehand <slug>` is *not* a mismatch: it is
  not in `SLUG_COMMANDS`, so the brief never passes it a slug.
- **Slug handling lives in the brief.** `scripts/commands/brief.mjs` keeps
  `SLUG_COMMANDS` (line 77) and `briefArgs` (line 82) private. Importing that module
  from a unit test pulls in `lib/context.mjs` (cwd/root side effects). A faithful
  table test needs the set from a side-effect-free module.
- **Consumers of `allowed[]` / `elsewhere[]`:**
  - `scripts/lib/preflight.mjs` `receiptLines` (line 32) copies both lists into the
    rejected receipt, as `<cmd> (<window> window)` for `elsewhere`.
  - The extension's `projectCommandActions` (`extension/src/commandActions.ts`,
    line 26) accepts `elsewhere.window` of `primary` or `secondary`.
    `routeCommandAction` (`extension/src/dispatchRouting.ts`, line 37) rejects a
    cross-window action that has no slug, using the entry's `reason`. The New Plan
    flow (`extension/src/newPlanFlow.ts`) runs `start-session --no-open` from the
    primary window and does not read `allowed[]`.
  - The Mission Control header (`canvas/agento-mission-control/public/actions.js`
    `headerActions`, line 132) lists `HEADER_CATALOG` (includes `new-feature` and
    `new-issue`). It enables a command when `session.allowed` has it, and otherwise
    shows it disabled with the `elsewhere` reason or "not available in the <role>
    window".
- **Tests that pin today's rows** (`scripts/session-state.test.mjs`):
  - Line 619 asserts every role × lifecycle row has commands, and line 626 that
    `continue` comes first. Both fail for emptied plan rows.
  - Lines 642–643 assert the primary row includes `new-feature` and `new-issue`.
  - Line 717 pins the freehand row with `commit-current-changes`.
  - Line 712 (plan `no-delivery`) and `scripts/commands/session.test.mjs:291` stay
    true. `scripts/commands/next.test.mjs:298` asserts the reason matches
    `/nothing is in flight/`, which still holds.
  - `canvas/agento-mission-control/actions.test.mjs` lines 64 and 81 are static
    rendering inputs, not derived from `deriveAllowed`.
- **Bundled CLI copy.** `extension/cli/` is a tracked byte copy of `scripts/`, made
  by `cd extension && npm run copy-cli`. `tests/extension-bundle.test.mjs` (line 78)
  fails on any drift, so `extension/cli/session-state.mjs` and
  `extension/cli/commands/brief.mjs` must be re-copied.
- **Docs:**
  - `docs/extension.md` line 355 lists "a freehand window's `finish-freehand` /
    `commit-current-changes`" as header actions.
  - `docs/architecture.md` lines 292–296 describe the record's `allowed[]` /
    `elsewhere[]` but do not state the invariant.
  - `CHANGELOG.md` has an `## Unreleased` section with `**Fixed.**` entries.
- **Open PRs** (`gh pr list --state open`): none, so there is no concurrent-delivery
  overlap.
- No hook file (`scripts/hooks/`, `.github/hooks/`) is involved.

**Lint baseline (policy §5),** run on 2026-11-06 at `58c49fd`:

- **Shell lint:** `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` gave
  exit 0, no findings. shellcheck was not on PATH; the official v0.10.0 release
  binary was put in `~/.local/bin`.
- **Test suite:**
  `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'`
  gave exit 0: tests 943, pass 943, fail 0.
- The repository has no JS linter configured. Overlap decision: the baseline is green,
  so the **full gate** applies. The full suite and the full shellcheck run must stay
  green, plus the extension build and unit tests, because `extension/cli/` changes.
  This delivery changes no shell file.

Skills consulted: none — no matching domain. The repository has no `.agents/skills/`
and no AGENTS.md skills table, and the change is plain Node.js in the CLI core.

## Approach

Code changes are in `scripts/session-state.mjs`, `scripts/commands/brief.mjs`, their
`extension/cli/` copies, and the tests listed below.

1. **One slug rule, shared (no behavior change).** Move `SLUG_COMMANDS` from
   `scripts/commands/brief.mjs` to `scripts/session-state.mjs` as an exported frozen
   `Set`. Its comment says these are the commands whose argument the brief passes to
   the §11 window check as a slug. `brief.mjs` imports it. `briefArgs` is otherwise
   unchanged.
2. **Primary rows.** Drop `/agento new-feature` and `/agento new-issue` from `CREATE`.
   `primary.no-delivery` and `primary.shipped` both gain `elsewhere` entries
   `secondary("/agento new-feature", …)` and `secondary("/agento new-issue", …)`. The
   reason reads: planning runs in a plan worktree; `/agento start-session` opens one.
   Define the two entries once (e.g. a `PLAN_ELSEWHERE` constant), the way
   `SHIP_LATER` is defined.
3. **Plan rows.** `TABLE.plan` keeps only `no-delivery` (`new-feature`, `new-issue`,
   `delivery-status`, plus the `continue` / `next-feature` the loop adds). Add a
   comment: a plan worktree on a delivery branch is role `build`
   (`roleForManaged`), so the plan role never has a delivery. `deriveAllowed` then
   returns `{ allowed: [], elsewhere: [] }` for plan with any other lifecycle.
4. **Freehand row.** `FREEHAND.allowed` becomes `finish-freehand <slug>`,
   `delivery-status`, `next-feature`.
5. **`deriveNext` wording.** The primary "nothing is in flight" reason becomes:
   `nothing is in flight and no initiative member is ready; open a plan worktree with
   /agento start-session (then /agento new-feature <description> or /agento new-issue
   there), or start an initiative with /agento new-initiative`. It keeps the
   `nothing is in flight` prefix that `next.test.mjs:298` matches.
6. **Regression tests** (`scripts/session-state.test.mjs`, both named after #147 and
   the slug):
   - **Table test.** For every role in `ROLES` and every lifecycle in `LIFECYCLES`,
     build a representative record for that role:
     - primary on `main`, clean;
     - plan detached;
     - build on `feature/widget` with delivery `widget`;
     - freehand on `changes/tidy` with no delivery;
     - unmanaged on a stray branch.
     Pass `delivery` when the lifecycle is not `no-delivery`. Run every `allowed[]`
     command through `windowVerdict`. Pass a slug only for `SLUG_COMMANDS`, parsed
     the way `briefArgs` does (a bare slug, or `<type>/<slug>`).
     Then run every `elsewhere[]` command against the representative records of the
     window it names (`primary` → primary; `secondary` → plan or build; it must pass
     in at least one). Collect every failure as
     `<role>/<lifecycle> <command> → <reason>` and `deepEqual` the list to `[]`, so a
     failure prints all mismatches at once.
     Also assert the decision-3 rule: plan × every lifecycle except `no-delivery`
     derives `{ allowed: [], elsewhere: [] }`.
   - **Next test.** `deriveNext({ role: "primary", lifecycle: "no-delivery",
     candidates: [] … })` returns `status: "none"`. Its reason names
     `/agento start-session` and does not offer `new-feature` / `new-issue` as
     something to run in the current window.
7. **Pinned tests follow the decision** (`scripts/session-state.test.mjs`):
   - The every-row test (line 619) asserts commands exist for every row except
     plan-with-delivery, which must be empty.
   - The `continue`-first check (line 626) skips empty rows.
   - The primary-rows test (lines 642–643) asserts `new-feature` / `new-issue` are
     absent from `allowed`, and present in `elsewhere` with `window: "secondary"` and
     a reason matching `/start-session/`.
   - The freehand pin (line 717) drops `commit-current-changes`.
8. **Copy and document.**
   - Run `cd extension && npm run copy-cli`.
   - `docs/extension.md` line 355 drops `/ commit-current-changes` from the freehand
     parenthetical.
   - `docs/architecture.md`, next to the record description (lines 292–296), gets one
     sentence stating the invariant and naming the test that enforces it.
   - `CHANGELOG.md` `## Unreleased` gets a `**Fixed.**` entry citing #147.

No user-visible UI is driven in a browser. Every check is a CLI command or a
`node --test` run, so no `local:<ports>` target is needed.

## Risks

- **Visible change in the primary window.** In the primary window, the extension
  action picker, the Mission Control header, and rejected receipts now show
  `new-feature` / `new-issue` as running in a secondary window, with the reason, not
  as runnable here. That is the intended correction. Mitigations: the reason names
  `/agento start-session`. The extension's New Plan action already goes through
  `start-session --no-open` and does not read `allowed[]`. `routeCommandAction`
  rejects a slugless cross-window action with that reason instead of submitting it.
- **Representative records, not every runtime state.** The table test checks each
  row against the canonical state for its role (primary on the default branch and
  clean). The §11 branch and cleanliness preconditions remain runtime checks; for
  example, a dirty primary still lists `start-session`. Encoding them into
  `allowed[]` is out of scope.
- **Removed plan rows becoming reachable later.** If a future change gives the plan
  role a delivery, `allowed[]` would be empty, so receipts would say
  `allowed: none`. Mitigation: the #147 test asserts the plan-with-delivery rows are
  empty on purpose, and its comment names `roleForManaged` as the reason. A change
  to that rule then has to revisit the table.
- **Moving `SLUG_COMMANDS`.** It could change brief behavior. Mitigation:
  `scripts/commands/brief.test.mjs` (26 commands accepted in their windows) runs in
  step 1.1 before any other change.
- **`extension/cli/` drift.** Mitigation: `tests/extension-bundle.test.mjs` fails on
  any byte difference, and the gate includes the extension build and unit tests.
- **Concurrent deliveries:** none open. Integrate `origin/main` by merge before every
  push anyway (§7).

## Out of scope

- Encoding §11 branch and cleanliness preconditions (default branch, clean
  checkout) into `allowed[]`.
- The dead `plan`-with-delivery branch in `deriveNext` (line 621).
- The hand-written rendering inputs in `canvas/agento-mission-control/actions.test.mjs`
  (lines 64, 81). They exercise canvas logic on arbitrary records and are not derived
  from `deriveAllowed`.
- Hosted-workspace role derivation, and any change to `WINDOW_ROLES` itself.

## Acceptance checklist

- [ ] The exposing regression test in `scripts/session-state.test.mjs` (#147
  allowed-window-verdict-mismatch table test) fails before the fix, listing the 13
  mismatches (roadmap step 1.2 record), and passes after it. Verify:
  `node --test scripts/session-state.test.mjs` exits 0 with the #147 tests `ok`.
- [ ] In the real primary window (`~/DP/agento` on `main`), the branch's `session`
  `allowed[]` no longer contains `/agento new-feature` or `/agento new-issue`.
  `elsewhere[]` lists both with `window: secondary` and a reason naming
  `/agento start-session`. Verify: `evidence/after-primary-window.txt`.
- [ ] In that window, the branch's `brief new-feature` is still rejected, and its
  alternatives list `new-feature` only as `(secondary window)`. Verify:
  `evidence/after-primary-window.txt`.
- [ ] The branch's `next` in that window gives a `none` reason naming
  `/agento start-session`. Verify: `evidence/after-primary-window.txt` and the #147
  next test.
- [ ] The plan role derives commands only for `no-delivery`. The freehand row no
  longer lists `commit-current-changes`. Verify: the #147 table test, and
  `evidence/after-allowed-vs-verdict.txt` printing `0 mismatches`.
- [ ] `SLUG_COMMANDS` is defined once, in `scripts/session-state.mjs`, and
  `scripts/commands/brief.mjs` imports it. Verify:
  `grep -rn "SLUG_COMMANDS = " scripts` prints one line, and
  `node --test scripts/commands/brief.test.mjs` exits 0.
- [ ] `extension/cli/` matches `scripts/`. Verify:
  `node --test tests/extension-bundle.test.mjs` exits 0.
- [ ] Docs and changelog are updated. Verify:
  - `grep -n "commit-current-changes" docs/extension.md` no longer shows it as a
    freehand header action;
  - `docs/architecture.md` states the allowed/elsewhere invariant and names the
    test;
  - `grep -n '#147' CHANGELOG.md` shows the `**Fixed.**` entry.
- [ ] Full gate (§5) is green. Verify:
  - the full `node --test` suite exits 0 with 943 + the new tests and fail 0;
  - `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` exits 0;
  - `cd extension && npm ci && npm run build && npm run test:unit` exits 0;
  - `git diff --name-only origin/main...HEAD -- scripts/hooks .github/hooks` prints
    nothing.
- [ ] Clean handoff: `git status --porcelain --untracked-files=all` prints nothing in
  both halves.

## Resolution

**Root cause.** Two hand-kept tables in `scripts/session-state.mjs` describe what a
window may run: `CREATE`/`TABLE`/`FREEHAND` (fed to `deriveAllowed`, which fills the
session record's `allowed[]`/`elsewhere[]`) and `WINDOW_ROLES` (the §11 window check
rules applied by `windowVerdict`). Nothing tied the two together, so 13 of 111
`allowed[]` entries named commands `windowVerdict` refused in that very window — most
visibly the primary window recommending `/agento new-feature`/`/agento new-issue`
that `brief` then rejected.

**What changed, and why.**

- `SLUG_COMMANDS` moved from `scripts/commands/brief.mjs` into
  `scripts/session-state.mjs` as an exported frozen `Set` (one slug rule, shared; no
  behavior change), so the table test can parse a slug the way `briefArgs` does
  without importing the CLI module. `brief.mjs` imports it.
- Primary rows: `new-feature`/`new-issue` dropped from `CREATE` (Decision 1 "drop");
  both `primary.no-delivery` and `primary.shipped` gain one shared `PLAN_ELSEWHERE`
  secondary-window pair whose reason names `/agento start-session` (the planner
  refinement: the extension, canvas, and rejected receipts still show where planning
  runs instead of silently dropping it).
- Plan rows: `TABLE.plan` keeps only `no-delivery`, with the `roleForManaged`
  comment (Decision 3 "remove") — a plan worktree on a delivery branch is role
  `build`, so the plan role never has a delivery and derives
  `{ allowed: [], elsewhere: [] }` for every other lifecycle.
- Freehand row: `commit-current-changes` dropped — its §11 rule requires role primary
  on a non-default branch.
- `deriveNext` primary `none` reason reworded to point at `/agento start-session`
  (Decision 5), keeping the `nothing is in flight` prefix.
- `WINDOW_ROLES` comment extended to name the #147 test as the check that keeps
  `TABLE` (and `CREATE`/`FREEHAND`) in agreement with the window rules.
- Tests and docs followed the decisions: the two #147 regression tests were added to
  `scripts/session-state.test.mjs`, the pinned rows in
  `scripts/session-state.test.mjs`, `scripts/commands/session.test.mjs`, and
  `tests/session-context.test.mjs` were updated to the new rows, and
  `docs/extension.md`, `docs/architecture.md`, and `CHANGELOG.md` record the change.

**Proof.**

- Step 1.2 observed the exposing tests fail:
  `every allowed[] entry passes windowVerdict for its role and every elsewhere[] entry passes in the window it names (#147 allowed-window-verdict-mismatch)`
  listed all 13 mismatches (4 primary, 8 plan, 1 freehand), and
  `deriveNext in an idle primary window points at /agento start-session (#147 allowed-window-verdict-mismatch)`
  failed on the old reason naming `/agento new-feature`.
- After step 2.1 both #147 tests are `ok`, and the full suite is 945/945 (the 943
  baseline plus the two new tests).
- [evidence/after-primary-window.txt](evidence/after-primary-window.txt) shows the
  real primary window with neither command in `allowed`, both in `elsewhere` as
  secondary entries whose reason names `/agento start-session`, and `brief
  new-feature`/`brief new-issue` still rejected with the pair listed only as
  `(secondary window)`.
- [evidence/after-allowed-vs-verdict.txt](evidence/after-allowed-vs-verdict.txt)
  ends with `checked 77 allowed entries; 0 mismatches`.
