# Ship teardown names and stops orphaned Copilot SDK extension hosts instead of pausing on an anonymous `(code)` occupant (sdk-host-blocks-teardown)

## Problem

`/agento ship <slug>` tears the delivery's worktree pair down through the shared
occupant gate (`removeSessionPair` in `scripts/lib/session.mjs`, which calls
`findOccupants` in `scripts/worktree-occupants.mjs`). Every process whose cwd is
inside a half blocks removal. The Copilot SDK runtime that VS Code starts is **one**
`copilot-runtime` process shared by every window. It spawns one
`code …/preloads/extension_bootstrap.mjs` host per chat session for each installed
Copilot extension. Today the only such extension is Agento's own Mission Control
canvas (`~/.copilot/extensions/agento-mission-control`). Each host inherits the
session's working directory and keeps it. When the build window closes, its
session's host stays alive under the shared runtime with its cwd still in the build
worktree.

User-visible effect: ship pauses at teardown with
`… product half <path>: PID 1084104 (code), …; close that VS Code window or terminal,
then re-send /agento ship <slug>`. The process's `comm` is `code`, so the message
reads like a VS Code window, but no window holds the worktree, and closing windows
or re-sending never clears it. The same anonymous entry blocks `close-session` and
appears in the delivery guard's removal ask. The user has to find and kill the PID
by hand.

## Evidence

GitHub issue: #143

Reproduced 2026-11-04 on Linux 6.14 against agento `0e8d36b` (read-only). Full
capture: [evidence/reproduction.txt](evidence/reproduction.txt).

Steps:

1. In VS Code, run a chat session in a managed worktree window with the Mission
   Control canvas extension installed (`harness install` links it). The runtime
   spawns that session's `extension_bootstrap.mjs` host with the session cwd.
2. Close the window. The shared `copilot-runtime` (PID 1249106, up since Nov 2) keeps
   the host alive.
3. Run the gate's own function against the worktree:
   `findOccupants("/home/david/DP/soshiki-worktrees/plan-20261104-163559")`.

Observed:

- Host process: `PID 1084104 comm=code ppid=1249106 (copilot-runtime)
  cwd=/home/david/DP/soshiki-worktrees/plan-20261104-163559`, cmdline
  `/usr/share/code/code …/@github/copilot-sdk-linux-x64/preloads/extension_bootstrap.mjs`.
  Safe environment keys:
  `SESSION_ID=e927bde1-9912-4cab-bb3c-7a245a38e240`,
  `EXTENSION_PATH=/home/david/.copilot/extensions/agento-mission-control/extension.mjs`,
  `COPILOT_EXTENSION_PARENT_PID=1249106`.
- `code --status` lists no `Folder (plan-20261104-163559)`, no workspace, and no
  window for that worktree. The worktree is still registered on
  `feature/oauth-byoa-surfaces`.
- `findOccupants` → `"processes": ["PID 1084104 (code)", "PID 2052821 (temporal)",
  …]`, `"folderWindow": false`, `"workspaceWindow": false`. The `details` list starts
  with `PID 1084104 (code)`. The ship message built from it is
  `paused at teardown (worktree … still open): product half …: PID 1084104 (code),
  PID 2052821 (temporal), PID 2052960 (node), and 9 more processes; close that VS Code
  window or terminal, then re-send /agento ship <slug>`.
- Seven Mission Control hosts are alive under the one runtime, one per session that
  ever opened, including sessions in closed windows.
- The calling CLI can identify its own session: the agent's shell carries
  `COPILOT_AGENT_SESSION_ID=cc4781fe-…`, which equals the `SESSION_ID` of this
  session's own host (PID 2337610).

Expected: teardown identifies an SDK extension host as a non-editor occupant and names
its extension and session. When no VS Code window holds the half and the host is not
the calling session, teardown stops a host running Agento's own Mission Control
extension and proceeds. Any other extension's host is named with the exact
`kill <pid>` command and still blocks. Mission Control itself no longer pins the
worktree it was started in.

The other occupants in the capture (temporal, next-server, node, esbuild) are
dev-server leftovers from that worktree's terminals. They are out of scope; see
`## Out of scope`.

## Decisions

Asked with the ask-questions tool on 2026-11-04; every answer took the recommended
option (listed first).

1. **What should teardown do with an SDK extension host pinned in the worktree?** —
   Answer: *"Stop it automatically when it hosts Agento's own Mission Control
   extension and is not the calling session; any other SDK host is named with its
   session and extension plus the exact kill command, and still blocks"*
   (recommended). Not chosen: name only, never stop; treat as non-blocking (warn and
   proceed); stop every SDK host whatever its extension.
2. **Also fix the root cause in the Mission Control canvas?** — Answer: *"Yes: record
   the session cwd at startup, then chdir to the home directory so the host never
   pins a worktree"* (recommended). Not chosen: teardown handling only, with a
   follow-up for the canvas.
3. **Which teardown surfaces get the new handling?** — Answer: *"The shared
   occupant/removal code: /agento ship teardown and close-session, plus the guard's
   wording through the shared worktree-occupants module, with no hook-file edits"*
   (recommended). Not chosen: `/agento ship` teardown only; everything, including
   `scripts/hooks/` edits.
4. **When is an SDK host an orphan?** — Answer: *"Its SESSION_ID is not the calling
   session and code --status shows no window holding the worktree"* (recommended).
   Not chosen: any SDK host regardless of open windows; a runtime session-liveness
   check.
5. **Other leftover processes in a closed worktree (dev servers)?** — Answer: *"Out of
   scope: record a follow-up; they keep blocking with their current wording"*
   (recommended). Not chosen: classify and name them too.

## Research

Skills consulted: none — no matching domain (this repository's AGENTS.md has no
`## Agento` skills table, and `.agents/skills/` holds no skill for Node CLI/process
handling).

Codebase (agento `0e8d36b`):

- `scripts/worktree-occupants.mjs` `scanProcesses` (lines 23-45) reads only
  `/proc/<pid>/cwd` and `/proc/<pid>/comm` and labels each match
  `PID <n> (<comm>)`. `findOccupants` (lines 48-65) returns
  `{ processes, folderWindow, workspaceWindow, details }`. `details` holds the first
  three PIDs, then `and N more processes`, then the window flags. Nothing reads
  `cmdline` or `environ`, so an SDK host is just `(code)`, or `(node)` when the host
  runs under node.
- `findOccupants` has two production consumers, and both read only `.details`:
  - `scripts/lib/session.mjs` `removeSessionPair` (lines 213-280). It stores
    `details` per half in `out.occupants` (227-228). Unless `ignoreOccupants` is set,
    it returns `status: "blocked", reason: "occupied"` with
    `Active worktree occupants detected - … Close their terminals or VS Code window
    before removal, or re-send with --ignore-occupants.` (229-235). Otherwise it
    records a warning (236), honours `dryRun` (239-241), and removes companion, then
    product, then prunes, then the workspace file, then branches (243-278).
  - `scripts/hooks/delivery-guard.mjs:469-473` destructures `{ details }` and asks
    `Active worktree occupants detected - …. Close their terminals or VS Code window
    before removal. Proceed anyway?`. Changing the *contents* of `details` changes the
    guard's wording without editing the hook file. Adding fields changes nothing
    there.
- `removeSessionPair` callers:
  - `scripts/commands/session.mjs:449-466` (close-session, with `ignoreOccupants`
    and `dryRun`).
  - `scripts/commands/ship.mjs:705-718` (ship teardown). On `blocked` it sets
    `teardown.pausedPath` and finishes `outcome: "paused-teardown"` with
    `close that VS Code window or terminal, then re-send /agento ship <slug>`
    (710-711). Neither caller knows the calling session today: no script reads
    `SESSION_ID`, `COPILOT_AGENT_SESSION_ID`, or `COPILOT_EXTENSION_PARENT_PID`.
- `canvas/agento-mission-control/extension.mjs` (whole file) runs top-level
  `joinSession({ remoteSession: "off", canvases: [defineMissionControl(…)] })` and
  never calls `process.chdir`. Its comment notes that the extension process's
  sensitive environment is stripped. `canvas.mjs:258` already uses
  `ctx.session?.workingDirectory ?? process.cwd()`, and every CLI call it makes passes
  `cwd: instance.cwd` explicitly (`canvas.mjs:114,270,285,291`). Only the fallbacks
  read `process.cwd()`: `canvas.mjs:258` and the `cli.mjs` defaults at 82, 105, 113,
  and 122. A startup chdir is therefore safe as long as the recorded session cwd
  replaces the `canvas.mjs:258` fallback.
- `harness install` links `~/.copilot/extensions/agento-mission-control` to the
  primary clone's `canvas/agento-mission-control` (`docs/install.md:105-106`,
  `scripts/lib/copilot.mjs:55-57`). The canvas fix therefore reaches new hosts only
  once it is merged and the runtime starts new sessions. Already-running hosts keep
  pinning until stopped, which the teardown change covers.
- `extension/cli/` is a generated copy of `scripts/` that includes
  `worktree-occupants.mjs` and `lib/session.mjs` (`extension/scripts/copy-cli.mjs:14-25`,
  checked by `tests/extension-bundle.test.mjs:26`). Run `cd extension && npm run
  copy-cli` after editing `scripts/`. `canvas/` is not copied.
- Tests to extend:
  - `scripts/worktree-occupants.test.mjs:14-24` `fakeProc` builds `cwd` symlinks and
    `comm` files only. It needs optional `cmdline` and `environ` (NUL-separated)
    entries.
  - `scripts/commands/ship.test.mjs:1620-1660` drives a real `sleep` child inside a
    half and asserts the exact paused-teardown JSON and wording.
  - `scripts/commands/session.test.mjs:1235-1290` does the same for close-session,
    including `--ignore-occupants` and `--dry-run`.
  - `tests/guard.test.mjs:727-768` covers the guard's occupant ask with fake
    `code --status` only.
  - `canvas/agento-mission-control/canvas.test.mjs` and `cli.test.mjs` exercise
    `session.workingDirectory` and the cwd defaults.
- Docs that describe the gate or the pause: `docs/commands.md:15-17,136-143,245-253`,
  `docs/architecture.md:94-110,299-300`, `docs/hooks.md:13,132`,
  `docs/install.md:14`, `README.md:323-336,436-456`, and `CHANGELOG.md` (fixes
  accumulate under `## Unreleased`).

Root-cause hypothesis:

1. The gate classifies processes by `comm` alone, so an SDK extension host is
   indistinguishable from an editor process.
2. Nothing tells an orphaned host (window closed, not the caller) from a live one.
3. The Mission Control host never leaves its inherited session cwd, so it pins the
   worktree for the life of the shared runtime.

**Lint baseline (policy §5), 2026-11-04 at `0e8d36b`:**

- Full-repository lint (AGENTS.md *Shell lint*): `shellcheck scripts/hooks/*.sh
  scripts/wait-for-checks.sh`. `shellcheck` is not installed on this machine
  (`command not found`, exit 127; no `pip`). It was run from the official v0.10.0
  release binary unpacked to `/tmp/sc/shellcheck-v0.10.0/shellcheck`: **exit 0, no
  findings.**
- Guard smoke `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt`: exit 0.
- Test suite `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'
  'canvas/**/*.test.mjs'`: exit 0, 919 tests, 919 pass, 0 fail.
- Overlap decision: the baseline is green and has no findings, so there is nothing to
  clean up. This delivery changes no shell file. **Full gate**, with no scoped
  waiver: the Builder reruns full-repository shellcheck (installing or downloading it
  the same way if still missing), all five guard smokes, the full node test suite,
  and the extension's unit tests and build, and compares against this baseline.

Concurrent delivery: `gh pr list --state open` returned `[]` at planning time, so
there are no overlapping open delivery branches.

## Approach

1. **Classify SDK hosts** (`scripts/worktree-occupants.mjs`).
   - For each matched PID, read `/proc/<pid>/cmdline` (NUL-split). A process is a
     *Copilot SDK extension host* when any argument's basename is
     `extension_bootstrap.mjs`. Detection relies on `cmdline`, not `comm`, because
     the host may run as `code` or `node`.
   - For hosts only, read `/proc/<pid>/environ` and keep exactly three keys:
     `SESSION_ID`, `EXTENSION_PATH`, and `COPILOT_EXTENSION_PARENT_PID`. Never store,
     return, or print any other key or value.
   - Add `sdkHosts: [{ pid, sessionId, extensionPath, extension, parentPid }]` to
     the `findOccupants` result. `extension` is the basename of `EXTENSION_PATH`'s
     directory (`agento-mission-control`), or `unknown` when it is missing.
   - A host's `processes` and `details` label becomes
     `PID <n> (Copilot SDK extension host: <extension>, session <first 8 chars of
     SESSION_ID>)`. Host entries come first in `details`, then up to three other
     PIDs, then `and N more processes`, then the window flags. Hosts are therefore
     always named, never folded into the count.
   - Export `isMissionControlHost(host)`: true when `extensionPath`'s last two
     segments are `agento-mission-control/extension.mjs`.
   - All other behaviour (sibling-prefix exclusion, comm sanitising, non-Linux
     no-op) is unchanged.
2. **Stop orphaned Mission Control hosts** (`scripts/worktree-occupants.mjs`, new
   export `stopOrphanSdkHosts(target, { procDir, codeStatus, callerSessionId =
   process.env.COPILOT_AGENT_SESSION_ID, signal = process.kill, waitMs = 2000,
   dryRun = false })`).
   - It runs `findOccupants`. When `folderWindow` or `workspaceWindow` is set, it
     stops nothing and marks every host `window-open`.
   - Otherwise, for each host:
     - `sessionId === callerSessionId` → `calling-session`, not stopped.
     - `!isMissionControlHost` → `foreign-extension`, not stopped.
     - Otherwise, re-read that PID's `cmdline` and `SESSION_ID` immediately before
       signalling. Skip it as `changed` if they no longer match, which guards
       against PID reuse. Send `SIGTERM` only, never `SIGKILL`.
   - Poll for the PID's `/proc` entry to disappear, bounded by `waitMs` (≤ 2000 ms
     total). A survivor is `still-running`.
   - Under `dryRun` nothing is signalled and eligible hosts are `would-stop`.
   - It returns `{ stopped: [host…], skipped: [{ host, reason }…] }`.
3. **Wire it into the shared removal** (`scripts/lib/session.mjs`
   `removeSessionPair`).
   - Before computing occupants, call `stopOrphanSdkHosts` for every registered,
     on-disk half (passing `dryRun` and the injected `codeStatus`).
   - Record `out.stoppedHosts = { product: [...], companion: [...] }`, holding the
     stopped labels, or would-stop labels under dry-run.
   - Then compute occupants as today. When a blocked half still holds
     `foreign-extension` or `still-running` hosts, append
     ` Stop the orphaned Copilot SDK extension hosts with: kill <pid> [<pid>…].`
     to the message.
   - `--ignore-occupants` behaves as today, after the stop pass.
4. **Callers.**
   - `scripts/commands/ship.mjs`: carry `stoppedHosts` into `out.teardown`, and add
     one `act("stop-host", "stopped orphaned Mission Control host PID <n> (session
     <id8>) in <half path>")` per stopped host.
   - The paused-teardown message (lines 710-711) appends the same `kill` sentence
     when it applies. Its `close that VS Code window or terminal` advice stays for
     ordinary occupants.
   - `scripts/commands/session.mjs` close-session: surface `stoppedHosts` in its
     JSON, including `--dry-run`.
   - The delivery guard needs no edit: it shows the new `details` labels through the
     shared module (decision 3).
5. **Root cause in the canvas** (`canvas/agento-mission-control/`).
   - Add an exported helper (in `canvas.mjs` or a new `cwd.mjs`):
     `leaveSessionCwd({ cwd = process.cwd, chdir = process.chdir, homedir =
     os.homedir })`. It records the start cwd, chdirs to the home directory (logging
     and continuing on failure), and returns the recorded cwd.
   - `extension.mjs` calls it before `joinSession` and passes the result as
     `fallbackCwd` to `defineMissionControl`.
   - `canvas.mjs:258` becomes `ctx.session?.workingDirectory ?? fallbackCwd ??
     process.cwd()`. CLI calls keep passing `cwd: instance.cwd`, so they still run in
     the session's directory while the host process no longer sits in it.
6. **Generated copy and docs.**
   - `cd extension && npm run copy-cli`.
   - Update the occupant and teardown text in `docs/commands.md`,
     `docs/architecture.md`, `docs/hooks.md`, and `README.md`.
   - Add a `Fixed.` bullet (#143) under `## Unreleased` at the top of
     `CHANGELOG.md`, creating that heading above `## 0.16.0` if it is absent.

Affected files: `scripts/worktree-occupants.mjs` (+test), `scripts/lib/session.mjs`,
`scripts/commands/ship.mjs` (+test), `scripts/commands/session.mjs` (+test),
`canvas/agento-mission-control/{extension,canvas}.mjs` (+tests), `extension/cli/`
(generated), docs, and CHANGELOG. No `scripts/hooks/` or `.github/hooks/` edits.

## Risks

- **Signalling the wrong process.**
  - Risk: PID reuse between scan and signal.
  - Mitigation: the PID's `cmdline` and `SESSION_ID` are re-verified immediately
    before `SIGTERM`, and the PID is skipped on mismatch. Only `SIGTERM` is sent.
  - Further limits: only Agento's own Mission Control host is signalled, only when
    no VS Code window holds the half, and never the calling session's host.
  - Tests use injected `signal` and a fake `/proc` for every refusal path.
- **A live session elsewhere whose host sits in the worktree.**
  - Risk: a chat in another window started with the worktree as its cwd would lose
    its Mission Control panel.
  - Mitigation: low likelihood, since sessions start in their window's folder. After
    this fix new hosts chdir away, so hosts no longer pin worktrees at all. The stop
    pass is a cleanup for hosts started before the fix.
- **Reading another process's environment.**
  - Mitigation: only same-user processes are readable, and only three
    non-secret keys are kept. A test plants a fake `GITHUB_TOKEN` in the fake
    `environ` and asserts it never appears in any output.
  - The extension process already has its sensitive environment stripped
    (`extension.mjs` comment).
- **Guard wording drift.**
  - Risk: the guard's ask now shows the new host label.
  - Mitigation: `tests/guard.test.mjs` and the five guard smokes must stay green.
    No hook file changes, so no hook-approval gate is triggered.
- **Canvas behaviour after chdir.**
  - Risk: a code path relying on `process.cwd()` would now see the home directory.
  - Mitigation: every CLI call already passes `instance.cwd`, the recorded cwd
    replaces the only canvas fallback, and the canvas tests cover open, dashboard,
    windows, handoff, and artifacts with the session cwd.
- **Fix reach.**
  - The canvas change reaches the installed link only after merge to the primary
    clone, then only for new sessions.
  - Mitigation: existing orphans are handled by the teardown stop pass.
- **Concurrent delivery.**
  - No open PRs at planning time. Integrate `origin/main` by merge before every
    push.

## Out of scope

- Dev-server and terminal leftovers (temporal, next-server, node, esbuild) in a
  closed worktree. They keep blocking with today's wording; recorded as a follow-up
  in roadmap.md.
- Any edit under `scripts/hooks/` or `.github/hooks/`. The guard only inherits the
  new labels.
- Stopping SDK hosts of extensions other than Agento's Mission Control. They are
  named with a `kill` command, never signalled.
- `SIGKILL`, process-tree kills, or changes to the Copilot runtime or SDK.
- Non-Linux occupant detection. It stays a `/proc` no-op elsewhere, as today.

## Acceptance checklist

- [ ] The exposing regression tests fail before the fix and pass after it:
  - `scripts/worktree-occupants.test.mjs` test
    `findOccupants names an orphaned Copilot SDK extension host instead of an
    anonymous (code) (#143 sdk-host-blocks-teardown)`.
  - `scripts/commands/ship.test.mjs` test `ship teardown stops an orphaned Mission
    Control SDK host in a closed worktree and ships (#143 sdk-host-blocks-teardown)`.

  Verify: the recorded failing run in roadmap step 1.3, then
  `node --test scripts/worktree-occupants.test.mjs scripts/commands/ship.test.mjs`
  exits 0 with both tests `ok`.
- [ ] `findOccupants` labels an SDK host `PID <n> (Copilot SDK extension host:
  <extension>, session <id8>)` and lists it before other PIDs. It returns `sdkHosts`
  with only `pid`, `sessionId`, `extensionPath`, `extension`, and `parentPid`. A
  planted `GITHUB_TOKEN=…` in a fake `environ` appears nowhere in the result. Verify:
  `node --test scripts/worktree-occupants.test.mjs` exit 0.
- [ ] `stopOrphanSdkHosts` signals a Mission Control host only when no window holds
  the target and the host is not the calling session. Window-open, calling-session,
  foreign-extension, changed-identity (PID reuse), still-running, and dry-run cases
  are each skipped with their reason and send no signal (injected `signal` spy).
  Verify: `node --test scripts/worktree-occupants.test.mjs` exit 0.
- [ ] Ship teardown with an orphaned Mission Control host ships, records a
  `stop-host` action, and removes both halves. A foreign-extension host still pauses
  `paused-teardown`, with a message naming the host and ending in `kill <pid>`. A
  host whose `SESSION_ID` equals `COPILOT_AGENT_SESSION_ID` is not signalled. A host
  with a matching `code --status` folder is not signalled. Verify:
  `node --test scripts/commands/ship.test.mjs` exit 0.
- [ ] `close-session` reports `stoppedHosts` (would-stop under `--dry-run`, with
  nothing signalled) and stops an orphaned Mission Control host before its gate.
  Verify: `node --test scripts/commands/session.test.mjs` exit 0.
- [ ] The Mission Control extension leaves its start cwd for the home directory at
  startup. `leaveSessionCwd` is unit-tested, including the chdir-failure path. Opening
  the canvas without `session.workingDirectory` still uses the recorded start cwd.
  Verify: `node --test 'canvas/**/*.test.mjs'` exit 0.
- [ ] Re-running the reproduction on the branch shows the new host label and a
  dry-run `would-stop` for the orphan, or a spawned stand-in host when the original
  orphan is gone. Committed as `evidence/reproduction-fixed.txt`. Verify: roadmap
  step 5.1.
- [ ] Full lint gate (§5), compared with the `## Research` baseline. All must hold:
  - Full-repository `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` exit 0
    with no findings.
  - All five AGENTS.md guard smokes exit 0.
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'
    'canvas/**/*.test.mjs'` exit 0, with ≥ 919 tests and 0 fail.
  - `cd extension && npm run copy-cli && npm run test:unit && npm run build` exit 0.
  - `node --test tests/extension-bundle.test.mjs` exit 0.

  Verify: roadmap step 6.1 records every result.
- [ ] No file under `scripts/hooks/` or `.github/hooks/` changes. Verify:
  `git diff --name-only origin/main...HEAD -- scripts/hooks .github/hooks` prints
  nothing.
- [ ] Docs and CHANGELOG describe the new host label, the stop rule, and the `kill`
  hint. Verify: roadmap step 5.2 greps.
