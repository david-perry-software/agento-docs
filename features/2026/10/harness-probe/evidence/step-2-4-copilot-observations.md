# Step 2.4 — Copilot session observations

Context: VS Code 1.141.0, Copilot Chat 0.69.0, probe window, chat Session Target = Copilot, agent = default "Agent", model Claude Opus 5.5.
Recorded 2026-10-13.

0. Startup with the "Agento Planner" custom agent selected: the Copilot session never started (spinning 3+ min). No hook fired and the log dir stayed empty. With the default "Agent" it started. The copilot-runtime process (`copilot-runtime --headless … --stdio`) had been running ~37 h.
1. SessionStart:
   - The model saw only `PROBE_CTX_TOPLEVEL`, so Copilot reads top-level `additionalContext` and ignores `hookSpecificOutput.additionalContext`. That is the opposite of Local.
   - Workspace `.github/hooks/probe.json` (PascalCase event names, no `version`) IS discovered in Copilot.
   - The SessionStart stdin is snake_case `{hook_event_name, session_id, timestamp, cwd, source:"new", initial_prompt}`.
   - Hook env var names include `COPILOT_CLI`, `COPILOT_HOME`, `COPILOT_PROJECT_DIR`, `CLAUDE_PROJECT_DIR` and `CLAUDE_CODE_DISABLE_PRECOMPACT_SKIP`. There are NO `VSCODE_*` variables.
2. PreToolUse via the shell tool:
   - The payload is `tool_name: "Bash"`, `tool_input: {command, description}`, plus `session_id`, `cwd`, `timestamp` and `hook_event_name`. There is no `tool_use_id` or `transcript_path`.
   - `AGENTO_PROBE_DENY_NESTED` was blocked: "Denied by preToolUse hook: probe: AGENTO_PROBE_DENY_NESTED".
   - `AGENTO_PROBE_DENY_TOPLEVEL` was ALSO blocked: "Denied by preToolUse hook: No reason provided", because the probe emits no top-level reason.
   - `AGENTO_PROBE_ASK_TOPLEVEL` showed a hook card `{"kind":"hook","toolCallId":…,"toolName":"bash","toolArgs":{command,description},"hookMessage":"No reason provided","workingDirectory":…}`. The command then ran with no user confirmation (window showed "Manual permissions").
   - So Copilot honours BOTH the nested `hookSpecificOutput.permissionDecision` (+ `permissionDecisionReason`) and the top-level `permissionDecision`.
   - Latency was very high: ~4.5 min to the first tool call, then ~1 min per command.
3. File tools:
   - Create is `Write` `{path, file_text}`. It failed only because `notes.txt` already existed from the Local run.
   - Read is `Read` `{path}`.
   - Edit is `Edit` `{path, old_str, new_str}`.
   - Tool search is `tool_search_tool`.
   - There is no apply_patch tool, same as Local.
4. Skills:
   - `/agento delivery-status --probe-arg x` resolved to the user skill `~/.copilot/skills/agento` (a symlink), shown as "Read skill · agento". The skill received ARGUMENTS `delivery-status --probe-arg x` exactly. The Agento plugin's prompt commands are NOT loaded in Copilot, so nothing shadows the skill (unlike Local).
   - `/agento-probe-copy hello` resolved to the copied skill, with ARGUMENTS `hello`.
   - Slash prompt files are not recognised in Copilot. Each `/name` goes through a "Read skill" step, and each such turn took ~4 min.
5. Subagents:
   - "Run the probe-unpinned agent as a subagent" produced a PreToolUse with `tool_name: "Agent"`, `tool_input: {agent_type:"probe-unpinned", name, description, prompt, mode…}`. The subagent opened its own read-only chat tab, then sat at "Reasoning" for 10+ minutes with no tool call and no question shown.
   - The user stopped it. Nesting, ask-user from a subagent, and the model pin in Copilot are therefore UNOBSERVED: the subagent stalled.
   - (The parent model was still Claude Opus 5.5; the user did not switch.)
6. `echo AGENTO_PROBE_EXIT2` was blocked: "Denied by preToolUse hook: hook exited with code 2". Exit 2 fails closed in Copilot, and its message names the exit code.
7. Dashboard dispatch (the Agento extension's dashboard in the probe window, which the extension shows as "PRIMARY WINDOW · master", with the chat Session Target set to Copilot):
   - Running delivery-status filled the chat input with `/agento delivery-status`, with `delivery-status.md` (the command file) attached and the Agent mode set.
   - It did NOT submit. The user reports that the Copilot chat input will not let you start (send) a message that begins with a slash in this dispatch case. Typed `/agento …` messages did send earlier (prompt 4).
