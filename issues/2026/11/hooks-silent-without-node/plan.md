# Hooks fail open silently when node is missing or too old

## Problem

Both Agento hooks are Bash wrappers that `exec` a Node module. When `node` is not on
the `PATH` the hook process inherits, each wrapper runs `command -v node … || exit 0`
and prints nothing. This is common when VS Code is started from a desktop launcher and
node comes from a shell-rc-only version manager.

- The PreToolUse delivery guard allows every tool call. Pushes to `main`,
  force-pushes, `--no-verify`, and hook-file edits all go through unchecked.
- The SessionStart hook injects no context, so the one channel that could warn the
  model is gone too.
- Nobody is told. The user believes they are protected when they are not.

A node older than the required 20 is not caught either: the wrappers never check the
version. `agento.mjs doctor` cannot see the gap. Its `node` check reports the node
that is running doctor, and `docs/hooks.md` wrongly says doctor "fails its `node`
check" in this case.

Failing open is intended: the guard is documented as a slip guard, not an enforcement
boundary. The defect is that it fails open **invisibly**.

## Evidence

GitHub issue: #149

Reproduced on 2026-11-06 at `origin/main` `c4db856`. The full transcript is in
[evidence/repro-no-node.txt](evidence/repro-no-node.txt). `PATH=<NONODE>` is a temp
directory holding only `bash`, `git`, `cat`, and `dirname` symlinks, the same shape
as the `pathWithoutNode()` test helper in `tests/session-context.test.mjs`.

1. `printf '{"cwd":"<REPO>"}' | PATH=<NONODE> bash scripts/hooks/session-context.sh`
   → `exit=0  stdout_bytes=0  stderr_bytes=0`.
2. Run the `delivery-guard.sh` wrapper with the payload
   `{"cwd":"<REPO>","tool_name":"Bash","tool_input":{"command":"git push origin main"}}`
   and `PATH=<NONODE>` → `exit=0  stdout_bytes=0  stderr_bytes=0`. The push to
   `main` is allowed with no trace.
3. The same payload with node v22.23.2 on PATH →
   `{"permissionDecision": "deny", "permissionDecisionReason": "Direct commits/pushes to main are forbidden; …"}`.
   This is the protection the user silently loses.
4. `node scripts/agento.mjs doctor`, filtered to the `node` check →
   `{"id":"node","status":"ok","detail":"node v22.23.2","fallback":null}`. Doctor
   can only observe the node it runs on.
5. Node < 20 is shown by code, not run: no node < 20 is installed on this machine.
   Both wrappers `exec node …` with no version check
   (`scripts/hooks/delivery-guard.sh:17-18`, `scripts/hooks/session-context.sh:16-17`).

**Observed:** with no node, or node < 20, the hooks provide no guard and no context,
give no notice, and doctor reports `ok`.

**Expected:**
- The hooks still fail open (allow, exit 0).
- The SessionStart hook injects a static warning the model sees and relays.
- Both wrappers print a one-line stderr notice.
- Node < 20 is treated like a missing node.
- `agento.mjs doctor` fails a check that resolves node the way the wrappers do.

## Decisions

Asked 2026-11-06 with the ask-questions tool. The user accepted every recommended
default:

1. *How should the missing-node notice surface?* → **Both.** The SessionStart wrapper
   injects a static `additionalContext` warning (stdout JSON, printed by bash without
   node), and both wrappers print a one-line stderr notice.
2. *Guard verdict when node is missing?* → **Keep fail-open (allow)** and only add the
   notice. This matches the slip-guard design; failing closed would block every tool
   call.
3. *Also cover node present but older than 20?* → **Yes.**
4. *What should the new doctor check do?* → **Wrapper probe.** Run the wrappers' node
   resolution in a non-interactive `bash` with the inherited PATH, and fail when it
   finds no node ≥ 20.
5. *Fix the inaccurate claim in docs/hooks.md (and document the notice there and in
   docs/architecture.md)?* → **Yes.**

## Research

- **Wrappers.** `scripts/hooks/delivery-guard.sh` and
  `scripts/hooks/session-context.sh` are near-identical. Both run `set -u` and
  `command -v node >/dev/null 2>&1 || exit 0`, then
  `exec node "$(dirname "${BASH_SOURCE[0]}")/<module>.mjs"`. Their header comments
  state "Without node on PATH the hook is silent and exits 0". The wiring is
  `hooks/hooks.json` (plugin mode, `bash ${CLAUDE_PLUGIN_ROOT}/…`) and
  `.github/hooks/{delivery-guard,session-context}.json` (workspace mode), and none of
  it needs to change. No other copy of the wrappers exists: `git ls-files` finds them
  only under `scripts/hooks/`, `extension/cli/` excludes `hooks/`, and `templates/`
  ships none.
- **SessionStart output shape.** `scripts/hooks/session-context.mjs:152-155` emits
  `{ additionalContext, hookSpecificOutput: { hookEventName: "SessionStart", additionalContext } }`.
  The Copilot harness reads the top-level slot and Local reads the nested one
  (`docs/hooks.md` §SessionStart). The bash fallback must emit the same dual shape.
- **Guard output.** An empty stdout with exit 0 means allow. A non-zero exit fails
  closed in both harnesses (`docs/hooks.md` ~line 92), so the fallback must keep exit 0.
  Stderr carries the notice; stdout stays empty, so the allow semantics are unchanged.
- **Doctor.** `scripts/lib/doctor.mjs` `DOCTOR_CHECKS.node()` reads
  `process.versions.node`. Informational checks such as `hook-wiring` are omitted from
  `CAPABILITY_CHECKS`, so `doctor --for` never runs them. `LOCAL_DOCTOR_CHECKS` lists
  the checks that need no network. `scripts/lib/probe.mjs` `probe(cmd, args)` runs a
  bounded external command. The extension runs the CLI with `agento.nodePath` and the
  extension host's `process.env` (`extension/src/cliClient.ts:68-74`). That is the
  same environment family the hooks inherit, so a dashboard doctor run with an
  absolute `agento.nodePath` reproduces the hooks' PATH resolution.
- **Tests that pin the bug.** `tests/session-context.test.mjs:153`, "without node on
  PATH the hook exits 0 and prints nothing", asserts `stdout === ""`. It is rewritten
  in step 1.1 as the #149 regression test. `tests/guard.test.mjs` has no no-node case.
  `scripts/commands/doctor.test.mjs:95-103` asserts the exact 14-check id list, and
  `runWith` in `scripts/test-helpers/agento-fixtures.mjs:95-96` spawns `"node"` by
  name, so a no-node doctor test must spawn `process.execPath` directly.
- **Docs that state the silent behavior:**
  - `docs/hooks.md:16-18`, including the wrong doctor claim
  - `docs/install.md:16-18`
  - `README.md:518-519`
  - `docs/commands.md:440-460`, the doctor check list
  - `docs/architecture.md:90-95`, the slip-guard paragraph

  `CHANGELOG.md` `## Unreleased` takes a `**Fixed.**` entry.
- **Concurrent deliveries.** `gh pr list --state open` returned `[]`, so no file
  overlaps with open delivery branches.
- **Lint baseline (§5).** `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`
  (ShellCheck 0.10.0) → exit 0, no findings. The repository has no JS linter. The
  test baseline `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'`
  → exit 0, `# tests 945 / pass 945 / fail 0`. The baseline is green, so the **full
  gate** applies (no scoped gate): rerun the full shellcheck and the full test suite
  at the end.

Skills consulted: none — no matching domain (this repository's AGENTS.md has no
`## Agento` skills table and no `.agents/skills/` directory exists).

## Approach

1. **Wrapper node gate** in `scripts/hooks/delivery-guard.sh` and
   `scripts/hooks/session-context.sh`. Replace the `command -v node || exit 0` line
   with a version gate:
   - Read `node --version` once and take the major version.
   - `exec node …` only when the major is a number ≥ 20.
   - Otherwise build a reason: `node not found on PATH`, or
     `node <version> is below the required 20`. Include the version only when it
     matches `^v[0-9]+(\.[0-9]+)*$`, so the reason stays JSON-safe; otherwise use
     `node --version printed an unexpected value`.
   - On the happy path this costs exactly one extra `node --version` spawn per hook
     call, far inside the 15 s and 10 s hook timeouts.
2. **Guard fallback** (`delivery-guard.sh`). Print one line to stderr:
   `Agento: delivery guard inactive — <reason>; tool calls are not checked (install Node >= 20; see agento.mjs doctor hook-runtime).`
   Leave stdout empty and exit 0, so the verdict is still allow.
3. **SessionStart fallback** (`session-context.sh`).
   - Print the same style of stderr line:
     `Agento: session context unavailable — <reason> …`.
   - Print one static dual-shape JSON object on stdout with `printf`:
     `{"additionalContext":"<msg>","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"<msg>"}}`.
   - `<msg>` reads
     `Agento hooks inactive: <reason> (Node >= 20 required). The delivery guard allows every tool call unchecked and no Agento session context is available — tell the user before doing any delivery work.`
   - Exit 0.
4. **Header comments.** Update both wrappers' comments to describe the visible
   fail-open behavior instead of "silent".
5. **Doctor `hook-runtime` check** in `scripts/lib/doctor.mjs`, placed directly after
   `hook-wiring`.
   - Run `bash -c` with the wrappers' resolution (`command -v node` and
     `node --version`) through `probe`, using the inherited environment.
   - Results:
     - `ok`: `hooks resolve <path> (<version>)`.
     - `fail`: `bash` not found; or `hooks resolve no node on PATH — the delivery
       guard and SessionStart context are inactive (fail-open)`; or
       `hooks resolve <path> <version>, below the required 20`.
   - Fallback: install Node ≥ 20 on the PATH VS Code inherits (a system or user-level
     install, not a shell-rc-only version manager), then reload the window.
   - Mark it informational, like `hook-wiring`: leave it out of `CAPABILITY_CHECKS`
     so `doctor --for` never runs it, and add it to `LOCAL_DOCTOR_CHECKS`.
   - Leave the `node` check unchanged.
6. **Tests.**
   - Rewrite the session-context no-node test as the #149 regression test.
   - Add guard no-node and node < 20 tests. The node < 20 stub is an executable
     `node` script in a temp bin that prints `v18.19.0` for `--version`.
   - Add doctor `hook-runtime` tests (ok, no node, node < 20) that spawn
     `process.execPath` with a controlled `PATH`.
   - Extend the 14-id list assertion to 15.
7. **Generated copy.** Run `cd extension && npm run copy-cli` so
   `extension/cli/lib/doctor.mjs` matches `scripts/lib/doctor.mjs`.
8. **Docs.** Update every file named under Research. `docs/commands.md` documents
   `hook-runtime`, and `docs/hooks.md` loses the wrong doctor claim. Add a
   `**Fixed.**` entry citing #149 to `CHANGELOG.md`.

Affected files:
- `scripts/hooks/delivery-guard.sh`, `scripts/hooks/session-context.sh`
- `scripts/lib/doctor.mjs`, `extension/cli/lib/doctor.mjs` (generated)
- `tests/session-context.test.mjs`, `tests/guard.test.mjs`,
  `scripts/commands/doctor.test.mjs`
- `docs/hooks.md`, `docs/install.md`, `docs/commands.md`, `docs/architecture.md`,
  `README.md`, `CHANGELOG.md`

## Risks

- **Hook-file edits are gated.** The guard asks for approval on every edit under
  `scripts/hooks/` (the hooks are security-sensitive). Builder steps 2.1–2.2 surface
  approval cards; that approval is the user's (§1). Use an edit tool, never a shell
  write, which the guard denies outright.
- **Breaking the guard itself.** A wrapper bug could fail closed (non-zero exit) or
  stop exec'ing node. Mitigation: step 4.1 runs all five guard smoke commands listed
  in AGENTS.md, and `tests/guard.test.mjs` runs the real wrapper in step 4.2's full
  gate.
- **Per-call overhead.** The extra `node --version` spawn runs on every PreToolUse.
  Mitigation: one spawn of `node --version` (no script evaluation); the Builder
  records the guard's wall time before and after in step 2.1.
- **Stderr visibility differs by harness.** Copilot and Local may only log stderr on
  exit 0. That is why decision 1 adds the SessionStart `additionalContext` channel,
  which reaches the model in both harnesses.
- **Doctor's environment is not the hooks' environment** when doctor runs from a
  terminal whose PATH differs from VS Code's. Mitigation: docs state that
  `hook-runtime` reflects the calling environment, and that the extension's dashboard
  run (the extension host env) is the faithful one.
- **Concurrent delivery.** No open PRs today. Merge `origin/main` before every push,
  as §7 requires.

## Out of scope

- Failing closed or asking when node is missing (decision 2).
- A heartbeat or liveness marker written by the hooks (decision 4 chose the wrapper
  probe only).
- Changing hook wiring (`hooks/hooks.json`, `.github/hooks/*.json`) or the Node
  modules' policy logic.
- Bundling or locating a node binary on the user's behalf.

## Acceptance checklist

- [ ] The #149 regression tests fail before the fix and pass after it. The tests are
      the session-context no-node test and the node < 20 test in
      `tests/session-context.test.mjs`, the guard no-node and node < 20 tests in
      `tests/guard.test.mjs`, and the `hook-runtime` tests in
      `scripts/commands/doctor.test.mjs`. Verify with the failing step 1.1 run, then
      `node --test tests/session-context.test.mjs tests/guard.test.mjs scripts/commands/doctor.test.mjs`
      exiting 0.
- [ ] Without node on PATH, `session-context.sh` exits 0, prints exactly one
      dual-shape JSON object whose two `additionalContext` values are equal and
      contain `Agento hooks inactive: node not found on PATH`, and prints one stderr
      line. Verify with step 2.3's re-run of the plan.md Evidence reproduction 1,
      saved as `evidence/after-no-node.txt`.
- [ ] Without node on PATH, `delivery-guard.sh` exits 0 with empty stdout (allow) and
      exactly one stderr line starting `Agento: delivery guard inactive — node not
      found on PATH`. Verify with step 2.3's reproduction 2 in
      `evidence/after-no-node.txt`.
- [ ] With a stub node reporting `v18.19.0`, both wrappers behave as in the two items
      above with the reason `node v18.19.0 is below the required 20`, and never exec
      the module. Verify with the step 1.1 tests and `evidence/after-no-node.txt`.
- [ ] With node ≥ 20 the hooks behave exactly as before. Verify with the guard
      smoke commands listed in AGENTS.md (all five exit 0, step 4.1) and the
      unchanged pre-existing tests in the full suite.
- [ ] `agento.mjs doctor` reports `hook-runtime` directly after `hook-wiring`: `ok`
      with node ≥ 20, `fail` with no node or node < 20, never in a `--for` run.
      Verify with the doctor tests and `node scripts/agento.mjs doctor`.
- [ ] `extension/cli/` is byte-identical to `scripts/` per `npm run copy-cli`. Verify
      with `tests/cli-layout.test.mjs` passing and a clean
      `git status --porcelain extension/cli` after re-running copy-cli.
- [ ] `docs/hooks.md`, `docs/install.md`, `docs/commands.md`, `docs/architecture.md`,
      and `README.md` describe the visible fail-open and the `hook-runtime` check,
      and no doc still claims the hooks are silent or that doctor's `node` check
      catches a missing node. `CHANGELOG.md` has a `**Fixed.**` entry citing #149.
      Verify by grep (step 3.2).
- [ ] Full gate: `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` exits 0
      with no findings, and the full test command exits 0 with 0 failures and 945
      plus the new tests. Verify with step 4.2.
