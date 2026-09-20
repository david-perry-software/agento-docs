# Initiatives Tree

## Problem

The Agento extension shows delivery state, but users still have to run the CLI or
open initiative artifacts manually to understand initiative progress, ready work,
blockers, and anomalies. This feature implements the `initiatives-tree` member of the
[Agento extension breakdown](../../../../initiatives/2026/09/agento-extension/breakdown.md#initiatives-tree):
a read-only Initiatives view driven entirely by `agento.mjs initiative` list and
detail responses, without re-deriving initiative state in the extension.

## Decisions

- **Q1: How should each initiative expand in the tree?** A: "The user is not available to respond and will review your work later. Work autonomously and make good decisions." Decision: group members under Ready, In flight, Blocked, and Complete headings so blockers and actionable work are easy to scan.
- **Q2: What should the member row prioritize?** A: "The user is not available to respond and will review your work later. Work autonomously and make good decisions." Decision: use the member slug as the label, with state, wave, and blocker details in the description and tooltip.
- **Q3: How should invalid initiatives, anomalies, and CLI failures appear?** A: "The user is not available to respond and will review your work later. Work autonomously and make good decisions." Decision: render diagnostic children with CLI-provided details while keeping unaffected initiatives visible.
- **Q4: Should this feature remain strictly read-only beyond opening breakdown.md?** A: "The user is not available to respond and will review your work later. Work autonomously and make good decisions." Decision: keep the initiative view read-only; selecting an initiative or member opens its breakdown beside the active editor, and command dispatch remains a later initiative member.

## Research

Skills consulted: none — no matching domain (the repository has no `.agents/skills/`
directory and no `## Agento` skills table in `AGENTS.md`).

**Initiative contract and readiness.** `node scripts/agento.mjs initiative
agento-extension` reports `initiatives-tree` as `unplanned`, `ready: true`, with its
required `extension-scaffold` and recommended predecessor `deliveries-tree` both
`complete`. The CLI implementation in `scripts/agento.mjs` already emits list rows
with `slug`, `dir`, `total`, `complete`, `inFlight`, `ready`, `done`, and `valid`.
The detail call adds the CLI-derived `features[]` state, `ready`, `blockedBy`, `wave`,
`next`, `errors`, `waves`, `initiative.breakdown`, and merged `anomalies`. No CLI
change is needed, and the extension must validate and render these fields rather than
infer dependency or readiness rules.

**Current extension surface.** `extension/src/extension.ts` owns the `CliClient`,
shared `RefreshScheduler`, configured artifact-root lookup, watcher lifecycle, and
Deliveries provider registration. Its refresh subscriber uses
`LatestDeliveryRefresh` to prevent stale asynchronous status results from replacing
newer state. `extension/src/deliveryTreeModel.ts` and
`extension/src/deliveryTreeProvider.ts` establish the local pattern: a pure parser
and display model, a thin `TreeDataProvider`, explicit empty/error rows, compact
labels, detailed tooltips, and a command that opens a CLI-supplied artifact path in
`ViewColumn.Beside`. The Initiatives view should follow that boundary with its own
model/provider while sharing the scheduler, watcher events, output channel, and
artifact-root map.

**Refresh and query shape.** One refresh first calls `initiative` to obtain the
ordered list, then calls `initiative <slug>` for each listed initiative to obtain
members, blockers, `next`, errors, and anomalies. The resulting snapshot is applied
atomically only if it is still current. Per-initiative invalid responses remain
renderable diagnostic state; a list-call failure becomes the view's explicit error
row. Existing roadmap and git watchers already cover changes that affect derived
initiative state, so no polling or new watcher class is required.

**Manifest, tests, and packaging.** `extension/package.json` currently contributes
only `agento.deliveries` plus refresh, output, and open-roadmap commands. The new view
and open-breakdown command must be declared there and registered from
`extension/src/extension.ts`. Pure tests under `extension/test/unit/` cover models,
manifest wiring, and stale refresh behavior. `extension/test/electron/runTest.ts`
already creates deterministic in-repo and companion repositories, while
`extension/test/electron/suite.ts` inspects providers exposed through `ExtensionApi`,
checks side-by-side artifact opening, refresh, and explicit empty/error rows. Those
fixtures can add initiative breakdowns and roadmaps without a second harness.

**Baseline (2026-09-19).** The full repository lint command from `AGENTS.md`,
`shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`, exits 0 with no findings.
`node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exits 0. After `npm ci`,
`cd extension && npm run typecheck && npm run test:unit` exits 0 with 21/21 tests,
and `npm run test:electron` passes both the in-repo and companion scenarios. The lint
baseline is green, so the final gate uses the full lint command; no scoped exception
is needed.

**Concurrent deliveries.** Product and companion `gh pr list --state open` calls
both return `[]`, so there is no current open-PR file overlap. Other detached planning
sessions exist but have published no delivery branches. The Builder still integrates
each repository's `origin/main` before every push and rechecks overlap if scope grows.

## Approach

Add `extension/src/initiativeTreeModel.ts` to validate the list and detail JSON and
produce a display model that preserves CLI initiative order and CLI-derived member
state. Initiative rows show `complete/total`, in-flight and ready counts, and done or
invalid status. Expanded initiatives group members into Ready, In flight, Blocked,
and Complete sections; rows show slug-first compact metadata, while tooltips expose
state, wave, blockers, readiness, and the CLI's next value. Errors and anomalies are
first-class diagnostic children using their verbatim CLI text.

Add `extension/src/initiativeTreeProvider.ts` as a thin VS Code adapter. Initiative
and member nodes resolve `initiative.breakdown` against the configured artifact root
and open it beside the active editor through a dedicated command. The provider does
not scan artifacts, parse breakdown dependencies, or offer lifecycle actions.

Wire an `agento.initiatives` contribution and provider into
`extension/src/extension.ts`. On each existing scheduler event, load the initiative
list and all detail records, then atomically update the provider through stale-result
protection independent of the Deliveries refresh. Log CLI failures and diagnostic
text to the existing Agento output channel. Keep the existing watcher and debounce
behavior unchanged.

Extend unit tests for JSON validation, state grouping, counts, labels/tooltips,
anomalies, invalid detail records, empty/error states, manifest registration, and
stale updates. Extend both Electron fixtures with initiative breakdowns and member
roadmaps, then assert rendering, blocker and anomaly visibility, breakdown opening,
refresh after roadmap mutation, and explicit empty/error rows in both layouts.
Document the read-only view in `extension/README.md` and `CHANGELOG.md`, and verify
the packaged VSIX includes the new contribution and runtime modules.

Expected product files are `extension/package.json`, `extension/src/extension.ts`,
new initiative model/provider modules under `extension/src/`, focused tests under
`extension/test/`, `extension/README.md`, and `CHANGELOG.md`. No changes to CLI
semantics, prompts, agents, hooks, templates, or root documentation are planned.

## Risks

- One list query fans out into one detail query per initiative. Run detail calls
  concurrently within a refresh, apply one atomic snapshot, and use latest-request
  protection so slow responses cannot overwrite newer state.
- Invalid initiatives return useful state with exit 3. Treat parseable detail JSON as
  displayable diagnostics rather than collapsing the entire tree; reserve a top-level
  error for a failed list call or malformed list response.
- Member state can fit more than one human-facing concern, especially ready versus
  blocked versus in flight. Define grouping only from CLI fields and state values,
  cover precedence in unit tests, and never recompute dependency readiness.
- Companion breakdowns live outside the product folder. Resolve only the CLI-supplied
  breakdown path against the configured artifact root and cover both layouts in
  Electron tests.
- Adding a second provider to the shared refresh path can regress Deliveries. Keep
  refresh state independent and retain all existing Deliveries assertions in unit and
  Electron suites.

## Out of scope

- Planning, build, autopilot, ship, close-session, or other command actions from the tree.
- Changes to `agento.mjs initiative`, dependency derivation, lifecycle semantics, or CLI JSON.
- The Session & Doctor panel, status bar, command dispatcher, or new-plan flow.
- Background polling, Marketplace publishing, extension version changes, or CI wiring.

## Acceptance checklist

- [ ] The Initiatives view loads `initiative` plus `initiative <slug>` detail and renders every initiative in CLI order with complete/total, in-flight, ready, done, and valid state.
- [ ] Expanded initiatives group member rows by CLI-supplied readiness/state, with slug-first descriptions and tooltips that expose wave, blockers, state, readiness, and `next` without re-deriving dependencies.
- [ ] CLI errors and anomalies appear as diagnostic tree children with verbatim details while healthy initiatives remain usable; list failures, malformed responses, and empty results have explicit view states.
- [ ] Activating an initiative or member opens its CLI-supplied `breakdown.md` in `ViewColumn.Beside` in both in-repo and companion layouts.
- [ ] Existing scheduler and watcher events refresh both trees without polling, stale initiative responses cannot replace newer state, and Deliveries behavior remains unchanged.
- [ ] Unit tests cover list/detail validation, group precedence and order, labels/tooltips, diagnostics, empty/error states, manifest wiring, and stale-refresh protection.
- [ ] Electron tests pass for in-repo and companion fixtures and verify initiative progress, ready/blocked/in-flight/complete members, anomalies, breakdown opening, roadmap-driven refresh, and explicit empty/error rows.
- [ ] Extension documentation and changelog describe the read-only Initiatives view, and the packaged VSIX contains its manifest contribution and runtime model/provider files.
- [ ] The complete gate passes: full shellcheck and root tests, both replay-guard modes, extension typecheck/unit tests, Electron tests, and VSIX package assertions.