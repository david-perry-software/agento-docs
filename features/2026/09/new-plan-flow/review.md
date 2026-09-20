# Review: new-plan-flow

Verdict: request-changes

## Acceptance checklist results

- Pass — `extension/package.json` contributes `agento.newPlan` to the Command
  Palette and all three Agento view titles. `extension/src/extension.ts` registers
  one Feature/Issue Quick Pick followed by a validated one-line input.
- Pass — ready initiative elements retain the CLI-provided initiative slug, the
  manifest exposes `agento.planInitiativeMember` only for
  `agento.initiativeMember.ready`, and the command constructs exactly
  `/agento new-feature initiative:<initiative>/<member>`. Unit tests passed for
  slug retention, context values, manifest gating, and canonical construction.
- Pass — `runNewPlanFlow` derives the sole product primary from the pre-dispatch
  CLI session and submits exactly `/agento start-session`; it contains no direct
  worktree mutation. The focused unit assertion passed.
- Fail — bounded, cancellable behavior does not cover submission to a different
  window. `runNewPlanFlow` awaits `submitCommand` before creating its deadline or
  checking cancellation, while the production submission adapter awaits the
  optional `Focus target` notification. An unanswered notification can therefore
  keep a secondary-window flow pending indefinitely.
- Pass — focused unit cases and both Electron fixture layouts passed for companion
  workspace preference, product-folder fallback, exact pending command identity,
  and the existing consume-once pending-dispatch implementation.
- Pass — timeout and failed-open paths offer Retry/Focus recovery, failed opens
  clear pending state before retry, and the existing pending store retains its
  five-minute expiry and consume-once behavior.
- Fail — `extension/test/unit/newPlanFlow.test.ts` covers Retry after a failed open
  but never selects or asserts the Focus target path required by the checklist.
- Fail — the Electron suite calls the exported `api.startNewPlan` orchestration
  helper directly. It does not execute `agento.newPlan` through Quick Pick/Input or
  execute `agento.planInitiativeMember` from a ready member, so it does not prove
  either user entry point reaches dispatch.
- Pass — the independent scoped gate was green: extension typecheck and 64 unit
  tests passed; root tests passed 214/214; both replay guards and shellcheck exited
  0; VS Code 1.125 Electron passed in-repo and companion scenarios; and the VSIX
  package assertion passed.

## Plan vs implementation

The source scope matches the planned extension-only boundary, and the generic and
initiative request construction, session-derived targeting, pending dispatch, and
workspace selection are implemented in the expected modules. No CLI, agent, prompt,
hook, or delivery artifact semantics changed in the product repository.

The implementation deviates from the bounded-wait requirement because the timeout
begins after cross-window command submission has fully returned. The test strategy
also stops at the exported orchestration API instead of exercising the two user-facing
commands promised by the plan. No matching project skill exists for this domain,
consistent with the plan's `Skills consulted: none — no matching domain` record.

## Roadmap audit

Step 1.1 was unticked because the passing unit suite does not cover the Focus target
recovery branch. Step 3.1 was unticked because both passing Electron scenarios invoke
`api.startNewPlan` directly rather than the generic and ready-member commands named by
the step. Their existing descriptions already capture the missing work, so no new
roadmap step was added. Steps 1.2, 2.1, 2.2, and 3.2 remain supported by the source
diff and independently rerun checks. There are no manual or post-ship steps.

## Findings

- Major — Cross-window startup can wait forever before the bounded poll begins.
  `extension/src/newPlanFlow.ts` awaits `dependencies.submitCommand` before it
  creates a deadline or checks cancellation. The production adapter delegates to
  `dispatchCommandToTarget`, and `extension/src/commandDispatcher.ts` awaits
  `reportInfo(..., "Focus target")` after opening the primary target. If the user
  leaves that notification unanswered, the progress UI never reaches its two-minute
  timeout or cancellation loop. Make the informational focus offer non-blocking, or
  include submission in the cancellable deadline, and add a pending-notification
  regression test.
- Major — The Electron acceptance scenario does not exercise either new user entry
  point. `extension/test/electron/suite.ts` calls `api.startNewPlan` with injected
  dependencies for both requests; it never executes `agento.newPlan` or
  `agento.planInitiativeMember`. The later member command assertion activates the
  existing `agento.openBreakdown` tree-item command. Drive the contributed commands
  in both fixture layouts and assert the exact canonical follow-up reaches dispatch.
- Minor — Focus target recovery lacks its promised focused unit case. The only
  failed-open test returns `Retry`, despite its title mentioning both recovery
  actions. Add a distinct Focus target assertion so step 1.1 and the corresponding
  acceptance item are truthful.

## Follow-ups

None.