# Review: status-colors

Verdict: approve

Reviewed 2026-10-08 against product `bacc2a1` (code PR #98, draft, CI `test` pass) and
companion `713c93d` (artifact PR #34, draft), both on `feature/status-colors`.
`origin/main` is an ancestor of both halves (`git merge-base --is-ancestor` exit 0 in
each); both halves were clean before review and stayed clean after the gate reruns.
Window check: `agento.mjs session` → `role: build`, `delivery.slug: status-colors`,
`companion.dirty: false`, `ahead: 0`; `agento.mjs doctor --for review-feature` → `ok`
(gh authenticated, origin reachable, artifact repo present). `gh pr list --state open`
shows only #98, so no concurrent file overlap.

Skills consulted: none — no matching domain (no `.agents/skills/` in the product
repository; AGENTS.md has no `## Agento` skills table).

Gate rerun by the Reviewer (all from the product worktree at `bacc2a1`):

| Check | Result | Baseline (plan / step 1.1) |
| --- | --- | --- |
| `git ls-files '*.sh' \| xargs pnpm dlx shellcheck` | exit 0, no findings | exit 0, no findings |
| `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | exit 0, 340/340 | 340/340 |
| `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` | exit 0 | — |
| `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` | exit 0 | — |
| `cd extension && npm run typecheck` | exit 0 | exit 0 |
| `cd extension && npm run build` | exit 0 | exit 0 |
| `cd extension && npm run test:unit` | exit 0, 139/139 | 128/128 |
| `cd extension && npm run test:electron` | exit 0; in-repo, companion, workspace scenarios passed | 3/3 |
| `node --test tests/extension-bundle.test.mjs` | exit 0, 4/4 | — |
| `grep -n "statusBar.text =" extension/src/extension.ts` | lines 83 (`applyStatusBar`) and 104 (initial creation) only | — |
| `grep -n "agento.status.paused" docs/extension.md` / `grep -n -i "status colors" CHANGELOG.md` | `docs/extension.md:83`, `:109`; `CHANGELOG.md:5` | — |
| `git status --porcelain --untracked-files=all` (both halves), `ls extension/*.vsix` | empty; no `.vsix` left | — |

The +11 unit tests are all this delivery's: 8 in `statusStyle.test.ts`, 2 new in
`initiativeTreeProvider.test.ts`, 1 new in `sessionDoctorModel.test.ts`.

Verification target: steps 4.1 and the acceptance item for tree/status-bar colors name
the local electron test host (no ports, no preview); the Reviewer re-ran it
independently (above). The electron host exposes no page the browser tools can
drive, so the Reviewer's visual check is the inspection of the user's step 4.4
screenshot below, not a separate capture.

## Acceptance checklist results

1. **`statusStyle.ts` maps every lifecycle, initiative group, and health status with
   uncolored fallbacks — pass.** [extension/src/statusStyle.ts](https://github.com/david-perry-software/agento/blob/feature/status-colors/extension/src/statusStyle.ts)
   matches plan `## Approach` item 1 glyph-for-glyph and id-for-id; unknown
   lifecycles (including prototype keys `constructor`/`toString`, guarded by
   `Object.hasOwn`) fall back to `{ icon: "folder" }`; unknown health → `error`/
   `agento.health.fail`. Covered by `statusStyle.test.ts` (139/139 pass).
2. **Every emitted color id is declared with all four defaults; no unused `agento.*`
   color — pass.** `extension/package.json` `contributes.colors` has 14 entries; the
   manifest test asserts a two-way id match and pins each `dark`/`light`/
   `highContrast`/`highContrastLight` default to the plan's `charts.*` table.
3. **Every bundled `LIFECYCLES` value except `no-delivery` is colored — pass.** The
   test imports `extension/cli/session-state.mjs` and iterates `LIFECYCLES`; passes.
4. **Deliveries, Initiatives, and Session & Doctor rows colored per mapping (electron,
   all scenarios) — pass.** `extension/test/electron/suite.ts` asserts `ThemeIcon.id`
   and `color.id` for the four fixture delivery groups and their leaves (leaves share
   group color), the empty/error rows, initiative groups and members, the Completed
   folder, a done initiative, an in-progress initiative (uncolored), an invalid
   initiative and its error diagnostic, the anomaly diagnostic, Session `Lifecycle`
   and Warning rows, the Doctor `pulse` group (worst = fail), the three Doctor check
   rows, and the Session & Doctor retry row. Rerun: 3/3 scenarios pass.
5. **Status bar `color` follows lifecycle, `backgroundColor` follows doctor
   `warn`/`fail`, text unchanged — pass.** `sessionDoctorModel.test.ts` covers
   paused/ok, in-review/warn, shipped/fail, no-delivery/ok, no-delivery/fail and the
   error model; the electron suite asserts `["agento.status.building",
   "statusBarItem.warningBackground"]` in the build window and `[undefined,
   "statusBarItem.errorBackground"]` with text `Agento: unavailable` for the invalid
   session. Existing text assertions (`Agento: primary · 2 active`, `Agento: build ·
   1 active`) still pass.
6. **User sees the colors with the packaged VSIX — pass.**
   [evidence/step-4-4-status-colors.png](evidence/step-4-4-status-colors.png),
   linked on roadmap step 4.4, shows the orange `debug-pause` Paused group and orange
   leaf, green `pass-filled` Shipped group with green leaves, the Completed (3)
   folder and green Complete groups in Initiatives, the orange Lifecycle row in
   Session & Doctor, and the orange `Agento: build · 1 active` status bar item. No
   secrets visible (a private LAN IP and the local path prefix are shown; neither is
   a secret).
7. **Docs and CHANGELOG — pass.** `docs/extension.md` `## Status colors` (line 72)
   has the mapping table, the `workbench.colorCustomizations` example, and the
   "health outranks lifecycle" status-bar note; `CHANGELOG.md:5` has the Unreleased
   **Added.** entry.
8. **Full gate green against the baseline — pass.** See the gate table above: every
   command exit 0, shellcheck no findings, node 340 ≥ 340, unit 139 ≥ 128 (+11
   attributed), electron 3/3, bundle 4/4, both halves clean.

## Plan vs implementation

- Implementation follows `## Approach` items 1–8 without deviation. `scripts/` and
  `extension/cli/` are untouched (`git diff --stat origin/main...HEAD` lists only
  `extension/src`, `extension/test`, `extension/package.json`, `docs/extension.md`,
  `CHANGELOG.md`).
- Documented refinements, both within plan intent: the `no-delivery` Lifecycle row
  carries no icon at all (like the other Session rows) rather than an uncolored
  `folder` (roadmap 3.3 note); `worstCheckStatus` treats any non-`ok`/`warn` status
  as `fail`, consistent with `healthStyle`.
- No undocumented changes found.

## Roadmap audit

All 12 boxes ticked; each spot-checked against the code and the rerun:

- 1.1 baseline recorded; 2.1/2.2 files and tests exist and pass; 3.1–3.4 code present
  in `deliveryTreeProvider.ts`, `initiativeTreePresentation.ts`/
  `initiativeTreeProvider.ts`, `sessionDoctorProvider.ts`, `sessionDoctorModel.ts`/
  `extension.ts`, and the 3.4 grep reproduces (lines 83 and 104); 4.1 assertions
  present and passing; 4.2 greps reproduce; 4.3 `.vsix` no longer present (deleted
  as planned, never committed); 4.4 `(manual)` has its linked evidence file; 5.1
  results reproduce.
- No falsely ticked boxes, no missing steps, no repairs made. No `(manual,
  post-ship)` steps.

## Findings

No blocker, major, or minor findings. Nits only:

1. **Nit — initial status bar lacks the error background.**
   `extension/src/extension.ts:104` sets `statusBar.text = "Agento: unavailable"` at
   creation without `backgroundColor`, while `SessionDoctorProvider`'s initial model
   (`sessionDoctorProvider.ts`, `statusBarStyle: { background: "error" }`) implies
   one. Transient until the first refresh, which calls `applyStatusBar`.
2. **Nit — empty doctor check list renders a green `pulse`.**
   `SessionDoctorProvider.worstCheckStatus` returns `ok` for `checks: []`. The CLI
   always emits checks, so this is theoretical.
3. **Nit — primary-scenario status-bar color assertion is self-referential.**
   `suite.ts` compares `api.statusBar.color` to `lifecycleStyle(<model lifecycle>)`
   computed from the same model and does not assert `backgroundColor` there; the build
   and invalid-session scenarios carry the concrete assertions, so coverage holds.
4. **Nit — docs lead sentence overstates.** `docs/extension.md` opens with "Every
   dashboard icon is tinted by status", while Session/Companion/Warnings group
   folders, in-progress initiatives, and empty rows stay uncolored (the second
   paragraph says so for the latter two).
5. **Nit — electron fixture covers 4 of 7 delivery lifecycles.** Paused, approved,
   and post-ship-pending groups are verified only by unit tests (and Paused visually
   in the 4.4 screenshot); the provider code path is identical for all lifecycles.

## Follow-ups

- Set the error background on the status bar at creation (`extension.ts:104`) so the
  pre-refresh state matches the provider's initial error model.
- Tighten the `docs/extension.md` `## Status colors` lead sentence to name the
  surfaces that stay uncolored.
