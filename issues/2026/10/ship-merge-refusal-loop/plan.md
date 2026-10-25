# Ship calls a policy-blocked merge a conflict, and a reopened conflict has no owner in the build window

## Problem

`/agento ship <slug>` regularly stops before merging with the hard gap
`pr-conflicting — PR #N conflicts with main; resolve it in the build window per the
concurrent-delivery hotspot recipes`. It readies the PRs and reopens the roadmap to
`status: in-review`. The windows then disagree about who acts next:

- Ship, in the primary window, says the build window must resolve the conflict.
- The build window says the approval is current and sends the user back to ship.
  Its alternative is a re-review that approves unchanged code, after which ship is
  refused again.

The user reports this "all the time" and finds it very hard to resolve. There are two
defects:

1. **False conflicts.** Ship classifies *every* `gh pr merge` refusal as a conflict,
   including a PR that GitHub reports as `BLOCKED` because a required status check
   never reported. No conflict exists, so the build window has nothing to resolve.
2. **No owner for real conflicts.** After any ship reopen (`pr-conflicting`,
   `companion-pr-conflicting`, `checks-failed`), the build window never routes to
   the Builder. `/agento continue` derives review or ship, the window's `allowed[]`
   lacks the `/agento build-<type>` that ship told the user to run, and ship's own
   receipt lists the primary window's unrelated create commands.

## Evidence

GitHub issue: #132

**Real case, soshiki `dashboard-usage-performance` (2026-10-25).** The ship report
quoted by the user:

> Receipt: rejected — audit-gaps; allowed: /agento continue, /agento start-session,
> /agento new-feature, /agento new-issue, /agento new-initiative, /agento delivery-status
> … pr-conflicting — PR #541 … conflicts with main; resolve it in the build window …
> #541 and soshiki-docs#63 are marked ready for review … The roadmap is back at
> status: in-review on origin/feature/dashboard-usage-performance.

The branch does not conflict. Captured in the build window
(`soshiki-worktrees/plan-20261024-200421`), [evidence/soshiki-pr541-not-conflicting.txt](evidence/soshiki-pr541-not-conflicting.txt):

- `origin/main` 162619e9 is an ancestor of head 98ff4e5a: `merge-base --is-ancestor`
  exits 0 and `rev-list --count HEAD..origin/main` returns 0.
- `git merge-tree --write-tree HEAD origin/main` exits 0, so the merge is clean.
- Companion PR soshiki-docs#63 is `MERGEABLE` / `CLEAN`.
- The only event at ship time is `ready_for_review` at 2026-10-25T15:04:03Z.

GitHub's view of the PR is in [evidence/soshiki-pr541-graphql.json](evidence/soshiki-pr541-graphql.json):
`mergeable: MERGEABLE`, `mergeStateStatus: BLOCKED`, no review threads, and a check
rollup containing only `Modularity report` (SUCCESS). The `main` ruleset in
[evidence/soshiki-main-rules.json](evidence/soshiki-main-rules.json) requires the
strict status checks `Vercel` and `Modularity report`. The `Vercel` commit status was
never posted on 98ff4e5a (`total_count: 0`, and there is no deployment for the SHA).
The eight most recently merged soshiki PRs (#533–#540) each carried a `Vercel` status,
so the missing status is a platform hiccup, not a conflict.

**gh's refusal wording** ([evidence/gh-2.45.0-merge-refusal-wording.txt](evidence/gh-2.45.0-merge-refusal-wording.txt),
cli/cli v2.45.0 `pkg/cmd/pr/merge/merge.go` L254 and `blockedReason` L696). Every
refusal prints `Pull request #N is not mergeable: <reason>.`, with one reason per
`mergeStateStatus`:

| `mergeStateStatus` | `<reason>` |
| --- | --- |
| `BLOCKED` | the base branch policy prohibits the merge |
| `BEHIND` | the head branch is not up to date with the base branch |
| `DIRTY` | the merge commit cannot be cleanly created |

**What the build window says now** ([evidence/soshiki-build-window-session.json](evidence/soshiki-build-window-session.json),
[evidence/soshiki-build-window-next.json](evidence/soshiki-build-window-next.json)):

- The window record reads `role: build`, `lifecycle: approved`, `delivery.status: in-review`.
- `allowed` is `[/agento continue, /agento delivery-status, /agento next-feature]`,
  with no build command.
- `elsewhere` is `/agento ship dashboard-usage-performance` in the primary window.
- `next` derives `/agento review-feature dashboard-usage-performance` with the reason
  "Verdict: approve predates the last code commit".

**Stubbed reproduction at agento `bea012b`.** [evidence/repro.test.mjs](evidence/repro.test.mjs)
was appended to a throwaway copy of `scripts/agento.test.mjs` and run with
`node --test --test-name-pattern='REPRO ship-merge-refusal-loop' scripts/agento.test.mjs`.
Output is in [evidence/repro-output.txt](evidence/repro-output.txt); both tests fail:

- `REPRO BLOCKED`: the PR is `MERGEABLE`/`BLOCKED`, checks pass, and the stubbed
  `gh pr merge` refuses with gh's BLOCKED wording. The result is `exit 3`,
  `reason: audit-gaps`, `hard: ["pr-conflicting"]`, `reopened: true`,
  `roadmapStatus: in-review`, `prDraft: false`. `allowed` is the primary
  `no-delivery` row (`/agento start-session`, `/agento start-freehand`,
  `/agento new-feature`, …).
- `REPRO LOOP`: after a genuine DIRTY refusal reopens the roadmap, the owner build
  window reads `lifecycle: approved` with `allowed` of `[/agento continue,
  /agento delivery-status, /agento next-feature]`. `continue` derives
  `/agento review-feature widget`, or `/agento ship widget` when the approval is
  younger than the last commit. It never reaches the Builder.

Observed: a policy-blocked merge is reported as a conflict, and any reopen loops
between ship, review, and ship.

Expected: a blocked merge waits (bounded) for the missing required checks, then stops
with a precise `merge-blocked` reason that neither reopens the roadmap nor invalidates
the review. A genuine conflict or failed check sends the build window to the Builder,
which integrates and fixes, and the work then goes back to a fresh review and ship.
Ship's receipt names the window and command that act next.

## Decisions

Questions asked with the ask-questions tool; the recommended option was listed
first. Answers verbatim:

1. **Scope of the fix.** Options: *Both: classify merge refusals correctly AND give
   real conflicts one owner in the build window (recommended)*; *Only stop
   misreporting BLOCKED/BEHIND refusals as conflicts*; *Only fix the real-conflict
   routing between ship and the build window*. Answer: `both` (the recommended
   option).
2. **Ship meets a BLOCKED PR (missing/pending required check, unresolved threads).**
   Options: *Wait (bounded, status: pending, re-send) for required checks read from
   the ruleset/branch protection; after a grace, reject with a distinct
   merge-blocked gap naming the missing check — do NOT reopen the roadmap or
   invalidate the review (recommended)*; *Reject immediately with a distinct
   merge-blocked gap naming gh's reason; do not reopen*; *Reject and reopen to
   in-review like today, just with the correct reason*. Answer:
   `pending-then-reject` (the recommended option).
3. **Who resolves a GENUINE conflict (DIRTY).** Options: *Ship reopens the roadmap
   to in-progress with next-step 'integrate origin/main (pr-conflicting)'; /agento
   continue in the build window routes to the Builder, which runs sync, resolves,
   re-verifies, and goes back to in-review → re-review → ship (recommended)*; *Ship
   tries git merge origin/main itself in the primary window and only rejects on a
   real textual conflict*; *Add a dedicated /agento resolve-conflicts command for
   the build window*. Answer: `reopen-in-progress` (the recommended option).
4. **Also fix the ship rejection receipt's allowed list.** Today the receipt copies
   the primary window's list (`start-session`, `new-feature`, …); the question
   asked whether it should name the build-window command as the `elsewhere` entry.
   Answer: `true` (the recommended option).

Planner-derived consequences, open to veto at review:

- `checks-failed` uses the same reopen path as `pr-conflicting` and has the same
  loop (fix in the build window, but the build window routes to review). It
  therefore gets the same `in-progress` reopen and added Builder step.
- The merge-blocked grace is 10 minutes, measured from the head commit's
  `committedDate`. Within the grace, a required check that has not reported counts
  as pending. After it, waiting cannot help (soshiki#541's head was 11 hours old),
  so ship stops with `merge-blocked`.

## Research

Skills consulted: none — no matching domain. This repository has no `.agents/skills/`
and AGENTS.md has no skills table. The work is internal to the Agento CLI, its
prompts, and its policy.

**Merge refusal classification.**

- `scripts/agento.mjs` L3385-L3390, phase `merge-code`: a failed
  `ghRun(root, ["pr", "merge", …, "--merge"])` whose stderr matches
  `/not mergeable|merge conflict/i` calls `reopen(["pr-conflicting"])` and
  `rejectReopened([conflictGap()])`. Every gh refusal reason matches `not mergeable`.
- `scripts/agento.mjs` L2972: `isConflicting` is correct
  (`mergeable === "CONFLICTING" || mergeStateStatus === "DIRTY"`, fixed by #107).
  The audit at L3196-L3198 and the checks-phase re-check at L3305 are therefore
  correct. Only the merge-time stderr path misclassifies.
- `scripts/agento.mjs` L3207: `mergeable: UNKNOWN` is only a warning. `BLOCKED` is
  not inspected anywhere in ship.
- `scripts/agento.mjs` L2943 `waitForChecks` runs `scripts/wait-for-checks.sh`. That
  script buckets only the contexts present in `statusCheckRollup` (L60-L61) and exits
  0 when all of them pass (L122). A required context that never reported is
  invisible, so the wait succeeds and the merge is refused.
- `scripts/agento.mjs` L3338-L3339: a PR that is `BEHIND` at phase `checks` is already
  integrated (`integrate()`) before the merge. A `BEHIND` refusal at the merge itself
  is a race and currently also becomes `pr-conflicting`.
- The test stub `shipStub` (`scripts/agento.test.mjs` L6178) already supports
  `refuseMerge: <stderr>` and `mergeStateStatus`, and has an `api` hook for
  `gh api` paths. The #107 test at L7158 asserts that a `not mergeable: … cannot be
  cleanly created` refusal reopens the roadmap; that behaviour stays for DIRTY.

**Reopen and routing.**

- `scripts/delivery-roadmap-resolver.mjs` L29 `reopenRoadmap` sets
  `status: in-review` and
  `next-step: "ship reopened (<codes>): resolve in the build window, then re-review"`.
  It adds no step.
- `scripts/session-state.mjs` L326 `deriveLifecycle`: `in-review` plus
  `reviewVerdict: approve` gives `approved`, and `in-progress` gives `building`.
- `scripts/session-state.mjs` L537 `activeTransition` routes `approved` to `ship`
  (fresh) or `review-<type>` (stale), and `in-review` to `review-<type>`. It routes
  `building` to `build-<type>`.
- `scripts/session-state.mjs` L398-L405: the build row for `approved` allows only
  `[STATUS]` with `SHIP_NOW`, and the build row for `building` allows `[BUILD, AP,
  STATUS]`. The primary row for `building` allows `[RESUME, STATUS]` with the build
  command elsewhere.
- `.github/agents/delivery-reviewer.agent.md` L48-L56: the Reviewer hands an
  unintegrated branch back to the Builder.
  `.github/agents/delivery-autopilot.agent.md` L95-L101: `in-review` skips straight
  to review. Neither owns integration.
- `.github/agents/delivery-builder.agent.md` L43-L74: the Builder's `sync` call
  merges `origin/<default>` at resume and completion and stops with
  `integration-conflict` for a hand resolution using the concurrent-delivery
  recipes. That is the owner a genuine conflict needs.
- `scripts/agento.mjs` L3010: ship's JSON `allowed` is `record.allowed`, read before
  the reopen. After a confirm that wrote `status: complete`, that is the primary
  `shipped` row (CREATE), which is exactly the list in the user's receipt.
  `rejectTo` (L3293) is correct but appears only in `next`.

**Docs and copies to keep in step.**

- `.github/prompts/ship.prompt.md` L80-L91 and L114-L118, plus the byte mirror
  `skills/agento/commands/ship.md`, which `tests/customizations.test.mjs` enforces.
- `.github/instructions/delivery-policy.instructions.md` §9, the ship idempotency row.
- `.github/instructions/concurrent-delivery.instructions.md`: the line "`BLOCKED`
  means required checks still pending".
- `docs/commands.md` L189 and L217-L228.
- `CHANGELOG.md`.
- `extension/cli/` is a generated copy (`cd extension && npm run copy-cli`).

**Concurrent deliveries.** `gh pr list --state open` is empty in both
`david-perry-software/agento` and `david-perry-software/agento-docs`, so there is no
overlap.

**Lint baseline (§5), run 2026-10-25 at `bea012b`.**

- `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`: ShellCheck 0.10.0 (the
  release binary, since `shellcheck` is not on PATH here), exit 0, no findings.
- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'`:
  exit 0, `# tests 808`, `# pass 808`, `# fail 0`.

The baseline is green, so the full gate applies: full shellcheck, the full test
command, and the extension unit tests must all pass at completion. No scoped gate and
no cleanup are needed.

## Approach

**1. Pure classification module, `scripts/merge-state.mjs`** (new; no I/O, exported
for tests).

- `classifyMergeRefusal(stderr, mergeStateStatus)` returns `"conflict"`, `"behind"`,
  `"blocked"`, or `"other"`. It keys on gh's reason text first:
  - `cannot be cleanly created` or `merge conflict` → `conflict`
  - `not up to date` → `behind`
  - `base branch policy prohibits` → `blocked`

  Otherwise it falls back to `mergeStateStatus` (DIRTY/BEHIND/BLOCKED), and then to
  `other`, which keeps today's `gh-error`.
- `requiredContexts(rulesJson, protectionJson)` takes the union of the
  `required_status_checks` contexts from
  `gh api repos/<nwo>/rules/branches/<default>` and the classic
  `branches/<default>/protection/required_status_checks`. A 404 or an empty result
  counts as none.
- `missingRequired(required, rollup)` returns the contexts that are absent or not
  yet completed, plus the ones that failed.

`scripts/agento.mjs` gains a small `ghRequiredContexts(cwd, nwo, branch)` wrapper.

**2. Ship at phase `checks` / `merge-code` (`scripts/agento.mjs`).**

- After `waitChecks` returns 0, re-read the PR. If it is `BLOCKED`, or the merge
  refusal classifies as `blocked`, compute the missing required contexts:
  - Within the 10-minute grace from the head commit, return `pending("checks", …)`
    naming the missing contexts. This is a re-send with the same token.
  - Otherwise finish with `status: "blocked"`, `reason: "merge-blocked"`, and a
    `message` naming each missing or failing context. When no context is missing,
    the message instead names "the base branch policy (required reviews or
    conversation resolution)".
  - `next` is `["/agento ship <slug>"]`. The roadmap stays as the confirm wrote it,
    review.md is untouched, and nothing is reopened. A re-send resumes at phase
    `checks` per the existing idempotency row.
- A `behind` refusal integrates `origin/<default>` through the existing `integrate()`
  and returns `pending` for the re-send.
- A `conflict` refusal keeps the reopen, as in item 3.
- `other` keeps `gh-error`.

**3. Reopen to the Builder (`reopenRoadmap` in `scripts/delivery-roadmap-resolver.mjs`).**

- Set `status: in-progress` and `last-updated`. Then append, or reuse when already
  present, `## Phase N: Ship reopen (<date>)` with one `(added <date>)` step per code:
  - `pr-conflicting`: "Merge `origin/<default>` into `<branch>` with `agento.mjs
    sync` and resolve the conflict per the concurrent-delivery hotspot recipes —
    verify: `sync` reports no `integration-conflict`; `gh pr view <n> --json
    mergeable,mergeStateStatus` is not CONFLICTING/DIRTY; the full test command
    passes".
  - `companion-pr-conflicting`: the same for the companion half.
  - `checks-failed`: "Fix the failing required check `<name>` — verify:
    `scripts/wait-for-checks.sh pr <n>` succeeds".
- `next-step` names that step.
- The function stays idempotent, and the "accepted at ship" removal stays.

Because the status is now `in-progress`, `deriveLifecycle` gives `building`. In the
build window `continue` then derives `/agento build-<type> <slug>`, and `allowed`
gains build and ap. The Builder's normal resume protocol runs the step, `sync`, and
the hand resolution. Completion sets `in-review`, the Reviewer writes a fresh verdict
(the stale approve is overwritten), and `/agento ship` runs the full audit. No change
to `session-state.mjs` is expected. A test pins the derivation.

**4. Ship's rejection receipt.** On rejections that carry `rejectTo` (the reopens and
`integration-conflict`), recompute `allowed` from `deriveAllowed({ role: "primary",
lifecycle: <post-reopen lifecycle> })`. Set `elsewhere` to
`[{ command: rejectTo.command, window: rejectTo.window, reason }]`, so the receipt
prints `<build command> (build window)` instead of the create commands.

**5. Prompts, policy, docs.** Bring `ship.prompt.md` and its `skills/agento/commands/ship.md`
mirror in line: `audit-gaps` at checks now reopens to `in-progress` and the user runs
`/agento continue` (or build) in the build window, plus a new `status: "blocked"` /
`merge-blocked` mapping and the `checks-failed` wording. Also update:

- delivery-policy §9, the ship idempotency row
- concurrent-delivery: `BLOCKED` is never a conflict; ship waits or reports
  `merge-blocked`; `DIRTY` goes to the Builder
- `docs/commands.md`
- `CHANGELOG.md`
- `extension/cli/`, regenerated with `npm run copy-cli`

Affected files:

- `scripts/merge-state.mjs` (new)
- `scripts/agento.mjs`
- `scripts/delivery-roadmap-resolver.mjs`
- `scripts/agento.test.mjs`
- `scripts/merge-state.test.mjs` (new)
- `.github/prompts/ship.prompt.md`
- `skills/agento/commands/ship.md`
- `.github/instructions/delivery-policy.instructions.md`
- `.github/instructions/concurrent-delivery.instructions.md`
- `docs/commands.md`
- `CHANGELOG.md`
- `extension/cli/**` (generated)

## Risks

- **A required check that never reports blocks the ship until a human re-triggers
  it.** That is the correct outcome. The `merge-blocked` message names the context
  and says to re-trigger it (for example, redeploy) and then re-send ship. No code
  change or re-review is needed.
- **Lifecycle label while blocked.** The roadmap stays `complete` with the PR open,
  which `deriveLifecycle` labels `shipped`. Its derived next action, re-sending
  `/agento ship`, is the right one. Introducing a new lifecycle value would ripple
  into the extension and the canvas, so it is out of scope. A Follow-up records the
  label.
- **Ruleset API access.** `gh api …/rules/branches/<b>` needs only read access. On
  any error, treat the result as "unknown required contexts". Ship then reports
  `merge-blocked` with gh's reason instead of failing, and never guesses.
- **Builder step wording drift.** The reopen step text is generated, so tests pin the
  exact lines and the idempotency on a second reopen.
- **Concurrent delivery.** No open PRs touch these files today. Integrate
  `origin/main` before every push (`step-commit`).

## Out of scope

- Making soshiki's Vercel integration post its status, which is project
  configuration and not Agento. Unblocking soshiki#541 itself is an operational step
  for the user: re-trigger the `Vercel` check, then `/agento ship
  dashboard-usage-performance` after a fresh review.
- A new lifecycle value for "complete but PR open".
- Changing `scripts/wait-for-checks.sh` semantics. Required-context awareness lives in
  ship.
- Auto-merging or using `--admin` / `--auto` (policy §7).

## Acceptance checklist

- [ ] The exposing regression tests in `scripts/agento.test.mjs` whose names end in
      `(#132 ship-merge-refusal-loop)` fail at the planning base (recorded on roadmap
      step 1.1) and pass after the fix. Verify with
      `node --test --test-name-pattern='#132 ship-merge-refusal-loop' scripts/agento.test.mjs`.
- [ ] A merge refused as `the base branch policy prohibits the merge`, or a `BLOCKED`
      PR after green checks, never yields `pr-conflicting` and never reopens the
      roadmap. Within the grace it returns `status: pending` (exit 2) naming the
      missing required contexts. After the grace it returns `status: blocked`,
      `reason: merge-blocked`, with `next: ["/agento ship <slug>"]`. The roadmap and
      review.md are unchanged. Verified by the #132 tests.
- [ ] `scripts/merge-state.test.mjs` covers `classifyMergeRefusal` for gh v2.45.0's
      BLOCKED, BEHIND, DIRTY, draft, and unknown wordings, `requiredContexts` for
      ruleset-only, classic-only, both, and 404, and `missingRequired` for absent,
      pending, failed, and complete contexts.
- [ ] A genuine conflict (DIRTY refusal, or DIRTY/CONFLICTING at `checks`) and
      `checks-failed` reopen the roadmap to `status: in-progress` with an added
      `## Phase N: Ship reopen (<date>)` step named by `next-step`. A second reopen
      adds no duplicate step. In the owner build window, `agento.mjs next` derives
      `/agento build-<type> <slug>`, and `session` `allowed` contains it and
      `/agento ap <slug>`. Verified by the #132 tests and the updated
      `reopenRoadmap` unit test.
- [ ] Ship's rejection JSON after a reopen has `allowed` equal to the primary row for
      the post-reopen lifecycle, which contains no `/agento new-feature`, and an
      `elsewhere` entry equal to `rejectTo`. Verified by the #132 tests.
- [ ] `ship.prompt.md` and `skills/agento/commands/ship.md` are byte mirrors. Both
      describe the `in-progress` reopen, the `merge-blocked` mapping, and
      `checks-failed`. Delivery-policy §9, concurrent-delivery, `docs/commands.md`,
      and `CHANGELOG.md` are updated. `node --test tests/customizations.test.mjs`
      passes.
- [ ] `extension/cli/` is regenerated and includes `merge-state.mjs`. The command
      `cd extension && npm run test:unit` passes.
- [ ] Full gate: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'
      'canvas/**/*.test.mjs'` exits 0 with no failures, and
      `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` exits 0.
- [ ] A live read-only check classifies david-perry-software/soshiki#541 as blocked
      by the missing required context `Vercel`, or records its then-current state.
      It runs the new helpers against `gh api`/`gh pr view` output, never
      `gh pr merge`, and is saved under `evidence/`.

## Resolution

**Root cause.** `/agento ship` classified every `gh pr merge` refusal as a conflict:
a PR GitHub reports as `BLOCKED` because a required status check never reported
(e.g. soshiki#541's missing `Vercel` status) was reported as `pr-conflicting` and
reopened the roadmap. Separately, whenever ship *did* reopen the roadmap it set
`status: in-review`, so the build window — whose lifecycle was `approved` — routed
`/agento continue` back to review or ship instead of to the Builder. The loop: ship
says "fix in the build window", the build window says "approval is current, ship
again", and ship refuses again.

**What changed.**

- `scripts/merge-state.mjs` (new, pure, no I/O): `classifyMergeRefusal` (gh's reason
  text first, `mergeStateStatus` fallback), `requiredContexts` (ruleset + classic
  protection union; a 404 or empty result counts as none), and `missingRequired`
  (absent / pending / failed). Covered by `scripts/merge-state.test.mjs`.
- `scripts/agento.mjs`: a `ghRequiredContexts(cwd, nwo, branch)` wrapper (any error
  → `{ known: false }`, never a failure); ship's `checks`/`merge-code` phases now
  re-read the PR, and a `BLOCKED` PR — or a refusal classified `blocked` — waits
  within a 10-minute grace for the missing required checks (`pending` naming them),
  then stops `blocked` / `merge-blocked` without reopening the roadmap or touching
  review.md. A `behind` refusal integrates and returns `pending`; a `conflict`
  refusal keeps the reopen; `other` keeps `gh-error`.
- `scripts/delivery-roadmap-resolver.mjs`: `reopenRoadmap` now reopens to
  `status: in-progress` and appends a `## Phase N: Ship reopen (<date>)` section with
  one `(added <date>)` step per code, pointed at by `next-step`, idempotently.
  `in-progress` gives lifecycle `building`, so the build window routes to the
  Builder with no `session-state.mjs` change (confirmed, step 3.2).
- Ship's rejection receipt for a reopen or `integration-conflict` now derives
  `allowed` from the primary row for the post-rejection lifecycle and sets
  `elsewhere` to the exact `rejectTo` command/window.
- Prompts, policy, and docs: `ship.prompt.md` and its byte mirror
  `skills/agento/commands/ship.md`, delivery-policy §9, concurrent-delivery,
  `docs/commands.md`, `CHANGELOG.md`, and the regenerated `extension/cli/` (now
  including `merge-state.mjs`).

**Proof.** The three exposing tests in `scripts/agento.test.mjs` named
`(#132 ship-merge-refusal-loop)` fail at the planning base and pass now:
`node --test --test-name-pattern='#132 ship-merge-refusal-loop'
scripts/agento.test.mjs` exits 0 (3/3). The full gate is green:
`node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'
'canvas/**/*.test.mjs'` → 815/815 (`# fail 0`),
`shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` → exit 0, and
`cd extension && npm run test:unit` → 251/251. A live read-only check of
david-perry-software/soshiki#541 classifies it `blocked` with `Vercel` absent
(`evidence/step-5-2-soshiki-541-classification.txt`).
