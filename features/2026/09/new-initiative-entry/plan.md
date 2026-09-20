# New Initiative Entry

## Problem

The Agento extension's Initiatives view can display initiative progress and launch
planning for ready members, but it has no direct way to create an initiative. Users
must leave the view and type `/agento new-initiative <brief | path>` in the primary
window themselves.

Add a **New Initiative** title-bar action that gathers either a multi-line brief or a
repository-relative brief file and submits the canonical command in the primary
window. The extension remains a thin launcher: `/agento new-initiative` continues to
own validation, decomposition, git, and publication.

## Decisions

- **Q: Which native interaction should the plan use for entering a multi-line brief?** A: "Untitled editor (Recommended)"
- **Q: Use `new-initiative-entry` as the feature slug?** A: "Yes (Recommended)"
- **Q: After editing the untitled brief, how should the user submit it?** A: "Notification action (Recommended)"
- **Q: Where may “Pick a file” select the repository-relative brief?** A: "Primary repository only (Recommended)"

## Research

Skills consulted: none — no matching domain (the repository has no `.agents/skills/`
directory and no `## Agento` skills table in `AGENTS.md`).

- `extension/package.json` owns the Initiatives view and its title actions. It
  currently contributes `agento.newPlan` to all three Agento views, so the
  Initiatives-specific entry can replace that title placement without removing New
  Plan from the Command Palette, Deliveries, or Session & Doctor.
- `extension/src/extension.ts` centralizes command registration, QuickInput prompts,
  CLI session reads, primary-window discovery, target opening, and the shared pending
  dispatch store. It already composes `dispatchCommandToTarget()` for cross-window
  New Plan handoffs.
- `extension/src/commandDispatcher.ts` is the existing transport boundary. It submits
  immediately through `workbench.action.chat.open` when the primary is current, or
  saves a target-keyed pending command and opens/focuses the target when another
  window owns it. The new action should reuse this function rather than create a
  second pending-command mechanism.
- `extension/src/newPlanFlow.ts` demonstrates dependency-injected parsing of CLI
  `session` records and selection of the unique product worktree whose role is
  `primary`. Initiative intake can use the same CLI-owned identity rule without
  starting a planning worktree.
- VS Code's native `InputBox` is single-line. A native multi-line flow therefore
  needs an untitled text document; a non-modal notification action can submit the
  captured document's current text or cancel without requiring the document to be
  saved.
- `extension/test/unit/newPlanFlow.test.ts` and
  `extension/test/unit/extensionIntegration.test.ts` establish the pure request,
  manifest, and routing test style. `extension/test/electron/suite.ts` already drives
  contributed commands through injected prompt/runner seams in both in-repo and
  companion fixtures.
- Full-repository lint baseline: `npm run lint:hooks` ran
  `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` and exited 0 with no
  findings on 2026-09-20 at `d519622`. The planned extension-only files do not overlap
  shell lint; the delivery must still rerun it and additionally run extension
  typecheck, unit tests, Electron tests, package assertions, root tests, and both
  replay guards.
- `gh pr list --state open --json number,headRefName` returned `[]`; there is no
  concurrent open-PR overlap at planning time.

## Approach

Add a small dependency-injected initiative-intake module under `extension/src/`.
It will build exactly `/agento new-initiative <argument>`, reject empty editor text,
resolve the unique CLI-reported product primary checkout, convert a selected file
inside that checkout to a normalized repository-relative path, and reject files
outside it. Inline brief text is passed as Chat query text, not shell-quoted or
executed by the extension, so embedded newlines remain part of the command argument.

Register `Agento: New Initiative` in `extension/src/extension.ts` and contribute it
with an add icon to the Initiatives view title in `extension/package.json`. Replace
the generic New Plan placement only for that view; retain New Plan in the Command
Palette and the other Agento title bars. The command first offers **Enter brief** and
**Pick a file**. Enter brief opens an untitled text document and a Submit/Cancel
notification; Submit reads the captured document, validates it, and dispatches.
Pick a file starts at the primary repository, accepts one regular file inside it,
and dispatches its relative path. Cancellation at any prompt is a no-op.

Route both forms through `dispatchCommandToTarget()` and the existing pending store,
target opener, focus affordance, and current-target detection. Read a fresh CLI
`session` before dispatch so invocation from a secondary window opens the unique
primary checkout, while invocation in the primary submits directly to Copilot Chat
in Agent mode. Surface invalid session data, empty briefs, out-of-repository files,
document-read failures, and dispatch failures through the existing output/error
channels without submitting a partial command.

Add focused pure unit tests for exact command construction, multi-line preservation,
primary-target selection, path normalization/containment, and invalid/cancelled
inputs. Extend manifest/integration tests for the title contribution and Electron
coverage for both intake choices and exact primary-window dispatch. Expected product
files are `extension/package.json`, `extension/src/extension.ts`, a new focused module
such as `extension/src/newInitiativeFlow.ts`, and corresponding files under
`extension/test/unit/` plus `extension/test/electron/suite.ts`.

## Risks

- An untitled editor is not a modal QuickInput, and the user may switch documents
  before submitting. Capture the created document directly, keep Submit/Cancel
  explicit, and treat a closed or empty document as a visible non-dispatch result.
- Multi-line text and repository paths may contain whitespace or command-looking
  text. Build one Chat query without shell execution, preserve the editor payload,
  normalize only the file-path form, and assert the exact query in tests.
- A multi-root workspace can contain the companion artifact repository beside the
  product checkout. Derive the primary product root from fresh CLI session JSON and
  reject selections outside it rather than treating the first arbitrary workspace
  folder as authoritative.
- `extension/src/extension.ts`, `extension/package.json`, and Electron fixtures are
  common delivery hotspots. There is no current open-PR overlap; merge both
  `origin/main` branches before every push and rerun focused verification after any
  integration.

## Out of scope

- Changing `/agento new-initiative`, initiative decomposition, artifact formats, or
  any CLI, prompt, agent, hook, or root documentation behavior.
- Starting a planning worktree, creating initiative files directly, parsing Chat
  output, or tracking initiative creation after dispatch.
- A custom webview, multi-window Electron automation, Marketplace publication,
  extension version changes, or release notes.
- Selecting a brief from the companion repository or from outside the primary
  product checkout.

## Acceptance checklist

- [ ] The Initiatives view title bar exposes a distinct `Agento: New Initiative` add action, while New Plan remains available from its other existing surfaces.
- [ ] The action offers Enter brief and Pick a file; cancelling either flow submits nothing and leaves lifecycle state unchanged.
- [ ] Enter brief opens an untitled multi-line editor with explicit Submit/Cancel notification actions, preserves the submitted document text, and rejects empty or unavailable content visibly.
- [ ] Pick a file is rooted in the CLI-reported primary product repository, emits a normalized repository-relative path, and visibly rejects selections outside that repository.
- [ ] Both intake forms dispatch exactly `/agento new-initiative <brief | path>` to Copilot Chat in Agent mode in the primary window through the existing target-keyed dispatcher, opening/focusing the primary when invoked elsewhere.
- [ ] Invalid session data, missing primary targets, input failures, and dispatch failures are reported without writing a pending partial command or opening an arbitrary checkout.
- [ ] Focused unit and manifest tests cover command construction, multi-line preservation, path containment, primary selection, cancellation/error cases, and the Initiatives title contribution.
- [ ] Electron tests drive the contributed New Initiative command for both intake forms and prove the exact canonical command reaches the existing primary dispatch integration in supported fixture layouts.
- [ ] The green gate is preserved: full shellcheck has no findings; root tests and both replay guards pass; extension typecheck, unit tests, Electron tests, and VSIX package assertions all pass.