```yaml
status: in-progress
branch: issue/ship-merge-refusal-loop
last-updated: 2026-10-25
next-step: "4.4 regenerate the extension CLI copy and run extension unit tests"
github-issue: "#132"
artifact-pr: "#68"
```

## Phase 1: Expose the defect

- [x] 1.1 In `scripts/agento.test.mjs` add tests whose names end in `(#132 ship-merge-refusal-loop)`, modelled on [evidence/repro.test.mjs](evidence/repro.test.mjs).
  - (a) **BLOCKED refusal.** Fixture: `shippable(fixture, "widget")` and `shipStub` with a PR that is `mergeable: "MERGEABLE"`, `mergeStateStatus: "BLOCKED"`, `rollups: PASSING`, and `refuseMerge: "X Pull request #15 is not mergeable: the base branch policy prohibits the merge."`.
    - Stub `gh api …/rules/branches/main` to require the contexts `Unit tests` and `Vercel`.
    - Assert the confirm send is not `pr-conflicting` and has no `roadmap-reopened`.
    - With the head commit inside the grace, assert `status: "pending"` (exit 2) and a message naming `Vercel`.
    - With the head commit older than the grace, assert `status: "blocked"`, `reason: "merge-blocked"`, `next: ["/agento ship widget"]`, the roadmap still `status: complete` on `origin/<branch>`, and review.md unchanged.
  - (b) **DIRTY refusal**, with `refuseMerge` set to the default `cannot be cleanly created` wording.
    - Assert the roadmap on `origin/<branch>` is `status: in-progress` and has a `## Phase N: Ship reopen (<date>)` step that `next-step` names.
    - Assert `agento.mjs next` in the owner build window derives `/agento build-feature widget`, and `session` `allowed` contains it and `/agento ap widget`.
    - Assert ship's JSON `allowed` excludes `/agento new-feature` and `elsewhere` contains `{ command: "/agento build-feature widget", window: "build" }`.
  - (c) **`checks-failed`** reopens to `in-progress` with the fix-the-check step.
  - verify: `node --test --test-name-pattern='#132 ship-merge-refusal-loop' scripts/agento.test.mjs > /tmp/smrl-1-1.txt 2>&1; echo "exit=$?"` prints `exit=1`, and every `not ok` line in `/tmp/smrl-1-1.txt` names a #132 test. Record the `# tests` / `# pass` / `# fail` counts on this line. — 2026-10-25: exit=1, # tests 3, # pass 0, # fail 3 (all three `not ok` lines name a #132 test).

## Phase 2: Classify merge refusals

- [x] 2.1 Create `scripts/merge-state.mjs`, a pure module with no I/O, exporting three functions, and cover them in a new `scripts/merge-state.test.mjs`.
  - `classifyMergeRefusal(stderr, mergeStateStatus)` returns `conflict`, `behind`, `blocked`, or `other`. It matches gh's reason text first and falls back to `mergeStateStatus`.
  - `requiredContexts(rulesJson, protectionJson)` returns the union of ruleset and classic required contexts. A 404 or an empty result counts as none.
  - `missingRequired(required, rollup)` returns absent and pending contexts separately from failed ones.
  - The test table uses gh v2.45.0's BLOCKED, BEHIND, DIRTY, draft, and unknown wordings from [evidence/gh-2.45.0-merge-refusal-wording.txt](evidence/gh-2.45.0-merge-refusal-wording.txt), ruleset-only, classic-only, both, and 404 rules responses, and absent, pending, failed, and complete contexts.
  - verify: `node --test scripts/merge-state.test.mjs` exits 0.
- [x] 2.2 In `scripts/agento.mjs`, add a `ghRequiredContexts(cwd, nwo, branch)` wrapper over `gh api repos/<nwo>/rules/branches/<branch>` and `gh api repos/<nwo>/branches/<branch>/protection/required_status_checks`. Any error yields `{ known: false }`, never a failure. Extend `shipStub` in `scripts/agento.test.mjs` to serve both paths, including a 404 for classic protection.
  - verify: `node --test --test-name-pattern='ghRequiredContexts|requiredContexts' scripts/agento.test.mjs scripts/merge-state.test.mjs` exits 0.
- [x] 2.3 In ship's `checks` and `merge-code` phases (`scripts/agento.mjs` around L3361-L3392), handle the merge state as follows:
  - After `waitChecks` returns 0, re-read the PR. When it is `BLOCKED`, or a `gh pr merge` refusal classifies as `blocked`:
    - If required contexts are missing or pending within 10 minutes of the head commit's `committedDate`, call `pending("checks", …)` naming them.
    - Otherwise finish with `status: "blocked"` and `reason: "merge-blocked"`. The `message` names each missing or failing context, or the base branch policy when none is missing. `next` is `/agento ship <slug>`. Do not reopen.
  - A `behind` refusal calls `integrate()` and returns `pending`.
  - A `conflict` refusal keeps the reopen.
  - An `other` refusal keeps `gh-error`.
  - verify: test 1.1(a) passes. The #107 tests `ship --confirm at checks with a conflicting PR reopens…` and `ship --confirm: a merge refused as not mergeable reopens…` still pass, with updated expectations for the new reopen status only. `node --test scripts/agento.test.mjs` exits 0 apart from the still-open 1.1(b) and 1.1(c).

## Phase 3: Route reopened work to the Builder

- [x] 3.1 Change `reopenRoadmap` in `scripts/delivery-roadmap-resolver.mjs` so a reopen hands the work back to the Builder.
  - Set `status: in-progress` and `last-updated`.
  - Append, or reuse when already present, `## Phase N: Ship reopen (<date>)` with one `(added <date>)` step per code: `pr-conflicting` (sync and hotspot recipes), `companion-pr-conflicting` (companion half), and `checks-failed` (fix `<name>`). Each step carries a `verify:`.
  - Point `next-step` at the first new step. Keep the accepted-at-ship removal and keep the function idempotent.
  - Update the existing `reopenRoadmap` unit tests in `scripts/agento.test.mjs` (around L7070-L7090) to the new output.
  - verify: `node --test --test-name-pattern='reopenRoadmap|#132 ship-merge-refusal-loop' scripts/agento.test.mjs` passes 1.1(b) and 1.1(c) on the roadmap assertions.
- [x] 3.2 Confirm the build-window derivation needs no `session-state.mjs` change: `in-progress` gives lifecycle `building`, and `next` derives `build-<type>` even with a stale `Verdict: approve` in review.md. If it does need a change, make the minimal one in `scripts/session-state.mjs` and add a focused case in `scripts/session-state.test.mjs`. — 2026-10-25: confirmed no change needed; `in-progress` → `building` → `build-<type>` already holds, and 1.1(b)'s `next`/`allowed` assertions pass.
  - verify: `node --test scripts/session-state.test.mjs` exits 0, and 1.1(b)'s `next` and `allowed` assertions pass.
- [x] 3.3 Rewrite ship's rejection receipt data for rejections carrying `rejectTo` (the reopens and `integration-conflict`).
  - Set `allowed` to `deriveAllowed({ role: "primary", lifecycle: <post-reopen lifecycle>, delivery })`.
  - Set `elsewhere` to `[{ command: rejectTo.command, window: rejectTo.window, reason }]`.
  - verify: 1.1(b)'s `allowed` and `elsewhere` assertions pass. `node --test --test-name-pattern='#132 ship-merge-refusal-loop' scripts/agento.test.mjs` exits 0.

## Phase 4: Prompts, policy, and docs

- [x] 4.1 Update `.github/prompts/ship.prompt.md`, then copy it byte for byte to `skills/agento/commands/ship.md`.
  - `audit-gaps` at `resumedAt: checks` now says the roadmap is reopened to `in-progress` with an added Ship-reopen step, and to run `/agento continue` or `/agento build-<type> <slug>` in the build window, followed by `/agento ap <slug>`.
  - Add a `status: "blocked"` / `reason: "merge-blocked"` mapping: quote `message`, say nothing was reopened, re-trigger the named check, and re-send `/agento ship <slug>`.
  - Bring the `checks-failed` text in line.
  - verify: `node --test tests/customizations.test.mjs` exits 0.
- [x] 4.2 Update the policy files.
  - In `.github/instructions/delivery-policy.instructions.md` §9, the ship idempotency row reads: a conflict or failing required check reopens to `in-progress` with a Builder step, and a policy-blocked merge is `merge-blocked` and does not reopen.
  - In `.github/instructions/concurrent-delivery.instructions.md`, the `mergeStateStatus` line reads: `BLOCKED` is never a conflict (ship waits for missing required checks, then reports `merge-blocked`), and `DIRTY` goes to the Builder via `/agento continue`.
  - verify: `node --test tests/customizations.test.mjs` exits 0, and `grep -n 'in-review' .github/instructions/delivery-policy.instructions.md` shows no ship-reopen wording left.
- [x] 4.3 Update the ship section of `docs/commands.md` (L189 and L217-L228: reopen status, the new step, `merge-blocked`) and add a `CHANGELOG.md` entry under the repository's current unreleased heading convention.
  - verify: `grep -n 'merge-blocked' docs/commands.md CHANGELOG.md` shows both, and `grep -n 'reopen.*in-review' docs/commands.md` prints nothing.
- [ ] 4.4 Regenerate the extension's CLI copy with `cd extension && npm run copy-cli`.
  - verify: `diff -rq scripts extension/cli` reports only files copy-cli intentionally skips, `extension/cli/merge-state.mjs` exists, and `cd extension && npm run test:unit` exits 0. Run `npm ci` first only if dependencies are missing.

## Phase 5: Verify the whole

- [ ] 5.1 Run the full gate.
  - verify: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` exits 0 with `# fail 0` (baseline 808/808 plus the new tests). `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` exits 0, using the ShellCheck release binary when it is not on PATH. Record both on this line.
- [ ] 5.2 Do a live read-only check against the real case. Feed `gh api repos/david-perry-software/soshiki/rules/branches/main` (plus the classic protection, which is 404) and the `statusCheckRollup` of david-perry-software/soshiki#541's head into the `scripts/merge-state.mjs` helpers through `node -e`. Never run `gh pr merge`. Save the output as `evidence/step-5-2-soshiki-541-classification.txt`.
  - verify: the file shows `blocked` with `Vercel` missing, or records the PR's then-current state if it has since changed.
- [ ] 5.3 Integrate `origin/main` in both halves with `agento.mjs sync issue ship-merge-refusal-loop`, write plan.md `## Resolution` (root cause, what changed, proof the #132 tests pass), and set `status: in-review`.
  - verify: `sync` reports no `integration-conflict`, `git status --porcelain --untracked-files=all` is empty in both halves, and `gh pr view --json mergeStateStatus` is not `DIRTY`.

## Follow-ups

- `deriveLifecycle` labels a `complete` roadmap with an OPEN code PR as `shipped` (seen after `merge-blocked`). Consider a distinct "merging" lifecycle so window rows read correctly (extension and canvas impact).
