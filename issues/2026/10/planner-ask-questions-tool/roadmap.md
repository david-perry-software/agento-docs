```yaml
status: in-review
branch: issue/planner-ask-questions-tool
last-updated: 2026-10-07
next-step: ""
github-issue: "#90"
artifact-pr: "#28"
```

## Phase 1: Exposing regression tests

- [x] 1.1 Add to `tests/customizations.test.mjs` the test `every agent or tool-restricted
  prompt that needs ask-questions lists vscode/askQuestions (#90
  planner-ask-questions-tool)`:
  - Define a constant `ASK_QUESTIONS_TOOL = "vscode/askQuestions"`.
  - For each agent, and each prompt with its own `tools:` frontmatter, whose
    `declarations().needs` include `ask-questions`, assert that `tools` includes the
    constant.
  - Assert that at least 2 files were checked.

  — verify: `node --test tests/customizations.test.mjs` exits nonzero, and the
  failure names `delivery-planner.agent.md` and `initiative-architect.agent.md`.
- [x] 1.2 Add the test `ask-questions clarification always offers a §10 recommended
  choice (#90 planner-ask-questions-tool)`:
  - §10 of `delivery-policy.instructions.md` contains a `**Recommended choice.**`
    paragraph that mentions `recommended: true` and `(recommended)`.
  - Every file in `.github/prompts/`, `.github/agents/`, and `commands/` whose text
    matches `/ask-questions tool/` also contains the phrase `§10 recommended choice`.
  - That set includes the Planner and the Architect.

  — verify: `node --test tests/customizations.test.mjs` exits nonzero, and the new
  test fails on the missing §10 paragraph.
- [x] 1.3 Record the exposing run on this line: failing test names, assertion
  messages, and the pass/fail counts — verify: the run's captured status is nonzero,
  only the two #90 tests fail, and every pre-existing test still passes.
  Recorded 2026-10-07 at product `6df9e2c` (fix not yet applied):
  `node --test tests/customizations.test.mjs` exit **1**, `# tests 32 / # pass 30 /
  # fail 2`; all 30 pre-existing tests pass.
  - `not ok 16 - every agent or tool-restricted prompt that needs ask-questions lists
    vscode/askQuestions (#90 planner-ask-questions-tool)`: "files that need
    ask-questions but do not list vscode/askQuestions in tools:" →
    `delivery-planner.agent.md tools=[read, search, edit, execute, web, agent,
    browser]`, `initiative-architect.agent.md tools=[read, search, edit, execute,
    agent]`.
  - `not ok 17 - ask-questions clarification always offers a §10 recommended choice
    (#90 planner-ask-questions-tool)`: "delivery-policy §10 must define a
    **Recommended choice.** paragraph".

## Phase 2: Fix

- [x] 2.1 Add `vscode/askQuestions` to the `tools:` line of
  `.github/agents/delivery-planner.agent.md` and
  `.github/agents/initiative-architect.agent.md`. Nothing else in the frontmatter
  changes — verify: the 1.1 test passes, and VS Code diagnostics (`get_errors`) for
  both files report no unknown-tool warning.
- [x] 2.2 In `.github/instructions/delivery-policy.instructions.md` §10:
  - Reword the `ask-questions` vocabulary bullet to name `vscode/askQuestions`, in
    the same ``- `ask-questions` — `` shape.
  - Add the `**Recommended choice.**` paragraph after the standard fallbacks. Every
    clarifying question offers 2–4 concrete options, exactly one recommended,
    open-ended questions included, and free text stays allowed.
  - With the tool: `recommended: true` on that option, listed first.
  - In the fallback: lettered options, the recommended one bold and suffixed
    `(recommended)` with a one-line reason.
  - Answers are retained verbatim, with the recommended choice noted.
  - Point the `ask-questions` standard fallback bullet at the paragraph.

  — verify: the §10 part of the 1.2 test passes, and the existing "Needs: and
  Fallback: from the §10 vocabulary" test still passes.
- [x] 2.3 Cite `§10 recommended choice` in Planner step 2 and Architect step 3, and
  in every "ask-questions tool" sentence of `.github/prompts/agento-init.prompt.md`
  and `.github/prompts/install-skills.prompt.md`. Then copy those two prompts
  byte-for-byte to `commands/agento-init.md` and `commands/install-skills.md` —
  verify: `node --test tests/customizations.test.mjs` passes, including the 1.2 test
  and the "plugin commands must mirror workspace prompts" assertion.
- [x] 2.4 Add a `**Fixed.**` entry under `CHANGELOG.md` `## Unreleased` describing the
  tool-list fix and the recommended-choice rule, ending `(#90)` — verify:
  `grep -n "#90" CHANGELOG.md` shows the entry under `## Unreleased`.

## Phase 3: Verification

- [x] 3.1 Run the full suite, `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`,
  and record the counts — verify: exit 0, and `# pass` equals 286 plus the new
  tests, with `# fail 0`.
  Recorded 2026-10-07 at product `e8d5c14`: exit **0**, `# tests 288 / # pass 288 /
  # fail 0` (286 baseline + the 2 #90 tests); focused
  `node --test tests/customizations.test.mjs` exit 0, 32/32.
- [x] 3.2 Run both guard smokes,
  `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` and
  `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt`
  — verify: both exit 0.
  Recorded 2026-10-07 at product `e8d5c14`: guard smoke exit **0**, companion guard
  smoke exit **0**.
- [x] 3.3 Complete the scoped lint gate (plan `## Research`). Run
  `git diff --name-only origin/main...HEAD` and record that no `*.sh` file changed.
  If `command -v shellcheck` succeeds, run
  `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` and compare it with the
  baseline (exit 127, not installed). Otherwise record it as still unavailable — the
  scoped gate's diff check, focused tests, and full suite stand in, and the result
  is recorded on this line — verify: no `*.sh` in the diff.
  Recorded 2026-10-07 at product `e8d5c14`: the diff lists 9 files — the two agent
  files, `delivery-policy.instructions.md`, `agento-init.prompt.md`,
  `install-skills.prompt.md`, `CHANGELOG.md`, `commands/agento-init.md`,
  `commands/install-skills.md`, `tests/customizations.test.mjs` — and **0** `*.sh`.
  `command -v shellcheck` fails: still unavailable, same as the baseline. Focused
  tests (32/32), the full suite (288/288, step 3.1), and `get_errors` on both agent
  files (no diagnostics, step 2.1) stand in.
- [x] 3.4 (manual) In the VS Code window open on this branch's worktree, start a
  **new** chat and pick the 📋 Agento Planner from the agent picker. Send: "Ask me one
  clarifying question about adding a README badge using your ask-questions tool,
  then stop without writing anything." Screenshot the question carousel, showing
  the option marked recommended, and attach it — verify: the screenshot is saved as
  `evidence/step-3-4-planner-carousel.png`, linked here, and dated. It shows the
  carousel, not a numbered list, with one option marked recommended.
  Completed 2026-10-07 00:36 by the user:
  [evidence/step-3-4-planner-carousel.png](evidence/step-3-4-planner-carousel.png).
  A fresh chat with 📋 Agento Planner selected (Claude Opus 5.5). The message sent
  was "Ask me one clarifying question about adding a README badge using your
  ask-questions tool". The chat shows "Asking a question (README badge type)" and the
  VS Code question carousel "Which badge should be added to the README?" with
  options 1 CI build status (pre-selected, the recommended default), 2 License,
  3 Latest release, 4 custom answer, and Submit. It is the carousel, not a numbered
  list, and no secrets are visible.
