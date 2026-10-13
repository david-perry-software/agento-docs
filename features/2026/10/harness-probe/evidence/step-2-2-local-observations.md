# Step 2.2 — Local session observations

VS Code 1.141.0, Copilot Chat 0.69.0, probe window, Session Target Local.
Recorded 2026-10-13.

1. SessionStart. The model saw only `PROBE_CTX_NESTED`. Local reads `hookSpecificOutput.additionalContext` and ignores top-level `additionalContext`.

2. PreToolUse via run_in_terminal:
   - `AGENTO_PROBE_DENY_NESTED` was blocked ("Blocked by Pre-Tool Use hook", with the probe reason).
   - `AGENTO_PROBE_DENY_TOPLEVEL` ran, so a top-level `permissionDecision: deny` is ignored.
   - `AGENTO_PROBE_ASK_TOPLEVEL` ran with no confirmation prompt, so a top-level ask is ignored.
   - `AGENTO_PROBE_EXIT2` was blocked with the generic message "Hook denied tool execution". Exit 2 fails closed and drops the reason.

3. File tools. The Local payloads use these `tool_name` values: `create_file` {filePath, content} and `replace_string_in_file` {filePath, oldString, newString}. There is no apply_patch tool in Local (`tool_search` found none). A later DeepSeek V4 Pro run had no edit tools and wrote the files through `run_in_terminal` (`printf … > notes.txt`). The input field names are snake_case: `tool_name`, `tool_input`, `hook_event_name`, `session_id`, `transcript_path`, `tool_use_id`, `cwd`, `timestamp`.

4. Skills:
   - `/agento delivery-status --probe-arg x` did NOT reach the probe's `~/.copilot/skills/agento` skill. It ran the installed Agento plugin's real `delivery-status` command (from `/home/david/DP/agento-plugin`, registered in `chat.pluginLocations`). In Local, the plugin's `/agento <name>` namespace shadows a user skill named `agento`. Extra args came through as free text.
   - The agento-plugin's own SessionStart and PreToolUse hooks also fire in the probe window (its session context named the agento-plugin CLI), so logs from that window can contain both hook sources.
   - `/agento-probe-copy hello` resolved. The copied `~/.copilot/skills/agento-probe-copy` was attached as a prompt file with "Follow instructions in #prompt:SKILL.md with these arguments: hello", and the skill echoed `arguments=hello`.

5. Subagents:
   - The first attempt failed because the model claimed it had no runSubagent tool. That was a model mistake: the tool was available all along.
   - `probe-pinned` (pinned to "Claude Opus 5.5 (copilot)"), run as a subagent with a Claude Opus 5.5 parent, reported `model=Claude Opus 5.5`. askQuestions was available, and the user's answer "yes" reached it.
   - `probe-unpinned` with a DeepSeek V4 Pro parent reported `model=DeepSeek V4 Pro`, so an unpinned subagent inherits the parent model. askQuestions worked ("yes"). The NESTED `probe-pinned` call FAILED: the subagent had no subagent tool, so nesting is unavailable in Local.
   - `probe-pinned` with a DeepSeek V4 Pro parent reported `model=Claude Opus 5.5`, so the agent's model pin overrides the parent for subagents. askQuestions was available, and the answer "yes" reached it.
   - Implication for the initiative (decision 3 fallback): orchestrating agents such as the Autopilot cannot run as subagents and still spawn Builder/Reviewer subagents. Flag this for the user's approval in step 3.2. Do not decide it.
