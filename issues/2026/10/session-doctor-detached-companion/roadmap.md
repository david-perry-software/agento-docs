```yaml
status: complete
branch: issue/session-doctor-detached-companion
last-updated: 2026-10-02
next-step: ""
github-issue: "#75"
artifact-pr: "#20"
```

## Phase 1: Expose the defect

- [x] 1.1 Add a `test(...)` to `extension/test/unit/sessionDoctorModel.test.ts` named `session doctor model renders a detached companion as "detached" (#75 session-doctor-detached-companion)` that calls `createSessionDoctorModel({ ...session, companion: { ...session.companion, branch: null, detached: true, ahead: 0, behind: 0 } }, doctor, status)` and asserts `model.kind === "ready"`, `model.companion` deep-equals `{ path: "/repo/docs-worktree", branch: "detached", state: "registered, detached, clean", sync: "ahead 0, behind 0" }`, `model.session.branch === "feature/session-doctor-panel"`, `model.checks.length === 3`, and `model.actions.length === 4` — verify: `cd extension && npm run test:unit; echo "exit=$?"` prints `exit=1`, the TAP output names exactly that test `not ok` with `branch must be a non-empty string` in its failure detail, and every other test (85) is still `ok`

## Phase 2: Fix the parser

- [x] 2.1 In `extension/src/sessionDoctorModel.ts` `parseCompanion()`, change `branch: requiredString(companion, "branch")` to `branch: nullableString(companion, "branch") ?? "detached"`; leave `CompanionSummary`, `sessionDoctorProvider.ts`, and every other file untouched — verify: `cd extension && npm run typecheck` exits 0 and `git diff --stat origin/main...HEAD -- extension/src` lists only `sessionDoctorModel.ts` with a one-line change
- [x] 2.2 Rebuild and prove the exposing test and the captured reproduction now pass — verify: `cd extension && npm run test:unit; echo "exit=$?"` prints `exit=0` with `# tests 86`, `# fail 0`, and step 1.1's test `ok`; `node <companion.path>/issues/2026/10/session-doctor-detached-companion/evidence/repro-detached-companion.mjs` prints `"kind": "ready"` and, under `companion`, `"branch": "detached"` and `"state": "registered, detached, clean"`
- [x] 2.3 Add a **Fixed** bullet under `## Unreleased` in `CHANGELOG.md` (insert the `## Unreleased` heading above `## 0.7.0 (2026-10-02)` if absent; keep it if PR #74 has already added it) stating that the extension's Session & Doctor view rendered `Invalid Session & Doctor response: branch must be a non-empty string` in companion-mode planning windows whose companion half was detached, and now shows the companion `Branch` row as `detached` like the session worktree row (`#75`) — verify: `grep -n '#75' CHANGELOG.md` hits one line and `sed -n '1,6p' CHANGELOG.md` shows `## Unreleased` before `## 0.7.0`

## Phase 3: Gate and publish

- [x] 3.1 Scoped gate against the baseline recorded in plan.md `## Research` (typecheck 0 findings; 259 repo tests; 85 extension unit tests; shellcheck absent, exit 127): `cd extension && npm run typecheck && npm run test:unit && npm run test:electron`; `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`; `npm run lint:hooks; echo "exit=$?"`; `git diff --name-only origin/main...HEAD` — verify: typecheck exit 0; `test:unit` exit 0 with `# tests 86`, `# fail 0`; `test:electron` exit 0; repo tests `# pass 259`, `# fail 0`; `lint:hooks` either exit 0 with no findings or exit 127 (`shellcheck: not found`) with the diff listing no `scripts/hooks/` or `scripts/wait-for-checks.sh` path; the diff lists exactly `CHANGELOG.md`, `extension/src/sessionDoctorModel.ts`, `extension/test/unit/sessionDoctorModel.test.ts`
- [x] 3.2 Integrate and publish: `git merge origin/main` in the product half and `git -C <companion.path> merge origin/main` in the companion half (never rebase; resolve a `CHANGELOG.md` collision with PR #74 by keeping both bullets); push both; write plan.md `## Resolution` (root cause, the one-line change, the step 2.2 outputs proving the #75 test and repro pass); set `status: in-review` — verify: `gh pr view --json mergeStateStatus --jq .mergeStateStatus` is neither `BEHIND` nor `DIRTY` for the code PR and likewise from `<companion.path>` for the companion PR; the code PR body starts with `Fixes #75`; `node scripts/agento.mjs session --pr` reports `pr` and `companionPr` with the companion half `dirty: false`, `ahead: 0`

## Follow-ups

- (none yet)
