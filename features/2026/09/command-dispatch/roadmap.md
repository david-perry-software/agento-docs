```yaml
status: paused
branch: feature/command-dispatch
last-updated: 2026-09-19
next-step: "1.1 Resume after session-doctor-panel reaches status: complete, then merge both origin/main branches and identify its shipped Session provider/model integration points"
artifact-pr: "#11"
initiative: "agento-extension"
```

## Phase 1: Prerequisite and CLI contract

- [ ] 1.1 Wait for `session-doctor-panel` to reach `status: complete`, then merge both `origin/main` branches and identify its shipped Session provider/model integration points — verify: `node scripts/agento.mjs initiative agento-extension` reports `session-doctor-panel` state `complete`, and product plus companion branches contain both defaults
- [ ] 1.2 Add `/agento ap <slug>` to applicable CLI permission rows and expose per-delivery `allowed[]`/`elsewhere[]` from `status --pr` without changing existing fields or exit codes — verify: focused `scripts/session-state.test.mjs` and `scripts/agento.test.mjs` cases pass for every affected role/lifecycle and status item
- [ ] 1.3 Copy the changed CLI modules into the extension bundle and document the additive action metadata — verify: `npm --prefix extension run build` and `node --test tests/extension-bundle.test.mjs` pass

## Phase 2: Pure action and routing model

- [ ] 2.1 Implement validated action projection that preserves CLI command order, window, and reason with no lifecycle-command matrix in TypeScript — verify: focused extension unit tests pass for allowed, elsewhere, AP, empty, and malformed records
- [ ] 2.2 Implement pure dispatch routing for here, primary, and secondary targets, including `.code-workspace` preference, primary-only ship, and cross-window `/agento continue <slug>` preference — verify: focused extension unit tests pass for every target and rejection outcome
- [ ] 2.3 Implement target-keyed pending records with atomic consumption and a five-minute expiry — verify: focused extension unit tests pass for activation/focus consumption, duplicate prevention, stale, malformed, and mismatched records

## Phase 3: VS Code integration

- [ ] 3.1 Register generic dynamic action commands and add delivery context-menu plus shipped Session-view action surfaces backed only by CLI records — verify: extension manifest/integration unit tests prove both surfaces expose CLI-ordered commands and no static lifecycle menu
- [ ] 3.2 Submit same-window actions through `workbench.action.chat.open` in agent mode and report failures without executing lifecycle work — verify: `local:no-ports` Electron in-repo and companion fixtures submit the exact selected canonical query
- [ ] 3.3 Persist cross-window handoffs, open/focus the CLI target folder or workspace, consume on target activation/focus, and offer a focus-target affordance — verify: routing/adapter unit tests pass and `local:no-ports` exploratory Extension Host checks cover primary and companion workspace targets with no stale submission

## Phase 4: Documentation and full verification

- [ ] 4.1 Document command sources, routing, pending expiry, companion behavior, and cross-window limitations in extension and architecture docs; add an unreleased changelog entry without changing version `0.5.2` — verify: documentation references match the implemented commands/settings and all three version sources remain `0.5.2`
- [ ] 4.2 Run the full repository and extension gate, package the VSIX, and compare with the green planning baseline — verify: shellcheck exits 0; 214+ root tests pass; both replay-guard modes exit 0; extension typecheck and unit tests pass; both Electron scenarios pass; `npm --prefix extension run package` passes