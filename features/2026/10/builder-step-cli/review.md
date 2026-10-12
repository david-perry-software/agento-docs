# Review: builder-step-cli

Verdict: approve

Round 2 (Autopilot), 2026-10-12. Reviewed product `42bf27b` (PR #111, draft, open,
`MERGEABLE`) and companion `3db91c1` (PR #48, draft, open). Both halves are on
`feature/builder-step-cli`, level with their `origin/feature/builder-step-cli`, and
contain their `origin/main` (`merge-base --is-ancestor` true in both). New since
round 1: product `72f137f` (steps 3.5, 3.6) and `42bf27b` (4.5); companion
`ce187a8`, `ad52fcf`, `3db91c1` (3.5, 3.6, 4.5, 5.4).

Skills consulted: none — no matching domain (no `.agents/skills/`, no skills table in
AGENTS.md; same as plan.md `## Research`).

The per-step tool-call median (9 → 9) is the user's accepted scope decision
(plan.md `## Decisions`, 2026-10-12) and is not scored as a finding.

## Acceptance checklist results

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `sync` fetches, merges `origin/<branch>` and `origin/<default>` (never rebase), pushes product first, aborts conflicts with files, rejects outside the build window | pass | `integrateHalves` / `mergeRef` (`merge --no-edit`, `merge --abort`) / `pushHalves` unchanged apart from the refspec; sync tests pass (14/14 `step-commit\|sync` tests in a scratch copy at `42bf27b`); reviewer re-ran `agento.mjs sync feature nope` → exit 3 |
| 2 | `step-commit` two-commit rule, slug-scoped companion commit, integrate, `reverify` exit 2, product-before-companion push, draft PRs + cross-link + `artifact-pr:`, clean and `ahead: 0` | pass | `stepCommit()`; companion, in-repo, and reverify tests pass; the companion commit now runs `git commit -q -F <msg> -- <slugDir>` |
| 3 | `step-commit` rejects, writing nothing: default branch / detached / wrong window / non-Conventional / unticked `--step` / no roadmap change / companion changes outside the slug directory / message file inside a half; never `--no-verify`, `--amend`, `--force`, rebase | pass | Round-1 Finding 1 closed (see below): the pre-check adds `git diff --cached --name-only --no-renames -z`, so a staged rename's origin is seen; the guard-equivalence test now covers the staged `git mv <outside> <slugDir>/stolen.md` (`paths: ["features/2026/10/other/plan.md"]`), `default-branch` and `branch-mismatch`. Reviewer re-ran from the primary: `step-commit feature nope --message-file - </dev/null` → exit 3 `wrong window: role=primary (/home/david/DP/agento, branch main)`; without `--message-file` → exit 1 |
| 4 | Re-send resumes from git state (`already-pushed`; unpushed → integrate and push) | pass | companion test re-send → `already-pushed`; reverify test re-send → `pushed` |
| 5 | `ship` behaviour unchanged; existing ship tests pass unmodified | pass | `git diff cf20e51..HEAD` touches only `pushHalves` and `stepCommit()` in `scripts/agento.mjs`; `pushRef` and its ship callers are unchanged; the new test edits are inside the two step-commit tests only; full suite 465/465. The additive `conflicts[]` is now documented in CHANGELOG |
| 6 | Builder uses one `sync` / one `step-commit` call, no hand-run fallback; only the Builder references them | pass | `.github/agents/delivery-builder.agent.md` unchanged since round 1; customizations tests pass |
| 7 | `## Measurement` records before/after (amended) | pass | plan.md `## Measurement`: before 5 / 9 / 53 and 1 / 9 / 49, after 3 / 9 / 34; accepted decision per `## Decisions` |
| 8 | Docs, CHANGELOG, `extension/cli/` regenerated, `test:unit` passes | pass | CHANGELOG entry rewritten (no `8–12`: `grep -c '8–12' CHANGELOG.md` → 0; names the rename-origin check, the explicit pathspec, the full `refs/heads/` refspecs, and ship's `conflicts[]`); `npm run copy-cli` exit 0, `git diff --quiet -- cli` exit 0, `npm run test:unit` 167/167 |
| 9 | Full gate vs. baseline | pass | Reviewer run at `42bf27b`: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → 465 tests, 465 pass, 0 fail, exit 0 (baseline 453); `replay-guard.sh < tests/guard-fixtures.txt` exit 0; `REPLAY_COMPANION=1 … guard-fixtures-companion.txt` exit 0; `git ls-files '*.sh' \| xargs pnpm dlx shellcheck` exit 0, no output |

## Round-1 findings re-checked

1. **Staged-rename escape — fixed.** `stepCommit()` now unions `treeState`'s
   tracked/untracked paths with `git diff --cached --name-only --no-renames -z`
   (which lists a rename origin as a deletion) before rejecting
   `companion-outside-slug`, and, as a second layer, re-asserts the staged set right
   before the companion commit and commits with `-- <slugDir>` (or `--
   <roadmapRel>` for the `artifact-pr:` header commit). Mutation checks in a scratch
   `git archive` copy of `42bf27b`:
   - reverting all three changes → the guard-equivalence test fails (`expected: 3,
     actual: 0`; the escape reappears: `stolen.md` committed and pushed);
   - reverting only the pre-check → the backstop still stops it (`expected:
     'rejected', actual: 'failed'`), so both layers are live.
2. **`+`-prefixed branch push — fixed.** `pushHalves` pushes
   `refs/heads/<b>:refs/heads/<b>`, so the refspec never begins with `+`. The gh-auth
   test asserts the logged git invocation is exactly `push origin
   refs/heads/feature/widget:refs/heads/feature/widget`; reverting the change fails
   that test. A scratch bare-origin check confirmed `git push -u origin
   refs/heads/feature/x:refs/heads/feature/x` still sets `@{upstream}` to
   `origin/feature/x`, so first pushes keep tracking. Ship's `pushRef` callers are
   untouched.
3. **`default-branch` / `branch-mismatch` untested — fixed.** The guard-equivalence
   test switches the companion half to `main` (holding the slug's roadmap) and to
   `feature/elsewhere`, asserting each reason, its message, and an unchanged
   snapshot of both halves. Deleting the `default-branch` check makes the test fail
   (`expected: 'default-branch', actual: 'branch-mismatch'`).
4. **CHANGELOG wording — fixed.** The `8–12` claim is gone ("each make one CLI call
   where they hand-ran git and gh before"), and ship's additive `conflicts[]` is
   stated.

**Test count (465 before and after the round-1 fixes) — explained, not a gap.** The
fixes add assertions inside the two existing tests "step-commit guard equivalence:
every rejection leaves both halves unchanged" and "step-commit reports a gh
authentication failure…"; `git diff cf20e51..HEAD -- scripts/agento.test.mjs` adds no
new `test(` block, so `node --test` still counts 465. The mutation runs above prove
the new assertions execute and fail when their fix is removed.

## Plan vs implementation

- Guard-equivalent rules, re-confirmed by reading `scripts/agento.mjs` at `42bf27b`:
  - default branch / detached / branch mismatch: `buildWindow` checks every half
    before any write (now tested for all three reasons);
  - no force: `pushRef` runs `git push [-u] origin refs/heads/<b>:refs/heads/<b>`
    from sync and step-commit, never `--force` or a `+` refspec;
  - no rebase: `mergeRef` runs `git merge --no-edit` only;
  - hooks run: `git commit -q -F <tmpfile> -- <pathspec>`, no `--no-verify`, no
    `--amend`;
  - roadmap-in-commit: unchanged from round 1 (`step-not-ticked` /
    `roadmap-not-updated`);
  - companion scope: working-tree, untracked, and staged paths (rename origins
    included) must all sit under the slug directory, re-checked at commit time.
- Observation (no action): when only the commit-time backstop fires, the product
  commit has already been made locally (unpushed) and the result is `failed`, not
  `rejected`. It is reachable only if the pre-check misses a path, and the message
  names what to unstage.

## Roadmap audit

Every ticked box was spot-checked against the code and a fresh run:

- 3.5, 3.6: code and tests present as described; the tests fail under mutation.
- 4.5: `grep -c '8–12' CHANGELOG.md` → 0; the entry names `conflicts[]`.
- 5.4: reproduced independently (465/465, both replays exit 0, shellcheck exit 0,
  `copy-cli` + `test:unit` 167/167, `git diff --quiet -- extension/cli` exit 0).
- 1.1–5.3: unchanged since the round-1 audit; still hold.

No falsely ticked boxes. Header repair: `next-step` now names `/agento ship
builder-step-cli` (was the round-2 review).

## Findings

None open. All four round-1 findings are resolved (see above).

## Follow-ups

- The spend-reduction initiative's Definition of done ("a reference `/agento ap`
  run takes measurably fewer tool calls than the baseline recorded by
  `builder-step-cli`") stays open and needs its own evidence (plan.md
  `## Measurement`); terminal-capture retries dominate per-step counts.
- `publish-cli` should reuse `fetchOrigin` / `mergeRef` / `pushRef` with the
  `refs/heads/` refspec and the staged-set scope check from this delivery.
- `docs/commands.md` describes `step-commit`'s scoping but not the rename-origin
  check or the full refspec; worth a line when `publish-cli` touches that section.
