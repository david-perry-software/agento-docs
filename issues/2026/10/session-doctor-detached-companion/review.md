# Review: session-doctor-detached-companion

Verdict: approve

Reviewed 2026-10-02 at product HEAD `84399c1`
(`issue/session-doctor-detached-companion`), companion half on
`issue/session-doctor-detached-companion` (`dirty: false`, `ahead: 0`), both with
`origin/main` an ancestor of HEAD. Code PR agento#76 (draft, `CLEAN`), companion
PR agento-docs#20 (draft, `CLEAN`), GitHub issue #75.

## Acceptance checklist results

1. **PASS — exposing regression test fails before the fix and passes after.**
   The test
   `session doctor model renders a detached companion as "detached" (#75 session-doctor-detached-companion)`
   exists in `extension/test/unit/sessionDoctorModel.test.ts` and is correctly
   named. I re-ran `npm run test:unit`: exit 0, `# tests 86`, `# pass 86`,
   `# fail 0` with this test `ok`. The before-fix failure is recorded in
   plan.md `## Resolution` and roadmap step 1.1 (`not ok 83`, `branch must be a
   non-empty string`); the git history confirms the order (test commit `49b0cfa`
   precedes fix commit `7558387`).

2. **PASS — `parseCompanion()` yields `"detached"` for `null` and still throws
   for missing/non-string.** `extension/src/sessionDoctorModel.ts` `parseCompanion()`
   now uses `branch: nullableString(companion, "branch") ?? "detached"`.
   `nullableString()` throws on `undefined` and on non-strings (verified in the
   helper at lines 85–92), so a missing or non-string `branch` still produces an
   error model. The regression test and the existing malformed-fields test both
   pass (`npm run test:unit` exit 0).

3. **PASS — compiled repro prints `"kind": "ready"` and `"branch": "detached"`.**
   I rebuilt the extension (`npm run test:unit` runs `npm run build`) and ran
   `node …/evidence/repro-detached-companion.mjs`: exit 0, `"kind": "ready"`,
   companion `"branch": "detached"`, `"state": "registered, detached, clean"`.
   My re-run is captured at `evidence/review-repro-output.json`.

4. **PASS — CHANGELOG Fixed bullet under `## Unreleased` referencing `#75`.**
   `grep -n '#75' CHANGELOG.md` hits one line; `## Unreleased` appears above
   `## 0.7.0`.

5. **PASS — scoped gate matches the recorded baseline.** Re-run myself:
   `npm run typecheck` exit 0; `npm run test:unit` exit 0 (`86` tests, `0` fail);
   `npm run test:electron` exit 0 (all three scenarios passed); repo
   `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → `259` pass,
   `0` fail; `npm run lint:hooks` exit 127 (`shellcheck: not found`, unchanged
   from baseline) with `git diff --name-only origin/main...HEAD` containing no
   `scripts/hooks/` or `scripts/wait-for-checks.sh` path. Captured in
   `evidence/review-verification.log`.

6. **PASS — diff touches only the three named files.** `git diff --name-only
   origin/main...HEAD` lists exactly `CHANGELOG.md`,
   `extension/src/sessionDoctorModel.ts`,
   `extension/test/unit/sessionDoctorModel.test.ts`;
   `git diff --stat origin/main...HEAD -- extension/src` shows
   `sessionDoctorModel.ts | 2 +-`.

7. **PASS — PR wiring.** Code PR body starts with `Fixes #75` and links the
   companion PR (`…/agento-docs/pull/20`); `gh pr view` shows `mergeStateStatus:
   CLEAN` for both PRs; `agento.mjs session --pr` reports `pr` #76 and
   `companionPr` #20 with the companion half `dirty: false`, `ahead: 0`.

## Plan vs implementation

No gaps. The one-line parser change is exactly the planned change; the regression
test and CHANGELOG bullet match the plan; no files beyond the three named ones
are touched; no undocumented behaviour changes found. The `## Resolution` section
is present and accurate.

## Roadmap audit

All six steps (`1.1`, `2.1`, `2.2`, `2.3`, `3.1`, `3.2`) are ticked and each was
spot-checked against the codebase and re-run outputs; none is falsely ticked. No
missing steps and no repairs were needed. The header is correct
(`status: in-review`, `branch: issue/session-doctor-detached-companion`,
`github-issue: #75`, `artifact-pr: #20`).

## Findings

1. **Minor — empty-string `branch` is accepted and rendered as `""`.** 
   `nullableString()` rejects `undefined` and non-strings but returns `""`
   unchanged, so `"" ?? "detached"` yields `""` rather than `"detached"` (and
   rather than the previous `requiredString` error). This exactly mirrors the
   pre-existing session-worktree treatment (`branch ?? "detached"`) that
   decision 1 asked for, and `sessionDoctorProvider.ts` renders it as a plain
   string row, so nothing breaks. Non-blocking; no change required.
   File: `extension/src/sessionDoctorModel.ts` `parseCompanion()`.

2. **Minor — no explicit test asserts a missing/non-string companion `branch`
   still throws.** The code guarantee holds (`nullableString` throws on
   `undefined` and non-strings), and the plan's Risk section points at the
   "rejects malformed required response fields" test — but that test does not
   actually exercise `companion.branch` (it covers `role: ""`, a doctor check
   missing `id`, and a non-array `resumable`). A one-line follow-up test would
   close the loop; the parser behaviour itself is correct, so this is
   non-blocking.
   File: `extension/test/unit/sessionDoctorModel.test.ts`.

## Follow-ups

- (none)
