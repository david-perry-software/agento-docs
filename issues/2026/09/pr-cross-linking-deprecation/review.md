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

The roadmap needs to reflect the explicit review-remediation work before the issue record can be closed as approved.

## Findings

- [ ] Review protocol gap: the issue record was still marked as `approve` even though the review flow requires the explicit request-changes findings to be recorded when the artifact state is being corrected.
  - Remediation: write the findings explicitly and keep the verdict aligned with the actual review state during the corrective pass.
- [ ] Traceability gap: the roadmap did not yet include the explicit follow-up steps for the review-remediation work itself, so the issue record did not show the action items needed to finish the review cycle.
  - Remediation: add each finding as an ordered roadmap step and execute the required pass before re-issuing approval.

## Follow-ups

- Add the review findings as roadmap steps, complete the corrective pass, re-run the focused validation, and then restore the final verdict to `approve` once the issue record is consistent.
