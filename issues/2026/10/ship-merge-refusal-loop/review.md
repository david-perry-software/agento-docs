# Review: ship-merge-refusal-loop

Verdict: approve

Review round 2, 2026-10-25 (re-review after the Builder's Phase 6 fixes). Product
branch `issue/ship-merge-refusal-loop` at `9412130` (code PR #133, draft, open,
`MERGEABLE`/`CLEAN`), companion branch at `b041398` (artifact PR agento-docs#68,
draft, open, `MERGEABLE`/`CLEAN`), issue #132. After `git fetch origin` in both
halves, `origin/main` (`bea012b` product, `82d49b6` companion) is an ancestor of both
HEADs (`git merge-base --is-ancestor`, exit 0), both halves are level with their remote
branches (HEAD = `origin/issue/ship-merge-refusal-loop` in each), and the session
record reads `companion.dirty: false`, `ahead: 0`, `behind: 0`.

Round 1 (at `21bbce2`) returned `request-changes` with Findings 1–4; the round-2 delta
is three product commits (`ec7086c` 6.1, `f47c255` 6.2, `9412130` 6.3) touching
`scripts/delivery-roadmap-resolver.mjs`, `scripts/agento.mjs`, `scripts/agento.test.mjs`,
and the regenerated `extension/cli/` copies (`git diff --stat 21bbce2..HEAD`: 5 files,
+113/−17). This review re-judges the whole change at `9412130`.

Skills consulted: none — no matching domain (no `.agents/skills/` in the repository
and no `## Agento` skills table in AGENTS.md); the work is internal to the Agento CLI,
its prompts, and its policy.

Verification re-run by the Reviewer at `9412130` (product checkout, 2026-10-25):

| Check | Exit | Result |
| --- | --- | --- |
| `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` | 0 | 816 tests, 816 pass, 0 fail (baseline 808 + 8; round 1 had 815, 6.2 added one) |
| `node --test --test-name-pattern='#132 ship-merge-refusal-loop' scripts/agento.test.mjs` | 0 | 4/4 (BLOCKED, unknown-contexts, DIRTY, checks-failed) |
| `node --test --test-name-pattern='reopenRoadmap\|#132 ship-merge-refusal-loop' scripts/agento.test.mjs` | 0 | 5/5 |
| `node --test --test-name-pattern='ship-conflict-gate\|not mergeable' scripts/agento.test.mjs` (#107 regressions) | 0 | 3/3 |
| `node --test scripts/merge-state.test.mjs` | 0 | 3/3 |
| `node --test tests/customizations.test.mjs` | 0 | 56/56 |
| `node --test scripts/session-state.test.mjs` | 0 | 56/56 |
| `node --test tests/extension-bundle.test.mjs` | 0 | 4/4 |
| `cd extension && npm run test:unit` | 0 | 251/251 |
| `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` (ShellCheck 0.10.0 release binary from /tmp) | 0 | no findings |
| `cmp .github/prompts/ship.prompt.md skills/agento/commands/ship.md` | 0 | byte-identical |
| `cmp scripts/{agento,merge-state,delivery-roadmap-resolver}.mjs extension/cli/…` | 0 | all three identical; `diff -rq scripts extension/cli` shows only 14 `Only in scripts` entries (copy-cli's intentional skips) |
| `grep -n 'could not be read' scripts/agento.mjs` | 0 | L3357 inside `blockedMerge` (the 6.2 wording) |
| `grep -n 'reopen.*in-review' docs/commands.md`; `grep -n 'in-review' delivery-policy.instructions.md \| grep -i reopen` | 1 | nothing left |
| `node -e` probes against `reopenRoadmap` (below) | 0 | A–E all as required by step 6.1 |
| Live read-only check of soshiki#541 through `scripts/merge-state.mjs` (`gh api` GET + `gh pr view`, never `gh pr merge`) | 0 | head `98ff4e5a`, `MERGEABLE`/`BLOCKED`, required `["Vercel","Modularity report"]`, classic protection `404 Branch not protected`, `absent: ["Vercel"]`, `classification: blocked` — identical to `evidence/step-5-2-soshiki-541-classification.txt` |

`reopenRoadmap` probes (`node -e`, importing `scripts/delivery-roadmap-resolver.mjs`
at `9412130`, on a `status: complete` roadmap with one ticked Phase 1 step and a
`## Follow-ups` section):

- A — `reopenRoadmap(reopenRoadmap(done, {pr-conflicting}), {checks-failed})` contains
  `Fix the failing required check`; two unticked steps 2.1/2.2; `next-step: "2.1
  (added 2026-10-11)"` (the 6.1 verify probe).
- B — an identical repeat (`{pr-conflicting}` on the output of `{pr-conflicting}`)
  is byte-equal to its input.
- C — tick 2.1, `completeRoadmap`, then reopen with the *same* code: exactly one
  unticked step `2.2 (added 2026-10-13)`, `next-step: "2.2 (added 2026-10-13)"`,
  `status: in-progress`, the accepted-at-ship section removed, the ticked 2.1 kept.
- D — with 2.1 ticked and 2.2 still open, a reopen for `companion-pr-conflicting`
  appends 2.3 and points `next-step` at 2.2 on 2.2's own date.
- E — the pre-existing `## Follow-ups` section survives; no trailing blank-line growth.

Lint gate (§5): the recorded baseline is green (808/808, shellcheck exit 0), so the
full gate applies; the fresh results above are green with no new findings.

## Acceptance checklist results

1. **Exposing regression tests fail at the base and pass after the fix — pass.**
   Round 1 ran the three original `(#132 ship-merge-refusal-loop)` tests against an
   `origin/main` tree (3/3 `not ok`, exit 1); roadmap 1.1 records 3/0/3. At `9412130`
   the pattern matches 4 tests (6.2 added the unknown-contexts case) and all pass.
2. **BLOCKED / policy refusal never yields `pr-conflicting`, never reopens; pending
   within the grace, `merge-blocked` after it — pass.** Asserted by the BLOCKED test
   (`status: pending`, `phase: checks`, exit 2, message names `Vercel`, `gaps.hard:
   []`, no `roadmap-reopened`; then exit 3, `status: blocked`, `reason:
   merge-blocked`, `next: ["/agento ship widget"]`, roadmap still `complete`,
   review.md byte-equal). Code: `blockedMerge()` / `readPrState()` / `headCommitAge()`
   in `scripts/agento.mjs` (after `waitChecks` at L3450 and in the `merge-code`
   refusal branch at L3456). With `ghRequiredContexts` → `known: false` the final
   message now states the required checks could not be read and quotes gh's first
   stderr line (L3355–L3358), asserted by the new test (`/required status checks
   could not be read/`, the quoted refusal, `doesNotMatch /required reviews or
   conversation resolution/`). Round-1 Finding 2 closed.
3. **`scripts/merge-state.test.mjs` coverage — pass.** Unchanged since round 1:
   `classifyMergeRefusal` (BLOCKED, BEHIND, DIRTY, "merge conflict", draft,
   GraphQL-unknown, text-over-status precedence, status fallback, empty),
   `requiredContexts` (ruleset-only, classic-only, both de-duplicated,
   404/empty/non-array), `missingRequired` (absent, pending for CheckRun and
   StatusContext, failed, complete, empty); 3/3.
4. **Genuine conflict and `checks-failed` reopen to `in-progress` with a Ship-reopen
   step named by `next-step`; a second reopen adds no duplicate; the build window
   routes to the Builder — pass.** DIRTY and checks-failed tests assert `status:
   in-progress`, `## Phase \d+: Ship reopen (`, `next-step` `2.1 (added …`; the DIRTY
   test asserts `agento.mjs next` → `/agento build-feature widget` and
   `session.allowed` ⊇ {build, ap}. The `reopenRoadmap` unit test now asserts the
   non-vacuous cases: same-input idempotency (`assert.equal(..., plain)`), a second
   reopen with a new code adds exactly `2.3` and leaves one `2.1` and one `2.2`
   (three steps total), and a reopen after `2.1` was ticked and `completeRoadmap` ran
   yields exactly one unticked step `2.2 (added 2026-10-13)` named by `next-step`
   with the ticked step kept. Probes A–E above confirm the same against the module
   directly, including the same-code-after-tick case the test does not spell out.
   Round-1 Findings 1 and 4 closed.
5. **Ship's rejection JSON after a reopen: `allowed` is the primary row for the
   post-reopen lifecycle (no `/agento new-feature`), `elsewhere` equals `rejectTo` —
   pass.** Asserted in the DIRTY test; implemented by `receiptForRejectTo("building",
   …)` in `reopen()`; unchanged since round 1.
6. **Prompt mirror and docs — pass.** `ship.prompt.md` ≡ `skills/agento/commands/ship.md`
   (cmp 0); both carry the `in-progress` reopen with the added step, the
   `status: "blocked"` / `merge-blocked` mapping, and `checks-failed`. Delivery-policy
   §9 ship row, concurrent-delivery `mergeStateStatus` line, `docs/commands.md`, and
   `CHANGELOG.md` each mention `merge-blocked` (grep count 1 each);
   `tests/customizations.test.mjs` 56/56.
7. **`extension/cli/` regenerated with `merge-state.mjs` — pass.** The three touched
   modules are byte-identical to `scripts/` (cmp 0 each, re-verified after 6.1/6.2);
   `extension/scripts/copy-cli.mjs` and `tests/extension-bundle.test.mjs` list
   `merge-state.mjs`; `npm run test:unit` 251/251.
8. **Full gate — pass.** 816/816, `# fail 0`, exit 0; shellcheck 0.10.0 exit 0.
9. **Live read-only check of soshiki#541 — pass.** The evidence file records
   `blocked` with `Vercel` absent at head `98ff4e5a`; my independent re-drive today
   reproduces it field for field using only `gh api` GETs and `gh pr view`.

## Plan vs implementation

- `reopenRoadmap` (plan §Approach 3 / roadmap 3.1, "one `(added <date>)` step per
  code", reused section never duplicated): now implemented in the reuse branch —
  the last `## Phase N: Ship reopen` section is located, its `(added …)` steps
  parsed, and a step is appended (continuing `N.M`) for every requested code whose
  exact step text has no unticked occurrence; `next-step` is the section's first
  unticked step on its own `(added <date>)`. Matches the plan and
  `docs/commands.md` L222–L226. Round-1 deviation resolved.
- Plan §Risks ("never guesses"): `blockedMerge` now branches on `contexts.known`
  before the "required reviews or conversation resolution" wording; the `known:
  true` wordings are unchanged. Resolved.
- The merge-blocked grace is measured with `git log -1 --format=%ct <codeRef>`
  rather than GraphQL `committedDate`; equivalent for the head commit and documented
  in the plan's Resolution. Acceptable (unchanged from round 1).
- `integrate()`'s `receiptForRejectTo("in-review", …)` still hardcodes the lifecycle
  for the `integration-conflict` receipt's `allowed` row; `elsewhere` is the exact
  `rejectTo`, so routing is correct. Recorded as a Follow-up in roadmap.md by the
  Builder, as requested. Round-1 Finding 3 closed as follow-up.
- plan.md `## Resolution` is consistent with the diff (root cause, five change
  groups, proof). Its proof paragraph still quotes round 1's counts (3/3 and
  815/815); the current numbers are 4/4 and 816/816. Cosmetic; roadmap 6.3 carries
  the current counts.

## Roadmap audit

All 17 ticked boxes spot-checked against the code and their verify lines re-run
(table above): 1.1–5.3 as in round 1 (unchanged code paths, re-verified at
`9412130`), plus the Phase 6 steps:

- 6.1 — `reopenRoadmap|#132` pattern 5/5 exit 0; the named `node -e` probe contains
  `Fix the failing required check` (probe A). The vacuous `assert.equal(f(x), f(x))`
  is gone and replaced by the (a) and (b) assertions the step names. Correctly ticked.
- 6.2 — `#132` pattern 4/4 exit 0; `grep -n 'could not be read'` shows L3357 inside
  `blockedMerge`. Correctly ticked.
- 6.3 — `cmp` 0 for both named files (and `merge-state.mjs`); full gate 816/816;
  extension 251/251; shellcheck 0; `git status --porcelain --untracked-files=all`
  empty in both halves. The recorded counts match mine. Correctly ticked.

No `(manual)` or `(manual, post-ship)` steps exist. No box was unticked and no step
was added. `status: in-review`, `next-step: ""`, `last-updated: 2026-10-25` are left
as the Builder set them.

## Findings

No finding above minor severity remains.

1. **Cosmetic — the Ship-reopen phase is appended after `## Follow-ups`.** Both the
   fresh branch of `reopenRoadmap` (appends at end of file) and the reuse branch
   (keeps the section where it is) leave `## Phase N: Ship reopen` below the
   roadmap's `## Follow-ups` section when one exists (probe E, and the unit test's
   `reopened` fixture). `parseRoadmapSteps` and the `steps` counter scan the whole
   file (`scripts/agento.mjs` L581, L3719), so ship's audit and the Builder still see
   the steps; only the artifact's visual order deviates from the Phase→Follow-ups
   convention. Not blocking; follow-up below.
2. **Cosmetic — plan.md `## Resolution` quotes round-1 counts** (3/3 #132 tests,
   815/815 gate) where HEAD has 4/4 and 816/816. The roadmap's 6.3 line and this
   review carry the current numbers. Not blocking.

Nothing security-relevant: no secrets, no new network sinks beyond read-only
`gh api` GETs with a 15 s timeout and swallowed errors; `--admin`/`--auto` are not
used (plan §Out of scope). The gh refusal line quoted into the `merge-blocked`
message is gh's own single-line stderr, not user or repository content.

## Follow-ups

- `deriveLifecycle` labels a `complete` roadmap with an OPEN code PR as `shipped`
  (seen after `merge-blocked`); a distinct "merging" lifecycle would make window rows
  read correctly (already in roadmap.md Follow-ups; extension and canvas impact).
- The `integration-conflict` receipt's `allowed` row hardcodes lifecycle
  `"in-review"` (`integrate()` in `scripts/agento.mjs`); derive it from the roadmap
  on disk if that receipt is ever shown verbatim (already in roadmap.md Follow-ups).
- `reopenRoadmap` could insert the `## Phase N: Ship reopen` section before an
  existing `## Follow-ups` section so the artifact keeps the Phase→Follow-ups order
  (Finding 1); the parsers do not depend on it.
