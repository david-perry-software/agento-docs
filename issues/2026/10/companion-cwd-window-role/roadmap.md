```yaml
status: in-progress
branch: issue/companion-cwd-window-role
last-updated: 2026-10-07
next-step: "3.3 Integrate, publish, write Resolution, set in-review"
github-issue: "#92"
artifact-pr: "#29"
```

## Phase 1: Expose the defect

- [x] 1.1 Add a new `test(...)` to `scripts/agento.test.mjs`. Put it directly after the test "session from a companion half anchors on the product primary and matches the product half", and name it `session, next, and doctor from the companion clone describe the product primary (#92 companion-cwd-window-role)`. The test does the following:
  - Calls `makePairRepo()`, then `fs.mkdirSync(path.join(docs, "features"), { recursive: true })`.
  - Sets `primary = run(repo, "session").json`. Asserts that `run(docs, "session")` and `run(path.join(docs, "features"), "session")` each give `role === "primary"`, `worktree.path === repo`, `strip(record)` deep-equal to `strip(primary)`, and `warnings[0]` matching `/^anchored-from-companion: /`.
  - Asserts that `run(docs, "next")` has `code === 0`, `json.role === "primary"`, and `json.status` and `json.next` deep-equal to those of `run(repo, "next")`.
  - With `const { env } = restrictedPath(okStubs)`, asserts that the `session-workspace` check from `runWith({ cwd: docs, env }, "doctor")` deep-equals the one from `runWith({ cwd: repo, env }, "doctor")` (via `byId`).
  - After `git(docs, "switch", "-q", "-c", "tmp-branch")`, asserts that `run(docs, "session").json` still has `role === "primary"` and `worktree.branch === "main"`.

  Change no other test. — verify: run `node --test scripts/agento.test.mjs > /tmp/issue-92.txt 2>&1; echo "exit=$?"`, then `grep -n '^not ok\|#92' /tmp/issue-92.txt`:
  - the run exits nonzero;
  - exactly that one test is `not ok`, and its failure shows `'unmanaged'` vs `'primary'`;
  - every other test in the file is `ok`.

## Phase 2: Fix the role anchor

- [x] 2.1 Change only `scripts/agento.mjs`:
  - `anchorRoot()` returns `fromClone: true` only on the single-match branch when the cwd is the clone itself (`samePath(clone, dir)`, not `looksLikeHalf`). Every other return gets `fromClone: false`.
  - Add `const roleCwd = anchor.fromClone ? root : startDir;` beside `const root = anchor.root;`.
  - Switch the three `deriveRole({ cwd: startDir, … })` calls (doctor `session-workspace`, `session`, `next`) to `cwd: roleCwd`.
  - Reword the `session` comment so it says subdirectories resolve to their worktree and the companion clone resolves to the anchored product primary.

  Leave `scripts/session-state.mjs` and the warning text untouched. — verify:
  - `node --check scripts/agento.mjs` exits 0;
  - `grep -n 'deriveRole({ cwd: startDir' scripts/agento.mjs` prints nothing;
  - `grep -c 'cwd: roleCwd' scripts/agento.mjs` prints `3`;
  - `git diff --stat -- scripts/session-state.mjs` is empty.
- [x] 2.2 In the existing test "session from a companion half anchors on the product primary and matches the product half", change `assert.equal(clone.role, "unmanaged")` to `"primary"` and update the comment above it ("clone → primary, anchored on the product primary"). Leave `list[2].role` as `"unmanaged"`. Then run `cd extension && npm run copy-cli`. — verify:
  - `node --test scripts/agento.test.mjs tests/extension-bundle.test.mjs` exits 0 with `# fail 0`, and the step 1.1 #92 test is `ok`;
  - `cmp scripts/agento.mjs extension/cli/agento.mjs` exits 0;
  - `git diff -U0 -- scripts/agento.test.mjs` shows, outside the new test, only the `clone.role` line and its comment.
- [x] 2.3 Rerun the reproduction with this branch's CLI. Write the outputs as [`evidence/after-session-from-companion-clone.txt`](evidence/after-session-from-companion-clone.txt), [`evidence/after-session-from-companion-subdir.txt`](evidence/after-session-from-companion-subdir.txt), and [`evidence/after-next-from-companion-clone.txt`](evidence/after-next-from-companion-clone.txt) in the companion half's issue directory, using the same command header format as the "before" logs. — verify (from `/home/david/DP/agento-docs`, `/home/david/DP/agento-docs/features`, and `/home/david/DP/agento-docs` for `next`):
  - each log shows `"role": "primary"` at the top level, `worktree.path` `/home/david/DP/agento`, and the `allowed[]` of `evidence/session-from-product-primary.txt`;
  - the `next` log ends `exit=0`;
  - the `anchored-from-companion` warning is still present.

## Phase 3: Docs, gate, and publish

- [x] 3.1 Update the docs and changelog:
  - In `docs/architecture.md` "Companion-cwd anchoring", add one sentence: from the companion clone itself (its root or any subdirectory, on any branch), `role` and `worktree` are the product primary's; from a half, they are the product half's; the clone's own `worktrees[]` entry stays `unmanaged`.
  - Add a **Fixed** bullet under `CHANGELOG.md` `## Unreleased` stating that `agento.mjs session`/`next` (the §11 window check) reported `role: unmanaged` and rejected every command when the terminal sat in the companion clone of a primary window, and now return the product primary's record with the `anchored-from-companion` warning (`#92`).

  — verify: `grep -n '#92' CHANGELOG.md` hits one line under `## Unreleased`, and `grep -n 'companion clone itself' docs/architecture.md` hits one line.
- [x] 3.2 Scoped gate against the plan.md `## Research` baseline (288 tests, guard 0, shellcheck exit 127 absent). Run:
  - `node --check scripts/agento.mjs scripts/agento.test.mjs extension/cli/agento.mjs`;
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`;
  - `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt`;
  - `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt`;
  - `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`;
  - `git diff --name-only origin/main...HEAD`.

  Capture each command's status in a wrapper (policy §6). — verify:
  - every `node --check` exits 0;
  - the repo suite exits 0 with `# tests 289` and `# fail 0`;
  - both guard smokes exit 0;
  - shellcheck exits 0 with no findings, or exits 127 as in the baseline;
  - the diff lists exactly `CHANGELOG.md`, `docs/architecture.md`, `extension/cli/agento.mjs`, `scripts/agento.mjs`, and `scripts/agento.test.mjs`, with no shell file.

  Result (2026-10-07, product HEAD after 3.1): `node --check` exit 0; suite exit 0, `# tests 289`, `# pass 289`, `# fail 0`; guard smoke exit 0; companion guard smoke exit 0; shellcheck exit 127 (`command not found`, same as baseline); diff = exactly the five planned files, no shell file.
- [ ] 3.3 Integrate and publish:
  - Run `git merge origin/main` in the product half and `git -C <companion.path> merge origin/main` in the companion half. Never rebase.
  - Push both.
  - Write plan.md `## Resolution`: the root cause, the `roleCwd` change, and the step 1.1 test and step 2.3 logs proving the fix.
  - Set `status: in-review`.

  — verify:
  - `gh pr view --json mergeStateStatus --jq .mergeStateStatus` is neither `BEHIND` nor `DIRTY` for the code PR, and likewise from `<companion.path>` for the companion PR;
  - the code PR body starts with `Fixes #92`;
  - `node scripts/agento.mjs session --pr` reports `pr` and `companionPr`, with the companion half at `dirty: false`, `ahead: 0`.

## Follow-ups

- (none yet)
