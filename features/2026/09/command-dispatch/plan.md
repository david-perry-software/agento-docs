# Command Dispatch

## Problem

The Agento extension is currently read-only: delivery nodes open roadmaps, but users
must still type every canonical command into Copilot Chat and manually find the
window that owns the next lifecycle step. This feature implements the
`command-dispatch` member of the
[Agento extension breakdown](../../../../initiatives/2026/09/agento-extension/breakdown.md#command-dispatch):
data-driven actions in delivery context menus and the Session view, in-window Chat
submission, and safe handoff to the primary or owning secondary window.

The CLI remains the authority for which commands are legal and where they run. The
extension renders and routes CLI records; it does not reproduce the lifecycle table,
mark pull requests ready, merge, or infer ownership.

## Decisions

- **Q1: Where should dispatch actions appear in this feature?** A: "Context menus + session view (Recommended)"
- **Q2: How should pending cross-window dispatch behave when the target window is already open?** A: "Focus and auto-submit (Recommended)"
- **Q3: What expiry should pending cross-window dispatch records use to avoid stale commands firing later?** A: "5 minutes (Recommended)"
- **Q4: For this member, should Electron tests cover only in-window dispatch as scoped by the initiative, leaving cross-window routing to pure unit tests?** A: "Keep initiative scope (Recommended)"
- **Q5: How should this plan handle the not-yet-implemented Session view?** A: "Sequence after session panel (Recommended)"

## Research

Skills consulted: none — no matching domain (the repository has no `.agents/skills/`
directory and no `## Agento` skills table in `AGENTS.md`).

**Initiative state and sequencing.** `node scripts/agento.mjs initiative
agento-extension` reports `command-dispatch` as `unplanned`, `ready: true`; its hard
dependencies `cli-dashboard-json` and `deliveries-tree` are complete. The preferred
predecessor `session-doctor-panel` remains unplanned. Per Decision Q5, implementation
must wait until that member reaches `status: complete`, then integrate its public
Session-view model/provider rather than creating a competing view here.

**Current extension ownership.** `extension/src/extension.ts` creates the `CliClient`,
refresh scheduler, output channel, and Deliveries provider, runs `status --pr`, and
registers commands. `extension/src/deliveryTreeProvider.ts` owns delivery `TreeItem`s;
every delivery currently has context value `agento.delivery` and only the
`agento.openRoadmap` activation command. `extension/src/deliveryTreeModel.ts`
validates CLI data but currently retains only the fields needed to render the row,
so action context must preserve the CLI-supplied type, slug, branch, owner, workspace,
and command arrays. `extension/package.json` contributes only refresh, output, and
open-roadmap commands and has no view/item menus.

**CLI contract and gap.** `scripts/session-state.mjs` is the sole lifecycle permission
table. `deriveAllowed()` emits `allowed[]` for the current window and `elsewhere[]`
with `command`, `window`, and `reason`; those rows cover start-session, planning,
build, review, ship, close-session, continue, and status, but currently omit the
legal unattended `/agento ap <slug>` alternative. `scripts/agento.mjs status --pr`
already emits each delivery's CLI-derived lifecycle, owner, workspace, PR state, and
companion state, but does not emit per-delivery `allowed[]`/`elsewhere[]`. Adding
those stable fields in the CLI, including `ap` in the applicable build/plan lifecycle
rows, keeps the extension from maintaining a second command matrix. Existing keys
and exit codes remain unchanged.

`agento.mjs next <slug>` already returns the one legal transition as
`next.invocation`, `next.window`, and `next.target { path, workspace }`. The router
can call it at dispatch time and use its target rather than resolving worktree
ownership itself. Cross-window dispatch can replace the selected concrete action
with `/agento continue <slug>` as required by the initiative, leaving final command
selection and window checks to the target window.

**VS Code integration and tests.** `workbench.action.chat.open` accepts a query and
agent mode for same-window submission. The existing `ExtensionApi` exposes providers
to `extension/test/electron/suite.ts`, which tests both in-repo and companion
fixtures. Pure extension tests live under `extension/test/unit/` and use `node:test`;
they are the appropriate place for command-record validation, primary/secondary
target selection, five-minute expiry, workspace-file preference, primary-only ship,
and pending-record consumption. Electron scope remains in-window submission per
Decision Q4. Cross-window state uses an `ExtensionContext.globalState` pending record,
consumed on activation or when the target window gains focus; stale or mismatched
records are deleted without submission.

**Lint and test baseline (2026-09-19 at `c2104aa`).** The full repository shell lint
`shellcheck scripts/hooks/delivery-guard.sh scripts/hooks/replay-guard.sh
scripts/hooks/session-context.sh scripts/wait-for-checks.sh` exits 0 with no findings.
`node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` passes 214/214. Both
replay-guard fixture commands exit 0. After `npm ci` (317 packages, zero
vulnerabilities), `npm --prefix extension run test:unit` passes 21/21,
`npm --prefix extension run test:electron` passes the in-repo and companion
scenarios, and `npm --prefix extension run package` passes the VSIX archive
assertion. The baseline is green; no scoped lint gate is needed.

**Concurrent deliveries.** `gh pr list --state open --json
number,headRefName,title` returns `[]` in both `david-perry-software/agento` and
`david-perry-software/agento-docs`, so there was no published PR overlap at research
time. A later session check shows active planning worktrees for `initiatives-tree`
and `session-doctor-panel`; both are expected to touch extension integration and
tests. The Builder must integrate both `origin/main` branches before every push.
Because `session-doctor-panel` will touch `extension/src/extension.ts`,
`extension/package.json`, and Electron tests first, sequencing after its merge is
mandatory rather than treating that overlap as concurrent work; reassess the
`initiatives-tree` diff after it publishes and integrate it before implementation.

## Approach

First complete and integrate `session-doctor-panel`. Then extend the CLI's existing
permission data rather than encoding command names in the extension: add `/agento ap
<slug>` to the build/review-capable `allowed[]` rows and add per-delivery
`allowed[]`/`elsewhere[]` to `status --pr`, computed by `deriveAllowed()` from each
item's CLI-derived lifecycle and owner role. Update CLI tests and documentation, copy
the changed CLI modules into `extension/cli/`, and preserve every existing field and
exit code.

Add pure extension modules for action parsing and routing. The action model validates
and preserves command text, order, window, and reason exactly as supplied by the CLI;
it rejects malformed or non-canonical entries and never carries a hard-coded list of
Agento lifecycle commands. The routing model accepts a selected action plus the
`next <slug>` result and returns one of: submit here, open the primary folder, open
the owning secondary workspace/folder, or reject with the CLI's reason. It enforces
that ship targets the primary, prefers `/agento continue <slug>` for cross-window
handoff, and treats an existing `.code-workspace` as the preferred secondary target.

Add a thin VS Code dispatcher. Same-window actions call
`workbench.action.chat.open` with the canonical command as `query` and `mode:
"agent"`. Cross-window actions write a target-keyed pending record with command and
timestamp to `globalState`, open/focus the CLI-supplied folder or workspace with
`vscode.openFolder`, and expose a notification action that focuses the target while
the chat runs. The target extension instance consumes a matching record once on
activation or focus, atomically deletes it before submission, and discards records
older than five minutes. Failures remain visible through the Agento output channel
and a concise VS Code error message; commands and secrets are not logged beyond the
non-secret canonical invocation selected by the user.

Wire one generic dynamic-actions command into `extension/package.json`, delivery
node context menus, and the Session view supplied by `session-doctor-panel`. A
QuickPick or action child list is populated only from the current record's
`allowed[]` and `elsewhere[]`, with the CLI-provided window and reason in its label
and detail. Delivery action requests carry their slug and call `next <slug>` before
routing, so stale UI state is revalidated immediately. The extension does not expose
a statically maintained build/review/ship menu.

Unit tests cover the additive CLI contract, exact action projection, malformed
records, every routing target, AP availability, primary-only ship, pending-record
matching/expiry/consume-before-submit, and workspace preference. Electron tests
stub `workbench.action.chat.open` and verify a Session action and a delivery action
submit the exact canonical query in agent mode in both fixture layouts. Update
`extension/README.md`, `docs/architecture.md`, and `CHANGELOG.md`; keep the version at
`0.5.2` because the initiative defers release/versioning until all members complete.

Expected product files are `scripts/session-state.mjs`, `scripts/agento.mjs`, their
tests and bundled copies, `docs/commands.md`, `extension/package.json`,
`extension/src/extension.ts`, delivery and Session provider/model files, new action
and dispatch modules under `extension/src/`, extension unit/Electron tests,
`extension/README.md`, `docs/architecture.md`, and `CHANGELOG.md`.

## Risks

- `session-doctor-panel` is not complete and overlaps the exact integration files.
  Do not begin implementation until its roadmap is complete; then merge both
  defaults and adapt this plan to its shipped provider API without duplicating it.
- `initiatives-tree` is also active and likely to touch extension activation,
  manifest, and Electron fixtures. Inspect its published diff and integrate it before
  editing those shared files.
- VS Code has no public API for sending a command directly into another window.
  Keep the pending record target-specific, consume it only on activation/focus,
  delete before submitting, and expire it after five minutes so a stale command
  cannot fire later.
- `globalState` visibility across already-open extension hosts may vary with VS Code
  process timing. Isolate storage access behind a testable adapter, trigger reads on
  window-focus events, and fail visibly without submitting if the target cannot
  observe a matching record. Multi-window Electron automation remains out of scope,
  so this is residual risk documented for manual exploratory verification before
  review.
- Adding `ap` and per-item command arrays changes shared CLI JSON consumed by prompts
  and the extension. Keep the change additive, derive it from the existing table,
  retain ordering, and cover every role/lifecycle row in root tests.
- A node can become stale between refresh and click. Always rerun `next <slug>` at
  dispatch time and honor its current status/reason instead of trusting rendered
  ownership or lifecycle.

## Out of scope

- Creating the Session & Doctor view itself; that belongs to the sequenced
  `session-doctor-panel` member.
- The New Plan form or initiative-member launch flow; those belong to
  `new-plan-flow`.
- Reading chat output, parsing receipts, cancelling another window's chat request,
  or reporting progress beyond roadmap/git refreshes.
- Marking pull requests ready, merging, teardown semantics, Marketplace publishing,
  extension version changes, or CI wiring for Electron tests.
- Replacing agents, prompts, hooks, or lifecycle derivation in the extension.

## Acceptance checklist

- [ ] `status --pr` exposes each delivery's CLI-derived `allowed[]` and `elsewhere[]`, applicable build/review session rows expose `/agento ap <slug>`, and all existing JSON fields and exit codes remain compatible.
- [ ] Delivery context menus and the Session view render actions in CLI order with the exact command, window, and reason supplied by `allowed[]`/`elsewhere[]`; no TypeScript lifecycle-command matrix exists.
- [ ] Selecting an in-window action submits its canonical text through `workbench.action.chat.open` with agent mode and does not execute lifecycle work inside the extension.
- [ ] Selecting a cross-window action revalidates `next <slug>`, prefers `/agento continue <slug>`, opens/focuses the CLI-supplied primary folder or owning secondary `.code-workspace`/folder, and never routes ship outside the primary.
- [ ] Pending dispatch records are target-specific, consumed once before submission on activation/focus, expire after five minutes, and stale, malformed, mismatched, or failed handoffs are surfaced without submitting.
- [ ] A focus-target affordance is available after cross-window dispatch while the extension neither reads chat output nor attempts remote cancellation.
- [ ] Unit tests cover CLI action metadata, exact action projection, malformed records, all routing outcomes, primary-only ship, workspace preference, and pending-record expiry/consumption.
- [ ] Electron tests pass in both fixture layouts and prove Session and delivery actions submit the exact in-window canonical query in agent mode.
- [ ] Extension and architecture documentation describe the action sources, routing, expiry, companion workspace behavior, and limitations; the VSIX contains every runtime dispatch module.
- [ ] The full green baseline is preserved: shellcheck, 214+ root tests, both replay-guard modes, extension typecheck/unit tests, both Electron scenarios, and VSIX package assertions.