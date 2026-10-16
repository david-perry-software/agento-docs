# Agents and model pins in the Copilot harness

## Problem

Member `agents-copilot-models` of the
[copilot-harness initiative](../../../../initiatives/2026/10/copilot-harness/breakdown.md)
(block `### agents-copilot-models`, wave 2, size S).

Brief baseline: *"Agents and models: check the tools: lists in .github/agents against
Copilot tool aliases (the probe observed `vscode/askQuestions` works from a Local
subagent and the VS Code picker pin format overrides the parent model there; the
Copilot runtime's model-name format is still to verify — its SessionStart payload has
no `model` field)."*

The six Agento custom agents (Planner, Builder, Reviewer, Autopilot, Mechanic,
Architect) are written for VS Code's Local harness. When the chat's Session Target is
**Copilot** (the Agent Host harness, built on the GitHub Copilot SDK) nobody knows yet:

- whether their `model:` pins — VS Code picker names such as
  `Claude Opus 5.5 (copilot)` and `DeepSeek V4 Pro (deepseek)`, written locally by
  `agento.mjs models apply` — are honoured, silently ignored, or rejected;
- which entries of their `tools:` lists mean anything there (`browser` and
  `vscode/askQuestions` are VS Code tool names; the GitHub custom-agent format ignores
  unrecognized names);
- whether the Autopilot's explicit subagent `model` (from `models pins`) has any
  Copilot equivalent.

The user-visible effect today: selecting an Agento agent in a Copilot session may run
on the wrong model with no warning, and a profile cannot express a pin both harnesses
understand. After this feature, each agent's effective model and tool set in a Copilot
session are observed and recorded, `models apply` can pin a form Copilot accepts
without breaking Local, and the Autopilot picks the subagent model form that matches
its harness.

## Decisions

Clarifying questions asked with the ask-questions tool on 2026-10-16 (answers
verbatim; the recommended option is marked):

1. **Q: The Copilot runtime's model-name format is unverified. How should the feature
   establish it?** A: "Probe first: a (manual) step selects pinned agents in a Copilot
   session and records the effective model; later steps depend on the finding"
   (recommended option).
2. **Q: If Copilot rejects the picker form '<name> (<vendor>)', how should
   `models apply` pin both harnesses?** A: "Write a prioritized list per pin: picker
   form first, then the Copilot form (profiles gain an optional per-model Copilot
   alias)" (recommended option).
3. **Q: `browser` and `vscode/askQuestions` are VS Code-only (Copilot ignores unknown
   tool names). What should the tools: lists do?** A: "Keep them; add the Copilot
   ask-user/browser equivalents only if the probe shows they exist, and rely on the
   §10 fallbacks otherwise" (recommended option).
4. **Q: The Autopilot passes `runSubagent` `model` from `models pins`. Include its
   Copilot-harness subagent call in this feature?** A (free text): "Do whatever is the
   best long term soluiton". The recommended option was "No — subagent orchestration in
   Copilot belongs to agento-router-skill; only document the gap here".
   **Interpretation recorded here:** keep one source of truth for subagent models
   (`models pins`) and make it harness-aware — `models pins` reports a `copilotModel`
   next to `subagentModel` for every agent, and the Autopilot chooses the form by the
   subagent tool it actually has (`runSubagent` → Local → `subagentModel`; `Agent` →
   Copilot → `copilotModel`, or no `model` when the probe shows the `Agent` tool takes
   none and the agent's own pin applies). Whether the Autopilot can orchestrate at all
   in Copilot (nesting, the observed stall) stays with `agento-router-skill`
   (initiative decision 3), which then reads the same `copilotModel`.
5. **Q: Which agents must be verified live in a Copilot session (plus Local
   parity)?** A: "All six agents selected from the picker in Copilot, effective model
   + tools recorded; Local re-checked for one pinned and one unpinned agent"
   (recommended option).

Initiative decisions that bind this member (breakdown `## Decisions`): full Copilot
support with no "default to Local" stopgap; every member keeps Local fully working.

## Research

Skills consulted: agent-customization (built-in VS Code skill: custom agent file
format, `tools:` and `model:` frontmatter). The Agento repository has no
`.agents/skills/` directory and its AGENTS.md has no `## Agento` skills table
(verified 2026-10-16 on `main` `51ccb2a`); no other domain skill matches.

### What the probe already established (docs/copilot-harness.md, `main` `51ccb2a`)

- Local: an agent's picker-form pin (`Claude Opus 5.5 (copilot)`) overrides the parent
  model and an unpinned agent inherits it; `vscode/askQuestions` works from a subagent;
  a nested subagent has no subagent tool (docs/copilot-harness.md L36–L37, L167–L177).
- Copilot: the subagent stalled ("Reasoning" 10+ min), so ask-user, nesting, and pins
  are **unobserved**; the SessionStart payload has no `model` field
  (docs/copilot-harness.md L37, L59). Copilot tool names seen in `PreToolUse`:
  `Bash`, `Write`, `Read`, `Edit`, `Agent`, `tool_search_tool` (L31, L72).
- The probe agents to extend already exist:
  `tests/harness-probe/workspace/.github/agents/probe-pinned.agent.md` (pinned
  `Claude Opus 5.5 (copilot)`, `tools: [read, edit, execute, agent, vscode/askQuestions]`)
  and `probe-unpinned.agent.md`; operator prompts in `tests/harness-probe/PROMPTS.md`;
  structural tests in `tests/harness-probe/probe.test.mjs`.

### GitHub custom-agent format (docs.github.com, "Custom agents configuration", fetched 2026-10-16)

- Tool aliases, case-insensitive: `execute` (`shell`, `Bash`, `powershell`), `read`
  (`Read`, `NotebookRead`), `edit` (`Edit`, `MultiEdit`, `Write`, `NotebookEdit`),
  `search` (`Grep`, `Glob`), `agent` (`custom-agent`, `Task`), `web` (`WebSearch`,
  `WebFetch`), `todo` (`TodoWrite`). "All unrecognized tool names are ignored."
- `model`: "Model to use when this custom agent executes. If unset, inherits the
  default model." No format is documented; the Copilot runtime's accepted form is the
  open question.
- `handoffs` and `argument-hint` are VS Code properties, ignored elsewhere.

### Agent frontmatter today (`.github/agents/*.agent.md`, `main` `51ccb2a`)

| Agent | `tools:` | VS Code-only entries |
| --- | --- | --- |
| Planner (`delivery-planner.agent.md`) | `read, search, edit, execute, web, agent, browser, vscode/askQuestions` | `browser`, `vscode/askQuestions` |
| Builder (`delivery-builder.agent.md`) | `execute, read, agent, edit, search, browser` | `browser` |
| Reviewer (`delivery-reviewer.agent.md`) | `read, search, execute, edit, agent, browser` | `browser` |
| Autopilot (`delivery-autopilot.agent.md`) | `execute, read, agent, search, browser` | `browser` |
| Mechanic (`copilot-mechanic.agent.md`) | `execute, read, agent, edit, search, web` | none |
| Architect (`initiative-architect.agent.md`) | `read, search, edit, execute, agent, vscode/askQuestions` | `vscode/askQuestions` |

Every other entry is already a GitHub primary alias. Committed agent files carry no
`model:` line (`tests/customizations.test.mjs` L953–L961); pins are local, written by
`agento.mjs models apply` through the `agento-models` git clean/smudge filter
(docs/model-profiles.md "The pin filter"). The working tree of this worktree shows the
user's applied pins (for example Builder `DeepSeek V4 Pro (deepseek)`, Reviewer
`Claude Fable 5.1 (copilot)`), inherited from the clone's filter.

### The models subcommand

- `scripts/model-profiles.mjs`: `PROFILE_KEYS` (L9) and `parseProfiles` (L44–L82)
  reject any top-level key but `profiles` and any profile key but `description`,
  `default`, `agents`, `prompts`; `valueErrors` (L27) already accepts a name or a
  non-empty list; `resolveTargets` (L122) resolves each agent/prompt value and each
  handoff to the target's first list entry; `renderModel` (L160) already writes
  `model: [..]` lists.
- `scripts/agento.mjs`: `modelsPins` (L3671–L3682) reports
  `{ name, file, model, subagentModel }`, `subagentModel` being the first list entry;
  `tierWarnings`/`pinWarnings` (L3690–L3709) produce the BYOK and unqualified
  warnings; the `models` dispatcher is at L4609ff; doctor's `model-profile` check at
  L948–L984.
- `.github/agents/delivery-autopilot.agent.md` L49–L52 (tier refusal) and L68–L124
  pass `pins.<builder|reviewer>.subagentModel` as the `runSubagent` `model`;
  `tests/customizations.test.mjs` L965–L972 asserts that wording.
- `extension/` only shells out to `agento.mjs models` (`extension/src/extension.ts`
  L541); `extension/cli/` is a byte copy of `scripts/` refreshed by
  `cd extension && npm run copy-cli`.
- `templates/model-profiles.json` is the `models init` template;
  `docs/model-profiles.md` L196ff says "Copilot-harness (Agent Host) behavior is
  unverified."

### Lint baseline (policy §5)

- The repository's full lint is shellcheck (AGENTS.md "Shell lint":
  `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`), run in CI
  (`.github/workflows/ci.yml` L18–L21).
- Local run 2026-10-16 in this worktree: exit **127** — `shellcheck` is not installed
  on this machine. CI run `38920170022` (`ci`) on `main` `51ccb2a` concluded
  **success**, including the Shellcheck step: zero findings on the baseline.
- Test baseline: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → exit 0,
  543 tests, 543 pass, 0 fail.
- **Overlap decision:** no findings, and this delivery changes no shell file, so there
  is no overlap and no cleanup. Because shellcheck is unavailable locally, the
  full-repository lint gate is the PR's CI Shellcheck step (same command), which must
  pass before review; if the Builder can install shellcheck without sudo it runs the
  command locally as well.

### Concurrent delivery

`gh pr list --state open` returned no open PRs on 2026-10-16: no file overlap. The
initiative's `agento-router-skill` (wave 3, `ready: true`, unplanned) will also read
`.github/agents/*` and `models pins`; it is recommended after this member.

## Approach

Probe first, then change only what the findings require (decision 1).

1. **Probe (Copilot findings).** Extend `tests/harness-probe/workspace/.github/agents/`
   with pin-variant probe agents: picker form (existing `probe-pinned`), a BYOK picker
   form (`DeepSeek V4 Pro (deepseek)`), and a list form whose second entry is the
   Copilot runtime's id candidate; each probe agent reports its effective model, its
   tool list (including whether an ask-user and a browser tool exist and their names),
   and the parameters of its subagent tool (does `Agent` accept `model`?). Extend
   `tests/harness-probe/PROMPTS.md` with the operator steps and `probe.test.mjs` with
   structural checks. The user runs the probe in a Copilot session (manual: the agent
   cannot drive VS Code's own chat UI) and attaches screenshots. Findings go into
   `docs/copilot-harness.md` (the "Do model pins apply" and subagent rows plus a new
   `## Agents and models` section).
2. **Tools lists (decision 3).** Keep the six `tools:` lists. Add a
   `tests/customizations.test.mjs` check that every `tools:` entry is either a GitHub
   primary alias (`execute`, `read`, `edit`, `search`, `agent`, `web`, `todo`) or on an
   explicit VS Code-only allowlist (`browser`, `vscode/askQuestions`) — so a new entry
   must state which harness it serves. Add the Copilot ask-user / browser tool names to
   the agents (and the allowlist, as Copilot-only) **only if** the probe observed them;
   otherwise document in `docs/copilot-harness.md` that the §10 `ask-questions` and
   `browser` fallbacks apply in Copilot.
3. **Copilot model aliases (decision 2), only if the probe shows the picker form is
   not honoured in Copilot.** `model-profiles.json` gains an optional top-level
   `copilotModels` object mapping a qualified picker name to the Copilot runtime's id
   (validated like model values; unknown shapes are errors). `resolveTargets` expands
   every **agent** pin into a prioritized list: each picker entry followed by its
   Copilot alias (deduplicated, order kept); prompts are untouched (Copilot does not
   load prompt files) and handoff pins keep the picker form (handoffs are VS Code
   only). `models show`/`apply`/`pins` add a warning naming applied agent pins with no
   Copilot alias; doctor's `model-profile` check reports it as `warn` like the existing
   unqualified warning. The filter, `adopt`, and `clear` need no change because they
   already store and compare whole rendered `model:` lines. Update
   `templates/model-profiles.json` (an example `copilotModels`) and
   `docs/model-profiles.md`. If the probe shows the picker form *is* honoured, these
   steps are marked obsolete with the finding and only the docs change.
4. **Autopilot (decision 4).** `models pins` adds `copilotModel` to each pin (the
   Copilot alias of the first picker entry, else the first entry the probe showed
   Copilot accepts, else `null`). The Autopilot body gains one rule: identify the
   harness by the subagent tool it has (`runSubagent` → pass `subagentModel`; `Agent`
   → pass `copilotModel` if the probe showed `Agent` takes a model, else omit it and
   rely on the target's own pin). `tests/customizations.test.mjs` asserts the rule.
5. **Live verification.** The Builder prepares a scratch clone of the branch with a
   test profile applied through `AGENTO_CONFIG_HOME` (never touching the user's own
   profiles file or the primary clone's pins), then the user selects each of the six
   agents in a Copilot session and one pinned plus one unpinned agent in a Local
   session, with screenshots.
6. `cd extension && npm run copy-cli` after every `scripts/` change; extension unit
   tests stay green.

Affected files: `tests/harness-probe/**`, `docs/copilot-harness.md`,
`tests/customizations.test.mjs`, possibly `.github/agents/*.agent.md` (tools only),
`scripts/model-profiles.mjs`, `scripts/model-profiles.test.mjs`, `scripts/agento.mjs`,
`scripts/agento.test.mjs`, `extension/cli/*` (copy), `templates/model-profiles.json`,
`docs/model-profiles.md`, `.github/agents/delivery-autopilot.agent.md` and its
`commands/`/prompt mirrors only if the `ap` command text changes.

## Risks

- **The Copilot subagent stall recurs**, leaving pins unobservable again. Mitigation:
  the probe selects each agent **directly from the picker** in a Copilot session (top
  level, no subagent), which the brief names as the verification path; the subagent
  case is recorded as observed-or-not, and the Autopilot rule degrades to "omit the
  model" when unobserved.
- **Copilot's model id format is undiscoverable from inside the session** (no
  `model` in SessionStart). Mitigation: the probe agent reports the model it runs as,
  and the operator also records the Copilot session's own model picker labels in the
  screenshot; the list form tests a concrete candidate rather than guessing silently.
- **A list pin changes Local behavior.** VS Code tries list entries in order, so the
  picker form stays first and Local resolves it as today; the Local parity check
  (one pinned, one unpinned agent) proves it. An unresolvable second entry is
  harmless in Local because the first resolves.
- **BYOK models may not exist in Copilot at all** (`DeepSeek V4 Pro (deepseek)`).
  Mitigation: the probe includes a BYOK-pinned variant; if Copilot cannot run it, the
  missing-alias warning tells the user and the docs say Copilot falls back to its
  default for that agent.
- **Touching the user's pins.** `models apply` rewrites the plugin clone. Mitigation:
  verification uses a scratch clone and `AGENTO_CONFIG_HOME`; the primary clone and
  `~/.config/agento/model-profiles.json` are never modified.
- **Shellcheck unavailable locally.** Mitigation: CI's Shellcheck step is the gate
  (no shell files change).
- **Concurrent delivery:** no open PRs today; integrate `origin/main` by merge before
  every push, and `agento-router-skill` should plan after this ships (it reads
  `copilotModel`).

## Out of scope

- Making the Autopilot (or any agent) orchestrate subagents in Copilot — nesting and
  the inline fallback belong to `agento-router-skill` (initiative decision 3).
- The `agento` router skill, harness install, dashboard dispatch, and the
  initiative-wide docs/version bump (later members).
- Changing hooks or the delivery guard.
- Per-harness agent files or `target:` splits.
- Changing committed `model:` policy: agent files stay committed without `model:`.
- Modifying the user's real model profiles file or the primary clone's pins.

## Acceptance checklist

- [ ] The probe records, for a Copilot session, each pin variant's effective model,
  the agent's available tools (ask-user and browser presence and names), and whether
  the `Agent` subagent tool accepts a model — verify: `docs/copilot-harness.md`
  carries the updated rows and an `## Agents and models` section linking evidence
  screenshots under `evidence/`.
- [ ] Every `.github/agents/*.agent.md` `tools:` entry is a GitHub primary alias or on
  the explicit harness-specific allowlist — verify: the new
  `tests/customizations.test.mjs` test passes, and fails when a fixture adds an
  unknown entry.
- [ ] Copilot ask-user / browser tool names are added to the agents only if the probe
  observed them; otherwise `docs/copilot-harness.md` states that the §10 fallbacks
  apply in Copilot — verify: diff of `.github/agents/` against the recorded finding.
- [ ] If Copilot rejects the picker form: `copilotModels` is parsed and validated,
  `models apply` writes `[<picker>, <copilot id>]` agent pins (prompts and handoffs
  unchanged), and a missing-alias warning appears in `models show`/`apply`/`pins` and
  doctor — verify: new cases in `scripts/model-profiles.test.mjs` and
  `scripts/agento.test.mjs` pass. If Copilot accepts the picker form: those roadmap
  steps are marked obsolete with the finding — verify: roadmap and docs.
- [ ] `models pins` reports `copilotModel` for every agent and the Autopilot body
  selects the subagent model form by its subagent tool — verify:
  `scripts/agento.test.mjs` pins case and the `tests/customizations.test.mjs`
  Autopilot assertion pass.
- [ ] All six agents, selected from the picker in a Copilot session with the test
  profile applied in a scratch clone, run on their pinned model (or the documented
  fallback) — verify: (manual) screenshots in `evidence/`.
- [ ] Local parity: one pinned and one unpinned agent behave as before (pin
  overrides; unpinned inherits) — verify: (manual) screenshots in `evidence/`.
- [ ] `docs/model-profiles.md` no longer says Copilot behavior is unverified and
  documents `copilotModels` (or the finding that it is unnecessary) — verify: read
  the section.
- [ ] Full tests pass: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`
  exit 0; `cd extension && npm run test:unit` exit 0; `extension/cli/` equals
  `scripts/` after `npm run copy-cli`; all four guard replays exit 0.
- [ ] Lint gate: the PR's CI Shellcheck step passes (full-repository shellcheck, zero
  findings as on the baseline) — verify: `scripts/wait-for-checks.sh pr <n>`.
- [ ] The committed agent files still carry no `model:` line — verify: the existing
  `tests/customizations.test.mjs` L953 test passes.
