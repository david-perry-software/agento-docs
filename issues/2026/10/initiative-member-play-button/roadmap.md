```yaml
status: in-progress
branch: issue/initiative-member-play-button
last-updated: 2026-10-03
next-step: "3.2 record electron companion scenario coverage"
github-issue: "#82"
artifact-pr: "#24"
```

## Phase 1: Expose the defect

- [x] 1.1 Add `extension/test/unit/initiativeMemberActions.test.ts` with header comment `// Regression test for #82 initiative-member-play-button`, importing `initiativeMemberActionSource` from `../../src/initiativeMemberActions.js` and asserting: (a) `package.json` `view/item/context` contains `{ command: "agento.showActions", when: "view == agento.initiatives && viewItem == agento.initiativeMember.in-flight", group: "inline" }`; (b) an in-flight member element resolves to the matching delivery's `actions` by slug; (c) an in-flight member with no matching delivery resolves to `{ slug, actions: [] }`; (d) ready/blocked/complete members and non-member elements resolve to `null` — verify: `cd extension && npm run test:unit` exits nonzero and the failure names this test file (missing module / manifest entry)
- [x] 1.2 Commit the test on its own (`test(extension): expose #82 initiative-member-play-button`) with the failing assertion text quoted in the commit body — verify: `git log -1 --format=%B` quotes the failure

## Phase 2: Fix

- [x] 2.1 Create `extension/src/initiativeMemberActions.ts` (no `vscode` import) exporting `initiativeMemberActionSource(element: InitiativeTreeElement | undefined, model: DeliveryTreeModel)` per plan.md `## Approach` step 1 — verify: `cd extension && npm run typecheck` exit 0
- [x] 2.2 Wire `agento.showActions` in `extension/src/extension.ts` to accept `DeliveryTreeElement | InitiativeTreeElement`, resolving `deliveryActionSource(element) ?? initiativeMemberActionSource(element, deliveries.current.model) ?? <session fallback>`, and make the empty-actions message name the slug when known (e.g. `No Agento actions are available for <slug> in this window.`), without falling through to session actions for a member element — verify: `npm run typecheck` exit 0; `extensionIntegration.test.ts` source regexes still match
- [x] 2.3 Add the `view/item/context` inline entry for `agento.showActions` on `viewItem == agento.initiativeMember.in-flight` to `extension/package.json` and update the `deepEqual` in `extension/test/unit/extensionIntegration.test.ts` to the three-entry array — verify: `cd extension && npm run test:unit` exit 0 (the 1.1 regression test now passes)

## Phase 3: Verify in the extension host

- [x] 3.1 Extend `extension/test/electron/suite.ts`: assert the In-flight member `building-delivery` has `contextValue` `agento.initiativeMember.in-flight`, and that `initiativeMemberActionSource(member, api.deliveries.current.model).actions` deep-equals the `actions` of the Deliveries row `building-delivery` (export the resolver through the test API if required) — verify: `cd extension && npm run test:electron` exit 0
- [ ] 3.2 Run the electron suite in the companion scenario too if the runner supports `AGENTO_ELECTRON_SCENARIO=companion` (check `extension/test/electron/runTest.ts`) — verify: exit 0 recorded, or a note that the runner covers both scenarios in one invocation

## Phase 4: Docs and gate

- [ ] 4.1 Update `docs/extension.md` (Initiatives section) and `extension/README.md` to describe the play action on in-flight members (opens the delivery's actions picker; informational message when no delivery matches) — verify: `grep -n "in flight\|In flight\|in-flight" docs/extension.md extension/README.md` shows the new wording
- [ ] 4.2 Add a **Fixed** entry to `CHANGELOG.md` under the unreleased/current section referencing #82 — verify: `grep -n "#82" CHANGELOG.md`
- [ ] 4.3 Full gate: `cd extension && npm run typecheck`, `npm run test:unit`, `npm run test:electron`; repo root `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`; `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` if available (record 127 otherwise, matching the baseline) — verify: all recorded exit codes are 0 (shellcheck 127 permitted per baseline), compared against plan.md `## Research`
- [ ] 4.4 Write plan.md `## Resolution` (root cause, what changed, proof the #82 regression test passes), merge `origin/main` into the product branch and the companion's `origin/main` into the companion branch, push both, and set `status: in-review` — verify: `node scripts/agento.mjs session --pr` reports both PRs, `companion.dirty: false`, `companion.ahead: 0`
