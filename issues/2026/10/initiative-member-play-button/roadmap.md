```yaml
status: in-progress
branch: issue/initiative-member-play-button
last-updated: 2026-10-03
next-step: "5.4 full gate, integrate origin/main into both halves, set in-review"
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
- [x] 3.2 Run the electron suite in the companion scenario too if the runner supports `AGENTO_ELECTRON_SCENARIO=companion` (check `extension/test/electron/runTest.ts`) — verify: exit 0 recorded, or a note that the runner covers both scenarios in one invocation — 2026-10-03: `runTest.ts` iterates `in-repo`, `companion`, and `workspace` (setting `AGENTO_ELECTRON_SCENARIO`) in one `npm run test:electron`; exit 0, all three "scenario passed" lines printed

## Phase 4: Docs and gate

- [x] 4.1 Update `docs/extension.md` (Initiatives section) and `extension/README.md` to describe the play action on in-flight members (opens the delivery's actions picker; informational message when no delivery matches) — verify: `grep -n "in flight\|In flight\|in-flight" docs/extension.md extension/README.md` shows the new wording
- [x] 4.2 Add a **Fixed** entry to `CHANGELOG.md` under the unreleased/current section referencing #82 — verify: `grep -n "#82" CHANGELOG.md`
- [x] 4.3 Full gate: `cd extension && npm run typecheck`, `npm run test:unit`, `npm run test:electron`; repo root `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`; `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` if available (record 127 otherwise, matching the baseline) — verify: all recorded exit codes are 0 (shellcheck 127 permitted per baseline), compared against plan.md `## Research` — 2026-10-03: typecheck 0; test:unit 0 (110/110); test:electron 0 (in-repo, companion, workspace passed); node --test 0 (274/274); shellcheck 127 (not installed, matches baseline)
- [x] 4.4 Write plan.md `## Resolution` (root cause, what changed, proof the #82 regression test passes), merge `origin/main` into the product branch and the companion's `origin/main` into the companion branch, push both, and set `status: in-review` — verify: `node scripts/agento.mjs session --pr` reports both PRs, `companion.dirty: false`, `companion.ahead: 0`

## Phase 5: Address review findings

- [x] 5.1 (added 2026-10-03) In `extension/test/electron/suite.ts`, execute `agento.showActions` with an in-flight member element whose slug has no Deliveries row while `vscode.window.showInformationMessage` is temporarily replaced by a recorder; assert exactly one message `No Agento actions are available for <slug> in this window.` and that no picker or dispatch occurred (acceptance item 4's message-path assertion, review.md Finding 1) — verify: `cd extension && npm run test:electron` exit 0 with all three scenarios passed; `npm run typecheck` and `npm run test:unit` exit 0 — 2026-10-03: `assertOrphanMemberShowsMessage` in `suite.ts` stubs `showInformationMessage`/`showQuickPick`; typecheck 0, test:unit 0 (110/110), test:electron 0 (in-repo, companion, workspace passed)
- [x] 5.2 (added 2026-10-03) Reflow the `extension/README.md` Commands paragraph left with a short line by step 4.1 (review.md Finding 2) — verify: `git diff` on `extension/README.md` is whitespace/line-break only (`git diff --word-diff=porcelain` shows no word changes) and no line in the paragraph is short mid-paragraph — 2026-10-03: word-diff shows no word changes; paragraph lines 83–85 chars, last line `dispatch.`
- [x] 5.3 (added 2026-10-03) Add one line to plan.md `## Resolution` noting the slug-named empty-actions message also applies to Deliveries rows (review.md Plan vs implementation deviation) — verify: `grep -n "Deliveries rows" plan.md` shows the line under `## Resolution`
- [ ] 5.4 (added 2026-10-03) Re-run the full gate, integrate `origin/main` into both halves, push both, and set `status: in-review` — verify: typecheck, test:unit, test:electron, root `node --test` exit 0 (shellcheck 127 per baseline); `agento.mjs session` shows `companion.dirty: false`, `companion.ahead: 0`
