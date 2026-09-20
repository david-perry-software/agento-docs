# Review: pr-cross-linking-deprecation

Verdict: request-changes

## Acceptance checklist results

- [x] The exposing regression test in `tests/customizations.test.mjs` fails before the fix and passes after it.
  - Evidence: replaying the branch test against an isolated `origin/main` archive exits 1 with `23` passing and the new test failing on the three stale guidance locations; the current branch exits 0 with `24` passing.
- [x] No prompt or agent guidance instructs `gh pr edit --body` for PR cross-linking.
  - Evidence: the current branch's literal roadmap search returns no matches, and `tests/customizations.test.mjs` enforces the absence across every prompt and agent.
- [ ] The replacement instructions include an idempotent REST PATCH example.
  - Evidence: the examples guard with `grep -Fq`, but their body expression is malformed: evaluating `body="${current_body}$'\n\nCompanion PR: ...'"` yields the literal text `$'\n\nCompanion PR: ...'` instead of newline-separated body content.
- [x] `node --test tests/customizations.test.mjs` exits 0.
  - Evidence: independent fresh run on 2026-09-20 reported `24` passing, `0` failing.

## Plan vs implementation

The implementation is scoped to the planned prompt, agent, command-mirror, and regression-test files. It removes the deprecated command and uses REST PATCH behind a URL-presence guard, but the shell quoting does not produce the intended body text. The full Node suite passes (`222/222`), shellcheck exits 0, and `git diff --check` exits 0; none exercises the rendered REST body.

## Roadmap audit

Steps 4.1-4.3 are supported by the artifact history and the fresh focused test run. Steps 2.1 and 2.2 named grep patterns containing `pulls/.*/-X`, which both exited 1 even though the implementation was present; their verification text was repaired to the matching `pulls/.* -X` form and re-run successfully. Added unticked step 4.4 for the newly discovered body-rendering defect. No manual or post-ship steps are present.

## Findings

- [ ] Major: every new REST PATCH example constructs the body with ANSI-C quoting inside a double-quoted word, for example `.github/agents/delivery-planner.agent.md:174` and `.github/prompts/ship.prompt.md:158`. In zsh this renders `Existing body$'\n\nCompanion PR: ...'`, so the workflow writes shell syntax into the PR body instead of the intended blank line and label. The same defect is copied into all four command mirrors. Move the ANSI-C quoted segment outside the double quotes (or construct the body with `printf`) and add a regression check that evaluates the rendered value.

## Follow-ups

- None.
