# Review: gate-dashboard-plan-actions

Verdict: approve

Reviewed 2026-10-03 at product `1b13acb` (code PR #85, draft, CI `test` pass) and
companion `82c837a` (agento-docs PR #25, draft). `origin/main` is an ancestor of HEAD
in both halves; the companion half is clean, `ahead: 0`, `behind: 0`.

Skills consulted: none — no matching domain (no `.agents/skills/`, no `## Agento`
skills table in AGENTS.md).

All verification below was re-run independently by the Reviewer in this worktree:

| Check | Command | Result |
| --- | --- | --- |
| Install | `cd extension && npm ci` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Unit | `npm run test:unit` | exit 0, 114/114, (a)–(d) pass |
| Exposing tests pre-fix | `git archive 2d712fc` into `/tmp/rv-pre`, `npm run test:unit` | exit 1, 114 tests, 110 pass, exactly (a)–(d) fail |
| Electron | `npm run test:electron` | exit 0; in-repo, companion, workspace scenarios print `passed` (workspace: "workspace file, scoped settings, window gate") |
| Package | `npm run package` | exit 0, `assert-vsix` passed (14 required entries) |
| VSIX manifest | `unzip -p agento-dashboard-*.vsix extension/package.json \| grep -c 'agento.canPlan\|agento.primary'` | 6 |
| VSIX module | `unzip -l agento-dashboard-*.vsix \| grep windowGate` | `extension/out/windowGate.js` |
| Shell lint | `git ls-files '*.sh' \| xargs pnpm dlx shellcheck` | exit 0, 0 findings |
| Node tests | `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | exit 0, 274/274 |
| Guard smoke | `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` | exit 0 |
| Guard smoke (companion) | `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` | exit 0 |
| #77 path untouched | `git diff --stat origin/main -- extension/src/newPlanFlow.ts extension/src/newInitiativeFlow.ts extension/test/unit/planPlayButtonHandoff.test.ts extension/test/unit/newPlanFlow.test.ts` | empty |

Note: a first Electron attempt exited 1 with "Running extension tests from the
command line is currently only supported if no other instance of Code is running"
because it overlapped an earlier Reviewer-launched run whose terminal had returned no
output (the flaky shared terminal). With no other test instance running, the re-run
exited 0 across all three scenarios. This is a Reviewer environment artifact, not a
product defect.

No browser verification was driven: menu visibility is decided by manifest `when`
clauses the Electron host cannot observe, and plan.md decision 5 fixes the proof as
manifest + unit + Electron assertions; no roadmap step names a browser or preview
target.

## Acceptance checklist results

1. **Exposing test file fails before, passes after** — pass. At `2d712fc` (stub
   `windowGate.ts`) `npm run test:unit` exits 1 with exactly tests 48–51 (a)–(d)
   failing, 110 others passing; at HEAD 114/114 pass. The 1.1 commit message records
   the four failure messages. Header comment names #84, the slug, and the evidence
   directory ([gateDashboardPlanActions.test.ts](https://github.com/david-perry-software/agento/blob/issue/gate-dashboard-plan-actions/extension/test/unit/gateDashboardPlanActions.test.ts)).
2. **`windowGate` per role, fail-closed** — pass. Test (b) covers primary → open,
   plan+detached → `canPlan` only, and 13 closed cases (attached plan, build, promoted
   plan worktree, freehand, unmanaged, hosted build, failed, undefined, null, no role,
   missing/malformed worktree, string `detached`). Implementation in
   `extension/src/windowGate.ts` checks `status === "ok"`, a string `role`, and
   `worktree.detached === true` strictly.
3. **Menu entries and Command Palette gated** — pass. `extension/package.json`
   appends `&& agento.canPlan` to both New Plan title entries and the ready-member
   Plan entry, `&& agento.primary` to New Initiative, and adds `menus.commandPalette`
   (`agento.canPlan`, `agento.primary`, `false`). Test (a) and the updated
   `extensionIntegration.test.ts` `deepEqual` pass. No `viewsWelcome`, keybinding, or
   tree-item `command:` link reaches these commands by another route (grep of
   `extension/package.json` and `extension/src/`).
4. **Handlers reject before any prompt, editor, or dispatch** — pass. Each of the
   three `registerCommand` bodies in `extension/src/extension.ts` starts with
   `gateRejection(...)` → output line → `showErrorMessage` → return; for Plan it runs
   before the ready-member guard. Test (c) asserts the three exact messages; test (d)
   asserts ordering; Electron `assertGatedCommandsRejected` runs all three under a
   stubbed `build` session and New Initiative under plan+detached with every prompt
   and runner set to `assert.fail`, and checks the collected error messages. The only
   other callers of the runners (`startNewPlan` / `startNewInitiative` on the
   `ExtensionApi`) are test seams, not UI entry points.
5. **Context keys closed at activation and on failed read, matching latest session**
   — pass. `applyGate(CLOSED_GATE)` precedes `scheduler.refreshNow("activate")`
   (test (d)); the gate rides the `LatestDeliveryRefresh` snapshot and is closed on the
   error callback and the no-folder path. Electron asserts primary open, build closed,
   a stale primary refresh does not reopen it, plan+detached `canPlan` only, a
   `status: "failed"` record closed, the live primary refresh reopens it, and the
   workspace scenario equals `windowGate(<live session>)` (`{ primary: false,
   canPlan: true }` for its detached plan worktree).
6. **#77 in-window path unchanged** — pass. The `git diff --stat` above is empty;
   `planPlayButtonHandoff.test.ts` (a)–(c) and the `newPlanFlow` tests pass unmodified.
7. **Packaged VSIX carries the gated clauses** — pass. `npm run package` exit 0, grep
   count 6 (≥ 5), `extension/out/windowGate.js` present.
8. **Docs and CHANGELOG** — pass. `docs/extension.md` states placement in the
   Deliveries, Initiatives, and Session & Doctor sections and adds a context-key table
   plus the rejection message and promoted-plan-worktree consequence under Command
   routing (grep count 2 for the plan's pattern). `CHANGELOG.md` `## Unreleased` opens
   with a **Fixed** entry ending `(#84)` describing only the new gating.
9. **Full gate green, no new findings vs baseline** — pass. Shellcheck exit 0 with 0
   findings, node 274/274, both guard smokes exit 0, extension typecheck + unit +
   Electron exit 0 — identical to the green plan.md baseline (shellcheck 0, node
   274/274, unit 110/110 → now 114/114 with the four new tests).

## Plan vs implementation

- Implementation follows `## Approach` exactly: new pure `windowGate.ts`, manifest
  gating, `applyGate` wiring through the refresh snapshot, handler guards, and
  `ExtensionApi.windowGate()`. Flows, `dispatchAction`, the pending TTL, and
  `openTarget` are untouched, as scoped.
- Beyond plan (beneficial, in scope): the no-workspace-folder refresh path also
  closes the gate; Electron additionally asserts a stale overlapping primary refresh
  does not reopen the gate and that the live primary refresh reopens it at the end;
  test (b) adds `null`, no-role, and string-`detached` cases.
- Minor artifact inaccuracy: plan.md `## Resolution` says the VSIX carries
  `out/src/windowGate.js`; the packaged path is `extension/out/windowGate.js`
  (`main` is `./out/extension.js`). Roadmap 3.1's own check (`grep -c windowGate.js`)
  is correct. Wording only; no behavioral impact.

## Roadmap audit

All nine ticked steps were spot-checked against the code and re-run output:

- 1.1 — stub and exposing tests exist; pre-fix failure reproduced at `2d712fc`.
- 2.1–2.3 — `windowGate.ts`, manifest, and `extension.ts` wiring present as described.
- 2.4 — Electron assertions present and passing in all three scenarios.
- 3.1 — packaging re-run green with the stated counts.
- 4.1 — docs and CHANGELOG entries present.
- 4.2 — full gate reproduced; the recorded result line matches.
- 4.3 — `## Resolution` written; both halves integrate their `origin/main`, are
  pushed, and the companion half is clean with `ahead: 0`; both PRs open (draft).

No `(manual)` or `(manual, post-ship)` steps. No falsely ticked boxes; no repairs made.

## Findings

No findings above minor severity.

1. **Minor — handler gate is the cached last-refresh value.** `extension/src/extension.ts`
   handlers read `gate` from the latest applied refresh rather than re-reading the
   session on click, so a window promoted plan → build keeps `canPlan` until the next
   refresh. Documented in plan.md `## Risks`; the HEAD watcher refreshes on promotion
   and the Planner's §11 window check backstops any stale click. Accept as designed.
2. **Nit — source-regex wiring test.** Test (d) asserts `extension.ts` structure by
   regex/`indexOf`, which is brittle to harmless refactors (e.g. renaming
   `applyGate`). It follows the existing `extensionIntegration.test.ts` precedent and
   is backed by behavioral Electron assertions, so acceptable.
3. **Nit — Resolution VSIX path wording** (see Plan vs implementation).

Security: no new inputs, secrets, shell, or network paths; context keys are booleans
derived from local CLI JSON with strict type checks.

## Follow-ups

(none)
