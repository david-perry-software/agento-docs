# Review: builder-step-cli

Verdict: request-changes

Round 1 (Autopilot), 2026-10-12. Reviewed product `cf20e51` (PR #111, draft, open,
`MERGEABLE`) and companion `704a586` (PR #48, draft, open). Both halves are on
`feature/builder-step-cli`, level with their `origin/feature/builder-step-cli`, and
contain their `origin/main` (`merge-base --is-ancestor` true in both).

Skills consulted: none — no matching domain (no `.agents/skills/`, no skills table in
AGENTS.md; same as plan.md `## Research`).

The per-step tool-call median (9 → 9) is the user's accepted scope decision
(plan.md `## Decisions`, 2026-10-12) and is not scored as a finding.

## Acceptance checklist results

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `sync` fetches, merges `origin/<branch>` and `origin/<default>` (never rebase), pushes product first, aborts conflicts with files, rejects outside the build window | pass | `scripts/agento.mjs` `integrateHalves` / `mergeRef` (`merge --no-edit`, `merge --abort`) / `pushHalves`; tests "sync (companion) merges an advanced origin/main…", "…remote-ahead origin/<branch>…", "sync (in-repo) aborts a conflicting default merge…", "sync rejects from the primary, from a plan window, and with a dirty half…" pass; reviewer re-ran `agento.mjs sync feature nope` from the primary → exit 3, `wrong window: role=primary (/home/david/DP/agento, branch main)`; `agento.mjs sync` with no args → exit 1 |
| 2 | `step-commit` two-commit rule, slug-scoped companion commit, integrate, `reverify` exit 2, product-before-companion push, draft PRs + cross-link + `artifact-pr:`, clean and `ahead: 0` | pass | `stepCommit()`; tests "step-commit (companion): product commit and push precede the companion tick…", "step-commit (in-repo): one commit carries the code and the roadmap tick…", "step-commit stops with reverify (exit 2, nothing pushed)…" pass |
| 3 | `step-commit` rejects, writing nothing: default branch / detached / wrong window / non-Conventional / unticked `--step` / no roadmap change / **companion changes outside the slug directory** / message file inside a half; never `--no-verify`, `--amend`, `--force`, rebase | **fail** | All listed rejections exist and the "guard equivalence" test passes, and no `--no-verify`/`--amend`/`--force`/`rebase` argument appears in the new code. But a **staged rename from outside the slug directory into it escapes the scope check** and is committed (Finding 1, reproduced). The `default-branch` reason itself has no direct test (Finding 3) |
| 4 | Re-send resumes from git state (`already-pushed`; unpushed → integrate and push) | pass | companion test re-send → `outcome: already-pushed`, no `pr create`/`api` calls; reverify test re-send → `outcome: pushed` |
| 5 | `ship` behaviour unchanged; existing ship tests pass unmodified | pass | `git diff origin/main...HEAD --numstat -- scripts/agento.test.mjs` → `311 0` (one additions-only hunk at the end of the file); the lifted `fetchOrigin`/`mergeRef`/`pushRef` keep ship's messages, auth classification, and plain `push origin <refspec>` (no `-u`); the only visible change is an additive `conflicts[]` field on ship's `integration-conflict` rejection; full suite 465/465 |
| 6 | Builder uses one `sync` / one `step-commit` call, no hand-run fallback; only the Builder references them | pass | `.github/agents/delivery-builder.agent.md` diff; customizations tests "the Builder integrates through one agento.mjs sync call…" and "only the Builder agent references agento.mjs step-commit and agento.mjs sync" pass. The one sanctioned hand-run path (resolve a reported `integration-conflict`) is named and stays guard-visible |
| 7 | `## Measurement` records before/after (amended) | pass | plan.md `## Measurement`: before 5 / 9 / 53 and 1 / 9 / 49, after 3 / 9 / 34, with source and method; accepted decision per `## Decisions` |
| 8 | Docs, CHANGELOG, `extension/cli/` regenerated, `test:unit` passes | pass (see Finding 4) | `docs/commands.md`, `docs/architecture.md`, AGENTS.md, usage header, `concurrent-delivery.instructions.md`, CHANGELOG all updated; `npm run copy-cli` exit 0, `git diff --quiet -- cli` exit 0, `npm run test:unit` 167/167; `diff -r scripts extension/cli` differs only in test files, `hooks/`, and `wait-for-checks.sh` (not copied by design) |
| 9 | Full gate vs. baseline | pass | `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → 465 tests, 465 pass, 0 fail, exit 0 (baseline 453); `replay-guard.sh < tests/guard-fixtures.txt` exit 0; `REPLAY_COMPANION=1 … guard-fixtures-companion.txt` exit 0; `git ls-files '*.sh' \| xargs pnpm dlx shellcheck` exit 0, no output |

## Plan vs implementation

- Implementation follows Approach 1–7 closely: helpers lifted, `buildWindow`
  reuses `windowVerdict({ command: "build-<type>" })`, both subcommands emit the
  ship-style JSON contract with `STEP_EXIT` 0/2/3 and usage-error 1.
- Guard-equivalence, confirmed by reading `scripts/agento.mjs`:
  - default branch / detached / branch mismatch: `buildWindow` checks every half
    from the session record before any write;
  - no force: `pushRef` runs `git push [-u] origin <branch>` only;
  - no rebase: `mergeRef` runs `git merge --no-edit` only;
  - hooks run: `git commit -q -F <tmpfile>`, no `--no-verify`, no `--amend`;
  - roadmap-in-commit: `--step` requires `- [x] N.M` in the working roadmap and not
    at `HEAD`; without `--step`, `git diff --quiet HEAD -- roadmap.md` must fail;
    companion mode checks the companion's roadmap even for a product-only change;
  - companion scope: `git add -A -- <slugDir>` plus a pre-check of tracked and
    untracked paths — incomplete for staged renames (Finding 1).
- Deviation (undocumented): ship's `integration-conflict` rejection now carries
  `conflicts[]`. Additive and harmless; not mentioned in CHANGELOG ("no behaviour
  change").
- The usage reader now reads every leading `//` line instead of a fixed 30; the
  usage test asserts the new lines.

## Roadmap audit

Every ticked box was spot-checked against the code and a fresh test run; none is
falsely ticked as worded (3.1's verify — wrong-window exit 3 and usage exit 1 — was
re-run by the reviewer and passes). Missing work found by this review was added:

- 3.5 (added 2026-10-12): close the staged-rename escape in the companion scope check
  and test it (Finding 1).
- 3.6 (added 2026-10-12): push with an explicit `refs/heads/` refspec and test the
  `default-branch` reason directly (Findings 2, 3).
- 4.5 (added 2026-10-12): correct the CHANGELOG claims (Finding 4).
- 5.4 (added 2026-10-12): rerun the full gate after the fixes.

Header repaired to `status: in-progress`, `next-step` 3.5, since unticked steps now
exist.

## Findings

1. **Major — companion staging scope bypassed by a staged rename**
   (`scripts/agento.mjs` `stepCommit()` "Staging (Q1)" block; `splitPorcelain` in
   `scripts/session-state.mjs`). `splitPorcelain` keeps only the destination of an
   `R`/`C` entry and skips the origin token, so a rename `features/other/plan.md →
   <slugDir>/stolen.md` already in the index reports no path outside the slug
   directory; `git add -A -- <slugDir>` then `git commit -F` (no pathspec) commits
   the **whole index**, including the deletion of the file outside the slug
   directory, and the CLI pushes it. Reproduced in a scratch repo with the
   branch's `splitPorcelain`: `tree: {"tracked":["features/x/roadmap.md","features/x/stolen.md"]}`,
   `outside-slug: []`, committed `R100 features/other/plan.md features/x/stolen.md`.
   This contradicts acceptance item 3 and plan Q1 ("reject untracked files outside
   it"), in the exact path the guard cannot see. Fix: in the companion pre-check
   also collect rename/copy origins (parse `-z` porcelain origins, or use `git diff
   --cached --name-only --no-renames` plus `git status` paths) and reject any
   outside the slug directory; additionally commit with `--` pathspec or assert
   `git diff --cached --name-only --no-renames` ⊆ slug dir right before the commit.
   Add a guard-equivalence test case for a staged rename into the slug dir.
2. **Minor — `+`-prefixed branch would force-push** (`pushRef`, `pushHalves`).
   The refspec is the roadmap `branch:` value verbatim; `git check-ref-format
   --branch +foo` accepts `+foo` (exit 0), and `git push origin +foo` is a forced
   push — the guard denies `+refspec`, the CLI would not. Requires a roadmap naming
   such a branch and both halves on it, so low likelihood. Fix: push
   `refs/heads/<b>:refs/heads/<b>` (or reject a branch starting with `+`).
3. **Minor — `default-branch` rejection untested.** `buildWindow`'s
   `default-branch` and `branch-mismatch` reasons are reached only when the product
   half passes the window check but a half is on `main`/another branch (e.g. the
   companion half switched to `main`); the guard-equivalence test exercises
   `wrong window: role=primary` and `detached-head` but not these reasons.
4. **Minor — CHANGELOG overstates the effect.** "now make one call each instead of
   8–12 git and gh calls per step" contradicts plan.md `## Measurement` (hand-run
   choreography was already 1.0–1.6 calls per commit; the breakdown's 8–12 did not
   occur), and "Ship's … closures became shared module-level helpers with no
   behaviour change" omits the additive `conflicts[]` field.

## Follow-ups

- The spend-reduction initiative's Definition of done ("a reference `/agento ap`
  run takes measurably fewer tool calls than the baseline recorded by
  `builder-step-cli`") stays open and needs its own evidence (plan.md
  `## Measurement`); terminal-capture retries dominate per-step counts.
- `publish-cli` should reuse `fetchOrigin` / `mergeRef` / `pushRef` and inherit the
  Finding 1 and 2 hardening.
