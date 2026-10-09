# Review: followup-debt-batch

Verdict: approve

Reviewed 2026-10-09. Product `feature/followup-debt-batch` at `41ee25b`, companion
half at `699a9c3`. `origin/main` is an ancestor of HEAD in both halves, and both
are level with their `origin/feature/followup-debt-batch` (0/0). Code PR #102 is
an open draft with `ci/test` passing; companion PR agento-docs#39 is an open draft.
Skills consulted: none — no matching domain (the repository has no
`.agents/skills/` and AGENTS.md has no skills table).

## Acceptance checklist results

1. **pass** — `paths`, `workspace`, and `config` report the primary's
   `worktrees.dir` from a managed worktree.
   - The two new tests in `scripts/agento.test.mjs` fail against `origin/main`'s
     CLI. I re-ran them in a `/tmp` copy of `origin/main` `scripts/` plus the
     branch test file: exit 1, `# fail 2`, both failing with actual `<tmp>/wt/wt`
     and expected `<tmp>/wt`.
   - They pass on the branch as part of the full suite.
   - From this build worktree, `paths feature followup-debt-batch` prints
     `"worktreesDir": "/home/david/DP/agento-worktrees"`, with `worktree` and
     `workspace` under it.
   - `config` prints `worktrees.dir` `/home/david/DP/agento-worktrees`.
   - `workspace feature followup-debt-batch` prints
     `…/agento-worktrees/feature-followup-debt-batch.code-workspace`.
2. **pass** — No reader of a cwd-relative `worktreesDir` remains.
   - The module-level constant is deleted.
   - `grep -n "worktreesDir\b" scripts/agento.mjs` finds only these: object keys
     and companion fields; `sessionWorktreesDir`; `primaryWorktreesDir(...)` call
     sites at L367, L591, L1454, L1467, L1964, and L2078.
   - The full suite passes, 357/357.
3. **pass** — `templates/companion-concurrency.instructions.md` has a
   `description` and `applyTo: "features/**,issues/**"`. Its body names
   `` `<agento-root>/.github/instructions/concurrent-delivery.instructions.md` ``
   in inline code, with no relative link. The test `ok 20 - the companion
   concurrency pointer template …` passes.
4. **pass** — `/agento agento-init` scaffolds the pointer.
   - Step 4 of `.github/prompts/agento-init.prompt.md` lists
     `.github/instructions/agento-concurrency.instructions.md` after
     `agento.instructions.md`, so the Contents-API order and the
     `changes/agento-init` missing-files path both cover it.
   - `cmp .github/prompts/agento-init.prompt.md commands/agento-init.md` is
     silent.
   - `docs/artifacts.md` and `docs/project-profile.md` both name the file.
5. **pass** — `git -C <companion half> ls-tree -r --name-only HEAD
   .github/instructions/` lists `agento-concurrency.instructions.md` beside
   `agento.instructions.md`. `diff` against the template is empty (exit 0).
6. **pass** — The `gh pr edit --body` item is closed by #62.
   - `prompts and agents never direct users to gh pr edit --body` passes in the
     full run.
   - `grep -rn "gh pr edit" .github commands docs templates` prints nothing
     (exit 1).
   - The CHANGELOG **Fixed.** entry cites #62.
7. **pass** — Unqualified model values produce one warning and qualified values
   produce none.
   - The 4 new `unqualifiedWarning:` unit tests pass. So do the 2 new CLI tests:
     `show`/`apply`/`pins` carry one warning, `apply` exits 0, and `clear`
     carries none; doctor `model-profile` is `warn` with bare pins and `ok` when
     every pin is qualified.
   - The full suite passes.
8. **pass** — The handoff pin observation is recorded.
   - Roadmap 3.2 links
     [step-3-2-handoff-model.png](evidence/step-3-2-handoff-model.png) with the
     date 2026-10-09. I viewed it: soshiki primary window, Planner reply `ok`,
     *Proceed from 📋 Agento Planner — Build in this worktree*, with the agent
     picker on Agento Builder and the model picker on `DeepSeek V4 Pro` (High).
     It shows no secrets.
   - `docs/model-profiles.md` `## Subagents and handoffs` records the result on
     VS Code 1.136.0 with the Local harness.
   - I re-checked the 3.1 setup in the registered clone: active profile `mixed`,
     planner `Claude Opus 5.5 (copilot)`, builder `DeepSeek V4 Pro (deepseek)`,
     and the planner's handoff `model: "DeepSeek V4 Pro (deepseek)"` at L15.
   - See finding 1 on how the result is worded.
9. **pass** — `awk '/^## Unreleased/,/^## [0-9]/' CHANGELOG.md | grep -c
   'paths\|vendor\|#62\|handoff'` returns 15 (≥ 4).
10. **pass** — `cmp` on all six `extension/cli/*.mjs` against `scripts/` is silent
    (`same` ×6).
11. **pass** — The full gate is green against the `## Research` baseline (I re-ran
    every command):
    - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`: exit 0,
      `# tests 357`, `# pass 357`, `# fail 0` (> 347).
    - `git ls-files '*.sh' | xargs pnpm dlx shellcheck`: exit 0, no findings
      (baseline: none).
    - `cat tests/guard-fixtures.txt | ./scripts/hooks/replay-guard.sh`: exit 0.
      `cat tests/guard-fixtures-companion.txt | REPLAY_COMPANION=1
      ./scripts/hooks/replay-guard.sh`: exit 0.
    - `cd extension`: `npm run typecheck` exit 0; `npm run test:unit` 160/160;
      `npm run test:electron` exit 0, with the in-repo, companion, workspace,
      and no-markdown scenarios all passed; `npm run package` exit 0
      (`agento-dashboard-0.7.0.vsix`, 44 files, archive assertion passed).
    - Both trees are clean afterwards
      (`git status --porcelain --untracked-files=all` is empty in each).

## Plan vs implementation

- `git diff --stat origin/main...HEAD` covers 15 product files. Every one is
  named in plan.md `## Approach` (`docs/commands.md` is the optional one). The
  companion diff is the slug directory plus
  `.github/instructions/agento-concurrency.instructions.md`, as planned.
- Deviation, documented on roadmap 2.2: the pre-existing doctor `model-profile:
  ok without a clone…` fixture was requalified to `Cheap (copilot)` /
  `Strong (copilot)`. Its bare values now correctly warn. The test still asserts
  the same `ok`/`custom` transitions. This is acceptable.
- Deviation, documented on roadmap 1.1: the tests use slug `xy` rather than `x`,
  because slugs need at least 2 characters.
- Approach item 4 says `tierWarnings` "covers `models list/show/apply/clear`".
  `models list` emits no `warnings[]`, before or after this change. The
  acceptance item names only `show`/`apply`/`pins`, so this is a plan-prose
  inaccuracy, not a gap.
- No undocumented changes.

## Roadmap audit

I spot-checked all 16 ticked steps against the code and against my own runs.
None is falsely ticked.

- 1.1 / 1.2: pre-fix failure reproduced (above); constant removed; grep clean.
- 1.3 / 2.3: six `cmp` silent.
- 2.1 / 2.2: new tests present and passing.
- 3.1: pins re-read from `/home/david/DP/agento`; they match the recorded values.
- 3.2 `(manual)`: the evidence file exists and is linked with the completion date
  (policy §3 satisfied).
- 3.3: `docs/model-profiles.md` carries the observed paragraph, and the CHANGELOG
  sentence is extended.
- 3.4: test and grep re-run.
- 4.1 to 4.3: template, init prompt, mirror, docs, and the companion file all
  verified.
- 5.1: count 15.
- 5.2: full gate re-run green.

There are no `(manual, post-ship)` steps. Repairs made: one Follow-up added to
`## Follow-ups` (finding 1). No ticks changed.

## Findings

1. **Minor: the handoff result is attributed to the nested pin, but the
   experiment cannot isolate that.** `docs/model-profiles.md` L180 says "The
   handoff button honours that nested pin". In the registered clone, the
   Builder's own frontmatter `model:` is also `"DeepSeek V4 Pro (deepseek)"`
   (`delivery-builder.agent.md` L5), the same value as the planner's nested
   handoff `model:` (`delivery-planner.agent.md` L15). `models apply` always
   writes them equal. So the screenshot shows that the handoff lands on the
   target agent's pin, but not which of the two lines VS Code applied.
   - User-facing impact is nil while `models apply` keeps the two lines equal.
   - The sentence should say "lands on the target's pin (the nested `model:` and
     the target's own pin are equal, so this does not isolate which VS Code
     applied)". The CHANGELOG wording "the pin was honoured" is acceptable.
   - Recorded as a Follow-up.
2. **Nit: `tierWarnings` now also returns the unqualified-value warning, so its
   name undersells it** (`scripts/agento.mjs` L1674). The comment above it is
   accurate. No change required.

No security concerns. The new code is pure string handling over local files. It
adds no shell, network, or secret handling, and `JSON.stringify` quotes the
values it echoes.

## Follow-ups

- Reword the `docs/model-profiles.md` `## Subagents and handoffs` handoff
  paragraph (L180) so it does not credit the nested handoff `model:` over the
  target agent's own pin. Optionally isolate it by temporarily hand-editing a
  handoff `model:` to differ from the target's pin and repeating the 3.2 check
  (followup-debt-batch review, finding 1).
