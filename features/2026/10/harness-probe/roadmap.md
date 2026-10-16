```yaml
status: in-progress
branch: feature/harness-probe
last-updated: 2026-10-15
next-step: "2.8 collect --harness local-plugin and copilot-plugin"
initiative: "copilot-harness"
artifact-pr: "#52"
```

## Phase 1: Probe tooling

- [x] 1.1 Author the static probe fixtures:
  - `tests/harness-probe/workspace/`: `.github/hooks/probe.json` with SessionStart and
    PreToolUse in PascalCase and no `version`; `probe-pinned.agent.md`
    (`model: "Claude Opus 5.5 (copilot)"`, tools incl. `vscode/askQuestions`);
    `probe-unpinned.agent.md`; `README.md`.
  - `tests/harness-probe/plugin/`: `.claude-plugin/plugin.json` (name
    `agento-probe-plugin`) and `hooks/hooks.json` with `${CLAUDE_PLUGIN_ROOT}` paths.
  - `tests/harness-probe/skills/agento/SKILL.md` and
    `skills/agento-probe-copy/SKILL.md`, which echo their received arguments.
  - `tests/harness-probe/PROMPTS.md` with the numbered Local and Copilot prompts
    (plan `## Approach`).

  Expect three guard approvals, one per protected wiring file.

  verify: `node -e` parses all three JSON files; `node --test tests/customizations.test.mjs` passes.
- [x] 1.2 Add `tests/harness-probe/log-payload.mjs`:
  - it writes one log file per call (source, event, argv, cwd, env-var names only,
    stdin);
  - it emits the marker-driven SessionStart and PreToolUse output shapes;
  - malformed input exits 0 silently.

  Add its tests in `tests/harness-probe/probe.test.mjs`.

  verify: `node --test tests/harness-probe/probe.test.mjs` passes.
- [x] 1.3 Add `tests/harness-probe/probe.mjs` `setup` / `status` / `teardown`:
  - temp-HOME aware; setup copies the workspace, git-inits it, and rewrites
    `probe.json` with the absolute logger path;
  - setup refuses a foreign `~/.copilot/skills/agento`;
  - teardown removes only probe-owned entries and reports any `chat.pluginLocations`
    leftover.

  Add tests.

  verify: `node --test tests/harness-probe/probe.test.mjs` passes, including the foreign-skill refusal and untouched-foreign-entry cases.
- [x] 1.4 Add `probe.mjs collect --harness <label>`:
  - it sanitizes logs into `tests/harness-probe/fixtures/<label>/` with the
    placeholders and dropped keys;
  - the deny-pattern scan fails without writing anything.

  Add the committed-fixture scan test.

  verify: `node --test tests/harness-probe/probe.test.mjs` passes, and a planted `/home/x` or `ghp_` value makes `collect` exit nonzero and write nothing.

## Phase 2: Observe both harnesses

- [x] 2.1 Run `node tests/harness-probe/probe.mjs setup` and `status`, and record
  `code --version` and the Copilot Chat extension version
  (`code --list-extensions --show-versions`) for the doc.

  Recorded 2026-10-13: VS Code `1.141.0` (commit `2a59476c9bfcb90b3ddc372c36762471b7dfad1c`, x64); Copilot Chat extension `GitHub.copilot-chat` `0.69.0` (built-in; version read from `/usr/share/code/resources/app/extensions/copilot/package.json` because it is not in `--list-extensions`). Probe workspace `/home/david/.cache/agento-harness-probe/workspace`, `~/.copilot/skills/agento` symlink, `~/.copilot/skills/agento-probe-copy`, and log dir `/home/david/.cache/agento-harness-probe/logs` are installed; `status` confirms all four and `chat.pluginLocations` has no probe entry.

  verify: `status` reports the workspace, the `~/.copilot/skills/agento` symlink, `agento-probe-copy`, and the log dir as installed.
- [x] 2.2 (manual) Open the probe workspace (`code --new-window <workspace path from setup>`), start a chat with Session Target **Local**, and run every prompt in `tests/harness-probe/PROMPTS.md` in order. Reply with what the model reported for each prompt and attach one screenshot of the chat — verify: screenshot saved as `evidence/step-2-2-local-session.png`; the log dir holds SessionStart and PreToolUse files.

  Recorded 2026-10-13: [observations](evidence/step-2-2-local-observations.md); screenshots [session](evidence/step-2-2-local-session.png), [file edits](evidence/step-2-2-local-file-edits.png), [pinned subagent](evidence/step-2-2-local-subagent-pinned.png), [unpinned subagent](evidence/step-2-2-local-subagent-unpinned.png).
- [x] 2.3 Run `node tests/harness-probe/probe.mjs collect --harness local`.

  Recorded 2026-10-13: 27 sanitized fixtures (1 SessionStart + 26 PreToolUse) collected into `tests/harness-probe/fixtures/local/`; the log dir was emptied.

  verify: `tests/harness-probe/fixtures/local/` holds SessionStart and PreToolUse fixtures; `node --test tests/harness-probe/probe.test.mjs` passes.
- [x] 2.31 (added 2026-10-13) Reorder the markers in `tests/harness-probe/PROMPTS.md` so `AGENTO_PROBE_EXIT2` is sent last — its own prompt after prompts 3–5, instead of item 4 of prompt 2.

  verify: `grep -n 'echo AGENTO_PROBE_EXIT2' tests/harness-probe/PROMPTS.md` shows it only in the final prompt; `node --test tests/harness-probe/probe.test.mjs` passes.
- [x] 2.32 (added 2026-10-13) Teach `tests/harness-probe/PROMPTS.md` prompt 5 to enable the subagent tool via Configure Tools when the model claims it lacks one, and add a 5c: run `probe-pinned` with the parent switched to a different model (separates pin-override from inheritance).

  verify: PROMPTS.md prompt 5 names Configure Tools and 5c; `node --test tests/harness-probe/probe.test.mjs` passes.
- [x] 2.33 (added 2026-10-13) Add a prompt to `tests/harness-probe/PROMPTS.md` telling the user to disable the Agento plugin for the probe workspace (Extensions → Agent Plugins – Installed → Disable (Workspace)), retry `/agento delivery-status --probe-arg x`, then re-enable the plugin.

  verify: PROMPTS.md contains the disable/retry/re-enable instruction; `node --test tests/harness-probe/probe.test.mjs` passes.
- [x] 2.4 (manual) In the same probe window, start a chat with Session Target **Copilot** and run every prompt in `PROMPTS.md` again. Then, in the primary Agento window with the chat Session Target set to Copilot, dispatch `/agento delivery-status` from the Agento dashboard and note what arrives (query text, mode, attachments). Reply with the observations and attach one screenshot per window — verify: `evidence/step-2-4-copilot-session.png` and `evidence/step-2-4-copilot-dispatch.png` saved; the log dir holds new files.

  Recorded 2026-10-13: [observations](evidence/step-2-4-copilot-observations.md); screenshots [session](evidence/step-2-4-copilot-session.png), [hook markers](evidence/step-2-4-copilot-hook-markers.png), [file edits](evidence/step-2-4-copilot-file-edits.png), [skills](evidence/step-2-4-copilot-skills.png), [subagent stall](evidence/step-2-4-copilot-subagent-stall.png), [exit2](evidence/step-2-4-copilot-exit2.png), [dispatch](evidence/step-2-4-copilot-dispatch.png).
- [x] 2.5 Run `node tests/harness-probe/probe.mjs collect --harness copilot`.

  Recorded 2026-10-13: 12 sanitized fixtures collected into `tests/harness-probe/fixtures/copilot/` — 9 PreToolUse and 3 SessionStart (two `source:"new"` from the stalled and retry sessions, plus one `source:"resume"` when the EXIT2 prompt resumed the session); the log dir was emptied.

  verify: `tests/harness-probe/fixtures/copilot/` holds SessionStart and PreToolUse fixtures; probe tests pass.
- [x] 2.6 Check `command -v copilot`. When the CLI is present, run
  `copilot plugin install` on the `tests/harness-probe/plugin` directory and record
  the `copilot plugin list` output; when it is absent, record that.

  Recorded 2026-10-13: `command -v copilot` resolves to `/home/david/.config/Code/User/globalStorage/github.copilot-chat/copilotCli/copilot`, a POSIX shim that launches the extension's `copilotCLIShim.js` through the Code binary — but the standalone GitHub Copilot CLI is **not installed**. `copilot --version` (stdin closed) prints `Cannot find GitHub Copilot CLI (https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli)` and prompts `Install GitHub Copilot CLI? ['y/N']`, then exits without installing. `copilot plugin install` was therefore not run and `copilot plugin list` is unobserved (CLI absent); this stays a harness-install finding for the doc.

  verify: the output or absence is recorded in this step's line.
- [x] 2.7 (manual) Add the `tests/harness-probe/plugin` absolute path (printed by `setup`) to `chat.pluginLocations` in user settings, reload the probe window, start one Local chat and one Copilot chat, send prompts 1–2 of `PROMPTS.md` in each, then remove the `chat.pluginLocations` entry and reload. Attach one screenshot — verify: `evidence/step-2-7-plugin-sessions.png` saved; the log dir holds plugin-source files or is empty (itself a finding).

  Recorded 2026-10-15, Local then Copilot. Screenshots
  [Local](evidence/step-2-7-plugin-sessions.png),
  [Copilot](evidence/step-2-7-plugin-sessions-copilot.png).

  Local session (DeepSeek V4 Pro, Agent mode): prompt 1 reported exactly
  `PROBE_CTX_NESTED`; prompt 2 — `echo AGENTO_PROBE_DENY_NESTED` denied with
  "Tool execution denied: probe: AGENTO_PROBE_DENY_NESTED",
  `echo AGENTO_PROBE_DENY_TOPLEVEL` ran, `echo AGENTO_PROBE_ASK_TOPLEVEL` ran
  (no prompt).

  Copilot session (Claude Opus 5.5, Interactive, manual permissions): prompt 1
  reported `PROBE_CTX_TOPLEVEL`; prompt 2 — all three denied, none ran:
  `DENY_NESTED` denied with reason "probe: AGENTO_PROBE_DENY_NESTED";
  `DENY_TOPLEVEL` denied with "No reason provided"; `ASK_TOPLEVEL` denied because
  "the hook from \"agento-probe-plugin\" errored", and no permission prompt was
  shown.

  Confound: the user's real Agento plugin (`/home/david/DP/agento-plugin`,
  registered in user `chat.pluginLocations`) was also active in the probe window
  (both screenshots list `agento` and `agento-probe-plugin` under Agent Plugins –
  Installed).

  Post-step state: user `chat.pluginLocations` no longer contains the probe plugin
  path (only the pre-existing `/home/david/DP/agento-plugin: true` remains). The
  probe log dir holds 12 files — Local 01:16–01:17Z (`plugin-SessionStart`,
  `workspace-SessionStart`, `plugin-PreToolUse` ×3, `workspace-PreToolUse` ×3)
  and Copilot 01:18Z (`workspace-SessionStart`, `workspace-PreToolUse` ×3), no
  plugin-source files. The Copilot model reported the plugin hook errored, so the
  plugin hook was invoked but the logger never ran (likely a path/token expansion
  failure in the Copilot harness — recorded as a finding for the doc).

- [ ] 2.8 Run `collect --harness local-plugin` and `collect --harness copilot-plugin`,
  splitting the logs by session per the user's step 2.7 order (or record that none
  arrived).

  verify: plugin fixtures exist, or the absence is recorded for the doc; probe tests pass.

## Phase 3: Findings, breakdown, teardown

- [ ] 3.1 Write `docs/copilot-harness.md`:
  - the versions observed;
  - the findings table (question | Local | Copilot | evidence | member impact);
  - payload field names per event and the honored output fields;
  - exit-2 behavior;
  - skill resolution with arguments (direct and symlink);
  - subagent ask-user, nesting, and model pins/format;
  - dispatch;
  - the Reproduce section.

  Use canonical `/agento <name>` spellings only. Add the doc-link resolution test.

  verify: `node --test tests/harness-probe/probe.test.mjs tests/customizations.test.mjs` passes.
- [ ] 3.2 Update `initiatives/2026/10/copilot-harness/breakdown.md` in the companion
  half per plan decision 5:
  - Research bullets become observed facts citing `docs/copilot-harness.md`;
  - adjust affected members' Summary, Brief, and Independence, and `## Risks`;
  - bump `last-updated`;
  - leave the `### harness-probe` block unchanged; any `Requires:` change is named
    in this line.

  verify: `node <agento-root>/scripts/agento.mjs initiative copilot-harness` returns `status: ok` with empty `errors` and `anomalies`.
- [ ] 3.3 Run `node tests/harness-probe/probe.mjs teardown`, then `status`.

  verify:
  - `status` reports nothing installed;
  - `~/.copilot/skills/agento` and `~/.copilot/skills/agento-probe-copy` are absent;
  - no `chat.pluginLocations` entry names the probe plugin;
  - `copilot plugin list` lacks `agento-probe-plugin` when the CLI exists;
  - `~/.cache/agento-harness-probe` is removed.

## Phase 4: Gate

- [ ] 4.1 Run the full gate:
  - `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` (exit 0 vs. the green
    baseline);
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`;
  - `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt`;
  - `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt`.

  verify: every command exits 0; `git diff --name-only origin/main...HEAD` lists only `tests/harness-probe/**` and `docs/copilot-harness.md`; `git status --porcelain --untracked-files=all` is empty in both halves.
