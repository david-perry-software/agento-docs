```yaml
status: in-progress
branch: feature/new-plan-flow
last-updated: 2026-09-19
next-step: "4.2 Reverify both contributed commands in the Electron scenarios"
artifact-pr: "#12"
initiative: "agento-extension"
```

## Phase 1: Orchestration

- [x] 1.1 Add focused unit tests for validated generic and initiative requests, primary routing, new managed-plan-worktree detection, companion workspace preference, timeout, cancellation, ambiguity, and retry/focus recovery — verify: `cd extension && npm run test:unit` passes with the new plan-flow cases listed
- [x] 1.2 Implement the dependency-injected bounded new-plan orchestrator by composing CLI session reads, canonical Chat submission, target-specific pending dispatch, and workspace opening without parsing chat output or mutating worktrees — verify: `cd extension && npm run typecheck && npm run test:unit`

## Phase 2: User entry points

- [x] 2.1 Add the guided Feature/Issue and one-line-description QuickInput flow, register `Agento: New Plan`, and contribute it to the Command Palette and Agento view-title menus — verify: `cd extension && npm run typecheck && npm run test:unit`
- [x] 2.2 Preserve CLI-provided initiative/member identity in ready member elements and add the ready-member Plan action that starts the same flow with `/agento new-feature initiative:<initiative>/<member>` — verify: `cd extension && npm run test:unit` passes manifest and initiative presentation assertions

## Phase 3: Integration and verification

- [x] 3.1 Add an Electron scenario for the generic command and ready initiative-member action, asserting the exact canonical follow-up reaches the dispatch integration — verify: `cd extension && npm run test:electron` passes for in-repo and companion scenarios
- [x] 3.2 Run the complete scoped gate and package assertion, fixing only regressions introduced by this feature — verify: `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`; `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` reports at least 214 passing; both `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` and `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` exit 0; `cd extension && npm run typecheck && npm run test:unit && npm run test:electron && npm run package` exits 0

## Phase 4: Review repairs

- [x] 4.1 Prevent cross-window startup from hanging before timeout or cancellation by making the focus notification non-blocking or bounding submission, with regression coverage (added 2026-09-19) — verify: `cd extension && npm run test:unit` passes a pending focus-notification regression case
- [ ] 4.2 Drive both contributed user-facing commands in Electron tests instead of calling the exported helper (added 2026-09-19) — verify: `cd extension && npm run test:electron` passes for in-repo and companion scenarios
- [ ] 4.3 Add distinct Focus target recovery unit coverage (added 2026-09-19) — verify: `cd extension && npm run test:unit` passes a dedicated Focus target recovery case