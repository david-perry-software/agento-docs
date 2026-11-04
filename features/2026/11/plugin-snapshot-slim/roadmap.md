```yaml
status: in-progress
branch: feature/plugin-snapshot-slim
last-updated: 2026-11-04
next-step: "5.1 Run the lint gate and the full suite"
initiative: "agento-speed"
artifact-pr: "#77"
```

## Phase 1: Snapshot facts and the shared model

- [x] 1.1 Confirm VS Code's snapshot naming rule on this machine: map each
  `file://` uri in `~/.config/Code/agentPlugins/cache.json` to its directory under
  `~/.config/Code/agentPlugins/` and each `nonce` to a snapshot directory; check that the
  newest nonce equals the hex ms mtime of `/home/david/DP/agento-plugin`. Record the rule,
  the snapshot count, sizes (`du -sh`), and total on this step line, and save a small
  fixture (uri → directory name examples, hex nonces) under
  `scripts/test-helpers/` for the tests. **Recorded:** rule — a `file://` uri maps to
  `file-` + its path with `/`→`-` and the leading `/` dropped
  (`file:///home/david/DP/agento-plugin` → `file-home-david-DP-agento-plugin`); each
  `cache.json` `nonce` is a hex-named snapshot dir whose nonce = hex ms mtime of the
  location dir, and the newest nonce `1a194a81a45` equals
  hex(floor(mtimeMs)) of `/home/david/DP/agento-plugin` (1793495407173 ms). Count: 7
  snapshots; sizes: 1a14d7020a8 13M, 1a16a70f607 14M, 1a16ef0c88f 177M, 1a173994d66 178M,
  1a1743ed22d 180M, 1a18e5b18c2 181M, 1a194a81a45 182M; total 922M — verify: the rule,
  count, and total are written on this line; the fixture file exists and
  `node --test scripts/commands/doctor.test.mjs` still passes

- [x] 1.2 Add `scripts/lib/plugin.mjs` with `agentPluginsDir(env)`
  (`AGENTO_VSCODE_AGENT_PLUGINS` override, `XDG_CONFIG_HOME`, macOS path),
  `snapshotDirName(location)`, `listSnapshots(location, env)` (hex-named children only,
  `{ nonce, path, bytes, mtime }`, newest = largest nonce), and `pluginLocations(env)`
  classifying enabled `chat.pluginLocations` entries as `missing` / `export` / `clone` /
  `other`. Move `vscodeSettingsPath` and `expandHome` out of `scripts/lib/doctor.mjs` into
  a shared export used by both modules. Unit tests in `scripts/commands/plugin.test.mjs`
  — verify: `node --test scripts/commands/plugin.test.mjs scripts/commands/doctor.test.mjs`
  passes (the `hook-wiring` tests stay green after the move)

## Phase 2: `plugin export`

- [x] 2.1 Register the `plugin` command family: `scripts/commands/plugin.mjs` exporting
  `commands.plugin` with subcommands `export | snapshots | prune-snapshots` (unknown
  subcommand → usage, exit 1), a `plugin: "plugin"` entry in `COMMAND_MODULES`, and a usage
  header line in `scripts/agento.mjs` — verify: `node --test tests/cli-layout.test.mjs`
  passes; `node scripts/agento.mjs plugin bogus; echo $?` prints a usage error and `1`

- [x] 2.2 Implement the `plugin export` tree build: resolve the source (the CLI's own git
  checkout or `--source`; refuse a non-git root naming `--source`), `git fetch`, default
  ref `origin/<default branch>` (`--ref` overrides), `git archive <commit>` into
  `<dest>.agento-export-<pid>`, write `.agento-export.json` (`source.remote`,
  `source.ref`, `source.commit`, `exportedAt`, `carriedPins`), and swap atomically
  (old → `<dest>.agento-old-<pid>`, temp → `<dest>`, delete old). Destination: `--dest`,
  else the single enabled Agento `chat.pluginLocations` entry (refuse when none or
  several, listing candidates). Tests with a fixture clone: the exported file set equals
  `git ls-tree -r --name-only <commit>` plus the stamp; no `.git`, no `node_modules`;
  re-export over an earlier export works; a failure injected before the swap leaves the
  destination byte-identical and no temp directory behind; a staged snapshot (non-git) as
  source is refused — verify: `node --test scripts/commands/plugin.test.mjs` passes

- [x] 2.3 Add the destination safety rules: refuse a non-empty destination that is
  neither an export nor (with `--replace-clone`) an Agento git clone; with
  `--replace-clone` refuse a clone with changes beyond model pins
  (`modelsState().dirtyBeyondModel` or untracked non-ignored files), commits missing from
  every remote (`git log --branches --not --remotes`), or stash entries; each refusal exits
  3 and names the blocker. On success report the dropped ignored bytes (e.g.
  `extension/node_modules`). Tests for each refusal and for a clean clone with ignored
  `node_modules` being replaced — verify: `node --test scripts/commands/plugin.test.mjs`
  passes

- [x] 2.4 Carry the model pins over: before the swap read the frontmatter `model:` line
  and handoff model lines of every `modelTargetFiles()` file in the old destination
  (`readModel`, `handoffModelLines`) — including a git clone whose pins come from the
  `agento-models` filter — and write them into the new tree (`setModel`,
  `setHandoffModels`); list files with no prior pin under `unpinned` with the fallback
  `models apply <name> --plugin-root <dest>`. Tests: custom pins (agent `model:` lines and
  handoff lines) survive export from a filtered clone and re-export from an export; a new
  agent file is listed as `unpinned`; `node scripts/agento.mjs models --plugin-root <dest>`
  reports the same active profile before and after — verify: `node --test
  scripts/commands/plugin.test.mjs scripts/commands/models.test.mjs` passes

## Phase 3: Snapshots, prune, and doctor

- [x] 3.1 Implement `plugin snapshots [--dest <dir>]` (count, per-snapshot bytes, newest,
  total) and `plugin prune-snapshots [--dest <dir>] [--dry-run]`: delete every hex-named
  snapshot of the Agento location except the newest and the one containing the running
  CLI (`PLUGIN_ROOT`); never touch `cache.json`, other locations, or non-hex names; report
  freed bytes and the advice to reload open VS Code windows. Tests on a fixture
  `agentPlugins` tree via `AGENTO_VSCODE_AGENT_PLUGINS` — verify: `node --test
  scripts/commands/plugin.test.mjs` passes; `node scripts/agento.mjs plugin snapshots`
  on this machine lists the 7 live snapshots with the sizes recorded in 1.1 (read-only)

- [x] 3.2 Add the informational doctor check `plugin-snapshots` (not in
  `CAPABILITY_CHECKS`; warn at most; every error caught as `warn`): warn on enabled
  `chat.pluginLocations` entries whose directory is missing (fallback: remove the entry
  from VS Code user settings), on an Agento location that is a git clone or whose newest
  snapshot is > 10 MB (fallback `agento.mjs plugin export --dest <dir> --replace-clone`),
  and on stale snapshots (fallback `agento.mjs plugin prune-snapshots`, with count and
  MB); `ok` for a single small snapshot of an export. Tests in
  `scripts/commands/doctor.test.mjs`, including that no `doctor --for <command>` runs it —
  verify: `node --test scripts/commands/doctor.test.mjs` passes; `node scripts/agento.mjs
  doctor` on this machine shows `plugin-snapshots` `warn` naming the clone and 6 stale
  snapshots

## Phase 4: Docs and mirror

- [x] 4.1 Update the docs: `docs/install.md` Option A (the clone stays the source; register
  an export made with `plugin export --dest <dir>`) and "Updating" (`plugin export`
  replaces `git pull`; pins carry over; `prune-snapshots` reclaims space; VSIX builds run
  in the clone); `README.md:105–116` likewise; `docs/model-profiles.md` (pins on an
  export: no git filter, carried by `plugin export`); `docs/commands.md` CLI reference for
  `plugin` and its doctor check list (`plugin-snapshots`; the documented check list
  lives in commands.md, not architecture.md — repaired from the plan's stale
  reference);
  `docs/copilot-harness.md` staged-copy note (naming rule from 1.1, snapshots kept until
  pruned); `CHANGELOG.md` entry — verify: `node --test tests/customizations.test.mjs`
  passes; `grep -n "plugin export" docs/install.md README.md docs/model-profiles.md
  docs/commands.md` matches in each file; `grep -n "plugin-snapshots"
  docs/commands.md` matches

- [x] 4.2 Regenerate the CLI mirror and check the extension: `cd extension && npm run
  copy-cli && npm run build && npm run test:unit` — verify: all three exit 0; `git status
  --porcelain extension/cli` shows the new `lib/plugin.mjs` and `commands/plugin.mjs`
  and no stray files

## Phase 5: Gate and live conversion

- [ ] 5.1 Run the lint gate and the full suite: `shellcheck scripts/hooks/*.sh
  scripts/wait-for-checks.sh` (v0.10.0, as in the baseline) and `node --test
  'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'`; record both on
  this line — verify: shellcheck exit 0 with no findings (baseline: exit 0, none); the
  suite reports 0 failures and more than the baseline's 894 tests

- [ ] 5.2 Convert the live plugin location: record the pre-conversion pins (`node
  scripts/agento.mjs models --plugin-root /home/david/DP/agento-plugin` and `grep -rn
  "^model:" /home/david/DP/agento-plugin/.github`) to `/tmp/plugin-slim-pins-before.txt`,
  then run `node scripts/agento.mjs plugin export --dest /home/david/DP/agento-plugin
  --replace-clone` from this worktree — verify: `du -sh /home/david/DP/agento-plugin` <
  10 MB; no `.git` and no `extension/node_modules` in it; `.agento-export.json`
  `source.commit` equals `git rev-parse origin/main`; the same pin capture taken after
  matches `/tmp/plugin-slim-pins-before.txt`; `node scripts/agento.mjs doctor
  --plugin-root /home/david/DP/agento-plugin` shows `harness` and `canvas` `ok`

- [ ] 5.3 Trigger and check a fresh snapshot: `code --new-window <empty tmp dir>`, wait
  for a new hex directory under
  `~/.config/Code/agentPlugins/file-home-david-DP-agento-plugin/`, then close that window
  — verify: the new snapshot's `du -sh` < 10 MB and its nonce matches the new
  `agento-plugin` mtime; inside it `./scripts/hooks/replay-guard.sh <
  tests/guard-fixtures.txt` passes; its `scripts/hooks/session-context.sh`, fed the
  SessionStart payload used by `tests/session-context.test.mjs`, prints the `Agento CLI:`
  context line; `~/.copilot/skills/agento/SKILL.md` resolves through the link

- [ ] 5.4 Prune the stale snapshots: `node scripts/agento.mjs plugin prune-snapshots
  --dry-run`, then without `--dry-run` — verify: `node scripts/agento.mjs plugin
  snapshots` lists exactly one snapshot (the one from 5.3), the total under
  `~/.config/Code/agentPlugins/file-home-david-DP-agento-plugin/` is < 10 MB, and `node
  scripts/agento.mjs doctor` shows `plugin-snapshots` `ok`; record the freed bytes on this
  line
