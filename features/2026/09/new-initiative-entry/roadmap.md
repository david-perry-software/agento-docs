```yaml
status: in-progress
branch: feature/new-initiative-entry
last-updated: 2026-09-20
next-step: "1.2 Implement the dependency-injected initiative-intake model without shell execution or lifecycle logic"
artifact-pr: "#14"
```

## Phase 1: Intake model

- [x] 1.1 Add focused tests for initiative request construction, primary target resolution, multi-line preservation, repository-relative path normalization/containment, cancellation, and invalid input — verify: `cd extension && npm run test:unit` runs the new initiative-intake cases with the expected assertions
- [ ] 1.2 Implement the dependency-injected initiative-intake model without shell execution or lifecycle logic — verify: `cd extension && npm run typecheck && npm run test:unit`

## Phase 2: Extension integration
- [ ] 2.1 Contribute and register `Agento: New Initiative`, replace New Plan only in the Initiatives title bar, and implement the Enter brief plus Pick a file interactions — verify: `cd extension && npm run typecheck && npm run test:unit` passes manifest, prompt, cancellation, and validation assertions
- [ ] 2.2 Dispatch both intake forms to the fresh CLI-reported primary target through `dispatchCommandToTarget()`, preserving exact text/path arguments and existing pending/focus behavior — verify: focused dispatcher and initiative-flow unit tests pass for current-primary, cross-window, missing-primary, and failed-dispatch cases

## Phase 3: User-visible verification

- [ ] 3.1 Drive the contributed title command through both intake choices and assert the exact Agent-mode query and primary target behavior in supported Extension Host fixtures — verify: `local:no-ports` `cd extension && npm run test:electron` passes in-repo and companion scenarios
- [ ] 3.2 Run the complete repository and extension gate and compare it with the green planning baseline — verify: `npm run lint:hooks`; `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`; both `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` and `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt`; `cd extension && npm run typecheck && npm run test:unit && npm run test:electron && npm run package` all exit 0