# Review: sdk-host-blocks-teardown

Verdict: approve

Reviewed 2026-11-04 against product branch `issue/sdk-host-blocks-teardown` at
`99308c9` (10 commits over `origin/main`, `origin/main` an ancestor of HEAD; code PR
#144, GitHub issue #143) and the companion half at the same branch (artifact PR
david-perry-software/agento-docs#78). Skills consulted: none — no matching domain
(no `## Agento` skills table in AGENTS.md, no `.agents/skills/`), consistent with
plan.md `## Research`.

Every check below was run by the Reviewer in this window; nothing was taken from the
Builder's record alone. No real process outside test-spawned children was signalled:
the live reproduction target (`/home/david/DP/soshiki-worktrees/plan-20261104-163559`)
was driven read-only with `dryRun: true`, and the original orphan PID 1084104 no
longer exists (`/proc/1084104` absent; `findOccupants` → `details: []`).

## Acceptance checklist results

1. **Exposing regression tests fail before the fix and pass after it — pass.**
   Pre-fix: a scratch detached worktree at `c185cdd` (both tests added, no fix) with
   `scripts/worktree-occupants.mjs`, `scripts/lib/session.mjs`, and
   `scripts/commands/ship.mjs` checked out from `origin/main`;
   `node --test scripts/worktree-occupants.test.mjs scripts/commands/ship.test.mjs`
   → exit 1, `# tests 49 / pass 47 / fail 2`, the two `not ok` lines both carrying
   `#143 sdk-host-blocks-teardown` (actual `PID 401 (code)` vs expected
   `PID 401 (Copilot SDK extension host: agento-mission-control, session e927bde1)`;
   ship `status: "blocked"`, `reason: "occupied"`, occupant `PID <n> (node)`). This
   matches roadmap step 1.3's record exactly. Scratch worktree removed and pruned.
   Post-fix (branch HEAD): both tests `ok` (`ok 469` ship, `ok 718` findOccupants) in
   the full-suite run below. Both test names reference `#143 sdk-host-blocks-teardown`
   and target the defect described in plan.md `## Evidence` (anonymous `(code)`
   label; teardown paused on an orphaned Mission Control host).
2. **`findOccupants` host label, ordering, `sdkHosts` shape, no secret leak — pass.**
   `scripts/worktree-occupants.test.mjs` tests at lines 59–73 (host listed first
   ahead of four `sh` PIDs; `sdkHosts` deep-equals the five-field object; planted
   `GITHUB_TOKEN` absent from `JSON.stringify(result)`), 75–115 (comm `node` host,
   missing `EXTENSION_PATH` → `unknown`, non-host environ never read, host outside the
   target ignored). Independently re-driven against the real `/proc` with three
   stand-in hosts carrying `GITHUB_TOKEN=planted-secret-rev` in their environment:
   `details` listed all three with the host label and `JSON.stringify(result)` did
   not contain `planted-secret`. Code: `HOST_ENV_KEYS` allow-list at
   `scripts/worktree-occupants.mjs:25`, `readHostEnviron` only called when
   `isExtensionHost(cmdline)` (line 70).
3. **`stopOrphanSdkHosts` refusal paths — pass.** Tests at lines 121–212 cover
   stopped (one `SIGTERM`), `window-open` (Folder and Workspace forms),
   `calling-session`, `foreign-extension`, `changed` (SESSION_ID rewritten between
   scan and signal), `would-stop`, and `still-running` (waitMs 50, elapsed < 1 s),
   each with an injected `signal` spy asserting no call. The code never sends
   `SIGKILL` (`grep -n SIGKILL scripts/worktree-occupants.mjs` → only the line-170 comment "never SIGKILL"). Live
   re-drive with stand-ins and `callerSessionId` set: dry run →
   `[[mc,"would-stop"],[foreign,"foreign-extension"],[self,"calling-session"]]`; real
   run → stopped `[mc]`, foreign and caller hosts still alive, the Mission Control
   child's exit signal `SIGTERM`; the stop wait itself completed in 7 ms (zombie
   `Z` state detected via `/proc/<pid>/stat`).
4. **Ship teardown behaviour — pass.** `scripts/commands/ship.test.mjs` adds the
   #143 shipping case (`stop-host` action names the PID and `session orphan-0`,
   child exits `SIGTERM`, both halves and workspace removed) plus three blocking
   cases: foreign extension (`paused-teardown`, message matches
   `/Copilot SDK extension host: other-ext/` and ends with `kill <pid>.`, child
   alive, `actions: []`), caller's own session (not signalled), matching
   `code --status` Folder (not signalled). All `ok` in the full run.
5. **`close-session` `stoppedHosts` — pass.** `scripts/commands/session.test.mjs`
   lines 1305–1388: stopped host → `outcome: "closed"`, `stoppedHosts.companion`
   carries the label, child exits `SIGTERM`; `--dry-run` → `would-stop` label
   reported, child alive, nothing changed on disk; foreign extension → blocked with
   `stoppedHosts` empty and the message ending in `kill <pid>.`. All `ok`.
6. **Mission Control leaves its start cwd — pass.** `canvas/agento-mission-control/canvas.mjs:24-32`
   `leaveSessionCwd`; `extension.mjs:14` import and `:20`
   `const fallbackCwd = leaveSessionCwd();` before `joinSession`; `canvas.mjs:272`
   `ctx.session?.workingDirectory ?? fallbackCwd ?? process.cwd()`. Canvas tests at
   `canvas.test.mjs:196-248` cover the return value + `chdir(homedir())`, the
   throwing `chdir`, and `open` without `workingDirectory` using `fallbackCwd` for
   dashboard and windows calls. `canvas/**/*.test.mjs` all `ok` in the full run.
7. **Reproduction re-run evidence — pass.** `evidence/reproduction-fixed.txt`
   (committed in the companion half): `grep -c 'Copilot SDK extension host:
   agento-mission-control, session '` = 2, `grep -c would-stop` = 1,
   `grep -ciE 'token|secret|password'` = 0; it captures only the three safe keys per
   host. The original orphan was gone, so the Builder captured against a stand-in
   as step 5.1 allows; the Reviewer's own re-drive (item 2–3 above) confirms the
   same labels against the real `/proc`.
8. **Full lint gate (§5) — pass, matches the baseline.**
   - `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` via the v0.10.0
     release binary (downloaded to `/tmp/rev-sc`, run, deleted): exit 0, no
     findings — identical to the `## Research` baseline (exit 0, no findings).
   - Five AGENTS.md guard smokes: exit 0 each.
   - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'`:
     exit 0, `# tests 942 / pass 942 / fail 0 / skipped 0` (≥ 919).
   - `cd extension && npm ci && npm run copy-cli && npm run test:unit && npm run build`:
     exit 0 (`# tests 252 / pass 252`); `copy-cli` left the tree unchanged, so
     `extension/cli/` is current.
   - `node --test tests/extension-bundle.test.mjs tests/guard.test.mjs
     tests/customizations.test.mjs`: exit 0 (120/120).
9. **No `scripts/hooks/` or `.github/hooks/` change — pass.**
   `git diff --name-only origin/main...HEAD -- scripts/hooks .github/hooks` prints
   nothing.
10. **Docs and CHANGELOG — pass.** `grep -l 'Copilot SDK extension host'` lists
    `docs/commands.md`, `docs/architecture.md`, `docs/hooks.md`, `README.md`;
    `grep -c '#143' CHANGELOG.md` = 1 (a `Fixed.` bullet under a new `## Unreleased`
    above `## 0.16.0`); `docs/extension.md` documents the cwd change.

## Plan vs implementation

- The implementation follows `## Approach` items 1–6 closely: cmdline-based host
  detection, three-key environ allow-list, host-first `details`, exported
  `isMissionControlHost` and `sdkHostLabel`, `stopOrphanSdkHosts` with the documented
  option surface and reasons, the stop pass per registered on-disk half in
  `removeSessionPair` before the occupant gate, `stoppedHosts` in close-session JSON,
  `stop-host` actions and the `kill` sentence in ship, the canvas `leaveSessionCwd`,
  regenerated `extension/cli/`, and docs/CHANGELOG.
- Small additions beyond the plan, all documented in `## Resolution`: `procAlive`
  treats a `Z` (zombie) state as exited so a reaped-later child does not read as
  `still-running`; `removeSessionPair` also returns `stopped` (host objects) and
  `killHosts` (PIDs) alongside `stoppedHosts` (labels) so ship can build its
  action and sentence. `sdkHostLabel` is exported (not in the plan) and used by
  `lib/session.mjs`.
- `--dry-run` on close-session still returns `blocked`/`occupied` when a would-stop
  host is present (nothing is signalled, so the gate still sees it). This is
  consistent with the plan's wording and tested, but worth knowing when reading
  dry-run output.
- `## Resolution` is written and consistent with the diff (root cause, changes per
  file, proof with the recorded counts).

## Roadmap audit

- All 12 boxes spot-checked against the codebase; none falsely ticked. Exposing
  counts in 1.1–1.3 match the Reviewer's independent pre-fix run (49/47/2).
- Repair: step 3.3's record held only the `copy-cli` result although its `verify:`
  also names the bundle/guard tests and the hooks diff. Appended the Reviewer's run of
  those two checks (exit 0; empty diff; byte-identical `extension/cli/` copies) to the
  line. No steps added; no `(manual)` steps exist.
- `## Follow-ups` already records the out-of-scope dev-server leftovers (Decision 5).

## Findings

All findings are minor; none blocks approval.

1. **Minor — unguarded `process.kill` race** (`scripts/worktree-occupants.mjs:199`,
   `signal(host.pid, "SIGTERM")`). If the host exits between the re-verification
   (`readCurrentHost`) and the signal, or is not signalable, `process.kill` throws
   (`ESRCH`/`EPERM`) and the exception propagates through `removeSessionPair` into
   ship/close-session as an uncaught error instead of a JSON result. The window is
   microseconds and the failure direction is safe (the stop pass runs before any
   removal), but the result should be structured: catch `ESRCH` → treat as gone
   (`stopped`), anything else → `skipped` with a reason.
2. **Minor — `code --status` now runs twice per half** in `removeSessionPair`
   (`scripts/lib/session.mjs:232` inside `stopOrphanSdkHosts` → `findOccupants`, and
   `:237` for `occupants`). Measured 2.3 s per call on this machine, so a two-half
   teardown spends ~9 s on status probes instead of ~4.6 s. Resolve the status once
   per removal and pass it to both calls (`codeStatus: () => cached`).
3. **Minor — wording** (`scripts/commands/ship.mjs:718`): the paused-teardown message
   concatenates `… then re-send /agento ship <slug>` and ` Stop the orphaned …` with
   no punctuation between the sentences. The `lib/session.mjs` variant ends its base
   sentence with a period and reads correctly.
4. **Minor — busy-wait** (`scripts/worktree-occupants.mjs:160-166` `waitForExit`):
   a synchronous spin on `/proc` reads for up to `waitMs`. In practice it returns in
   milliseconds because the zombie check succeeds (7 ms measured), but a
   `Atomics.wait` sleep between polls would avoid pegging a core on a slow exit.

Security review of the signalling path: only `SIGTERM`; only hosts whose
`EXTENSION_PATH` ends in `agento-mission-control/extension.mjs`; refused when any
matching VS Code Folder/Workspace window exists, when `SESSION_ID` equals
`COPILOT_AGENT_SESSION_ID`, under `dryRun`, and when the PID's `cmdline` or
`SESSION_ID` changed since the scan (PID-reuse guard). `environ` is read only for
processes already identified as hosts by `cmdline`, and only the three allow-listed
keys are retained. No hook file changed, so no hook-approval gate is involved.

## Follow-ups

- Harden `stopOrphanSdkHosts` against `process.kill` throwing (finding 1) and cache
  the `code --status` probe per `removeSessionPair` call (finding 2); fix the ship
  message punctuation (finding 3) and the spin-wait (finding 4) in the same pass.
- Dev-server/terminal leftovers in a closed worktree still block teardown with
  anonymous labels (already recorded in roadmap.md `## Follow-ups`).
