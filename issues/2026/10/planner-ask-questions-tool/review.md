# Review: planner-ask-questions-tool

Verdict: approve

Reviewed 2026-10-07 by the 🔍 Agento Reviewer (Autopilot review round 1 of 3) at
product `e8d5c14` and companion `91712e0`, both on `issue/planner-ask-questions-tool`.
`origin/main` is an ancestor of both HEADs, and neither half is behind its remote.
Code PR #91 (draft, CI `test` SUCCESS), companion PR agento-docs #28 (draft), issue
#90 open.

Skills consulted: `agent-customization` (built-in VS Code skill) for the `.agent.md`
`tools:` semantics. The project has no `.agents/skills/` and no AGENTS.md skills table,
so no project skill matches.

## Acceptance checklist results

1. **Exposing tests fail before and pass after — pass.**
   - Before: `origin/main` sources plus this branch's
     `tests/customizations.test.mjs`, extracted with `git archive`, then
     `node --test tests/customizations.test.mjs` → exit 1. Both
     `(#90 planner-ask-questions-tool)` tests fail: `not ok 16` (tool backing) and
     `not ok 17` (§10 recommended choice).
     - A third failure, `not ok 31` (no `model:` line), comes from the temporary
       directory not being a git repository (`git … ls-tree` → "not a git
       repository"). It is not a regression.
     - This matches roadmap 1.3, which recorded 30/32 at `6df9e2c` in a real
       checkout.
   - After: `node --test tests/customizations.test.mjs` at `e8d5c14` → exit 0,
     `# tests 32 / # pass 32 / # fail 0`. `ok 16` and `ok 17`.
2. **Planner and Architect list `vscode/askQuestions` — pass.**
   - `delivery-planner.agent.md` line 5:
     `tools: [read, search, edit, execute, web, agent, browser, vscode/askQuestions]`
   - `initiative-architect.agent.md` line 5:
     `tools: [read, search, edit, execute, agent, vscode/askQuestions]`
   - VS Code diagnostics report "No errors found" for both files, so there is no
     unknown-tool warning.
   - The name is backed by VS Code 1.136.0's own `legacyToolReferenceFullNames` and
     the `AskUserQuestion → vscode/askQuestions` mapping
     ([evidence/vscode-askquestions-tool.txt](evidence/vscode-askquestions-tool.txt)).
3. **§10 recommended-choice rule — pass.**
   `delivery-policy.instructions.md` §10:
   - The vocabulary bullet names `vscode/askQuestions` and keeps the
     ``- `ask-questions` — `` shape, so the Needs/Fallback vocabulary test still
     passes.
   - The `ask-questions` standard fallback bullet ends "each question still carries
     its recommended choice (below)".
   - The new `**Recommended choice.**` paragraph covers:
     - 2–4 options, exactly one recommended, open-ended questions included, and free
       text allowed
     - with the tool, the recommended option is listed first with
       `recommended: true`
     - in the fallback, lettered options with the recommended one bold and suffixed
       `(recommended)` with a one-line reason
     - answers retained verbatim
   - It does not promise the carousel to subagents. It sends them to the fallback,
     which is consistent with plan Risks.
4. **Citations and mirrors — pass.**
   - `grep -rn "ask-questions tool"` finds these files, and every mention cites
     `§10 recommended choice`:
     - the Planner (line 62) and Architect (line 78)
     - `agento-init.prompt.md` lines 46, 150, 206, and 271
     - `install-skills.prompt.md` line 49
   - `cmp` shows `commands/agento-init.md` and `commands/install-skills.md` are
     byte-identical to their prompts.
   - The focused suite passes, including the mirror assertion.
5. **Scoped gate — pass.**
   - Full suite: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → exit
     0, `# tests 288 / # pass 288 / # fail 0` (286 baseline + 2).
   - `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` → exit 0.
   - `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh <
     tests/guard-fixtures-companion.txt` → exit 0.
   - `git diff --name-only origin/main...HEAD | grep -c '\.sh$'` → 0.
   - `command -v shellcheck` fails, so shellcheck is still unavailable, as in the
     recorded baseline (exit 127). No shell file changed, so there is nothing for it
     to lint.
6. **Live carousel — pass.**
   [evidence/step-3-4-planner-carousel.png](evidence/step-3-4-planner-carousel.png)
   was viewed and shows:
   - a chat with "Agento Planner" selected in the picker, on branch
     `issue/planner-ask-questions-tool`
   - the "Asking a question (README badge type)" progress line
   - the VS Code question carousel "Which badge should be added to the README?" with
     option 1 "CI build status" pre-selected (checkmark), options 2–3, a custom-answer
     field, and Submit

   It is not a numbered list, and no secrets are visible. This is the user's §3
   evidence. Re-driving it requires a fresh user-facing chat, which a subagent cannot
   open (plan Risks).
7. **CHANGELOG — pass.** `CHANGELOG.md` `## Unreleased` opens with a `**Fixed.** …
   (#90)` entry describing the tool fix, the §10 rule, the citations, and the tests.

## Plan vs implementation

- Implementation matches the Approach step for step. The 9 files touched equal the
  plan's file list exactly. There is no `scripts/` or `extension/` change, so no
  `copy-cli` is needed.
- The single tool-name constant `ASK_QUESTIONS_TOOL` and the `checked >= 2` guard are
  as planned.
- Planner interpretations confirmed:
  - `continue.prompt.md` declares `ask-questions` but has no "ask-questions tool"
    sentence and no `tools:` list, so neither test applies to it.
  - The plugin manifest (`.claude-plugin/plugin.json`) points `agents` at
    `.github/agents`, so plugin installs get the fixed `tools:` lines too.
  - `templates/` holds no agent files.
- No undocumented changes.

## Roadmap audit

All 11 boxes are ticked. Each one was spot-checked against the code and the commands
above:

- 1.1/1.2: both tests are present at `tests/customizations.test.mjs` lines 338–374.
- 1.3: reproduced independently, as described above.
- 2.1–2.4: in the diff.
- 3.1–3.3: re-run, with identical counts.
- 3.4: `(manual)`, with its linked evidence file present and dated.

No falsely ticked boxes and no missing steps, so no repairs were made.

## Findings

No blocking, major, or minor findings. Nits:

1. **Nit — citation test granularity.** `tests/customizations.test.mjs` line 368
   checks the `§10 recommended choice` phrase once per file, not once per
   "ask-questions tool" sentence. Today every sentence cites it (`agento-init` has
   4/4). A future added sentence in an already-citing file would pass unchecked.
   Acceptable as is, because the plan specified file-level.
2. **Nit — ragged line wraps.** The in-place rewording left short lines:
   - `delivery-planner.agent.md` line 63 ("Retain the answers verbatim for")
   - `initiative-architect.agent.md` line 79
   - `agento-init.prompt.md` lines 151 ("AGENTS.md already has an") and 207
     ("whether to create a")
   - `install-skills.prompt.md` line 50

   This is cosmetic only; the rendered Markdown is unaffected.
3. **Nit — one-option recommendation in `agento-init` step 2.** The companion-name
   question names only `<repo>-docs` as the recommended option, while §10 asks for
   2–4 concrete options. Free text is allowed, and a name question has few natural
   alternatives, so the general §10 rule still governs at runtime.

## Follow-ups

- Install shellcheck on the development machine (or in CI) so the AGENTS.md shell
  lint baseline is runnable again. It has been exit 127 since planning.
- Consider a test or `doctor` note that flags `tools:` entries VS Code no longer
  recognizes, to guard the `vscode/askQuestions` legacy-name drift risk in plan
  Risks.
