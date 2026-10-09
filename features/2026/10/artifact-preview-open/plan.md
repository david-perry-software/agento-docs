# Open roadmaps and breakdowns as a Markdown preview in the active editor group

## Problem

Clicking a delivery in the dashboard's Deliveries view runs `agento.openRoadmap`, and
clicking an initiative or initiative member in the Initiatives view runs
`agento.openBreakdown`. Both handlers open the file as a source text editor with
`viewColumn: vscode.ViewColumn.Beside`
([extension/src/deliveryTreeProvider.ts](https://github.com/david-perry-software/agento/blob/main/extension/src/deliveryTreeProvider.ts)
`openRoadmap`, lines 110-113;
[extension/src/initiativeTreeProvider.ts](https://github.com/david-perry-software/agento/blob/main/extension/src/initiativeTreeProvider.ts)
`openBreakdown`, lines 72-75). So every click splits the editor area into a new group
next to the active editor, and the user sees raw Markdown.

The user wants these files to open in the main editor area instead of a new split,
and to open as a rendered Markdown preview.

## Decisions

Clarifying questions asked on 2026-10-09 (recommended option marked); answers verbatim:

1. **Tree clicks currently open roadmap/breakdown with ViewColumn.Beside (a split
   editor group). Which behavior do you want?**
   Options: *Open in the active (main) editor group, no split* (recommended) / Always
   the first editor group (ViewColumn.One) / It actually opens a separate VS Code
   window — fix that.
   Answer: "Open in the active (main) editor group, no split" (the recommended option).
2. **What does 'preview mode' mean here?**
   Options: *Rendered Markdown preview only (markdown.showPreview)* (recommended) /
   Rendered preview plus the source editor / VS Code preview tab (italic, replaced by
   the next click), source text.
   Answer: "Rendered Markdown preview only (markdown.showPreview)" (the recommended
   option).
3. **Which opens are in scope?**
   Options: *Both tree clicks: Deliveries → roadmap.md and Initiatives → breakdown.md*
   (recommended) / Also any other place the extension opens artifact files.
   Answer: "Both tree clicks: Deliveries → roadmap.md and Initiatives → breakdown.md"
   (the recommended option).
4. **Should the rendered preview be configurable?**
   Options: *No setting — always open as preview* (recommended) / Add a setting
   (preview | source), default preview.
   Answer: "No setting — always open as preview" (the recommended option).
5. **When clicking several items in a row, how should tabs behave?**
   Options: *Each click opens/focuses that file's own preview tab* (recommended) / One
   reusable preview tab replaced on each click.
   Answer: "Each click opens/focuses that file's own preview tab" (the recommended
   option).

Interpretation of answers 2 and 5 together: the `markdown.showPreview` command opens a
*dynamic* preview, and an unlocked dynamic preview in the same group is reused for
the next file. That conflicts with answer 5. The plan therefore opens the built-in
Markdown extension's preview **custom editor** (`vscode.markdown.preview.editor`)
through `vscode.openWith`. This gives the same rendered preview (answer 2) as one tab
per file, and a repeat click focuses the existing tab (answer 5).

## Research

Skills consulted: none — no matching domain (this repository has no `.agents/skills/`
directory and its AGENTS.md has no `## Agento` skills table).

- **Click wiring.**
  - Deliveries leaves set `item.command = { command: "agento.openRoadmap", arguments:
    [Uri.file(<roadmapRoot>/<roadmap>)] }`
    (`extension/src/deliveryTreeProvider.ts` lines 77-81).
  - Initiative and member rows get `agento.openBreakdown` with the resolved
    `breakdown.md` path from the pure `initiativeTreeItemSpec`
    (`extension/src/initiativeTreePresentation.ts` `breakdownCommand`, lines 75-84).
  - Both commands are registered in `extension/src/extension.ts` lines 293-294 and
    declared in `extension/package.json` `contributes.commands` (lines 67 and 72).
  - Both handlers are the same two lines:
    `openTextDocument(uri)` then
    `showTextDocument(document, { viewColumn: ViewColumn.Beside })`.
- **Why it looks like a "new window".** `ViewColumn.Beside` creates (or reuses) the
  editor group to the right of the active one. The artifact files are opened in the
  same VS Code window: in companion mode they live in the companion half (or
  `../agento-docs`), but `openTextDocument` + `showTextDocument` never switches
  windows. No `vscode.openFolder` or `code --new-window` is involved; those are only
  used by command routing (`openTarget` in `extension/src/extension.ts` lines
  295-299).
- **Markdown preview options** (checked against the installed VS Code's
  `extensions/markdown-language-features/package.json`).
  - `contributes.customEditors` declares `vscode.markdown.preview.editor` ("Markdown
    Preview", priority `option`, selector `*.md`).
  - Commands are `markdown.showPreview`, `markdown.showPreviewToSide`, and
    `markdown.showLockedPreviewToSide`. The non-locked dynamic preview is reused per
    group, so it cannot give one tab per file.
  - `vscode.openWith(uri, viewType, columnOrOptions)` opens a custom editor in a
    given column with `TextDocumentShowOptions`. An existing tab for the same
    resource and view type is focused rather than duplicated.
- **Tests that pin the current behavior.**
  - `extension/test/electron/suite.ts` lines 651-661 open `.github/agento.json` in
    `ViewColumn.One`, run the delivery item's command, and assert the roadmap text
    editor is in `ViewColumn.Two`.
  - Lines 763-775 do the same for the ready member's breakdown.
  - Both assertions must change. The other assertions in those blocks (the URI and
    the companion-mode artifact root) stay.
  - `extension/test/unit/extensionIntegration.test.ts` lines 23-24 and
    `extension/test/electron/suite.ts` lines 509-510 only assert the command ids
    exist. Ids stay unchanged.
  - `extension/test/unit/initiativeTreeProvider.test.ts` lines 104-109 assert the
    `agento.openBreakdown` spec. Unchanged.
- **Electron host.** `extension/test/electron/runTest.ts` launches with
  `--disable-extensions` (lines 226 and 235). That flag disables installed
  extensions, not built-ins, so `vscode.markdown-language-features` should be active.
  Step 3.1 confirms it with an explicit assertion.
- **Unit-test pattern.** Unit tests import only `vscode`-free modules (for example
  `extension/src/windowBanner.ts`, `extension/src/statusStyle.ts`). The new open logic
  therefore goes into a pure module with injected callbacks.
- **Docs.** `docs/extension.md` line 36 says "Select a delivery to open its
  `roadmap.md` beside the active editor"; lines 44-45 say "Select an initiative or
  member to open its `breakdown.md`". `CHANGELOG.md` has an `## Unreleased` section.
- **Lint baseline (policy §5), 2026-10-09 at product `4b38ce5`.**
  - Full-repository shell lint: `git ls-files '*.sh' | xargs pnpm dlx shellcheck`,
    exit 0, no findings. This is the same `pnpm dlx` form earlier extension
    deliveries used because a bare `shellcheck` is not on this machine's `PATH`.
  - Extension typecheck: `cd extension && npm ci && npm run typecheck`, exit 0, no
    findings.
  - Supporting baselines: `node --test 'scripts/**/*.test.mjs'
    'tests/**/*.test.mjs'` exit 0, 340/340; `cd extension && npm run test:unit`
    exit 0, 152/152.
  - **Overlap decision:** the baseline is green, so nothing overlaps. The **full
    gate** applies: full shell lint, extension typecheck/build, and every test suite
    must stay green. No scoped gate is needed.
- **Concurrent deliveries:** `gh pr list --state open` returned no open PRs in either
  `agento` or `agento-docs` at planning time, so there is no file overlap.

## Approach

All code changes are in `extension/`; `scripts/` and the CLI are unchanged.

1. **Pure open module** `extension/src/openArtifact.ts` (no `vscode` import):
   - `export const MARKDOWN_PREVIEW_VIEW_TYPE = "vscode.markdown.preview.editor";`
   - `export async function openArtifactPreview<U>(uri: U, deps: { openWith(uri: U,
     viewType: string): Thenable<unknown>; openSource(uri: U): Thenable<unknown>;
     log(message: string): void }): Promise<"preview" | "source">`.
   - It calls `deps.openWith(uri, MARKDOWN_PREVIEW_VIEW_TYPE)` and returns
     `"preview"`. If that rejects (for example, the built-in Markdown extension is
     disabled), it logs one line through `deps.log` and calls `deps.openSource(uri)`,
     returning `"source"`.
2. **Wire both commands** in `extension/src/extension.ts`:
   - Register `agento.openRoadmap` and `agento.openBreakdown` with one shared handler
     `(uri: vscode.Uri) => openArtifactPreview(uri, deps)`.
   - `deps.openWith` runs `vscode.commands.executeCommand("vscode.openWith", uri,
     viewType, { viewColumn: vscode.ViewColumn.Active, preview: false })`.
   - `deps.openSource` runs `vscode.window.showTextDocument(uri, { viewColumn:
     vscode.ViewColumn.Active, preview: false })`.
   - `deps.log` appends to the existing `output` channel.
   - Remove the now-unused `openRoadmap` export from `deliveryTreeProvider.ts` and
     `openBreakdown` from `initiativeTreeProvider.ts`, along with their imports in
     `extension.ts`.
   - Command ids, titles, and `package.json` contributions are unchanged.
   - `preview: false` pins the tab, so each file keeps its own tab (decision 5).
     `ViewColumn.Active` opens in the active group, with no split (decision 1).
3. **Unit tests** in new `extension/test/unit/openArtifact.test.ts`:
   - Success: `openWith` receives the URI and `vscode.markdown.preview.editor`;
     `openSource` is not called; the result is `"preview"`.
   - Rejection: `openSource` is called once with the same URI; `log` receives one
     line; the result is `"source"`.
4. **Electron tests** in `extension/test/electron/suite.ts`: replace the
   `ViewColumn.Two` text-editor assertions in both blocks. After focusing
   `.github/agento.json` in `ViewColumn.One` and running the item's command, assert:
   - `vscode.extensions.getExtension("vscode.markdown-language-features")` is active.
   - `vscode.window.tabGroups.all.length === 1`, so there is no split.
   - The active tab's `input` is a `vscode.TabInputCustom` with `viewType ===
     "vscode.markdown.preview.editor"` and `uri.fsPath` equal to the command's URI.
     The tab is not a preview tab (`isPreview === false`), and its group's
     `viewColumn` is `ViewColumn.One`.
   - No visible text editor shows that URI, so only the preview opens.
   - Running the same command again leaves exactly one tab for that URI and view
     type.

   The delivery block uses the roadmap and the member block uses the breakdown,
   including the companion-mode artifact root assertion that already exists.
5. **Docs.**
   - `docs/extension.md`: change line 36 to say a delivery opens its `roadmap.md` as
     a rendered Markdown preview in the active editor group. Change lines 44-45 the
     same way for `breakdown.md`. Add one sentence: use **Reopen Editor With… → Text
     Editor** to edit the source.
   - `CHANGELOG.md`: add a `## Unreleased` **Changed.** entry.

## Risks

- **Built-in Markdown extension disabled or missing.** `vscode.openWith` would
  reject. Mitigation: `openArtifactPreview` falls back to the source text editor in
  the active group and logs the reason; this is covered by a unit test.
- **Electron host without built-ins.** If `--disable-extensions` turns out to disable
  `vscode.markdown-language-features` in the test host, the new electron assertions
  fail. Mitigation: step 3.1 asserts activation first. If it fails, the Builder adds
  the smallest fix in `extension/test/electron/runTest.ts` (for example, replacing
  `--disable-extensions` with explicit `--disable-extension` ids). The Builder
  records the fix as an `(added …)` step and does not weaken the assertion.
- **Editing friction.** A preview cannot be edited in place. Mitigation: this is the
  requested behavior (decision 4: no setting). The docs name **Reopen Editor With… →
  Text Editor**, and the preview's own "Open Source" action still works.
- **Behavior change for existing users.** The split beside the active editor goes
  away. Mitigation: a CHANGELOG entry and the docs update.
- **Concurrent deliveries.** There are none open now. Mitigation: integrate
  `origin/main` into both halves before every push.

## Out of scope

- Opening any other artifact (plan.md, review.md, brief.md, evidence) or opens from
  notifications and command routing (decision 3).
- A setting to choose preview vs source (decision 4).
- Changing `vscode.openFolder` / new-window routing for cross-window commands.
- Locking, scroll sync, or any change to how the Markdown preview itself renders.

## Acceptance checklist

- [ ] Clicking a Deliveries leaf opens its `roadmap.md` as a pinned
  `vscode.markdown.preview.editor` custom-editor tab in the active editor group. No
  second editor group is created and no source text editor is shown. Verify: the
  electron suite's delivery block assertions (`tabGroups.all.length === 1`,
  `TabInputCustom.viewType`, `isPreview === false`, no visible text editor for the
  URI) pass in all scenarios. Scope (added 2026-10-09, review round 1): "all
  scenarios" means the in-repo and companion scenarios; the workspace scenario returns before the tree blocks, unchanged from `main`.
- [ ] Clicking an initiative member (same `agento.openBreakdown` command as the
  initiative row) opens its `breakdown.md` the same way, from the companion artifact
  root in the companion scenario. Verify: the electron suite's member block
  assertions pass in all scenarios (the in-repo and companion scenarios, as above).
- [ ] Clicking the same item twice focuses the existing preview tab instead of
  opening a duplicate. Verify: the electron repeat-click assertion (exactly one
  matching tab).
- [ ] When the Markdown preview cannot be opened, the file opens as source text in
  the active group and one line is logged. Verify: the `openArtifact.test.ts`
  rejection case.
- [ ] Command ids `agento.openRoadmap` and `agento.openBreakdown` and their manifest
  entries are unchanged, and the old `openRoadmap`/`openBreakdown` exports are gone.
  Verify: `extensionIntegration.test.ts` passes, and `grep -rn "ViewColumn.Beside\|
  export async function openRoadmap\|export async function openBreakdown"
  extension/src` has no matches.
- [ ] `docs/extension.md` describes the preview-in-active-group behavior and the
  Reopen Editor With escape hatch, and `CHANGELOG.md` `## Unreleased` has the entry.
  Verify: `grep -n "Markdown preview" docs/extension.md` and `grep -n -i "markdown
  preview" CHANGELOG.md` both match.
- [ ] The full gate is green against the baseline:
  - shellcheck (`git ls-files '*.sh' | xargs pnpm dlx shellcheck`) exit 0 with no
    findings;
  - node tests ≥ 340 passing;
  - both guard smokes exit 0;
  - extension typecheck and build exit 0;
  - extension unit tests ≥ 152 passing, with every new case attributed to this
    delivery;
  - `npm run test:electron` passes all scenarios (3/3);
  - `node --test tests/extension-bundle.test.mjs` exits 0.

  Verify: roadmap step 4.1's recorded results.
- [ ] In the user's VS Code with the packaged VSIX, a delivery click and a member
  click each show a rendered preview tab in the main editor group, with no split.
  Verify: `evidence/step-3-4-preview-open.png` linked from roadmap step 3.4 (delivery
  click) and `evidence/step-3-5-breakdown-preview.png` linked from roadmap step 3.5
  (member click; added 2026-10-09, review round 1).
- [ ] Both halves are clean at handoff. Verify: `git status --porcelain
  --untracked-files=all` is empty in the product worktree and the companion half.
