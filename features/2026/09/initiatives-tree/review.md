# Review: initiatives-tree

Verdict: approve

## Acceptance checklist results

- Pass — The Initiatives view loads `initiative` and concurrent `initiative <slug>` detail calls, preserves CLI order, and renders CLI-supplied progress and validity. Evidence: `extension/src/extension.ts`, `extension/src/initiativeTreeModel.ts`; `npm run typecheck` and 36/36 unit tests passed; both Electron suites passed both layouts.
- Pass — Members are grouped from supplied state/readiness with slug-first labels and wave, blocker, readiness, state, and next metadata. Evidence: `extension/src/initiativeTreeModel.ts`, `extension/src/initiativeTreePresentation.ts`; focused model/presentation tests and both Electron suites passed.
- Pass — Per-initiative errors and anomalies remain visible with healthy initiatives, while malformed lists, empty lists, and transport errors have explicit states. Evidence: model tests passed; both Electron suites passed the partial-invalid, malformed, empty, and error assertions in both layouts.
- Pass — Initiative and member activation opens the CLI-supplied breakdown beside the active editor in both layouts. Evidence: provider tests passed; both Electron suites verified the path against the in-repo or companion artifact root and opened it in `ViewColumn.Two`.
- Pass — Existing scheduler and watcher events refresh both trees without polling, stale initiative detail fan-out cannot replace newer state, and Deliveries remains populated. Evidence: `extension/src/extension.ts`; scheduler and stale-refresh unit tests passed; both Electron suites passed roadmap-driven initiative and delivery refresh assertions in both layouts.
- Pass — Unit coverage exercises list/detail validation, grouping precedence and order, metadata, diagnostics, empty/error states, manifest wiring, and stale refresh. Evidence: `cd extension && npm run test:unit` passed 36/36 tests.
- Pass — Electron coverage is stable for in-repo and companion fixtures. Evidence: two immediately consecutive `cd extension && npm run test:electron` commands exited 0; each reported both named scenarios passing initiatives, deliveries, roadmap refresh, diagnostics, stale/error handling, and breakdown navigation.
- Pass — Documentation and changelog describe the read-only view, and the packaged VSIX contains its contribution and runtime files. Evidence: `extension/README.md` and `CHANGELOG.md`; all three manifests remain `0.5.2`; `npm run package` passed, direct archive inspection found `initiativeTreeModel.js`, `initiativeTreePresentation.js`, and `initiativeTreeProvider.js`, and the packaged manifest contains `agento.initiatives` plus `agento.openBreakdown`.
- Pass — The complete gate is green. Evidence: shellcheck exited 0; 214/214 root tests passed; both replay-guard modes exited 0; extension typecheck and 36/36 unit tests passed; two consecutive Electron suites exited 0; packaging and direct VSIX assertions passed; `git diff --check origin/main...HEAD` exited 0.

## Plan vs implementation

The implementation matches the planned model, provider, integration, Electron coverage, and documentation scope. The additional `initiativeTreePresentation.ts` extraction keeps VS Code-independent presentation logic unit-testable. No CLI semantics, hooks, prompts, templates, or version numbers changed.

Round 2 repairs the prior companion watcher test defect in commit `0814768`: the create-event probe now writes under `expectedArtifactRoot` instead of always writing under the product fixture, and the watched `features/2026/09/x` directory exists before extension activation. The assertion still requires a real create/change reason from the configured watcher. This exercises the external companion `RelativePattern` path without racing directory discovery and does not weaken production watcher behavior or the test timeout.

Skills consulted: none — no matching domain. The repository has no `.agents/skills/` directory and no `## Agento` skills table in `AGENTS.md`.

## Roadmap audit

- All eight ticks are supported by code inspection and reviewer-run checks; no roadmap repair was required.
- Step 2.4 is satisfied independently: its focused `waitForRoadmapRefresh` create-event assertion passed for both layouts in each of two consecutive full Electron suite runs, including the external companion artifact root.
- Steps 2.3 and 3.2 are now correctly ticked because the same two consecutive Electron suites and the complete gate passed.
- The product and companion branches contain `origin/main`; both worktrees were clean before this review edit, the companion matched its remote, PR #52 was `CLEAN` with its CI check successful, and the other open product PR had no changed-file overlap.
- No manual or post-ship steps exist, and no missing-work step was found.

## Findings

- None. No correctness, regression, path-handling, security, or verification findings remain.

## Follow-ups

- None.