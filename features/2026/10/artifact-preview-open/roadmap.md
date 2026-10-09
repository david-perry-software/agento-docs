```yaml
status: in-progress
branch: feature/artifact-preview-open
last-updated: 2026-10-09
next-step: "2.2 Wire agento.openRoadmap and agento.openBreakdown to openArtifactPreview"
artifact-pr: "#36"
```

## Phase 1: Baseline

- [x] 1.1 Install extension dependencies and record the extension baseline next to the planning baseline. Run `cd extension && npm ci`, then `npm run build`, `npm run typecheck`, `npm run test:unit` (pass count), and `npm run test:electron` (scenario count), and record exit codes and counts on this line. Planning baseline at product `4b38ce5`: shellcheck via `git ls-files '*.sh' | xargs pnpm dlx shellcheck` exit 0, no findings; typecheck exit 0; node tests 340/340; unit 152/152. A red extension baseline triggers the §5 overlap reassessment before continuing — verify: results are recorded on this line and `git status --porcelain --untracked-files=all` is empty in both halves — **2026-10-09 at product `4b1432c`:** `npm ci` exit 0; `npm run build` exit 0; `npm run typecheck` exit 0; `npm run test:unit` exit 0, 152/152; `npm run test:electron` exit 0, 3/3 scenarios (in-repo, companion, workspace). Baseline green, no overlap reassessment needed; both halves clean.

## Phase 2: Open as preview in the active group

- [x] 2.1 Add `extension/src/openArtifact.ts` (no `vscode` import) exporting `MARKDOWN_PREVIEW_VIEW_TYPE = "vscode.markdown.preview.editor"` and `openArtifactPreview(uri, { openWith, openSource, log })` exactly per plan.md `## Approach` item 1. Add `extension/test/unit/openArtifact.test.ts` with the success case (`openWith` gets the URI and view type, `openSource` not called, returns `"preview"`) and the rejection case (one `log` line, `openSource` called once with the same URI, returns `"source"`) — verify: `cd extension && npm run build && npm run test:unit` exit 0 with the two new cases passing — 2026-10-09: exit 0, unit 154/154 (152 baseline + 2 new `openArtifactPreview` cases)
- [ ] 2.2 In `extension/src/extension.ts`, register `agento.openRoadmap` and `agento.openBreakdown` with one shared handler that calls `openArtifactPreview`. `openWith` runs `vscode.commands.executeCommand("vscode.openWith", uri, viewType, { viewColumn: vscode.ViewColumn.Active, preview: false })`; `openSource` runs `vscode.window.showTextDocument(uri, { viewColumn: vscode.ViewColumn.Active, preview: false })`; `log` appends to `output`. Delete `openRoadmap` from `extension/src/deliveryTreeProvider.ts` and `openBreakdown` from `extension/src/initiativeTreeProvider.ts`, and drop their imports. Command ids and `package.json` stay unchanged — verify: `cd extension && npm run build && npm run typecheck && npm run test:unit` exit 0, and `grep -rn "ViewColumn.Beside\|export async function openRoadmap\|export async function openBreakdown" extension/src` prints nothing

## Phase 3: Integration evidence and docs

- [ ] 3.1 In `extension/test/electron/suite.ts`, replace the `ViewColumn.Two` text-editor assertions in the delivery block (around lines 651-661) and the initiative-member block (around lines 763-775) with the assertions in plan.md `## Approach` item 4:
  - `vscode.markdown-language-features` is active;
  - `tabGroups.all.length === 1`;
  - the active tab is a `TabInputCustom` with view type `vscode.markdown.preview.editor` for the command's URI, with `isPreview === false`, in `ViewColumn.One`;
  - no visible text editor shows the URI;
  - a repeat run of the command leaves exactly one matching tab.

  Keep the existing URI and companion artifact-root assertions. If the markdown extension is inactive in the test host, add the minimal `runTest.ts` launch-arg fix as an `(added <date>)` step instead of weakening the assertion. Target: local electron test host, no ports — verify: `cd extension && npm run build && npm run test:electron` exit 0 in all scenarios (in-repo, companion, workspace)
- [ ] 3.2 Update `docs/extension.md`:
  - line 36: a delivery opens its `roadmap.md` as a rendered Markdown preview in the active editor group;
  - lines 44-45: the same for `breakdown.md`;
  - add one sentence on **Reopen Editor With… → Text Editor** for editing the source.

  Add a `CHANGELOG.md` `## Unreleased` **Changed.** entry — verify: `grep -n "Markdown preview" docs/extension.md` and `grep -n -i "markdown preview" CHANGELOG.md` both match, and `grep -n "beside the active editor" docs/extension.md` prints nothing
- [ ] 3.3 Package the extension for the manual check with `cd extension && npm run package`, and name the produced `.vsix` absolute path on this line. The agent installs it into the user's VS Code with `code --install-extension <vsix> --force`. The `.vsix` is a gitignored byproduct: delete it after 3.4 and never commit it — verify: `npm run package` exit 0, the named file exists, and `code --list-extensions --show-versions` lists `david-perry-software.agento-dashboard` at the packaged version
- [ ] 3.4 (manual) In your own VS Code:
  1. Reload the window (Developer: Reload Window) so the VSIX installed in 3.3 is active.
  2. With any file open in the editor, click a delivery in the Agento **Deliveries** view, then an initiative member in **Initiatives**.
  3. Take a screenshot showing the rendered roadmap/breakdown preview tabs in the main editor group with no split, and no secrets visible.

  — verify: the screenshot is saved as `evidence/step-3-4-preview-open.png`, linked on this line, and shows rendered preview tabs in a single editor group

## Phase 4: Verification

- [ ] 4.1 Run the full gate after merging `origin/main` into both halves and record each result against the step 1.1 baseline on this line:
  - `git ls-files '*.sh' | xargs pnpm dlx shellcheck`
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`
  - `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt`
  - `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt`
  - `cd extension && npm run typecheck && npm run build && npm run test:unit && npm run test:electron`
  - `node --test tests/extension-bundle.test.mjs`

  — verify: all commands exit 0; shellcheck has no findings; node ≥ 340; unit ≥ 152 with every new case attributed to this delivery; electron 3/3 scenarios; `git status --porcelain --untracked-files=all` is empty in both halves
