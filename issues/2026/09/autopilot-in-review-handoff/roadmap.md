```yaml
status: in-progress
branch: issue/autopilot-in-review-handoff
last-updated: 2026-09-20
next-step: "3.1 Re-run targeted command-dispatch tests for touched extension routing/handoff behavior"
github-issue: "#60"
artifact-pr: "#16"
```

## Phase 1: Reproduce and expose

- [x] 1.1 Add an exposing regression test for in-review `/agento ap` re-send that demonstrates unattended review chaining is broken, and reference `#60` and `autopilot-in-review-handoff` in the test name or header comment — verify: test fails before fix via `node --test scripts/agento.test.mjs --test-name-pattern "60|autopilot|in-review|review"`
- [x] 1.2 Add extension-side routing coverage for the same in-review autopilot path when command dispatch is touched — verify: `cd extension && npm ci && npm run test:unit`

## Phase 2: Implement targeted fix

- [x] 2.1 Update autopilot in-review orchestration so `/agento ap <slug>` directly invokes Reviewer unattended instead of surfacing a manual review command — verify: `node --test scripts/agento.test.mjs --test-name-pattern "in-review|autopilot|review"`
- [x] 2.2 Align Builder/Reviewer handoff metadata and related routing semantics required for Autopilot chaining, without changing ship authority boundaries — verify: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`

## Phase 3: Validate policy and regression safety

- [ ] 3.1 Re-run targeted command-dispatch tests for touched extension routing/handoff behavior — verify: `cd extension && npm run test:unit`
- [ ] 3.2 Re-run full repository script tests — verify: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`
- [ ] 3.3 Re-run lint baseline and confirm no new findings — verify: `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`
- [ ] 3.4 Set roadmap to `status: in-review`, update `next-step`, and publish final build commit set for review handoff — verify: `node scripts/agento.mjs session --pr`
