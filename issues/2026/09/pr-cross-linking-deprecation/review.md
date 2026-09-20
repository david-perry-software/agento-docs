# Review: pr-cross-linking-deprecation

Verdict: approve

## Acceptance checklist results

- [x] The exposing regression test in `tests/customizations.test.mjs` fails before the fix and passes after it.
  - Evidence: the branch test copied into an isolated `origin/main` archive exited 1 with `23` passing and `2` failing, identifying three stale `gh pr edit --body` locations and zero REST PATCH examples; the branch run exited 0 with `25` passing and `0` failing.
- [x] No prompt or agent guidance instructs `gh pr edit --body` for PR cross-linking.
  - Evidence: an independent scan of `.github/prompts`, `.github/agents`, and `commands` found neither `gh pr edit --body` nor the prior malformed `body="${current_body}$...` form. The focused suite enforces the prompt and agent rule.
- [x] The replacement instructions include an idempotent REST PATCH example.
  - Evidence: all nine examples guard the append with `grep -Fq`. An independent evaluator discovered the five source examples and four command mirrors, rendered each expression in both Bash and Zsh, and confirmed `Existing body` is followed by two real newline bytes and the expected label, with no literal ANSI-C quote syntax. Each command mirror's PATCH expression matches its source prompt.
- [x] `node --test tests/customizations.test.mjs` exits 0.
  - Evidence: the independent round-two run reported `25` passing, `0` failing.

## Plan vs implementation

The implementation matches the plan and remains confined to the planner agent, four prompt sources, four command mirrors, and the customization regression suite. The REST PATCH examples preserve the existing body, avoid duplicate links, and now place ANSI-C newline quoting outside the double-quoted body word. No undocumented source changes were found.

Verification on 2026-09-20:

- `node --test tests/customizations.test.mjs` -> exit 0, `25/25` passing.
- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` -> exit 0, `223/223` passing.
- `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` -> exit 0.
- `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` -> exit 0.
- `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` -> exit 0.
- `git diff --check origin/main...HEAD` -> exit 0.
- PR #63 `ci/test` -> successful, with no failing or pending checks.

## Roadmap audit

All ten ticked steps are supported by the implementation, artifact history, and fresh verification. Step 4.4 is specifically supported by the nine-example Bash/Zsh rendering assertion, the stale-pattern scan, source-to-mirror expression comparison, and focused suite. The exact roadmap grep checks for steps 2.1 and 2.2 both exit 0. No false ticks, missing-work steps, manual steps, or post-ship exceptions were found; `roadmap.md` was not changed and remains `status: in-review`.

## Findings

None.

## Follow-ups

None.
