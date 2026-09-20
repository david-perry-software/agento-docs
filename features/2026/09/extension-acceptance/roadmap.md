```yaml
status: in-review
branch: feature/extension-acceptance
last-updated: 2026-09-20
next-step: ""
artifact-pr: "#13"
initiative: "agento-extension"
```

## Phase 1: Acceptance fixtures

- [x] 1.1 Extend the existing Electron harness with deterministic generated in-repo and companion repositories carrying representative delivery lifecycle, PR, initiative, worktree, warning, doctor, and companion-sync state, with cleanup assertions and no committed Git metadata — verify: `cd extension && npm ci && npm run typecheck && npm run test:electron` creates, exercises, and removes both temporary scenarios

## Phase 2: End-to-end extension coverage

- [x] 2.1 Drive the contributed Deliveries and Initiatives trees, Session & Doctor view, and status bar in both generated layouts and assert the CLI-supplied lifecycle, progress, PR/companion PR, initiative, worktree, warning, doctor, and companion state — verify: `cd extension && npm run test:electron` passes both in-repo and companion scenarios (local: VS Code Electron, no ports)
- [x] 2.2 Drive contributed delivery actions and generic/initiative new-plan entry points through their registered commands, asserting exact canonical `/agento ...` text and the CLI-selected current-window dispatch target without executing agents or reading chat output — verify: `cd extension && npm run test:electron` passes dispatch-boundary assertions in both layouts (local: VS Code Electron, no ports)
- [x] 2.3 Add a bounded package smoke test that installs the generated VSIX into temporary user-data and extensions directories, launches it against a generated fixture, proves activation and expected Agento command/view contributions, and cleans the isolated profile — verify: `cd extension && npm run package && npm run test:vsix` passes with `agento-dashboard-0.6.0.vsix` (local: isolated VS Code profile, no ports)

## Phase 3: Documentation and release metadata

- [x] 3.1 Add `docs/extension.md` covering plugin-plus-VSIX installation, every view, refresh behavior, command routing, companion workspaces, recovery, and explicit limitations; align the extension developer README — verify: documented commands and setting names match `extension/package.json` and `extension/README.md` links resolve
- [x] 3.2 Link the extension guide from the root README and expand the architecture documentation with the packaged-extension, generated-fixture, and dispatch-boundary acceptance model — verify: README and architecture links resolve and describe only behavior exercised by the acceptance suite
- [x] 3.3 Bump root package, plugin, extension, and extension lock metadata from `0.5.2` to `0.6.0`, and add the complete extension release to `CHANGELOG.md` — verify: `node --test tests/customizations.test.mjs tests/extension-bundle.test.mjs && cd extension && npm run package` passes and produces `agento-dashboard-0.6.0.vsix`

## Phase 4: Release gate

- [x] 4.1 Run the complete release gate and fix only regressions introduced by this feature — verify: `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`; `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`; `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt`; `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt`; and `cd extension && npm run typecheck && npm run test:unit && npm run test:electron && npm run package && npm run test:vsix` all exit 0, the bundled CLI is byte-identical, all versions are `0.6.0`, and `git status --short` shows no generated profile or package debris beyond the intended VSIX policy