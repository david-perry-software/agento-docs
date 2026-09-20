# New plan flow

## Problem

The Agento extension can launch commands that already exist in CLI state, but it
does not provide a guided way to begin planning new work. Users must manually run
`/agento start-session`, move to the new planning window, and then submit
`/agento new-feature <description>` or `/agento new-issue <description>`.

This feature implements the `new-plan-flow` member of the
[Agento extension initiative](../../../../initiatives/2026/09/agento-extension/breakdown.md#new-plan-flow).
It adds a guided feature/issue form and a ready-initiative-member action while
preserving the architecture boundary: the extension submits canonical commands and
observes CLI JSON, while Agento commands continue to own worktree and lifecycle
decisions.

## Decisions

- **Q: Where should users be able to launch the New plan flow?** A: "View title action", "Command Palette", and "Initiative member action".
- **Q: Should feature/issue selection and description be collected in one Quick Pick sequence or separate commands?** A: "Single guided sequence".
- **Q: How should the extension behave while waiting for the managed planning worktree to appear?** A: "Bounded wait with progress".
- **Q: If automatic window handoff fails after the worktree exists, what should the UI do?** A: "Offer retry and focus".
- **Q: What acceptance depth should this feature include?** A: "Unit plus Electron flow".

## Research

Skills consulted: none — no matching domain (AGENTS.md has no project skills table and the repository has no `.agents/skills/` directory).

- The initiative assigns this member to wave 4 and requires `command-dispatch` and
  `initiatives-tree`; `node scripts/agento.mjs initiative agento-extension` reports
  both complete and `new-plan-flow` ready with no blockers.
- `extension/src/commandDispatcher.ts` already persists a target-specific command
  before opening a folder or workspace, consumes it once on activation/focus, and
  offers a focus retry. `extension/src/pendingDispatch.ts` validates canonical
  commands, expires records after five minutes, and deletes before submission. The
  new flow should reuse these boundaries rather than introduce another transport.
- `extension/src/extension.ts` centralizes command registration, CLI calls,
  workspace opening, pending-command consumption, and refresh state. It is the
  integration point for a new command, QuickInput collection, bounded progress, and
  handoff coordination.
- `extension/src/initiativeTreePresentation.ts` already distinguishes ready members
  with context value `agento.initiativeMember.ready`, but member elements do not
  currently retain the parent initiative slug needed to build
  `/agento new-feature initiative:<initiative>/<member>`. The presentation data can
  carry that existing CLI identity without deriving readiness.
- `extension/package.json` contributes view-title and item-context menus and exposes
  command-palette commands. The new command can appear in all requested entry points
  through manifest wiring without adding a custom webview.
- The extension cannot read chat output. A testable orchestration service must take a
  before-snapshot of CLI `session`, submit `/agento start-session` in the primary,
  poll `session` at a bounded interval for one new managed `plan` worktree, resolve
  its companion workspace when present, then save and hand over the final planning
  command. Timeout, cancellation, ambiguity, and open failures must preserve a
  recoverable command and surface an explicit retry/focus action.
- Full-repository lint baseline: `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`
  exited 0 with no findings. The planned TypeScript and JSON files do not overlap
  shell lint, so the scoped gate is: lint every changed shell file if scope expands;
  run extension typecheck, unit and Electron tests; run focused new-flow tests; and
  rerun full shellcheck, root tests, and both replay guards. Only the clean baseline
  is acceptable.
- Additional baseline evidence: root tests passed 214/214; extension typecheck passed;
  extension unit tests passed 56/56 after `npm ci`; Electron in-repo and companion
  scenarios passed; both replay-guard modes exited 0.
- `gh pr list --state open --json number,headRefName,title,url` returned no open pull
  requests, so there is no current concurrent-delivery file overlap. The Builder
  must still merge `origin/main` before every push.

## Approach

Add a pure, dependency-injected new-plan orchestration module under `extension/src/`
that validates a one-line request, identifies the CLI-reported primary target,
records the existing managed worktrees, routes `/agento start-session` to the primary,
and performs a cancellable bounded wait for exactly one new managed planning
worktree. Once found, resolve the target folder or companion `.code-workspace`, write
the canonical follow-up through the existing pending-dispatch store, and open/focus
that target. Keep polling cadence and timeout explicit and testable; never parse chat
output or infer delivery lifecycle.

Wire one `Agento: New Plan` command into the Command Palette and view-title menus.
The command presents one guided sequence: choose Feature or Issue, then enter and
validate a non-empty single-line description. Add a context action to CLI-designated
ready initiative members that bypasses the generic form and constructs exactly
`/agento new-feature initiative:<initiative>/<member>`. Extend initiative tree
element data only enough to retain those two CLI-provided slugs.

Reuse the extension's existing `CliClient`, command submission, target opening,
pending store, output channel, and notification adapters. Expose the orchestration
through the extension API for deterministic Electron coverage. Unit tests cover
request construction, role/target handling, worktree detection, timeout,
cancellation, ambiguity, and retry behavior; Electron coverage proves the command
and ready-member entry points hand the exact canonical command to the existing
dispatch path.

Affected files are expected to include `extension/package.json`,
`extension/src/extension.ts`, `extension/src/initiativeTreePresentation.ts`, a new
`extension/src/newPlanFlow.ts`, corresponding unit tests under
`extension/test/unit/`, and `extension/test/electron/suite.ts`.

## Risks

- **Chat completion is not observable.** Detect only the CLI-visible appearance of a
  new managed plan worktree, with a bounded cancellable wait. On timeout, preserve
  the intended follow-up command and offer retry/focus rather than claiming failure
  of the Agento command.
- **Unrelated concurrent sessions may appear during the wait.** Diff CLI
  `worktrees[]` against the before-snapshot and require exactly one newly registered
  managed `dirPrefix: "plan"` entry. Treat multiple candidates as ambiguous and do
  not dispatch into any of them.
- **Companion workspaces can appear after the product worktree.** Wait for the CLI's
  target/workspace data to become usable before opening; prefer the `.code-workspace`
  only when the CLI reports it exists, otherwise use the product folder.
- **A stale request could submit later.** Reuse the existing target-specific,
  five-minute, consume-once pending record semantics and clear failed handoffs before
  offering retry.
- **Shared activation and manifest files are common delivery hotspots.** No open PRs
  currently overlap them; merge `origin/main` before every push and adapt to any new
  upstream wiring without duplicating command registration.

## Out of scope

- Reading or parsing Copilot Chat output, cancelling chat work, or deciding whether
  `/agento start-session` succeeded from a receipt.
- Creating worktrees, choosing lifecycle transitions, deriving initiative readiness,
  or running planner logic inside the extension.
- Multi-window Electron automation, Marketplace publishing, version changes, release
  documentation, or the initiative-wide acceptance fixtures; those remain in
  `extension-acceptance`.
- Changes to the Agento CLI, agents, prompts, hooks, or delivery semantics.

## Acceptance checklist

- [ ] `Agento: New Plan` is available from the Command Palette and Agento view-title UI, and presents one guided Feature/Issue then one-line-description sequence.
- [ ] A ready initiative member exposes a Plan action that retains CLI-provided initiative/member slugs and submits exactly `/agento new-feature initiative:<initiative>/<member>`; non-ready members do not expose it.
- [ ] Starting a plan from any window routes exactly `/agento start-session` to the CLI-reported primary target and never creates or mutates a worktree directly.
- [ ] The flow takes a pre-dispatch `session` snapshot, waits with cancellable bounded progress for exactly one new managed plan worktree, and rejects timeout, cancellation, and ambiguous candidates without dispatching to an arbitrary target.
- [ ] A discovered companion pair opens its CLI-reported `.code-workspace` when present, a product-only session opens its folder, and the target consumes the exact canonical new-feature/new-issue command once through the existing pending-dispatch mechanism.
- [ ] Failed or timed-out handoff visibly preserves recovery through retry/focus while stale pending records retain the existing five-minute expiry and consume-once guarantees.
- [ ] Focused unit tests cover form validation, canonical command construction, primary routing, worktree detection, workspace preference, timeout, cancellation, ambiguity, and retry/focus behavior.
- [ ] Electron tests exercise the generic command and ready-initiative-member entry point and observe the exact canonical command passed to the dispatch integration.
- [ ] The scoped gate is green: extension typecheck and all extension unit/Electron tests pass; root tests remain at least 214 passing; both replay guards pass; full shellcheck reports no findings; no changed shell file is left unlinted.
