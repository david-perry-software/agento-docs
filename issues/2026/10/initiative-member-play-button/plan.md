# Add a play button to in-flight initiative members

## Problem

In the Agento dashboard's **Initiatives** view, members grouped under **In flight**
(roadmap `status` planned / in-progress / in-review) render without any inline
action. Only **Ready** members get the play (`Plan`) button. The same slug in the
**Deliveries** view offers the CLI's allowed commands via its play button, but from
the initiative tree — where the user is reasoning about what to do next — there is
no way to reach them. The user must switch views and locate the slug again.

## Evidence

GitHub issue: #82

Reproduced 2026-10-03 against `extension/` at `0d65927` (`origin/main`):

1. `cd extension && npm ci && npm run build` (exit 0).
2. Ran a script that loads `extension/package.json` and
   `out/initiativeTreePresentation.js`, builds an initiative with one ready and
   three in-flight members, and reports which `view/item/context` `inline`
   contribution matches each member row's `contextValue`.

Captured output —
[evidence/repro-inline-menu-gap.txt](evidence/repro-inline-menu-gap.txt):

```
Initiatives inline menu contributions:
  agento.planInitiativeMember  when: view == agento.initiatives && viewItem == agento.initiativeMember.ready

Member rows and whether any inline button matches their viewItem:
  ready-delivery     state=unplanned    contextValue=agento.initiativeMember.ready     inline=agento.planInitiativeMember
  planned-delivery   state=planned      contextValue=agento.initiativeMember.in-flight inline=NONE
  building-delivery  state=in-progress  contextValue=agento.initiativeMember.in-flight inline=NONE
  review-delivery    state=in-review    contextValue=agento.initiativeMember.in-flight inline=NONE
```

- **Observed:** no inline menu contribution matches `agento.initiativeMember.in-flight`,
  so VS Code renders no button on those rows. The only member command,
  `agento.planInitiativeMember`, rejects non-ready members with "Only ready initiative
  members can be planned." (`extension/src/extension.ts`).
- **Expected:** in-flight member rows show a play button that opens the actions picker
  the Deliveries view offers for that slug.

A screenshot was not captured: the inline button is determined entirely by the
manifest `when` clause matching the row's `contextValue`, which the textual
reproduction proves; the extension UI cannot be driven by the browser tools. The
Builder's electron run (`npm run test:electron`) is the faithful UI check.

## Decisions

Clarifying questions were asked via the ask-questions tool. The user's answer to every
question was, verbatim: "The user is not available to respond and will review your
work later. Work autonomously and make good decisions." The recommended option was
therefore taken for each:

1. **Expected behavior** — "Show the same actions picker the Deliveries tree offers for
   that slug" (reuse `agento.showActions` with the matching delivery's
   allowed/elsewhere actions).
2. **Members in scope** — "In flight (planned / in-progress / in-review)". Complete and
   Blocked members get no button.
3. **No matching delivery** — "Show an informational message and do nothing".
4. **Verification** — "Unit tests + extension electron activation test
   (`npm run test:electron`)".

## Research

Skills consulted: none — no matching domain (the repository has no `.agents/skills/`
directory and AGENTS.md has no `## Agento` skills table).

Findings (file evidence):

- `extension/package.json` `contributes.menus["view/item/context"]` has exactly two
  entries: `agento.showActions` for `view == agento.deliveries && viewItem ==
  agento.delivery` and `agento.planInitiativeMember` for `view == agento.initiatives
  && viewItem == agento.initiativeMember.ready`. Both commands already use
  `"icon": "$(play)"`.
- `extension/src/initiativeTreePresentation.ts` `initiativeTreeItemSpec` gives member
  rows `contextValue: agento.initiativeMember.<groupKind>` where `groupKind` is
  `ready | in-flight | blocked | complete` (`extension/src/initiativeTreeModel.ts`
  `groupFor`: any state other than `complete`/`unplanned` is `in-flight`).
- `MemberElement` (`extension/src/initiativeTreePresentation.ts`) carries `item.slug`,
  `item.state`, `item.roadmap`, `item.branch`, `groupKind`, `initiativeSlug`.
- `agento.showActions` (`extension/src/extension.ts`) resolves its source with
  `deliveryActionSource(element)` (`extension/src/actionPicker.ts`), which only accepts
  `DeliveryTreeElement` of kind `delivery`, falling back to the session's actions; it
  shows "No Agento actions are available in this window." when the source has no
  actions, then `pickCommandAction` → `agento.dispatchAction`.
- Delivery actions come from `agento.mjs status --pr` per item
  (`extension/src/deliveryTreeModel.ts` `actions: CommandAction[]` via
  `projectCommandActions`), and `DeliveryTreeProvider.current` exposes the latest
  `DeliveryTreeSnapshot` (`extension/src/deliveryTreeProvider.ts`). Delivery `slug`
  and initiative member `slug` are the same feature slug, so a slug lookup joins them.
- `actionPicker.ts` imports `vscode`, so unit tests (`node --test`, no VS Code host)
  cannot import it; the new resolver must live in a vscode-free module to be unit
  testable, following the existing split (`deliveryTreeModel.ts` vs
  `deliveryTreeProvider.ts`).
- `extension/test/unit/extensionIntegration.test.ts` asserts the exact
  `view/item/context` array with `deepEqual`; it must be updated with the new entry.
- The electron fixture (`extension/test/electron/suite.ts`) already has
  `planned-delivery` and `building-delivery` as both Deliveries rows and In-flight
  initiative members, so the slug join is exercisable there.
- Docs mentioning the member play action: `docs/extension.md` ("The play action on a
  ready member starts the guided planning flow"), `extension/README.md` line ~54,
  `CHANGELOG.md`.

Lint baseline (policy §5), run 2026-10-03 in the product checkout at `0d65927`:

- `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` → exit 127,
  `shellcheck: command not found` on this machine. Not run; no findings recorded.
  This delivery touches no shell files, so the gate is unaffected; the Builder re-runs
  it if `shellcheck` is available and otherwise records the same 127.
- `cd extension && npm run typecheck` (`tsc --noEmit -p ./`) → exit 0, no findings.
- There is no JS/TS lint command in AGENTS.md beyond the typecheck; the test suites
  (`node --test`, `npm run test:unit`, `npm run test:electron`) are the remaining
  repository-wide checks.

Overlap decision: the baseline is green for everything that ran and the only unrun
check covers files outside this delivery. A **full gate** applies — rerun the
extension typecheck, unit tests, and electron test at the end; no scoped gate needed.

Open delivery branches: `gh pr list --state open` returned `[]` on 2026-10-03 — no
concurrent-delivery overlap.

## Approach

Affected package: `extension/` only (plus docs/changelog).

1. **Resolver (vscode-free).** New `extension/src/initiativeMemberActions.ts`
   exporting `initiativeMemberActionSource(element, deliveries)`: given an
   `InitiativeTreeElement` and the current `DeliveryTreeModel`, return
   `{ slug, actions }` for a `member` element whose `groupKind === "in-flight"` by
   finding the delivery item with the same `slug` across the model's groups
   (`actions` from that item); return `{ slug, actions: [] }` when the model is
   `ready` but has no such slug (or is not `ready`); return `null` for any other
   element.
2. **Command wiring.** In `extension/src/extension.ts` `agento.showActions` accepts
   `DeliveryTreeElement | InitiativeTreeElement`, resolving
   `deliveryActionSource(element) ?? initiativeMemberActionSource(element,
   deliveries.current.model) ?? <session fallback>`. An empty `actions` array already
   produces the informational message "No Agento actions are available in this
   window." — extend the message to name the slug when one is known so the
   no-matching-delivery case is understandable. The initiative-member branch must not
   fall through to the session actions.
3. **Manifest.** Add to `extension/package.json` `view/item/context`:
   `{ "command": "agento.showActions", "when": "view == agento.initiatives &&
   viewItem == agento.initiativeMember.in-flight", "group": "inline" }`. The command's
   existing `$(play)` icon renders the button. Update the `deepEqual` in
   `extension/test/unit/extensionIntegration.test.ts`.
4. **Regression test.** `extension/test/unit/initiativeMemberActions.test.ts` (header
   comment: `// Regression test for #82 initiative-member-play-button`) asserting:
   the manifest contains the in-flight inline contribution; the resolver returns the
   matching delivery's actions for an in-flight member; returns empty actions when no
   delivery matches; returns `null` for ready/blocked/complete members and non-member
   elements. It fails before the fix (missing module and manifest entry).
5. **Electron coverage.** In `extension/test/electron/suite.ts`, assert that the
   In-flight member `building-delivery` resolves (via the exported resolver and
   `api.deliveries.current`) to the same `actions` as the Deliveries row
   `building-delivery`, and that the in-flight member's `contextValue` is
   `agento.initiativeMember.in-flight`.
6. **Docs.** `docs/extension.md` and `extension/README.md`: describe the in-flight
   member play action; `CHANGELOG.md`: a **Fixed** entry referencing #82.
7. Bump nothing else; `extension/cli/` is untouched (no CLI change).

## Risks

- **Deliveries snapshot staleness.** The initiative tree and deliveries tree refresh
  independently (`latestInitiativeRefresh` vs `latestDeliveryRefresh`); a member may
  briefly be in flight before its delivery appears. Mitigation: the "no actions"
  message names the slug and the user can refresh; no new polling.
- **Manifest `deepEqual` test** in `extensionIntegration.test.ts` fails until updated —
  intended; step 2.3 updates it in the same commit as the manifest change.
- **Electron test environment.** `npm run test:electron` downloads VS Code; if the
  download is unavailable the Builder records the failure and retries rather than
  skipping — policy §6.
- No concurrent-delivery overlap (no open PRs at planning time); still integrate
  `origin/main` before every push (policy §7).

## Out of scope

- Buttons for **Complete** or **Blocked** members.
- Changing what `agento.mjs status` allows per delivery, or any CLI change.
- Redesigning the actions picker or adding direct-dispatch (one-click) commands.
- Screenshots of the live tree (not browser-drivable; electron test is the UI check).

## Acceptance checklist

- [ ] `extension/test/unit/initiativeMemberActions.test.ts` (references #82 /
  `initiative-member-play-button`) fails on `origin/main` before the fix and passes
  after it — verify: `cd extension && npm run test:unit` before and after.
- [ ] `extension/package.json` contributes an `inline` `view/item/context` entry for
  `agento.showActions` with `when: view == agento.initiatives && viewItem ==
  agento.initiativeMember.in-flight` — verify: `extensionIntegration.test.ts`
  `deepEqual` passes with the three-entry array.
- [ ] `agento.showActions` invoked with an in-flight member element opens the picker
  with the matching delivery's actions and never falls back to session actions —
  verify: unit test for the resolver + electron suite assertion that
  `building-delivery` member actions equal the Deliveries row's actions.
- [ ] An in-flight member whose slug has no Deliveries entry shows an informational
  message naming the slug and dispatches nothing — verify: unit test asserts empty
  `actions`; electron/unit assertion on the message path.
- [ ] Ready, Blocked, and Complete members are unchanged (Ready keeps `Plan`; others
  get no button) — verify: `initiativeTreeProvider.test.ts` and the manifest test.
- [ ] `docs/extension.md`, `extension/README.md`, and `CHANGELOG.md` describe the
  in-flight play action — verify: grep for `in-flight`/`In flight` play wording.
- [ ] Full gate: `cd extension && npm run typecheck` exit 0, `npm run test:unit`
  exit 0, `npm run test:electron` exit 0, and `node --test 'scripts/**/*.test.mjs'
  'tests/**/*.test.mjs'` exit 0 — verify: recorded exit codes in the roadmap.

## Resolution

**Root cause.** `extension/package.json` contributed inline `view/item/context`
actions only for `viewItem == agento.delivery` (Deliveries) and
`viewItem == agento.initiativeMember.ready` (Initiatives). Member rows in the
In flight group carry `contextValue` `agento.initiativeMember.in-flight`, which no
`when` clause matched, so VS Code rendered no button; and `agento.showActions`
only understood Deliveries elements, so even a matching menu entry would have
fallen back to the session's actions.

**What changed** (product commits `9809449`..`5de7202`):

- `extension/src/initiativeMemberActions.ts` (new, vscode-free):
  `initiativeMemberActionSource(element, model)` returns the matching Deliveries
  item's `actions` for an in-flight member by slug, `{ slug, actions: [] }` when no
  delivery matches (or the Deliveries model is not ready), and `null` otherwise.
- `extension/src/extension.ts`: `agento.showActions` accepts Deliveries or
  Initiatives elements; a member element resolves through the new resolver and
  never falls back to session actions; the empty-actions message names the slug
  (`No Agento actions are available for <slug> in this window.`).
  `extension/src/actionPicker.ts` `deliveryActionSource` accepts either element
  type (still matching only `kind: "delivery"`).
- `extension/package.json`: inline `agento.showActions` (`$(play)`) for
  `view == agento.initiatives && viewItem == agento.initiativeMember.in-flight`;
  `extensionIntegration.test.ts` updated to the three-entry array.
- Electron suite asserts the In flight member `building-delivery` has
  `contextValue` `agento.initiativeMember.in-flight` and resolves to the same
  `actions` as the Deliveries row `building-delivery`.
- `docs/extension.md`, `extension/README.md`, `CHANGELOG.md` (**Fixed**, #82).

**Proof.** `extension/test/unit/initiativeMemberActions.test.ts` (`// Regression
test for #82 initiative-member-play-button`) failed at `9809449` — `npm run
test:unit` exit 2, `error TS2307: Cannot find module
'../../src/initiativeMemberActions.js'` — and passes after the fix: `npm run
test:unit` exit 0 (110/110). `npm run typecheck` 0, `npm run test:electron` 0
(in-repo, companion, workspace scenarios passed), `node --test
'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` 0 (274/274), `shellcheck` 127
(not installed; matches the baseline).
