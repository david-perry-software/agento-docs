```yaml
initiative: copilot-harness
created: 2026-10-13
last-updated: 2026-10-15
```

# Copilot harness: Agento commands, agents, and hooks on the VS Code Agent Host

## Goal

Agento works when the chat's Session Target is **Copilot** (the Agent Host harness,
built on the GitHub Copilot SDK), not only **Local**. After this initiative:

- `/agento <name> [args]` works in a Copilot session through a single `agento` router
  skill, with the exact canonical spelling. The router hands each command to its
  custom agent as a subagent, so model pins still apply.
- The delivery guard and the `Agento CLI:` session context fire in Copilot sessions
  as they do in Local ones. No Copilot session runs unguarded.
- `agento.mjs harness install|status` and a `harness` check in doctor install and
  verify the router, and the extension's dashboard dispatch works in both harnesses.
- Local sessions keep working unchanged until VS Code removes the Local harness.

## Decisions

Decisions carried in the brief (verbatim):

1. Full Copilot-harness support. No "default to Local" stopgap.
2. A single router skill named `agento` keeps the canonical spelling `/agento <name> [args]` exactly. No per-command /agento:<name> skills.
3. The router hands each command to its command file's `agent:` custom agent as a subagent, so agent model pins still apply. It runs the command inline when `agent:` is missing or "agent". Fallback, only if the spike proves it necessary and the user approves it: interactive or orchestrating agents (Planner, Architect, Mechanic, Autopilot) run inline by following their agent file's body.
4. commands/*.md stays the single source the router reads. .github/prompts/ stays unchanged until Local is removed.

Clarifying questions asked with the ask-questions tool on 2026-10-13:

- **Q: How should the spike ship as a member feature?** A: Own feature: findings
  committed as docs/copilot-harness.md + a reproducible probe script/fixtures.
- **Q: Target size of a member feature?** A: Small–medium: one concern each (~5–8
  features).
- **Q: Should the VS Code extension also offer/perform the harness install (e.g. a
  Session & Doctor action), or CLI + doctor only?** A: CLI + doctor check only;
  extension just surfaces the doctor result.
- **Q: Must every member keep the Local harness fully working (no regression) until
  Local is removed?** A: Yes — every member verifies Local too.

## Research

Skills consulted: agent-customization (built-in VS Code skill: skill, agent, and hook
file formats and locations). The Agento repository has no `.agents/skills/` directory
and its AGENTS.md has no skills table (verified 2026-10-13 on `main` `15e67eb`).

### Harness behavior (observed by `harness-probe`; see docs/copilot-harness.md)

Observed 2026-10-13/2026-10-15 on VS Code 1.141.0 and Copilot Chat 0.69.0. The
sanitized fixture evidence and per-event field tables live in
`docs/copilot-harness.md` (the product repository).

- **Prompt files.** Confirmed: the Copilot harness does not load `*.prompt.md`,
  and a plugin's prompt commands are not loaded either (a same-named user skill is
  not shadowed). Each `/name` goes through a "Read skill" step (~4 min per turn).
- **What the Copilot harness loads.** Confirmed for user skills: the symlinked
  `~/.copilot/skills/agento` and a copied `~/.copilot/skills/agento-probe-copy`
  both resolve with the full argument tail. The router therefore has to be a
  user-level skill to keep `/agento <name>`.
- **Plugin loading.** `chat.pluginLocations` loads the plugin's hooks in Local
  (the plugin hook fires alongside the workspace hook, and the plugin's
  `/agento <name>` prompt commands shadow a same-named user skill). In Copilot the
  plugin's prompt commands are **not** loaded, and the plugin hook is invoked but
  its `${CLAUDE_PLUGIN_ROOT}` path did not resolve to the logger (the model
  reported the hook errored; no plugin-source log was written). `copilot plugin
  install` is unobserved: the standalone Copilot CLI is not installed.
- **Hooks.** Workspace `.github/hooks/*.json` (PascalCase event names, no
  `version`) is discovered in both harnesses. Input payload fields are snake_case:
  - Local `PreToolUse` uses VS Code tool ids (`run_in_terminal`, `create_file`,
    `replace_string_in_file`) and carries `tool_use_id` and `transcript_path`.
  - Copilot `PreToolUse` uses Claude names (`Bash`, `Write`, `Read`, `Edit`,
    `Agent`) and has no `tool_use_id` or `transcript_path`. There is no
    `apply_patch` tool in either harness.
  - Local `SessionStart` carries `model` and `transcript_path`; Copilot carries
    `initial_prompt` and no `model` field.
  - Copilot reads the `PreToolUse` decision from **both** the nested
    `hookSpecificOutput.permissionDecision` (+ reason) and the top-level
    `permissionDecision`; Local reads only the nested slot. Copilot reads
    `SessionStart` context from top-level `additionalContext`; Local reads
    `hookSpecificOutput.additionalContext`. A dual-shape output is therefore safe.
  - A `PreToolUse` hook that exits 2 fails closed in both harnesses. A malformed
    item dropped / a bad `version` rejecting the file, and the timeout direction,
    were not exercised by the probe.
- **Subagents and agents.** In Local, `vscode/askQuestions` works from a subagent,
  the VS Code picker pin (`Claude Opus 5.5 (copilot)`) overrides the parent model,
  and an unpinned agent inherits the parent model — but a nested subagent has no
  subagent tool, so nesting is unavailable. In Copilot the subagent stalled
  ("Reasoning" 10+ min) and ask-user/nesting/pins are unobserved; the SessionStart
  payload has no `model` field, so the Copilot runtime's model-name format is
  still to verify.
- **Handoff and default target.** Handoff to another harness starts only from a
  Local session. No documented setting picks a default Session Target.

### Agento surfaces affected (code, `main` `15e67eb`)

- **Commands.** 25 files in `commands/*.md`, each a byte mirror of
  `.github/prompts/*.prompt.md` (parity is enforced in `tests/customizations.test.mjs`):
  - 10 name a custom agent: `ap`, `build-feature`, `build-issue`, `extend-copilot`,
    `fix-copilot`, `new-feature`, `new-initiative`, `new-issue`, `review-feature`,
    `review-issue`;
  - 11 use `agent: "agent"`;
  - 4 have no `agent:`: `agento-init`, `close-session`, `install-skills`,
    `start-session`.
- **Agents.** 6 in `.github/agents/`: Planner, Builder, Reviewer, Autopilot,
  Architect, Mechanic. Their `tools:` lists include `browser` and
  `vscode/askQuestions`, and their `model:` pins are VS Code picker names (for example
  `Claude Opus 5.5 (copilot)`, `DeepSeek V4 Pro (deepseek)`), rewritten by
  `agento.mjs models` through a git clean/smudge filter.
- **Plugin manifest.** `.claude-plugin/plugin.json` (version `0.7.0`) declares
  `agents: .github/agents`, `commands: commands`, and `hooks: ./hooks/hooks.json`.
  `hooks/hooks.json` uses `${CLAUDE_PLUGIN_ROOT}`. The workspace-mode wiring is
  `.github/hooks/delivery-guard.json` and `session-start.json` (PascalCase, no
  `version`). There is no `skills/` directory yet.
- **Delivery guard.** In `scripts/hooks/delivery-guard.mjs`:
  - `decide()` (L191–L203) reads `tool_name || toolName` and `tool_input || toolInput`,
    and only when the input is already an object. A `toolArgs` JSON string is
    ignored.
  - The file path is taken from `filePath`, `file_path`, `path`, or `uri`. An
    `apply_patch` patch body is not parsed for paths.
  - `WRITE_TOOL` (L24) matches `edit|create|write|replace|patch|apply|insert|notebook`.
  - Output (L422) is only `{ hookSpecificOutput: { permissionDecision, … } }`.
- **Session context.** `scripts/hooks/session-context.mjs` emits only
  `{ hookSpecificOutput: { additionalContext } }` (L152). Under the Copilot schema
  both hooks are therefore likely no-ops: an unguarded session with no `Agento CLI:`
  line.
- **Guard replay.** `scripts/hooks/replay-guard.sh` (L57–L59) builds Local payloads
  (`tool_name: "run_in_terminal"`) and reads `hookSpecificOutput.permissionDecision`.
- **Extension.** `extension/src/commandDispatcher.ts` `chatOpenOptions` calls
  `workbench.action.chat.open` with `{ query, mode, attachFiles }`. `mode` comes from
  the `commands/<name>.md` `agent:` and the plugin root from `agento.pluginRoot` or
  `chat.pluginLocations` (`extension/src/modelProfiles.ts` `resolvePluginRoot`).
  `extension/cli/` is a byte copy of `scripts/` (`npm run copy-cli`).
- **Second plugin checkout.** A second checkout, `/home/david/DP/agento-plugin`, also
  names `agento-docs` as its companion (session warning `companion-anchor`). The
  harness install must pick one plugin root explicitly.

## Features

### harness-probe

- Summary: Verify the Copilot harness's real behavior with a reproducible probe and commit the findings as docs/copilot-harness.md.
- Brief: Spike, which blocks the rest: chat.pluginLocations vs `copilot plugin install` loading; discovery of .github/hooks/*.json and plugin hooks/hooks.json with ${CLAUDE_PLUGIN_ROOT}; actual hook input payloads and honored output shapes; whether ~/.copilot/skills/agento resolves as /agento with arguments, including through a symlink; subagent ask-user, nesting, model pins and model-name format; workbench.action.chat.open {query, mode, attachFiles} in a Copilot session.
- Requires: none
- Recommended after: none
- Wave: 1
- Size: M
- Independence: Ships a standalone probe (a payload-logging hook script, a throwaway test skill and agent, fixtures of captured payloads) plus docs/copilot-harness.md. It changes no runtime behavior, and every later member reads its findings instead of guessing.

### copilot-hook-compat

- Summary: Make the delivery guard and session context work under the Copilot hook schema without regressing Local.
- Brief: Hooks: each hook emits one JSON object carrying both shapes (top-level Copilot fields plus hookSpecificOutput for Local); the probe confirmed Copilot reads top-level `additionalContext` for SessionStart and both the nested and top-level PreToolUse decision slots, while Local reads the nested slots, so decide() normalizes the observed Copilot tool names (`Bash`, `Write`, `Read`, `Edit`, `Agent`) and the Local ids (`run_in_terminal`, `create_file`, `replace_string_in_file`) (file path in `path`/`filePath`) and parses toolArgs JSON strings; there is no apply_patch tool in either harness; hook wiring files change only if the spike requires it (approval-gated); a Copilot-format guard fixture set and replay-guard.sh support for it.
- Requires: harness-probe
- Recommended after: none
- Wave: 2
- Size: M
- Independence: Pure hook-layer change verified by replay fixtures in both formats. Copilot sessions become guarded even before any command works there, and Local output stays the same, because Local reads the hookSpecificOutput it reads today.

### agents-copilot-models

- Summary: Make the six custom agents load correctly in the Copilot harness, with tool lists and model pins it understands.
- Brief: Agents and models: check the tools: lists in .github/agents against Copilot tool aliases (the probe observed `vscode/askQuestions` works from a Local subagent and the VS Code picker pin format overrides the parent model there; the Copilot runtime's model-name format is still to verify — its SessionStart payload has no `model` field).
- Requires: harness-probe
- Recommended after: copilot-hook-compat
- Wave: 2
- Size: S
- Independence: Touches only `.github/agents/*.agent.md` frontmatter and the `models` subcommand, verified by selecting each agent in a Copilot session (the subagent model check the probe could not complete in Copilot) and by the models tests. Useful on its own whenever a user selects an Agento agent from the picker.

### agento-router-skill

- Summary: Add the `agento` router skill so `/agento <name> [args]` runs the matching commands/<name>.md in a Copilot session.
- Brief: Router skill: skills/agento/SKILL.md in the clone with name agento, argument-hint "<command> [args]", disable-model-invocation: true; it parses the command name, applies the agento-core redirect rule, resolves commands/<name>.md, and delegates to the `agent:` custom agent as a subagent or runs inline (decision 3); the probe confirmed a user-level `agento` skill receives the full argument tail in Copilot and that subagents cannot nest, so decision 3's inline fallback applies to interactive/orchestrating agents (Autopilot) — recorded with the user's approval; tests/customizations.test.mjs asserts the router skill's frontmatter and name rules and that every commands/*.md `agent:` names an existing agent or "agent".
- Requires: harness-probe, copilot-hook-compat
- Recommended after: agents-copilot-models
- Wave: 3
- Size: M
- Independence: Ships one skill directory plus its tests. It works as soon as someone puts it in a user skill location by hand (the probe's documented manual step), and commands/*.md and Local prompts are unchanged.

### harness-install

- Summary: Add `agento.mjs harness install|status` and a doctor `harness` check that install and verify the router skill for Copilot sessions.
- Brief: `agento.mjs harness install|status`, which symlinks ~/.copilot/skills/agento to the clone, plus a doctor `harness` check; the probe confirmed the user-level symlink is the load path that works in Copilot (`chat.pluginLocations` plugins do not load prompt commands there and the plugin hook's `${CLAUDE_PLUGIN_ROOT}` path failed to resolve), and `copilot plugin install` is unobserved because the Copilot CLI is absent; edit scripts/, then run `cd extension && npm run copy-cli`; the extension only surfaces the doctor result (no install action).
- Requires: agento-router-skill
- Recommended after: none
- Wave: 4
- Size: S
- Independence: A self-contained CLI subcommand and doctor check with node:test coverage. The Session & Doctor panel shows the new check through the existing doctor rendering, with no extension code beyond copy-cli.

### dispatch-copilot-harness

- Summary: Make the extension's dashboard and cross-window dispatch submit Agento commands correctly in Copilot sessions.
- Brief: Extension: the spike found a gap — `workbench.action.chat.open {query, mode, attachFiles}` fills the Copilot chat input with the slash-leading query, attaches the command file, and sets the mode, but does not submit, and the Copilot input refuses to send a message that begins with a slash in this dispatch case; adjust chatOpenOptions in extension/src/commandDispatcher.ts accordingly and update its unit tests; verification includes dashboard dispatch working in a Copilot session.
- Requires: harness-install
- Recommended after: agents-copilot-models
- Wave: 5
- Size: S
- Independence: Limited to the extension's dispatch path and its unit tests; the spike named a concrete gap (slash-leading query not submittable), so it is a real fix whose evidence is a recorded Copilot-session dispatch.

### harness-docs

- Summary: Document Copilot-harness use end to end, bump the plugin version, and run the full two-harness acceptance in soshiki.
- Brief: Tests and docs: update docs/install.md, hooks.md, architecture.md, extension.md, and commands.md; bump the version in .claude-plugin/plugin.json and add a CHANGELOG entry; verification for the initiative overall (full test suites and replays, and the manual Copilot-session and Local-session checks in soshiki).
- Requires: copilot-hook-compat, agents-copilot-models, harness-install, dispatch-copilot-harness
- Recommended after: none
- Wave: 6
- Size: S
- Independence: Documentation, release metadata, and the cross-member acceptance run. It changes no behavior, so it can only land once everything it describes has shipped.

## Recommended order

- **Wave 1 — harness-probe.** Every design choice below depends on observed harness
  behavior: hook discovery, payloads, output shapes, skill resolution, subagent
  limits, and dispatch. The probe turns the doc claims into recorded facts.
- **Wave 2 — copilot-hook-compat and agents-copilot-models in parallel.** The hooks
  member closes the safety gap first, so no Copilot session runs unguarded once
  commands work there. Agent frontmatter is independent of the hooks and only needs
  the probe's tool and model findings.
- **Wave 3 — agento-router-skill.** It needs the hooks shipped (commands must not run
  unguarded) and is best built after the agents load cleanly, since it delegates to
  them.
- **Wave 4 — harness-install.** It needs the skill directory to link to.
- **Wave 5 — dispatch-copilot-harness.** The dashboard submits `/agento …` queries,
  which only resolve once the router is installed.
- **Wave 6 — harness-docs.** Last, per the brief: it documents what shipped and runs
  the full two-harness acceptance.

```mermaid
graph LR
  harness-probe --> copilot-hook-compat
  harness-probe --> agents-copilot-models
  harness-probe --> agento-router-skill
  copilot-hook-compat --> agento-router-skill
  agento-router-skill --> harness-install
  harness-install --> dispatch-copilot-harness
  copilot-hook-compat --> harness-docs
  agents-copilot-models --> harness-docs
  harness-install --> harness-docs
  dispatch-copilot-harness --> harness-docs
```

## Risks

- **The docs may not match the shipped harness.** Mitigation: harness-probe recorded
  observed payloads as fixtures (and `docs/copilot-harness.md`), and later members
  build against those fixtures, not the prose.
- **Subagents may not be able to ask the user or nest** (Planner, Architect, Mechanic,
  Autopilot). Observed: nesting is unavailable in Local (a nested subagent has no
  subagent tool) and the Copilot subagent stalled, so ask-user/nesting/pins in
  Copilot are unobserved. Mitigation: decision 3's inline fallback for
  interactive/orchestrating agents, used with the user's approval and recorded in
  agento-router-skill's plan.
- **A dual-shape hook output could confuse one harness.** Resolved by the probe:
  Local reads `hookSpecificOutput` and Copilot reads the top-level fields, so one
  object carrying both shapes is safe. Mitigation remains: both replay formats, plus
  a manual Local and Copilot check in every hook-touching member, per the
  Local-parity decision.
- **A preToolUse crash fails closed and blocks every tool.** Confirmed: exit 2 fails
  closed in both harnesses. Mitigation: the guard keeps its no-node early exit 0 and
  wraps normalization so malformed input yields `allow`, never a crash.
- **A plugin clone registered through chat.pluginLocations may not load in Agent
  Host.** Confirmed: in Copilot the plugin's prompt commands are not loaded and the
  plugin hook's `${CLAUDE_PLUGIN_ROOT}` path failed to resolve (the hook errored,
  the logger never ran); `copilot plugin install` is unobserved because the Copilot
  CLI is absent. Mitigation: make the hooks/router self-sufficient through the
  user-level `~/.copilot/skills/agento` symlink; harness-install follows this
  finding.
- **Two plugin checkouts (`agento`, `agento-plugin`) could both claim the router.**
  Mitigation: `harness install` takes an explicit plugin root and `harness status`
  reports which clone the symlink points at. (The probe window additionally had the
  user's real `/home/david/DP/agento-plugin` active — a recorded confound in the
  harness-probe evidence.)
- **Model pins could silently fall back** if the Copilot runtime rejects the picker
  names. Mitigation: agents-copilot-models verifies each agent's effective model in a
  Copilot session, not just its frontmatter; the probe confirmed the VS Code picker
  pin format works in Local but could not observe the Copilot runtime's model-name
  format (its SessionStart payload has no `model` field).

## Out of scope

- Claude and Codex harnesses.
- Deleting `.github/prompts/` or the `commands/` mirrors.
- Per-command plugin skills (`/agento:<name>`).
- Changes to `agento-init` scaffolding for target repositories.
- A "default to Local" switch or any other stopgap.
- An install action in the VS Code extension (it only surfaces the doctor result).

## Definition of done

- In a Copilot session in soshiki:
  - `/agento delivery-status` prints its receipt;
  - the `Agento CLI:` context line is present;
  - an agent-typed `git push origin main` is denied;
  - editing `.github/hooks/x.json` asks for approval;
  - `/agento new-feature` runs in the Planner;
  - dashboard dispatch works.
- The same checks pass in a Local session.
- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`, both existing guard
  replays plus the Copilot replay, `shellcheck`, and `cd extension && npm run
  test:unit` all pass.
- `agento.mjs doctor` reports the `harness` check `ok` on a machine where `agento.mjs
  harness install` was run.
- docs/install.md, hooks.md, architecture.md, extension.md, commands.md, and
  docs/copilot-harness.md describe both harnesses.
- `.claude-plugin/plugin.json` is bumped and CHANGELOG.md has an entry.
- Every member feature has `status: complete`.
