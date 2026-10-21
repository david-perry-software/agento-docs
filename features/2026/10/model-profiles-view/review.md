# Review: model-profiles-view

Verdict: request-changes

Reviewed 2026-10-21 (round 1) at product `beb0d3e` on `feature/model-profiles-view`
(code PR david-perry-software/agento#125; artifacts on the companion branch, PR
david-perry-software/agento-docs#62). `origin/main` (`9f84ec7`) is an ancestor of
both halves' HEADs; both halves were clean before review.

The implementation is complete and every acceptance item passes on evidence I
produced myself. The only blocker is a falsely ticked roadmap step (5.2): the
`npm version` run that bumped `extension/package.json` also reformatted its
`contributes.colors` block, so the step's verify ("the diff shows only the version and
the view/command/menu contributions") does not hold. It is whitespace-only and the
fix is a one-file formatting restore; after it, this review expects to approve.

## Verification I ran

All in the product worktree at `beb0d3e`, this session:

| Check | Command | Result |
| --- | --- | --- |
| Shell lint (§5 full gate) | `/tmp/shellcheck-v0.10.0/shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` | exit 0, no findings (= baseline) |
| Root suites | `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | exit 0, **609/609** (baseline 607 + 2 new) |
| Guard smoke ×5 | `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` and the four AGENTS.md variants | all exit 0 |
| Extension install/build/typecheck | `cd extension && npm ci && npm run build && npm run typecheck` | exit 0 each |
| Extension unit | `cd extension && npm run test:unit` | exit 0, **182/182** (baseline 167 + 15 new) |
| Extension electron | `cd extension && DISPLAY=:0 npm run test:electron` | exit 0, **4/4 scenarios**; the in-repo log line ends `…, model profiles` |
| CLI bundle sync | `cmp scripts/agento.mjs extension/cli/agento.mjs` | identical |
| Clean trees after everything | `git status --porcelain --untracked-files=all` in both halves | empty; no `/tmp/agento-extension-*` dirs left |

**Electron display.** `xvfb-run` is not installed on this machine (`command -v
xvfb-run` is empty), so the Builder and I both ran the suite against the live X display
`:0`. I accept that as faithful evidence: the display provider is incidental to the
scenarios, the same four scenarios and the same assertions ran, and AGENTS.md itself
spells the check as `npm run test:electron` with no display wrapper. The roadmap lines
that say `xvfb-run -a` (4.1, 4.2, 5.3) are satisfied in substance.

**Isolation from real user state (explicitly checked).** Before and after the electron
run I fingerprinted `~/.config/agento/model-profiles.json` (mtime `1792570773`, 737
bytes, sha256 `284c8f0d…cda37db`) and the `^model:` lines of every
`.github/agents/*.agent.md` in this worktree and in `/home/david/DP/agento`
(sha256 `7ac0d846…a0487ce`). All three are byte-identical after the run. Code-wise,
`runTest.ts` passes a fresh `AGENTO_CONFIG_HOME` and `AGENTO_E2E_PLUGIN_ROOT` to
**every** scenario, `scripts/model-profiles.mjs:14` honours `AGENTO_CONFIG_HOME`
first, and the only writes happen in `assertModelProfilesView` after
`agento.pluginRoot` is set to the temp clone and after the assertion that
`profilesFile.path.startsWith(configHome)` (`suite.ts`, step 1). The setting is
restored in `finally`, and both temp dirs are removed and asserted gone in
`runTest.ts`'s `finally`.

**Verification target.** Plan Decision Q5 chose electron-only verification; no
roadmap step names a `local:`/`dev-stack`/`preview:` target or a browser flow, so there
is no screenshot to capture — the electron suite is the named target and I re-ran it.

**Skills.** None loaded: AGENTS.md has no `## Agento` skills table and there is no
`.agents/skills/` directory, matching plan.md `Skills consulted: none`.

## Acceptance checklist results

1. **`models list` carries `warnings` and `targets`, matching `show`, existing fields unchanged — PASS.**
   `scripts/agento.mjs:4846-4857` builds both from the same `state.resolved` /
   `tierWarnings(targets, profile, copilotModels)` call `show` uses (`:4865`); `targets`
   and `warnings` are `[]` when the profile has errors. New tests
   `scripts/agento.test.mjs:3523-3553` assert deep equality with `models show`, the
   invalid-profile shape, and the exact key set. Root suite 609/609;
   `tests/extension-bundle.test.mjs` is in that run and `cmp` confirms the bundle copy.
2. **Pure model covers every state, row spec, `summarizePins`, and name helpers — PASS.**
   `extension/src/modelProfilesTree.ts`; `extension/test/unit/modelProfilesTree.test.ts`
   has 12 tests: the four states plus `custom` (lines 42-113), applied/invalid/warning/
   default rows (115), info/message elements (147), pin grouping including the fallback
   list `A (copilot) → B (copilot)` (156-164), `validateProfileName` (166),
   `suggestCopyName` (174). Unit 182/182.
3. **`summarizeModelsResult` extension and arg helpers covered — PASS.**
   `extension/test/unit/modelProfiles.test.ts:94-108` (`--expect` from hash, `--force`
   on applied delete, no `--expect` when hash is null), `:132-185` (write-verb success
   messages; `dirty` files and `conflict` flag; fallback messages for `exists`,
   `not-found`, `active`, `conflict`, `invalid`).
4. **View registered with inline Apply, context menu, title bar, and welcome content — PASS.**
   `extension/package.json`: view `agento.modelProfiles` after Session & Doctor;
   `view/title` New/Clear(`state == ready`)/`agento.refresh`/overflow Open Profiles
   File; `view/item/context` Apply inline with
   `viewItem =~ /^agento\.modelProfile(\.invalid)?$/` (hidden on `.applied`), Edit/
   Duplicate/Rename/Delete in `1_modify@1-4`; two `viewsWelcome` entries keyed on
   `agento.modelProfiles.state`; `commandPalette` `when: false` for the five row-only
   commands. Asserted by `extensionIntegration.test.ts` (manifest) and the electron
   registration loop (`suite.ts:886-888`), both green.
5. **Electron in-repo drive of init/New/Duplicate/Rename/Apply/Clear/Delete(--force)/watcher/quick pick — PASS.**
   `suite.ts` `assertModelProfilesView` steps 1-9 (lines ~672-868): `no-file` → `init`
   → `ready`; CLI-written `mixed`/`review` listed with tooltip pins; New empty
   (`fresh`), New copy-from (`copied`), Duplicate (`review-copy`), Rename
   (`fresh`→`fresh2`); Apply sets `active === "mixed"`, description
   `applied · Everyday models`, contextValue `.applied`, and the temp clone's
   `delivery-reviewer.agent.md` gains `model: "Claude Opus 5.5 (copilot)"`; Clear →
   `active === null`; Delete of the applied profile passes through `confirmDelete`
   with `applied: true` and leaves `active: custom` with the info row first; step 8
   observes `watched` with no `agento.refresh` call; step 9 applies `review` through
   `agento.selectModelProfile`. In-repo scenario passed in my run.
6. **Dirty-clone error with Open Output / Show in Source Control; stale `--expect` reloads with the retry message — PASS.**
   `extension.ts` `reportModelsError` offers exactly those two actions when
   `summary.dirty.length`, and `handleModelsSummary` shows "The profiles file changed
   since the view loaded — refreshed; try again." and reloads on `summary.conflict`.
   Unit coverage at `modelProfiles.test.ts:165-185`; electron step 7 writes the file
   under the view, drives Rename with the stale hash, and asserts `renamed-review` was
   not created and the hash changed.
7. **No test writes outside its temp dirs; `git status` clean after the full electron run — PASS.**
   See *Isolation from real user state* above; both halves' `git status --porcelain
   --untracked-files=all` are empty after the run and no `/tmp/agento-extension-*`
   directory remains.
8. **Docs and release — PASS.** `extension/README.md` gains `## Model Profiles` and the
   Commands entry; `docs/extension.md` `## Model profiles` is rewritten around the view
   and keeps the quick pick; `docs/model-profiles.md` documents the `warnings`/`targets`
   list fields and points at the view; `CHANGELOG.md` opens with `## 0.10.0
   (unreleased)` **Added**; `"version": "0.10.0"` in `package.json`,
   `.claude-plugin/plugin.json`, `extension/package.json`, and both fields of
   `extension/package-lock.json`. `tests/customizations.test.mjs` is in the green root
   run. (The package.json *formatting* regression is a roadmap-verify failure, below,
   not an acceptance failure.)
9. **Lint gate (§5 full rerun) — PASS.** shellcheck exit 0 / 0 findings = baseline;
   root 609 ≥ 607 + new; 5/5 guard replays; unit 182 ≥ 167 + new; electron 4/4;
   `npm ci`, `build`, `typecheck` exit 0.

## Plan vs implementation

- The implementation follows `## Approach` items 1-8 closely; the state names,
  context values, icons, menu groups, watcher patterns, debounce, and prompt hook all
  match the plan.
- **Deviation (minor):** Approach 5 / step 3.3 say the watchers are "rebuilt whenever
  the profiles-file path or the plugin root changes". `extension.ts` calls
  `rebuildModelProfileWatchers()` from both the apply and the error callback of
  **every** `reloadModelProfiles()` (so on every refresh, focus, visibility change, and
  watcher event), disposing and recreating both watchers each time. Behaviour is
  correct and the suite proves the watcher path, but it is more churn than planned
  (see Findings 2).
- **Undocumented change:** the `contributes.colors` block of `extension/package.json`
  was reformatted by `npm version` in `beb0d3e` (whitespace only; `JSON.parse` of
  `origin/main` and `HEAD` gives identical `contributes.colors`, `configuration`,
  `scripts`, and dependency objects). Not in the plan's affected-files intent and
  contrary to step 5.2's verify. The previous release had the same slip and corrected
  it in `15137b9` ("fix: restore extension package.json formatting to origin/main").
- `extensionIntegration.test.ts` and `gateDashboardPlanActions.test.ts` were extended
  for the new view/commands (`LatestDeliveryRefresh` count 1 → 2, menu and palette
  expectations); appropriate and in scope.
- The plan's lint-baseline note says the planning-time electron run was "under
  `xvfb-run -a`"; `xvfb-run` is not installed on this machine today. Historical
  artifact, not rewritten (§5), noted for accuracy.

## Roadmap audit

Spot-checked all 12 ticked boxes against the diff and my own runs.

- 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.3: verified as ticked (tests,
  files, and contributions present; every `verify:` command re-run green above).
- **5.2 — unticked (repair made 2026-10-21).** The version bump and the CHANGELOG entry
  are in place and the root suite passes, but the second half of the verify fails:
  `git diff origin/main -- extension/package.json` shows the `contributes.colors`
  reformat in addition to the version and the contributions (`git diff --stat 5c72063
  beb0d3e -- extension/package.json` → 128 insertions, 23 deletions). The step line now
  carries the reason and the fix.
- `next-step` set to point at 5.2; `status` stays `in-review` (the CLI derives the
  Builder fix handoff from this verdict).
- 4.1/4.2/5.3 name `xvfb-run -a`; executed on `DISPLAY=:0` by Builder and Reviewer
  because `xvfb-run` is absent. Accepted as equivalent (see above); lines left as is.
- No `(manual)` or `(manual, post-ship)` steps exist; nothing to defer.

## Findings

1. **Moderate (process; blocks approve) — step 5.2 falsely ticked / unplanned
   reformat of `extension/package.json`.** `beb0d3e` rewrote every
   `contributes.colors[*].defaults` object from one line to five. Semantically
   identical, but it inflates the release diff by ~150 lines, contradicts the step's
   own verify, and repeats the slip `15137b9` fixed last release. **Fix:** restore the
   block's `origin/main` formatting (e.g. take `contributes.colors` verbatim from `git
   show origin/main:extension/package.json`), keep the `"version": "0.10.0"` line, run
   `cd extension && npm run typecheck && npm run test:unit` plus the step's two verify
   commands, re-tick 5.2, and set `next-step: ""`. Consider a Follow-up so the next
   bump does not use `npm version` on this file.
2. **Minor — watchers rebuilt on every reload** (`extension/src/extension.ts`,
   `reloadModelProfiles` → `rebuildModelProfileWatchers()` in both callbacks). Each
   reload disposes and recreates two `FileSystemWatcher`s; a change landing in the
   dispose/create window is not observed by the watcher (it is covered by the reload
   that just ran, so no stale state results). Suggest remembering the last `(root,
   profilesFilePath)` pair and rebuilding only when it differs, as step 3.3 describes.
   Not blocking.
3. **Minor — CLI failure message lost on a non-zero `models list`.**
   `reloadModelProfiles` always passes `result.json` as `listResult`; when the CLI
   exits non-zero with `{ status, message }` and no `profilesFile` (usage error,
   unreadable plugin root), the view shows "The models list result is missing
   profilesFile." instead of the CLI's `message`. Suggest `listError:
   result.code !== 0 ? message : null`. Not blocking.
4. **Minor — electron step 7's predicate is satisfiable by the watcher reload**
   (`suite.ts`, "the conflict reload": `hash !== staleHash && review listed`). The
   proof of the conflict path is the follow-up assertion that `renamed-review` does
   not exist, which does hold; the retry warning text itself is not asserted.
   Optionally assert via a stubbed `showWarningMessage` or an output-channel probe.
   Not blocking.

No security findings: no secrets, no shell interpolation (all CLI calls are
`execFile`/`client.run` arg arrays), writes confined to the configured profiles file
and plugin root through the existing CLI verbs with `--expect`.

## Follow-ups

- Avoid `npm version` for the extension bump, or add a formatting restore step to the
  release recipe, so `extension/package.json` keeps `origin/main` formatting (recurred
  in `15137b9` and `beb0d3e`).
- Rebuild the Model Profiles watchers only when the plugin root or profiles-file path
  changes (Finding 2).
- Surface the CLI `message` for a non-zero `models list` in the view's error row
  (Finding 3).
- Document in AGENTS.md / the Planner template that `npm run test:electron` needs
  *a* display (`xvfb-run -a` or an existing `DISPLAY`), so roadmap `verify:` lines do
  not hard-code a tool the machine may lack.
