# Review: plugin-snapshot-slim

Verdict: approve

Reviewed 2026-11-04 (round 2 of 3, re-review after the round-1 request-changes) in
the build worktree `/home/david/DP/agento-worktrees/plan-20261104-180137` at product
`b9a466d` (`feature/plugin-snapshot-slim`, `origin/main` an ancestor, both halves
clean, `ahead 0 / behind 0`; companion `9e5a368` on the mirrored branch). Code diff:
`git diff origin/main...HEAD` (23 files, +2477/−37; 20 commits, one per roadmap
step). Round-2 delta since the round-1 review point `4e6b411`: 5 product commits
`7573b6e` (7.1), `405fe00` (7.2), `5a130d1` (7.3), `107013e` (7.4), `b9a466d` (7.5),
each mirrored by a companion commit, plus companion `9e5a368` (7.6 gate record,
`status: in-review`) — the two-commit rule holds.

Skills consulted: none — no matching domain (AGENTS.md has no `## Agento` skills
table; the work is a Node CLI, VS Code settings/staging, node:test suites, and docs).

Safety envelope (the review ran inside the VS Code window whose plugin hooks load
from the only live snapshot `1a1a7fc067d`): no `prune-snapshots` without `--dry-run`
against the live location, nothing under `~/.config/Code/agentPlugins` modified, no
re-export of `/home/david/DP/agento-plugin`. Destructive paths (real prune, export,
mode-stripped staging) were exercised only against `/tmp` fixtures via
`AGENTO_VSCODE_AGENT_PLUGINS` / `--dest` / `--source`, all deleted afterwards.

## Verification run

| Check | Command | Result |
| --- | --- | --- |
| Full suite | `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` | 919 tests, 919 pass, 0 fail (baseline 894; round 1 915) |
| Round-2 targeted | `node --test scripts/commands/plugin.test.mjs scripts/commands/doctor.test.mjs tests/cli-layout.test.mjs tests/customizations.test.mjs` | 128 pass, 0 fail — incl. `swap rename fails`, `windowPinnedSnapshots`, `detectInUse`, `dedupes the export fallback`, `plugin layout is Claude format`, `command mirrors …` |
| Shell lint (§5 gate) | `/tmp/sc-review/shellcheck` v0.10.0 on `scripts/hooks/*.sh scripts/wait-for-checks.sh` | exit 0, no findings (baseline: exit 0, none) |
| Mirror byte-identity | `cd extension && npm run copy-cli` then `git status --porcelain --untracked-files=all` | empty — `extension/cli/` already regenerated |
| Extension build / unit | `npm run build`; `npm run test:unit` | exit 0; 252 pass, 0 fail |
| Usage | `grep "plugin <export" scripts/agento.mjs`; `plugin bogus; echo $?` | header names `[--force]`; usage-error, exit 1 |
| Live snapshots (read-only) | `plugin snapshots` | 1 snapshot `1a1a7fc067d`, 5,353,472 B (5.1M) |
| Live dry-run prune (7.1 verify) | `plugin prune-snapshots --dest /home/david/DP/agento-plugin --dry-run` | exit 0, `inUseDetection: true`, `usedBy["1a1a7fc067d"]` = 17 VS Code processes (6 `window`, 11 `process`), `removed: []` |
| Fixture prune A (7.1 mechanism) | `/tmp` tree with nonces OLD < PIN(1793820000000) < NEW(future), real prune | keeps all three: NEW (newest), PIN (`usedBy` 17 procs), OLD (`usedBy` 1 long-lived proc); `removed: []` — the window-pinned non-newest snapshot survives |
| Fixture prune B | nonces ANCIENT(1793700000000) < OLD < NEW, real prune | ANCIENT pinned by 4 processes started 2026-11-02 14:29 (VS Code main/zygote/gpu); `cache.json`, `not-hex/`, other location untouched |
| 7.2 hook smoke | `plugin export --source <this worktree> --ref HEAD --dest /tmp/…`, then a `cp --no-preserve=mode` copy (0 executable files), each `hooks/hooks.json` command with `${CLAUDE_PLUGIN_ROOT}` substituted under `/bin/sh -c` | `bash …/session-context.sh` → `Agento CLI: node /tmp/…/scripts/agento.mjs`, exit 0; `bash …/delivery-guard.sh` with a PreToolUse payload → exit 0; control: pre-7.2 bare path → `Permission denied`, exit 126 |
| 7.2 doc | `grep -n "still works" docs/copilot-harness.md` | no match |
| Live doctor | `doctor` / `doctor --plugin-root /home/david/DP/agento-plugin` | `plugin-snapshots ok` ("slim"), `hook-wiring ok`; `harness ok`, `canvas ok` |
| Live export facts | `du -sh`, `.agento-export.json`, link | 5.2M; no `.git`, no `extension/node_modules`; `source.commit` `20e8d0f…` = `git rev-parse origin/main`; `~/.copilot/skills/agento/SKILL.md` → `/home/david/DP/agento-plugin/skills/agento/SKILL.md` |

## Round-1 findings re-verified

| # | Round-1 finding | Step | Status |
| --- | --- | --- | --- |
| 1 | Major — in-use detection blind to idle open windows | 7.1 | **Resolved.** `scripts/lib/plugin.mjs` adds `vsCodeWindowStarts` (`/proc/<pid>/comm` = `code*`, start = `btime*1000 + starttime*10`), `windowPinnedSnapshots` (newest nonce ≤ start), `detectInUse` (union with the `/proc` path scan; `available` only when the process list is readable); `runPruneSnapshots` reports `usedBy`. Live dry-run names `1a1a7fc067d` as pinned by 17 processes; fixture prune A proves a non-newest pinned snapshot is kept and fixture B that prune still runs with `removed: []` when every snapshot is pinned (deletion of an unpinned stale snapshot is covered by the fixture test `plugin snapshots and prune-snapshots on a fixture agentPlugins tree`). |
| 2 | Major — hooks in a fresh snapshot exit 126; doc claimed otherwise | 7.2 | **Resolved.** `hooks/hooks.json` commands are now `bash ${CLAUDE_PLUGIN_ROOT}/scripts/hooks/<hook>.sh`; both scripts locate their `.mjs` via `${BASH_SOURCE[0]}`, so `bash <path>` is sound. Smoke on a 0-executable staged copy: both commands exit 0; the bare-path control reproduces 126. `tests/customizations.test.mjs` strips the `bash ` prefix before asserting the root token and file existence. `docs/copilot-harness.md:112–118` now states the `bash` invocation and keeps the 6.2 doctor warn. |
| 3 | Minor — 6.1's verify not discriminating | 7.1 | **Resolved** — 7.1's verify requires the output to name the window-pinned snapshot, and it does (`usedBy`). |
| 4 | Minor — `swap()` rollback untested | 7.3 | **Resolved.** Seam `AGENTO_PLUGIN_EXPORT_INJECT_SWAP_FAILURE=1` at the final rename; test `plugin export restores the old destination when the final swap rename fails` asserts exit 3, `refused`, byte-identical `contentMap`, no `<dest>.agento-*` leftovers. Passes. |
| 5 | Minor — usage header omits `--force` | 7.4 | **Resolved.** `scripts/agento.mjs:39` and `docs/commands.md:529` carry `[--force]`; `tests/cli-layout.test.mjs` passes; mirror identical. |
| 6 | Cosmetic — duplicate export fallbacks; apparent vs allocated bytes | 7.5 | **Resolved.** `scripts/lib/doctor.mjs:315–317` emits `--replace-clone` in the > 10 MB branch for a clone so the Set dedupes (test `dedupes the export fallback for a > 10 MB clone`); `droppedIgnoredBytes` uses the now-exported `allocatedBytes`. |

## Acceptance checklist results

1. **Export = `git ls-tree -r --name-only <commit>` + `.agento-export.json`, no `.git`,
   no `node_modules`** — **pass**. `scripts/commands/plugin.test.mjs` export tests
   (file-set equality, stamp fields, maxBuffer regression) passed in the 919 run; my
   temp export of `HEAD` (`b9a466d`) had no `.git`/`node_modules`, modes `-rwxrwxr-x` on
   the four `.sh` files, and `hooks/hooks.json` with the two `bash ${CLAUDE_PLUGIN_ROOT}`
   commands.
2. **Atomic and safe export; each refusal exits 3 and names the blocker** — **pass**.
   Round-1 tests plus the new `swap()` rollback test (Finding 4 closed); the
   "failure before/at the swap leaves the destination byte-identical" wording is now
   covered at the swap itself.
3. **Model pins carry over; new files `unpinned`; same active profile** — **pass**.
   Unchanged since round 1 (tests `:411`/`:567` in the 919 run; live 31 `^model:`
   lines match the pre-conversion capture). My worktree export reported
   `carriedPins: 0` with every agent/prompt under `unpinned` — correct for a
   destination that had no prior pins.
4. **`snapshots` / `prune-snapshots` on a fixture tree: only stale hex-named snapshots
   of the Agento location; newest and running kept; `--dry-run`; freed bytes** —
   **pass**. Fixture test in the suite; my two `/tmp` fixture prunes left `cache.json`,
   `not-hex/` and the other location untouched and reported `freedBytes`; the in-use
   mechanism now holds on the live machine (Finding 1 closed).
5. **Doctor `plugin-snapshots`: warns on missing dir / clone / > 10 MB / stale, exact
   fallbacks, `ok` for a slim export, never `fail`, absent from every `--for`** —
   **pass**. Round-1 tests plus the dedupe test; `plugin-snapshots` remains outside
   `CAPABILITY_CHECKS`; live `doctor` → `ok`.
6. **`plugin` in `COMMAND_MODULES` and the usage header; mirror regenerated and
   byte-identical; extension build + unit tests pass** — **pass**. Header now complete
   (`[--force]`); `copy-cli` leaves `git status` empty; build exit 0; 252/252.
7. **Docs updated and accurate** — **pass** (was fail in round 1). `docs/commands.md`
   (usage incl. `--force`, window-anchored detection wording), `docs/copilot-harness.md`
   (the false "still works" sentence replaced by the `bash` invocation rationale),
   `docs/install.md`, `README.md`, `docs/model-profiles.md`, `CHANGELOG.md` unchanged
   and present; the `docs/architecture.md` reference was repaired to `docs/commands.md`
   in 4.1; `tests/customizations.test.mjs` passes.
8. **Lint gate: full shellcheck exit 0 with no findings; full suite 0 failures (baseline
   894/894)** — **pass**. Fresh run: shellcheck v0.10.0 exit 0, no output; 919/919.
9. **Live: `/home/david/DP/agento-plugin` is an export of `origin/main`, < 10 MB, pins
   match, `harness`/`canvas` ok** — **pass**. 5.2M; no `.git`/`node_modules`;
   `source.commit` = `origin/main` `20e8d0f`; `doctor --plugin-root` `harness ok`,
   `canvas ok`.
10. **Live: new snapshot < 10 MB, hooks run from it, router skill resolves, only it
    remains after prune, doctor ok** — **pass**. `1a1a7fc067d` is the only snapshot
    (5.2M); the SessionStart and PreToolUse hooks run via the shipped `hooks.json`
    commands from a mode-stripped staged export (the state a fresh snapshot will be
    in); `SKILL.md` resolves through the link; `plugin-snapshots ok`. The live
    snapshot itself still carries the pre-feature `hooks.json` (export of
    `origin/main`) and works because 5.3 restored `+x` by hand — expected per plan
    Risks until the post-ship re-export.

## Plan vs implementation

Unchanged from round 1 for Approach items 1–6 (export, safety rules, pin carry-over,
snapshots/prune, doctor check, docs/mirror). Phase 6 (in-use detection with `--force`
escape; hook executable-bit warn) and Phase 7 (window-anchored detection with
`usedBy`; `bash`-invoked hooks; rollback test; `--force` in usage; fallback dedupe;
gate rerun) are faithful to the review-added steps. The `bash ${CLAUDE_PLUGIN_ROOT}/…`
form was the step's suggested remedy and needed no further justification on the step
line; both wrapper scripts already resolve their `.mjs` via `${BASH_SOURCE[0]}`.

## Roadmap audit

All 23 ticked boxes stand. Phase 7 boxes were each verified against code, tests, and
live/fixture runs (table above); the round-1-audited boxes 1.1–6.3 were spot-checked
again where live state could drift (5.2 export facts, 5.3/5.4 single snapshot and
link, 6.2 modes and doctor `ok`, 6.3/7.6 gate numbers — 7.6's recorded 919/919,
252/252, shellcheck clean, mirror identical all reproduce). No `(manual)` or
`(manual, post-ship)` steps exist; no evidence files are required. **No box was
falsely ticked; no repairs were needed.** `status: in-review`, `next-step: "handoff
to review"`, `artifact-pr: "#77"` are consistent with the session record.

## Findings

No finding above minor.

1. **Minor — `scripts/hooks/replay-guard.sh:86` runs the guard by path (`"$guard"`),
   so the AGENTS.md guard smoke does not run from a mode-stripped snapshot even when
   `replay-guard.sh` itself is started with `bash`.** In my staged-copy smoke every
   fixture line printed `delivery-guard.sh: Permission denied`. The VS Code hook path
   (7.2) is unaffected — `hooks.json` invokes the guard via `bash` — and
   `replay-guard.sh` is a developer tool run from a checkout, where modes are intact,
   so this is not a user-visible regression. Changing line 86 to `bash "$guard"` would
   make roadmap 5.3's "inside the snapshot, `replay-guard.sh` passes" check honest for
   a fresh snapshot. Follow-up.
2. **Minor — the window anchor is conservative by design, and that has two visible
   edges.** (a) Every `code` process is anchored, including the long-lived Electron
   main/zygote/gpu processes (on this machine started 2026-11-02 14:29, pid 1248622 et
   al.); in fixture B they pinned the oldest snapshot. Until VS Code fully quits, one
   extra ≤ 5 MB snapshot per VS Code lifetime may be unprunable. Safe direction;
   restricting to `window`/`extensionHost` kinds (or documenting the quit-to-reclaim
   behaviour) is a possible refinement once the agent host's process type is
   confirmed. (b) `/proc/stat` `btime` is whole seconds, so a window opened within
   ~1 s after a `plugin export` can be anchored to the previous snapshot; the real
   one is then kept only while it is the newest. Treating nonces within ±1 s of a
   start as pinned too would close the race. Follow-up.
3. **Cosmetic — the `AGENTO_PLUGIN_EXPORT_INJECT_SWAP_FAILURE` test seam lives in
   production `swap()`.** Commented and inert unless the variable is `"1"`;
   acceptable, noted for completeness.

## Follow-ups

- `bash "$guard"` in `replay-guard.sh:86` (Finding 1).
- Anchor refinement: restrict kinds and/or ±1 s tolerance (Finding 2).
- Carried from round 1: have `plugin export` print that the next window reload stages
  a new snapshot and older windows keep the old one, so users prune only after
  reloading.
- Post-ship (plan Risks): re-run `plugin export` and reload windows so the live
  snapshot picks up the `bash`-invoked `hooks.json`; `doctor plugin-snapshots` will
  warn on the fresh snapshot's missing `+x` (informational) — the hooks run anyway.
