# Review: plugin-snapshot-slim

Verdict: request-changes

Reviewed 2026-11-04 (round 1) in the build worktree
`/home/david/DP/agento-worktrees/plan-20261104-180137` at product `4e6b411`
(`feature/plugin-snapshot-slim`, `origin/main` an ancestor, both halves clean,
`ahead 0 / behind 0`; companion `2dc553b` on the mirrored branch). Code diff:
`git diff origin/main...HEAD` (21 files, +2092/−31; 15 commits, one per roadmap
step). Artifact diff: companion `origin/main...HEAD` (plan.md + roadmap.md, 21 commits
— one artifact commit per step; the two-commit rule holds).

Skills consulted: none — no matching domain (AGENTS.md has no `## Agento` skills table;
the work is a Node CLI, VS Code settings/staging, node:test suites, and docs).

Safety envelope for this review (the review ran inside the VS Code window whose
plugin hooks load from the only live snapshot): no `prune-snapshots` without
`--dry-run`, nothing under `~/.config/Code/agentPlugins` modified, no re-export of
`/home/david/DP/agento-plugin`. Destructive paths were exercised only by the test
suite's `/tmp` fixtures.

## Verification run

| Check | Command | Result |
| --- | --- | --- |
| Full suite | `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` | 915 tests, 915 pass, 0 fail (baseline 894) |
| Layout + customizations | `node --test tests/cli-layout.test.mjs tests/customizations.test.mjs` | 72 pass, 0 fail |
| Shell lint (§5 gate) | `/tmp/sc-review/shellcheck` v0.10.0 on `scripts/hooks/*.sh scripts/wait-for-checks.sh` | exit 0, no findings (baseline: exit 0, none) |
| Mirror byte-identity | `cd extension && npm run copy-cli` then `git status --porcelain --untracked-files=all` | empty — `extension/cli/` already regenerated |
| Extension build / unit | `npm run build`; `npm run test:unit` | exit 0; 252 pass, 0 fail |
| Usage error | `node scripts/agento.mjs plugin bogus; echo $?` | `usage-error … known: export, snapshots, prune-snapshots`, exit 1 |
| Live snapshots (read-only) | `plugin snapshots` | 1 snapshot `1a1a7fc067d`, 5,353,472 B (5.1M), total 5.1M |
| Live dry-run prune | `plugin prune-snapshots --dest /home/david/DP/agento-plugin --dry-run` | exit 0, `inUseDetection: true`, `removed: []`, `wouldRemove: []` |
| Live doctor | `node scripts/agento.mjs doctor` / `--plugin-root /home/david/DP/agento-plugin` | `plugin-snapshots ok`, `harness ok`, `canvas ok`, `hook-wiring ok` |

## Acceptance checklist results

1. **Export = `git ls-tree -r --name-only <commit>` + `.agento-export.json`, no `.git`,
   no `node_modules`** — **pass**. `scripts/commands/plugin.test.mjs:162` asserts
   `walk(dest)` equals the ls-tree set plus the stamp and that `.git`/`node_modules`
   are absent; the stamp carries `source.remote/ref/commit`; `:221` covers an archive
   above the 1 MB `execFileSync` default (`archiveInto` sets `maxBuffer` 256 MB).
   Passed in the full run.
2. **Atomic and safe export; each refusal exits 3 and names the blocker** — **pass**.
   Tests `:162` (bad ref → dest `contentMap` identical, no `<dest>.agento-*` stray
   dirs), `:296` (clone needs `--replace-clone`; clean clone with ignored bytes
   replaced, `droppedIgnoredBytes` > 0), `:315` (changes beyond pins, untracked files,
   local commits, stash — each `code 3` with the blocker in `message`/`blockers`),
   `:356` (non-empty non-export/non-clone refused). Note (minor, Finding 4): the
   "failure before the swap" case is a ref refusal that happens before the temp tree
   exists; `swap()`'s rollback branch (`renameSync(old, dest)`) is not exercised.
3. **Model pins carry over; new files `unpinned`; same active profile** — **pass**.
   `:411` (clone with filter pins → export → re-export; `models --plugin-root` active
   name equal before/after) and `:567` (`unpinned: [".github/agents/reviewer.agent.md"]`).
   Live: the 31 `^model:` lines in `/home/david/DP/agento-plugin/.github` and the
   `models --plugin-root` report match `/tmp/plugin-slim-pins-before.txt` except the
   git-filter block (`filter`, `skipWorktree`), which an export legitimately lacks.
4. **`snapshots` / `prune-snapshots` on a fixture tree: only stale hex-named snapshots of
   the Agento location; newest and running kept; `--dry-run`; freed bytes** — **pass**
   on the fixture. `:452` (`snapshotsToPrune`: newest, `PLUGIN_ROOT`, in-use), `:475`,
   `:487` (`planPrune` blocks without detection unless `--force`; dry run allowed),
   `:514` (end-to-end: dry run deletes nothing, prune removes exactly the two stale
   nonces, `not-hex/`, `cache.json`, and the other location untouched, `freedBytes` >
   0). The in-use detection the fixture injects does not hold up on the live machine —
   see Finding 1.
5. **Doctor `plugin-snapshots`: warns on missing dir / clone / > 10 MB / stale, exact
   fallbacks, `ok` for a slim export, never `fail`, absent from every `--for`** —
   **pass**. `scripts/commands/doctor.test.mjs` (new tests at the diff's `+45`, `+105`)
   cover each warn with its fallback regex, `ok … slim`, and `--for models`; the
   structural guarantee is that `plugin-snapshots` is not in `CAPABILITY_CHECKS`
   (`grep -A12 "^const CAPABILITY_CHECKS" scripts/lib/doctor.mjs` → 0 matches), and
   the check body wraps everything in `try … asWarn`.
6. **`plugin` in `COMMAND_MODULES` and the usage header; mirror regenerated and
   byte-identical; extension build + unit tests pass** — **pass**.
   `scripts/agento.mjs:39` (header) and `:56` (`plugin: "plugin"`);
   `tests/cli-layout.test.mjs` passed; `npm run copy-cli` left `git status` empty;
   build exit 0; `test:unit` 252/252.
7. **Docs updated (install, README, model-profiles, commands, architecture,
   copilot-harness, CHANGELOG) and accurate** — **fail (accuracy)**. Content is
   present: `grep -n "plugin export"` matches `docs/install.md:38,46,185`,
   `README.md:118`, `docs/model-profiles.md:335`, `docs/commands.md:531`;
   `plugin-snapshots` at `docs/commands.md:432,437,447,530`; `CHANGELOG.md` 0.16.0
   entry; `tests/customizations.test.mjs` passed. The plan's `docs/architecture.md`
   reference was stale — `grep -n "turn-stalls\|hook-wiring" docs/architecture.md`
   matches nothing; the check list lives in `docs/commands.md` — and roadmap 4.1
   records that repair correctly. But `docs/copilot-harness.md:112–113` states that
   with the `+x` bit dropped "VS Code runs the hooks through a shell so the plugin
   still works", which I reproduced to be false (Finding 2).
8. **Lint gate: full shellcheck exit 0 with no findings; full suite 0 failures (baseline
   894/894)** — **pass**. Fresh run: shellcheck v0.10.0 exit 0, no output; 915/915.
9. **Live: `/home/david/DP/agento-plugin` is an export of `origin/main`, < 10 MB, pins
   match, `harness`/`canvas` ok** — **pass**. `du -sh` 5.2M; no `.git`, no
   `extension/node_modules`; `.agento-export.json` `source.commit`
   `20e8d0f6b3ef…` = `git rev-parse origin/main`; pins per item 3; doctor
   `harness ok`, `canvas ok`.
10. **Live: new snapshot < 10 MB, hooks run from it, router skill resolves, only it
    remains after prune, doctor ok** — **pass as observed, with the Finding 2 caveat**.
    `1a1a7fc067d` is 5.1M and the only snapshot; inside it
    `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` exits 0 and
    `session-context.sh` fed `{"cwd": …}` prints `Agento CLI: node
    …/1a1a7fc067d/scripts/agento.mjs`; `~/.copilot/skills/agento/SKILL.md` resolves to
    `/home/david/DP/agento-plugin/skills/agento/SKILL.md`; doctor `plugin-snapshots ok`.
    The hooks are executable in this snapshot only because 5.3 `chmod +x`-ed them by
    hand; a fresh snapshot will not be (Finding 2).

## Plan vs implementation

The implementation follows the plan's Approach items 1–6 closely: `scripts/lib/plugin.mjs`
(settings/agentPlugins path helpers moved out of `doctor.mjs`, `snapshotDirName`,
`listSnapshots` with du-style allocated bytes, `pluginLocations` classification),
`scripts/commands/plugin.mjs` (export with fetch → `origin/<default>` → `git archive`
→ temp tree → pin carry-over → stamp → rename swap; destination safety; snapshots;
prune), the doctor check, docs, mirror. Deviations, all recorded on the roadmap:
the doctor check list is in `docs/commands.md` not `docs/architecture.md` (4.1); an
`archiveInto` `maxBuffer` fix (5.2); Phase 6 added in-use detection with a
`--force` escape on non-Linux, and the hook executable-bit doctor warn (6.1–6.2).
`--dest`/`--ref`/`--source`/`--replace-clone` are parsed in `scripts/lib/context.mjs`;
`--dry-run`/`--force` reuse the existing parser entries.

## Roadmap audit

All 17 ticked boxes were spot-checked against the codebase, the fresh test run, or a
live read-only command (details per item above and in the verification table). 1.1's
fixture exists (`scripts/test-helpers/plugin-fixtures.mjs`); 5.1/6.3 gate numbers
reproduce (shellcheck clean, 915/915, 252/252, mirror identical); 5.2–5.4 live state
matches what the step lines record; 6.1's verify (`--dry-run` → `inUseDetection:
true`, `removed: []`) reproduces but is trivially satisfiable with a single snapshot
(Finding 3); 6.2's `git ls-files -s` shows 100755 for all four `.sh` files and the
live export preserves `-rwxrwxr-x`. No `(manual)` or `(manual, post-ship)` steps
exist. No box was falsely ticked, so none was unticked. **Repairs made:** added
Phase 7 with missing-work steps `7.1` (window-anchored in-use detection), `7.2`
(hooks must run from a fresh snapshot; correct the docs), and `7.3` (gate rerun),
all `(added 2026-11-04)`; `next-step` now names 7.1; `status` stays `in-review`
(the fresh request-changes verdict routes `/agento continue` to the Builder fix
handoff).

## Findings

1. **Major — the 6.1 in-use detection cannot see an idle open window's snapshot, so the
   5.4 incident can recur with `inUseDetection: true` printed.** Evidence gathered in
   this window (which loads `1a1a7fc067d`; the window/extension-host `code` processes
   show `ps -o lstart` 14:21:56–14:23:47, after the snapshot's nonce 14:14:34):
   `defaultProcessScan()` (`scripts/lib/plugin.mjs:111`) returned 322 referenced paths,
   none under the snapshot, and `inUseSnapshots(listSnapshots(dest))` returned `[]`. A
   manual sweep of every `/proc/<pid>/{cwd,exe,cmdline,environ,fd,maps}` found **no
   process on the machine referencing `agentPlugins` at all** (only my own scanning
   shell). The reason is structural: VS Code's agent host spawns each hook as a
   short-lived `/bin/sh -c` child (`agentHostMain.js`, `_R`), so between hooks nothing
   holds the snapshot path, and tool shells in this window carry no
   `PLUGIN_ROOT`/`CLAUDE_PLUGIN_ROOT` (`env | grep PLUGIN_ROOT` is empty). The live
   dry-run keeps `1a1a7fc067d` only because it is the newest; the moment a newer
   snapshot exists (every `plugin export` creates one) a prune from any terminal would
   again delete the snapshot this window runs from. The roadmap's Risk ("Pruning a
   snapshot an open window still runs from breaks that window") is therefore not
   mitigated by 6.1 as shipped. Remedy in roadmap 7.1: anchor detection on VS Code
   process start times (a window started at T loaded the newest snapshot whose nonce
   ≤ T — the nonce *is* a millisecond timestamp, so this is exact), keep the path scan
   as a secondary signal, and make the live verify prove the mechanism names this
   window's snapshot.
2. **Major — hooks in a freshly staged snapshot do not run, and
   `docs/copilot-harness.md:112–113` claims the opposite.** VS Code's agent host runs
   command hooks as `/bin/sh -c "<command>"` with `${CLAUDE_PLUGIN_ROOT}` substituted
   (`/usr/share/code/resources/app/out/vs/platform/agentHost/node/agentHostMain.js`,
   function `_R`: `Tye("/bin/sh", ["-c", e], …)`), and `hooks/hooks.json` commands are
   bare script paths. Staging drops `+x` on every file, not just the hooks: the
   snapshot's `scripts/agento.mjs` and `scripts/wait-for-checks.sh` are `-rw-rw-r--`
   while the export has `-rwxrwxr-x` on both (nobody chmod-ed those two). Reproduced:
   a `chmod 664` copy of `session-context.sh` under `/bin/sh -c <path>` → `Permission
   denied`, exit 126. Consequence: after this ships, every `plugin export` (new mtime →
   new snapshot) yields a window whose SessionStart and PreToolUse hooks fail until
   someone runs `doctor` and `chmod +x`s inside `~/.config/Code/agentPlugins/…`. The
   6.2 doctor warn detects the state but does not prevent it, and the doc sentence
   "VS Code runs the hooks through a shell, so the plugin still works" (also echoed in
   roadmap 5.3/6.2) is unsupported — the only snapshot that was ever tested had been
   chmod-ed by hand first. Remedy in roadmap 7.2: make the hook invocation
   mode-independent (`bash ${CLAUDE_PLUGIN_ROOT}/scripts/hooks/<hook>.sh`, or an
   equivalent justified on the step line), correct the doc, keep the warn.
3. **Minor — 6.1's `verify:` was not discriminating.** `prune-snapshots --dry-run →
   inUseDetection: true, removed: []` is satisfied by any single-snapshot location
   regardless of detection quality; the step was ticked on that basis. 7.1's verify
   requires the output to name the window-pinned snapshot.
4. **Minor — `swap()` rollback untested.** The atomicity test uses a bad `--ref`, which
   is refused in `runExport` before the temp tree exists, so `swap()`'s
   `renameSync(old, dest)` recovery (`scripts/commands/plugin.mjs:174–191`) has no
   test. A test that makes the final rename fail (e.g. a read-only parent or an
   injected failure after `archiveInto`) would cover the acceptance item as worded.
5. **Minor — usage header omits `--force`.** `scripts/agento.mjs:39` lists
   `[--dest] [--dry-run] [--ref] [--source] [--replace-clone]` for `plugin` but not
   the `prune-snapshots --force` escape that `docs/commands.md:551` documents.
6. **Cosmetic — duplicate export fallbacks.** A clone location whose newest snapshot
   is > 10 MB gets both `plugin export --dest X --replace-clone` and `plugin export
   --dest X` in `fallback` (`scripts/lib/doctor.mjs:309–316`); the second is a no-op
   suggestion for a clone. `droppedIgnoredBytes` uses apparent size while every other
   figure is du-style allocated bytes.

## Follow-ups

- Window-anchored in-use detection (Finding 1) — roadmap 7.1.
- Mode-independent hook invocation and the doc correction (Finding 2) — roadmap 7.2.
- Add a `swap()` rollback test (Finding 4) and `--force` to the usage header
  (Finding 5) — small enough to land with 7.1/7.2 or as a later cleanup.
- Consider having `plugin export` print a reminder that the next window reload stages
  a new snapshot and that older windows keep running the old one, so users prune only
  after reloading (ties the two majors together in the UX).
