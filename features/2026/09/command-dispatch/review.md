# Review: command-dispatch

Verdict: request-changes

## Acceptance checklist results

- Pass — `status --pr` emits per-delivery `allowed[]`/`elsewhere[]`, including `/agento ap command-dispatch`; focused `session-state` and `agento` suites pass, and bundled CLI files match source byte-for-byte.
- Pass — delivery and Session models project CLI actions in order; `commandActions.test.ts` covers exact command/window/reason projection and malformed records, with no TypeScript lifecycle matrix.
- Pass — unit and Electron checks submit exact same-window command text through `workbench.action.chat.open` with `mode: "agent"`.
- Fail — delivery-node cross-window routing uses `next <slug>`, `/agento continue`, CLI targets, workspace preference, and primary-only ship, but Session-view cross-window actions lose the delivery slug and reject before revalidation.
- Fail — pending-record unit tests cover target keys, atomic consumption, expiry, malformed values, and failures, but the required real two-window activation/focus behavior has no recorded evidence.
- Pass — successful cross-window routing offers `Focus target`, and no implementation reads Chat output or attempts remote cancellation.
- Fail — 54 unit tests pass, but they do not cover Session-view cross-window dispatch; the Electron suite explicitly dispatches the Session action with `slug` undefined and only selects an in-window action.
- Pass — both in-repo and companion Electron scenarios pass and assert exact Session and delivery in-window Chat queries in agent mode.
- Pass — extension and architecture documentation cover the implemented model; packaging includes `actionPicker.js`, `commandActions.js`, `commandDispatcher.js`, `dispatchRouting.js`, and `pendingDispatch.js`; all version sources remain `0.5.2`.
- Fail — all local gates pass only with an uncommitted update to `tests/session-context.test.mjs`; committed PR #54 fails its root test check 213/214.

## Plan vs implementation

Skills consulted: none — no matching domain, consistent with the repository's missing `## Agento` skills table.

The CLI metadata, delivery action surface, in-window submission, pure routing, pending-record mechanics, documentation, and package contents match the plan. The Session model preserves actions but not the current delivery slug, so the generic Session action path cannot perform the planned cross-window handoff. The plan's residual multi-window `globalState` risk also remains unresolved because only a single-host adapter path was exercised.

The product and companion branches both contain `origin/main`. The companion branch was clean and synchronized before review. PR #54 is `BLOCKED` by its failed `test` check; companion PR #11 is clean.

## Roadmap audit

- Steps 1.1 through 3.2 and 4.1 are supported by code, focused tests, history, and reviewer reruns.
- Step 3.3 was falsely ticked: no `evidence/` directory exists, and the Electron suite stubs storage/opening inside one Extension Host rather than proving primary-to-companion activation/focus consumption. It was unticked.
- Step 4.2 was correctly unticked. Reviewer gates pass in the dirty worktree, but not from committed PR state.
- Added step 4.3 for the missing Session delivery context and cross-window integration coverage.
- Added step 4.4 for the uncommitted AP-aware session-context expectation and clean-branch CI proof.
- Set `next-step` to the earliest remaining work, step 3.3.

## Findings

- Major — Session-view cross-window actions always reject. `extension/src/sessionDoctorModel.ts:182` stores actions without the delivery slug; `extension/src/extension.ts:222` builds the Session action source without one; `extension/src/commandDispatcher.ts:32` therefore skips `next`; and `extension/src/dispatchRouting.ts:32-34` rejects every non-`here` action when `slug` is absent. The Electron test at `extension/test/electron/suite.ts:269` passes `undefined` and tests only a `here` action, so the required handoff path is not covered.
- Major — The pushed implementation does not preserve the green baseline. PR #54's `test` check fails because committed `tests/session-context.test.mjs` still expects the pre-AP Session line. The working tree changes line 129 to include `/agento ap widget`, making the local 214-test suite pass, but that fix is uncommitted and absent from the PR.
- Major — Cross-window activation/focus behavior is not independently verified. Unit and Electron tests use one in-memory store/host and stub `openTarget`; there is no evidence that a pending `globalState` update made in one already-open Extension Host becomes observable and auto-submits in another. This is the exact residual risk identified in `plan.md` and required by roadmap step 3.3.

## Follow-ups

- None. The required corrections remain within this feature's existing scope.