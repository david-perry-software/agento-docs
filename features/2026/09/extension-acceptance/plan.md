# Extension acceptance and release readiness

## Problem

The Agento VS Code extension now has deliveries and initiatives trees, a Session &
Doctor view, command routing, and a guided new-plan flow, but the initiative does not
yet have a single release gate proving those pieces work together in both supported
artifact layouts. The repository also lacks end-user extension documentation and a
release version that identifies the first complete, installable dashboard.

This feature implements the `extension-acceptance` member of the
[Agento extension initiative](../../../../initiatives/2026/09/agento-extension/breakdown.md#extension-acceptance).
It adds end-to-end acceptance coverage, automated isolated-profile VSIX installation
proof, extension documentation, and the lockstep `0.6.0` release metadata without
changing the extension's runtime behavior or Agento's delivery semantics.

## Decisions

- **Q: How deep should the acceptance suite drive command workflows?** A: "Dispatch boundary (Recommended)".
- **Q: How should in-repo and companion acceptance fixtures be maintained?** A: "Generated deterministic fixtures (Recommended)".
- **Q: What lockstep version should mark the first releasable VSIX?** A: "Next minor version (Recommended)".
- **Q: Should acceptance require manually installing the built VSIX and plugin in a clean VS Code profile?** A: "Automate with isolated profile (Recommended)".

Interpretation: Electron acceptance drives the contributed UI and verifies the exact
canonical command and CLI-selected target at the dispatch boundary; it does not run
Copilot agents or read chat output. Temporary repositories are generated for every
test run. The package, plugin, and extension versions move together from `0.5.2` to
`0.6.0`. Installation and activation evidence is machine-produced, so no manual step
is required.

## Research

Skills consulted: none — no matching domain (AGENTS.md has no project skills table and the repository has no `.agents/skills/` directory).

- The initiative reports every dependency complete and `extension-acceptance` ready
  with no blockers. Its scope is tests, documentation, packaging, and versioning;
  runtime view and routing behavior belongs to the completed prerequisite members.
- `extension/test/electron/runTest.ts` already creates deterministic temporary Git
  repositories and runs the Electron suite once in-repo and once with a companion
  artifact checkout. The acceptance work should extend this harness and its fixture
  builders rather than commit `.git` metadata or add a parallel fixture framework.
- `extension/test/electron/suite.ts` already exposes helpers for waiting on all three
  views and exercises delivery, initiative, Session & Doctor, dispatch, and new-plan
  integration. Acceptance cases can drive contributed commands and inspect the
  exported extension API at the dispatch boundary without attempting to automate
  Copilot agent execution.
- `extension/src/extension.ts` composes the CLI client, all three providers, status
  bar, watcher refresh, action dispatch, pending handoff, and new-plan orchestration.
  Activation through this public integration point is the appropriate packaged
  extension smoke check; production source behavior should not need modification.
- `extension/scripts/assert-vsix.mjs` already validates required archive entries,
  excluded development files, and license bytes after `vsce package`. The isolated
  profile test can build on this packaging boundary by installing the generated VSIX
  into temporary user-data and extensions directories and proving activation.
- `extension/package.json` provides `build`, `typecheck`, `test:unit`,
  `test:electron`, and `package`; the three lockstep manifests currently report
  `0.5.2` in `package.json`, `extension/package.json`, and
  `.claude-plugin/plugin.json`. The next minor release is `0.6.0`; the extension lock
  file must remain consistent with its manifest.
- `extension/README.md` documents the implemented views and routing for developers,
  while the root `README.md` has no extension installation flow. `docs/architecture.md`
  describes the extension boundary but not installation, view behavior, or acceptance
  support. A dedicated `docs/extension.md` should be the user-facing source linked by
  both surfaces.
- Full-repository lint baseline: `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`
  exited 0 with no findings. No scoped exception is needed; the final gate requires
  the same clean result and lints any shell file added to scope.
- The existing Electron command reached its build step but could not establish a
  behavioral baseline in this fresh worktree because dependencies are not installed:
  `cd extension && npm run test:electron` exited 127 at `tsc: not found`. The Builder
  must run `npm ci` before the planned extension checks; this is an environment setup
  condition, not a waived test failure.
- `gh pr list --state open --json number,headRefName --limit 100` returned no open
  product pull requests, so there is no current concurrent-delivery overlap. The
  Builder still merges `origin/main` before every push.

## Approach

Extend the existing Electron scenario builder to generate richer but deterministic
in-repo and companion repositories. Populate lifecycle, pull-request, initiative,
worktree, companion sync, warning, and doctor states through files and command stubs
that the bundled CLI consumes. Keep fixtures temporary and assert cleanup so tests
remain isolated and repeatable.

Add acceptance cases to the current Electron suite that drive the contributed view
commands and inspect rendered tree/provider state for Deliveries, Initiatives,
Session & Doctor, and the status bar in both layouts. Exercise the existing action
picker, in-window command submission, and new-plan entry points through their
registered commands, asserting exact canonical `/agento ...` text and CLI-selected
targets. Stop at the dispatch boundary: cross-window agent execution and chat-output
inspection remain outside the public VS Code API and outside this feature.

Add a package-level smoke script that creates isolated user-data and extension
directories, installs the generated VSIX with the VS Code test distribution or its
CLI, launches the extension host against a generated fixture, and proves the packaged
extension activates and contributes its Agento views and commands. Compose this with
the existing archive assertions so package contents and installability are both
release gates, with temporary profiles removed after each run.

Write `docs/extension.md` as the user guide for installing the plugin and VSIX,
understanding each view, launching and routing commands, companion behavior,
refreshing state, and known boundaries. Link it from `README.md` and
`docs/architecture.md`, keep `extension/README.md` aligned where developer setup is
concerned, add the release entry to `CHANGELOG.md`, and bump all lockstep manifests
and the extension lock file to `0.6.0`.

Expected files include `extension/test/electron/runTest.ts`,
`extension/test/electron/suite.ts`, fixture helpers under `extension/test/fixtures/`,
an install-smoke script under `extension/scripts/`, `extension/package.json`,
`extension/package-lock.json`, `extension/README.md`, `docs/extension.md`,
`README.md`, `docs/architecture.md`, `CHANGELOG.md`, root `package.json`, and
`.claude-plugin/plugin.json`. Runtime files under `extension/src/` are changed only
if an acceptance test exposes a genuine integration defect.

The lint baseline is green, so the gate is the full documented shell lint plus root
tests, both replay guards, extension typecheck/unit/Electron tests, VSIX packaging,
isolated-profile install/activation smoke, bundle identity, and lockstep version
assertions. Any new shell file is included in shellcheck rather than hidden behind a
changed-files-only check.

## Risks

- **Electron and install tests depend on a downloaded VS Code runtime.** Pin the same
  VS Code version already used by the harness, reuse the downloaded distribution,
  isolate user-data/extensions directories, bound process lifetimes, and always clean
  temporary state. Network setup is explicit through `npm ci`; verification itself
  must not depend on an authenticated user profile.
- **Chat execution cannot be observed reliably.** Assert exact canonical text and
  CLI-selected routing at the injected command boundary, then stop. Do not parse chat
  output or attempt full agent workflows in Electron.
- **Companion fixtures can accidentally test paths rather than behavior.** Generate
  real Git repositories and artifact configuration for each run, assert both product
  and companion state in the rendered model, and verify cleanup after both scenarios.
- **Version metadata can drift.** Update all three manifests and the extension lock
  file in one step, then rely on the existing lockstep and bundle tests plus VSIX
  filename/archive assertions.
- **Release documentation can overstate automation.** State that packaging produces a
  VSIX but Marketplace publishing, remote chat cancellation, and chat receipt parsing
  remain out of scope.
- **Concurrent changes may appear after planning.** No open PR currently overlaps the
  expected files; integrate `origin/main` before every push and adapt tests/docs to the
  merged implementation rather than overwriting newer work.

## Out of scope

- Changing the behavior or visual design of the existing extension views and actions,
  except to repair a defect directly exposed by acceptance coverage.
- Running complete Planner, Builder, Reviewer, Autopilot, or Ship agents from Electron
  tests; reading chat output; or cancelling chat in another window.
- Marketplace publishing, CI wiring for Electron tests, or release automation beyond
  producing and validating the VSIX.
- Changes to CLI lifecycle semantics, agent prompts, hooks, or artifact formats.

## Acceptance checklist

- [ ] Deterministic generated repositories cover both in-repo and companion layouts without committed Git metadata or leaked temporary profiles.
- [ ] Electron acceptance drives the contributed Deliveries and Initiatives trees, Session & Doctor view, and status bar against both layouts and verifies lifecycle, progress, PR/companion PR, initiative, worktree, warning, doctor, and companion-sync state supplied by the CLI.
- [ ] Electron acceptance drives contributed action and new-plan entry points and observes the exact canonical command and CLI-selected current-window target at the dispatch boundary without parsing chat output or running an agent.
- [ ] The packaged `agento-dashboard-0.6.0.vsix` passes archive assertions, installs into an isolated VS Code profile, activates against a generated fixture, and contributes the expected Agento views and commands.
- [ ] `docs/extension.md`, the root README, extension README, and architecture documentation accurately explain installation, views, refresh, routing, companion mode, and documented limitations.
- [ ] `CHANGELOG.md` records the first complete extension release and `package.json`, `extension/package.json`, `.claude-plugin/plugin.json`, and the extension lock file agree on version `0.6.0`.
- [ ] The complete gate is green after `npm ci`: extension typecheck, unit tests, both Electron layouts, VSIX package/install smoke, root tests, both replay guards, bundle identity, lockstep checks, and full shellcheck with no findings.