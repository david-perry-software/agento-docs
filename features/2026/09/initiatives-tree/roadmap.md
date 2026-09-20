```yaml
status: complete
branch: feature/initiatives-tree
last-updated: 2026-09-20
next-step: ""
artifact-pr: "#9"
initiative: "agento-extension"
```

## Phase 1: Initiative model and provider

- [x] 1.1 Add a pure initiative-tree model that validates `initiative` list/detail responses, preserves CLI initiative order, groups members as Ready, In flight, Blocked, and Complete from supplied fields, formats compact rows/tooltips, and retains errors/anomalies as diagnostics — verify: `cd extension && npm run test:unit` passes with named cases for list/detail validation, group precedence/order, metadata, diagnostics, empty data, and malformed responses
- [x] 1.2 Add the Initiatives `TreeDataProvider` with initiative, group, member, diagnostic, empty, and error nodes; activate initiative/member nodes to open the CLI-supplied `breakdown.md` beside the active editor — verify: `cd extension && npm run typecheck && npm run test:unit` exits 0 with provider tests for hierarchy, context values, icons, path resolution, and open command arguments

## Phase 2: Extension integration and rendering

- [x] 2.1 Contribute `agento.initiatives` and its open-breakdown command, register and expose the provider from `extension/src/extension.ts`, and atomically refresh list plus concurrent detail calls from the shared scheduler with independent stale-result protection and output logging — verify: `cd extension && npm run build && npm run typecheck && npm run test:unit` exits 0; manifest/integration tests assert the view, command, exact CLI calls, stale-result rejection, retained Deliveries refresh, and absence of polling APIs
- [x] 2.2 Extend the Electron in-repo and companion fixtures with valid initiative breakdowns and member roadmaps; assert initiative counts plus Ready, In flight, Blocked, and Complete member rendering, tooltip blockers/waves/next, anomaly diagnostics, and opening `breakdown.md` beside the active editor — verify: local:no-ports — `cd extension && npm run test:electron` passes both named layout scenarios with the initiative rendering and beside-open assertions
- [x] 2.3 Extend Electron coverage for initiative refresh after a member roadmap mutation and explicit empty, malformed/error, and partially invalid detail states while retaining every Deliveries assertion — verify: local:no-ports — two consecutive `cd extension && npm run test:electron` runs pass for both layouts and report initiative refresh plus diagnostic-state assertions
- [x] 2.4 Diagnose and stabilize the companion Electron roadmap watcher so create/change events survive consecutive suite runs (added 2026-09-19) — verify: local:no-ports — the focused watcher test passes and two consecutive `cd extension && npm run test:electron` runs pass for both layouts without a missing roadmap event

## Phase 3: Documentation and final gate

- [x] 3.1 Document the read-only Initiatives view, hierarchy, metadata, breakdown navigation, refresh behavior, and diagnostics in `extension/README.md`; add an Unreleased changelog entry without changing versions — verify: documentation marker checks and `node --test tests/customizations.test.mjs` pass; all three manifests remain version `0.5.2`
- [x] 3.2 Integrate `origin/main` into both halves, recheck concurrent PR overlap, run the complete green lint/test/package gate, inspect scope, push product then companion, and set the roadmap to `in-review` — verify: `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` exits 0; `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` passes; both replay-guard commands pass; extension typecheck/unit tests pass; two consecutive Electron runs pass; `cd extension && npm run package` passes its archive assertion; diffs contain only planned extension/docs/artifact files; session reports both halves clean, synchronized, and `status: in-review`

## Follow-ups

- None yet.