# Review: artifact-preview-open

Verdict: approve

Review round 2 (round 1: `request-changes`). Reviewed 2026-10-09 at product `8a70b19`
(`feature/artifact-preview-open`, draft PR #100) and companion `58bbc0d` (draft PR
#36). After `git fetch origin` in both halves, `origin/main` is an ancestor of HEAD in
both (`git merge-base --is-ancestor` exit 0). Product HEAD equals
`origin/feature/artifact-preview-open`. The session record shows the companion half
on the roadmap branch with `dirty: false`, `ahead: 0`, `behind: 0`. `git status
--porcelain --untracked-files=all` was empty in both halves before and after my gate
run.

Skills consulted: none — no matching domain. This repository has no `.agents/skills/`
directory, and its AGENTS.md has no `## Agento` skills table.

All three round-1 findings are resolved:

- Finding 1 (major, missing member-click evidence) is fixed by step 3.5's screenshot.
- Finding 2 (fallback never observed) is fixed by step 3.6. A real host with the
  Markdown extension disabled now falls back to source text, and an electron scenario
  proves it.
- Finding 3 (electron scope wording) is fixed by step 3.7.

Every acceptance item passes, the full gate is green on my rerun, and no finding is
above nit.

## Acceptance checklist results

1. **Delivery click opens a pinned `vscode.markdown.preview.editor` tab in the active
   group, with no split and no source editor — pass.** `extension/src/extension.ts`
   registers `agento.openRoadmap` with the shared `openArtifact` handler. Its
   `openWith` runs `vscode.openWith` with `{ viewColumn: ViewColumn.Active, preview:
   false }`. In `extension/test/electron/suite.ts`, `assertOpensMarkdownPreview`
   asserts every item the plan lists: the Markdown extension is active,
   `tabGroups.all.length === 1`, `TabInputCustom.viewType`, `isPreview === false`,
   `ViewColumn.One`, and no visible text editor for the URI. The delivery block calls
   it. My run of `npm run test:electron` exited 0 with 4/4 scenarios. The in-repo and
   companion scenarios, which hold the tree blocks, printed "scenario passed". This
   matches the scope the plan now states (step 3.7). The workspace scenario returns at
   `suite.ts` line 606, before the tree blocks, as it already did on `main`.
2. **Member click opens `breakdown.md` the same way, from the companion artifact root
   in the companion scenario — pass.** The member block calls the same helper, and
   the existing `expectedArtifactRoot` assertion is kept (`suite.ts` lines 833-836).
   The companion scenario passed in my electron run.
3. **A repeat click focuses the existing tab — pass.** The helper refocuses
   `activeDocument`, reruns the command, and asserts `previewTabsFor(uri).length ===
   1` and `tabGroups.all.length === 1`. This passed in my electron run.
4. **Falls back to source text in the active group and logs one line — pass.**
   `extension/test/unit/openArtifact.test.ts` covers both fallback triggers:
   - the rejection case (`ok 113`);
   - the new unavailable case (`ok 114`): `previewAvailable()` is false, so there is no
     `openWith` call, `openSource` is called once, one log line is written, and the
     result is `"source"`.

   `npm run test:unit` exited 0, 155/155. The fallback is now observed in a real host.
   The `no-markdown` electron scenario launches with `--disable-extension
   vscode.markdown-language-features`, and `suite.ts` lines 570-591 assert:
   - the extension is `undefined`;
   - a Deliveries click returns `"source"`;
   - the active tab is a pinned `TabInputText` for the roadmap in `ViewColumn.One`;
   - there is one tab group and no preview tab.

   It printed "Electron no-markdown scenario passed" with exit code 0 in my run.
   `extension.ts` line 295 wires `previewAvailable` to
   `vscode.extensions.getExtension("vscode.markdown-language-features") !== undefined`.
5. **Command IDs and manifest unchanged; old exports gone — pass.** `git diff
   origin/main...HEAD -- extension/package.json` is empty. Running `grep -rn
   "ViewColumn.Beside\|export async function openRoadmap\|export async function
   openBreakdown" extension/src` exited 1 with no matches.
   `extensionIntegration.test.ts` is part of the passing unit run.
6. **Docs and CHANGELOG — pass.** `grep -n "Markdown preview" docs/extension.md`
   matches lines 36 and 48. `grep -n -i "markdown preview" CHANGELOG.md` matches
   lines 7 and 10. `docs/extension.md` line 38 names **Reopen Editor With… → Text
   Editor**. `grep -n "beside the active editor" docs/extension.md` exited 1.
7. **Full gate green against the baseline — pass.** I re-ran every command at
   `8a70b19` on 2026-10-09:
   - `git ls-files '*.sh' | xargs pnpm dlx shellcheck`: exit 0, no findings
     (baseline: exit 0, no findings).
   - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`: exit 0, 340/340.
   - Guard smoke: exit 0. Companion guard smoke: exit 0.
   - Extension `npm run typecheck`: exit 0. `npm run build`: exit 0.
   - `npm run test:unit`: exit 0, 155/155. The baseline was 152; `ok 112`-`ok 114`
     are this delivery's three `openArtifactPreview` cases.
   - `npm run test:electron`: exit 0, 4/4 scenarios (in-repo, companion, workspace,
     no-markdown), each reporting `Exit code: 0`. The baseline was 3/3; the fourth
     scenario is step 3.6's.
   - `node --test tests/extension-bundle.test.mjs`: exit 0, 4/4.

   These match step 4.2's recorded results.
8. **User's VS Code with the packaged VSIX: a delivery click and a member click each
   show a rendered preview tab in the main group, with no split — pass.**
   - Delivery click: `evidence/step-3-4-preview-open.png`, linked from step 3.4 and
     accepted in round 1.
   - Member click: `evidence/step-3-5-breakdown-preview.png`, linked from step 3.5. I
     viewed it. **Initiatives → Completed (3) → agento-extension → Complete (8)** is
     expanded with `cli-dashb…` selected. There is one editor group with two tabs
     (`roadmap.md`, `breakdown.md`). The active tab is the rendered `breakdown.md` from
     `agento-docs/initiatives/2026/09/agento-extension`, with a heading, a frontmatter
     block, and "Markdown Preview" in the editor title. The right-hand pane is the
     Chat panel, not an editor group. No secrets are visible; the top bar shows only a
     private LAN IP.
   - Which code the screenshot exercised: `code --list-extensions --show-versions`
     lists `david-perry-software.agento-dashboard@0.7.0`. The installed
     `out/openArtifact.js` and `out/extension.js` both contain `previewAvailable`, and
     the screenshot clock (02:12:29) is after commit `8a70b19` (02:06:42). So the
     member click ran the step 3.6 code.
9. **Both halves clean at handoff — pass.** `git status --porcelain
   --untracked-files=all` printed nothing in either half after my gate run.
   `extension/*.vsix` does not exist (`ls` failed), so the step 3.8 byproduct is gone.

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
- Round-2 code (`git diff 293d57e..HEAD -- extension`, commit `8a70b19`) is exactly
  step 3.6:
  - the `previewAvailable()` dependency and early source fallback in
    `openArtifact.ts`;
  - its wiring in `extension.ts`;
  - the third unit case;
  - the `no-markdown` scenario in `runTest.ts` (it drops `--disable-extensions`,
    which would make `--disable-extension` ignored) and `suite.ts`.

  The probe that motivated it is recorded on the step line: `vscode.openWith`
  resolves with a text editor instead of rejecting.
- Plan edits since round 1 (`git diff a73f63b..HEAD -- plan.md`):
  - acceptance items 1-2 gained the scenario-scope annotation (step 3.7);
  - item 8's verify gained the step 3.5 evidence link.

  Both are marked `(added 2026-10-09, review round 1)`. They clarify or strengthen the
  criteria; nothing was weakened.
- No undocumented changes. The diff touches 9 files (`git diff --stat
  origin/main...HEAD`): the 8 planned files plus `extension/test/electron/runTest.ts`
  for step 3.6's scenario. `scripts/` and the CLI are untouched, and
  `extension/package.json` is unchanged (`git diff --quiet` exit 0).
- Lint gate (§5): the plan chose the full gate on a green baseline. My fresh
  full-repository shellcheck and the extension typecheck are both exit 0 with no
  findings, matching the baseline.

## Roadmap audit

- 13/13 steps are ticked. I spot-checked each against the code, the evidence
  directory, and my own command runs:
  - 1.1-4.1: unchanged since round 1 and still accurate.
  - **3.5 (manual)**: the linked evidence file exists and shows what the line
    describes (§3 satisfied).
  - **3.6**: the code, the unit case `ok 114`, and the `no-markdown` scenario are
    present and pass.
  - **3.7**: `grep -n "workspace scenario returns before the tree blocks"` matches
    plan.md line 216 and roadmap.md lines 27 and 53.
  - **3.8**: the installed VSIX carries `previewAvailable`, and no `.vsix` remains.
  - **4.2**: my gate rerun reproduces its numbers.
- Header: `status: in-review`, `next-step: ""`. That is consistent with every step
  ticked and no `(manual, post-ship)` steps.
- No falsely ticked boxes and no repairs needed.

## Findings

Round-1 findings 1-3 are resolved (see the summary above). New this round, nits only:

1. **Nit: plan.md still describes the round-0 thresholds and fallback trigger.**
   - Acceptance item 7 still says unit ≥ 152 and electron 3/3, verified by step 4.1.
   - `## Approach` item 1 and `## Risks` still describe falling back only when
     `openWith` rejects.

   Steps 3.6 and 4.2 record the current behavior and the stronger results (155,
   4/4). This is documentation drift only.
2. **Nit: the `no-markdown` scenario covers the Deliveries click only.** The
   Initiatives click is registered to the same `openArtifact` closure
   (`extension/src/extension.ts` lines 294 and 305-306), so the breakdown fallback
   path is identical.

No security findings. The one new log line writes the artifact's local file URI to
the Agento output channel. It has no secrets and no user input beyond a path the
extension already resolved.

## Follow-ups

None new. The round-1 follow-up (how `vscode.openWith` behaves with the Markdown
extension disabled) was resolved in-delivery by step 3.6. It resolves with a text
editor rather than rejecting, so availability is now checked first, and the
`no-markdown` scenario covers it.
