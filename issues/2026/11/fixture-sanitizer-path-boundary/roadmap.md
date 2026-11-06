```yaml
status: in-progress
branch: issue/fixture-sanitizer-path-boundary
last-updated: 2026-11-05
next-step: "2.2 Re-run the plan.md Evidence reproductions and save evidence/after-*.txt"
github-issue: "#145"
artifact-pr: "#79"
```

## Phase 1: Expose the defect

- [x] 1.1 Implement plan.md `## Approach` item 1 in `tests/harness-probe/probe.mjs`: `makeSanitizeCtx(overrides = {})` with optional `repoRoot`, `homeDir`, `username`, `probeWs`. Defaults stay exactly as today, and there is no other behavior change. In `tests/harness-probe/probe.test.mjs`, add `test("makeSanitizeCtx replaces repo and HOME paths only at a path boundary (#145 fixture-sanitizer-path-boundary)")`. It calls `sanitizeRecord(<object of the inputs>, ctx)` and `deepEqual`s the result. Context A is `makeSanitizeCtx({ repoRoot: "/h/me/DP/agento", homeDir: "/h/me", username: "zq9user" })`, and each case gets a fresh ctx where needed:
  - `/h/me/DP/agento/scripts/agento.mjs` → `<REPO>/scripts/agento.mjs`
  - `/h/me/DP/agento` → `<REPO>`
  - `cd /h/me/DP/agento && ls` → `cd <REPO> && ls`
  - `"/h/me/DP/agento"` (with the quotes) → `"<REPO>"`
  - `PATH=/h/me/DP/agento:/usr/bin` → `PATH=<REPO>:/usr/bin`
  - `/h/me/DP/agento-worktrees/plan-x` → `<HOME>/DP/agento-worktrees/plan-x`
  - `/h/me/DP/agento.bak/x` → `<HOME>/DP/agento.bak/x`
  - `/h/me2/project` → `/h/me2/project`
  - `/h/me/.cache/agento-harness-probe/workspace/a` → `<PROBE_WS>/a`
  - `/h/me/.config/Code/agentPlugins/file-home-zq9user-DP-agento/1a` → `<HOME>/.config/Code/agentPlugins/file-home-<USER>-DP-agento/1a`
  - Context B, trailing-slash HOME (`homeDir: "/h/me/"`): `/h/me/x` → `<HOME>/x`
  - Context C, longest first (`repoRoot: "/h/me/.cache/agento-harness-probe"`, `homeDir: "/h/me"`): `/h/me/.cache/agento-harness-probe/workspace/a` → `<PROBE_WS>/a`

  — verify: `node --test tests/harness-probe/probe.test.mjs > /tmp/fsb-1-1.txt 2>&1; echo "exit=$?"` prints `exit=1`. `grep '^not ok' /tmp/fsb-1-1.txt` shows only the #145 test, with actuals including `<REPO>-worktrees/plan-x`, `<HOME>2/project`, `<HOME>x`, and `<REPO>/workspace/a`. Every pre-existing test is `ok`. Record the `# tests/pass/fail` counts and the actuals on this line.

  Recorded 2026-11-05: `exit=1`, `# tests 24 / pass 23 / fail 1`; `grep '^not ok'` shows only test 20 `makeSanitizeCtx replaces repo and HOME paths only at a path boundary (#145 fixture-sanitizer-path-boundary)`; actuals — `sibling: '<REPO>-worktrees/plan-x'`, `bak: '<REPO>.bak/x'`, `other: '<HOME>2/project'`, `b.home: '<HOME>x'`, `c.ws: '<REPO>/workspace/a'`. All 23 pre-existing tests `ok`.

## Phase 2: Replace only at a path boundary

- [x] 2.1 Implement plan.md `## Approach` items 2–3 in `tests/harness-probe/probe.mjs`. Path entries (REPO, PROBE_WS, HOME) are normalized with `path.resolve` and sorted longest first. Each is compiled to an escaped `RegExp` with the lookahead `(?![A-Za-z0-9._-])` and replaced through a function. The username stays the last, unbounded `split/join`. Committed fixtures are not touched. — verify: `node --test tests/harness-probe/probe.test.mjs` exit 0, with the step 1.1 #145 test `ok` and every pre-existing test unchanged and `ok`; `git diff --name-only origin/main...HEAD -- tests/harness-probe/fixtures` prints nothing. Record the counts on this line.

Recorded 2026-11-05: `exit=0`, `# tests 24 / pass 24 / fail 0`; the #145 test is `ok 20 - makeSanitizeCtx replaces repo and HOME paths only at a path boundary (#145 fixture-sanitizer-path-boundary)`; `git diff --name-only origin/main...HEAD -- tests/harness-probe/fixtures` printed nothing.
- [ ] 2.2 Re-run plan.md `## Evidence` reproductions 1 and 2 against this branch, using a fresh `git archive HEAD` copy at `<dir>/agento` with `TMPDIR=<dir>` and `HOME=/home/u USER=u` for reproduction 2. Save the outputs, with `<dir>` normalized, as `evidence/after-collect-test.txt` and `evidence/after-sanitize-ctx.txt` in the issue's artifact directory, then delete the temp copy. — verify: reproduction 1 prints `ok 1 - collect sanitizes logs into fixtures and empties the log dir` and exits 0. Reproduction 2 shows `siblingWorktree` and `siblingDocs` without a `<REPO>-` prefix, `homeSibling` as `/home/u2/project`, and `insideRepo` as `<REPO>/scripts/agento.mjs`. `git status --porcelain` in the product worktree is clean. Record the results on this line.

## Phase 3: Docs, gate, resolution

- [ ] 3.1 Implement plan.md `## Approach` item 5. Add one short paragraph to `docs/copilot-harness.md` after the "Fixture files are the sanitized captures…" sentence (line ~168) on the placeholder rules: path entries are replaced longest first and only at a path boundary; the username is replaced last, everywhere. Add a `**Fixed.**` entry citing #145 at the top of `CHANGELOG.md` `## Unreleased`. — verify: `grep -n '#145' CHANGELOG.md` shows the entry, and `grep -n 'path boundary' docs/copilot-harness.md` shows the paragraph. `node --test tests/harness-probe/probe.test.mjs tests/customizations.test.mjs` exits 0. Record the counts on this line.
- [ ] 3.2 Run the full gate (§5) and compare it with the plan.md `## Research` baseline (942/942, shellcheck clean). — verify: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` exits 0 with fail 0, and the test count is 942 plus the new tests. `git ls-files '*.sh' | xargs pnpm dlx shellcheck` exits 0 with no findings. `git diff --name-only origin/main...HEAD -- scripts extension .github/hooks tests/harness-probe/fixtures` prints nothing. Record the results on this line.
- [ ] 3.3 Write plan.md `## Resolution`: the root cause (`scrubStrings` `split/join` with no boundary and a fixed order), what changed and why (the boundary lookahead, longest first, `path.resolve`, the username catch-all kept per Decision 2, the test seam), and proof (the step 2.1 #145 test `ok`, the step 2.2 evidence files). — verify: plan.md `## Resolution` names `tests/harness-probe/probe.mjs`, the #145 test name, and both `evidence/after-*.txt` files, and every relative link in plan.md resolves.
