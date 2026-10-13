# Review: publish-cli

Verdict: approve

Reviewed 2026-10-12 (review round 1, invoked by the Autopilot) at product
`d782bc2` on `feature/publish-cli` (code PR #112, draft, CI `test` SUCCESS) and the
companion half on the mirrored branch (artifact PR #49). Both halves contain their
`origin/main` (`git merge-base --is-ancestor origin/main HEAD` true in each), are
level with `origin/feature/publish-cli` (0 behind), and were clean at the start.

Skills consulted: none — no matching domain (no `.agents/skills/`, no skills table;
Node CLI code, Markdown prompts/agents, node:test suites).

The Decision 5 amendment (2026-10-12) replaced the manual before/after reference
runs (steps 6.2/6.3) with the deterministic replay harness
`tests/publish-replay.test.mjs`. plan.md records it as a user-approved amendment
(Decisions 5, Risks, Acceptance checklist), so this review scores the amended
criteria. It is not drift.

## Acceptance checklist results

Verification commands were run by the Reviewer in the product worktree unless noted.

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `plan-publish` performs the Planner's publish in both layouts; re-send creates nothing; never readies/merges | pass | `plan-publish` group in `scripts/agento.test.mjs`: companion (commit in half, one empty product commit, both draft PRs, cross-link, `artifact-pr:`, re-send creates nothing, revise commit), in-repo (`docs(delivery)` commit, `Fixes #<n>` body), rejections writing nothing — all pass in the full run (493/493) |
| 2 | `review-publish` commits in the artifact half, integrates only the companion default, pushes, one verdict comment with the review.md link; a re-review updates it | pass | `review-publish (companion)` test asserts `integrated` = companion `origin/main` only, product HEAD unchanged, exactly one marked comment after two sends with the same `comment.id`, and `unchanged` on an identical re-send; in-repo test leaves another user's marked comment alone — pass |
| 3 | `publish-pr --merge` pushes, opens/reuses a non-draft PR, bounded wait with exit 2 then resume, merges a `BEHIND` default by merge, `--merge` only, deletes the remote branch, syncs; linked worktree left on its branch with the close-session handoff; `--dir` on a companion | pass | `publish-pr` group: without `--merge`, pending → re-send, BEHIND + conflict, linked worktree, `--dir` companion, `--branch` resume — all pass |
| 4 | Refuses the default branch, detached HEAD, every feature/issue/post-ship prefix with exit 3, writing nothing | pass | refusal test snapshots refs + porcelain before/after each refusal (`feature/x`, `issue/x`, `post-ship/x`, detached, default, unknown repo, dirt, empty branch, body file inside); live: `publish-pr` in `/home/david/DP/agento` on `main` → exit 3 `default-branch`; in this worktree → exit 3 `delivery-branch`; primary tree still clean afterwards |
| 5 | Failing checks → `blocked`/`checks-failed`, nothing merged; auth failures carry `reauth` | pass | "stops blocked on a failing check with nothing merged" and "reports gh and push authentication failures with a reauth command" — pass |
| 6 | Every rewired file publishes through one `agento.mjs` call, no hand-run fallback; mirrors byte for byte | pass | `grep -nE 'gh pr create\|gh pr merge\|gh pr comment\|wait-for-checks\.sh\|git push'` over the 9 rewired prompts and 3 agents: no matches; `cmp commands/<f>.md .github/prompts/<f>.prompt.md` exits 0 for all 9; the new "one call" tests in `tests/customizations.test.mjs` pass |
| 7 | Only the Planner files reference `plan-publish`, only the Reviewer files `review-publish`, only the five flows `publish-pr` | pass | the three restriction tests pass; `grep -rl 'agento.mjs publish-pr'` lists only the five prompts, their mirrors, the policy §6 line, and docs (the Architect's reference is line-wrapped at `.github/agents/initiative-architect.agent.md` L117–118) |
| 8 | `ship`, `sync`, `step-commit` unchanged | pass | `git diff origin/main...HEAD -- scripts/agento.test.mjs`: 529 insertions, 0 deleted lines; every existing ship/sync/step-commit test passes. The `ship` diff only swaps the closure for the module-level `waitForChecks` with `maxSeconds: remainingSeconds()` |
| 9 | Usage header lists the three subcommands; docs, CHANGELOG, policy §6 describe them; `extension/cli/` regenerated | pass | `node scripts/agento.mjs` usage: 3 matching lines; `docs/commands.md`, `docs/architecture.md`, `CHANGELOG.md` Unreleased, and policy §6 updated; `diff -q scripts/agento.mjs extension/cli/agento.mjs` reports no difference |
| 10 | Full gate equals the green baseline | pass | `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → exit 0, **493 pass, 0 fail** (baseline 465; 181 s); `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` → exit 0, no findings (ShellCheck 0.11.0 from the local pnpm cache, not the baseline's 0.10.0: newer, so at least as strict); guard replay → exit 0; companion guard replay → exit 0; `cd extension && npm ci && npm run test:unit` → exit 0, 167 pass |
| 11 | Savings recorded (amended): the "after" static table, measured replay counts, reproduce command, linked evidence; the replay passes with equal end state and a lower after count | pass | plan.md "Measurement — after" (every row 1 call per send) and "Measurement — replayed"; fresh `node --test --test-reporter=spec tests/publish-replay.test.mjs` → 3 pass; counts plan-publish 13 → 1 (gh 6 → 9), publish-pr 10 → 1 (3 → 6), review-publish 8 → 1 (2 → 6), identical to plan.md and [evidence/step-6-2-replay-counts.txt](evidence/step-6-2-replay-counts.txt). Each replay asserts `deepEqual(afterState, beforeState)` |

## Plan vs implementation

- **Matches Approach 1–7.** Helpers lifted with no behaviour change (`waitForChecks`,
  `ensureDeliveryPrs`, the `integrateHalves` `defaultHalves` option, and the extracted
  `cleanHandoff`). The three subcommands, the prompt and agent rewiring, the tests,
  the docs, and the generated copy are all present.
- **Deviation, an improvement:** `review-publish` checks that the code PR exists and
  is open (`pr-missing`, `pr-not-open`) *before* committing. The plan put this after
  the push. The new order means a missing PR writes nothing. It is documented in
  `docs/commands.md`.
- **Behaviour notes**, recorded in the CHANGELOG as Risks requires: the in-repo
  Reviewer now always posts the verdict comment, and the companion `plan-publish`
  integrates the defaults before pushing.
- **Decision 5 amendment:** `tests/publish-replay.test.mjs` is listed under Affected
  files, and the plan's Risks names its limit: it measures the prescribed sequences,
  not model behaviour. Each "before" sequence follows the `origin/main` prose step
  by step, including the REST PATCH cross-link and the `agento.mjs session`
  confirmation.
- No undocumented changes: all 30 changed files are in the Affected files list.

## Roadmap audit

- All 21 ticked steps were spot-checked against the code, the tests, and the
  commands above. No box is falsely ticked.
- Steps 6.2 and 6.3 are no longer `(manual)`, per the amendment. Their evidence file
  exists, is linked, and agrees with a fresh run.
- There are no `(manual)` or `(manual, post-ship)` steps.
- No repairs were made, and no steps were added.

## Findings

1. **Minor — `publish-pr --body-file -` reads stdin on every send, including
   re-sends.**
   - `readBodyFile` runs at product `scripts/agento.mjs` L2572
     (`fs.readFileSync(0)` at L2353) before the PR lookup, but the body is used only
     when a PR is created.
   - The exit-2 re-send in `next[]` (L2653) repeats `--body-file -` without its
     body. Typed verbatim in an interactive terminal, that re-send blocks on stdin.
   - The prompts say to re-send "the identical call", which in practice re-pipes
     the body, so this is a robustness gap rather than a contract break.
   - The tests use `spawnSync`, which closes stdin, so they cannot expose it.
2. **Nit — `review-publish` parses the `gh pr view` output with a bare
   `JSON.parse`** (L2400). Every other gh read goes through `ghJson` or a
   `try`/`catch`. Non-JSON output would throw instead of returning the
   `gh-error` contract.
3. **Nit — `plan-publish` counts the product commits before fetching.** The
   empty-commit decision (L2339) counts `origin/<default>..HEAD` before
   `integrateHalves` fetches. A stale `origin/<default>` could miscount. This is
   harmless on a freshly branched plan, which is the only supported entry.

No security issues were found. Every git and gh argument is built as an argv array
with no shell. Pushes use full `refs/heads/` refspecs and are never forced. The
merge flags are fixed to `--merge`. Delivery prefixes are refused in code.

## Follow-ups

- `publish-pr`: read `--body-file -` only when a PR must be created, or make the
  `next[]` re-send say that stdin is not needed once the PR exists (Finding 1).
- `review-publish`: route the `gh pr view` parse through the guarded JSON path
  (Finding 2).
