```yaml
status: planned
branch: feature/completed-initiatives-folder
last-updated: 2026-10-08
next-step: "1.1 Record the extension baseline"
```

## Phase 1: Baseline

- [ ] 1.1 Install extension dependencies and record the extension baseline: `cd extension && npm ci`, then `npm run build`, `npm run test:unit` (pass count), `npm run test:electron`; record exit codes and counts on this line next to the planning baseline (shellcheck via `git ls-files '*.sh' | xargs pnpm dlx shellcheck` exit 0 no findings; node tests 340/340; build clean; unit 124/124); a red extension baseline triggers the §5 overlap reassessment before continuing — verify: the results are recorded here and `git status --porcelain --untracked-files=all` is empty

## Phase 2: Completed folder in the Initiatives tree

- [ ] 2.1 `extension/src/initiativeTreePresentation.ts`: add `CompletedFolderElement` (`{ kind: "completed"; items: InitiativeTreeItem[] }`) to `InitiativeTreeElement`; at the root of a `ready` model return non-completed initiatives (not `done && valid`) in CLI order, then one completed folder only when at least one initiative is `done && valid`; folder children are those initiatives as `initiative` elements in CLI order — verify: `cd extension && npm run build` exit 0
- [ ] 2.2 `initiativeTreeItemSpec` for the folder: label `Completed (<n>)`, `collapsible: "collapsed"`, `idParts: ["completed"]`, `contextValue: "agento.initiativesCompleted"`, icon `archive`, tooltip with the count, no command; confirm `extension/src/initiativeTreeProvider.ts` needs no change (or make the minimal mapping change) — verify: `cd extension && npm run build` exit 0
- [ ] 2.3 `extension/test/unit/initiativeTreeProvider.test.ts`: mixed model (active, done+valid, done+invalid) → root `[active, done+invalid, folder]` with the folder holding only done+valid; all-done → only the folder; none done → no folder; folder spec (label, collapsed, idParts, context value, icon, no command); a nested initiative's spec and children equal the root form — verify: `cd extension && npm run build && npm run test:unit` exit 0 with the new cases counted

## Phase 3: Integration evidence and docs

- [ ] 3.1 Electron fixture and suite: in `extension/test/electron/runTest.ts` add initiative `finished-initiative` (breakdown with one member `finished-delivery`) and a `status: complete` roadmap for `finished-delivery` with `initiative: "finished-initiative"` (parameterize the `roadmap()` helper's initiative); in `extension/test/electron/suite.ts` assert the root is `agento-extension` then a folder labelled `Completed (1)` with `collapsibleState === Collapsed`, an `id` starting with `agento:`, `contextValue === "agento.initiativesCompleted"`, whose only child is `finished-initiative`; update the Deliveries label assertions for the new shipped delivery — verify: `cd extension && npm run build && npm run test:electron` exit 0 in all scenarios
- [ ] 3.2 `docs/extension.md` `## Initiatives`: state that initiatives whose members are all complete (and whose breakdown is valid) are grouped under a collapsed **Completed (N)** folder after the active ones, hidden when none are complete; add a `CHANGELOG.md` `## Unreleased` entry — verify: `grep -n "Completed (N)" docs/extension.md CHANGELOG.md` matches both files
- [ ] 3.3 Package the extension for the manual check: `cd extension && npm run package`, and name the produced `.vsix` absolute path on this line (the `.vsix` is a byproduct: delete it after 3.4, never commit it) — verify: `npm run package` exit 0 and the named file exists
- [ ] 3.4 (manual) In your own VS Code: Extensions view → `…` → *Install from VSIX…* → select the `.vsix` named in 3.3; run *Developer: Reload Window*; open the Agento activity-bar container and take a screenshot of the Initiatives view showing the collapsed `Completed (N)` folder (on this repository all three initiatives are complete, so it shows `Completed (3)` and no other initiative rows; no secrets visible) — verify: screenshot saved as `evidence/step-3-4-completed-folder.png` and linked on this line, showing the collapsed `Completed (N)` folder as the last root row of Initiatives

## Phase 4: Verification

- [ ] 4.1 Full gate after merging `origin/main`: `git ls-files '*.sh' | xargs pnpm dlx shellcheck`, `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`, `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt`, `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt`, `cd extension && npm run build && npm run test:unit && npm run test:electron`, `node --test tests/extension-bundle.test.mjs`; record each result against the step 1.1 baseline on this line — verify: all exit 0, shellcheck no findings, node ≥ 340, unit ≥ 124 with every new case attributed to this delivery, and `git status --porcelain --untracked-files=all` empty in both halves
