Source: inline argument to /agento new-initiative — 2026-10-13

Make Agento fully compatible with the VS Code Copilot harness (Agent Host, built on the GitHub Copilot SDK), so every Agento command, agent, and hook works when the chat's Session Target is "Copilot" and not only "Local".

Background (from the VS Code and GitHub docs dated 2026-10-07; check each claim against real behavior before relying on it):
- The Copilot harness does not load *.prompt.md files. Prompt files are deprecated for Agent Host, and the Local harness "will be removed in a future release". The official migration turns prompts into skills with disable-model-invocation: true, which drops the prompt's agent:, model:, and tools: settings.
- The Copilot harness loads instructions, AGENTS.md, .github/agents, skills (.github/skills, .agents/skills, ~/.copilot/skills, ~/.agents/skills, and plugin skills/, whose slash names get the plugin prefix /<plugin>:<skill>), hooks in the Copilot CLI schema, and .mcp.json.
- The Agent Host plugin inventory (/plugin, ~/.copilot/installed-plugins) is separate from chat.pluginLocations and the Customizations editor. It is unverified whether a clone registered through chat.pluginLocations loads in Copilot sessions.
- Copilot hooks: a hook configured under PascalCase "PreToolUse" receives snake_case input (tool_name, tool_input) with Claude tool names (Bash, Edit, Write, Read, Agent; apply_patch maps to Edit). The decision is read from top-level fields {permissionDecision, permissionDecisionReason}. sessionStart output is read from a top-level {additionalContext}. preToolUse fails closed if the hook crashes or exits 2, and fails open on timeout.
- Safety gap today: scripts/hooks/delivery-guard.mjs (decide(), around L191–L203; output around L422) and scripts/hooks/session-context.mjs (around L152) emit only hookSpecificOutput. The delivery guard and the "Agento CLI:" session context line are therefore probably inert in Copilot sessions. Fix this first.

Decisions already made (record them verbatim in breakdown.md ## Decisions):
1. Full Copilot-harness support. No "default to Local" stopgap.
2. A single router skill named `agento` keeps the canonical spelling `/agento <name> [args]` exactly. No per-command /agento:<name> skills.
3. The router hands each command to its command file's `agent:` custom agent as a subagent, so agent model pins still apply. It runs the command inline when `agent:` is missing or "agent". Fallback, only if the spike proves it necessary and the user approves it: interactive or orchestrating agents (Planner, Architect, Mechanic, Autopilot) run inline by following their agent file's body.
4. commands/*.md stays the single source the router reads. .github/prompts/ stays unchanged until Local is removed.

Scope to cover:
- Spike, which blocks the rest:
  - Does a chat.pluginLocations clone load (agents, hooks, skills) in a Copilot session? If not, does `copilot plugin install` from a local directory marketplace give live edits?
  - Discovery of .github/hooks/*.json (PascalCase, no version field) and of the plugin's hooks/hooks.json, including expansion of ${CLAUDE_PLUGIN_ROOT}.
  - Actual hook input payloads and which output shapes are honored.
  - Does a user-level skill at ~/.copilot/skills/agento resolve as /agento with arguments, including when that directory is a symlink?
  - Can a subagent ask the user questions? Are nested subagents allowed (Autopilot runs Builder and Reviewer)? Are agent model: pins honored, and which model-name format does the harness expect?
  - Does workbench.action.chat.open with {query, mode, attachFiles} work in a Copilot session?
- Hooks:
  - Each hook emits one JSON object carrying both shapes: top-level Copilot fields plus hookSpecificOutput for Local.
  - decide() normalizes tool names and inputs for bash/Bash, edit/create/Write (file path in `path`), and apply_patch (extract file paths from the patch text so hook-file self-protection still works). It parses toolArgs when it arrives as a JSON string.
  - Adjust the hook wiring files only if the spike requires it. These edits are approval-gated.
  - Add a Copilot-format guard fixture set and replay-guard.sh support for it.
- Router skill and install:
  - skills/agento/SKILL.md in the clone: name agento, argument-hint "<command> [args]", disable-model-invocation: true.
  - It parses the command name, applies the agento-core redirect rule, resolves commands/<name>.md, and delegates or runs inline as described in decision 3.
  - Add `agento.mjs harness install|status`, which symlinks ~/.copilot/skills/agento to the clone, plus a doctor `harness` check. Edit scripts/, then run `cd extension && npm run copy-cli`.
- Agents and models: check the tools: lists in .github/agents against Copilot tool aliases (browser and vscode/askQuestions may be ignored). If the Copilot harness needs a different model id format, make `agento.mjs models` write it.
- Extension: adjust chatOpenOptions in extension/src/commandDispatcher.ts only if the spike shows a gap, and update its unit tests.
- Tests and docs:
  - tests/customizations.test.mjs asserts the router skill's frontmatter and name rules, and that every commands/*.md `agent:` names an existing agent or "agent".
  - Update docs/install.md, hooks.md, architecture.md, extension.md, and commands.md.
  - Bump the version in .claude-plugin/plugin.json and add a CHANGELOG entry.

Out of scope: Claude and Codex harnesses, deleting .github/prompts, per-command plugin skills, and changes to agento-init scaffolding for target repositories.

Ordering constraints: the spike comes first. Hook compatibility ships before the router, because running Copilot sessions without the guard is unsafe. Router work can follow in parallel with the agents/models work once the spike is done. Extension and docs come last.

Verification for the initiative overall:
- node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs', both existing guard replays plus the new Copilot replay, shellcheck, and `cd extension && npm run test:unit`.
- A manual Copilot-session check in a target repo (soshiki):
  - /agento delivery-status prints its receipt;
  - the Agento CLI context line is present;
  - an agent-typed `git push origin main` is denied;
  - editing .github/hooks/x.json asks for approval;
  - /agento new-feature runs in the Planner;
  - dashboard dispatch works.
- The same checks repeated in a Local session to confirm nothing regressed.
