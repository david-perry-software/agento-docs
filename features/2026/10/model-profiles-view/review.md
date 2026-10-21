# Review: model-profiles-view

Verdict: approve

Reviewed 2026-10-21 (round 2) at product `57a4fd8` on `feature/model-profiles-view`
(code PR david-perry-software/agento#125; artifacts on the companion branch at
`894f36e`, PR david-perry-software/agento-docs#62). `origin/main` is an ancestor of
both halves' HEADs, both halves were in sync with their `origin/<branch>` and clean
before review. This round supersedes the round-1 verdict (`request-changes` at
`beb0d3e`).

Round 1 raised one blocker and three minor findings. All four are fixed in
`58be612` (5.2), `1cdbb59` (6.1), `2209c61` (6.2), and `57a4fd8` (6.3); each was
verified independently below. Every acceptance item passes on evidence I produced
in this session, no falsely ticked roadmap box remains, and no finding above minor
severity is open.

## Round-1 findings — resolution

| # | Round-1 finding | Fix commit | Verified how | Status |
| --- | --- | --- | --- | --- |
| 1 | Step 5.2 falsely ticked: `contributes.colors` reformatted by `npm version` | `58be612` | `git diff origin/main -- extension/package.json` removes only `"version": "0.9.0"` and one closing `}`; `JSON.parse` of `origin/main` vs HEAD differs only in `version` and `contributes.{views,commands,menus,viewsWelcome}`; the `colors` block is textually identical to `origin/main` (`diff` of the extracted block is empty) | resolved |
| 2 | Watchers rebuilt on every reload | `1cdbb59` | `extension/src/extension.ts:213-247`: `rebuildModelProfileWatchers` keys on `` `${root}\0${profilesFilePath}` `` and returns early when the key is unchanged; dispose + recreate happens only on a key change. Disposal on deactivate at `:922-926` unchanged | resolved |
| 3 | CLI `message` lost on non-zero `models list` | `2209c61` | `extension.ts:187-191` sets `listError` from `result.json.message` when `result.code !== 0`; `modelProfilesTree.ts:104` returns `state: "error"` with that message ahead of the missing-`profilesFile` text. New unit test `modelProfilesTree.test.ts:57-65` (`prefers listError over a non-zero list result without profilesFile`) passes (#109 in the unit run). `scripts/agento.mjs` `models list` exits non-zero only through `usage(...)`, whose document carries no `profilesFile`, so no usable path is discarded | resolved |
| 4 | Electron step 7 predicate satisfiable by the watcher reload alone | `57a4fd8` | `suite.ts:833-858`: `vscode.window.showWarningMessage` is stubbed before the rename, the predicate additionally requires the "profiles file changed since the view loaded" warning, the stub is restored in `finally`, and the warning is asserted after the wait. The warning string matches `extension.ts:661`. The rename reads `modelProfilesHash()` synchronously after the prompt returns (`extension.ts:828`) while the watcher reload is behind a 500 ms debounce, so the stale hash is used deterministically; if that race were ever lost, the test now times out instead of passing | resolved |

## Verification I ran

All in the product worktree at `57a4fd8`, this session, each status captured:

| Check | Command | Result |
| --- | --- | --- |
| Shell lint (§5 full gate) | `/tmp/shellcheck-v0.10.0/shellcheck scripts/hooks/delivery-guard.sh scripts/hooks/session-context.sh scripts/hooks/replay-guard.sh scripts/wait-for-checks.sh` (the three `.sh` files that the glob expands to) | exit 0, no findings (= baseline) |
| Root suites | `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | exit 0, **609/609** (baseline 607 + 2 new) |
| Guard smoke ×5 | `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` and the four AGENTS.md variants | all exit 0 |
| Extension install/build/typecheck | `cd extension && npm ci && npm run build && npm run typecheck` | exit 0 each; `build` copies the CLI bundle |
| Extension unit | `cd extension && npm run test:unit` | exit 0, **183/183** (baseline 167 + 16 new) |
| Extension electron | `cd extension && DISPLAY=:0 npm run test:electron` | exit 0, **4/4 scenarios**; in-repo log line ends `…, stale/error handling, model profiles` |
| CLI bundle sync | `cmp scripts/agento.mjs extension/cli/agento.mjs` | identical |
| Clean trees after everything | `git status --porcelain --untracked-files=all` in both halves | empty; no `/tmp/agento-extension-*` directory remains |

**Electron display.** `xvfb-run` is still not installed (`command -v xvfb-run` is
empty), so the suite ran against the live display `:0`, as accepted in round 1: the
same four scenarios and assertions ran, and AGENTS.md spells the check without a
display wrapper. Roadmap lines naming `xvfb-run -a` (4.1, 4.2, 5.3) are satisfied in
substance.

**Isolation from real user state (re-checked).** Before and after the electron run:
`~/.config/agento/model-profiles.json` mtime `1792570773`, 737 bytes, sha256
`284c8f0d…cda37db` — unchanged; the `^model:` lines of every
`.github/agents/*.agent.md` in this worktree and in `/home/david/DP/agento` hash to
`7a56bac1…96a8adca` before and after — unchanged. `AGENTO_CONFIG_HOME` is unset in my
shell, so the only thing standing between the suite and the real file is the temp
`AGENTO_CONFIG_HOME` that `runTest.ts` passes to every scenario — and it held.

**Verification target.** Plan Decision Q5 chose electron-only verification; no step
names a `local:`/`dev-stack`/`preview:` target or a browser flow, so there is no
screenshot to capture. The electron suite is the named target and I re-ran it.

**Skills.** None loaded: AGENTS.md has no `## Agento` skills table and there is no
`.agents/skills/` directory, matching plan.md `Skills consulted: none`.

## Acceptance checklist results

1. **`models list` carries `warnings` and `targets`, matching `show`, existing fields unchanged — PASS.**
   `scripts/agento.mjs` builds both from the same `state.resolved` /
   `tierWarnings(...)` call `show` uses; `[]` on a profile with errors. New tests in
   `scripts/agento.test.mjs` assert deep equality with `models show`, the invalid
   shape, and the exact key set. Root 609/609; `tests/extension-bundle.test.mjs` in
   that run; `cmp` confirms the bundle copy.
2. **Pure model covers every state, row spec, `summarizePins`, and name helpers — PASS.**
   `extension/src/modelProfilesTree.ts`; `extension/test/unit/modelProfilesTree.test.ts`
   now has 13 tests (four states + `custom`, the new listError precedence, applied/
   invalid/warning/default rows, info/message elements, pin grouping with fallback
   lists, `validateProfileName`, `suggestCopyName`). Unit 183/183.
3. **`summarizeModelsResult` extension and arg helpers covered — PASS.**
   `extension/test/unit/modelProfiles.test.ts` (`--expect` from hash, `--force` on
   applied delete, no `--expect` when hash is null; write-verb messages; `dirty` and
   `conflict`; `exists`/`not-found`/`active`/`conflict`/`invalid` messages). Green.
4. **View registered with inline Apply, context menu, title bar, and welcome content — PASS.**
   `extension/package.json` `contributes.{views,commands,menus,viewsWelcome}` are the
   only contribution keys that differ from `origin/main` (JSON comparison above);
   Apply inline hidden on `.applied`, Edit/Duplicate/Rename/Delete in context,
   New/Clear/Refresh/Open Profiles File in the title, two `viewsWelcome` entries.
   Asserted by `extensionIntegration.test.ts` and the electron registration loop.
5. **Electron in-repo drive of init/New/Duplicate/Rename/Apply/Clear/Delete(--force)/watcher/quick pick — PASS.**
   `suite.ts` `assertModelProfilesView` steps 1–9 ran green in my run (in-repo
   scenario line names `model profiles`); the temp clone's `model:` lines change on
   Apply, step 8 observes `watched` with no `agento.refresh`, step 9 applies `review`
   through `agento.selectModelProfile`.
6. **Dirty-clone error with Open Output / Show in Source Control; stale `--expect` reloads with the retry message — PASS.**
   `reportModelsError` offers exactly those two actions on `summary.dirty.length`;
   `handleModelsSummary` shows the retry warning and reloads on `summary.conflict`.
   Unit coverage in `modelProfiles.test.ts`; electron step 7 now asserts the warning
   text itself plus the non-applied rename (round-1 Finding 4 closed).
7. **No test writes outside its temp dirs; `git status` clean after the full electron run — PASS.**
   See *Isolation* above; both halves clean afterwards.
8. **Docs and release — PASS.** `extension/README.md` `## Model Profiles` + Commands
   entry; `docs/extension.md` `## Model profiles` rewritten around the view, quick
   pick kept; `docs/model-profiles.md` documents `warnings`/`targets` and points at
   the view; `CHANGELOG.md` opens with `## 0.10.0 (unreleased)` **Added**;
   `"version": "0.10.0"` in `package.json`, `.claude-plugin/plugin.json`,
   `extension/package.json`, and both fields of `extension/package-lock.json`.
   `tests/customizations.test.mjs` is in the green root run. The round-1 formatting
   regression is gone (5.2 verify now holds).
9. **Lint gate (§5 full rerun) — PASS.** shellcheck exit 0 / 0 findings = baseline;
   root 609 ≥ 607 + new; 5/5 guard replays; unit 183 ≥ 167 + new; electron 4/4;
   `npm ci`, `build`, `typecheck` exit 0.

## Plan vs implementation

- The implementation follows `## Approach` items 1–8; state names, context values,
  icons, menu groups, watcher patterns, debounce, and the prompt hook all match.
- Round 1's one deviation (watchers rebuilt on every reload, vs. Approach 5 / step
  3.3 "rebuilt whenever the profiles-file path or the plugin root changes") is closed
  by `1cdbb59`: the rebuild is now keyed on exactly that pair.
- Round 1's undocumented change (the `contributes.colors` reformat) is reverted by
  `58be612`; `extension/package.json` now differs from `origin/main` only as the plan
  intends.
- Phase 6 (steps 6.1–6.3, `added 2026-10-21`) is the Builder's record of the review
  fixes; each step's `verify:` was re-run here and holds. 5.3's line carries the
  post-fix re-run counts (183/183 unit), matching my run.
- The plan's lint-baseline note says the planning-time electron run was "under
  `xvfb-run -a`"; `xvfb-run` is not installed today. Historical artifact, not
  rewritten.

## Roadmap audit

Spot-checked all 15 ticked boxes against the codebase and my own runs.

- 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.3: verified in round 1 and
  re-verified here (every `verify:` command re-run green above).
- **5.2 — re-tick confirmed.** Both halves of the verify now hold: root suite green,
  and `git diff origin/main -- extension/package.json` shows only the version and the
  view/command/menu contributions (the `colors` block is byte-identical to
  `origin/main`). The step's `(Restored 2026-10-21 …)` note matches the fix.
- **6.1, 6.2, 6.3 — verified as ticked.** The diffs are exactly what the step lines
  describe; `build`, `typecheck`, `test:unit` (with the new listError test) and the
  electron in-repo conflict step all pass.
- 4.1/4.2/5.3 name `xvfb-run -a`; executed on `DISPLAY=:0` because `xvfb-run` is
  absent. Accepted as equivalent; lines left as is.
- `next-step: ""`, `status: in-review`: consistent with a complete build awaiting
  this verdict. No repairs were needed this round.
- No `(manual)` or `(manual, post-ship)` steps exist; nothing to defer.

## Findings

No blocking or moderate findings.

1. **Minor (nit) — a failed watcher creation is not retried until the key changes.**
   `extension/src/extension.ts:213-247`: `modelProfileWatcherKey` is recorded before
   the two `try { createFileSystemWatcher }` blocks, so if one throws (logged to the
   output channel) the next reload will not attempt it again for the same
   root/profiles-file pair. The reload-on-focus/visibility paths still refresh the
   view, so no stale state results; only live watching is lost until the root or
   path changes. Acceptable; noted as a follow-up.
2. **Minor (test hygiene) — the electron warning stub replaces `vscode.window.showWarningMessage` globally.**
   `suite.ts:833-852` mutates the `vscode.window` namespace for the duration of the
   wait and restores it in `finally`. It is scoped tightly, the extension host is
   per-scenario, and nothing else runs concurrently in that window, so it is safe
   here; a future test that runs in parallel would need the same care.

No security findings: no secrets, no shell interpolation (all CLI calls are
`execFile`/`client.run` arg arrays), writes confined to the configured profiles file
and plugin root through the existing CLI verbs with `--expect`.

## Follow-ups

- Retry a failed `createFileSystemWatcher` on the next reload (reset
  `modelProfileWatcherKey` when either watcher's creation throws) so live watching
  recovers without a root/path change (Finding 1).
- Release process: avoid `npm version` on `extension/package.json`, or follow it with
  a formatting restore, so the `contributes.colors` reformat seen in `beb0d3e` and in
  the previous release (`15137b9`) does not recur. A small script or a test that
  compares the parsed-and-reserialized file against the committed text would catch it.
- Install `xvfb-run` on the development machine (or document `DISPLAY=:0` as the
  accepted local alternative in AGENTS.md) so the roadmap's `xvfb-run -a` spelling
  and the executed command agree.
