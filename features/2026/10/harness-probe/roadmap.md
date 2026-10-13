```yaml
status: in-progress
branch: feature/harness-probe
last-updated: 2026-10-13
next-step: "1.4 Add probe.mjs collect --harness <label>"
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
- [ ] 1.4 Add `probe.mjs collect --harness <label>`:
  - it sanitizes logs into `tests/harness-probe/fixtures/<label>/` with the
    placeholders and dropped keys;
  - the deny-pattern scan fails without writing anything.

  Add the committed-fixture scan test.

  verify: `node --test tests/harness-probe/probe.test.mjs` passes, and a planted `/home/x` or `ghp_` value makes `collect` exit nonzero and write nothing.

## Phase 2: Observe both harnesses

- [ ] 2.1 Run `node tests/harness-probe/probe.mjs setup` and `status`, and record
  `code --version` and the Copilot Chat extension version
  (`code --list-extensions --show-versions`) for the doc.

  verify: `status` reports the workspace, the `~/.copilot/skills/agento` symlink, `agento-probe-copy`, and the log dir as installed.
- [ ] 2.2 (manual) Open the probe workspace (`code --new-window <workspace path from setup>`), start a chat with Session Target **Local**, and run every prompt in `tests/harness-probe/PROMPTS.md` in order. Reply with what the model reported for each prompt and attach one screenshot of the chat — verify: screenshot saved as `evidence/step-2-2-local-session.png`; the log dir holds SessionStart and PreToolUse files.
- [ ] 2.3 Run `node tests/harness-probe/probe.mjs collect --harness local`.

  verify: `tests/harness-probe/fixtures/local/` holds SessionStart and PreToolUse fixtures; `node --test tests/harness-probe/probe.test.mjs` passes.
- [ ] 2.4 (manual) In the same probe window, start a chat with Session Target **Copilot** and run every prompt in `PROMPTS.md` again. Then, in the primary Agento window with the chat Session Target set to Copilot, dispatch `/agento delivery-status` from the Agento dashboard and note what arrives (query text, mode, attachments). Reply with the observations and attach one screenshot per window — verify: `evidence/step-2-4-copilot-session.png` and `evidence/step-2-4-copilot-dispatch.png` saved; the log dir holds new files.
- [ ] 2.5 Run `node tests/harness-probe/probe.mjs collect --harness copilot`.

  verify: `tests/harness-probe/fixtures/copilot/` holds SessionStart and PreToolUse fixtures; probe tests pass.
- [ ] 2.6 Check `command -v copilot`. When the CLI is present, run
  `copilot plugin install` on the `tests/harness-probe/plugin` directory and record
  the `copilot plugin list` output; when it is absent, record that.

  verify: the output or absence is recorded in this step's line.
- [ ] 2.7 (manual) Add the `tests/harness-probe/plugin` absolute path (printed by `setup`) to `chat.pluginLocations` in user settings, reload the probe window, start one Local chat and one Copilot chat, send prompts 1–2 of `PROMPTS.md` in each, then remove the `chat.pluginLocations` entry and reload. Attach one screenshot — verify: `evidence/step-2-7-plugin-sessions.png` saved; the log dir holds plugin-source files or is empty (itself a finding).
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
