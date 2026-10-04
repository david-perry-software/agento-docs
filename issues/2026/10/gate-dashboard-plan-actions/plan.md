# Gate New Plan / New Initiative / Plan dashboard actions to the windows allowed to plan

## Problem

The Agento extension shows three planning entry points in **every** window:

- **New Plan** (`agento.newPlan`) in the Deliveries and Session & Doctor title bars.
- **New Initiative** (`agento.newInitiative`) in the Initiatives title bar.
- **Plan** (`agento.planInitiativeMember`) inline on ready initiative members.

None of the menu `when` clauses has a role condition, there is no Command Palette
`when`, and the extension sets no context keys. The handlers also dispatch without
checking the session role. As a result:

- In a `build` window (including a promoted plan worktree), a `freehand` window, an
  `unmanaged` window, a hosted secondary window, or a window whose session has not
  loaded yet, New Plan and Plan send `/agento start-session` to the primary window
  through a pending dispatch. They open it with `forceNewWindow: true`, poll for a new
  plan worktree, and then hand `/agento new-feature …` off to that worktree.
- New Initiative, from any non-primary window, sends `/agento new-initiative …` to the
  primary window the same way.

What the user sees:

- Windows multiply: a duplicate primary window, then a plan window on top of it.
- A command can fire long after the click, up to the 5-minute pending TTL.
- The initiative brief editor opens in the wrong window.

## Evidence

GitHub issue: #84

Reproduction (verified 2026-10-03 at `70ad6c3`, extension built with
`cd extension && npm ci && npm run test:unit`):

The probe [evidence/repro-gate-dashboard-plan-actions.mjs](evidence/repro-gate-dashboard-plan-actions.mjs)
drives the compiled `extension/out/src` modules: `runNewPlanFlow`,
`runNewInitiativeFlow`, `dispatchCommandToTarget`, and `consumePendingCommands`. Its
injected `submitCommand` mirrors production, which runs in-window only when the target
is one of this window's folders. The probe also reads `extension/package.json` and
`extension/src/extension.ts`.
`node evidence/repro-gate-dashboard-plan-actions.mjs <agento checkout>` printed
[evidence/repro-gate-dashboard-plan-actions.txt](evidence/repro-gate-dashboard-plan-actions.txt):

```
MANIFEST — menu entries for the gated commands:
  view/title: agento.newPlan when="view == agento.deliveries"
  view/title: agento.newInitiative when="view == agento.initiatives"
  view/title: agento.newPlan when="view == agento.sessionDoctor"
  view/item/context: agento.planInitiativeMember when="view == agento.initiatives && viewItem == agento.initiativeMember.ready"
  menus.commandPalette: null
  setContext calls in extension/src/extension.ts: 0
  openTarget uses forceNewWindow: true: true
NEW PLAN from role=build window (attached delivery worktree):
  submitted: [{"command":"/agento start-session","target":"/repo"}]
  opened windows: ["/repo","/repo-worktrees/plan-new"]
  pending dispatch keys: [["/repo","/agento start-session"],["/repo-worktrees/plan-new","/agento new-feature Probe plan"]]
  in-window chat.open calls: []
  result: complete
NEW PLAN from role=unmanaged window:
  (identical to build)
NEW PLAN from role=plan, detached window (control: #77 in-window path, stays allowed):
  submitted: [{"command":"/agento new-feature Probe plan","target":"/repo-worktrees/plan-new"}]
  opened windows: []
  pending dispatch keys: []
  in-window chat.open calls: ["/agento new-feature Probe plan"]
  result: complete
STRAY PENDING — primary window /repo activates/focuses later (within the 5 min TTL):
  chat.open: ["/agento start-session"]
NEW INITIATIVE from role=build window:
  result: complete "/agento new-initiative Probe brief"
  opened windows: ["/repo"]
  pending dispatch keys: [["/repo","/agento new-initiative Probe brief"]]
```

Observed vs expected:

- **Observed:**
  - All four entry points are visible in every window and in the Command Palette.
  - From `build` or `unmanaged` windows (and `freehand`, attached `plan`, and
    not-yet-loaded windows, which take the same code path), New Plan and Plan save
    pending commands, open the primary window plus a new plan window, and complete.
  - New Initiative from a `build` window saves a pending `/agento new-initiative …`
    and opens the primary window.
  - Related symptoms, all confirmed in code:
    - **Stray pending command.** `consumePendingCommands` runs the saved
      `/agento start-session` on the primary window's next activation or focus
      (`extension/src/extension.ts` ≈line 552 focus subscription, line 574
      activation), as long as that happens within `PENDING_DISPATCH_TTL_MS` = 5 min
      (`extension/src/pendingDispatch.ts` line 3).
    - **Duplicate window.** `openTarget` calls `vscode.openFolder(…, { forceNewWindow: true })`
      (`extension/src/extension.ts` line 265). This opens a second primary window even
      when one is already open.
    - **Brief in the wrong window.** `enterBrief()` opens the untitled brief document
      in the *current* window (`extension/src/extension.ts` line 413) before
      dispatching to the primary window.
- **Expected:**
  - New Initiative is visible and runnable only where `agento.primary` is true
    (`role === "primary"`).
  - New Plan and Plan are visible and runnable only where `agento.canPlan` is true:
    `role === "primary"`, or `role === "plan"` with `worktree.detached === true`.
    The second case is the #77 in-window path, shown as the control above, and it
    stays allowed.
  - Everything else is hidden from menus and the Command Palette.
  - If one of these commands is invoked anyway (keybinding, `executeCommand`), it
    is rejected before any prompt or dispatch with a message that names the primary
    window.

There is no screenshot. Menu visibility is decided by the manifest's `when`
clauses, which the probe prints verbatim. The dispatch side effects are the exact
arguments the extension passes to its injected dependencies.

## Decisions

Clarifying questions asked 2026-10-03 using the numbered-list fallback, because the
ask-questions tool was unavailable. Answers verbatim:

1. *Gating mechanism — hide, hide + reject, or reject only?* —
   "**(a), hide and reject.**
   The menu `when` clause alone isn't enough: the Command Palette and keybindings bypass it. So do both: hide via `when` on a boolean context key (e.g. `agento.primary`), and have each handler consult the session role and reject when not primary — showing a message that names the primary window (matching the delivery-policy rejections like "switch to the primary window"). This is the same pattern `planInitiativeMember` already uses for the "only ready members" guard, and it's the robust form of (c)."
2. *Scope — which entry points, and the Command Palette?* —
   "**Scope — yes, all four, plus the Command Palette.**
   - `agento.newPlan` (Deliveries title bar) and `agento.newPlan` (Session & Doctor title bar) are the same command, two menu spots.
   - `agento.newInitiative` (Initiatives title bar).
   - `agento.planInitiativeMember` inline on `agento.initiativeMember.ready`.

   Gate each menu `when` clause, and add a `menus.commandPalette` `when` so the commands don't appear there either outside primary; handler rejection remains the backstop for keybindings."
3. *Edge roles (unmanaged, freehand, failed/unloaded session, hosted)?* —
   "**Edge roles — everything except `role === "primary"` is not-primary.**
   Fail closed: context key unset until the first session read resolves, and unset again on read failure. `unmanaged`, `freehand`, hosted-but-secondary, and not-yet-loaded all evaluate to hidden + handler-rejected. The only visible effect of the default-hidden state is that buttons appear shortly after activation once the session read lands — that's the safe behavior, so don't special-case the loading window."
   (Refined by decision 6: an unpromoted plan window also counts for `agento.canPlan`.)
4. *Observed vs expected?* —
   "**Observed vs expected — your reading is correct, plus three symptoms.**
   Confirmed: in a plan/build window, `runNewPlanFlow` sees `role != plan` and falls into the start-session path — it saves a pending dispatch, calls `openTarget(primary)` with `forceNewWindow: true`, and the primary then runs `/agento start-session`; the flow then polls for the new plan worktree and hands off `/agento new-feature`. `newInitiativeFlow` does the same shape: it resolves `primaryInitiativeTarget`, dispatches `/agento new-initiative` to the primary via pending dispatch + `openTarget`. Additional symptoms:
   - **Stray pending command** — `consumePendingCommands` fires on the target window's next activation, so if the primary wasn't open, the `/agento start-session` (or new-initiative) fires whenever it is next opened, long after the click.
   - **Duplicate window** — `openTarget` uses `vscode.openFolder(…, { forceNewWindow: true })`, so it opens a second primary window even when one already exists; New Plan then spawns a further plan window on top of that.
   - **Wrong window for the brief** — New Initiative's `enterBrief()` opens the brief document in the *current* (secondary) window before dispatching."

   (Verification notes: an unpromoted, detached plan window takes the #77 in-window
   path, not the start-session path. See decision 6 and the probe control case.
   "Long after the click" is limited to the 5-minute pending TTL.)
5. *Verification — tests or screenshots?* —
   "**Verification — unit + Electron activation tests suffice; screenshots optional.**
   This matches the #77/#82 precedent: `extensionIntegration.test.ts` asserts the `package.json` menu `when` clauses (the proof for hiding, since the Electron host can't observe menu visibility directly); a new unit test asserts the handler guard rejects for non-primary roles (no message/picker dispatch); the Electron suite asserts the context key per role across its in-repo/companion/workspace scenarios. Screenshots of primary vs plan windows are a nice manual confirmation but not required — the `when` clause is verified at the manifest level, and the handler rejection at the unit level."
6. *Follow-up: strict primary for all four (removing the #77 in-window branch), or a
   split gate?* —
   "**(b) — the split gate.** Option (a) would regress #77, so it's not just a design choice: the #77 in-window branch is not dead code.

   Why (b) is correct:
   - The Planner's own window check for `/agento new-feature` / `/agento new-issue` is `role: plan` (or `build` when resuming that slug's promoted worktree). So planning **from an unpromoted plan window is the intended path**, not a bug. #77 made the New Plan button submit in-window there precisely so it wouldn't spawn a second plan window. Removing that branch would put back the #77 bug.
   - `agento.newInitiative` is different: `runNewInitiativeFlow` always resolves the primary and dispatches `/agento new-initiative` there — there is no in-window branch. So it's primary-only by construction, matching the stricter `agento.primary` key.

   So the two keys fall out of the code as-is:
   - `agento.primary` — set when `role === "primary"`. Gates `agento.newInitiative` only.
   - `agento.canPlan` — set when `role === "primary"` **or** (`role === "plan"` && `worktree.detached === true`). Gates `agento.newPlan` and `agento.planInitiativeMember`.

   Everything else — `build` (including a promoted `plan` worktree, whose role is now `build`), `freehand`, `unmanaged`, hosted-secondary, and a failed/unloaded session read — evaluates to both keys false, so all four entry points are hidden and the handlers reject, fail-closed as in answer 3.

   One consequence worth recording in the plan: a **promoted** plan worktree (`role: build`, `dirPrefix: plan`) no longer shows New Plan — resuming that slug's planning is done through the delivery's actions/`/agento new-issue` resume, not the New Plan button. That's consistent with the "build when resuming" wording in the Planner's window check.

   Go with (b); I'd note in the CHANGELOG only the *new* gating (no reversal of #77)."

## Research

Skills consulted: none — no matching domain. The repository has no `.agents/skills/`
directory, and AGENTS.md has no `## Agento` skills table.

Root cause, with evidence:

- **Manifest.** In `extension/package.json` `contributes.menus` (lines 100–154), the
  `view/title` entries are:
  - `agento.newPlan` with `view == agento.deliveries` (≈line 118).
  - `agento.newInitiative` with `view == agento.initiatives` (≈line 123).
  - `agento.newPlan` with `view == agento.sessionDoctor` (≈line 128).

  The `view/item/context` entry for `agento.planInitiativeMember` (≈line 145) has
  `view == agento.initiatives && viewItem == agento.initiativeMember.ready`.

  None of them has a role term, and there is no `menus.commandPalette` section, so
  every contributed command appears in the Palette.
- **No context keys.** `extension/src/extension.ts` has zero `setContext` calls (probe
  output). The only role-awareness today is `currentWindow` for `dispatchAction`
  (line 271), which reads `sessionDoctor.current.session.role === "primary"`.
- **Handlers do not check the role:**
  - `agento.newPlan` (line 365) prompts for the kind and description, then calls
    `newPlanRunner`.
  - `agento.newInitiative` (line 434) prompts (and `enterBrief` opens an editor at
    line 413), then calls `newInitiativeRunner`.
  - `agento.planInitiativeMember` (line 456) checks only that the member is a ready
    member, then calls `newPlanRunner`.
- **The flows send work to the primary window whatever the current role is:**
  - `runNewPlanFlow` (`extension/src/newPlanFlow.ts` ≈line 200) stays in-window only
    for `role === "plan" && worktree.detached === true` (the #77 branch). Every other
    record goes through `primaryTarget` → `submitCommand("/agento start-session")` →
    poll → `handoff` (pending dispatch + `openTarget`).
  - `runNewInitiativeFlow` (`extension/src/newInitiativeFlow.ts` line 77) always
    resolves `primaryInitiativeTarget` and dispatches there.
- **Session data is available at refresh time.** The refresh in
  `extension/src/extension.ts` (line 162) already runs `agento.mjs session --pr` for
  every refresh and applies results through `LatestDeliveryRefresh`, so stale results
  are discarded. Its success callback (line 191) and error callback are where the
  gate can be set. The raw session JSON carries `role` and `worktree.detached`. The
  Session & Doctor model (`extension/src/sessionDoctorModel.ts`) drops `detached`, so
  the gate must be derived from the raw record, not from `SessionSummary`.
- **CLI agreement.** `scripts/session-state.mjs`: a `plan` window's `allowed[]` lists
  `/agento new-feature` and `/agento new-issue` (line 328, `no-delivery`), and
  `primary` lists `/agento start-session` and `/agento new-initiative` (`CREATE`,
  line 283). The split gate matches these sets. The CLI is not changed.

Tests that touch the change:

- `extension/test/unit/extensionIntegration.test.ts` (test at line 5) asserts exact
  `view/title` and `view/item/context` arrays with `deepEqual`. These expectations
  must be updated to the gated `when` clauses. Its source-regex test (line 60) is the
  existing precedent for asserting `extension.ts` wiring.
- `extension/test/electron/suite.ts`:
  - It runs `agento.newInitiative` (≈lines 238–301), `agento.newPlan`, and
    `agento.planInitiativeMember` (≈lines 586–608) in the primary fixture. After the
    fix these need the gate to be open, so they must wait until the gate opens after
    the first session refresh.
  - Its stubbed-`client.run` block (≈line 733) already feeds `sessionResponse(role)`
    records. That is the hook for the per-role gate assertions.
  - The `workspace` scenario returns early (≈line 431).
- No open delivery PRs (`gh pr list --state open` is empty), so there is no
  concurrent-delivery overlap.

Lint baseline (policy §5), run 2026-10-03 at `70ad6c3`:

- Shell lint: `shellcheck` is not on PATH.
  `git ls-files '*.sh' | xargs pnpm dlx shellcheck` exit 0, no findings.
- Tests: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exit 0, 274
  tests, 274 pass.
- Guard smoke: `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` exit 0.
  `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt`
  exit 0.
- Extension: `cd extension && npm ci` exit 0. `npm run typecheck` exit 0.
  `npm run test:unit` exit 0, 110 tests, 110 pass.

Overlap decision: the baseline is green, so the **full gate** applies. At the end,
all of these must be green:

- the full shellcheck run
- the full node test suite
- both guard smokes
- the extension typecheck
- the extension unit tests
- the electron tests (all scenarios)

No scoped gate is needed. This delivery changes no shell files.

## Approach

**Pure gate module, new file `extension/src/windowGate.ts`:**

- `interface WindowGate { primary: boolean; canPlan: boolean }`
- `CLOSED_GATE: WindowGate = { primary: false, canPlan: false }`
- `windowGate(session: unknown): WindowGate`. Returns `CLOSED_GATE` unless the record
  is an object with `status === "ok"` and a string `role`.
  - `primary` = `role === "primary"`.
  - `canPlan` = `primary || (role === "plan" && worktree?.detached === true)`.
  - Any malformed `worktree` closes `canPlan`. `hosted` is ignored, because the CLI
    has already derived `role` from the branch.
- `type GatedCommand = "agento.newPlan" | "agento.newInitiative" | "agento.planInitiativeMember"`
- `gateRejection(command: GatedCommand, gate: WindowGate): string | undefined` returns
  `undefined` when the command's key is true. Otherwise it returns:
  - New Initiative: `New Initiative runs only in the primary window: switch to the primary window and run it there.`
  - New Plan: `New Plan runs only in the primary window or an unpromoted plan window: switch to the primary window and run it there.`
  - Plan: `Plan runs only in the primary window or an unpromoted plan window: switch to the primary window and run it there.`

**Manifest (`extension/package.json`):**

- Append the role key to each menu `when` clause:
  - `agento.newPlan` in the Deliveries title bar: `&& agento.canPlan`.
  - `agento.newPlan` in the Session & Doctor title bar: `&& agento.canPlan`.
  - `agento.newInitiative` in the Initiatives title bar: `&& agento.primary`.
  - The `agento.planInitiativeMember` inline entry: `&& agento.canPlan`.
- Add `menus.commandPalette` with:
  - `{ command: "agento.newPlan", when: "agento.canPlan" }`
  - `{ command: "agento.newInitiative", when: "agento.primary" }`
  - `{ command: "agento.planInitiativeMember", when: "false" }`. This command needs a
    tree element, so it is never offered in the Palette.
- An unset context key evaluates false, which gives the fail-closed default.

**Wiring (`extension/src/extension.ts`):**

- Hold `let gate = CLOSED_GATE`. A small `applyGate(next)` stores it and calls
  `vscode.commands.executeCommand("setContext", "agento.primary", next.primary)` and
  `("setContext", "agento.canPlan", next.canPlan)`.
- Call `applyGate(CLOSED_GATE)` at activation before the first refresh.
- The deliveries/session refresh snapshot (line 191) gains `gate: windowGate(sessionResult.json)`.
  The success callback applies it, and the error callback applies `CLOSED_GATE`.
  Because the gate rides on the `LatestDeliveryRefresh` snapshot, an older
  overlapping refresh can never overwrite a newer gate.
- At the top of each of the three handlers, before any prompt, editor, or dispatch:
  `const rejection = gateRejection("<command>", gate); if (rejection) { output.appendLine(...); await vscode.window.showErrorMessage(rejection); return; }`.
  For `agento.planInitiativeMember`, the gate check runs before the existing
  ready-member guard.
- `ExtensionApi` gains `windowGate: () => WindowGate`. It returns the value last
  passed to `setContext`, so the Electron suite can assert the key per role.
- The flows (`newPlanFlow.ts`, `newInitiativeFlow.ts`), `dispatchAction`, the
  pending-dispatch TTL, and `openTarget` stay unchanged. Once the gate is in place,
  the only windows that reach them are the ones allowed to plan.

**Exposing tests.** New file `extension/test/unit/gateDashboardPlanActions.test.ts`,
whose header comment names issue #84 / `gate-dashboard-plan-actions` and this
evidence directory. Step 1.1 adds `windowGate.ts` as a stub that keeps today's
behaviour (always `{ primary: true, canPlan: true }`, `gateRejection` always
`undefined`), so the tests compile and fail on their assertions:

- (a) **Manifest.** Each of the four menu entries' `when` contains the right key.
  `menus.commandPalette` has the three entries with `agento.canPlan`,
  `agento.primary`, and `false`.
- (b) **`windowGate` per role.**
  - `primary` → `{ true, true }`.
  - `plan` + detached → `{ false, true }`.
  - All of these → `CLOSED_GATE`: `plan` attached, `build`, `build` with
    `dirPrefix: "plan"` (promoted), `freehand`, `unmanaged`, `build` + `hosted: true`,
    `status: "failed"`, `undefined`, and a record with a missing or malformed
    `worktree`.
- (c) **`gateRejection`.**
  - Returns a message containing `primary window` for New Initiative under
    `{ false, true }` and for all three commands under `CLOSED_GATE`.
  - Returns `undefined` for all three under `{ true, true }`, and for New Plan and
    Plan under `{ false, true }`.
- (d) **Wiring.** `extension/src/extension.ts` source shows:
  - `setContext` for `agento.primary` and `agento.canPlan`;
  - `applyGate(CLOSED_GATE)` before the first `refreshNow`;
  - `CLOSED_GATE` applied in the refresh error path;
  - each of the three handlers calling `gateRejection("<command>"` before its first
    prompt or runner call.

**Electron (`extension/test/electron/suite.ts`):**

- Primary fixture, after the session loads: `api.windowGate()` deep-equals
  `{ primary: true, canPlan: true }`.
- The existing New Plan and New Initiative cases wait for that state first.
- Inside the stubbed-`client.run` block, a session refresh:
  - with `build` gives `CLOSED_GATE`. `executeCommand` of all three commands rejects
    with no prompt or runner invoked: the prompts and runners are set to
    `assert.fail`, and an `output` line records the rejection;
  - with a `plan` + detached record gives `{ false, true }`. New Initiative rejects;
  - with an invalid session gives `CLOSED_GATE`.
- `workspace` scenario: before its early return, `api.windowGate()` deep-equals
  `windowGate(<live agento.mjs session JSON>)` once the session has loaded.

**Docs.**

- `docs/extension.md`:
  - The Deliveries, Initiatives, and Session & Doctor sections, plus "Command
    routing", state where each action appears.
  - A promoted plan worktree (`role: build`) no longer shows New Plan. It resumes its
    planning through the delivery's actions or `/agento new-issue` /
    `/agento new-feature` resume.
- `CHANGELOG.md` `## Unreleased`: a **Fixed** entry citing #84 that describes the new
  gating only.

## Risks

- **The Electron cases that run the commands in the primary fixture could race the
  first session refresh.** With a closed gate they would be rejected.
  - Mitigation: wait for `api.windowGate().canPlan` / `.primary` before those cases
    (step 2.4). `npm run test:electron` verifies all scenarios.
- **The handler gate is cached from the last refresh, not re-read on every click.** A
  window promoted from `plan` to `build` keeps `canPlan` until the next refresh.
  - Mitigation: the existing watchers already refresh on git HEAD and roadmap
    changes, and promotion changes HEAD. If a stale gate lets the click through, it
    lands on the #77 in-window path, which the Planner's own §11 window check still
    guards.
- **Hosted workspaces:** on the default branch the CLI derives `role: primary`, so the
  gate opens. That is intended by decision 3, which keys on `role === "primary"`.
- **The extensionIntegration `deepEqual` manifest expectations** change in the same
  step as the manifest (2.2), so the suite never goes red in between.
- **Concurrent deliveries:** no open PRs in either repository at planning time.
  - Mitigation: merge `origin/main` into the product branch, and the companion's
    `origin/main` into the companion branch, before every push (policy §7).

## Out of scope

- Changing `runNewPlanFlow`, `runNewInitiativeFlow`, the #77 in-window branch, the
  pending-dispatch TTL, or `openTarget`'s `forceNewWindow` in a primary-origin flow.
- Gating `agento.showActions` / `agento.dispatchAction` delivery actions. These
  already route through `agento.mjs next`.
- Any change to the CLI (`scripts/session-state.mjs` `deriveAllowed`) or to the
  Planner's window check.
- Screenshots of primary and plan windows (optional per decision 5; not required).

## Acceptance checklist

- [ ] The exposing regression test file
  `extension/test/unit/gateDashboardPlanActions.test.ts` (issue #84) fails before the
  fix and passes after it. Step 1.1 records the four failing tests (a)–(d) — verify:
  `cd extension && npm run test:unit` exit 0 with tests (a)–(d) passing. Step 1.1's
  commit message records the pre-fix failures.
- [ ] `windowGate` gives `{ primary: true, canPlan: true }` only for `primary`, and
  `{ false, true }` only for `plan` + detached. Every other role, every malformed
  record, and every failed record gives `CLOSED_GATE` — verify: unit test (b).
- [ ] All four menu entries carry the role key, and `menus.commandPalette` hides the
  three commands outside their roles — verify: unit test (a) and the updated
  `extensionIntegration.test.ts` manifest `deepEqual`.
- [ ] Each of `agento.newPlan`, `agento.newInitiative`, and
  `agento.planInitiativeMember`, when its key is false, shows the
  `… runs only in the primary window …` error and returns before any prompt, editor,
  or dispatch — verify: unit tests (c) and (d), plus the Electron rejection
  assertions for `build` and `plan` + detached (New Initiative).
- [ ] The context keys are false at activation and after a failed session read, and
  match `windowGate` of the latest applied session — verify: Electron assertions
  (primary open, build and invalid closed, plan-detached `canPlan` only, workspace
  scenario equal to the live `windowGate`) in `npm run test:electron`.
- [ ] The #77 in-window New Plan path from an unpromoted plan window is unchanged —
  verify: `extension/test/unit/planPlayButtonHandoff.test.ts` and
  `newPlanFlow.test.ts` pass unmodified (`git diff --stat origin/main -- extension/src/newPlanFlow.ts extension/test/unit/planPlayButtonHandoff.test.ts`
  is empty).
- [ ] The packaged VSIX manifest carries the gated `when` clauses — verify:
  `cd extension && npm run package` exit 0, and `unzip -p agento-dashboard-*.vsix extension/package.json | grep -c 'agento.canPlan\|agento.primary'` ≥ 5.
- [ ] `docs/extension.md` documents where each action appears, including the
  promoted-plan-worktree consequence, and `CHANGELOG.md` `## Unreleased` has a
  **Fixed** entry citing #84 — verify: `grep -n 'agento.canPlan\|unpromoted plan window' docs/extension.md`
  and `grep -n '#84' CHANGELOG.md`.
- [ ] Full gate (policy §5) is green with no new findings against the baseline —
  verify:
  - `git ls-files '*.sh' | xargs pnpm dlx shellcheck` exit 0;
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exit 0;
  - both guard smokes exit 0;
  - `cd extension && npm run typecheck && npm run test:unit && npm run test:electron`
    exit 0.

## Resolution

(written by the Builder at completion)
