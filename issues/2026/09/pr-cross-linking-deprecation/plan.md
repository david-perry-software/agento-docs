# PR cross-linking deprecation fix

## Problem

Companion-mode delivery workflows cross-link the code PR and artifact PR by instructing users to run `gh pr edit --body`. GitHub now routes that path through a deprecated Projects (classic) GraphQL flow, so the command fails even when the user is authenticated and the repo is otherwise valid. That breaks the planner's cross-link step and blocks the delivery handoff without any operator action that should be required.

The bug is confined to the guidance files and automation narrative; it is not a product-code defect. The fix must keep the workflow idempotent and avoid re-appending the same URL on resume.

## Evidence

GitHub issue: #62

Verified on 2026-09-20 in the working tree at `/home/david/DP/agento-worktrees/plan-20260920-202545`.

Reproduction evidence:

- `gh pr edit <n> --body` is still named in the prompt/agent guidance and is the exact command path that triggers the GraphQL Projects-classic deprecation.
- The command is not a product-code bug; it occurs in the Agento customizations and documentation that automate the PR handoff.
- The fix is validated with the repository's focused customization suite: `node --test tests/customizations.test.mjs`.
- Before the fix, the issue was tracked by the exact deprecation symptom and by the customizations guard added to reject `gh pr edit --body`.

## Decisions

1. The correct workaround is the GitHub REST PATCH endpoint, not `gh pr edit --body`.
2. The fix must be idempotent: do not append the companion URL twice when the workflow resumes.
3. The customizations suite must enforce the no-`gh pr edit --body` rule so future regressions are caught automatically.

## Research

Skills consulted: none — no matching domain

- The root cause is a GitHub CLI/API behavior change, not a repo logic bug.
- The relevant guidance was distributed across the planner agent and the prompt files for `new-feature`, `new-issue`, `agento-init`, and `ship`.
- The fix requires both the workflow text and the repo-level guard test to agree on the same contract.
- Full-repository lint baseline recorded in this repo for the relevant scope:
  - `node --test tests/customizations.test.mjs` → exit 0
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → exit 0
  - `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` → exit 0

## Approach

1. Remove every explicit `gh pr edit --body` instruction from the affected agent/prompt guidance.
2. Replace it with the REST PATCH form that updates the PR body via `gh api repos/<owner>/<repo>/pulls/<n> -X PATCH ...`.
3. Make the update idempotent by checking if the target URL is already present before appending it.
4. Add a regression test that fails if any customization file tells the user to run `gh pr edit --body` again.
5. Verify the targeted customization suite passes.

## Risks

- Some other command flows may still have documentation or historical mentions of `gh pr edit` for other purposes; the fix is intentionally scoped to the cross-linking flow that triggers the deprecation.
- The REST PATCH flow depends on the PR body being retrieved with `gh pr view --json body --jq '.body'`; that command is stable and is the correct mechanism for idempotent body edits.

## Out of scope

- Reworking unrelated GitHub CLI behavior.
- Changing the product code path for delivery execution beyond the automation guidance.
- Any broader refactor of the planner workflow beyond the cross-linking fix.

## Acceptance checklist

- [ ] The exposing regression test in `tests/customizations.test.mjs` fails before the fix and passes after it.
- [ ] No prompt or agent guidance instructs `gh pr edit --body` for PR cross-linking.
- [ ] The replacement instructions include an idempotent REST PATCH example.
- [ ] `node --test tests/customizations.test.mjs` exits 0.

## Resolution

The root cause was the guidance itself: the customizations were telling the workflow to use `gh pr edit --body`, which triggers GitHub's deprecated Projects (classic) GraphQL code path. The fix replaces that command with a REST PATCH flow that checks whether the companion PR URL is already present before appending it. The repo-level regression guard now rejects any future `gh pr edit --body` guidance in the prompt and agent files.

Evidence for the completed state:

- `node --test tests/customizations.test.mjs` → pass, 25 tests passed, 0 failed.
- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → pass, 223 tests passed, 0 failed.
- The relevant guidance files and command mirrors use adjacent shell words so ANSI-C quoting renders a real blank line in the REST PATCH body.
- The customization tests reject `gh pr edit --body` and evaluate every rendered REST PATCH body to prevent literal ANSI-C syntax from reaching GitHub.
