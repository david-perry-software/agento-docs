```yaml
status: in-progress
branch: feature/session-doctor-panel
last-updated: 2026-09-19
next-step: "1.3 Integrate defaults and verify the model/provider phase"
artifact-pr: "#10"
initiative: "agento-extension"
```

## Phase 1: State models and presentation
- [x] 1.1 Add a pure model for `session --pr`, `doctor`, and `status --pr` that validates required fields, preserves warnings/detail/fallback text, formats optional companion/workspace state explicitly, and derives `Agento: <role> · <resumable.length> active` — verify: `cd extension && npm run build && tsc -p tsconfig.test.json && node --test out/test/unit/sessionDoctorModel.test.js`
- [ ] 1.1 Add a pure model for `session --pr`, `doctor`, and `status --pr` that validates required fields, preserves warnings/detail/fallback text, formats optional companion/workspace state explicitly, and derives `Agento: <role> · <resumable.length> active` — verify: `cd extension && npm run build && tsc -p tsconfig.test.json && node --test out/test/unit/sessionDoctorModel.test.js`
- [x] 1.2 Add the disposable Session & Doctor tree provider with grouped session, companion, warning, and doctor rows plus an inline error row whose command retries through `agento.refresh` — verify: `cd extension && npm run typecheck && npm run test:unit`
- [ ] 1.3 Integrate `origin/main` in both halves and push the verified model/provider step — verify: both default branches are ancestors; focused unit tests and `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` exit 0

## Phase 2: Extension integration and user-visible behavior

- [ ] 2.1 Wire one latest-only refresh snapshot for `session --pr`, `doctor`, and `status --pr` into the existing scheduler; refresh on activation, first view visibility, workspace/watch events, and `agento.refresh` without polling; update the provider and status bar together — verify: `cd extension && npm run typecheck && npm run test:unit`; source/manifest tests prove no `setInterval`
- [ ] 2.2 Contribute `agento.sessionDoctor` and its refresh title action under the Agento container, expose the panel/status item in the extension API for tests, and make the `Agento: <role> · <N> active` item focus the view without dispatching workflow or repair commands — verify: `cd extension && npm run test:unit`; manifest integration assertions pass
- [ ] 2.3 Extend the Electron fixtures and suite for session/companion fields, CLI warnings, every doctor field, status text/focus, manual refresh, latest-result behavior, and inline failure/retry rendering — verify: `local:3157/4157 — cd extension && npm run test:electron`
- [ ] 2.4 Integrate `origin/main` in both halves and push the verified extension behavior — verify: both default branches are ancestors; `cd extension && npm run typecheck && npm run test:unit && npm run test:electron` and shellcheck exit 0

## Phase 3: Documentation and final gate

- [ ] 3.1 Document the Session & Doctor view, manual refresh, read-only doctor output, and status-bar summary in `extension/README.md`; add the feature under `CHANGELOG.md` Unreleased — verify: documentation names `session --pr`, `doctor`, `status --pr`, and no repair behavior; `node --test tests/customizations.test.mjs` passes
- [ ] 3.2 Build and package the extension and verify the VSIX carries the new manifest contributions and runtime modules — verify: `cd extension && npm run typecheck && npm run test:unit && npm run test:electron && npm run package`
- [ ] 3.3 Integrate both defaults, run the complete clean-baseline gate, audit the diff against this plan, push both halves, and set `status: in-review` — verify: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`; both replay-guard smoke commands; shellcheck with zero findings; extension typecheck/unit/Electron/package checks; both PRs mergeable and both halves clean and synchronized

## Follow-ups

- None yet.