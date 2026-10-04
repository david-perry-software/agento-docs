```yaml
status: planned
branch: issue/gate-dashboard-plan-actions
last-updated: 2026-10-03
next-step: "1.1 Add the windowGate stub and the exposing test gateDashboardPlanActions.test.ts"
github-issue: "#84"
```

## Phase 1: Expose the defect

- [ ] 1.1 Add the stub `extension/src/windowGate.ts`. It exports `WindowGate`,
  `CLOSED_GATE`, `GatedCommand`, `windowGate`, and `gateRejection`, and keeps today's
  behaviour: `windowGate` always returns `{ primary: true, canPlan: true }`,
  `gateRejection` always returns `undefined`, and nothing imports it yet. Then add
  `extension/test/unit/gateDashboardPlanActions.test.ts`. Its header comment names
  issue #84 / `gate-dashboard-plan-actions` and the evidence directory. It holds the
  four tests from plan.md `## Approach`:
  - (a) manifest `when` clauses and `menus.commandPalette`;
  - (b) `windowGate` per role, fail-closed;
  - (c) `gateRejection` messages;
  - (d) `extension.ts` wiring: `setContext`, the closed gate at activation and on
    refresh error, and a guard in each of the three handlers before any prompt.

  Verify: `cd extension && npm run typecheck` exit 0, and `npm run test:unit` exits
  nonzero with exactly (a)–(d) failing on their assertions while all 110 existing
  tests pass. Record the four failure messages in the commit message.

## Phase 2: Fix

- [ ] 2.1 Implement `windowGate` and `gateRejection` in `extension/src/windowGate.ts`
  as designed (`primary`, `plan` + detached → `canPlan`, everything else and every
  malformed record → `CLOSED_GATE`; the three exact rejection messages) — verify:
  `cd extension && npm run test:unit` — (b) and (c) pass, (a) and (d) still fail,
  everything else passes.
- [ ] 2.2 Update the manifest in `extension/package.json`:
  - Append `&& agento.canPlan` to both `agento.newPlan` `view/title` entries and to
    the `agento.planInitiativeMember` `view/item/context` entry.
  - Append `&& agento.primary` to the `agento.newInitiative` `view/title` entry.
  - Add `menus.commandPalette`: `agento.newPlan` → `agento.canPlan`,
    `agento.newInitiative` → `agento.primary`, `agento.planInitiativeMember` → `false`.
  - Update the expected arrays in `extension/test/unit/extensionIntegration.test.ts`
    to match.

  Verify: `cd extension && npm run test:unit`. (a) and `extensionIntegration.test.ts`
  pass, and only (d) still fails.
- [ ] 2.3 Wire the gate into `extension/src/extension.ts`:
  - Add `applyGate` (stores the gate and calls `setContext` for `agento.primary` and
    `agento.canPlan`), and call `applyGate(CLOSED_GATE)` before the first refresh.
  - Add `gate: windowGate(sessionResult.json)` to the refresh snapshot. Apply it in
    the success callback, and apply `CLOSED_GATE` in the error callback.
  - In the `agento.newPlan`, `agento.newInitiative`, and `agento.planInitiativeMember`
    handlers, add the `gateRejection` guard as their first statement: an output line,
    `showErrorMessage`, then return. For Plan, the guard runs before the existing
    ready-member guard.
  - Expose `windowGate()` on `ExtensionApi`.

  Verify: `cd extension && npm run typecheck` exit 0, and `npm run test:unit` exit 0
  with all four tests in `gateDashboardPlanActions.test.ts` passing.
- [ ] 2.4 Electron assertions in `extension/test/electron/suite.ts`:
  - In the primary fixture, `api.windowGate()` is `{ primary: true, canPlan: true }`.
    The existing New Plan, Plan, and New Initiative cases wait for it first.
  - In the stubbed-`client.run` block:
    - a `build` session gives `CLOSED_GATE`, and all three commands reject with
      prompts and runners set to `assert.fail`;
    - a `plan` + detached session gives `{ primary: false, canPlan: true }`, and New
      Initiative rejects;
    - an invalid session gives `CLOSED_GATE`.
  - In the `workspace` scenario, `api.windowGate()` equals `windowGate()` of the live
    `agento.mjs session` JSON once loaded.

  Verify: `cd extension && npm run test:electron` exit 0 (every scenario prints
  `passed`).

## Phase 3: Verify packaging

- [ ] 3.1 Package the fixed extension:
  `cd extension && npm run package`, which includes `scripts/assert-vsix.mjs`.
  Verify:
  - exit 0;
  - `unzip -p agento-dashboard-*.vsix extension/package.json | grep -c 'agento.canPlan\|agento.primary'`
    prints ≥ 5;
  - the VSIX lists the compiled gate module
    (`unzip -l agento-dashboard-*.vsix | grep -c windowGate.js` ≥ 1).

## Phase 4: Docs, changelog, gate

- [ ] 4.1 Update `docs/extension.md`:
  - The Deliveries, Initiatives, Session & Doctor, and "Command routing" sections say
    where each action appears and that a hidden action invoked anyway is rejected
    with a message naming the primary window: New Plan and Plan in the primary or an
    unpromoted plan window, New Initiative in the primary only.
  - A promoted plan worktree (`role: build`) no longer shows New Plan.

  Add a **Fixed** entry citing #84 under `CHANGELOG.md` `## Unreleased`, covering the
  new gating only.

  Verify:
  - `grep -n 'agento.canPlan\|unpromoted plan window' docs/extension.md`;
  - `grep -n '#84' CHANGELOG.md`;
  - `node --test 'tests/**/*.test.mjs'` exit 0.
- [ ] 4.2 Run the full gate (policy §5):
  - `git ls-files '*.sh' | xargs pnpm dlx shellcheck` exit 0;
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exit 0;
  - `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` exit 0;
  - `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt`
    exit 0;
  - `cd extension && npm run typecheck && npm run test:unit && npm run test:electron`
    exit 0;
  - `git diff --stat origin/main -- extension/src/newPlanFlow.ts extension/test/unit/planPlayButtonHandoff.test.ts`
    is empty.

  Verify: every recorded status is 0, and there are no findings beyond the plan.md
  baseline (which has none).
- [ ] 4.3 Finish the delivery:
  - Write plan.md `## Resolution`: the root cause, what changed, and proof that the
    1.1 tests now pass.
  - Merge `origin/main` into the product branch and the companion's `origin/main`
    into the companion branch, then push both.
  - Set this roadmap to `status: in-review` with `next-step: ""`.

  Verify: `node <agento-root>/scripts/agento.mjs session --pr` shows the companion
  half `dirty: false`, `ahead: 0`, and both PRs open.

## Follow-ups

(none yet)
