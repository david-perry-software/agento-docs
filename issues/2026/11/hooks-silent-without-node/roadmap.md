```yaml
status: in-progress
branch: issue/hooks-silent-without-node
last-updated: 2026-11-06
next-step: "4.3 Write plan.md ## Resolution"
github-issue: "#149"
artifact-pr: "#81"
```

## Phase 1: Expose the defect

- [x] 1.1 Add the #149 regression tests, before any fix. Every new or rewritten test
  name contains `(#149 hooks-silent-without-node)`.
  1. **`tests/session-context.test.mjs`.**
     - Rewrite "without node on PATH the hook exits 0 and prints nothing". The new
       test asserts: exit 0; stdout parses as one JSON object whose top-level
       `additionalContext` equals `hookSpecificOutput.additionalContext`, with
       `hookEventName: "SessionStart"`, and contains
       `Agento hooks inactive: node not found on PATH`; stderr is exactly one line
       starting `Agento: session context unavailable — node not found on PATH`.
     - Add a node < 20 case using a temp bin from `pathWithoutNode()` plus an
       executable `node` stub that prints `v18.19.0` for `--version` and exits 99
       for anything else. Expect the same assertions with the reason
       `node v18.19.0 is below the required 20`.
  2. **`tests/guard.test.mjs`.** Add the same two PATH setups (no node; a
     `v18.19.0` stub) with the `git push origin main` payload. Assert: exit 0;
     stdout `""` (the allow verdict); stderr exactly one line starting
     `Agento: delivery guard inactive — <reason>`.
  3. **`scripts/commands/doctor.test.mjs`.**
     - Extend the id-list assertion at ~line 103 to 15 ids, with `hook-runtime`
       directly after `hook-wiring`.
     - Add a `hook-runtime` test that spawns `process.execPath` (not `runWith`,
       which resolves `node` by name) on the CLI `doctor` with a controlled `PATH`:
       - real node → `ok` with detail matching `hooks resolve .* \(v\d+`;
       - no node → `fail` with detail containing `no node on PATH`;
       - `v18.19.0` stub → `fail` with detail containing `v18.19.0, below the required 20`.
     - Assert `doctor --for new-issue` does not include `hook-runtime`.

  — verify: `node --test tests/session-context.test.mjs tests/guard.test.mjs scripts/commands/doctor.test.mjs > /tmp/hswn-1-1.txt 2>&1; echo "exit=$?"`
  prints `exit=1`. `grep '^not ok' /tmp/hswn-1-1.txt` lists only #149 tests and the
  extended id-list test, and every other pre-existing test is `ok`. Record the
  `# tests/pass/fail` counts and the failing names on this line.
  — recorded: `# tests 109 / pass 103 / fail 6`; failing (all `(#149 hooks-silent-without-node)`):
  `doctor reports fifteen checks including hook-runtime after hook-wiring`,
  `doctor hook-runtime reflects the hooks' node resolution and stays out of --for runs`,
  `without node on PATH the guard fails open with a visible warning`,
  `with node below 20 the guard fails open with a below-required warning`,
  `without node on PATH the hook fails open with a visible warning`,
  `with node below 20 the hook fails open with a below-required warning`.

## Phase 2: Make the wrappers fail open visibly

- [x] 2.1 Implement plan.md `## Approach` items 1, 2, and 4 in
  `scripts/hooks/delivery-guard.sh`. Use an edit tool; the guard asks for approval on
  hook-file edits.
  - Gate on `node --version` with a major ≥ 20, with a JSON-safe reason.
  - On fallback print one stderr line, leave stdout empty, and exit 0.
  - Update the header comment.

  — verify:
  - `node --test tests/guard.test.mjs` exits 0, with both #149 guard tests `ok`.
  - `shellcheck scripts/hooks/delivery-guard.sh` exits 0.
  - Time 20 runs of the `git push origin main` payload through the wrapper with
    node on PATH (`time` around a loop), on `origin/main` and on this branch. Record
    both totals on this line; the per-call delta should be one `node --version`
    spawn.
  — recorded: 20 runs `git push origin main` — this branch (new gate) `real 1.409s`
    (~70.5 ms/call); `origin/main` (old wrapper) `real 1.267s` (~63.4 ms/call);
    delta ~7.1 ms/call = one `node --version` spawn.
- [x] 2.2 Implement plan.md `## Approach` items 1, 3, and 4 in
  `scripts/hooks/session-context.sh`, using an edit tool.
  - Apply the same gate.
  - On fallback print the static dual-shape JSON with `printf` on stdout and one
    stderr line, then exit 0.
  - Update the header comment.

  — verify:
  - `node --test tests/session-context.test.mjs` exits 0, with both #149 tests `ok`.
  - `shellcheck scripts/hooks/session-context.sh` exits 0.
  - The fallback stdout parses with `node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"))'`.
- [x] 2.3 Re-run plan.md `## Evidence` reproductions 1 and 2 on this branch. Run
  each with `PATH=<NONODE>` and with a `v18.19.0` stub, and run reproduction 2 once
  more with real node. Print exit code, stdout, and stderr for each. Normalize paths
  to `<REPO>` / `<NONODE>` and save the result as
  `evidence/after-no-node.txt` in the issue's artifact directory. — verify: the
  file shows exit 0 everywhere and the context JSON and stderr notices for both
  reasons; the guard has empty stdout without node and the `deny` verdict with real
  node. `git status --porcelain` in the product worktree prints nothing.

## Phase 3: Doctor check and docs

- [x] 3.1 Implement plan.md `## Approach` item 5 in `scripts/lib/doctor.mjs`.
  - Add the `hook-runtime` check after `hook-wiring`, via `probe("bash", ["-c", …])`
    with the inherited env.
  - Leave it out of `CAPABILITY_CHECKS` and add it to `LOCAL_DOCTOR_CHECKS`.
  - Then run `cd extension && npm run copy-cli`.

  — verify:
  - `node --test scripts/commands/doctor.test.mjs tests/cli-layout.test.mjs` exits
    0, with every #149 doctor test `ok`.
  - `node scripts/agento.mjs doctor` shows `hook-runtime` `ok` with this machine's
    node path and version.
  - Re-running `npm run copy-cli` leaves `git status --porcelain extension/cli`
    empty.
  — recorded: `hook-runtime` `ok` → `hooks resolve /home/david/.local/bin/node (v22.23.2)`,
  directly after `hook-wiring`. Two supporting test-fixture adjustments beyond plan.md's
  affected-files list: the "gh is missing" doctor test's hardcoded non-gh count went 13→14,
  and `scripts/test-helpers/agento-fixtures.mjs` `restrictedPath` gained a `bash` symlink
  so the all-checks-ok id-list test can run the hook-runtime bash probe.
- [x] 3.2 Implement plan.md `## Approach` item 8.
  - `docs/hooks.md:16-18`: visible fail-open plus `hook-runtime`, and drop the
    wrong `node`-check claim.
  - `docs/install.md:16-18` and `README.md:518-519`: the notice and context
    warning.
  - `docs/commands.md` doctor list and description: `hook-runtime` (informational,
    `fail` on no node or node < 20; it reflects the calling environment, and the
    extension's dashboard run uses the extension host env).
  - `docs/architecture.md:90-95`: fails open visibly.
  - `CHANGELOG.md` `## Unreleased`: a `**Fixed.**` entry citing #149.

  — verify:
  - `grep -n 'hook-runtime' docs/hooks.md docs/commands.md` and
    `grep -n '#149' CHANGELOG.md` each show the new text.
  - `grep -rnE 'print nothing|exit silently|is silent and exits|fails its .node. check' docs README.md scripts/hooks`
    prints nothing.
  - `node --test tests/customizations.test.mjs` exits 0.
  — recorded: `tests/customizations.test.mjs` 67/67 pass. Also fixed the second stale
  "hooks are silent" claim at `docs/architecture.md:249` (plan.md only named 90-95).

## Phase 4: Gate and resolution

- [x] 4.1 Run all five guard smoke commands listed in AGENTS.md: plain, companion,
  Copilot format, Copilot companion, and Copilot fixtures. — verify: each exits 0
  with no mismatches. Record the five exit codes on this line.
  — recorded: plain=0, companion=0, Copilot=0, Copilot companion=0, Copilot fixtures=0.
- [x] 4.2 Run the full gate (§5) and compare it with the plan.md `## Research`
  baseline (945/945, shellcheck clean). — verify:
  - `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` exits 0 with no
    findings.
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'`
    exits 0 with fail 0, and the test count is 945 plus the new #149 tests.
  - Record the counts on this line.
  — recorded: `shellcheck` exit 0, no findings; full suite `# tests 948 / pass 948 / fail 0`
  (baseline 945 + 3 new #149 tests). Repair beyond plan.md: `restrictedPath` gained a
  `bash` symlink for the hook-runtime probe, which made `shipStub`'s own bash symlink
  collide (EEXIST); its coreutils loop is now idempotent (skips already-linked tools).
- [ ] 4.3 Write plan.md `## Resolution`: the root cause (the silent `|| exit 0` with
  no version gate, and doctor inspecting its own process), what changed and why, and
  proof (the #149 test names `ok` in 4.2, `evidence/after-no-node.txt`, and the
  `hook-runtime` output from 3.1). — verify: `## Resolution` names both wrappers,
  `scripts/lib/doctor.mjs`, the #149 tests, and `evidence/after-no-node.txt`, and
  every relative link in plan.md resolves.
