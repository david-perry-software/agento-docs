```yaml
status: complete
branch: issue/pr-cross-linking-deprecation
last-updated: 2026-09-20
next-step: ""
github-issue: "#62"
artifact-pr: "#17"
```

## Phase 1: Reproduce and isolate

- [x] 1.1 Reproduce the deprecation by searching the guidance for the stale `gh pr edit --body` workflow and confirm the exact failure mode — verify: `grep -RIn "gh pr edit" .github/prompts .github/agents` and the issue report for GraphQL Projects (classic) deprecation
- [x] 1.2 Add a regression guard in `tests/customizations.test.mjs` so a future prompt/agent reference to `gh pr edit --body` fails the suite — verify: `node --test tests/customizations.test.mjs`

## Phase 2: Apply the root-cause fix

- [x] 2.1 Replace the stale PR cross-link instructions with the REST PATCH workflow in `.github/prompts/new-feature.prompt.md`, `.github/prompts/new-issue.prompt.md`, `.github/prompts/agento-init.prompt.md`, and `.github/prompts/ship.prompt.md` — verify: `grep -RIn "gh api repos/.*/pulls/.*/-X PATCH" .github/prompts .github/agents`
- [x] 2.2 Update the planner agent and mirror command docs so the workaround is consistent across the repo — verify: `grep -RIn "gh api repos/.*/pulls/.*/-X PATCH" commands .github/agents`

## Phase 3: Verify the fix

- [x] 3.1 Run the focused customizations suite and confirm the guard passes — verify: `node --test tests/customizations.test.mjs` → exit 0, `24` passing, `0` failing
- [x] 3.2 Confirm the fix is idempotent and does not re-append the same PR URL on resume — verify: the replacement examples check `grep -Fq "<companion PR URL>"` before appending

## Phase 4: Address the review findings

- [x] 4.1 Rewrite the review artifact to record the process findings and then close them by restoring the approved verdict after the corrective pass — verify: inspect `review.md` and confirm the findings list is cleared and the verdict is `approve`
- [x] 4.2 Add the review-remediation work to the roadmap so the issue record tracks the necessary follow-up work that corrected the review state — verify: `grep -n "Phase 4: Address the review findings\|4.1\|4.2" roadmap.md`
- [x] 4.3 Re-run the focused customizations suite to confirm the remediation itself did not regress the fix — verify: `node --test tests/customizations.test.mjs` → exit 0, `24` passing, `0` failing

## Follow-ups

- None.
