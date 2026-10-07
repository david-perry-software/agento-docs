# Planner and Architect cannot use the VS Code ask-questions UI and give no recommended choice

## Problem

The 📋 Agento Planner (`/agento new-feature`, `/agento new-issue`) and the 🏛️ Agento
Architect (`/agento new-initiative`) start every delivery by asking clarifying
questions. Both declare `Needs: terminal, ask-questions, gh, network` and tell the
model to ask "using the ask-questions tool or its declared fallback (§10)". But
neither agent is given that tool, so the VS Code question carousel never appears.
The agent always takes the §10 fallback and prints a numbered list in chat, which the
user must answer by typing free text.

The user also wants every clarifying question to come with a recommended choice, so
answering is mostly a matter of accepting or overriding a default. Nothing in the
policy or the agents asks for one today, even though the VS Code tool supports a
per-option `recommended` flag.

## Evidence

GitHub issue: #90

- **Live observation (2026-10-07, VS Code 1.136.0, product `42c420e`).** This plan's
  own planning session ran `/agento new-issue` in the 📋 Agento Planner. The
  session's tool set held no `vscode_askQuestions`. The agent emitted
  `Preflight: ask-questions missing — asking the questions as a numbered list in chat
  (§10 standard fallback)` and printed five numbered questions.
- **Static reproduction.**
  [evidence/reproduction.txt](evidence/reproduction.txt) lists every agent's
  `tools:` line and every agent that declares `ask-questions`. A one-line check that
  each such agent lists `vscode/askQuestions` exits 1:

  ```
  FAIL delivery-planner.agent.md tools=[read, search, edit, execute, web, agent, browser]
  FAIL initiative-architect.agent.md tools=[read, search, edit, execute, agent]
  check exit=1
  ```

- **Tool definition in VS Code 1.136.0.**
  [evidence/vscode-askquestions-tool.txt](evidence/vscode-askquestions-tool.txt)
  quotes excerpts from `workbench.desktop.main.js`:
  - tool id `vscode_askQuestions`, `toolReferenceName: "askQuestions"`,
    `legacyToolReferenceFullNames: ["vscode_askQuestions", "vscode/askQuestions"]`
  - option schema `recommended: { type: "boolean", description: "Mark this option as
    the recommended default." }`
  - Claude-format tool mapping `AskUserQuestion → toolEquivalent: ["vscode/askQuestions"]`
  - `runSubagent` forces `copilot_askQuestions = false` for subagents, so the tool
    can only be used by an agent the user is talking to directly.
- **Observed vs expected.**
  - Observed: clarifying questions arrive as plain chat text with no recommended
    answer.
  - Expected: they arrive in the VS Code question carousel, each with concrete
    options and exactly one marked recommended. When the tool is unavailable, the
    numbered-list fallback marks one option per question "(recommended)" and gives a
    one-line reason.
- **Root-cause hypothesis.** The agents' tool lists omit the tool:
  - `.github/agents/delivery-planner.agent.md` line 5:
    `tools: [read, search, edit, execute, web, agent, browser]`
  - `.github/agents/initiative-architect.agent.md` line 5:
    `tools: [read, search, edit, execute, agent]`

  VS Code gives a custom agent only the tools in its `tools:` list, and none of the
  aliases (`read`, `search`, `edit`, `execute`, `web`, `agent`, `browser`) covers
  `askQuestions` (agent-customization skill, `references/agents.md` "Tool Aliases").
  `tests/customizations.test.mjs` checks that `Needs:` tokens belong to the §10
  vocabulary (line 326). It never checks that a declared need is backed by the tool
  that provides it.

## Decisions

Clarifying questions asked 2026-10-07 through the §10 numbered-list fallback (the
defect itself), with the recommended choice marked. The user's answers, verbatim:
"1. b 2. a 3. a 4. a 5. a".

1. *Which agents get the tool?* a) Planner only; **b) Planner and Architect, plus a
   test so any agent or command that needs `ask-questions` must have the tool
   (recommended)**; c) every agent. — **b**
2. *What name goes in `tools:`?* **a) `vscode/askQuestions`, the name VS Code itself
   maps Claude's `AskUserQuestion` to (recommended)**; b) the short name
   `askQuestions`; c) both. — **a**
3. *Where should the "always recommend a choice" rule live?* **a) In
   delivery-policy §10, so it covers every command that asks questions (the Planner
   and Architect, plus `/agento agento-init`, `/agento install-skills` and
   `/agento continue`). In the question UI, exactly one option is marked
   `recommended: true`. In the chat fallback, one option is marked "(recommended)"
   with a one-line reason (recommended)**; b) only in the Planner and Architect
   files. — **a**
4. *What about open-ended questions with no fixed choices?* **a) Each still offers
   2–4 concrete options, one marked recommended, and free-text answers stay allowed
   (recommended)**; b) allow pure free-text questions with only a suggested default
   in the prompt. — **a**
5. *What should the regression test (named after the GitHub issue) check?* **a) Two
   checks in `tests/customizations.test.mjs`: (1) any agent, or any command with its
   own `tools:` list, that needs `ask-questions` lists `vscode/askQuestions`;
   (2) §10 and the Planner/Architect clarify steps require a recommended option
   (recommended)**; b) only the tools check. — **a**

Planner interpretations (flag in review if wrong):

- Under Decision 3 the citation reaches every file that tells the model to use "the
  ask-questions tool" (Planner, Architect, `agento-init`, `install-skills`, and
  their `commands/` mirrors), not only the Planner and Architect. Test (2) enforces
  this for all of them.
- Commands that dispatch to the built-in `agent` with no `tools:` list (`agento-init`,
  `install-skills`, `continue`) already get the default tool set, which includes
  `askQuestions`. Test (1) covers them only if they ever add a `tools:` list.

## Research

Skills consulted: `agent-customization` (built-in VS Code skill: `.agent.md`
`tools:` semantics. Omitting `tools:` gives the defaults, a list gives only those
tools, and the alias table has no ask-questions alias, so the specific tool name is
required). No project skills: the repository has no `.agents/skills/` directory and
AGENTS.md has no `## Agento` skills table.

Codebase findings (product `42c420e`):

- **Agents.** All six `.github/agents/*.agent.md` files have explicit `tools:` lists
  (line 5). Only `delivery-planner.agent.md` (line 16) and
  `initiative-architect.agent.md` (line 11) declare `ask-questions`.
  - The clarify instructions are Planner step 2, "using the ask-questions tool or
    its declared fallback (§10)" (`delivery-planner.agent.md` lines 60–64), and
    Architect step 3 (`initiative-architect.agent.md` lines 76–79).
- **Prompts.** `new-feature`, `new-issue`, and `new-initiative` dispatch to those
  agents and carry no `tools:` of their own.
  - `agento-init`, `install-skills`, and `continue` declare `ask-questions` and use
    `agent: "agent"` without `tools:`, so they get the default tool set.
  - `agento-init.prompt.md` mentions "the ask-questions tool" at lines 46, 149, 204,
    and 268. `install-skills.prompt.md` mentions it at line 49.
  - Each `commands/<name>.md` must be byte-identical to
    `.github/prompts/<name>.prompt.md` (`tests/customizations.test.mjs` lines
    538–560).
- **Policy.** `.github/instructions/delivery-policy.instructions.md` §10:
  - The vocabulary bullet `ask-questions` is at line 289. The test's
    `policyCapabilities()` (line 303) parses vocabulary bullets with
    ``/^- `([a-z0-9-]+)` — /``, so a reworded bullet must keep that shape.
  - The `ask-questions` standard fallback is at lines 308–309.
  - Nothing mentions a recommended choice.
- **Tests.** `tests/customizations.test.mjs` already has:
  - the frontmatter parser (`parseFrontmatter`, line 33), which handles flow lists
    such as `tools: [a, b]`
  - the `declarations()` helper for `Needs:`/`Fallback:` (line 315)
  - the precedent of naming regression tests after an issue, e.g.
    `(#88 ship-untracked-byproducts)` (line 348)
- **Docs.** `CHANGELOG.md` has an open `## Unreleased` section with `**Fixed.** …
  (#NN)` entries. `docs/commands.md` line 276 mentions soft needs only in general
  terms and needs no change.
- **CLI.** No `scripts/` change: `agento.mjs` `CAPABILITY_CHECKS` keeps
  `"ask-questions": []` (line 756), a chat capability `doctor` cannot probe. So
  `extension/cli/` needs no `copy-cli` refresh.

Lint baseline (policy §5):

- `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`: exit **127**
  (`shellcheck: command not found`). The only lint command AGENTS.md declares cannot
  run on this machine, so the baseline is unavailable rather than red.
- Test baseline: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`, exit
  0, `# tests 286 / # pass 286 / # fail 0`.
- Overlap: none. The delivery changes only Markdown customization files,
  `CHANGELOG.md`, and `tests/customizations.test.mjs`. It changes no shell file that
  shellcheck would lint.
- Decision: a **scoped gate**:
  - focused tests: `node --test tests/customizations.test.mjs`
  - the full test suite, compared with the 286-pass baseline
  - both guard smokes
  - VS Code diagnostics (`get_errors`) on the two agent files
  - a diff check that no `*.sh` file changed
  - if `shellcheck` becomes available, a full shellcheck run compared with this
    baseline

  There is no package lint or typecheck for Markdown and `.mjs` tests here
  (the extension's typecheck is untouched).

Concurrent deliveries: `gh pr list --state open` returns no open PRs in either
`agento` or `agento-docs` (2026-10-07), so there is no file overlap.

## Approach

1. **Exposing tests first** (`tests/customizations.test.mjs`), both named
   `(#90 planner-ask-questions-tool)`:
   - *Tool backing.* For every agent, and every prompt whose frontmatter has its own
     `tools:` list, that declares `ask-questions` in `Needs:`, the `tools:` list
     includes `vscode/askQuestions`. Keep the tool name in one constant
     (`ASK_QUESTIONS_TOOL`). The test also asserts at least two agents are checked,
     so it cannot pass with nothing to check.
   - *Recommended choice.* §10 contains a `**Recommended choice.**` paragraph that
     mentions both `recommended: true` and `(recommended)`. Every prompt, agent, and
     command mirror that mentions "ask-questions tool" also cites the rule with the
     literal phrase `§10 recommended choice`. The test asserts at least the Planner
     and Architect are among those files.
2. **Tool fix.** Add `vscode/askQuestions` to the `tools:` line of
   `delivery-planner.agent.md` and `initiative-architect.agent.md`. Nothing else in
   the frontmatter changes.
3. **Policy rule.** In delivery-policy §10:
   - Reword the vocabulary bullet to `` `ask-questions` — the structured
     ask-questions chat tool (`vscode/askQuestions` in an agent's `tools:`) for
     clarification. `` (same bullet shape).
   - Add a `**Recommended choice.**` paragraph after the standard fallbacks. Every
     clarifying question offers 2–4 concrete options, exactly one recommended, and
     open-ended questions included. Free-text answers stay allowed.
   - With the tool: the recommended option sets `recommended: true` and is listed
     first.
   - In the numbered-list fallback: options are lettered, and the recommended one is
     bold and suffixed `(recommended)` with a one-line reason.
   - Answers are retained verbatim, with the recommended choice noted.
   - The `ask-questions` standard fallback bullet points to the paragraph.
4. **Citations.** Planner step 2 and Architect step 3 say "with the ask-questions
   tool (or its declared fallback) per the §10 recommended choice". The same
   phrase goes into each "ask-questions tool" sentence in `agento-init.prompt.md`
   and `install-skills.prompt.md`. Copy the edited prompts byte-for-byte to
   `commands/agento-init.md` and `commands/install-skills.md`.
5. **Changelog.** Add a `**Fixed.** … (#90)` entry under `## Unreleased`.
6. **Live check.** In a VS Code window on this branch, start a fresh chat with the 📋
   Agento Planner selected and confirm the question carousel appears with a
   recommended option. This is a `(manual)` step, because the agent cannot drive
   its own chat UI or start a new chat session (see Risks).

Files touched (product): `.github/agents/delivery-planner.agent.md`,
`.github/agents/initiative-architect.agent.md`,
`.github/instructions/delivery-policy.instructions.md`,
`.github/prompts/agento-init.prompt.md`, `.github/prompts/install-skills.prompt.md`,
`commands/agento-init.md`, `commands/install-skills.md`,
`tests/customizations.test.mjs`, `CHANGELOG.md`.

## Risks

- **Tool name drift.** In 1.136, `vscode/askQuestions` appears among
  `legacyToolReferenceFullNames`, so a later VS Code may rename it. An unknown name
  in `tools:` is dropped silently, and the bug would come back.
  - Mitigation: step 2.1 checks VS Code's own diagnostics on the agent files (no
    unknown-tool warning), and step 3.4 checks the carousel live.
  - The name lives in one test constant.
  - The §10 fallback still works if the name ever breaks.
- **Subagents cannot ask.** `runSubagent` disables the ask-questions tool for
  subagents. The Planner and Architect are never invoked as subagents, so this has no
  effect here. The policy text must not promise the carousel to subagents.
- **Auto-reply and Autopilot permission level.** With `chat.autoReply`, or the
  autopilot permission level, VS Code answers the carousel itself, telling the agent
  the user is unavailable. Marking a recommended option gives those automatic
  answers a sensible default. The planner still records whatever answer it gets.
- **Live check is manual.** Only the user can open a new chat with the Planner
  selected and see the carousel. The step needs a screenshot under `evidence/`
  (policy §3). It is not post-ship: the build window on this branch loads the
  workspace-mode agents from this worktree, so it is checked before review.
- **Lint baseline unavailable.** shellcheck is not installed (exit 127). No shell
  file changes, so the scoped gate is enough. Installing shellcheck is recorded as a
  follow-up, not done here.
- **Concurrent delivery.** There are no open PRs today. Integrate `origin/main` by
  merge before every push, in both halves.

## Out of scope

- Tool lists of the Builder, Reviewer, Autopilot, and Mechanic. They do not declare
  `ask-questions`.
- Making `ask-questions` a hard need, or adding a `doctor` probe for it.
- The VS Code extension (`extension/`) and the CLI (`scripts/`).
- Installing shellcheck or changing the lint command.

## Acceptance checklist

- [ ] The exposing regression tests in `tests/customizations.test.mjs`, both named
  `(#90 planner-ask-questions-tool)`, fail on `42c420e`-equivalent sources (recorded
  in roadmap step 1.3) and pass after the fix. Verify with
  `node --test tests/customizations.test.mjs`.
- [ ] `delivery-planner.agent.md` and `initiative-architect.agent.md` list
  `vscode/askQuestions` in `tools:`. VS Code reports no unknown-tool diagnostic for
  either file (`get_errors`).
- [ ] Delivery-policy §10 defines the recommended-choice rule for both the tool
  (`recommended: true`, exactly one per question, open-ended questions included) and
  the numbered-list fallback (`(recommended)` with a one-line reason). The
  `ask-questions` fallback bullet points to it. Verify by reading §10; test (2)
  asserts it.
- [ ] Every prompt, agent, and command mirror that mentions the ask-questions tool
  cites `§10 recommended choice`, and `commands/` stays byte-identical to
  `.github/prompts/`. Verify with `node --test tests/customizations.test.mjs`.
- [ ] Scoped gate:
  - The full suite `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`
    passes, with the 286-test baseline plus the new tests.
  - Both guard smokes pass.
  - `git diff --name-only origin/main...HEAD` lists no `*.sh`.
  - If shellcheck is available, its full run is compared with the recorded
    baseline.
- [ ] Live: in a VS Code window on this branch, a fresh 📋 Agento Planner chat shows
  the question carousel with one option marked recommended. Screenshot at
  `evidence/step-3-4-planner-carousel.png`.
- [ ] `CHANGELOG.md` `## Unreleased` has a `**Fixed.**` entry referencing #90.
