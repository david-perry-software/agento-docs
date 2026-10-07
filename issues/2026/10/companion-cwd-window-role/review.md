# Review: companion-cwd-window-role

Verdict: approve

Reviewed 2026-10-07 at product HEAD `fda1e78` (code PR #93) and companion HEAD
`3fa68b1` (artifact PR #29). Both are on `issue/companion-cwd-window-role`,
`origin/main` is an ancestor of both, and both PRs report `mergeStateStatus: CLEAN`.
The code PR's `test` check is `SUCCESS`, and its body starts with `Fixes #92`.

Skills consulted: none — no matching domain (there is no `.agents/skills/`, and
AGENTS.md has no `## Agento` skills table).

Verification target: CLI-only behavior, so the reviewer reran everything headless.
No UI is involved and no browser evidence is needed.

## Acceptance checklist results

1. **Exposing test fails before the fix and passes after it: pass.**
   - Before: `git archive efc142d` (step 1.1, test only, no fix) was exported to
     `/tmp/rv-pre`, then `node --test scripts/agento.test.mjs` was run there. Result:
     exit 1, `# tests 88`, `# fail 1`. The only `not ok` is `not ok 13 - session,
     next, and doctor from the companion clone describe the product primary (#92
     companion-cwd-window-role)`, with `expected: 'primary'` and
     `actual: 'unmanaged'`.
   - After: in the full suite at `fda1e78`, the same test is
     `ok 26 - session, next, and doctor from the companion clone … (#92 …)`.
2. **`session` from the clone root and a subdirectory gives `role: primary` and the
   same record: pass.**
   - The step 1.1 test passes.
   - Reviewer rerun with this branch's CLI from `/home/david/DP/agento-docs` and
     `/home/david/DP/agento-docs/features`: both exit 0, `role: primary`,
     `worktree.path: /home/david/DP/agento`, `worktree.branch: main`, and the
     primary's six `allowed[]`.
   - `strip(record)` is identical to the record from `/home/david/DP/agento`
     (`eq-primary=true` for both).
   - `warnings[]` keeps `anchored-from-companion: /home/david/DP/agento-docs is a
     companion checkout of /home/david/DP/agento; …`.
3. **`next` from the clone exits 0 with the same `next` as the primary: pass.**
   Reviewer rerun from `/home/david/DP/agento-docs`: exit 0, `status: ok`,
   `role: primary`, and `next` deep-equal to the primary's (`start-session
   issue/companion-cwd-window-role --resume`). Before the fix the logged exit was 3
   ([evidence/next-from-companion-clone.txt](evidence/next-from-companion-clone.txt)).
4. **Doctor `session-workspace` parity, with the caller using the anchored cwd:
   pass.**
   - The test passes.
   - Reviewer `doctor` on the real pair: `{"status":"ok","detail":"not a managed
     pair"}` from both `/home/david/DP/agento` and `/home/david/DP/agento-docs`.
   - `grep -n 'deriveRole({ cwd: startDir' scripts/agento.mjs` exits 1 (no match),
     and `grep -c 'cwd: roleCwd'` gives `3` (L668, L1516, L1562).
5. **Companion halves unchanged: pass.**
   - `git diff origin/main...HEAD -- scripts/agento.test.mjs` contains only the
     `clone.role` line, its comment, and the new test.
   - The existing pair tests pass in the full suite.
   - Reviewer `session` from the companion half
     (`…/agento-docs-worktrees/plan-20261007-045607/issues`) still gives
     `role: build` with `delivery.slug: companion-cwd-window-role`.
6. **`extension/cli/agento.mjs` is byte-identical: pass.**
   `cmp scripts/agento.mjs extension/cli/agento.mjs` exits 0, and
   `tests/extension-bundle.test.mjs` passes in the suite.
7. **Docs and changelog: pass.**
   - `grep -n '#92' CHANGELOG.md` hits L10, under `## Unreleased` (L3).
   - `grep -n 'companion clone itself' docs/architecture.md` hits L153.
8. **Scoped lint gate (policy §5): pass.**
   - `node --check` on `scripts/agento.mjs`, `scripts/agento.test.mjs`, and
     `extension/cli/agento.mjs` exits 0.
   - Full suite `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`: exit 0,
     `# tests 289`, `# pass 289`, `# fail 0` (baseline 288, plus the new test).
   - `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` exits 0.
   - `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh <
     tests/guard-fixtures-companion.txt` exits 0.
   - `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` exits 127
     (`command not found`), which matches the baseline. There are no new findings to
     compare.
   - `git diff --name-only origin/main...HEAD` lists exactly `CHANGELOG.md`,
     `docs/architecture.md`, `extension/cli/agento.mjs`, `scripts/agento.mjs`, and
     `scripts/agento.test.mjs`. No shell file is in the diff.

## Plan vs implementation

There are no gaps and no undocumented changes. The implementation matches plan.md
`## Approach` exactly:

- `anchorRoot()` returns `fromClone` on every path. It is true only on the
  single-match branch, when `samePath(clone, dir) && !looksLikeHalf`.
- `const roleCwd = anchor.fromClone ? root : startDir;` sits beside `root`.
- The three `deriveRole` callers use `roleCwd`.
- The `session` comment is reworded.
- The warning text, `scripts/session-state.mjs`, and `classifyWorktrees` are
  untouched. The diff stat for `session-state.mjs` is empty.

A subdirectory of the clone works because `toplevel` comes from
`git rev-parse --show-toplevel`, so `dir` is the clone root.

## Roadmap audit

All 7 ticked steps were spot-checked against the code and the reruns above. None are
falsely ticked, and no repairs were needed.

- 1.1: Confirmed by the pre-fix export run.
- 2.1 and 2.2: Confirmed by the greps, `cmp`, and the test diff.
- 2.3: The three `after-*` logs exist, show `"role": "primary"`, and keep
  `anchored-from-companion`. Each ends `exit=0`.
- 3.1 and 3.2: Confirmed by the greps and the gate reruns.
- 3.3: Both PRs are `CLEAN`, the code PR body starts with `Fixes #92`, and the
  companion half is at `dirty: false`, `ahead: 0`.

There are no `(manual)` or `(manual, post-ship)` steps.

## Findings

1. **Nit, `scripts/agento.test.mjs`, new test, doctor block.** The
   `session-workspace` parity assertion already held before the fix (an `unmanaged`
   cwd is also "not a managed pair"). So no test would fail if the L668 doctor caller
   went back to `startDir`. plan.md `## Approach` acknowledges this, and the change
   has no observable effect today. Not blocking.

There are no correctness or security findings. The change is a single read-only
derivation input, and ownership (`classifyWorktrees`, `findOwner`) is untouched.

## Follow-ups

- (none)
