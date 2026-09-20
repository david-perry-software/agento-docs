# Session & Doctor Panel

## Problem

The Agento extension shows delivery roadmaps but does not show the current window's
session classification or the environment checks that determine whether workflow
commands can run. Users must leave the extension UI and invoke the CLI to see the
window role, worktree, branch, lifecycle, warnings, companion state, or doctor
fallbacks.

This feature implements the `session-doctor-panel` member from the
[Agento extension breakdown](../../../../initiatives/2026/09/agento-extension/breakdown.md#session-doctor-panel):
a read-only Session & Doctor view backed by `session --pr` and `doctor`, plus a status
bar summary backed by `status --pr`. The extension presents CLI state and fallbacks
without deriving workflow state or repairing the environment.

## Decisions

- **When should Session & Doctor data refresh?** On view open + manual refresh —
  fetch on activation/visibility and expose a refresh icon; no polling.
- **What should the status bar show in its compact form?**
  `Agento: <role> · <N> active` — show the current role and count of
  resumable/in-flight deliveries.
- **How should CLI failures be presented in the view?** Inline error + retry — keep
  the view available, show the command failure, and offer refresh/retry.
- **Should selecting the status bar item open/focus the Session & Doctor view?** Yes,
  focus the view — useful navigation only; no workflow command or repair action.

## Research

Skills consulted: none — no matching domain.

- `extension/src/extension.ts` owns activation, the shared `RefreshScheduler`, CLI
  refreshes, view registration,
  watcher rebuilding, and the exported Electron-test API. It currently refreshes
  only `status --pr` into the Deliveries tree, so Session & Doctor should join this
  owner instead of creating a polling loop or another process abstraction.
- `extension/src/cliClient.ts` already runs the bundled CLI with the workspace root,
  parses one JSON document,
  accepts the CLI's documented exit codes, and logs timing. The new view can consume
  `session --pr`, `doctor`, and `status --pr` through this client unchanged.
- `extension/src/deliveryTreeModel.ts` and `extension/src/deliveryTreeProvider.ts`
  establish the local pattern: validate unknown CLI JSON in a pure model, preserve
  warnings, then expose explicit ready/empty/error tree states through a disposable
  `TreeDataProvider`.
- `extension/package.json` contributes the Agento activity-bar container, Deliveries
  view, refresh command, and package
  scripts. The Session & Doctor view and its title action belong in the same
  container; the existing `agento.refresh` command remains the single manual refresh.
- `extension/test/electron/suite.ts` activates the real extension host, inspects
  exported providers, drives commands,
  and verifies ready/empty/error states. It is the appropriate user-visible rendering
  check for the new view and status item. Pure parsing and formatting belong in
  `extension/test/unit/` beside the existing delivery model tests.
- Live CLI samples on 2026-09-19 confirmed `session --pr` exposes role, worktree,
  branch, lifecycle, `warnings[]`, companion dirty/ahead/behind, and workspace;
  `doctor` exposes each check's `id`, `status`, `detail`, and nullable `fallback`;
  and `status --pr` exposes `resumable[]`. The current detached plan window produced
  the expected PR lookup warnings, providing a concrete warning-rendering case.
- Full-repository lint baseline: `shellcheck scripts/hooks/*.sh
  scripts/wait-for-checks.sh` exited 0 with no findings on 2026-09-19. The delivery
  therefore uses the normal full lint gate; no scoped exception is needed.
- Concurrent-delivery audit: `gh pr list --state open --json
  number,headRefName,title,url` found product PR #52 (`feature/initiatives-tree`).
  `gh pr diff 52 --name-only` and `gh pr view 52 --json files` reported no changed
  product files at planning time. Because both deliveries extend the same VS Code
  container, anticipated hotspots are `extension/package.json`,
  `extension/src/extension.ts`, and Electron integration tests even though the live
  diff is empty.
- Stable local verification ports are `WEB_PORT=3157` and `API_PORT=4157`. The
  extension host does not serve either port, but user-visible checks retain the
  delivery's `local:3157/4157` target and run through `@vscode/test-electron`.

## Approach

1. Add a pure Session & Doctor model that validates the three CLI responses and
   produces presentation-ready session fields, warning rows, doctor check rows, and
   the status-bar text. Preserve doctor `detail` and `fallback` strings verbatim;
   represent missing optional values explicitly rather than guessing them.
2. Add a disposable tree provider with session, companion, warnings, and doctor
   groups. Its error state is an inline tree item that invokes `agento.refresh`, so a
   failed CLI call remains visible and retryable without a notification-only path.
3. Extend activation to refresh `session --pr`, `doctor`, and `status --pr` through
   the existing `CliClient` and scheduler, discard stale refresh results using the
   established latest-refresh pattern, update the tree and status bar together, and
   refresh when the view first becomes visible. Do not add timers or repair actions.
4. Contribute `agento.sessionDoctor` under the existing Agento view container, place
   the existing refresh command in that view's title menu, and make the status item
   focus the view. Keep stable dimensions and concise labels through native VS Code
   tree/status-bar APIs.
5. Cover malformed and complete CLI responses with unit tests. Extend the manifest
   integration test and Electron suite to verify visible session fields, warnings,
   doctor status/detail/fallback, the compact status text, focus behavior, manual
   refresh, and inline failure/retry behavior.
6. Update the extension README and changelog, then run the extension build, unit,
   Electron, and package checks plus the repository Node tests, replay guards, and
   clean shell lint baseline.

Expected product files include `extension/src/extension.ts`, new focused model and
provider modules under `extension/src/`, `extension/package.json`, tests under
`extension/test/unit/` and `extension/test/electron/`, `extension/README.md`, and
`CHANGELOG.md`. No CLI source or generated `extension/cli/` behavior changes are
planned.

## Risks

- `initiatives-tree` may begin changing the shared manifest, activation module, or
  Electron suite after this plan is published. Mitigation: fetch and merge
  `origin/main` before every push in both repositories, preserve both view
  registrations during conflict resolution, and rerun focused and Electron checks.
- Three CLI calls can complete out of order during rapid watcher/manual refreshes.
  Mitigation: treat the session/doctor/status result as one refresh snapshot and
  apply it only when it is still the latest request.
- Doctor failures and degraded checks are valid display data, while spawn/parse
  failures are transport errors. Mitigation: model CLI check statuses separately
  from provider error state and test both paths.
- The compact status text can become misleading if it counts all roadmap items.
  Mitigation: derive `<N>` only from the CLI-owned `status.resumable[]` array and
  derive role only from `session.role`.
- Electron UI assertions can become timing-sensitive. Mitigation: wait on provider
  change events with bounded timeouts and assert exported state before rendered
  labels, following the existing suite.

## Out of scope

- Running repairs, installs, authentication, or workflow commands from doctor rows.
- Re-deriving roles, lifecycle, warnings, resumability, or fallback text in the
  extension.
- Periodic polling, background daemons, or notifications for routine refresh errors.
- Per-delivery command actions and cross-window routing; those belong to the
  `command-dispatch` initiative member.
- Changes to `scripts/agento.mjs` or the bundled CLI contract.

## Acceptance checklist

- [ ] The Agento container includes a Session & Doctor view that renders CLI-owned
  role, worktree, branch, lifecycle, warnings, workspace, and companion state,
  verified by unit model tests and `npm run test:electron` at `local:3157/4157`.
- [ ] Every doctor check renders its `id`, `status`, `detail`, and `fallback` verbatim,
  including an explicit empty fallback, verified by fixtures covering ok, warn, and
  fail checks.
- [ ] The status bar reads `Agento: <role> · <N> active`, where role comes from
  `session.role` and count from `status.resumable.length`, and selecting it focuses
  the Session & Doctor view in the Electron host.
- [ ] Activation/view visibility and `agento.refresh` update the panel without
  polling; stale results cannot overwrite newer state; CLI transport/parse failures
  render inline with a working retry action.
- [ ] `cd extension && npm run typecheck && npm run test:unit && npm run
  test:electron && npm run package` passes and the VSIX contains the new runtime
  modules and manifest contributions.
- [ ] The final full gate matches the clean lint baseline: shellcheck has no findings,
  root Node tests and both replay guards pass, and both product and companion branches
  contain their current default branches before review.