# Review: initiatives-tree

Verdict: request-changes

## Acceptance checklist results

- Pass — The Initiatives view loads the list and detail CLI calls in order and renders CLI-supplied progress and validity. Evidence: `extension/src/extension.ts`, `extension/src/initiativeTreeModel.ts`; `cd extension && npm run typecheck && npm run test:unit` passed 32/32 tests; the first Electron run passed both layouts.
- Pass — Members are grouped by supplied state/readiness with slug-first descriptions and complete metadata tooltips. Evidence: `extension/src/initiativeTreeModel.ts`, `extension/src/initiativeTreePresentation.ts`; focused unit tests and the first Electron run passed.
- Pass — Per-initiative errors and anomalies remain visible while healthy initiatives remain usable, and explicit list empty/error states render. Evidence: model tests passed; the first Electron run passed partial-invalid, malformed, empty, and error assertions in both layouts.
- Pass — Initiative and member activation opens the CLI-supplied breakdown beside the active editor in both layouts. Evidence: provider unit tests and the first Electron in-repo and companion scenarios passed.
- Pass — The shared scheduler refreshes both trees, stale initiative results are rejected independently, and Deliveries remains populated. Evidence: unit stale-refresh test passed; roadmap-driven initiative refresh and retained Deliveries assertions passed in both layouts before the later companion timeout.
- Pass — Unit coverage includes list/detail validation, grouping precedence/order, metadata, diagnostics, explicit states, manifest wiring, and stale refresh. Evidence: `npm run test:unit` passed 32/32 tests.
- Fail — The Electron suite is not stable across the required repeated execution. Evidence: the first `npm run test:electron` passed both layouts; on the immediately repeated command, in-repo passed but companion failed with `Timed out waiting for roadmap refresh; observed: none` from `waitForRoadmapRefresh` in `extension/test/electron/suite.ts`.
- Pass — Documentation and changelog describe the read-only view, and VSIX packaging includes the manifest contribution plus model, presentation, and provider runtime files. Evidence: all three manifests report `0.5.2`; `npm run package` and its 13-entry archive assertion passed.
- Fail — The complete gate requires two consecutive Electron passes, but the second run exited 1 in the companion scenario. Other gate components passed: shellcheck, 214 root tests, both replay-guard modes, extension typecheck/unit tests, VSIX packaging, and diff whitespace validation.

## Plan vs implementation

The implementation matches the planned model/provider/integration/documentation scope, including the additional `initiativeTreePresentation.ts` extraction. No CLI semantics, hooks, prompts, templates, or version numbers changed. The only unmet plan requirement is repeatable Electron verification across both layouts.

Skills consulted: none — no matching domain. The repository has no `.agents/skills/` directory and no `## Agento` skills table in `AGENTS.md`.

## Roadmap audit

- Steps 1.1, 1.2, 2.1, 2.2, and 3.1 remain supported by code inspection and reviewer-run checks.
- Step 2.3 was falsely ticked because its verify clause requires two consecutive Electron passes; unticked after the second reviewer run failed in the companion scenario.
- Step 3.2 was falsely ticked because the complete gate includes the same consecutive Electron requirement; unticked and `next-step` now names the failed stability check.
- No manual or post-ship steps exist, and no missing roadmap step was found.

## Findings

- Major — The required Electron stability gate is flaky in the companion layout. The second consecutive `cd extension && npm run test:electron` run exited 1 after `waitForRoadmapRefresh` observed no create/change event across three writes (`extension/test/electron/suite.ts`, `waitForRoadmapRefresh`; watcher registration in `extension/src/watchers.ts`). This blocks approval because roadmap steps 2.3 and 3.2 explicitly require two consecutive passes and a missing verification is a failed verification. Stabilize the watcher/test interaction and demonstrate two consecutive green runs.
- No additional correctness, path-handling, or security findings were identified in the model, provider, refresh fan-out, or breakdown-opening paths.

## Follow-ups

- None. The blocking Electron stability work belongs in this delivery.