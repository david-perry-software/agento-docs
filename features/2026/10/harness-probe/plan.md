# Harness probe: record how the Copilot harness really loads skills, agents, and hooks

## Problem

The [copilot-harness initiative](../../../../initiatives/2026/10/copilot-harness/breakdown.md)
(member block `### harness-probe`) plans to make Agento work when a chat's Session
Target is **Copilot** (the Agent Host harness). Every later member depends on how that
harness actually behaves, but the breakdown's `## Research` only has documentation
claims ("unverified until `harness-probe`"):

- Does `chat.pluginLocations` or `copilot plugin install` load a plugin?
- Are `.github/hooks/*.json` and a plugin's `hooks/hooks.json` discovered, and is
  `${CLAUDE_PLUGIN_ROOT}` expanded?
- What hook input payloads are sent, and which output shapes are honored?
- Does `~/.copilot/skills/agento` resolve as `/agento` with arguments, including
  through a symlink?
- Can a subagent ask the user and nest? Do model pins apply, and in what model-name
  format?
- What does `workbench.action.chat.open {query, mode, attachFiles}` do in a Copilot
  session?

If these guesses are wrong, the guard silently fails open, the router does not resolve,
or agents run on the wrong model. This feature replaces the guesses with recorded
observations: a reproducible probe, sanitized captured payloads committed as fixtures,
and `docs/copilot-harness.md`. It changes no runtime behavior.

## Decisions

From the initiative (breakdown `## Decisions`, carried in full): full Copilot-harness
support with no "default to Local" stopgap; one `agento` router skill; the router hands
each command to its `agent:` custom agent as a subagent; `commands/*.md` stays the
single source; every member also verifies Local.

Clarifying questions asked with the ask-questions tool on 2026-10-13. The
recommended option is marked; answers are retained verbatim.

- **Q: Where should the probe's payload-logging hooks, throwaway skill and agent live
  while probing?** A: Self-contained fixture workspace under
  tests/harness-probe/workspace/ (own .github/hooks, skills, agents), opened as a
  separate VS Code window. *(recommended option)*
- **Q: Driving a Copilot-target chat session needs the VS Code UI, which the agent
  cannot operate. How should those observations be gathered?** A: (manual) steps: you
  run scripted probe prompts in a Copilot session; the hook logs payloads to files the
  agent then converts to fixtures; you attach one screenshot per step.
  *(recommended option)*
- **Q: The probe needs ~/.copilot/skills/<test-skill> (and a symlinked variant) and
  possibly a `copilot plugin install`. Who sets these up?** A: Probe script installs
  and uninstalls them (`probe setup` / `probe teardown`), with teardown a verified
  roadmap step. *(recommended option)*
- **Q: Captured payloads contain home paths, session ids, and maybe tokens. How should
  committed fixtures be sanitized?** A: Probe script redacts: home dir → <HOME>,
  ids/timestamps → placeholders, drops any env/token-like fields; a test asserts no
  /home/ or token patterns remain. *(recommended option)*
- **Q: If findings contradict the breakdown (e.g. symlinked skill doesn't resolve as
  /agento), what does this feature do?** A: Also update the initiative breakdown in
  the companion repo in this delivery. *(The recommended option was: record them in
  docs/copilot-harness.md with a per-member impact table plus roadmap Follow-ups,
  without editing the breakdown. The user chose to update the breakdown too.)*

## Research

Skills consulted: agent-customization (built-in VS Code skill: skill, agent, and hook
file formats and locations, as consulted for the initiative). The Agento repository has
no `.agents/skills/` directory and its AGENTS.md has no skills table (verified
2026-10-13 on `main` `15e67eb`).

### Lint baseline (policy §5)

- Command: `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` (AGENTS.md
  "Shell lint"; CI runs the same in `.github/workflows/`). It is the repository's only
  linter: there is no eslint, prettier, or markdownlint configuration.
- Run 2026-10-13 on `main` `15e67eb`: **exit 0, no findings**. `shellcheck` is not on
  `PATH` on this machine; the run used the npx-cached binary
  (`~/.npm/_npx/<hash>/node_modules/.bin/shellcheck`, ShellCheck 0.11.0) by putting
  its directory first on `PATH`. Running it as `npx shellcheck …` is denied by the
  delivery guard (`npx` is not in `READ_ONLY` in `scripts/hooks/delivery-guard.mjs`
  L31–L39, so any `npx` command line naming `scripts/hooks/` is treated as a hook
  write).
- Overlap decision: the baseline is green, so the **full** lint gate applies. This
  feature adds no `.sh` files (the probe is Node). If one is added, it joins the
  shellcheck command in the gate step.
- Test baseline: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` — see the
  result recorded below.

### Concurrent deliveries

`gh pr list --state open` returned no open PRs on 2026-10-13, so no file overlap.

### Codebase facts that shape the probe

- **The guard protects any path containing `.github/hooks/`, `scripts/hooks/`,
  `hooks/hooks.json`, or `.claude-plugin`, at any depth.** `PROTECTED_PATHS` in
  `scripts/hooks/delivery-guard.mjs` L21 is unanchored. So the fixture files
  `tests/harness-probe/workspace/.github/hooks/*.json`,
  `tests/harness-probe/plugin/hooks/hooks.json`, and
  `tests/harness-probe/plugin/.claude-plugin/plugin.json`:
  - ask for approval on every edit-tool write (L208–L210);
  - are denied for shell writes (`hookFileVerdict`, L139–L168).

  The logger script therefore lives outside those paths
  (`tests/harness-probe/log-payload.mjs`), and setup and teardown copy and remove the
  fixtures from Node, so no shell command line names a protected path.
- **The guard's current input handling** (`decide()` L191–L203): it reads
  `tool_name|toolName` and `tool_input|toolInput` (object only) and takes the file
  path from `filePath|file_path|path|uri`. Its output is only
  `{ hookSpecificOutput: { permissionDecision, … } }`. SessionStart output is only
  `{ hookSpecificOutput: { hookEventName, additionalContext } }`
  (`scripts/hooks/session-context.mjs` L152). The probe must find out which of these
  fields the Copilot harness sends and reads.
- **Wiring checks only cover the repo's own wiring.** `tests/customizations.test.mjs`
  checks hook wiring only for root `.github/hooks/*.json` and the plugin's
  `hooks/hooks.json` (L896–L925). The root `.claude-plugin/plugin.json` is the only
  manifest it reads. Fixture copies under `tests/harness-probe/` are not checked, and
  the root-layout assertions (L927–) are unaffected.
- **Guidance spelling rules apply to `docs/*.md`.** `guidanceFiles` includes
  `docs/*.md` (`tests/customizations.test.mjs` L778–L787). `docs/copilot-harness.md`
  must therefore:
  - never write a bare `/<command-name>` (L789–L798);
  - never write a `.prompt`/`.md`-suffixed command (L800–L815);
  - never sequence close-session before ship (L817–).

  Probe skill names must not equal an Agento command name.
- **Tests are picked up by glob.** `node --test 'tests/**/*.test.mjs'` picks up
  `tests/harness-probe/*.test.mjs`. `extension/cli/` copies only the files listed in
  `extension/scripts/copy-cli.mjs` from `scripts/`, so nothing under `tests/` affects
  the extension.
- **Where the probe's test inputs come from:**
  - Dispatch path: `extension/src/commandDispatcher.ts` `chatOpenOptions` calls
    `workbench.action.chat.open` with `{ query, mode, attachFiles }`. The probe drives
    it through the existing dashboard dispatch of `/agento delivery-status` (read-only)
    with the chat panel's Session Target set to Copilot.
  - Model pins use the VS Code picker format (`Claude Opus 5.5 (copilot)`) in
    `.github/agents/*.agent.md`. The probe agent copies one pin verbatim.
- **Second plugin checkout.** `/home/david/DP/agento-plugin` also exists (initiative
  research). The probe never installs anything named after that checkout. Teardown
  removes `~/.copilot/skills/agento` only when it is the probe's own symlink.

### Test baseline

`node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` on `main` `15e67eb`,
2026-10-13: **exit 0 — 515 tests, 515 pass, 0 fail** (≈259 s).

## Approach

All product files are new and sit under `tests/harness-probe/` plus one doc. Nothing
under `scripts/`, `.github/`, `hooks/`, `commands/`, or `extension/` changes.

```
tests/harness-probe/
  probe.mjs              # CLI: setup | status | collect --harness <label> | teardown
  log-payload.mjs        # hook logger: appends stdin + event + env-var *names* to the log dir
  probe.test.mjs         # node:test: logger, setup/teardown in a temp HOME, sanitizer, fixture scan, doc links
  PROMPTS.md             # numbered probe prompts the user types (Local and Copilot runs)
  workspace/             # copied by `setup` to ~/.cache/agento-harness-probe/workspace and git-init'ed
    .github/hooks/probe.json          # SessionStart + PreToolUse (PascalCase, no version) → logger
    .github/agents/probe-pinned.agent.md    # model: "Claude Opus 5.5 (copilot)", tools incl. vscode/askQuestions
    .github/agents/probe-unpinned.agent.md  # no model:, tries ask-user and a nested subagent
    README.md
  plugin/                # loaded via chat.pluginLocations and, when the CLI exists, `copilot plugin install`
    .claude-plugin/plugin.json        # name agento-probe-plugin
    hooks/hooks.json                  # ${CLAUDE_PLUGIN_ROOT}/… → logger shim, labelled source=plugin
  skills/
    agento/SKILL.md                   # symlinked to ~/.copilot/skills/agento by setup
    agento-probe-copy/SKILL.md        # copied to ~/.copilot/skills/agento-probe-copy by setup
  fixtures/<harness>/<source>-<event>-<n>.json   # sanitized captures written by `collect`
docs/copilot-harness.md
```

- **Logger (`log-payload.mjs`).** It reads stdin and writes one JSON file per
  invocation to `$AGENTO_PROBE_LOG_DIR` (default
  `~/.cache/agento-harness-probe/logs`). Each file records:
  - `source` (`workspace` or `plugin`, from argv) and the event name from argv;
  - argv and cwd;
  - the **names** (never values) of environment variables matching
    `PLUGIN_ROOT|CLAUDE_|COPILOT_|VSCODE_`;
  - the raw stdin, parsed as JSON when possible.

  It answers based on markers in the stdin, so honored output shapes can be told
  apart:
  - **SessionStart** emits one object with nested
    `hookSpecificOutput.additionalContext: "PROBE_CTX_NESTED"` and top-level
    `additionalContext: "PROBE_CTX_TOPLEVEL"`. The user asks the model which
    `PROBE_CTX_*` tokens it sees.
  - **PreToolUse**, when the tool input contains:
    - `AGENTO_PROBE_DENY_NESTED` → deny in `hookSpecificOutput` only;
    - `AGENTO_PROBE_DENY_TOPLEVEL` → top-level `permissionDecision` only;
    - `AGENTO_PROBE_ASK_TOPLEVEL` → top-level ask;
    - `AGENTO_PROBE_EXIT2` → exit 2, to check the fail-closed claim.

  Otherwise it is silent and exits 0. Any internal error is caught: it exits 0 with no
  output, so the probe can never wedge a session.
- **`probe.mjs`.** It honors `HOME` and `AGENTO_PROBE_LOG_DIR` so tests run in a temp
  HOME. It never shells out with a command line that names a protected path.
  - `setup`:
    - copies `workspace/` to `~/.cache/agento-harness-probe/workspace`, rewrites
      `probe.json` with the absolute logger path, and runs `git init` and an initial
      commit there;
    - symlinks `~/.copilot/skills/agento` → `tests/harness-probe/skills/agento`, and
      refuses when that path exists and is not the probe's symlink;
    - copies `skills/agento-probe-copy`;
    - creates the log dir;
    - prints JSON: installed paths, the plugin directory to register, the open
      command (`code --new-window <workspace>`), and the `PROMPTS.md` path.
  - `status` reports what is installed.
  - `collect --harness <local|copilot|local-plugin|copilot-plugin>` sanitizes every
    log file into `fixtures/<harness>/` and empties the log dir.
  - `teardown`:
    - removes only probe-owned entries;
    - runs `copilot plugin uninstall agento-probe-plugin` when `copilot` is on `PATH`
      and the plugin is listed;
    - reports any `chat.pluginLocations` entry still naming the probe plugin, by
      reading the user `settings.json`; it does not edit that file.
- **Sanitizer (`collect`).**
  - Replaces `$HOME`, the username, the repo and worktree root, and the probe
    workspace path with `<HOME>`, `<USER>`, `<REPO>`, and `<PROBE_WS>`.
  - Replaces UUIDs, hex ids of 16 characters or more, and ISO or epoch-ms timestamps
    with stable placeholders (`<UUID-1>`, `<TS-1>`, …).
  - Drops every key matching `/token|secret|password|auth|cookie|credential|api[-_]?key/i`
    and every `env` object.
  - Validates the result with a deny-pattern scan:
    - home-directory paths: `/home/`, `/Users/`, `C:\\Users`;
    - GitHub tokens: `gh[pousr]_`, `github_pat_`;
    - `sk-` keys and `Bearer ` headers.

    A match fails `collect` and writes nothing.
- **Observation runs (manual).** These are two user sessions in the probe workspace
  window, Local first and then Copilot. Each follows `PROMPTS.md`:
  1. Check the session context tokens.
  2. Run a shell command (`echo AGENTO_PROBE_DENY_NESTED`, then each other marker).
  3. Create, edit, and apply-patch files under the workspace.
  4. Type `/agento delivery-status --probe-arg x` and `/agento-probe-copy hello` and
     report the arguments each skill echoes.
  5. Select `probe-pinned` and `probe-unpinned` and run each as a subagent, recording
     the model shown, whether ask-user works, and whether nesting works.

  A separate plugin run registers `tests/harness-probe/plugin`:
  - through `chat.pluginLocations` (the user's VS Code UI);
  - and, when the agent finds the `copilot` CLI, through `copilot plugin install`
    from the local directory, run by the agent.

  Then one SessionStart and one PreToolUse are observed per harness. The dispatch check
  is run from the primary Agento window: the dashboard dispatches
  `/agento delivery-status` while the chat Session Target is Copilot, and the
  observation is whether the query, mode, and attachments arrive.
- **`docs/copilot-harness.md`.**
  - Versions observed: `code --version` and the Copilot Chat extension version.
  - A findings table: Question | Local observed | Copilot observed | Evidence (fixture
    or screenshot link) | Impact on member (`copilot-hook-compat`,
    `agents-copilot-models`, `agento-router-skill`, `harness-install`,
    `dispatch-copilot-harness`).
  - The exact payload field names per event and the honored output fields.
  - A "Reproduce" section with the probe commands.
  - The doc writes only canonical `/agento <name>` spellings.
  - `probe.test.mjs` asserts that every relative link in the doc resolves.
- **Breakdown update (companion half, per decision 5).** Where a finding contradicts
  `initiatives/2026/10/copilot-harness/breakdown.md`:
  - rewrite the matching `## Research` bullets as observed facts, linking
    `docs/copilot-harness.md`;
  - adjust the affected members' `Brief:`/`Summary:`/`Independence:` text and
    `## Risks`;
  - bump `last-updated`.

  The `### harness-probe` block and every member's `Requires:` stay unchanged unless a
  finding makes a dependency wrong, and then the change is named in the review. The
  file must still validate with `agento.mjs initiative copilot-harness`.
- **Lint gate.** Full shellcheck (green baseline), the full node test suite, and both
  guard replays.

Affected files: new `tests/harness-probe/**` and `docs/copilot-harness.md` (product
half); `features/2026/10/harness-probe/**` (including `evidence/`) and
`initiatives/2026/10/copilot-harness/breakdown.md` (companion half).

## Risks

- **Edits to the fixture wiring ask for approval.** Every edit-tool write to
  `tests/harness-probe/workspace/.github/hooks/probe.json`,
  `tests/harness-probe/plugin/hooks/hooks.json`, and
  `tests/harness-probe/plugin/.claude-plugin/plugin.json` triggers the guard's
  protected-path rule. Mitigation: author each file once in step 1.1 and expect three
  approvals. The logger lives outside protected paths. Setup and teardown are Node and
  never name those paths on a shell line.
- **A crashing probe hook fails closed in Copilot** and blocks every tool in the probe
  window. Mitigation: the logger catches everything and exits 0. Exit 2 happens only
  on the explicit `AGENTO_PROBE_EXIT2` marker, which is the last prompt in
  `PROMPTS.md`. The probe runs in its own window, never in an Agento delivery window.
- **`~/.copilot/skills/agento` could collide** with a future real router or a user's
  own skill. Mitigation:
  - setup refuses when the path exists and is not the probe's symlink;
  - teardown removes it only when it is the probe's symlink;
  - teardown is a verified roadmap step (3.3).
- **A probe plugin left registered.** `chat.pluginLocations` lives in the user's
  machine settings, which the probe does not edit. Mitigation: the manual step that
  registers it also removes it, and teardown verifies the removal by reading
  `settings.json`; a leftover entry fails step 3.3. The agent uninstalls the
  `copilot plugin install` registration itself.
- **Leaked secrets or personal paths in fixtures.** Mitigation:
  - the sanitizer drops token-like keys and env values (the logger records env
    *names* only);
  - the deny-pattern scan in `collect` and again in `probe.test.mjs` over every
    committed fixture;
  - screenshots are checked for secrets before they are committed (policy §1).
- **The harness changes between VS Code releases.** Mitigation: the doc records the
  VS Code and Copilot Chat versions observed. Fixtures are labelled by harness so a
  later re-run can be diffed.
- **The `copilot` CLI may be missing.** Mitigation: step 2.6 checks
  `command -v copilot`. When it is absent, the doc records "`copilot plugin install`
  not observed (CLI absent)" as a finding, and the breakdown risk stays open for
  harness-install.
- **A finding may invalidate a later member's dependency.** Mitigation: the breakdown
  update keeps `agento.mjs initiative copilot-harness` at `status: ok`. Any change to
  `Requires:` is called out in the review rather than made silently.
- **Concurrent deliveries:** none open on 2026-10-13. Integrate `origin/main` before
  every push anyway (policy §7).

## Out of scope

- Any change to `scripts/hooks/*`, `.github/hooks/*`, `hooks/hooks.json`,
  `.claude-plugin/`, `.github/agents/*`, `commands/*`, `.github/prompts/*`, or
  `extension/`. Those belong to copilot-hook-compat, agents-copilot-models,
  agento-router-skill, harness-install, and dispatch-copilot-harness.
- A Copilot-format replay in `scripts/hooks/replay-guard.sh` (copilot-hook-compat
  consumes these fixtures).
- Editing the user's VS Code `settings.json`.
- Claude and Codex harnesses.
- Updating other docs (`docs/install.md`, `hooks.md`, …) and the plugin version
  (harness-docs).

## Acceptance checklist

- [ ] `tests/harness-probe/probe.test.mjs` covers:
  - the logger: one log file per call; env values never recorded; each marker
    produces its documented output shape; malformed stdin exits 0 with no output;
  - setup, status, and teardown in a temp `HOME`: setup refuses a foreign
    `~/.copilot/skills/agento`; teardown leaves foreign entries untouched;
  - the sanitizer: placeholders and dropped keys, and a deny-pattern failure writes
    nothing;
  - a scan of every committed `tests/harness-probe/fixtures/**` file for the deny
    patterns;
  - resolution of every relative link in `docs/copilot-harness.md`.

  Verify: `node --test tests/harness-probe/probe.test.mjs` passes.
- [ ] Sanitized fixtures exist for at least SessionStart and PreToolUse (shell, create,
  edit, and apply_patch when the harness offers it) for both `local` and `copilot`.
  Plugin-source fixtures exist for each harness where the plugin loaded. Verify: list
  `tests/harness-probe/fixtures/*/`, cross-checked against the doc's evidence column.
- [ ] `docs/copilot-harness.md` answers every brief question with Local and Copilot
  observations, linked evidence, and per-member impact. The brief questions are:
  - plugin loading (`chat.pluginLocations` and `copilot plugin install`);
  - hook discovery (workspace and plugin), and `${CLAUDE_PLUGIN_ROOT}` expansion;
  - input payload fields per event, honored output shapes, and exit-2 behavior;
  - `/agento` skill resolution with arguments, direct and through a symlink;
  - subagent ask-user, nesting, model pins, and model-name format;
  - `workbench.action.chat.open` dispatch.

  Verify: the Reviewer reads the doc against the brief and the linked evidence.
- [ ] Each (manual) observation step has a linked screenshot under
  `features/2026/10/harness-probe/evidence/` showing no secrets. Verify: links
  resolve; visual check.
- [ ] The initiative breakdown reflects the findings:
  - Research bullets that the probe contradicted or confirmed now cite
    `docs/copilot-harness.md`;
  - affected member texts are updated;
  - `last-updated` is bumped;
  - the `### harness-probe` block is unchanged.

  Verify: `node <agento-root>/scripts/agento.mjs initiative copilot-harness` returns
  `status: ok` with no `errors`/`anomalies`, and the companion diff is reviewed.
- [ ] `probe teardown` leaves no probe state on the machine:
  - `probe status` reports nothing installed;
  - `~/.copilot/skills/agento` and `agento-probe-copy` are absent;
  - no `chat.pluginLocations` entry names the probe plugin;
  - `copilot plugin list` (when the CLI exists) lacks `agento-probe-plugin`.

  Verify: the step 3.3 output recorded in the roadmap.
- [ ] No runtime file changed. Verify:
  `git diff --name-only origin/main...HEAD` lists only `tests/harness-probe/**` and
  `docs/copilot-harness.md`.
- [ ] Full lint and test gate: these all exit 0, compared with the green baselines
  recorded above:
  - `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`;
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`;
  - `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt`;
  - `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt`.
- [ ] Both halves are clean at handoff: `git status --porcelain --untracked-files=all`
  is empty in the product and companion halves.
