```yaml
status: in-review
branch: issue/sdk-host-blocks-teardown
last-updated: 2026-11-04
next-step: "review"
github-issue: "#143"
artifact-pr: "#78"
```

## Phase 1: Expose the defect

- [x] 1.1 In `scripts/worktree-occupants.test.mjs`, extend `fakeProc` so an entry may carry optional `cmdline` (array, written NUL-separated) and `environ` (object, written as NUL-separated `KEY=value`). Existing entries stay unchanged. Add `test("findOccupants names an orphaned Copilot SDK extension host instead of an anonymous (code) (#143 sdk-host-blocks-teardown)")`. Fixture: PID `401`, cwd `TARGET`, comm `code`; cmdline `["/usr/share/code/code", "/x/copilot-sdk-linux-x64/preloads/extension_bootstrap.mjs"]`; environ `{ SESSION_ID: "e927bde1-9912-4cab-bb3c-7a245a38e240", EXTENSION_PATH: "/home/u/.copilot/extensions/agento-mission-control/extension.mjs", COPILOT_EXTENSION_PARENT_PID: "999", GITHUB_TOKEN: "planted-secret-must-not-appear" }`. Add four plain `sh` PIDs (`402`–`405`) in `TARGET` listed *before* `401` in the fixture. Assert: `details[0] === "PID 401 (Copilot SDK extension host: agento-mission-control, session e927bde1)"`; `sdkHosts` deep-equals `[{ pid: 401, sessionId: "e927bde1-9912-4cab-bb3c-7a245a38e240", extensionPath: "/home/u/.copilot/extensions/agento-mission-control/extension.mjs", extension: "agento-mission-control", parentPid: 999 }]`; `JSON.stringify(result)` does not contain `planted-secret`. — verify: `node --test scripts/worktree-occupants.test.mjs > /tmp/sdk-1-1.txt 2>&1; echo "exit=$?"` prints `exit=1`; `grep '^not ok' /tmp/sdk-1-1.txt` shows only the #143 test (actual `PID 401 (code)`, or `sdkHosts` undefined); every other test is `ok`; record the counts on this line — verified 2026-11-04: exit=1, `# not ok`=1 (only #143, actual `PID 401 (code)`), tests=10 pass=9 fail=1 skipped=0
- [x] 1.2 In `scripts/commands/ship.test.mjs`, next to the existing live-process teardown test (~line 1620), add a Linux-only `test("ship teardown stops an orphaned Mission Control SDK host in a closed worktree and ships (#143 sdk-host-blocks-teardown)")`. Use `mergedPair()`. Spawn a stand-in host: `spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", path.join(tmpDir, "preloads", "extension_bootstrap.mjs")], { cwd: half, env: { ...process.env, SESSION_ID: "orphan-0000-session", EXTENSION_PATH: path.join(tmpDir, "extensions", "agento-mission-control", "extension.mjs"), COPILOT_EXTENSION_PARENT_PID: String(process.pid) }, stdio: "ignore" })`. Run `shipRun` with `stub.env` plus `COPILOT_AGENT_SESSION_ID: "caller-1111-session"` and a `code --status` stub that lists no folder for the pair. Assert: `status: "ok"`, `outcome: "shipped"`; `actions` contains a `stop-host` entry naming the child PID and `session orphan-0`; the child exits with signal `SIGTERM`; both halves and the workspace file are gone. Kill the child in `finally`. — verify: `node --test --test-name-pattern='#143' scripts/commands/ship.test.mjs > /tmp/sdk-1-2.txt 2>&1; echo "exit=$?"` prints `exit=1`; the #143 test is `not ok` (actual `status: "blocked"`, `reason: "occupied"`, occupant `PID <n> (node)`); record the failure on this line — verified 2026-11-04: exit=1, `# not ok`=1 (the #143 test), tests=1 pass=0 fail=1 skipped=0; actual `status: "blocked"`, `reason: "occupied"`, occupant `PID <n> (node)`
- [x] 1.3 Record the combined exposing run. — verify: `node --test scripts/worktree-occupants.test.mjs scripts/commands/ship.test.mjs > /tmp/sdk-1-3.txt 2>&1; echo "exit=$?"` prints `exit=1`; `grep -c '^not ok' /tmp/sdk-1-3.txt` is 2 and both lines carry `#143 sdk-host-blocks-teardown`; record the `# tests/pass/fail` counts on this line — verified 2026-11-04: exit=1, `grep -c '^not ok'`=2 (both `#143 sdk-host-blocks-teardown`), tests=49 pass=47 fail=2 skipped=0

## Phase 2: Classify and stop SDK hosts

- [x] 2.1 In `scripts/worktree-occupants.mjs`, implement plan.md `## Approach` item 1. Read `cmdline`, and for hosts only `environ` with exactly three keys. Add the `sdkHosts` field and the host label, list hosts first in `details`, and export `isMissionControlHost`. Add tests: a host running as `node` (comm `node`) is still a host; an `environ` without `EXTENSION_PATH` gives `extension: "unknown"`; a non-host process with an `environ` is never read for keys (its `GITHUB_TOKEN` never appears); a host outside the target is ignored; `isMissionControlHost` is true only for `…/agento-mission-control/extension.mjs`. — verify: `node --test scripts/worktree-occupants.test.mjs` exit 0 with the step 1.1 #143 test `ok` and every pre-existing test unchanged and `ok`; record the counts — verified 2026-11-04: exit=0, `# not ok`=0 (step 1.1 #143 test `ok`), tests=15 pass=15 fail=0 skipped=0
- [x] 2.2 In the same module, add `stopOrphanSdkHosts` per plan.md `## Approach` item 2, with injectable `procDir`, `codeStatus`, `callerSessionId`, `signal`, `waitMs`, and `dryRun`. Add tests with a fake `/proc` and a `signal` spy. Eligible host → `signal(pid, "SIGTERM")` once and `stopped` (the fake removes its `/proc/<pid>` dir in the spy). Each of these sends no signal and records its reason: `code --status` Folder match → `window-open`; Workspace/Window match → `window-open`; `sessionId === callerSessionId` → `calling-session`; foreign `EXTENSION_PATH` → `foreign-extension`; `SESSION_ID` rewritten between scan and signal → `changed`; `dryRun` → `would-stop`. A survivor after `waitMs: 50` → `still-running`, with total elapsed under 1 s. The function never sends `SIGKILL`. — verify: `node --test scripts/worktree-occupants.test.mjs` exit 0 with the new tests `ok`; record the counts — verified 2026-11-04: exit=0, `# not ok`=0 (new stopOrphanSdkHosts tests `ok`), tests=22 pass=22 fail=0 skipped=0

## Phase 3: Wire into teardown and close-session

- [x] 3.1 In `scripts/lib/session.mjs` `removeSessionPair`, implement plan.md `## Approach` item 3: a stop pass per registered, on-disk half before the occupant gate, `out.stoppedHosts`, and the `kill <pid>` sentence for remaining `foreign-extension`/`still-running` hosts. In `scripts/commands/session.mjs`, surface `stoppedHosts` in close-session JSON. Add `scripts/commands/session.test.mjs` cases, Linux-only, using stand-in hosts spawned as in 1.2:
  - an orphaned Mission Control host is stopped and the close proceeds;
  - `--dry-run` reports `would-stop` and the child stays alive;
  - a foreign-extension host blocks, naming the host label and ending with `kill <pid>.`;
  - the existing `sleep`-occupant and `code --status` cases pass unchanged.

  — verify: `node --test scripts/commands/session.test.mjs` exit 0; record the counts — verified 2026-11-04: exit=0, `# not ok`=0, tests=37 pass=37 fail=0 skipped=0
- [x] 3.2 In `scripts/commands/ship.mjs` teardown, implement plan.md `## Approach` item 4: `teardown.stoppedHosts`, one `stop-host` action per stopped host, and the `kill` sentence appended to the paused-teardown message when it applies. Add Linux-only `scripts/commands/ship.test.mjs` cases, each spawning a stand-in host:
  - a foreign-extension host (`EXTENSION_PATH` under `extensions/other-ext/`) → `paused-teardown`; the message names `Copilot SDK extension host: other-ext` and contains `kill <pid>`; the child is still alive.
  - `SESSION_ID` equal to `COPILOT_AGENT_SESSION_ID` → `paused-teardown`; the child is still alive.
  - a Mission Control host plus a `code --status` stub listing `Folder (<half basename>)` → `paused-teardown`; the child is still alive.

  — verify: `node --test scripts/commands/ship.test.mjs` exit 0 with the step 1.2 #143 test `ok` and the existing teardown tests unchanged; record the counts — verified 2026-11-04: exit=0, `# not ok`=0 (step 1.2 #143 test `ok`), tests=42 pass=42 fail=0 skipped=0
- [x] 3.3 Regenerate the CLI copy. Then confirm the guard inherits the labels without hook edits. — verify: `cd extension && npm run copy-cli` exit 0; `node --test tests/extension-bundle.test.mjs tests/guard.test.mjs` exit 0; `git diff --name-only origin/main...HEAD -- scripts/hooks .github/hooks` prints nothing; record the results — verified 2026-11-04: `cd extension && npm run copy-cli` exit=0; reviewer 2026-11-04: `node --test tests/extension-bundle.test.mjs tests/guard.test.mjs` exit=0 (with tests/customizations.test.mjs: tests=120 pass=120 fail=0), `git diff --name-only origin/main...HEAD -- scripts/hooks .github/hooks` prints nothing, `cmp` of the four changed `scripts/` modules against `extension/cli/` identical; `node --test tests/extension-bundle.test.mjs tests/guard.test.mjs` exit=0 (tests=53 pass=53 fail=0 skipped=0); `git diff --name-only origin/main...HEAD -- scripts/hooks .github/hooks` prints nothing

## Phase 4: Mission Control stops pinning its session cwd

- [x] 4.1 Implement plan.md `## Approach` item 5:
  - an exported `leaveSessionCwd({ cwd, chdir, homedir })`;
  - `extension.mjs` calls it before `joinSession` and passes `fallbackCwd` to `defineMissionControl`;
  - `canvas.mjs` uses `ctx.session?.workingDirectory ?? fallbackCwd ?? process.cwd()`.

  Add canvas tests:
  - `leaveSessionCwd` returns the start cwd and calls `chdir(homedir())`;
  - a throwing `chdir` still returns the start cwd and does not throw;
  - `open` without `session.workingDirectory` uses `fallbackCwd` for the dashboard and windows calls;
  - the existing `workingDirectory` tests are unchanged.

  — verify: `node --test 'canvas/**/*.test.mjs'` exit 0; `grep -n 'leaveSessionCwd' canvas/agento-mission-control/extension.mjs` — verified 2026-11-04: exit=0, tests=134 pass=134 fail=0 skipped=0; grep shows `import … leaveSessionCwd …` (line 14) and `const fallbackCwd = leaveSessionCwd();` (line 20) shows the call placed before `joinSession`; record the counts

## Phase 5: Evidence and documentation

- [x] 5.1 Re-run the reproduction against this branch, read-only. Capture these items:
  - every `extension_bootstrap.mjs` host's PID, cwd, and safe keys, filtered to `comm` `code`/`node` and excluding the capturing shell;
  - `code --status` window lines;
  - `findOccupants(<orphaned worktree>)` from this branch;
  - `stopOrphanSdkHosts(<orphaned worktree>, { dryRun: true })`.

  When no orphaned host exists any more, spawn a stand-in host as in step 1.2 inside a temporary directory, and capture against that. Commit the capture as companion evidence `evidence/reproduction-fixed.txt`. — verify: the file shows `Copilot SDK extension host: agento-mission-control, session ` and a `would-stop` entry; `grep -ciE 'token|secret|password' evidence/reproduction-fixed.txt` prints 0 — verified 2026-11-04: `grep -c 'Copilot SDK extension host: agento-mission-control, session '`=2, `grep -c 'would-stop'`=1, `grep -ciE 'token|secret|password'`=0 (dryRun only; no real process signalled)
- [x] 5.2 Update the docs and the changelog:
  - `docs/commands.md` (close-session occupant check ~136-143, ship teardown ~245-253): the host label, the stop rule (Mission Control only, no window, not the caller, `SIGTERM`), the `kill` hint, and `stoppedHosts`.
  - `docs/architecture.md` (~94-110): SDK hosts in the shared occupant gate.
  - `docs/hooks.md` (~13, 132): the guard shows the host label and does not stop hosts.
  - `README.md` (~323-336): the teardown pause.
  - The Mission Control canvas doc that describes its process: it leaves its start cwd.
  - `CHANGELOG.md`: a `Fixed.` bullet citing #143 under `## Unreleased`, created above `## 0.16.0` if absent.

  — verify: `grep -l 'Copilot SDK extension host' docs/commands.md docs/architecture.md docs/hooks.md README.md` lists all four; `grep -c '#143' CHANGELOG.md` ≥ 1; `node --test tests/customizations.test.mjs` exit 0 — verified 2026-11-04: grep lists all four; `grep -c '#143' CHANGELOG.md`=1; `node --test tests/customizations.test.mjs` exit=0 (tests=67 pass=67 fail=0 skipped=0)

## Phase 6: Full gate

- [x] 6.1 Run the full lint gate from plan.md `## Research` and compare it with the baseline. If `shellcheck` is still missing, use the v0.10.0 release binary the same way the baseline did.
  - `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`: exit 0, no findings.
  - The five AGENTS.md guard smokes: each exit 0.
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'`: exit 0, ≥ 919 tests, 0 fail.
  - `cd extension && npm ci && npm run copy-cli && npm run test:unit && npm run build`: exit 0.
  - `git status --porcelain --untracked-files=all` is empty in both halves after committing.

  — verify: each command's exit status and counts recorded on this line; no new findings compared with the baseline — verified 2026-11-04: shellcheck v0.10.0 exit=0 no findings; 5 guard smokes exit=0; `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` exit=0 (tests=942 pass=942 fail=0 skipped=0, ≥ 919); `cd extension && npm ci && npm run copy-cli && npm run test:unit && npm run build` exit=0; `git status --porcelain --untracked-files=all` empty in both halves

## Follow-ups

- Dev-server and terminal leftovers (temporal, next-server, node, esbuild) whose cwd stays in a closed worktree also block teardown with anonymous `comm` labels. Teardown could name their owning terminal/session, or offer to stop them. Out of scope per plan.md Decision 5.
