# Dashboard dispatch does not send in an existing Copilot chat (plugin prompt command shadows the router skill)

## Problem

Dashboard dispatch submits `/agento <name>` through `workbench.action.chat.open`
(`extension/src/commandDispatcher.ts` `chatOpenOptions`). In an existing Copilot chat
the chat input binds `/agento <name>` to the plugin's prompt command — registered by
`.claude-plugin/plugin.json` `"commands": "commands"` — which the Copilot harness does
not execute, so the request is never sent. In a new chat the same payload routes
through the `agento` router skill and works. Users therefore cannot drive Agento from
the dashboard in an ongoing Copilot conversation, and `/agento` resolves through two
different mechanisms depending on harness and chat state.

## Evidence

GitHub issue: #121

Environment (reported by the user, 2026-10-17): soshiki, VS Code 1.141.0, Copilot
Chat 0.69.0, Session Target Copilot, Claude Opus 5.5, plugin clone
`/home/david/DP/agento-plugin` at `origin/main` 1f0d3de, router link
`~/.copilot/skills/agento` → `agento-plugin/skills/agento` (`harness status`
installed).

Reproduction:

1. In an existing Copilot chat with history, click a dashboard action that submits
   `/agento delivery-status`.
2. The input is filled but not sent. The whole `/agento delivery-status` is
   highlighted as one command and its tooltip reads "Click to open
   ~/DP/agento-plugin/commands/delivery-status.md" —
   [evidence/existing-chat-binds-prompt-command.png](evidence/existing-chat-binds-prompt-command.png).
   The earlier successful turn in the same chat shows the chip on `/agento` only,
   then "Read skill · agento" with SKILL.md attached (same screenshot, upper half).
3. In a new chat the same dispatch sends, shows "Read skill · agento", and prints
   `Receipt: accepted delivery-status:main:897c27bf` —
   [evidence/new-chat-routes-through-skill.png](evidence/new-chat-routes-through-skill.png).

Static reproduction in this repository at 1f0d3de —
[evidence/static-repro.log](evidence/static-repro.log): `.claude-plugin/plugin.json`
line 11 is `"commands": "commands"` and `commands/` holds 25 prompt commands, so the
plugin exposes a prompt command for every `/agento <name>` the router skill also
claims.

Observed: in an existing Copilot chat, `/agento <name>` binds to the plugin prompt
command and dispatch does not send.
Expected: dashboard dispatch submits `/agento <name>` in new and existing chats, and
`/agento` always resolves to the router skill in both Copilot and Local.

The VS Code chat input cannot be driven by the agent's browser tools, so the
live reproduction is the user's screenshots (decision 1); the machine-checkable
reproduction is the exposing regression test (roadmap step 2.1).

## Decisions

Proposed fix decided with the user in the intake: remove `commands` from
`.claude-plugin/plugin.json` so the router skill is the only `/agento` path in both
harnesses; `agento.mjs harness install` becomes a required install step; Local loses
prompt-level `model:` switching (the gap that already exists with the link
installed); keep `commands/*.md` as the router's source and `.github/prompts/`
unchanged (initiative decision 4); update `tests/customizations.test.mjs` manifest
assertions; verify the fix premise with a scratch plugin copy before building.

Clarifying questions (2026-10-17; every answer was the recommended option):

1. *The defect lives in the VS Code chat input, which I cannot drive with browser
   tools. How should the issue's reproduction be recorded?* — "Copy both screenshots
   into evidence/ + static repro (manifest registers commands, failing regression
   test)" (recommended).
2. *Which exposing regression test should step 1 add (must FAIL today)?* —
   "tests/customizations.test.mjs: plugin.json declares no `commands` key and every
   commands/*.md is still reachable via skills/agento router (named after the issue
   #/slug)" (recommended). The roadmap numbers it 2.1, after the pre-check phase.
3. *Doctor's `harness` check should fail when the ~/.copilot/skills/agento link is
   absent. In which contexts?* — "Fail whenever the link is absent or points
   elsewhere (both harnesses need it now)" (recommended).
4. *The pre-build scratch-copy check and the final soshiki acceptance (new +
   existing chat, Copilot + Local) need you to operate VS Code chat. Encode them as
   (manual) roadmap steps with your screenshots?* — "Yes: 1.1 (manual) scratch-copy
   check gating the build; final (manual) soshiki 4-cell acceptance before review"
   (recommended). The roadmap splits the pre-check into agent preparation (1.1),
   the user's check (1.2, manual), and agent restore (1.3), because preparing the
   copy is CLI work (policy §1).
5. *Docs (docs/copilot-harness.md, docs/install.md, README) must drop the
   prompt-command path. feature/harness-docs is in progress on the same docs. How to
   handle it?* — "Docs in scope; integrate origin/main before every push and
   rebase-free merge after harness-docs ships" (recommended).

## Research

Skills consulted: none — no matching domain (this repository has no
`.agents/skills/` and no skills table).

- `.claude-plugin/plugin.json:11` — `"commands": "commands"`; the only manifest
  field registering prompt commands. `agents` (`.github/agents`) and `hooks`
  (`./hooks/hooks.json`) stay.
- `skills/agento/SKILL.md` — the router reads `<agento-root>/commands/<name>.md`
  directly (§4 Resolve), with `<agento-root>` from the session context line or the
  realpath of the skill link; it does not depend on the manifest registering
  `commands`. Line 11 says it routes "in a Copilot session (where plugin prompt
  commands do not load)" — wording becomes "in every session".
- `extension/src/commandAgent.ts` `resolveChatMode` / `resolveCommandFile` and
  `scripts/agento.mjs` `dispatchFor` (line ~1484) read `PLUGIN_ROOT/commands/<name>.md`
  from disk; neither needs the manifest field. No extension code change is needed.
- `tests/customizations.test.mjs:966` — "plugin manifest uses suffix-less command
  names…" asserts `plugin.commands` exists and mirrors `.github/prompts/`; it must
  read `commands/` directly instead of through `plugin.commands`.
- `scripts/agento.mjs:1014` — doctor `harness` check returns `warn` for
  `absent`/`foreign`/`dangling`/`not-a-link` and `ok` when no router skill exists;
  it is informational (not in `CAPABILITY_CHECKS`, so never in `preflight`).
  `LOCAL_TAKEOVER` (line 1028) says "harness uninstall restores the Local prompt
  commands", which becomes false. The `harness` subcommand (line ~4661) emits
  `localTakeover`. Tests: `scripts/agento.test.mjs:1767` asserts `warn` per state.
- `extension/cli/` is a generated byte copy of `scripts/` (`cd extension && npm run
  copy-cli`).
- `docs/copilot-harness.md:27,203,242-250,291-296` describe Local loading plugin
  prompt commands and `harness uninstall` restoring them. `docs/install.md` on `main`
  does not mention `harness install`; PR #120 (`feature/harness-docs`) adds it and
  rewrites these passages.
- `tests/harness-probe/dispatch-probe` holds the V1–V8 payload variants; V1 (today's
  `{ query, mode, attachFiles }`) was recorded as submitting in both harnesses by
  `dispatch-copilot-harness`, likely only in new chats.
- Root-cause hypothesis: once a chat's slash-command list is populated, the input
  binds `/agento <name>` to the plugin prompt command (tooltip → `commands/<name>.md`);
  the Copilot harness does not execute plugin prompt commands, so the submit is
  dropped. In a fresh chat the binding is absent and the token falls through to the
  `agento` skill. Unregistering `commands` leaves the skill as the only binding.
- **Step 5.3 finding (2026-10-17)** — the Phase 1 pre-check (step 1.2) passed but
  the final soshiki acceptance fails in the existing-Copilot-chat cell, so the
  manifest-field hypothesis is disproved:
  1. Removing `"commands"` from `plugin.json` does not stop VS Code from exposing
     `commands/<name>.md` as a prompt command. VS Code 1.141.0's workbench
     (`/usr/share/code/resources/app/out/vs/workbench/workbench.desktop.main.js`,
     `expandPluginContents`) scans the default plugin directories
     `["agents","skills","commands","rules"]` mapped to types
     `["agent","skill","prompt","instructions"]`, so a root `commands/` directory
     is auto-discovered as prompts regardless of the manifest.
  2. The step 1.2 pre-check passed in an existing chat that had no prior `/agento`
     turn; 5.3 fails in a chat whose previous turn was an `/agento` dispatch
     (matching the original report, where the earlier successful turn was in the
     same chat). The trigger appears to be a chat that already ran an `/agento`
     dispatch, so 1.2 did not exercise the failing condition.

Lint baseline (policy §5): the full-repository lint is `shellcheck
scripts/hooks/*.sh scripts/wait-for-checks.sh` (AGENTS.md). Locally it exited 127
(`shellcheck: command not found`). CI runs the same command on every push: run
39054365546 on `main` at 1f0d3de concluded `success`, so the baseline is clean with
zero findings. This delivery changes no shell files. Decision: no cleanup needed;
the Builder installs or locates shellcheck and reruns it locally if available, and
otherwise records the PR's CI shellcheck result as the final comparison.

Concurrent delivery: PR #120 `feature/harness-docs` (status `paused` at its step 3.4)
changes `.claude-plugin/plugin.json`, `AGENTS.md`, `CHANGELOG.md`, `README.md`,
`docs/architecture.md`, `docs/commands.md`, `docs/copilot-harness.md`,
`docs/extension.md`, `docs/hooks.md`, `docs/install.md`, `docs/model-profiles.md`,
`package.json`, and `extension/package.json` — all overlap with this plan's files
except the tests and scripts. Its step 3.4 dashboard-dispatch sub-check is the
symptom this issue fixes.

## Approach

1. **Pre-check the premise (Phase 1).** Build a scratch plugin copy of `origin/main`
   with `commands` removed from its manifest, point `chat.pluginLocations` at it in
   place of `/home/david/DP/agento-plugin` (original value recorded), and have the
   user verify in soshiki that dispatch sends in an existing Copilot chat and that
   Local `/agento delivery-status` works through the router. Restore the settings
   afterwards. A failed pre-check pauses the delivery for a re-plan.
2. **Exposing test (Phase 2).** In `tests/customizations.test.mjs` add
   `"#121 dispatch-router-only: plugin manifest registers no commands; the router
   skill reaches every commands/*.md"` asserting: `plugin.commands === undefined`;
   `skills/agento/SKILL.md` exists; every `commands/<name>.md` basename matches
   `/^[a-z0-9-]+$/` and mirrors `.github/prompts/<name>.prompt.md` byte for byte. It
   fails today on the first assertion.
3. **Fix (Phase 3).**
   - `.claude-plugin/plugin.json`: delete the `"commands"` line.
   - `tests/customizations.test.mjs` "plugin manifest uses suffix-less command
     names…": read `rel("commands")` directly instead of `plugin.commands`.
   - `scripts/agento.mjs` doctor `harness`: `fail` for `absent`, `foreign`,
     `dangling`, `not-a-link` (details name that `/agento` cannot run in any
     session); keep `ok` when installed or when the root has no router skill; stays
     out of `CAPABILITY_CHECKS`. Rewrite `LOCAL_TAKEOVER` to state the router is the
     only `/agento` path, Builder/Reviewer keep pins, and inline agents/prompt
     `model:` do not switch; `harness uninstall` output warns that `/agento` stops
     resolving. Update `scripts/agento.test.mjs` harness tests.
   - `skills/agento/SKILL.md` line 11: routes in every session.
   - `cd extension && npm run copy-cli`.
4. **Docs (Phase 4)** after merging `origin/main` (ideally once #120 has shipped):
   `docs/install.md` (`harness install` required), `docs/copilot-harness.md` (manifest
   no longer registers commands; Local routes through the router; uninstall removes
   `/agento`), `README.md`, `docs/model-profiles.md` (prompt `model:` not applied by
   the router), `CHANGELOG.md` Unreleased entry.
5. **Verify (Phase 5)**: full node suite, five guard replays, extension build + unit
   tests, lint gate; point the soshiki plugin clone at the branch and have the user
   run the four-cell acceptance; restore the clone.

Affected files: `.claude-plugin/plugin.json`, `tests/customizations.test.mjs`,
`scripts/agento.mjs`, `scripts/agento.test.mjs`, `extension/cli/agento.mjs`,
`skills/agento/SKILL.md`, `docs/install.md`, `docs/copilot-harness.md`,
`docs/model-profiles.md`, `README.md`, `CHANGELOG.md`.

## Risks

- **Hypothesis wrong** — the existing-chat drop could have another cause (e.g. the
  input binding the skill differently). Mitigation: Phase 1 pre-check gates every
  code change; on failure the roadmap pauses with a `blocked:` marker for re-planning.
- **Local without the link has no `/agento` at all.** Mitigation: doctor `harness`
  fails with the exact `harness install` command; `docs/install.md` makes it a
  required step; the CHANGELOG calls out the breaking change.
- **Lost Local model switching** (prompt `model:` and inline agent modes) — accepted
  in the intake; the gap already exists whenever the link is installed. Documented
  in `docs/model-profiles.md` and `docs/copilot-harness.md`.
- **Concurrent delivery overlap with PR #120 `feature/harness-docs`** on
  `.claude-plugin/plugin.json` and all docs files. Mitigation: merge `origin/main`
  before every push (policy §7, never rebase); do the docs phase after #120 ships
  where possible, otherwise resolve conflicts by keeping #120's structure and
  applying this delivery's facts. #120's step 3.4 dispatch sub-check depends on this
  fix — note it on #120 only through its own Builder, not from here.
- **Touching user-level state** (`chat.pluginLocations` in steps 1.1/1.3 and the
  soshiki plugin clone in 5.2/5.4). Mitigation: record originals in evidence, restore
  in a dedicated step, and verify the restore.
- **Doctor `fail` changes `/agento doctor` exit status** for users with a foreign
  link (e.g. a second clone). Mitigation: the fallback names `harness install
  --force`; preflight is unaffected because `harness` is not a capability check.

## Out of scope

- The delivery guard falsely denying read-only `ls`/`cat`/`grep` of hook files as
  "destructive" (also hit while planning this issue on `gh pr diff`).
- HydraFusion "Critique" mode running tools outside the PreToolUse hook.
- In plugin mode, the hook process running from the staged plugin directory rather
  than the repository.
- Changing `.github/prompts/` or removing `commands/*.md` (initiative decision 4).
- Restoring Local model switching through the router.

## Acceptance checklist

- [ ] The exposing regression test `tests/customizations.test.mjs` "#121
  dispatch-router-only: plugin manifest registers no commands; the router skill
  reaches every commands/*.md" fails before the fix (step 2.1 output) and passes
  after it — verify: `node --test tests/customizations.test.mjs`.
- [ ] `.claude-plugin/plugin.json` has no `commands` field and keeps `agents` and
  `hooks` — verify: `node -e` read of the manifest; customizations tests pass.
- [ ] Doctor `harness` is `fail` for absent, foreign, dangling, and not-a-link, `ok`
  when installed or with no router skill, and never runs in preflight — verify:
  `node --test scripts/agento.test.mjs`.
- [ ] `commands/*.md` and `.github/prompts/` are unchanged by this delivery —
  verify: `git diff origin/main --stat -- commands .github/prompts` is empty.
- [ ] Docs state `harness install` is required, Local and Copilot both route
  through the router, and Local's model-switching gap — verify: grep of
  `docs/install.md`, `docs/copilot-harness.md`, `docs/model-profiles.md`; no doc
  claims Local loads plugin prompt commands or that `harness uninstall` restores them.
- [ ] Full node suite passes — verify: `node --test 'scripts/**/*.test.mjs'
  'tests/**/*.test.mjs'`.
- [ ] All five guard replays pass — verify: the five AGENTS.md guard-smoke commands.
- [ ] Extension builds and its unit tests pass, and `extension/cli/` matches
  `scripts/` — verify: `cd extension && npm run copy-cli && npm run build && npm run
  test:unit`; `git status --porcelain` clean after copy-cli.
- [ ] Lint gate: shellcheck reports zero findings, matching the clean baseline —
  verify: local `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` when
  available, else the PR's CI shellcheck step green.
- [ ] Pre-check (step 1.2): with commands unregistered, dispatch sends in an existing
  Copilot chat and Local `/agento delivery-status` works through the router —
  verify: `evidence/step-1-2-*.png`.
- [ ] In soshiki, dashboard dispatch of `/agento delivery-status` sends and prints
  its receipt in a new and an existing chat, in both Copilot and Local — verify:
  four screenshots `evidence/step-5-3-*.png`.
