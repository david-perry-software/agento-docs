# Review: harness-probe

Verdict: approve

Reviewed 2026-10-15 against product `feature/harness-probe` at `ed36704` (PR #114) and
companion `feature/harness-probe` at `61b81c4` (PR #52). `origin/main` is an ancestor
of both HEADs; both trees were clean (`git status --porcelain --untracked-files=all`
empty) before and after review. Skills consulted: none — the repository has no
`.agents/skills/` directory and AGENTS.md has no skills table (unchanged since the
plan).

## Acceptance checklist results

1. **`tests/harness-probe/probe.test.mjs` coverage** — **pass.** `node --test
   tests/harness-probe/probe.test.mjs`: 20 tests, 20 pass, 0 fail. The file covers the
   logger (one file per call, env names only, every marker's output shape, exit 2,
   malformed stdin → exit 0 silent), setup/status/teardown in a temp `HOME` including
   the foreign-`agento` refusal and the untouched-foreign-entry teardown, the sanitizer
   (placeholders, dropped keys, `/home/x` and `ghp_` refusals write nothing), the
   committed-fixture deny-pattern scan, and the doc link resolution test.
2. **Sanitized fixtures for both harnesses** — **pass.** `tests/harness-probe/fixtures/`:
   `local/` 27 (1 SessionStart, 26 PreToolUse incl. `run_in_terminal`, `create_file`,
   `replace_string_in_file`), `copilot/` 12 (3 SessionStart, 9 PreToolUse incl. `Bash`,
   `Write`, `Edit`, `Read`, `Agent`), `local-plugin/` 8 (4 plugin-source, 4
   workspace), `copilot-plugin/` 4 (workspace only; the plugin-source absence is
   recorded in roadmap 2.7/2.8 and the doc). No `apply_patch` tool exists in either
   harness, as the doc states. The doc's evidence column links resolve (link test).
3. **`docs/copilot-harness.md` answers every brief question** — **pass.** Read against
   the plan's six questions: plugin loading (`chat.pluginLocations` observed; `copilot
   plugin install` unobserved with the reason), hook discovery and
   `${CLAUDE_PLUGIN_ROOT}` (Local expanded — `local-plugin/plugin-SessionStart-1.json`
   lists `CLAUDE_PLUGIN_ROOT` in `envVarNames`; Copilot hook errored), payload fields
   per event, honored output slots, exit 2, skill resolution with arguments (direct
   and symlinked), subagents/pins (Local observed, Copilot stalled and recorded as
   unobserved), and `workbench.action.chat.open` dispatch. I re-derived the field
   tables from the committed fixtures with a script: SessionStart keys (Local
   `timestamp, hook_event_name, session_id, transcript_path, source, model, cwd`;
   Copilot `hook_event_name, session_id, timestamp, cwd, source, initial_prompt`) and
   PreToolUse keys (Local adds `tool_use_id`, `transcript_path`; Copilot lacks both)
   match the doc exactly. See Findings 1, 2, and 4 for precision gaps (all minor).
4. **Each (manual) step has linked screenshots showing no secrets** — **pass.** 2.2:
   `evidence/step-2-2-local-{session,file-edits,subagent-pinned,subagent-unpinned}.png`
   + observations.md; 2.4: `evidence/step-2-4-copilot-{session,hook-markers,file-edits,
   skills,subagent-stall,exit2,dispatch}.png` + observations.md; 2.7:
   `evidence/step-2-7-plugin-sessions{,-copilot}.png`. All 15 files exist on the branch
   and every roadmap link resolves. Visually checked: chat transcripts, hook cards,
   the dashboard dispatch input (`/agento delivery-status` with `delivery-status.md`
   attached), the Agent Plugins list (`agento`, `agento-probe-plugin`). Home-directory
   paths appear (e.g. `/home/david/.copilot/skills/agento`); no tokens, credentials, or
   account data.
5. **Initiative breakdown reflects the findings** — **pass.** `node scripts/agento.mjs
   initiative copilot-harness` → `status: ok`, `errors: []`, `anomalies: []`. The
   companion diff rewrites `### Harness behavior` as observed facts citing
   `docs/copilot-harness.md`, updates Brief/Independence for `copilot-hook-compat`,
   `agents-copilot-models`, `agento-router-skill`, `harness-install`,
   `dispatch-copilot-harness`, updates `## Risks`, bumps `last-updated` to 2026-10-15,
   and leaves the `### harness-probe` block and every `Requires:` untouched (no hunk
   touches them).
6. **Teardown leaves no probe state** — **pass**, re-verified independently: `node
   tests/harness-probe/probe.mjs status` → `installed: {workspace:false,
   agentoSymlink:false, agentoProbeCopy:false, logDir:false, logFileCount:0}`,
   `pluginLocations.entries: []`; `~/.copilot/skills/` holds only `use-railway`;
   `~/.cache/agento-harness-probe` is absent. `copilot plugin list` is unobserved
   (CLI absent, per step 2.6) — see Finding 3.
7. **No runtime file changed** — **pass.** `git diff --name-only origin/main...HEAD |
   grep -vE '^(tests/harness-probe/|docs/copilot-harness\.md$)'` → 0 lines.
8. **Full lint and test gate** — **pass**, all re-run by the Reviewer in the product
   worktree: `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` (ShellCheck
   0.11.0 from the npx cache, as the plan records) exit 0, no findings — identical to
   the green baseline; `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`
   exit 0 — 535 tests, 535 pass, 0 fail (baseline 515 + the 20 probe tests);
   `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` exit 0;
   `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh <
   tests/guard-fixtures-companion.txt` exit 0.
9. **Both halves clean at handoff** — **pass.** Both `git status --porcelain
   --untracked-files=all` outputs are empty; session record shows the companion
   `dirty: false, ahead: 0, behind: 0`.

## Plan vs implementation

- Layout matches `## Approach` exactly: `probe.mjs`, `log-payload.mjs`,
  `probe.test.mjs`, `PROMPTS.md`, `workspace/`, `plugin/`, `skills/`, `fixtures/`, and
  `docs/copilot-harness.md`; nothing under `scripts/`, `.github/`, `hooks/`,
  `commands/`, or `extension/` changed.
- The logger lives outside protected paths and `probe.mjs` performs the workspace copy,
  `probe.json` rewrite, symlink, and removals in Node; its only shell calls are `git`
  on the copied workspace and `copilot plugin …`. The guard behaved as the plan
  predicted (my own `cat` of the fixture wiring on a shell line was denied; the files
  were read with the edit tool instead).
- Steps 2.31–2.33 (added 2026-10-13) extended `PROMPTS.md` mid-build: exit-2 marker
  last, Configure Tools + 5c, and the plugin-disabled retry 4b. 5c is reflected in the
  Local observations (pinned agent under a DeepSeek parent). 4b was never executed
  (Finding 2).
- Step 2.7 produced two screenshots instead of the planned one and recorded a
  confound (the user's real `agento-plugin` was active in the probe window); both are
  documented on the step and in the breakdown.
- The dashboard dispatch was driven from the probe window's Agento dashboard (shown as
  PRIMARY WINDOW · master) rather than the main Agento clone; the observation (query
  filled, `delivery-status.md` attached, Agent mode, not submitted) is the one the plan
  asked for and the screenshot shows it.
- `collect` has no per-session filter; step 2.8 partitioned the shared log dir by
  timestamp by hand and recorded the procedure. Works, but see Follow-ups.
- Undocumented changes: none.

## Roadmap audit

Every one of the 19 ticked steps was spot-checked against the branches:

- 1.1–1.4: files present; the three JSON wiring files parse; the probe tests pass.
- 2.1: versions recorded on the line.
- 2.2, 2.4, 2.7 `(manual)`: each links existing evidence files with the completion
  date on the line.
- 2.3, 2.5, 2.8: fixture counts match the recorded numbers (27 / 12 / 8 + 4).
- 2.31: `grep -n 'echo AGENTO_PROBE_EXIT2' tests/harness-probe/PROMPTS.md` hits only
  Prompt 6. 2.32/2.33: Prompt 5 names Configure Tools and 5c; Prompt 4b exists.
- 2.6: CLI absence recorded.
- 3.1–3.3, 4.1: verified under the acceptance checklist above.

No falsely ticked boxes; no missing-work steps needed; no repairs made.

## Findings

1. **Minor — the plugin-hook failure cause is stated more firmly than the evidence
   supports.** `tests/harness-probe/plugin/hooks/hooks.json` runs
   `node ${CLAUDE_PLUGIN_ROOT}/../log-payload.mjs`, i.e. it escapes the plugin root.
   In Copilot the model reported "the hook from agento-probe-plugin errored" and no
   plugin-source log was written. The doc's findings table (row 4) and the breakdown's
   `harness-install` Brief and `## Risks` read this as the `${CLAUDE_PLUGIN_ROOT}` path
   not resolving. An unexpanded token is one candidate; a plugin staged/copied by the
   Agent Host (making `../log-payload.mjs` point outside the copy) or `node` missing
   from the Copilot hook environment produce the same symptom, and the real plugin's
   hooks stay *inside* its root, so this result does not transfer to it as written.
   The roadmap 2.7/2.8 lines hedge with "likely"; the doc and breakdown should carry
   the same hedge and name the candidate causes. No code change in this delivery;
   re-probe is a follow-up.
2. **Minor — Prompt 4b was added but never run.** `tests/harness-probe/PROMPTS.md`
   Prompt 4b (disable the Agento plugin, retry `/agento delivery-status --probe-arg x`)
   was added by step 2.33 after the Local run (2.2) and is absent from both
   observation notes. `docs/copilot-harness.md` therefore answers the Local half of the
   skill-resolution question only as "shadowed by the plugin"; whether a user-level
   `agento` skill resolves in Local when unshadowed is unobserved and the doc should
   say so.
3. **Minor — `haveCopilot()` conflates the VS Code shim with the CLI.**
   `tests/harness-probe/probe.mjs` `haveCopilot()` returns true whenever `copilot
   --version` is not `ENOENT`; on this machine that is the Copilot Chat shim that
   prompts to install the CLI, so `uninstallPlugin()` reports `{copilot: true,
   installed: false}` from a `plugin list` that never ran against a real CLI. Step 2.6
   records the truth (CLI absent, `plugin list` unobserved); the 3.3 line's "`copilot
   plugin list` lacks `agento-probe-plugin`" should be read with that caveat.
4. **Minor — the doc's Local `tool_name` list is incomplete.** The committed `local/`
   fixtures also carry `read_file`, `list_dir`, `tool_search`, `runSubagent`, and
   `vscode_askQuestions` PreToolUse payloads; the doc lists only `run_in_terminal`,
   `create_file`, `replace_string_in_file`. That subagent and ask-user calls are
   visible to a Local PreToolUse hook is useful for `copilot-hook-compat`'s
   normalisation table and is worth a sentence.
5. **Minor — breakdown wording.** `agento-router-skill` Brief says the inline fallback
   is "recorded with the user's approval", which reads as already granted; the
   `## Risks` entry and `docs/copilot-harness.md` correctly defer that approval to the
   consuming delivery. Align the Brief when `agento-router-skill` is planned.
6. **Info — screenshots show home paths.** Not secrets (policy §1), and the committed
   fixtures are scrubbed to `<HOME>`/`<USER>`/`<REPO>`/`<PROBE_WS>` and pass the
   deny-pattern scan; noted only so a later redaction pass knows where they are.

Security: the logger records env-variable names only; raw payloads live in
`~/.cache/agento-harness-probe/logs` until `collect` sanitizes them and `teardown`
removes the directory; `collect` refuses and writes nothing on any deny-pattern hit.
No secrets, tokens, or credentials appear in the diff.

## Follow-ups

- Re-run the plugin probe in a Copilot session with the logger copied *inside*
  `tests/harness-probe/plugin/` (a path that stays under `${CLAUDE_PLUGIN_ROOT}`) and
  with an absolute `node` path, so the "hook errored" cause is separated into
  token-expansion vs. staged-copy vs. hook-env (Finding 1) before `copilot-hook-compat`
  and `harness-install` build on it.
- Run `PROMPTS.md` Prompt 4b in a Local session and record whether a user-level
  `~/.copilot/skills/agento` resolves with arguments when no plugin shadows it
  (Finding 2); update the doc's skill-resolution row.
- Add a `--since <ISO>` (or `--session <id>`) filter to `probe.mjs collect` so two
  plugin sessions sharing one log dir no longer need the manual partitioning recorded
  in step 2.8.
- Make `haveCopilot()` distinguish the VS Code shim from the standalone CLI (e.g.
  require `copilot plugin list` to exit 0 with parseable output) so teardown reports
  `unobserved` instead of `installed: false` (Finding 3).
- Extend the doc's Local tool table with the subagent/ask-user tool ids seen in the
  fixtures (Finding 4), and align the `agento-router-skill` Brief wording on user
  approval (Finding 5).
