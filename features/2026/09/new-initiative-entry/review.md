# Review: new-initiative-entry

Verdict: approve

Round 2 reviewed product commit `1591989` on `feature/new-initiative-entry`
(draft PR #57) and companion commit `d261906` (draft PR #14) against both
repositories' `origin/main` on 2026-09-20. Both PRs are open and merge-clean;
code PR CI is successful and the companion PR has no configured checks. Skills
consulted: none — no matching domain, as recorded in plan.md and confirmed by
AGENTS.md.

## Acceptance checklist results

| # | Result | Evidence |
|---|---|---|
| 1 | **pass** | `extension/package.json` contributes `agento.newInitiative` as `Agento: New Initiative` with `$(add)` only on `agento.initiatives`; the independent manifest assertion passed and New Plan remains on Deliveries and Session & Doctor. |
| 2 | **pass** | `extension/src/extension.ts` offers Enter brief and Pick a file and returns without invoking the runner when either prompt is cancelled; focused unit tests pass. |
| 3 | **pass** | `submittedInitiativeBrief()` now checks `document.isClosed` before `getText()`, reports `The initiative brief editor was closed before submission.`, and returns without invoking the runner. Unit and local Extension Host regressions passed and assert stale content is not read and dispatch attempts remain zero. |
| 4 | **pass** | The file picker starts at the CLI-reported product primary; `repositoryRelativeBriefPath()` normalizes separators and rejects the root and paths outside it; regular-file and visible-error paths are covered. |
| 5 | **pass** | Both forms construct exactly `/agento new-initiative <argument>` and route through `dispatchCommandToTarget()` in Agent mode; unit tests prove current-primary Chat submission and target-keyed cross-window persistence. |
| 6 | **pass** | Invalid/missing primary sessions, invalid files, and dispatch failures return failures without partial dispatch. Existing dispatcher coverage proves pending state is deleted when opening a target fails. |
| 7 | **pass** | `npm run test:unit` passed 77/77, including command construction, multiline preservation, containment, primary selection, cancellation/error paths, the closed-document regression, dispatcher behavior, and manifest assertions. |
| 8 | **pass** | The `local:no-ports` target, `npm run test:electron`, passed both in-repo and companion Extension Host scenarios. It drove both intake forms to the exact Agent-mode query and independently exercised the closed-document command path with no Chat or pending dispatch. |
| 9 | **pass** | Full gate: shellcheck exit 0; root Node tests 214/214; standard and companion replay guards exit 0; extension typecheck exit 0; unit tests 77/77; both Electron scenarios exit 0; VSIX package assertions pass. |

## Plan vs implementation

The implementation matches the planned module, manifest contribution, command
registration, primary-target resolution, path containment, and shared dispatcher
reuse. The round-two repair adds the planned closed-document guard at the prompt
boundary and focused unit plus Extension Host coverage. The changed product files
remain the six extension files anticipated by the plan; no CLI, prompt, agent, hook,
root documentation, version, or release file changed.

## Roadmap audit

Steps 1.1 through 2.3 and 3.1 through 3.2 were spot-checked against the product
diff, implementation, focused tests, and complete gate. Every tick is supported.
Step 2.3's visible error and no-dispatch behavior passed independently. No manual or
post-ship steps exist, no false ticks were found, and no roadmap repairs were needed.

## Findings

None. The prior major finding is resolved: a closed captured document is rejected
before content access or dispatch, with focused regression coverage. Product and
companion worktrees were clean after verification, and `git diff --check` passed for
both diffs.

## Follow-ups

None. The required correction is tracked directly as roadmap step 2.3.