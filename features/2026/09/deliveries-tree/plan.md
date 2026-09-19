# Deliveries Tree

## Problem

The Agento extension currently contributes only an empty Overview view. Users still
have to read `/agento delivery-status` output or inspect roadmap files to understand
delivery lifecycle, progress, pull requests, worktree ownership, and initiative
membership. This feature implements the `deliveries-tree` member of the
[Agento extension breakdown](../../../../initiatives/2026/09/agento-extension/breakdown.md#deliveries-tree):
a read-only tree driven by `status --pr`, without re-deriving CLI state in the
extension.

## Decisions

- **Q1: Should the tree show all lifecycle groups, or only groups containing deliveries?** A: "Non-empty groups only"
- **Q2: What should be visible directly in each delivery row?** A: "Slug + compact status"
- **Q3: When a delivery node is clicked, where should roadmap.md open?** A: "Beside current editor"
- **Q4: How should CLI errors and an empty delivery list appear in the tree?** A: "Explicit tree messages"

## Research

Skills consulted: none — no matching domain (the repository has no `.agents/skills/`
directory and no `## Agento` skills table in `AGENTS.md`).

**Prerequisites and CLI contract.** `node scripts/agento.mjs initiative
agento-extension` reports `deliveries-tree` as `unplanned`, `ready: true`, with
`cli-dashboard-json` and `extension-scaffold` both `complete`. A live `status feature
extension-scaffold --pr` call confirms the additive contract the view consumes:
top-level `lifecycles[]` and `warnings[]`; per-item `type`, `slug`, `roadmap`,
`status`, `steps`, `lifecycle`, `owner`, `workspace`, `companion`, `pr`,
`companionPr`, and `initiative`. Complete items intentionally have null PR fields.
The extension must render these values as supplied and must not infer lifecycle,
ownership, or PR state.

**Current extension surface.** `extension/package.json` contributes the `agento`
Activity Bar container and placeholder `agento.overview` view. `extension/src/extension.ts`
constructs the `CliClient`, `RefreshScheduler`, output channel, and roadmap/review/git
watchers; its refresh subscriber currently runs only `session` and logs a summary.
`extension/src/cliClient.ts` returns parsed CLI JSON without interpretation.
`extension/src/refreshScheduler.ts` provides the existing immediate and debounced
refresh signal. These are the owning integration points; no CLI or watcher polling
change is needed.

**Test surface.** Pure extension tests compile from `extension/test/unit/` and run
under `node:test`. `extension/test/electron/runTest.ts` creates an isolated git
fixture and launches VS Code 1.125.0; `extension/test/electron/suite.ts` already
asserts activation, CLI access, and a roadmap watcher event. The delivery can expose
the provider through the existing `ExtensionApi` so Electron tests inspect rendered
tree nodes without relying on private VS Code internals. The Electron launcher can
prepare and run both in-repo and companion-layout fixtures.

**Lint and test baseline (2026-09-19).** The full repository lint command from
`AGENTS.md`, `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`, exits 0 with
no findings. The full root test command passes 214/214. After `cd extension && npm
ci`, extension typecheck exits 0 and unit tests pass 10/10. The Electron activation
test fails twice consecutively because no roadmap watcher event reaches its existing
assertion (`Timed out waiting for roadmap refresh; observed: none`). This failure
overlaps the scheduler/watcher and Electron-test surface required here, so reliable
watcher readiness is an explicit prerequisite in scope; it is not waived. The lint
baseline is green, so the final gate remains the full lint command rather than a
scoped gate.

**Concurrent deliveries.** `gh pr list --state open --json number,headRefName`
returns `[]` in both the product and companion repositories. There are no open-PR
file overlaps. The Builder still integrates `origin/main` into both halves before
every push, per the concurrent-delivery policy.

## Approach

Add a pure delivery-tree model module under `extension/src/` that validates the
minimum `status --pr` shape, maps items into non-empty lifecycle groups in the exact
`lifecycles[]` order, and produces compact row metadata plus complete tooltip text.
Unknown or malformed responses become an explicit error model; a successful empty
response becomes an explicit empty model. CLI `warnings[]` remain visible and are
also written verbatim to the Agento output channel.

Add a thin VS Code `TreeDataProvider` that adapts the model to lifecycle and delivery
items. Lifecycle groups are non-collapsible only when appropriate for the testable
UX, delivery labels use the slug, descriptions carry compact type/progress/status/PR
state, and tooltips include both PRs, owner/workspace, companion state, and initiative
when present. Delivery nodes execute a dedicated open-roadmap command using
`ViewColumn.Beside`. The provider resolves each CLI-supplied relative roadmap path
against the CLI result's artifact root/configured checkout context; it does not scan
for roadmaps or derive state.

Replace the placeholder view contribution with a Deliveries view and wire it in
`extension/src/extension.ts`. Each scheduler event invokes `status --pr` for the
first product workspace folder, updates the provider atomically, logs warnings or
errors, and preserves the scheduler's existing debounce. Prevent an older overlapping
CLI call from replacing newer state. Keep refresh and show-output commands intact.

Add pure model tests for lifecycle ordering, omission of empty groups, every compact
and tooltip field, null PRs, warnings, malformed data, and empty data. Extend the
Electron harness with deterministic readiness and fixture repositories for both
in-repo and companion layouts; assert rendered groups/items, companion PR metadata,
refresh after a roadmap change, explicit empty/error rows, and opening `roadmap.md`
beside the active editor. Update `extension/README.md` and `CHANGELOG.md`, then package
the VSIX so the contribution and runtime files are checked in the shipped artifact.

Expected product files are `extension/package.json`, `extension/src/extension.ts`,
new model/provider modules under `extension/src/`, unit and Electron tests/fixtures
under `extension/test/`, `extension/README.md`, and `CHANGELOG.md`. No changes to
`scripts/`, prompts, agents, hooks, templates, or delivery semantics are planned.

## Risks

- The existing Electron watcher assertion is red in this worktree. Stabilize watcher
  readiness before adding rendering assertions, then require repeated green runs so
  the new UI tests do not conceal the baseline failure.
- `status --pr` may be slower than `session` and may return warnings when `gh` cannot
  resolve a PR. Keep the previous rendered model until the newest call completes,
  show CLI-provided warnings, and expose hard errors as a tree row plus output detail.
- Dense delivery metadata can make rows unreadable. Keep only slug and compact status
  inline; put ownership, workspace, companion, initiative, and URLs in the tooltip.
- Companion roadmaps live outside the product folder. Resolve only the path supplied
  by the CLI/config context and cover both layouts in Electron fixtures; do not add
  an independent artifact-discovery algorithm.
- Refresh events can overlap asynchronous CLI calls. Use a monotonically increasing
  request generation or equivalent serialization so stale results cannot win.

## Out of scope

- Tree actions beyond opening `roadmap.md`, command dispatch, or cross-window routing.
- The Initiatives tree, Session & Doctor panel, status bar, or new-plan flow.
- Changes to `status --pr`, lifecycle derivation, PR lookup, or ownership semantics.
- Marketplace publishing, extension version changes, or CI wiring for Electron tests.

## Acceptance checklist

- [ ] The Deliveries view calls `status --pr` and renders only non-empty lifecycle groups in the exact CLI `lifecycles[]` order.
- [ ] Every delivery row shows its slug and compact type/progress/roadmap/PR state, while its tooltip exposes PR, companion PR, owner/workspace, companion, and initiative data supplied by the CLI.
- [ ] Activating a delivery opens its CLI-supplied `roadmap.md` in `ViewColumn.Beside` without scanning for or re-deriving delivery state.
- [ ] Scheduler events and the Refresh command update the tree without polling or allowing stale CLI responses to replace newer state.
- [ ] Empty results and CLI/malformed-response failures produce explicit tree rows; CLI warnings and errors are recorded in the Agento output channel.
- [ ] Unit tests cover model ordering, omission, metadata, warnings, empty/error states, and stale-refresh protection.
- [ ] Electron tests pass against in-repo and companion fixtures, including companion PR display, roadmap refresh, and side-by-side opening; the pre-existing watcher timeout is repaired and four consecutive runs pass.
- [ ] The VSIX contains the Deliveries contribution and runtime provider/model files, and extension documentation/changelog describe the read-only view.
- [ ] The full gate passes: shellcheck, 214+ root tests, both replay-guard modes, extension typecheck/unit tests, Electron tests, and VSIX package assertions.
