# Review: new-initiative-entry

Verdict: request-changes

Reviewed product commit `0eec9ad` on `feature/new-initiative-entry` (draft PR
#57) and companion commit `9432f18` (draft PR #14) against both repositories'
`origin/main` on 2026-09-20. Both PRs are open and merge-clean; code PR CI is
successful and the companion PR has no configured checks. Skills consulted:
none — no matching domain, as recorded in plan.md and confirmed by AGENTS.md.

## Acceptance checklist results

| # | Result | Evidence |
|---|---|---|
| 1 | **pass** | `extension/package.json` contributes `agento.newInitiative` as `Agento: New Initiative` with `$(add)` only on `agento.initiatives`; the independent manifest assertion passed and New Plan remains on Deliveries and Session & Doctor. |
| 2 | **pass** | `extension/src/extension.ts` offers Enter brief and Pick a file and returns without invoking the runner when either prompt is cancelled; focused unit tests pass. |
| 3 | **fail** | The untitled editor and Submit/Cancel notification exist and preserve text, but `enterBrief()` reads `document.getText()` without checking `document.isClosed`. The installed VS Code API exposes `TextDocument.isClosed`; closing the editor before choosing Submit is not rejected explicitly and has no regression coverage. |
| 4 | **pass** | The file picker starts at the CLI-reported product primary; `repositoryRelativeBriefPath()` normalizes separators and rejects the root and paths outside it; regular-file and visible-error paths are covered. |
| 5 | **pass** | Both forms construct exactly `/agento new-initiative <argument>` and route through `dispatchCommandToTarget()` in Agent mode; unit tests prove current-primary Chat submission and target-keyed cross-window persistence. |
| 6 | **pass** | Invalid/missing primary sessions, invalid files, and dispatch failures return failures without partial dispatch. Existing dispatcher coverage proves pending state is deleted when opening a target fails. |
| 7 | **pass** | `npm run test:unit` passed 76/76, including command construction, multiline preservation, containment, primary selection, cancellation/error paths, dispatcher behavior, and manifest assertions. |
| 8 | **pass** | `npm run test:electron` passed both in-repo and companion Extension Host scenarios; each drove the contributed command through brief and file intake and asserted the exact Agent-mode query and primary target. |
| 9 | **pass** | Full gate: shellcheck exit 0; root Node tests 214/214; standard and companion replay guards exit 0; extension typecheck exit 0; unit tests 76/76; both Electron scenarios exit 0; VSIX package assertions pass. |

## Plan vs implementation

The implementation matches the planned module, manifest contribution, command
registration, primary-target resolution, path containment, and shared dispatcher
reuse. The changed product files are exactly the six extension files anticipated by
the plan. No CLI, prompt, agent, hook, root documentation, version, or release file
changed.

One planned behavior is missing: plan.md `## Risks` requires a closed captured
document to become a visible non-dispatch result. The command handler handles empty
text and thrown reads, but it does not inspect `document.isClosed` before reading and
dispatching. This is an implementation gap, not an out-of-scope enhancement.

## Roadmap audit

Steps 1.1, 1.2, 2.1, 2.2, 3.1, and 3.2 were spot-checked against the product diff
and their verification commands. Their stated checks pass. No manual or post-ship
steps exist.

The roadmap omitted the closed-document requirement. Added unchecked step 2.3 and
set `next-step` to it. No existing tick was false under its own step wording, so no
tick was removed.

## Findings

1. **Major — closing the untitled brief before Submit is not rejected.**
   `extension/src/extension.ts` captures the document, waits on a non-modal
   notification, and then returns `document.getText()` whenever Submit is chosen.
   During that wait the user can close the editor; the handler never checks the
   API's `document.isClosed` state. This fails acceptance item 3 and the explicit
   plan risk requiring a closed document to produce a visible non-dispatch result.
   Add the guard at the prompt boundary and a regression test proving no Chat or
   pending dispatch occurs after close.

No additional correctness, security, or scope findings were identified. Product and
companion worktrees were clean after verification, and `git diff --check` passed for
both diffs.

## Follow-ups

None. The required correction is tracked directly as roadmap step 2.3.