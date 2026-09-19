# Review: deliveries-tree

Verdict: approve

## Acceptance checklist results

- **Pass — lifecycle grouping.** `extension/src/extension.ts` invokes `status --pr`; `extension/src/deliveryTreeModel.ts` filters empty groups while preserving `lifecycles[]` order. `npm run test:unit` passed 21/21, including the named ordering/omission case, and the Electron host rendered Planned then Building in both layouts.
- **Pass — compact rows and complete metadata.** Model tests passed the exact row description and tooltip assertions for roadmap status, product/companion PRs, owner, workspace, companion checkout, and initiative. Four Electron runs also asserted compact descriptions and companion PR metadata.
- **Pass — roadmap activation.** `extension/src/deliveryTreeProvider.ts` uses only the CLI roadmap plus configured/CLI-supplied root and registers `agento.openRoadmap`; every Electron scenario verified the roadmap opened in `ViewColumn.Two` beside an editor in `ViewColumn.One`.
- **Pass — refresh and stale-response safety.** The provider is driven by the existing `RefreshScheduler`; no polling API was added. Unit tests passed for stale success and stale error suppression, and Electron mutation/watcher refresh assertions passed.
- **Pass — explicit empty/error states and output logging.** Model tests passed empty, malformed, warning, and CLI-error cases. Provider message rows and extension output writes are present; Electron scenarios asserted both explicit row kinds.
- **Pass — unit coverage.** `cd extension && npm run test:unit` passed 21/21, covering ordering, omission, metadata/null PRs, warnings, empty/error states, and both stale-refresh directions.
- **Pass — Electron coverage.** Four consecutive `cd extension && npm run test:electron` invocations passed. Each ran the in-repo and companion scenarios under VS Code 1.125.0 and reported beside-open, refreshed tree, empty/error rows, and watcher refresh; companion runs also asserted companion PR display.
- **Pass — package and documentation.** `npm run package` passed. Direct `unzip -Z1` inspection confirmed `deliveryTreeModel.js`, `deliveryTreeProvider.js`, and `latestDeliveryRefresh.js` in the VSIX. `extension/README.md` and `CHANGELOG.md` document the view; all manifests remain `0.5.2`.
- **Pass — full gate.** Shellcheck passed with no findings; root tests passed 214/214; both replay-guard modes passed; extension typecheck and unit tests passed; four Electron runs passed; packaging and archive inspection passed; `tests/customizations.test.mjs` passed 22/22.

## Plan vs implementation

The implementation follows the planned read-only boundary and changed only the expected extension source, tests, manifest, README, and root changelog. It consumes the CLI contract without re-deriving lifecycle or ownership, keeps refresh generation-local, and adds no polling, delivery mutation, command dispatch, or CLI behavior. Live `node scripts/agento.mjs status --pr` output was independently checked against the parser and returned the expected lifecycle order, PR metadata, companion checkout, owner/workspace, initiative, and no warnings.

The only minor deviation is test hardening: the packaged archive currently contains every new runtime module, but `extension/scripts/assert-vsix.mjs` does not add those modules to `requiredEntries`.

## Roadmap audit

- **1.1 valid.** Four consecutive Electron runs observed roadmap watcher refreshes in both fixture layouts.
- **1.2 valid.** The pure model and named unit coverage exist and pass.
- **1.3 valid.** The provider, beside-open command, API exposure, and stale-refresh tests exist; typecheck/unit checks pass.
- **2.1 valid.** The manifest contribution, provider registration, scheduler-driven `status --pr`, output logging, and absence of polling were inspected and tested.
- **2.2 valid.** Electron fixtures exercise in-repo and companion layouts, ordered groups, compact metadata, and companion PR data.
- **2.3 valid.** Four consecutive Electron runs passed beside-open, roadmap mutation refresh, explicit empty/error rows, and watcher behavior.
- **3.1 valid.** README/changelog markers are present, customization tests pass 22/22, and all three manifests remain version `0.5.2`.
- **3.2 valid.** Both branches contained current `origin/main` before review and were synchronized with their remotes. The full lint/test/guard/Electron/package gate passed, and product scope contains only planned files.

No false ticks, missing steps, or roadmap repairs were found.

## Findings

- **Minor — package regression assertion omits the new runtime modules.** `extension/scripts/assert-vsix.mjs` requires existing runtime files but not `out/deliveryTreeModel.js`, `out/deliveryTreeProvider.js`, or `out/latestDeliveryRefresh.js`. The reviewed VSIX does contain all three, so shipped behavior is correct; adding them to `requiredEntries` would prevent a future packaging configuration change from silently dropping the Deliveries implementation while `npm run package` still passes.
- No correctness, security, or blocking regression findings.

## Follow-ups

- Extend `extension/scripts/assert-vsix.mjs` to require the three Deliveries runtime modules in packaged archives.