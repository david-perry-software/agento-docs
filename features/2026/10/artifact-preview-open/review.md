# Review: artifact-preview-open

Verdict: request-changes

Reviewed 2026-10-09 at product `293d57e` (`feature/artifact-preview-open`, draft PR
#100) and companion `d412d4f` (draft PR #36). `origin/main` is an ancestor of HEAD in
both halves (`git merge-base --is-ancestor` exit 0). Both halves had 0 ahead / 0
behind their remote branch and a clean `git status --porcelain --untracked-files=all`.

Skills consulted: none — no matching domain. This repository has no `.agents/skills/`
directory, and its AGENTS.md has no `## Agento` skills table.

The code, tests, and docs are correct and the full gate is green. The one blocking
gap is evidence: acceptance item 8 requires a member click in the user's VS Code with
the packaged VSIX. Step 3.4's screenshot shows only a delivery click.

## Acceptance checklist results

1. **Delivery click opens a pinned `vscode.markdown.preview.editor` tab in the active
   group, with no split and no source editor — pass.** `extension/src/extension.ts`
   registers `agento.openRoadmap` with the shared `openArtifact` handler. Its
   `openWith` runs `vscode.openWith` with `{ viewColumn: ViewColumn.Active, preview:
   false }`. In `extension/test/electron/suite.ts`, `assertOpensMarkdownPreview`
   asserts every item the plan lists: the Markdown extension is active,
   `tabGroups.all.length === 1`, `TabInputCustom.viewType`, `isPreview === false`,
   `ViewColumn.One`, and no visible text editor for the URI. The delivery block calls
   it. My run of `npm run test:electron` exited 0 with all 3 scenarios passing.
   Note: the delivery and member blocks run in the in-repo and companion scenarios.
   The workspace scenario returns at `suite.ts` line 583, before the tree blocks; that
   was already true on `main`.
2. **Member click opens `breakdown.md` the same way, from the companion artifact root
   in the companion scenario — pass.** The member block calls the same helper, and
   the existing `expectedArtifactRoot` assertion is kept (`suite.ts` lines 809-813).
   The companion scenario passed in my electron run.
3. **A repeat click focuses the existing tab — pass.** The helper refocuses
   `activeDocument`, reruns the command, and asserts `previewTabsFor(uri).length ===
   1` and `tabGroups.all.length === 1`. This passed in my electron run.
4. **Falls back to source text in the active group and logs one line — pass.**
   `extension/test/unit/openArtifact.test.ts` has a rejection case that asserts
   `result === "source"`, `openSource` called with `[URI]`, and exactly one log line.
   `npm run test:unit` exited 0 with 154/154 passing (`ok 112`, `ok 113` are the two
   new cases). `openSource` uses `showTextDocument(uri, { viewColumn: Active,
   preview: false })`.
5. **Command IDs and manifest unchanged; old exports gone — pass.** `git diff
   origin/main...HEAD -- extension/package.json` is empty. Running `grep -rn
   "ViewColumn.Beside\|export async function openRoadmap\|export async function
   openBreakdown" extension/src` exited 1 with no matches.
   `extensionIntegration.test.ts` is part of the passing unit run.
6. **Docs and CHANGELOG — pass.** `grep -n "Markdown preview" docs/extension.md`
   matches lines 36 and 48. `grep -n -i "markdown preview" CHANGELOG.md` matches
   lines 7 and 10. `docs/extension.md` line 38 names **Reopen Editor With… → Text
   Editor**. `grep -n "beside the active editor" docs/extension.md` exited 1.
7. **Full gate green against the baseline — pass.** I re-ran every command on
   2026-10-09:
   - `git ls-files '*.sh' | xargs pnpm dlx shellcheck`: exit 0, no findings
     (baseline: exit 0, no findings).
   - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`: exit 0, 340/340.
   - Guard smoke: exit 0. Companion guard smoke: exit 0.
   - Extension `npm run typecheck`: exit 0. `npm run build`: exit 0.
   - `npm run test:unit`: exit 0, 154/154 (baseline 152; the 2 new cases are this
     delivery's `openArtifactPreview` tests).
   - `npm run test:electron`: exit 0, 3/3 scenarios.
   - `node --test tests/extension-bundle.test.mjs`: exit 0, 4/4.
8. **User's VS Code with the packaged VSIX: a delivery click and a member click each
   show a rendered preview tab in the main group, with no split — fail.**
   `evidence/step-3-4-preview-open.png` shows only the delivery half. It has one
   editor group and the rendered `artifact-repo-hooks` roadmap ("Markdown Preview" in
   the editor title) opened from the highlighted Deliveries row. The Initiatives view
   shows a collapsed `Completed (3)` folder, and no `breakdown.md` tab is visible. The
   Builder recorded this gap on the step line. It substituted the electron coverage
   from item 2, but this item specifically requires the packaged VSIX in the user's
   VS Code. A member was reachable (expand `Completed (3)`), so this is not a
   §4-style impossibility. It is a missing manual check. `code --list-extensions
   --show-versions` still lists `david-perry-software.agento-dashboard@0.7.0`, so the
   check needs no repackaging.
9. **Both halves clean at handoff — pass.** `git status --porcelain
   --untracked-files=all` printed nothing in the product worktree or the companion
   half before this review was written. The `.vsix` byproduct from step 3.3 is gone.

## Plan vs implementation

- The implementation matches plan.md `## Approach` items 1-5. It adds the pure module
  `extension/src/openArtifact.ts` (no `vscode` import), wires both commands to one
  shared handler in `extension.ts`, removes `openRoadmap` and `openBreakdown` and
  their imports, adds the unit tests and electron assertions, and updates the docs
  and CHANGELOG.
- Small deviations, all acceptable:
  - The deps type is exported as the `OpenArtifactDeps<U>` interface instead of an
    inline type.
  - The electron assertions are factored into the shared helpers
    `assertOpensMarkdownPreview`, `runOpenCommandUntilPreviewActive`, and
    `previewTabsFor`.
  - The Markdown-extension activation assertion runs after the first open, not
    before it. The extension activates on demand, so the order in the plan would be
    racy.
- No undocumented changes. The diff touches only the 8 files planned (`git diff
  --stat origin/main...HEAD`). `scripts/` and the CLI are untouched.
- Lint gate (§5): the plan chose the full gate on a green baseline. My fresh
  full-repository shellcheck and the extension typecheck are both exit 0 with no
  findings, matching the baseline.

## Roadmap audit

- 1.1, 2.1, 2.2, 3.1, 3.2, 3.3, 4.1: I spot-checked each against the code and my own
  command runs. The results above match what each step line records.
- **3.4 (manual)** has a linked evidence file, as §3 requires, but the step's own
  action 2 (click an initiative member) and its "roadmap/breakdown preview tabs"
  screenshot cover only the delivery half. Repair: I annotated 3.4 as delivery-half
  evidence only and added **3.5 (manual) (added 2026-10-09)** for the member click,
  with its own evidence file. 3.4 stays ticked because its delivery-click evidence is
  real.
- I set the header to `status: in-progress` and `next-step: "3.5"` so the Builder
  resumes at the new manual step. Its resume protocol then pauses there for the user.
- No falsely ticked automated steps found.

## Findings

1. **Major (blocks approval): missing packaged-VSIX evidence for the member
   (breakdown) click.** This is acceptance item 8. The fix is the new manual step 3.5.
   No code change is expected.
2. **Nit: the fallback trigger is assumed, not observed.** `openArtifactPreview`
   falls back when `vscode.openWith` rejects. The unit test proves the pure logic, but
   no test observes how a real host behaves when the Markdown preview editor is
   unavailable. Whether `vscode.openWith` rejects or silently opens the default
   editor is not verified. Both outcomes leave the file readable, so this is
   low-risk. Recorded as a follow-up, not a blocker.
3. **Nit: the electron assertions run in 2 of 3 scenarios.** The workspace scenario
   exits before the tree blocks (`suite.ts` line 583), so "all scenarios" in plan
   items 1-2 means the two scenarios that have deliveries. This structure is
   unchanged from `main`.

No security findings. The one new log line writes the artifact's local file URI to
the Agento output channel. It has no secrets and no user input beyond a path the
extension already resolved.

## Follow-ups

- Check how `vscode.openWith(uri, "vscode.markdown.preview.editor", …)` behaves in a
  host with `vscode.markdown-language-features` disabled. Either confirm it rejects,
  which triggers the logged source fallback, or adapt the fallback detection.
