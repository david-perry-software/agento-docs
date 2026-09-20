# Review: pr-cross-linking-deprecation

Verdict: approve

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

The roadmap was corrected to include the review-remediation steps, those steps were executed, and the final validation suite was re-run successfully. The issue record now reflects the completed state accurately.

## Findings

- None. The earlier review findings were process-only issues in the review artifact and roadmap record, and they were resolved by explicitly documenting the follow-up work and completing the corrective pass.

## Follow-ups

- None.
