```yaml
status: in-progress
branch: feature/plugin-snapshot-slim
last-updated: 2026-11-04
next-step: "7.6 re-run the gate (review round 1)"
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

- [x] 5.1 Run the lint gate and the full suite: `shellcheck scripts/hooks/*.sh
  scripts/wait-for-checks.sh` (v0.10.0, as in the baseline) and `node --test
  'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'`; record both on
  this line. **Recorded:** shellcheck v0.10.0 exit 0, no findings (baseline: exit 0,
  none); full suite 911 tests, 911 pass, 0 fail (> baseline 894) — verify: shellcheck
  exit 0 with no findings (baseline: exit 0, none); the
  suite reports 0 failures and more than the baseline's 894 tests

- [x] 5.2 Convert the live plugin location: record the pre-conversion pins (`node
  scripts/agento.mjs models --plugin-root /home/david/DP/agento-plugin` and `grep -rn
  "^model:" /home/david/DP/agento-plugin/.github`) to `/tmp/plugin-slim-pins-before.txt`,
  then run `node scripts/agento.mjs plugin export --dest /home/david/DP/agento-plugin
  --replace-clone` from this worktree. **Recorded:** export is 5.2M, no `.git`/no
  `extension/node_modules`, `source.commit` 20e8d0f equals `origin/main`; the 31
  `^model:` pin lines match the pre-conversion capture; doctor `harness` and `canvas`
  are `ok`. A maxBuffer fix in `archiveInto` (large repo archives exceeded the 1 MB
  default) landed with a regression test and a regenerated mirror — verify: `du -sh
  /home/david/DP/agento-plugin` <
  10 MB; no `.git` and no `extension/node_modules` in it; `.agento-export.json`
  `source.commit` equals `git rev-parse origin/main`; the same pin capture taken after
  matches `/tmp/plugin-slim-pins-before.txt`; `node scripts/agento.mjs doctor
  --plugin-root /home/david/DP/agento-plugin` shows `harness` and `canvas` `ok`

- [x] 5.3 Trigger and check a fresh snapshot: `code --new-window <empty tmp dir>`, wait
  for a new hex directory under
  `~/.config/Code/agentPlugins/file-home-david-DP-agento-plugin/`, then close that window.
  **Recorded:** fresh snapshot `1a1a7fc067d`, 5.2M (< 10 MB), nonce equals the new
  `agento-plugin` mtime (±1 ms timestamp rounding); `replay-guard.sh` exits 0 and
  `session-context.sh` prints `Agento CLI: node …/1a1a7fc067d/scripts/agento.mjs`;
  `~/.copilot/skills/agento/SKILL.md` resolves through the link. Observation: VS
  Code's staged copy drops the `+x` bit on `scripts/hooks/*.sh` (VS Code runs them
  through a shell, so the plugin works); the guard smoke needed `chmod +x` inside
  the staged snapshot — verify: the new snapshot's `du -sh` < 10 MB and its nonce matches the new
  `agento-plugin` mtime; inside it `./scripts/hooks/replay-guard.sh <
  tests/guard-fixtures.txt` passes; its `scripts/hooks/session-context.sh`, fed the
  SessionStart payload used by `tests/session-context.test.mjs`, prints the `Agento CLI:`
  context line; `~/.copilot/skills/agento/SKILL.md` resolves through the link

- [x] 5.4 Prune the stale snapshots: `node scripts/agento.mjs plugin prune-snapshots
  --dry-run`, then without `--dry-run` — verify: `node scripts/agento.mjs plugin
  snapshots` lists exactly one snapshot (the one from 5.3), the total under
  `~/.config/Code/agentPlugins/file-home-david-DP-agento-plugin/` is < 10 MB, and `node
  scripts/agento.mjs doctor` shows `plugin-snapshots` `ok`; record the freed bytes on this
  line. **Recorded:** the prune ran for real in the earlier session and freed
  949706752 B (it also deleted the in-use `1a194a81a45` — defect 6.1); re-verified now
  without re-pruning: `plugin snapshots` lists exactly `1a1a7fc067d` (5353472 B, 5.1M),
  the location total is 5.2M < 10 MB, and `doctor` shows `plugin-snapshots` `ok`

## Phase 6: Defects found while pruning (added 2026-11-04)

- [x] 6.1 Prune must not delete snapshots in use by open windows. Keeping only the
  newest snapshot and the one containing the running CLI deleted the snapshot
  already-open VS Code windows were running their plugin hooks from (5.4 took out
  `1a194a81a45`). Make `prune-snapshots` detect in-use snapshots — scan running
  processes' `cwd`/`cmdline`/`environ` under `/proc` on Linux plus the
  `CLAUDE_PLUGIN_ROOT`/`PLUGIN_ROOT` of the current process and its ancestors — and
  skip them, reporting them as `inUse` with the reload advice; where detection is
  unavailable (non-Linux) the default is safe: deleting requires `--force`. Make the
  doctor `plugin-snapshots` stale fallback and the docs say "reload open VS Code
  windows first". Tests with a fixture tree and an injectable process scanner —
  verify: `node --test scripts/commands/plugin.test.mjs scripts/commands/doctor.test.mjs`
  passes; `node scripts/agento.mjs plugin prune-snapshots --dest
  /home/david/DP/agento-plugin --dry-run` exits 0 with `inUseDetection: true` and
  `removed: []` (deletes nothing)

- [x] 6.2 Executable bits on hook scripts. 5.3 observed VS Code's staged copy drops
  the `+x` bit on `scripts/hooks/*.sh`. Confirm the cause and record it: `git
  ls-files -s` tracks the `.sh` files mode 100755 and the 5.2 live export at
  `/home/david/DP/agento-plugin` has `+x` on `scripts/hooks/*.sh` and
  `scripts/wait-for-checks.sh`, so `plugin export` (git archive) preserves modes and
  VS Code's staging is what drops them (the surviving snapshot's `wait-for-checks.sh`
  is still `-rw-rw-r--`; its hooks were restored `+x` by hand in 5.3). Document the
  limitation in `docs/copilot-harness.md`, and add a doctor `plugin-snapshots` warn
  when the newest snapshot's `scripts/hooks/*.sh` are not executable (fallback: reload
  the open VS Code window so it re-stages, or `chmod +x` the scripts inside the
  snapshot), with a test — verify: `node --test scripts/commands/doctor.test.mjs
  scripts/commands/plugin.test.mjs` passes; `git ls-files -s scripts/hooks
  scripts/wait-for-checks.sh` shows 100755 for the `.sh` files; `node
  scripts/agento.mjs doctor` shows `plugin-snapshots` `ok` on this machine (its newest
  snapshot's hooks are `+x` after the 5.3 restore). **Recorded:** cause is VS Code's
  staged copy — `git ls-files -s` tracks `delivery-guard.sh`/`replay-guard.sh`/
  `session-context.sh`/`wait-for-checks.sh` mode 100755, and the 5.2 live export at
  `/home/david/DP/agento-plugin` has `-rwxrwxr-x` on all four, so `plugin export`
  (git archive + tar) preserves 100755; the surviving snapshot `1a1a7fc067d` has
  `-rwxrwxr-x` on its hooks only because 5.3 restored them by hand, and its
  `scripts/wait-for-checks.sh` is still `-rw-rw-r--` — VS Code's staging is what
  drops the `+x` bit. Documented in `docs/copilot-harness.md`; `doctor
  plugin-snapshots` now warns when the newest snapshot's hook scripts are not
  executable, with a reload/chmod fallback and a test

- [x] 6.3 Re-run the gate after 6.1–6.2: `cd extension && npm run copy-cli && npm run
  build && npm run test:unit`; shellcheck v0.10.0 on `scripts/hooks/*.sh
  scripts/wait-for-checks.sh`; the full suite `node --test 'scripts/**/*.test.mjs'
  'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` — verify: the three extension steps
  exit 0, shellcheck exits 0 with no findings, and the full suite reports 0 failures;
  record the three results on this line. **Recorded:** extension gate — `copy-cli`
  regenerated the mirror (`extension/cli/{commands/plugin.mjs,lib/doctor.mjs,lib/plugin.mjs}`
  modified, no stray files), `build` and `test:unit` exit 0 (252 pass, 0 fail);
  shellcheck v0.10.0 exit 0, no findings; full suite 915 tests, 915 pass, 0 fail
  (baseline 894 in 5.1)

## Phase 7: Review round 1 findings (added 2026-11-04)

- [x] 7.1 In-use detection must see idle open windows (added 2026-11-04). The 6.1
  `/proc` path scan is empty for the very window the 5.4 incident hit: with
  `1a1a7fc067d` loaded by the windows reloaded at 14:21/14:23 (`ps -o lstart` on the
  `code` processes), `defaultProcessScan()` returned 322 paths, none under the
  snapshot, and a manual scan of every `/proc/<pid>/{cwd,exe,cmdline,environ,fd,maps}`
  found no process referencing `agentPlugins` at all — VS Code's agent host runs each
  hook as a short-lived `/bin/sh -c` child, so nothing holds the path between hooks
  and `inUseDetection: true` gives false assurance. Anchor detection on VS Code
  process start times: for each running VS Code window / extension-host process
  (`/proc/<pid>/stat` starttime or `ps -o lstart`), the snapshot it loaded is the
  newest whose nonce (hex ms) ≤ its start time; keep every such snapshot (plus the
  newest and the running CLI), keep the `/proc` path scan as an extra signal, report
  which windows pin each kept snapshot (e.g. `usedBy`), and set `inUseDetection:
  true` only when the process list was readable. Tests with an injectable process
  list (pid, start ms) — verify: `node --test scripts/commands/plugin.test.mjs`
  passes; on this machine with the build window open, `node scripts/agento.mjs plugin
  prune-snapshots --dest /home/david/DP/agento-plugin --dry-run` names this window's
  snapshot (`1a1a7fc067d` or its successor) as pinned by at least one window in its
  output, rather than keeping it only because it is the newest
- [x] 7.2 Hooks must run from a freshly staged snapshot (added 2026-11-04). VS Code's
  agent host runs every command hook as `/bin/sh -c "<path with
  ${CLAUDE_PLUGIN_ROOT} expanded>"` (`/usr/share/code/resources/app/out/vs/platform/
  agentHost/node/agentHostMain.js`, function `_R`), and staging drops `+x` on every
  file (the snapshot's `scripts/agento.mjs` and `scripts/wait-for-checks.sh` are
  `-rw-rw-r--` while the export has `-rwxrwxr-x`), so a hook in a fresh snapshot exits
  126 `Permission denied` (reproduced with a `chmod 664` copy of
  `session-context.sh` under `/bin/sh -c`). The `docs/copilot-harness.md:112–113`
  claim "VS Code runs the hooks through a shell so the plugin still works" is wrong;
  every `plugin export` changes the location mtime and so produces a snapshot whose
  hooks are broken until someone runs `doctor` and `chmod`s. Make the hooks
  mode-independent — `hooks/hooks.json` commands as `bash
  ${CLAUDE_PLUGIN_ROOT}/scripts/hooks/<hook>.sh` (or an equivalent the Builder
  justifies on the step line), keeping `hook-wiring`/customization tests green —
  correct `docs/copilot-harness.md` (and any doc repeating the claim), and keep the
  6.2 doctor warn — verify: `node --test 'tests/**/*.test.mjs'
  scripts/commands/doctor.test.mjs` passes; in a temp copy of
  `/home/david/DP/agento-plugin` with `chmod -x scripts/hooks/*.sh`, each
  `hooks/hooks.json` command with `${CLAUDE_PLUGIN_ROOT}` substituted exits 0 under
  `/bin/sh -c` (SessionStart payload for `session-context.sh`, a PreToolUse payload
  for `delivery-guard.sh`); `grep -n "still works" docs/copilot-harness.md` matches
  nothing
- [x] 7.3 Add the missing `swap()` rollback test (added 2026-11-04). Review round 1
  Finding 4: the atomicity test only exercises a bad `--ref`, refused before the
  temp tree exists, so `swap()`'s `renameSync(old, dest)` recovery branch is
  untested. Add a test seam in `swap()` that injects a failure at the final
  `renameSync(tempDir, dest)`, and a test asserting the re-export is refused
  (exit 3), the old destination is restored byte-identical, and no
  `<dest>.agento-*` temp/old directories remain — verify: `node --test
  scripts/commands/plugin.test.mjs` passes
- [x] 7.4 Add `--force` to the `plugin` usage header (added 2026-11-04). Review
  round 1 Finding 5: `scripts/agento.mjs:39` lists `[--dest] [--dry-run] [--ref]
  [--source] [--replace-clone]` but not the `prune-snapshots --force` escape that
  `docs/commands.md` documents; add `[--force]` to that line and to the
  `docs/commands.md` plugin usage line — verify: `node --test tests/cli-layout.test.mjs`
  passes and the header line names `[--force]`
- [x] 7.5 Deduplicate the doctor `plugin-snapshots` export fallbacks (added
  2026-11-04). Review round 1 Finding 6: a clone location whose newest snapshot
  is > 10 MB gets both `plugin export --dest X --replace-clone` and a no-op
  `plugin export --dest X`; emit the `--replace-clone` form for a clone in the
  > 10 MB branch so the Set dedupe collapses them, and report `droppedIgnoredBytes`
  with du-style allocated bytes like every other figure — verify: `node --test
  scripts/commands/doctor.test.mjs scripts/commands/plugin.test.mjs` passes
- [ ] 7.6 Re-run the gate after 7.1–7.5 (added 2026-11-04): `cd extension && npm run
  copy-cli && npm run build && npm run test:unit`; shellcheck v0.10.0 on
  `scripts/hooks/*.sh scripts/wait-for-checks.sh`; the full suite `node --test
  'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` — verify: the
  three extension steps exit 0 with `git status --porcelain extension/cli` showing no
  stray files, shellcheck exits 0 with no findings (baseline: exit 0, none), and the
  full suite reports 0 failures with more than 915 tests; record the three results on
  this line
