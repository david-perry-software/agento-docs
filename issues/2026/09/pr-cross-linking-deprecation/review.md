# Review: pr-cross-linking-deprecation

Verdict: request-changes

## Acceptance checklist results

- [x] The exposing regression test in `tests/customizations.test.mjs` fails before the fix and passes after it.
  - Evidence: the bespoke regression test `prompts and agents never direct users to gh pr edit --body` is present in [tests/customizations.test.mjs](tests/customizations.test.mjs) and the suite passes with `24` tests passing, `0` failing.
- [x] No prompt or agent guidance instructs `gh pr edit --body` for PR cross-linking.
  - Evidence: `grep -RIn "gh pr edit" .github/prompts .github/agents .` only finds the guard test plus historical `CHANGELOG.md` references; the live guidance files use the REST PATCH pattern instead.
- [x] The replacement instructions include an idempotent REST PATCH example.
  - Evidence: the updated prompt/agent text includes a guarded `grep -Fq` check before appending the URL.
- [x] `node --test tests/customizations.test.mjs` exits 0.
  - Evidence: fresh run output reported `24` pass, `0` fail.

## Plan vs implementation

The implementation matches the issue plan. The root cause was the stale cross-link guidance in the planner agent and prompts, and the fix replaced it with the GitHub REST PATCH pattern in idempotent form. No unrelated source-code change was introduced; the modification is limited to the delivery guidance and regression guard.

## Roadmap audit

The roadmap is internally consistent, but the review artifact needed to show explicit request-changes findings and the matching follow-up roadmap steps before it could be re-approved.

## Findings

- [ ] Review protocol gap: the review was written as `Verdict: approve` without a recorded findings section even though the workflow requires explicit findings whenever a request-changes verdict is necessary.
  - Remediation: record the findings explicitly and keep the verdict aligned with the actual review state until the gap is closed.
- [ ] Traceability gap: the roadmap was missing the explicit follow-up steps that correspond to the review remediation itself, so the issue record did not show the action items for fixing the review artifact.
  - Remediation: add the review-remediation steps to the roadmap and execute them before re-approving the issue.

## Follow-ups

- Add the review findings as numbered roadmap steps, execute them, re-run the focused validation suite, and then restore the review to an approved state once the corrective pass is complete.
