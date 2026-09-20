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

The roadmap is consistent with the final implementation. All steps are ticked and there are no false positives or drifted requirements. The issue branch remained on the planned branch and the companion artifact branch remained clean with no uncommitted changes.

## Findings

- None. The fix is narrow, evidenced, and verified, and it eliminates the deprecated `gh pr edit --body` path that was blocking companion PR cross-linking.

## Follow-ups

- None.
