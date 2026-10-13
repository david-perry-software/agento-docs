# Review: model-pin-filter

Verdict: approve

Reviewed 2026-10-13 at product `0d463a5` (`feature/model-pin-filter`, draft PR #113) and
companion `feature/model-pin-filter` (draft PR #50). Both halves are clean, even with
`origin/feature/model-pin-filter`, and have their `origin/main` as an ancestor. Skills
consulted: none (no matching domain), same as the plan.

Verification I ran myself:

- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`: exit 0, 515 tests,
  515 pass, 0 fail. The baseline was 493/493, so 22 tests were added and none removed.
  A second run also passed 515/515.
- `cd extension && npm run build`: exit 0. `npm run test:unit`: exit 0, 167/167 pass.
  `npm run copy-cli` followed by `git status --porcelain --untracked-files=all` produced
  no output, so `extension/cli/` is a byte copy of `scripts/` and the tree is clean.
- `grep -rn "skip-worktree" docs .github/prompts commands scripts/agento.mjs` found 10
  lines. Each one is legacy-migration wording, a "never touch it yourself" note, or the
  `--no-skip-worktree` migration call. None of them prescribes clear → pull → apply.
- Independent end-to-end run in a scratch bare clone of this branch (`/tmp/mpf-e2e.sh`,
  using the branch-tip CLI and a scratch `AGENTO_CONFIG_HOME`):
  1. Checked out `e73cd38~1`. `models apply t` changed 56 files, reported
     `filter.installed: true`, and left `git status` empty.
  2. Ran `git merge --ff-only` to the tip. The merged changes touched the pinned file
     `.github/prompts/models.prompt.md`. The fast-forward exited 0, `git status` stayed
     empty, the merged file still had `model: "Cheap (copilot)"`, and `models list`
     reported `active: t` with no unrecorded or dirty files.
  3. `git stash` and `git stash pop` of a body edit on a pinned file both exited 0. The
     edit came back as the only change, and the diff had no `model:` line.
  4. `git worktree add` gave a linked worktree that inherited the pin and was clean. A
     commit there kept the pin out of `HEAD`: 0 `model:` lines.
  5. `doctor` reported `model-profile: ok` ("t applied").
  6. `models clear` exited 0. Afterwards `git diff --quiet HEAD` returned 0, no
     `filter.agento-*` config remained, `<common>/agento/` was gone, and the attributes
     file had been removed.
- Shellcheck was not needed because the diff changes no `.sh` file (`git diff --stat
  origin/main...HEAD`).

## Acceptance checklist results

1. **Pass.** A primary pinned by a named profile ships through `sync`, and so does one
   pinned by an `adopt`ed custom set. Both `ship --confirm` variants pass:
   `scripts/agento.test.mjs` ~L7462 runs `pinPrimary(repo, "apply"|"adopt")` and then
   `assertPinsSurvived`. My end-to-end fast-forward above also passed.
2. **Pass.** The `publish-pr --merge` sync and the ship `reopen` (`checks-failed`)
   fast-forward both work with pins active. Two tests cover them: "publish-pr --merge
   switches a pinned primary…" (~L7512), and "ship reopen (checks-failed)
   fast-forwards a pinned owner worktree and a pinned primary…" (~L7487). The second
   test covers both the owner worktree and the ownerless primary.
3. **Pass.** With pins active, both the primary and a linked worktree stay clean, and
   their commits carry no pin. The test "with pins active, the primary and a linked
   worktree are clean and their commits carry no model: line" (~L7529) checks this. So
   does my end-to-end step 4.
4. **Pass.** `models clear` removes the config, the attribute block, the state directory,
   and the legacy bits, and `git diff --quiet HEAD` succeeds afterwards. Checked by the
   test "models clear removes the filter config, attribute block, state dir, and legacy
   bits…" (~L3044) and by end-to-end step 6.
5. **Pass.** Three behaviours are each covered by a test:
   - `apply` migrates legacy pins (~L3093).
   - `adopt` keeps a legacy custom set byte-identical and still reports `active: custom`
     (~L3115).
   - `doctor` warns on legacy bits, on an unhealthy or stale filter, and on
     `unrecorded[]` (~L3349).
6. **Pass.** Dirty detection works under the filter. A body edit and a hand-edited
   `model:` value each show in `git status`, and `apply` refuses with `dirty` (~L3172).
   The older dirty-refusal tests (~L3230 and ~L3247) still pass.
7. **Pass.** `scripts/model-filter.test.mjs` covers:
   - round-trips for top-level strings, lists, handoffs, and CRLF
   - CRLF endings on inserted pins
   - unrecorded-path and no-state pass-through
   - mismatched-value pass-through
   - no-frontmatter pass-through
   - invalid state (three shapes), which exits nonzero with one stderr line

   It passes as part of the full run.
8. **Pass.** The full suite passed inside a pinned linked worktree. The Builder
   recorded the result in roadmap step 4.2: 515/515 with 56 pinned files. I did not
   re-run the full suite inside a pinned worktree. My end-to-end run reproduced the
   inheritance and clean-status preconditions, and the `commands/*.md` ↔ prompt
   byte-equality tests in `tests/customizations.test.mjs` passed in my run.
9. **Pass.** The docs, prompt, mirror, and CHANGELOG describe the filter, `adopt`, and
   migration:
   - `MODELS_HINT` (`scripts/agento.mjs` ~L3446)
   - `docs/model-profiles.md`, `docs/install.md`, `docs/commands.md`
   - `.github/prompts/models.prompt.md`, which is byte-identical to `commands/models.md`
     (the customizations tests pass)
   - the `CHANGELOG.md` `## Unreleased` **Fixed** entry

   The grep result is described above.
10. **Pass.** `extension/cli/` is a byte copy of `scripts/`, including `model-filter.mjs`:
    `copy-cli` leaves the tree clean, and `tests/extension-bundle.test.mjs` passes.
11. **Pass.** The gate passes: the node suite exits 0 (515/515), the extension build
    exits 0, and the extension unit tests exit 0 (167/167).

## Plan vs implementation

The implementation follows plan.md Approach 1–5 and Decisions 1–6. The roadmap already
records the deviations below, and they are sound:

- The plan expected `git update-index -q --refresh` to be enough. In practice git treats
  a size change as a modification without asking the filter. Every verb now re-records
  the stat with `git update-index -- <files>`, but only for files whose cleaned content
  equals HEAD and that have no staged change. This is the 4.2 repair, and it stops
  pin-free content from being staged when HEAD already carries pins.
- The pin state records every target file, with unpinned files stored as
  `model: null`. As a result, `filter.unrecorded` lists only files that arrived after
  the last `apply` or `adopt`, which is what Decision 4 intends.
- The report adds `filter.config` and `filter.state` (`ok | missing | invalid`) beyond
  the planned fields. `records` is kept internal: `modelsReport` strips it.
- A hand-edited `model:` value counts as dirty for `apply` only. `adopt` records it.
  This is consistent with `adopt`'s purpose.
- The step 1.1 note records that `copy-cli` and `extension-bundle` were pulled forward
  from 4.1. No change was made outside the plan's affected-file list.

## Roadmap audit

I spot-checked every ticked box (1.1–4.3) against the code and tests above and found
nothing falsely ticked:

- **1.1:** `scripts/model-filter.mjs` exists with clean, smudge, and loadState.
  `handoffModelLines` is exported from `model-profiles.mjs`.
- **2.1:** `installModelFilter`, `removeModelFilter`, and `gitTooOld` exist.
- **2.2–2.6:** the models block in `scripts/agento.mjs` matches them, and their tests
  exist.
- **3.1:** the doctor `filterIssues` code exists.
- **3.2–3.4:** their tests exist (~L7420–L7550).
- **4.1:** the docs changed as described.
- **4.2 and 4.3:** the recorded results match my reruns.

The roadmap has no `(manual)` or `(manual, post-ship)` steps. I made no repairs and
added no steps.

## Findings

No finding above minor severity.

1. **Minor:** `smudgeText` silently gives up when `setModel` throws
   (`scripts/model-filter.mjs` ~L57–L62). When that happens the file is checked out
   unpinned and nothing reports it. `models list` / `active` would then read `custom`.
   That makes the failure visible indirectly, but there is no direct diagnostic. A
   one-line stderr note, or a `doctor` hint, would make it easier to find.
2. **Minor:** In the doctor `model-profile` check, the filter-health conditions form an
   `else if` chain (`scripts/agento.mjs` ~L956–L963). If legacy bits are present, a
   missing or stale filter is not reported in the same run. The suggested fix
   (`adopt` or `apply`) resolves both, so the effect is cosmetic.
3. **Observation:** `cleanText` strips a top-level pin equal to the recorded value even
   when HEAD itself commits that pin. In such a repository the file would show as
   modified after `apply`. Agento's own committed files carry no `model:` line,
   enforced by `tests/customizations.test.mjs`, so this cannot happen in the target
   layout. The 4.2 restat guard already avoids staging. No action is needed.
4. **Security:** The filter command (`node "$(git rev-parse --path-format=absolute
   --git-common-dir)/agento/model-filter.mjs" … %f`) runs through git's shell. Its only
   interpolated values are git's own common-dir path and git's quoted `%f`, so no
   user-controlled input reaches the shell. `required=true` fails closed. No issues.

## Follow-ups

- Make smudge failures visible. When `setModel` throws during smudge, emit a one-line
  stderr warning, or surface the affected files in `filter` health.
- Have the doctor `model-profile` check report every filter-health condition at once
  (legacy bits together with a missing or stale filter) instead of the first match.
