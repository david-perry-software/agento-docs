# Slim plugin snapshots: export a clean plugin tree and prune stale VS Code copies

## Problem

VS Code does not load an agent plugin from its `chat.pluginLocations` directory directly:
it stages a full copy under `~/.config/Code/agentPlugins/<location>/<nonce>/` and runs
the plugin from there (`docs/copilot-harness.md:33`, `:52–54`). On this machine the
registered location `/home/david/DP/agento-plugin` is a full git clone that also holds
the VS Code extension's build dependencies, so every staged copy is ≈ 182 MB — 162 MB of
`extension/node_modules` and 15 MB of `.git` — and VS Code never deletes the old copies:
seven snapshots sit under `~/.config/Code/agentPlugins/file-home-david-DP-agento-plugin/`
(13, 14, 177, 178, 180, 181, 182 MB ≈ 0.9 GB). Every plugin update copies another
≈ 182 MB.

This feature implements the `### plugin-snapshot-slim` member block of the initiative
[agento-speed breakdown](../../../../initiatives/2026/11/agento-speed/breakdown.md):
publish the plugin without `extension/node_modules` and `.git`, and clean stale plugin
entries, so each snapshot drops from ≈ 182 MB to a few MB (initiative definition of
done: the snapshot is under 10 MB).

## Decisions

Clarifying questions asked 2026-11-04 (numbered-list fallback, §10). The user's answer,
verbatim: **"all recommended"** — every recommended option below was chosen.

1. How should the slim plugin copy be produced? → **a (recommended)**: a new
   `agento.mjs plugin export [--dest <dir>] [--ref <ref>]` that writes `git archive` of
   the tracked tree (≈ 4.5 MB, no `.git`, no `node_modules`) atomically to the
   destination, with a stamp file naming the source commit. (Not chosen: b — a runtime
   allow-list of directories; c — documentation only.)
2. Where does the export go? → **a (recommended)**: replace
   `/home/david/DP/agento-plugin` in place, so `settings.json` and the harness links stay
   unchanged; the export refuses a git clone unless `--replace-clone`, and refuses even
   then if the clone has unpushed commits or changes beyond model pins. (Not chosen: b —
   a new default destination with `chat.pluginLocations` and `harness install` updated.)
3. What happens to the model pins? → **a (recommended)**: carry them over — the export
   reads the destination's current `model:` pins before the swap and writes them into the
   fresh tree; `models apply --plugin-root <export>` keeps working without git. (Not
   chosen: b — re-apply only the named primary profile.)
4. The stale snapshots (7 × ≈ 180 MB)? → **a (recommended)**: a `doctor` check (warn on a
   snapshot > 10 MB, stale-snapshot count and size, `chat.pluginLocations` entries whose
   directory no longer exists) plus an explicit `plugin prune-snapshots` that keeps only
   the newest. (Not chosen: b — doctor warns, deletion documented as manual `rm`; c —
   leave them.)
5. Verification on this machine? → **a (recommended)**: the Builder converts the live
   `/home/david/DP/agento-plugin` in the final phase (it is clean and level with its
   remote; only the ignored `node_modules` is lost), opens a new VS Code window to
   trigger a fresh snapshot, asserts it is < 10 MB and that hooks and `/agento` still
   work, then prunes the old snapshots. (Not chosen: b — verify against a temporary
   destination only and let the user convert after ship.) Accepted with it: VSIX
   builds move from `agento-plugin/extension` to the primary clone
   `/home/david/DP/agento`.

## Research

Skills consulted: none — no matching domain (this repository's AGENTS.md has no
`## Agento` skills table; the work is Node CLI, VS Code settings, and docs).

**Live machine facts (2026-11-04).**

- `/home/david/DP/agento-plugin` is a git clone of `david-perry-software/agento` on
  `main` at `065ae87` (`origin/main` is `20e8d0f`), clean, not ahead of its remote;
  `.git` 15 MB, `extension/node_modules` 162 MB (ignored by `.gitignore`), total 182 MB.
- `~/.config/Code/User/settings.json:35–37` registers it as the only
  `chat.pluginLocations` entry. The `/tmp/agento-scratch-plugin` entry named in the
  breakdown is already gone: not in `settings.json`, not in
  `~/.config/Code/agentPlugins/cache.json` (its 7 `file:` entries are all
  `file:///home/david/DP/agento-plugin`), and `/tmp/agento-scratch-plugin` does not
  exist. The "drop the stale entry" part of the brief therefore becomes a doctor check
  for `chat.pluginLocations` entries whose directory is missing, so the class of
  problem stays visible.
- Snapshot naming: the location `file:///home/david/DP/agento-plugin` maps to the
  directory `agentPlugins/file-home-david-DP-agento-plugin/`; each snapshot directory is
  named by a hex millisecond timestamp equal to the location directory's mtime
  (`1a194a81a45` = 2026-10-31 21:10:07.173, the `agento-plugin` mtime). `cache.json`
  lists `{ uri, nonce }` per snapshot. No snapshot is ever deleted. The first two
  snapshots (13–14 MB) predate `extension/node_modules` in the clone.
- `~/.copilot/skills/agento → /home/david/DP/agento-plugin/skills/agento` and
  `~/.copilot/extensions/agento-mission-control →
  /home/david/DP/agento-plugin/canvas/agento-mission-control`: replacing the directory
  in place keeps both links valid.
- The clone carries model pins through the git clean/smudge filter
  `filter.agento-models` (`git config --local`), `primary: custom` (no named profile),
  six agent `model:` lines; `doctor --plugin-root /home/david/DP/agento-plugin` reports
  `model-profile` `warn` (two files added since the last apply carry no pin).
- `git archive origin/main | wc -c` = 4,505,600 B (extension 1.4 MB incl. the committed
  `extension/cli/`, scripts 1.4 MB, tests 0.4 MB, canvas 0.4 MB, docs 0.2 MB) — a
  tracked-tree export alone meets the < 10 MB target, so no allow-list is needed.

**Codebase.**

- No step produces a separate plugin copy; installation is registration
  (`docs/install.md:20–57`), and `harness install` only links the router skill and the
  canvas (`scripts/commands/harness.mjs:11–92`). `README.md:105–116` and
  `docs/install.md:167–179` ("Updating") tell the user to `git pull` the registered
  clone.
- `harnessFacts()` (`scripts/lib/copilot.mjs:42–59`) uses `primaryCheckoutOf(root) ??
  root`, so a non-git plugin root works unchanged for the `harness` and `canvas` doctor
  checks (`scripts/lib/doctor.mjs:215–239`).
- Model pins: `modelTargetFiles()` (`scripts/lib/models.mjs:114`), `modelsState()`
  (`:296–321`, with `isGit` false for a plain directory and `dirtyBeyondModel` for the
  "changes beyond pins" test), `pinModels()` (`:515`) already handles a non-git root
  (test `models apply on a non-git plugin root rewrites without flags`,
  `scripts/commands/models.test.mjs:1562`). Pin read/write helpers: `handoffModelLines`,
  `readModel`, `setModel`, `setHandoffModels` (`scripts/model-profiles.mjs:381–440`).
- Doctor: `DOCTOR_CHECKS` (`scripts/lib/doctor.mjs:42–271`) return `{ status, detail,
  fallback }`; informational checks are left out of `CAPABILITY_CHECKS` (`:344`) so
  `doctor --for` never runs them. `hook-wiring` (`:193–212`) already parses
  `chat.pluginLocations` via the private `vscodeSettingsPath()` (`:297`, override
  `AGENTO_VSCODE_SETTINGS`) and `expandHome()` (`:303`). Rendering
  `scripts/commands/doctor.mjs:29–36`; tests `scripts/commands/doctor.test.mjs:834–873`.
  The documented check list is `docs/architecture.md:432–442`.
- CLI registration: `COMMAND_MODULES` (`scripts/agento.mjs:49–84`) and the usage header
  (`scripts/agento.mjs:7–40`) must match both ways (`tests/cli-layout.test.mjs:51–60`);
  CLI reference `docs/commands.md:527`. `extension/cli/` is a committed byte copy of
  `scripts/` regenerated by `cd extension && npm run copy-cli`.
- The Session & Doctor view parses checks generically (`parseChecks`,
  `extension/src/sessionDoctorModel.ts:163`), so a new doctor check needs no extension
  code.
- The canvas has no `package.json` and no dependencies
  (`canvas/agento-mission-control/`), so a tracked-tree export runs it as is.
- Hook smoke checks that can run against any plugin copy: `scripts/hooks/replay-guard.sh
  < tests/guard-fixtures.txt` (AGENTS.md) and the SessionStart hook driven by
  `tests/session-context.test.mjs:10`.

**Lint baseline (§5).** AGENTS.md's lint is `shellcheck scripts/hooks/*.sh
scripts/wait-for-checks.sh`. `shellcheck` is not installed; the baseline ran with the
official v0.10.0 release binary (downloaded to `/tmp/sc-20e8`): `shellcheck
scripts/hooks/delivery-guard.sh scripts/hooks/replay-guard.sh
scripts/hooks/session-context.sh scripts/wait-for-checks.sh` → exit 0, no findings.
Full test suite `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'
'canvas/**/*.test.mjs'` at `20e8d0f` → 894 tests, 894 pass, 0 fail. Overlap decision:
the baseline is green and this delivery adds or changes no shell file, so the gate is a
full lint rerun (exit 0, no findings) plus the full test suite and the extension unit
tests — no scoped gate needed.

**Concurrent deliveries.** `gh pr list --state open` is empty in both
`david-perry-software/agento` and `david-perry-software/agento-docs` — no overlap.

## Approach

New command family `plugin` (module `scripts/commands/plugin.mjs`, shared logic in
`scripts/lib/plugin.mjs`), registered in `COMMAND_MODULES` and the usage header; JSON
output like the other commands; exit 0 ok, 1 usage, 3 refused/failed.

1. **Snapshot model (`scripts/lib/plugin.mjs`).** `agentPluginsDir(env)` —
   `AGENTO_VSCODE_AGENT_PLUGINS` override, else `<XDG_CONFIG_HOME|~/.config>/Code/
   agentPlugins` (macOS `~/Library/Application Support/Code/agentPlugins`), mirroring
   `vscodeSettingsPath()`. `snapshotDirName(location)` maps a location path to its
   staged directory name using the rule confirmed on this machine in roadmap 1.1;
   `listSnapshots(location)` returns `{ nonce, path, bytes, mtime }` for hex-named
   children, newest = largest nonce. `pluginLocations()` reads enabled
   `chat.pluginLocations` entries (moving `vscodeSettingsPath`/`expandHome` out of
   `doctor.mjs` into a shared export so both use one copy) and classifies each as
   `missing`, `export` (has `.agento-export.json`), `clone` (git checkout whose
   `.claude-plugin/plugin.json` is Agento's), or `other`.
2. **`plugin export [--dest <dir>] [--ref <ref>] [--source <clone>] [--replace-clone]`.**
   - Source: the git checkout the CLI runs from, or `--source`; a staged snapshot or
     other non-git root is refused with a message naming `--source`. The source is
     fetched; the default ref is `origin/<default branch>` so a plugin never runs
     unshipped branch code; `--ref` overrides.
   - Destination: `--dest`, else the single enabled `chat.pluginLocations` entry that is
     an Agento plugin (refused, listing candidates, when there are none or several).
   - Build: `git archive <commit>` extracted into a sibling temp directory
     (`<dest>.agento-export-<pid>`), then `.agento-export.json` written
     (`{ source: { remote, ref, commit }, exportedAt, carriedPins }`).
   - Pin carry-over: before the swap, read every `modelTargetFiles()` file's `model:`
     line and handoff model lines from the old destination (`readModel`,
     `handoffModelLines`) and write them into the same files of the new tree
     (`setModel`, `setHandoffModels`). Files new in the release get no pin and are
     listed under `unpinned` (same meaning as `filter.unrecorded`), with the fallback
     `models apply <name> --plugin-root <dest>`.
   - Swap: rename `<dest>` → `<dest>.agento-old-<pid>`, rename the temp tree → `<dest>`,
     delete the old tree. A failure before the swap removes the temp tree and leaves
     `<dest>` untouched. The new directory's mtime changes, so VS Code stages one new
     snapshot.
   - Safety: an existing destination must be empty, an earlier export (stamp present),
     or — only with `--replace-clone` — an Agento git clone that has no changes beyond
     model pins (`modelsState().dirtyBeyondModel`, plus untracked non-ignored files), no
     commits missing from every remote (`git log --branches --not --remotes`), and no
     stash entries. Anything else is refused and names the blocker. The output reports
     the bytes of ignored content that was dropped (e.g. `extension/node_modules`).
3. **`plugin snapshots [--dest <dir>]`** reports the staged snapshots of the Agento
   location (count, each size, newest, total). **`plugin prune-snapshots [--dest
   <dir>] [--dry-run]`** deletes every hex-named snapshot directory of that location
   except the newest and except the one containing the running CLI (`PLUGIN_ROOT`). It
   never touches `cache.json`, other locations, or non-hex names, reports freed bytes,
   and tells the user to reload open VS Code windows.
4. **Doctor `plugin-snapshots`** (informational, not in `CAPABILITY_CHECKS`, warn at
   most, every error caught as `warn`): `warn` for enabled `chat.pluginLocations`
   entries whose directory is missing (fallback: remove the entry from settings);
   `warn` when the Agento location is a git clone or its newest snapshot is > 10 MB
   (fallback: `agento.mjs plugin export --dest <dir> --replace-clone`); `warn` when
   stale snapshots exist (fallback: `agento.mjs plugin prune-snapshots`, with count and
   MB); `ok` otherwise.
5. **Docs.** `docs/install.md` Option A: keep the clone as the source and register an
   export (`plugin export --dest <dir>`); "Updating": `plugin export` replaces
   `git pull`, pins carry over, `prune-snapshots` reclaims space, VSIX builds happen in
   the clone. `README.md:105–116` likewise. `docs/model-profiles.md`: pins on an export
   (no git filter; carried by `plugin export`). `docs/commands.md` CLI reference,
   `docs/architecture.md` doctor check list, `docs/copilot-harness.md` staged-copy note
   (naming rule; snapshots are kept until pruned), `CHANGELOG.md` entry.
6. **Mirror.** `cd extension && npm run copy-cli` regenerates `extension/cli/`
   (new `lib/plugin.mjs`, `commands/plugin.mjs`, changed `agento.mjs`, `lib/doctor.mjs`).

Affected files: the two new modules plus `scripts/commands/plugin.test.mjs`,
`scripts/agento.mjs`, `scripts/lib/doctor.mjs`, `scripts/commands/doctor.test.mjs`,
`extension/cli/**` (generated), and the docs in item 5.

**Lint gate in the approach.** No shell file changes; the final gate is the full
`shellcheck` rerun (exit 0, no findings, same as baseline), the full test suite (all
pass, 894 baseline plus the new tests), and `cd extension && npm run build && npm run
test:unit`.

## Risks

- **VS Code's staging is undocumented** (directory naming, the mtime nonce, whether a
  new window re-stages). Mitigation: roadmap 1.1 confirms the naming rule against the
  live `cache.json` and directory names before code is written and records it in
  `docs/copilot-harness.md`; `listSnapshots` only trusts hex-named children; the live
  phase verifies a fresh snapshot really appears and is < 10 MB.
- **Pruning a snapshot an open window still runs from** breaks that window's plugin
  hooks until it reloads. Mitigation: prune keeps the newest and the running CLI's own
  snapshot, is never automatic (doctor only suggests it), prints the reload advice, and
  the live phase prunes last and checks hooks against the surviving snapshot.
- **Converting the live clone loses ignored content** (`extension/node_modules`) and
  the git filter config. Mitigation: `--replace-clone` refuses on unpushed commits,
  stashes, or changes beyond pins and reports dropped bytes; the user accepted that VSIX
  builds move to `/home/david/DP/agento` (Decision 5); pins are carried over (Decision 3)
  and compared before and after in roadmap 5.2.
- **Custom pins are lost if carry-over misses a file shape** (handoff model lines).
  Mitigation: a test with frontmatter `model:` plus handoff model lines across agents and
  prompts; the live step diffs `models` output before and after.
- **The export runs from a staged snapshot** (Copilot sessions name the staged copy in
  `Agento CLI:`), which has no `.git`. Mitigation: refused with a message naming
  `--source <clone>`.
- **An export from `origin/main` does not contain this feature until it ships**, so the
  live conversion in phase 5 exports pre-feature code. Mitigation: expected; after
  `/agento ship` the user re-runs `plugin export` (documented in "Updating"); the
  conversion is verified on size, pins, links, and hooks, which don't depend on it.
- **Concurrent delivery:** none open at planning time. Mitigation: integrate
  `origin/main` before every push (`agento.mjs sync`), especially for
  `scripts/lib/doctor.mjs` and `docs/`, which other members also touch.

## Out of scope

- Changing how VS Code stages plugins or editing VS Code's `cache.json`.
- Teaching `hook-wiring` to recognise an export of this repository (the registered
  plugin is already a separate clone today, so this is not a regression).
- A `/agento` slash command for export or prune (CLI and docs only).
- Install paths B and C (install from source, Copilot CLI), which VS Code manages.
- The extension's VSIX build flow, beyond documenting that it runs in the clone.
- The synced-customization snapshots under `agentPlugins/` (user environment).

## Acceptance checklist

- [ ] `node scripts/agento.mjs plugin export --dest <tmp> --ref <commit>` from a
  fixture clone produces exactly the `git ls-tree -r --name-only <commit>` file set plus
  `.agento-export.json` (source remote, ref, commit), with no `.git` and no
  `node_modules` — verified by tests in `scripts/commands/plugin.test.mjs`.
- [ ] Export is atomic and safe: a failure injected before the swap leaves the old
  destination byte-identical; a non-empty non-export destination is refused; a git
  clone is refused without `--replace-clone`, and with it when the clone has unpushed
  commits, a stash, or changes beyond model pins — each refusal exits 3 and names the
  blocker (tests).
- [ ] Model pins carry over: the destination's frontmatter `model:` lines and handoff
  model lines appear unchanged in the re-exported tree; new files are listed as
  `unpinned`; `models --plugin-root <dest>` reports the same active profile before and
  after (tests).
- [ ] `plugin snapshots` and `plugin prune-snapshots` (fixture `agentPlugins` via
  `AGENTO_VSCODE_AGENT_PLUGINS`) report and delete only stale hex-named snapshots of the
  Agento location, keep the newest and the running one, honour `--dry-run`, and report
  freed bytes (tests).
- [ ] Doctor `plugin-snapshots` warns on a missing `chat.pluginLocations` directory, a
  clone-registered or > 10 MB snapshot, and stale snapshots, each with the exact
  fallback command; it is `ok` for a single small snapshot of an export, never `fail`s,
  and is absent from every `doctor --for` run (tests in
  `scripts/commands/doctor.test.mjs`).
- [ ] `plugin` is in `COMMAND_MODULES` and the usage header (`node --test
  tests/cli-layout.test.mjs` passes); `extension/cli/` is regenerated and byte-identical
  (`cd extension && npm run build && npm run test:unit` pass).
- [ ] Docs updated: `docs/install.md` (Option A + Updating), `README.md`,
  `docs/model-profiles.md`, `docs/commands.md`, `docs/architecture.md`,
  `docs/copilot-harness.md`, `CHANGELOG.md` describe export, pin carry-over, prune, and
  the doctor check (`node --test tests/customizations.test.mjs` passes; grep evidence).
- [ ] Lint gate: full `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` exit 0
  with no findings (baseline: exit 0, none), and the full test suite passes with 0
  failures (baseline 894/894).
- [ ] Live: `/home/david/DP/agento-plugin` is an export of `origin/main` (no `.git`, no
  `extension/node_modules`, `du -sh` < 10 MB), its model pins match the pre-conversion
  list, and the `harness` and `canvas` doctor checks are `ok`.
- [ ] Live: after opening a new VS Code window, a new snapshot appears under
  `~/.config/Code/agentPlugins/file-home-david-DP-agento-plugin/` and is < 10 MB; the
  hooks run from that snapshot (guard replay fixtures pass against it, the SessionStart
  hook emits the context line) and the router skill resolves; after `plugin
  prune-snapshots` only that snapshot remains and doctor `plugin-snapshots` is `ok`.
