# Review: cli-dashboard-json

Verdict: approve

Reviewed 2026-09-18 against product `c38a934` (`feature/cli-dashboard-json`, PR #49) and
companion `7f1c82d` (agento-docs PR #6). `origin/main` is an ancestor of both HEADs;
both halves clean, `ahead: 0`. Skills consulted: none — no matching domain (no
`.agents/skills/` and no `## Agento` skills table in AGENTS.md).

Diff reviewed: `git diff origin/main...HEAD` → 6 files, +391/−25: `CHANGELOG.md`,
`docs/commands.md`, `scripts/agento.mjs`, `scripts/agento.test.mjs`,
`scripts/session-state.mjs`, `scripts/session-state.test.mjs`. Companion diff: plan.md
and roadmap.md only.

## Acceptance checklist results

1. **Per-item `lifecycle`/`owner`/`workspace`/`companion`/`pr`/`companionPr` and
   top-level `lifecycles`/`warnings`; existing fields and `items` order unchanged** —
   **pass.** `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → 210 pass /
   0 fail, including the new "status adds lifecycle, owner, workspace, companion,
   pr/companionPr per item…" test and the untouched "status lists roadmaps with
   progress, verdicts, and duplicate slugs" test. Independent parity check: I ran
   `origin/main`'s CLI (detached worktree at `/tmp/agento-main`) and this branch's
   CLI against the same artifact data — every one of the 16 pre-existing item keys
   is byte-identical for all 20 shared items (`diffs: 0`), item key order is the
   old 16 keys followed by the 6 new ones, top-level keys are the old 7 followed by
   `lifecycles, warnings`, and `lifecycles` deep-equals `LIFECYCLES`.
2. **No `gh` without `--pr`; with `--pr` non-complete items carry the `gh pr view`
   JSON and complete items stay `null` with no lookup** — **pass.** Test "status --pr
   looks up PRs for non-complete items only…" (marker-file stub logs `$PWD $*` for
   each `pr view`; exactly one call per non-complete item in-repo, product + clone
   call per item in companion mode, none for `complete`). I also ran `status` with a
   strict stub `gh` that logs *every* invocation (including `--version`) first on
   `PATH`: no marker written, exit 0. Live `status feature cli-dashboard-json --pr`
   returned PR #49 (`pr`) and agento-docs #6 (`companionPr`) with
   `number,state,isDraft,mergeStateStatus,url`.
3. **Lookup/lifecycle problems land in `warnings[]` prefixed with the slug and never
   change exit code or lifecycle** — **pass.** Same test: failing `gh` →
   `alpha: pr: gh pr view feature/alpha failed: no pull requests found for branch`,
   exit 0, `lifecycle: "building"`; `MERGED` PR on `in-progress` →
   `alpha: merged-but-not-complete: …`, lifecycle unchanged; bogus header →
   `bogus: unknown-roadmap-status: …`. `lookupPullRequest` and `deriveLifecycle`
   only ever return `{ …, warnings }` (agento.mjs L463–485, session-state L227–258).
4. **Companion mode: half-only roadmap listed from the primary, branch-matching half
   shadows the clone copy, `companion {…}` and `workspace {…}` reported; in-repo:
   build-worktree-only roadmap listed with `workspace: null`, `companion: null`** —
   **pass.** Test "session and next read the delivery roadmap from the registered
   companion half…" (extended: half-only `xray` listed, clone copy shadowed, detached
   half and wrong-branch half lose to the clone copy, in-repo `widget` from a
   `feature-widget` build worktree, plan worktree not walked) and the in-repo/pair
   halves of the per-item test (`companion.dirty` flips to `true`, `ahead: 1`,
   `workspace.exists` flips once the file is written). Live: from this promoted pair,
   `node scripts/agento.mjs status` lists `cli-dashboard-json` (which exists only on
   the half's branch — `origin/main`'s CLI does not list it), with
   `owner { path: <this worktree>, role: build, dirPrefix: plan, id: 20260918-234155 }`,
   `workspace { path: …/plan-20260918-234155.code-workspace, exists: true }`, and
   `companion { …, dirty: false, ahead: 0, behind: 0, registered: true }`.
5. **`next.target`: `null` for `here`, `{ path: <primary>, workspace: null }` for
   `primary`, owning managed product worktree for `secondary`; `candidates`,
   `dispatch`, statuses, exit codes unchanged** — **pass.** `resolveNextTarget` table
   test in `scripts/session-state.test.mjs` (7 cells + null branch + `workspaceFor`
   called only for the matched product entry); `scripts/agento.test.mjs` asserts
   `target` on the in-repo approve → `{ path: repo, workspace: null }`, `here` → `null`,
   initiative member `start-session` → `null`, companion-mode approve →
   `{ path: <product primary>, workspace: null }`. Live `node scripts/agento.mjs next`
   in this worktree: `"window": "here"`, `"target": null`, exit 0. `deriveNext` and
   `transition()` are untouched; `target` is set only inside `if (result.next)`.
6. **Usage line matches `status [feature|issue] [slug] [--pr]`** — **pass.**
   `node scripts/agento.mjs bogus` prints it on usage line 13 (header block still 21
   lines); asserted by the `--pr` test via `run(repo).json.usage`.
7. **Docs and changelog; versions stay `0.5.2`** — **pass.** `grep -n "lifecycles\[\]\|target" docs/commands.md`
   → L49 (`status` clause) and L111 (`next` clause); `grep -n "^## Unreleased"
   CHANGELOG.md` → line 3; `grep -n '"version"' package.json .claude-plugin/plugin.json`
   → both `0.5.2`. See Findings #1 for one inaccurate clause in the `status` prose.
8. **No prompt/command/agent/instruction/hook/template changes** — **pass.**
   `git diff --stat origin/main...HEAD -- .github commands scripts/hooks templates`
   is empty.
9. **Full gate on the final commit** — **pass.** `shellcheck scripts/hooks/*.sh
   scripts/wait-for-checks.sh` exit 0 (baseline: exit 0); full test run 210 pass /
   0 fail (baseline 206, +4 new tests); `./scripts/hooks/replay-guard.sh <
   tests/guard-fixtures.txt` exit 0; `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh
   < tests/guard-fixtures-companion.txt` exit 0; `git merge-base --is-ancestor
   origin/main HEAD` exit 0 in both halves.

Tally: 9 pass / 0 fail / 0 deferred.

## Plan vs implementation

- Every `## Approach` step is present: `allRoadmaps(typeFilter, halves = [])` with
  dedupe by `samePath`, one lazy `git branch --show-current` per base, and a
  per-path candidate list; `managedHalves(worktrees)` for both layouts;
  `case "status"` computes the six per-item fields after the existing sort and emits
  the old seven top-level keys in the old order followed by `lifecycles, warnings`;
  `resolveNextTarget` is pure and exported; `case "next"` wires it with the exact
  arguments the plan names.
- **Precedence rule wording.** Plan `## Approach` §1 says "the copy whose `branch:`
  header equals the base's checked-out branch wins; otherwise the first base listed;
  the clone/primary copy is the fallback". The implementation resolves
  `matched → artifacts-root copy → first listed` (agento.mjs L429), which is what plan
  `## Risks` ("a half that is detached or on a different branch … loses the
  precedence tie to the clone/primary copy") and roadmap step 1.1's `verify:` ("a half
  that is detached loses the tie to the clone copy") require, and what the tests
  assert. The code follows the plan's intent; the ambiguous Approach sentence and
  the docs clause copied from it are the deviation (Findings #1).
- `session`/`next` call sites pass `[companionHalfOf(...)]`; a `null` element is
  skipped, so their behaviour is unchanged (covered by the untouched session/next
  tests).
- Q2 (skip complete items), Q3 (sort kept, `lifecycles[]` added), Q4 (no prompt
  edits) all honoured. No undocumented changes.

## Roadmap audit

All 9 ticked boxes spot-checked against the code and the commit series
(`93a69b5..c38a934` product, `c4c079b..7f1c82d` companion), one commit per step in each
half as policy §7 requires:

- 1.1 `96ece6a` — `allRoadmaps`/`managedHalves` + the extended L654 test. Ticked correctly.
- 1.2 `e9e43fe` — per-item fields, `LIFECYCLES` import, `warnings[]`. Ticked correctly.
- 1.3 `cfb3761` — `--pr` branch, usage line 10. Ticked correctly.
- 1.4 / 2.3 / 3.2 — phase gates: `origin/main` is an ancestor of both HEADs; companion
  `dirty: false`, `ahead: 0`; gate re-run green above. Ticked correctly.
- 2.1 `887a40c` — `resolveNextTarget` + table test. Ticked correctly.
- 2.2 `3e8a963` — `case "next"` wiring, usage parenthetical mentions `target`. Ticked correctly.
- 3.1 `c38a934` — docs, `## Unreleased`, versions unchanged. Ticked correctly.

No manual or post-ship steps. No falsely ticked boxes; no repairs made; no steps added.

## Findings

1. **Minor — `docs/commands.md` L43–44 mis-states the no-match tie-break.** "else the
   first source listed, the clone/primary copy last" describes the opposite of the
   implemented and tested order: when no copy's `branch:` matches its base's branch,
   the artifact checkout's copy wins and a half/worktree copy is chosen only when no
   root copy exists (`scripts/agento.mjs` L429, comment L398–404; test "a detached
   half … loses the tie to the clone copy"). A dashboard author reading the docs
   would expect a detached plan half's copy to mask the published record. One-clause
   fix; does not affect behaviour.
2. **Nit — stale comment.** `scripts/agento.mjs` L460: "Only `session --pr` and
   `ship-preflight --pr` reach this" — `status --pr` now does too.
3. **Nit — misleading warning text for a header-less roadmap.** `status --pr` on a
   roadmap with no `branch:` header yields `<slug>: pr: no branch to look up
   (detached HEAD)` (pre-existing `lookupPullRequest` message written for `session`).
   Never throws; exit 0.

No security-relevant changes: `gh` is spawned via `execFileSync` with a fixed argv
(no shell), only under `--pr`, with a 15 s timeout; the branch value comes from the
roadmap header and is passed as a single argument. No secrets are read or printed.

## Follow-ups

- Fix the precedence clause in `docs/commands.md` (Findings #1) and, while there,
  align plan-style wording "matched → artifact checkout → first listed" in the
  `allRoadmaps` docs; update the stale comment at `scripts/agento.mjs` L460
  (Findings #2). Suitable for `/agento quick-fix`.
- `lookupPullRequest` probes `gh --version` on every call, so `status --pr` spawns
  two `gh` processes per lookup (up to four per item in companion mode). Caching the
  probe once per process would halve the cost for large dashboards.
- `agento.mjs initiative` and `agento.mjs paths` follow-ups already recorded in
  roadmap.md `## Follow-ups` (reuse `managedHalves()` in `initiative`; `paths` should
  resolve `worktreesDir` via `primaryWorktreesDir`).
