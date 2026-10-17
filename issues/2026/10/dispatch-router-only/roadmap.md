```yaml
status: in-progress
branch: issue/dispatch-router-only
last-updated: 2026-10-17
next-step: "6.5 (added 2026-10-17) run the full gate"
github-issue: "#121"
artifact-pr: "#59"
```

# Roadmap: dispatch-router-only

## Phase 1: Pre-check the fix premise

- [x] 1.1 Create a scratch plugin copy of `origin/main` outside every repository
  (`git clone --depth 1 https://github.com/david-perry-software/agento.git
  /tmp/agento-scratch-plugin`),
  delete its `.claude-plugin/plugin.json` `"commands"` line, record the current
  `chat.pluginLocations` value from VS Code user settings in
  `evidence/step-1-1-plugin-locations.txt`, then replace the
  `/home/david/DP/agento-plugin` entry with `/tmp/agento-scratch-plugin` (router link
  untouched) — verify: `node -e` shows the scratch manifest has no `commands`;
  settings.json `chat.pluginLocations` names the scratch copy and not
  `agento-plugin`
- [x] 1.2 (manual) In the soshiki primary window run "Developer: Reload Window"; with
  Session Target **Copilot**, open a chat that already has history and click a
  dashboard action that submits `/agento delivery-status`; then switch Session
  Target to **Local**, type `/agento delivery-status` in a chat and send; screenshot
  each result — verify: `evidence/step-1-2-copilot-existing-chat.png` shows the
  request sent, "Read skill · agento" (or "Reviewed SKILL.md…"), and `Receipt:
  accepted delivery-status:…`; `evidence/step-1-2-local-router.png` shows the
  receipt reached through the router skill. A failure pauses the delivery as `1.2
  blocked: premise not confirmed` for a re-plan. Completed 2026-10-17:
  [Copilot existing chat](evidence/step-1-2-copilot-existing-chat.png),
  [Local router](evidence/step-1-2-local-router.png). Side observation: with
  commands unregistered the Copilot turn took ~1m 8s versus ~12m in the earlier
  router check
- [x] 1.3 Restore `chat.pluginLocations` to the value in
  `evidence/step-1-1-plugin-locations.txt` and delete `/tmp/agento-scratch-plugin` —
  verify: settings value equals the recorded one; the scratch path no longer exists

## Phase 2: Exposing regression test

- [x] 2.1 Add the test `"#121 dispatch-router-only: plugin manifest registers no
  commands; the router skill reaches every commands/*.md"` to
  `tests/customizations.test.mjs` (asserts `plugin.commands === undefined`,
  `skills/agento/SKILL.md` exists, every `commands/<name>.md` is suffix-less and
  byte-identical to `.github/prompts/<name>.prompt.md`) — verify: `node --test
  --test-name-pattern '#121' tests/customizations.test.mjs` exits nonzero on the
  `plugin.commands` assertion (record the output in the step commit message)

## Phase 3: Fix

- [x] 3.1 Delete `"commands": "commands"` from `.claude-plugin/plugin.json` and
  change the "plugin manifest uses suffix-less command names…" test to read
  `rel("commands")` directly instead of `plugin.commands` — verify: `node --test
  tests/customizations.test.mjs` passes, including the #121 test
- [x] 3.2 Make doctor `harness` return `fail` for `absent`, `foreign`, `dangling`,
  and `not-a-link` (detail says `/agento` cannot run in any session; fallbacks
  unchanged), keep `ok` for installed and for a root with no router skill, keep it
  out of `CAPABILITY_CHECKS`; rewrite `LOCAL_TAKEOVER` (router is the only `/agento`
  path; Builder/Reviewer keep pins; inline agents and prompt `model:` do not
  switch) and make `harness uninstall` output warn that `/agento` stops resolving;
  update `scripts/agento.test.mjs` harness tests to expect `fail` — verify: `node
  --test scripts/agento.test.mjs` passes
- [x] 3.3 Reword `skills/agento/SKILL.md` line 11 to route `/agento` in every session
  (Copilot and Local), no mention of plugin prompt commands loading anywhere —
  verify: `node --test tests/customizations.test.mjs` passes; `grep -n "prompt
  commands" skills/agento/SKILL.md` prints nothing
- [x] 3.4 Regenerate the extension's CLI copy — verify: `cd extension && npm run
  copy-cli && npm run build && npm run test:unit` pass and `diff -r scripts
  extension/cli` reports only the files copy-cli excludes

## Phase 4: Documentation

- [x] 4.1 Merge `origin/main` (picking up PR #120 `feature/harness-docs` if it has
  shipped), then update `docs/install.md` (`harness install` is a required step),
  `docs/copilot-harness.md` (the manifest registers no commands; both harnesses
  route `/agento` through the router; `harness uninstall` removes `/agento`; the
  existing-chat dispatch finding with a link to #121), `docs/model-profiles.md`
  (prompt `model:` and inline agent modes are not applied through the router),
  `README.md`, and a `CHANGELOG.md` Unreleased entry naming the breaking install
  change — verify: `grep -rn "restores the Local prompt\|Local loads the plugin's
  prompt commands\|prompt commands load" docs README.md` prints nothing;
  `grep -n "harness install" docs/install.md` matches; `node --test
  tests/customizations.test.mjs` passes

## Phase 5: Verification

- [x] 5.1 Run the full gate — verify: `node --test 'scripts/**/*.test.mjs'
  'tests/**/*.test.mjs'` passes; the five AGENTS.md guard replays (default, companion,
  Copilot, Copilot companion, Copilot fixtures) pass; `cd extension && npm run build
  && npm run test:unit` pass; `shellcheck scripts/hooks/*.sh
  scripts/wait-for-checks.sh` reports zero findings locally when shellcheck is
  available, otherwise the PR's CI shellcheck step is green (baseline: clean, CI run
  39054365546); `git diff origin/main --stat -- commands .github/prompts` is empty.
  Results: node suite 566/566 pass; all five guard replays 0 mismatches; extension
  build + unit 167/167 pass; shellcheck unavailable locally — deferred to the PR's
  CI shellcheck step (baseline clean; no shell files changed); `commands` and
  `.github/prompts` unchanged
- [x] 5.2 Record `/home/david/DP/agento-plugin`'s HEAD in
  `evidence/step-5-2-plugin-clone-head.txt`, require it clean, then `git -C
  /home/david/DP/agento-plugin fetch origin && git -C /home/david/DP/agento-plugin
  switch --detach origin/issue/dispatch-router-only` — verify: its `.claude-plugin/
  plugin.json` has no `commands`; `node /home/david/DP/agento-plugin/scripts/agento.mjs
  harness status` reports `installed`
- [x] 5.3 (manual) ~In the soshiki primary window run "Developer: Reload Window", then
  click a dashboard action that submits `/agento delivery-status` in four cells:
  Copilot new chat, Copilot existing chat, Local new chat, Local existing chat;
  screenshot each — verify: `evidence/step-5-3-copilot-new.png`,
  `evidence/step-5-3-copilot-existing.png`, `evidence/step-5-3-local-new.png`,
  `evidence/step-5-3-local-existing.png` each show the request sent and `Receipt:
  accepted delivery-status:…`; `git -C /home/david/DP/soshiki status --porcelain`
  is empty.~ (obsolete: failed 2026-10-17 in the existing-chat cell — VS Code
  auto-discovers the root `commands/` directory as prompt commands, so removing the
  manifest field alone does not fix dispatch; superseded by 6.7. Failure evidence:
  [step-5-3-copilot-new.png](evidence/step-5-3-copilot-new.png) sent,
  [step-5-3-copilot-existing-fails.png](evidence/step-5-3-copilot-existing-fails.png)
  bound-and-unsent; findings in plan.md `## Research` "Step 5.3 finding".)
- [x] 5.4 ~Restore `/home/david/DP/agento-plugin` to the HEAD recorded in
  `evidence/step-5-2-plugin-clone-head.txt` (`git switch` back to its branch) —
  verify: `git -C /home/david/DP/agento-plugin rev-parse HEAD` and its branch match
  the record; `git -C /home/david/DP/agento-plugin status --porcelain` is empty~
  (obsolete: re-runs as 6.8 after the clone moves to the new branch head and the
  6.7 re-check completes)

## Phase 6: Move the router's command files out of `commands/` (re-plan A, 2026-10-17)

- [x] 6.1 (added 2026-10-17) Update the #121 regression test in
  `tests/customizations.test.mjs` to resolve the mirrors at
  `skills/agento/commands/` and to assert no root-level `commands/` directory exists
  (keeping the existing `plugin.commands === undefined` and `skills/agento/SKILL.md`
  assertions) — verify: `node --test --test-name-pattern '#121'
  tests/customizations.test.mjs` exits nonzero on the "no root commands/"
  assertion (the move has not happened yet)

- [x] 6.2 (added 2026-10-17) `git mv commands/*.md skills/agento/commands/` — verify:
  `test ! -d commands`; every moved file exists under `skills/agento/commands/` and
  is byte-identical to its `.github/prompts/<name>.prompt.md` (25/25); the #121 test
  itself passes once 6.3 updates the other consumers that still read `commands/`

- [x] 6.3 (added 2026-10-17) Update every consumer of the `commands/` path to
  `skills/agento/commands/`: `skills/agento/SKILL.md` §3/§4;
  `scripts/agento.mjs` `dispatchFor`, `MODEL_ATTR_PATTERNS`, and `modelTargetFiles`'
  mirror; `extension/src/commandAgent.ts` `resolveChatMode`/`resolveCommandFile`;
  `scripts/agento.test.mjs`, `tests/customizations.test.mjs`,
  `extension/test/unit/commandAgent.test.ts`,
  `extension/test/unit/planPlayButtonHandoff.test.ts`,
  `tests/harness-probe/dispatch-probe/extension.js`,
  `tests/harness-probe/dispatch-probe.test.mjs`; the delivery-policy `applyTo`
  pattern; `docs/model-profiles.md`, `docs/commands.md`, `docs/copilot-harness.md`,
  `docs/extension.md`; and a `CHANGELOG.md` Unreleased note — verify:
  `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` passes and
  `git grep -n "commands/" -- scripts extension/src skills docs tests
  extension/test CHANGELOG.md | grep -v 'skills/agento/commands'` prints nothing.
  Also re-normalized the mirrors (`git add --renormalize`) so the step 6.2 move no
  longer commits the local `model:` pins: `models adopt` migrated the shared
  `agento-models` attribute block and pin state to the new path first

- [x] 6.4 (added 2026-10-17) Regenerate the extension's CLI copy — verify:
  `cd extension && npm run copy-cli`; `diff -r scripts extension/cli` reports only
  the files copy-cli excludes; `git status --porcelain` shows only
  `extension/cli/agento.mjs`

- [ ] 6.5 (added 2026-10-17) Run the full gate — verify:
  `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` passes; the five
  AGENTS.md guard replays pass; `cd extension && npm run build && npm run
  test:unit` pass; `git diff origin/main --stat -- .github/prompts` is empty;
  `test ! -d commands`

- [ ] 6.6 (added 2026-10-17) Record `/home/david/DP/agento-plugin`'s new HEAD in
  `evidence/step-6-6-plugin-clone-head.txt`, require it clean, then
  `git -C /home/david/DP/agento-plugin fetch origin && git -C
  /home/david/DP/agento-plugin switch --detach
  origin/issue/dispatch-router-only` — verify: its `rev-parse HEAD` equals the
  branch head; `.claude-plugin/plugin.json` has no `commands` and there is no root
  `commands/` directory; `node /home/david/DP/agento-plugin/scripts/agento.mjs
  harness status` reports `installed`

- [ ] 6.7 (manual, added 2026-10-17) In the soshiki primary window run "Developer:
  Reload Window"; with Session Target **Copilot**, open a new chat and click a
  dashboard action that submits `/agento delivery-status`; then in an **existing
  chat whose previous turn was an `/agento` dispatch** click the same dashboard
  action AND type `/agento delivery-status` by hand and send; switch Session Target
  to **Local** and repeat both cells (new chat, existing chat with a prior `/agento`
  turn, hand-typed in the existing one); screenshot each — verify:
  `evidence/step-6-7-copilot-new.png`, `evidence/step-6-7-copilot-existing.png`,
  `evidence/step-6-7-local-new.png`, `evidence/step-6-7-local-existing.png` each
  show the request sent and `Receipt: accepted delivery-status:…`

- [ ] 6.8 (added 2026-10-17) Restore `/home/david/DP/agento-plugin` to the HEAD
  recorded in `evidence/step-5-2-plugin-clone-head.txt` (`git switch` back to its
  branch) — verify: `git -C /home/david/DP/agento-plugin rev-parse HEAD` and its
  branch match the record; `git -C /home/david/DP/agento-plugin status --porcelain`
  is empty
