# Autopilot In-Review Re-Send Stops Unattended Review Loop

## Problem
When a delivery is already at `status: in-review`, re-sending `/agento ap <slug>` can stop unattended orchestration and route toward a manual `/agento review-<type> <slug>` action. That breaks the expected Builder -> Reviewer -> Builder cycle in VS Code Autopilot mode and forces human intervention where unattended execution is expected.

## Evidence
Reproduction and supporting outputs are captured in:

- `evidence/repro-commands.md`
- `evidence/derive-next-in-review.json`
- `evidence/handoff-send-false.txt`
- `evidence/autopilot-review-loop-spec.txt`
- `evidence/lint-and-concurrency.md`

Verified reproduction summary:

- Executable transition proof confirms in-review next action is reviewer invocation (`/agento review-feature widget`) in `scripts/session-state.mjs` behavior.
- Agent metadata inspection confirms Builder and Reviewer handoffs are configured with `send: false`.
- Autopilot agent spec explicitly states in-review should proceed straight to review.

Observed behavior:

- Re-sent `/agento ap` in in-review state reports/reroutes to running `/agento review-<type> <slug>` instead of continuing unattended reviewer invocation.

Expected behavior:

- Re-sent `/agento ap` in in-review state invokes Reviewer subagent directly and continues unattended looping until approve, pause, or cap.

GitHub issue: #60

## Decisions
Clarifying questions asked:

1. Reproduction trigger details and exact slash-command sequence.
2. Exact observed output text vs expected output text for in-review state.
3. Scope boundary: `/agento ap` only vs also `/agento continue`/handoff behavior.
4. Whether to enforce a strict no-subagent-stop guarantee in in-review.
5. Constraints on allowed change locations and required test/doc updates.

Answers received during intake:

- Intake statement provided by user: "Autopilot re-sends stop invoking subagents once roadmap is in-review — /agento ap reports run /agento review-<type> instead of running the Reviewer; Builder->Reviewer handoff is send:false so VS Code Autopilot mode cannot chain them".
- No additional responses were provided after the clarification prompt; this plan uses the intake statement as the operative acceptance intent.

## Research
Skills consulted: none — no matching domain

Code and policy findings:

- `.github/agents/delivery-autopilot.agent.md` documents that in-review should skip directly to review phase.
- `.github/agents/delivery-builder.agent.md` and `.github/agents/delivery-reviewer.agent.md` both define `handoffs` with `send: false`.
- `scripts/session-state.mjs` in-review transition resolves to `review-<type>` command with reason indicating Reviewer should run in the same window.
- `extension/src/dispatchRouting.ts` routes stale cross-window actions to `/agento continue <slug>` when refreshed target is `here`, which can shift execution away from direct action submission.

Lint baseline (policy gate):

- Command: `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`
- Exit: 0
- Findings: none
- Overlap decision: no baseline findings overlap this issue scope, so keep baseline green and require unchanged clean result after changes.

Concurrent-delivery scan:

- Open PR query returned `[]` at planning time; no concurrent branch overlap found.

## Approach
Implement a focused fix for unattended in-review autopilot orchestration:

- Add exposing regression coverage for `/agento ap` re-send behavior in in-review state, asserting unattended reviewer invocation path.
- Update autopilot orchestration/dispatch wiring so in-review re-send executes Reviewer subagent flow instead of surfacing a manual review command.
- Align Builder/Reviewer handoff metadata and command routing semantics so Autopilot mode can chain phases without requiring manual action.
- Add/adjust unit/integration coverage in CLI and extension routing tests to prevent regressions.

Primary likely touch points:

- `.github/agents/delivery-autopilot.agent.md`
- `.github/agents/delivery-builder.agent.md`
- `.github/agents/delivery-reviewer.agent.md`
- `scripts/session-state.mjs`
- `scripts/agento.test.mjs`
- `extension/src/dispatchRouting.ts`
- `extension/test/unit/dispatchRouting.test.ts`

## Risks
- Risk: changing handoff routing could alter `/agento continue` behavior unexpectedly.
  Mitigation: keep scope constrained to `/agento ap` in-review path and add explicit regression tests around continue routing.
- Risk: extension tests need local dependency setup (`tsc` currently missing in this environment).
  Mitigation: include explicit extension dependency install and unit-test verification steps in roadmap.
- Risk: policy drift between prompt instructions and agent handoff metadata.
  Mitigation: verify prompt, agent, and transition tests as a single acceptance surface.
- Concurrent delivery risk: none detected (no open PRs at planning time).
  Mitigation: still merge `origin/main` before each push per policy.

## Out of scope
- Changing ship/merge behavior.
- Altering manual-step policy semantics.
- Broad redesign of command routing outside in-review autopilot chaining.

## Acceptance checklist
- [ ] Exposing regression test at `scripts/agento.test.mjs` (or equivalent focused test file) fails before the fix and passes after it, with the test name/header referencing `#60` and `autopilot-in-review-handoff`.
- [ ] Re-sent `/agento ap <slug>` for an in-review delivery runs Reviewer unattended instead of requiring manual `/agento review-<type> <slug>` invocation.
- [ ] Builder/Reviewer/autopilot orchestration remains policy-compliant, including cross-window boundaries and no implicit shipping.
- [ ] Extension/dispatch behavior for `/agento continue` remains correct and covered by tests where touched.
- [ ] Lint baseline remains clean (`shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` unchanged clean result).
- [ ] Relevant test suites for touched areas pass in CI-equivalent local commands documented in roadmap.

## Resolution
Pending implementation.
