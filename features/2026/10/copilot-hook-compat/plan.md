# Copilot hook compatibility: delivery guard and session context under the Copilot harness

## Problem

Member `copilot-hook-compat` of the
[copilot-harness initiative breakdown](../../../../initiatives/2026/10/copilot-harness/breakdown.md)
(block `### copilot-hook-compat`, wave 2).

When the chat's Session Target is **Copilot** (Agent Host), Agento's hooks do not
behave as they do in **Local**:

- `scripts/hooks/session-context.mjs` `main()` (L148–L157) emits only
  `{ hookSpecificOutput: { additionalContext } }`. The Copilot harness reads only the
  top-level `additionalContext` (docs/copilot-harness.md "Honored output shapes"), so a
  Copilot session gets no `Agento CLI:` / `Session:` context line and every `/agento`
  command loses its CLI path and window check hint.
- `scripts/hooks/delivery-guard.mjs` `main()` (L418–L427) emits only the nested
  `hookSpecificOutput.permissionDecision`. Copilot happens to read that slot too, but
  the guard relies on that by accident; the top-level slot Copilot documents is
  missing, and `decide()` (L191–L203) recognises Copilot tool names (`Bash`, `Write`,
  `Edit`, `Read`, `Agent`) only because they happen to lowercase into its regexes. It
  ignores a `toolArgs` JSON string and a string-valued `tool_input`.
- Target repositories (e.g. soshiki) are guarded only through the plugin's
  `hooks/hooks.json` (`${CLAUDE_PLUGIN_ROOT}/scripts/hooks/…`). In the probe's Copilot
  plugin run the plugin hook "errored" and its logger never ran, so a Copilot session
  in a target repo is currently **unguarded and context-less**. The harness-probe
  review (Finding 1) notes the cause is unproven: an unexpanded token, a staged plugin
  copy (the probe's `../log-payload.mjs` escaped the root), or `node` missing from the
  hook `PATH` all produce the same symptom.
- `scripts/hooks/replay-guard.sh` (L57–L59) only builds Local payloads
  (`tool_name: "run_in_terminal"`) and reads only the nested slot, so no replay proves
  Copilot behavior.

User-visible effect after this feature: in a Copilot session (in the Agento clone and,
if the plugin wiring can be made to resolve, in a target repo) the `Agento CLI:` line
is present, `git push origin main` is denied, and editing `.github/hooks/x.json` asks;
Local sessions behave exactly as today.

## Decisions

Clarifying questions asked with the ask-questions tool on 2026-10-15 (recommended
option marked; answers verbatim):

1. **Target-repo wiring.** Q: Target repos (e.g. soshiki) get the guard only via the
   plugin hooks.json, whose `${CLAUDE_PLUGIN_ROOT}` path did not resolve in Copilot.
   How far should this member go? Recommended: "Scripts + Agento clone only; hand
   target-repo wiring to harness-install as a recorded Follow-up". **A: "Also make the
   plugin hooks.json path resolve in Copilot (approval-gated wiring edit) within this
   member"** (not the recommended option).
2. **Copilot ask semantics.** Q: In Copilot a top-level 'ask' shows a hook card and then
   runs under the session's permission mode (not a hard prompt). How should the guard
   treat its 'ask' verdicts there? **A: "Keep 'ask' unchanged in both harnesses;
   document the Copilot semantics as a risk"** (recommended).
3. **Input normalization.** Q: How broad should decide()'s input normalization be?
   **A: "Explicit Copilot↔Local tool-name map + defensive toolArgs/tool_input
   JSON-string parsing; malformed input → allow"** (recommended).
4. **Replay format.** Q: How should replay-guard.sh support the Copilot format? **A:
   "REPLAY_FORMAT=copilot env: replays the existing fixture files as Bash payloads and
   reads the top-level decision, plus a small tests/guard-fixtures-copilot.txt for
   Write/Edit path cases"** (recommended).
5. **Live harness checks.** Q: Live checks in a Copilot chat session can't be driven by
   the agent. How should they be verified? **A: "(manual) steps with screenshots for
   the Copilot session (context line, push-to-main deny, hook-file ask); Local checks
   run by the agent in-session"** (recommended).

Carried from the initiative (breakdown `## Decisions`): every member keeps the Local
harness fully working and verifies Local too; hook wiring files change only if the
spike requires it, and such edits are approval-gated. Decision 1 above is that
requirement: the probe left the plugin-hook failure unexplained, so this member
re-probes it and changes `hooks/hooks.json` only on evidence.

## Research

Skills consulted: agent-customization (built-in VS Code skill: hook file formats,
event names, and plugin layout). The Agento repository has no `.agents/skills/`
directory and its AGENTS.md has no skills table (verified 2026-10-15 on `main`
`972e911`).

### Lint and test baseline (policy §5)

- Command: `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` (AGENTS.md "Shell
  lint"); the repository's only linter. `shellcheck` is not on `PATH`; the run used the
  npx-cached binary (`~/.npm/_npx/<hash>/node_modules/.bin/shellcheck`, ShellCheck
  0.11.0) by putting its directory first on `PATH` (as harness-probe did).
- Run 2026-10-15 on `main` `972e911`: **exit 0, no findings**. Overlap decision: the
  baseline is green, so the **full** lint gate applies. `replay-guard.sh` is in the
  linted set and is edited here.
- Tests: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → exit 0, 535
  tests, 535 pass, 0 fail (2026-10-15, `972e911`).

### Observed harness behavior (docs/copilot-harness.md, tests/harness-probe/fixtures/)

- Copilot `PreToolUse` payloads (`tests/harness-probe/fixtures/copilot/workspace-PreToolUse-*.json`):
  `tool_name` `Bash` with `tool_input.command`; `Write` with `tool_input.path` +
  `file_text`; `Edit` with `path`, `old_str`, `new_str`; `Read` with `path`; `Agent`
  with `agent_type`, `prompt`; `tool_search_tool` with `query`. `tool_input` is always
  an object in the captures; no `toolArgs` was observed. No `apply_patch` tool exists in
  either harness.
- Local `PreToolUse` uses `run_in_terminal`, `create_file`, `replace_string_in_file`
  with `filePath` (`tests/harness-probe/fixtures/local/`).
- Honored output: Local reads only `hookSpecificOutput.*`; Copilot reads top-level
  `additionalContext` for SessionStart and both nested and top-level
  `permissionDecision` for PreToolUse. Each harness ignores the other's keys, so one
  dual-shape object is safe.
- Copilot `ask`: shows a hook card, then the tool runs under the session's permission
  mode (observed with "Manual permissions").
- Exit 2 fails closed in both harnesses.
- Copilot workspace-hook env has `COPILOT_*` and `CLAUDE_PROJECT_DIR`, no `VSCODE_*`,
  no `CLAUDE_PLUGIN_ROOT`. The Copilot plugin-source hook never logged (harness-probe
  roadmap 2.7/2.8; review Finding 1 lists three candidate causes).

### Code facts

- `scripts/hooks/delivery-guard.mjs`:
  - `decide()` L191–L203 reads `tool_name || toolName` and `tool_input || toolInput`
    only when the input is an object; the command comes from
    `command|commandLine|text`, the path from `filePath|file_path|path|uri`.
  - `WRITE_TOOL` L24 = `/edit|create|write|replace|patch|apply|insert|notebook/` on the
    lowercased tool name.
  - `main()` emits only `hookSpecificOutput` and allows on a crash (try/catch).
- `scripts/hooks/session-context.mjs`: `isDuplicatePluginRun()` (L139–L145) suppresses
  the plugin-hook run only when `CLAUDE_PLUGIN_ROOT`/`PLUGIN_ROOT` is set and the repo
  has workspace wiring; `main()` (L148–L157) emits only `hookSpecificOutput`.
- `scripts/hooks/hook-lib.mjs` `emit()` (L186) writes the object as JSON.
- Wiring: `.github/hooks/delivery-guard.json` and `session-start.json` (relative
  `./scripts/hooks/…`); plugin `hooks/hooks.json` (`${CLAUDE_PLUGIN_ROOT}/scripts/hooks/…`).
  `tests/customizations.test.mjs` L905–L950 asserts every plugin hook command starts
  with `${CLAUDE_PLUGIN_ROOT}/` and resolves to an executable under the root (#36
  plugin-hooks-layout). Both wrappers exit 0 silently when `node` is not on `PATH`.
- Tests that parse hook output: `tests/guard.test.mjs` `decide()` helper (L12–L30)
  reads `hookSpecificOutput`; `tests/session-context.test.mjs` L48–L49 likewise, and
  L306–L324 cover the plugin-run dedupe.
- Replays: `tests/guard-fixtures.txt`, `tests/guard-fixtures-companion.txt`;
  `.github/workflows/ci.yml` L23 runs only the first; `docs/hooks.md` L107–L112
  documents both.
- The probe plugin `tests/harness-probe/plugin/hooks/hooks.json` runs
  `node ${CLAUDE_PLUGIN_ROOT}/../log-payload.mjs …` (escapes its root); its
  `probe.mjs setup|collect|teardown` installs and sanitizes captures.
- `extension/cli/` copies only `scripts/*.mjs` (not `scripts/hooks/`), so hook edits
  need no `copy-cli`; a change to `scripts/agento.mjs` would.
- The guard denies `npx shellcheck …` naming `scripts/hooks/` and denied a planning
  command whose stdout was redirected after running `replay-guard.sh` (`… > /tmp/x.log
  2>&1`) as a hook write — a false positive recorded as a follow-up, not fixed here.

### Concurrent deliveries

`gh pr list --state open` returned no open PRs on 2026-10-15, so no file overlap.
`agents-copilot-models` (same wave) is unplanned and touches `.github/agents/` and
`scripts/model-*.mjs`, which this plan does not.

## Approach

1. **Dual-shape output.** `delivery-guard.mjs` `main()` emits
   `{ permissionDecision, permissionDecisionReason, hookSpecificOutput: { hookEventName,
   permissionDecision, permissionDecisionReason } }`; `session-context.mjs` `main()`
   emits `{ additionalContext, hookSpecificOutput: { hookEventName, additionalContext } }`.
   Allow stays "no output". Both keep their crash → allow/no-context try/catch.
2. **Input normalization in `decide()`.** A small explicit tool map: Copilot `Bash` and
   Local `run_in_terminal` → shell; Copilot `Write`, `Edit` and Local `create_file`,
   `replace_string_in_file` (and anything `WRITE_TOOL` already matches) → write;
   `Read`, `Agent`, `tool_search_tool` → neither. Tool input is the first of
   `tool_input`, `toolInput`, `toolArgs` that is an object, or a string that
   `JSON.parse`s to a plain object; anything else is `{}` (→ allow), never a throw.
   Verdicts for Local payloads are unchanged.
3. **Tests.** `tests/guard.test.mjs`: Copilot-shaped cases (Bash push to main → deny;
   Write/Edit `path` on `.github/hooks/x.json` → ask; Read → allow; `toolArgs` string →
   same verdict as object; malformed `toolArgs` → allow), both output slots asserted
   equal, and a fixture-driven test feeding every `tests/harness-probe/fixtures/{local,copilot}/*PreToolUse*.json`
   `parsedStdin` through the guard (exit 0, allow for the probe's echo/notes commands).
   `tests/session-context.test.mjs`: both context slots asserted equal; a Copilot
   SessionStart fixture payload yields the `Agento CLI:` line.
4. **Replay.** `replay-guard.sh` gains `REPLAY_FORMAT=copilot` (Bash payloads; reads
   the top-level decision and fails a line whose nested slot disagrees) and a
   `<verdict> @<Tool> <path>` line form for file-tool payloads, exercised by a new
   `tests/guard-fixtures-copilot.txt`. Both existing fixture files replay in both
   formats. `replay-guard.sh` is a protected path: its edit asks for approval.
5. **Plugin wiring in Copilot (decision 1).** Re-probe first: make the probe plugin's
   hooks self-contained inside its root and add a token-free diagnostic entry that logs
   cwd, `command -v node`, and the names/values of `*PLUGIN_ROOT*` env vars only.
   One manual Copilot plugin session settles the cause. Then fix `hooks/hooks.json`
   per the finding (e.g. a root-variable fallback, a cwd-relative path, or a node
   lookup) and update `tests/customizations.test.mjs` L905–L950 and
   `isDuplicatePluginRun()` to match, keeping Local's `${CLAUDE_PLUGIN_ROOT}` path
   working. If no in-plugin wiring can work in Copilot, the fix steps are marked
   obsolete with that reason and a Follow-up hands target-repo wiring to
   `harness-install`; the doc records the proven cause either way. All wiring edits
   are approval-gated.
6. **Docs/CI.** `docs/hooks.md` (dual-shape output, normalization, Copilot replay),
   `docs/copilot-harness.md` (plugin-hook cause resolved; Copilot `ask` semantics),
   AGENTS.md `## Commands` (Copilot replay line), `.github/workflows/ci.yml` (Copilot
   replay step). Broader docs stay with `harness-docs`.

Affected files: `scripts/hooks/delivery-guard.mjs`, `scripts/hooks/session-context.mjs`,
`scripts/hooks/replay-guard.sh`, `tests/guard.test.mjs`, `tests/session-context.test.mjs`,
`tests/guard-fixtures-copilot.txt` (new), `tests/harness-probe/plugin/hooks/hooks.json`,
`tests/harness-probe/probe.mjs` / `probe.test.mjs` / `PROMPTS.md` (diagnostic entry),
`tests/harness-probe/fixtures/copilot-plugin/` (new captures), `hooks/hooks.json` and
`tests/customizations.test.mjs` (only on evidence), `docs/hooks.md`,
`docs/copilot-harness.md`, `AGENTS.md`, `.github/workflows/ci.yml`.

## Risks

- **Copilot `ask` is weaker than Local's** (decision 2): it shows a hook card and the
  tool then runs under the session's permission mode, so under auto-approve a
  hook-file edit is not stopped. Mitigation: verdicts unchanged; the semantics are
  documented in docs/copilot-harness.md and docs/hooks.md, and the live Copilot check
  runs with "Manual permissions" as observed by the probe. `deny` verdicts (push to
  main, force-push, hook shell writes) are unaffected.
- **A guard crash fails closed in Copilot** (exit 2 blocks every tool; a thrown error
  could exit nonzero). Mitigation: normalization never throws (malformed → `{}`), the
  existing try/catch allows on any error, the wrapper keeps its no-node exit 0, and a
  test feeds malformed `toolArgs` and non-object `tool_input`.
- **Dual-shape output confuses a harness.** Resolved by the probe (disjoint keys).
  Mitigation: Local live check (decision 5) plus both replay formats.
- **The plugin-hook re-probe is inconclusive or shows no in-plugin fix** (e.g. the
  Agent Host never runs plugin hooks with a resolvable root). Mitigation: the fix steps
  become obsolete with the recorded cause and a Follow-up to `harness-install`; the
  Agento clone's workspace wiring is still verified live in Copilot. The step's
  evidence is the deciding artifact.
- **Changing `hooks/hooks.json` regresses Local plugin hooks** (#36: only the
  `.claude-plugin/` + `${CLAUDE_PLUGIN_ROOT}` layout substitutes the token in Local).
  Mitigation: the fix must keep the Local-expanded form working; the customizations
  test is updated, not removed; Local plugin behavior is checked live in soshiki.
- **Double context/verdicts in the Agento clone** if the plugin hook starts working in
  Copilot without `CLAUDE_PLUGIN_ROOT` set. Mitigation: `isDuplicatePluginRun()` is
  updated to the detection the re-probe proves; a test covers it.
- **Live checks use another plugin checkout.** The user's registered plugin is
  `/home/david/DP/agento-plugin`; soshiki checks must temporarily register this
  worktree instead (and restore afterwards), or the old code is tested. The manual
  step says so explicitly.

## Out of scope

- The router skill, `harness install|status`, agent frontmatter/models, extension
  dispatch, and the broad docs/version bump (other initiative members).
- `agento-init` scaffolding of workspace hooks into target repositories.
- Changing `ask` verdicts per harness (decision 2).
- The guard's redirect false positive on `replay-guard.sh … > file` (Follow-up).
- Claude and Codex harnesses.

## Acceptance checklist

- [ ] The guard emits one JSON object carrying both `hookSpecificOutput.permissionDecision`
  (+ reason) and top-level `permissionDecision` (+ `permissionDecisionReason`) with
  equal values for every non-allow verdict, and nothing for allow — `tests/guard.test.mjs`.
- [ ] Session context emits both `hookSpecificOutput.additionalContext` and top-level
  `additionalContext` with equal values, including for a Copilot SessionStart fixture
  payload — `tests/session-context.test.mjs`.
- [ ] `decide()` gives the same verdicts for Copilot payloads (`Bash`/`command`,
  `Write`/`Edit` with `path`) as for the equivalent Local payloads, parses a `toolArgs`
  or string `tool_input` JSON object, and allows (never throws) on malformed input —
  `tests/guard.test.mjs`.
- [ ] Every captured `tests/harness-probe/fixtures/{local,copilot}/*PreToolUse*.json`
  payload runs through the guard with exit 0 — fixture-driven test.
- [ ] `REPLAY_FORMAT=copilot` replays `tests/guard-fixtures.txt`,
  `tests/guard-fixtures-companion.txt` (with `REPLAY_COMPANION=1`), and
  `tests/guard-fixtures-copilot.txt` with exit 0; the default format replays of the
  first two still exit 0; CI runs the Copilot replay.
- [ ] The Copilot plugin-hook failure cause is proven by captured fixtures under
  `tests/harness-probe/fixtures/copilot-plugin/` and stated in docs/copilot-harness.md;
  either `hooks/hooks.json` resolves in Copilot (evidence of a plugin-source capture or
  a live guarded target-repo session) with the customizations test updated, or the fix
  steps are marked obsolete with that cause and a `harness-install` Follow-up.
- [ ] Live Local check (agent, in the build window): an agent-typed `git push origin
  main --dry-run` is denied and an edit to `.github/hooks/x.json` asks — recorded on
  the roadmap step.
- [ ] Live Copilot check in the Agento worktree (manual, screenshot): the `Agento CLI:`
  line is present, `git push origin main` is denied, editing `.github/hooks/x.json`
  shows the approval card — `evidence/step-4-2-copilot-clone.png`.
- [ ] Live target-repo check in soshiki, Copilot and Local (manual, screenshot), only
  if the plugin wiring fix landed — `evidence/step-4-3-soshiki.png`.
- [ ] Full gate green: shellcheck (no findings, compared with the green baseline), the
  full node test suite, all replays in both formats.
- [ ] docs/hooks.md, docs/copilot-harness.md, AGENTS.md `## Commands`, and ci.yml
  describe the dual-shape output, normalization, Copilot `ask` semantics, and the
  Copilot replay.
