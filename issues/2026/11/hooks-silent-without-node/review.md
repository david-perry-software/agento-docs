# Review: hooks-silent-without-node

Verdict: approve

Reviewed 2026-11-06 (round 1) against product HEAD `5f502f2` on
`issue/hooks-silent-without-node` (GitHub issue #149, code PR #150, artifact PR
agento-docs#81). `origin/main` is an ancestor of HEAD in both halves; both halves
were clean (`git status --porcelain --untracked-files=all` empty) and in sync with
their remotes at review start. Skills consulted: none — the repository has no
`## Agento` skills table and no `.agents/skills/` directory (matches plan.md).

## Acceptance checklist results

1. **#149 regression tests fail before and pass after — pass.** Independently
   confirmed "before": exported `origin/main` with `git archive`, copied HEAD's
   `tests/session-context.test.mjs`, `tests/guard.test.mjs`,
   `scripts/commands/doctor.test.mjs`, and `scripts/test-helpers/agento-fixtures.mjs`
   over it, ran `node --test` on the three files → exit 1, `# tests 109 / pass 102 /
   fail 7`; all six `(#149 hooks-silent-without-node)` tests `not ok` (the seventh is
   the "gh is missing" count test, updated in step 3.1, consistent with the Builder's
   recorded 1.1 run of 6). "After": the same six tests are `ok 158, 159, 859, 860,
   922, 923` in the full-suite run below. Each test name carries
   `(#149 hooks-silent-without-node)` and targets the plan.md Evidence defects
   (no-node and v18.19.0 stub PATHs against the real wrappers; `process.execPath`
   doctor spawns with a controlled PATH).
2. **session-context.sh without node: exit 0, one dual-shape JSON, one stderr line —
   pass.** Re-driven with my own temp PATH (`bash`, `git`, `cat`, `dirname` symlinks):
   exit 0; stdout parses; `additionalContext ===
   hookSpecificOutput.additionalContext`; `hookEventName: "SessionStart"`; text
   contains `Agento hooks inactive: node not found on PATH`; stderr is exactly one
   line `Agento: session context unavailable — node not found on PATH …`. Matches
   `evidence/after-no-node.txt` reproduction 1.
3. **delivery-guard.sh without node: exit 0, empty stdout, one stderr line — pass.**
   Re-driven with the `git push origin main` payload: exit 0, stdout empty, stderr
   exactly one line `Agento: delivery guard inactive — node not found on PATH; tool
   calls are not checked …`. Matches `evidence/after-no-node.txt` reproduction 2.
4. **v18.19.0 stub: same behavior with the below-required reason, module never
   exec'd — pass.** Both wrappers exit 0 with reason `node v18.19.0 is below the
   required 20` on stderr (and in the context JSON for session-context); the stub
   exits 99 for anything but `--version`, so the exit 0 proves the module was never
   exec'd. Cross-checked with a `v20.0.0` stub: both wrappers exec (exit 99 from the
   stub), proving the gate passes at major 20.
5. **node ≥ 20 unchanged — pass.** All five AGENTS.md guard smoke commands exit 0
   (plain, companion, Copilot, Copilot companion, Copilot fixtures; no mismatches —
   the only `mismatch` grep hit is the fixtures header comment). With real node the
   guard returns the `deny` verdict for `git push origin main` and session-context
   emits the normal context (`Current git branch: …`). 942 pre-existing tests pass
   unchanged. Executable bits preserved (`100755` on both wrappers). Overhead
   spot-check: 20 guard calls ≈ 1.07 s (~53 ms/call) versus `node --version` alone
   ≈ 4.5 ms/call — one spawn, as the plan predicted.
6. **doctor `hook-runtime` after `hook-wiring`, ok / fail / never in `--for` — pass.**
   `node scripts/agento.mjs doctor` lists ids
   `…, hook-wiring, hook-runtime, harness, …` and reports
   `{"id":"hook-runtime","status":"ok","detail":"hooks resolve
   /home/david/.local/bin/node (v22.23.2)"}`; `doctor --for new-issue` lists
   `node,git-remote,gh,worktrees-dir,session-workspace,artifact-repo` only.
   `CAPABILITY_CHECKS` is unchanged; `LOCAL_DOCTOR_CHECKS` gains the id. The fail
   paths (no node, v18.19.0) are covered by the passing doctor test `ok 159`.
   (The overall doctor status on this machine is `fail` from the pre-existing
   `harness` link pointing at another clone — unrelated to this diff.)
7. **`extension/cli/` byte-identical — pass.** `cd extension && npm run copy-cli`
   exit 0; `git status --porcelain extension/cli` empty afterwards;
   `cmp scripts/lib/doctor.mjs extension/cli/lib/doctor.mjs` identical;
   `tests/cli-layout.test.mjs` passes in the full run.
8. **Docs updated, no stale silent/node-check claims, CHANGELOG #149 — pass.**
   `grep -rnE 'print nothing|exit silently|is silent and exits|fails its .node. check'
   docs README.md scripts/hooks` → no matches (exit 1). `hook-runtime` appears in
   `docs/hooks.md:20` and `docs/commands.md:442,446,451`; `CHANGELOG.md:5-8` has the
   `**Fixed.** … (#149)` entry under `## Unreleased`. `docs/install.md`, `README.md`,
   and `docs/architecture.md` (both the slip-guard paragraph and line 249) describe
   the visible fail-open.
9. **Full gate — pass.** `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`
   (ShellCheck 0.10.0) exit 0, no findings. `node --test 'scripts/**/*.test.mjs'
   'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` → exit 0, `# tests 948 / pass 948 /
   fail 0` — baseline 945 + 3 net-new tests (one existing no-node test was rewritten
   in each of `tests/session-context.test.mjs` and `tests/guard.test.mjs`, plus one
   new node<20 test in each and one new `hook-runtime` doctor test).

`## Resolution` is written and consistent with the diff: it names both wrappers,
`scripts/lib/doctor.mjs`, the six #149 test names, `evidence/after-no-node.txt`, and
the `hook-runtime` output; both relative links in plan.md resolve.

## Plan vs implementation

Deviations, all recorded on the roadmap by the Builder and all justified:

- `scripts/test-helpers/agento-fixtures.mjs` (not in plan.md's affected files):
  `restrictedPath()` now also symlinks `bash`. Required — the pre-existing
  all-checks-ok id-list test runs on a PATH holding only `node` and `git`, and the
  new `hook-runtime` check probes through `bash`. Consequential fix: `shipStub`'s
  coreutils loop skips already-linked tools (it would otherwise `EEXIST` on `bash`).
  Both are test-fixture-only changes with no production effect.
- `scripts/commands/doctor.test.mjs` "gh is missing" expected ok-count 13 → 14: a
  direct consequence of the 15th check; correct.
- `docs/architecture.md:249` ("Without it the hooks are silent … `doctor` fails
  `node`"): a second stale claim plan.md's Research did not list but acceptance item 8
  ("no doc still claims the hooks are silent or that doctor's `node` check catches a
  missing node") requires fixing. In scope.
- Plan Research said `tests/guard.test.mjs` had no no-node case; it did (the old
  "without node on PATH the hook exits 0 and prints nothing" at line ~716). The
  Builder correctly rewrote it as the #149 regression test, so the net-new count is 3
  rather than the plan's implied 4. No action.
- Approach item 1 specifies including the version only when it matches
  `^v[0-9]+(\.[0-9]+)*$`. The implementation uses a `case` character-class check plus
  a per-part digit check after `IFS='.' read -a`; bash drops a trailing empty field,
  so `v20.` is accepted as major 20 rather than reported as "unexpected value". Real
  node never prints that shape and the outcome (exec at major 20) is harmless — a
  nit, listed under Findings.

## Roadmap audit

Every one of the nine ticked boxes was spot-checked against the codebase and
re-executed where CLI-executable (1.1 fail-before run, 2.1/2.2 tests + shellcheck,
2.3 evidence re-drive, 3.1 doctor output and copy-cli, 3.2 greps, 4.1 five smoke
commands, 4.2 full gate, 4.3 Resolution). No falsely ticked boxes; no `(manual)`
steps; no missing work. No repairs made.

## Findings

- **Minor (nit).** `scripts/hooks/delivery-guard.sh` and
  `scripts/hooks/session-context.sh`: a `node --version` output with a trailing dot
  (`v20.`) passes the gate because `read -a` drops the trailing empty field, so the
  "unexpected value" branch is slightly narrower than the Approach regex. Harmless
  in practice; no change requested.
- **Minor (nit).** The ~25-line version gate is duplicated verbatim across the two
  wrappers. The plan accepts the wrappers as near-identical, and a shared sourced
  file would widen the hook-file edit surface and the wiring; acceptable as is —
  noted as a follow-up only.
- No security findings. The reason string is JSON-safe by construction (fixed text or
  a digits-and-dots version); both fallbacks keep exit 0 so neither harness fails
  closed; the `deny` verdict with real node is unchanged; no secrets are read or
  printed.

## Follow-ups

- Consider extracting the shared bash node-gate from the two hook wrappers into one
  sourced helper if a third wrapper ever needs it (currently two copies).
