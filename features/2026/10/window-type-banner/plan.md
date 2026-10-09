# Window-type banner at the top of the Agento sidebar

## Problem

Agento runs the same repository in several VS Code windows at once: the primary
checkout, plan worktrees, build worktrees, freehand worktrees, and unmanaged clones.
Each window type allows different commands (delivery-policy §11). Today the only cue
for which window you are in is the Session & Doctor `Role` row, collapsed by default
([extension/src/sessionDoctorProvider.ts](https://github.com/david-perry-software/agento/blob/main/extension/src/sessionDoctorProvider.ts)),
and the plain status bar text `Agento: <role> · <N> active`
([extension/src/sessionDoctorModel.ts](https://github.com/david-perry-software/agento/blob/main/extension/src/sessionDoctorModel.ts)
`statusBarText`). The windows look the same, so it is easy to run a command in the
wrong one.

The user wants a bright, colorful banner at the top of the Agento UI that shows
which type of window this is.

## Decisions

Clarifying questions asked on 2026-10-09 (recommended option marked); answers
verbatim:

1. **Where should the window-type banner appear?** (The Agento sidebar today is
   three native tree views, which can't take custom background colors.)
   Options: *New webview view pinned at the top of the Agento sidebar* (recommended)
   / Window-wide tint (title bar/activity bar) via workbench.colorCustomizations /
   Both / Tree view message text only (no color).
   Answer: "New webview view pinned at the top of the Agento sidebar" (the
   recommended option).
2. **What should the banner show?**
   Options: *Role label + delivery slug/branch + lifecycle* (recommended; e.g.
   BUILD · feature/foo · building) / Role label only / Role + slug + the allowed
   commands for this window.
   Answer: "Role label + delivery slug/branch + lifecycle" (the recommended option).
3. **How should role colors be defined?**
   Options: *Theme-contributable colors (agento.role.primary/plan/build/freehand/unmanaged)
   with bright defaults* (recommended) / Hardcoded bright palette.
   Answer: "Theme-contributable colors (agento.role.primary/plan/build/freehand/unmanaged)
   with bright defaults" (the recommended option).
4. **Should the banner be interactive?**
   Options: *Click focuses Session & Doctor; tooltip shows worktree path*
   (recommended) / Click opens the Show Actions quick pick / Static, no interaction.
   Answer: "Click focuses Session & Doctor; tooltip shows worktree path" (the
   recommended option).
5. **How should unmanaged, hosted, or CLI-unavailable states render?**
   Options: *Distinct warning banner (e.g. red UNMANAGED - open the primary
   checkout; grey UNAVAILABLE)* (recommended) / Hide the banner in those states.
   Answer: "Distinct warning banner (e.g. red UNMANAGED - open the primary
   checkout; grey UNAVAILABLE)" (the recommended option).

## Research

Skills consulted: none — no matching domain (this repository has no
`.agents/skills/` directory and its AGENTS.md has no `## Agento` skills table).

- **Sidebar layout.** `extension/package.json` `contributes.views.agento` lists three
  tree views in order: `agento.deliveries`, `agento.initiatives`,
  `agento.sessionDoctor`. There are no webviews and no `media/` assets beyond
  `media/agento.svg`. A native tree item cannot take a background color, so a
  colored banner needs a webview view (`"type": "webview"` in the view contribution,
  `vscode.window.registerWebviewViewProvider`), per the
  [contribution points reference](https://code.visualstudio.com/api/references/contribution-points#contributes.views).
  The first entry in the container's view list is rendered at the top.
- **Where the role comes from.** `createSessionDoctorModel`
  (`extension/src/sessionDoctorModel.ts`) parses `agento.mjs session --pr` into
  `session.role`, `lifecycle`, `deliverySlug`, `branch` (`"detached"` when null), and
  `worktreePath`. It does not parse `hosted` today. The CLI's roles are `primary`,
  `plan`, `build`, `freehand`, and `unmanaged` (delivery-policy §11). The error model
  (`createSessionDoctorError`) carries only `message`. The electron fixture
  `sessionResponse(role)` in `extension/test/electron/suite.ts` has no `hosted`
  field, so `hosted` should be read as optional (`=== true`).
- **Refresh wiring.** `extension/src/extension.ts` updates `sessionDoctor` and calls
  `applyStatusBar(statusBar, model)` at three sites in the refresh handler: no
  workspace folder, the successful snapshot, and the error path. The banner must
  follow the same three sites. The `ExtensionApi` interface (same file) exposes
  `sessionDoctor`, `sessionDoctorView`, and `statusBar` to the electron suite; the
  banner provider needs the same exposure to be testable.
- **Click target.** The status bar already uses `agento.sessionDoctor.focus` (the
  built-in `<viewId>.focus` command). A webview can run it without scripts through
  `WebviewOptions.enableCommandUris` restricted to that one command id and a
  `command:agento.sessionDoctor.focus` link.
- **Colors.** `extension/src/statusStyle.ts` exports `STATUS_COLOR_IDS`, and
  `extension/test/unit/statusStyle.test.ts` asserts that the manifest's `agento.*`
  colors are exactly `STATUS_COLOR_IDS`, each with all four theme defaults. New
  `agento.role.*` colors must therefore be added to `STATUS_COLOR_IDS` (or the test
  breaks). Contributed colors are exposed inside webviews as CSS variables
  `--vscode-<id with dots replaced by dashes>`, e.g. `--vscode-agento-role-build`, so
  theme and `workbench.colorCustomizations` overrides reach the banner.
  *Corrected 2026-10-09 (roadmap step 3.4):* the installed VS Code replaces only the
  first dot (`id.replace(".", "-")`), so the variable is actually
  `--vscode-agento-role.build`. The banner references both spellings with a
  fallback, `var(--vscode-agento-role-build, var(--vscode-agento-role\.build))`.
- **Manifest test.** `extension/test/unit/extensionIntegration.test.ts` deep-equals
  the `views.agento` list, and checks `extension.ts` source for `createTreeView`
  calls. Both need updating for the new view.
- **Docs.** `docs/extension.md` has `## Session & Doctor` and `## Status colors`
  sections; `extension/README.md` describes the views (line 5) and Session & Doctor;
  `CHANGELOG.md` has an `## Unreleased` section.
- **Precedent.** `features/2026/10/status-colors` used the same shape: pure style
  module, contributed colors, unit + electron assertions, a packaged VSIX, and one
  `(manual)` screenshot step of the real VS Code window.
- **Lint baseline (policy §5), 2026-10-09 at product `de72b68`.**
  - Full-repository shell lint: `git ls-files '*.sh' | xargs pnpm dlx shellcheck`,
    exit 0, no findings (same command as the status-colors baseline; a bare
    `shellcheck` is not on PATH).
  - Extension typecheck: `cd extension && npm ci && npm run typecheck`, exit 0, no
    findings.
  - Supporting baselines: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`
    exit 0, 340/340; `cd extension && npm run test:unit` exit 0, 139/139.
  - **Overlap decision:** the baseline is green, so there are no findings to overlap.
    The **full gate** applies: full shell lint, extension typecheck/build, and all
    test suites must stay green. No scoped gate is needed.
- **Concurrent deliveries:** `gh pr list --state open` returned `[]` at planning time,
  so no file overlap.

## Approach

All changes are in `extension/` plus docs. The CLI and `scripts/` are unchanged.

1. **Role colors** in `extension/src/statusStyle.ts`: a `ROLE_BANNER_COLORS` map and
   `roleBannerColor(role)`:
   - `primary` → `agento.role.primary`
   - `plan` → `agento.role.plan`
   - `build` → `agento.role.build`
   - `freehand` → `agento.role.freehand`
   - `unmanaged` → `agento.role.unmanaged`
   - unknown role or load error → `agento.role.unavailable`

   plus `agento.role.foreground` for banner text. All seven ids join
   `STATUS_COLOR_IDS`.
2. **Contributed colors** in `extension/package.json` `contributes.colors`, each with
   a description and the same default for `dark`/`light`/`highContrast`/
   `highContrastLight`. Bright, saturated defaults that keep white text readable
   (WCAG contrast ≥ 4.5:1):

   | Color id | Default |
   | --- | --- |
   | `agento.role.primary` | `#0063B1` (blue) |
   | `agento.role.plan` | `#7B2CBF` (purple) |
   | `agento.role.build` | `#1E7B34` (green) |
   | `agento.role.freehand` | `#00796B` (teal) |
   | `agento.role.unmanaged` | `#C62828` (red) |
   | `agento.role.unavailable` | `#5F6368` (grey) |
   | `agento.role.foreground` | `#FFFFFF` |

   A unit test computes the contrast ratio of each background default against the
   foreground default.
3. **Banner model** — new pure module `extension/src/windowBanner.ts` (no `vscode`
   import). `createWindowBannerModel(model: SessionDoctorModel)` returns
   `{ tone, title, detail, tooltip, colorId }`:
   - `primary` / `plan` / `build` / `freehand`: title `PRIMARY WINDOW`,
     `PLAN WINDOW`, `BUILD WINDOW`, `FREEHAND WINDOW`. Detail joins the parts that
     exist with ` · `: delivery slug, branch (`detached` when null), lifecycle
     (omitted for `no-delivery`). Example: `window-type-banner ·
     feature/window-type-banner · building`; a fresh plan window shows `detached`.
   - `unmanaged`: title `UNMANAGED WINDOW`, detail `Agento commands are disabled
     here — open the primary checkout`.
   - Load error (`kind: "error"`): title `AGENTO UNAVAILABLE`, detail the error
     message, grey.
   - Hosted sessions append ` · hosted` to the detail.
   - Tooltip: the worktree path (or the error message), plus `Click to open Session
     & Doctor`.

   `createSessionDoctorModel` gains `session.hosted: boolean`, read as
   `sessionValue.hosted === true`.
4. **Banner HTML** — `renderWindowBannerHtml(banner, nonce)` in the same module:
   - CSP `default-src 'none'; style-src 'nonce-<nonce>'`. No scripts, no external
     resources.
   - One full-width `<a href="command:agento.sessionDoctor.focus" title="…">`
     block. Background `var(--vscode-agento-role-<tone>)`, text
     `var(--vscode-agento-role-foreground)`. Bold uppercase title, smaller detail
     line, and a visible focus outline for keyboard users.
   - Every dynamic string (slug, branch, path, error message) is HTML-escaped
     (`& < > " '`), since branch names and CLI messages are untrusted text.
5. **Webview provider** — new `extension/src/windowBannerProvider.ts`:
   `WindowBannerProvider implements vscode.WebviewViewProvider`.
   - It keeps the latest banner model. `resolveWebviewView` sets
     `webview.options = { enableScripts: false, enableCommandUris:
     ["agento.sessionDoctor.focus"], localResourceRoots: [] }` and renders the
     latest model. Webview views resolve lazily, so the initial render must not wait
     for the next refresh.
   - `update(banner)` re-renders when a view is attached. Clear the reference
     `onDidDispose`.
   - A fresh nonce from `crypto.randomBytes` per render.
   - Exposes `current` (model) and `html` (last rendered HTML, or `undefined`) for
     tests.
6. **Manifest and wiring.**
   - `extension/package.json`: prepend `{ "id": "agento.windowBanner", "name":
     "Window", "type": "webview" }` to `views.agento`, so it sits above Deliveries.
   - `extension/src/extension.ts`: construct the provider and register it with
     `vscode.window.registerWebviewViewProvider("agento.windowBanner", windowBanner)`
     (disposed via `context.subscriptions`). At each of the three sites that call
     `applyStatusBar`, also call `windowBanner.update(createWindowBannerModel(model))`.
     Fold both into one helper so the three sites cannot drift. Add `windowBanner` to
     `ExtensionApi`.
7. **Tests.**
   - New `extension/test/unit/windowBanner.test.ts`:
     - model for each role, a delivery vs `no-delivery`, detached, hosted, and the
       error model;
     - HTML has the CSP meta with the nonce, no `<script`, the command link, and the
       role CSS variable;
     - a branch/error message containing `<script>"'&` comes out escaped.
   - `statusStyle.test.ts`: role colors in `STATUS_COLOR_IDS`, the manifest-equality
     test passing with seven new entries, and the contrast-ratio check.
   - `extensionIntegration.test.ts`: the new view list and a
     `registerWebviewViewProvider("agento.windowBanner"` source assertion.
   - `sessionDoctorModel.test.ts`: `hosted` parsing.
   - `extension/test/electron/suite.ts`: after the existing session refreshes,
     assert `api.windowBanner.current` for `build`, detached `plan`, `primary`, and
     the invalid-session error. Run `agento.windowBanner.focus` and assert
     `api.windowBanner.html` contains the expected title and
     `--vscode-agento-role-<tone>`.
8. **Docs.** A `## Window banner` section in `docs/extension.md` (what it shows per
   role, click behavior, color table, `workbench.colorCustomizations` override
   example). A sentence in `extension/README.md`. A `CHANGELOG.md` `## Unreleased`
   entry.

Affected files: `extension/package.json`, `extension/src/{statusStyle,sessionDoctorModel,extension}.ts`,
new `extension/src/{windowBanner,windowBannerProvider}.ts`,
`extension/test/unit/{statusStyle,sessionDoctorModel,extensionIntegration}.test.ts`,
new `extension/test/unit/windowBanner.test.ts`, `extension/test/electron/suite.ts`,
`docs/extension.md`, `extension/README.md`, `CHANGELOG.md`.

## Risks

- **Webview view height is user-controlled.** VS Code sizes sidebar panes, so the
  banner pane may open taller than its content or be collapsed by the user.
  Mitigation: compact HTML whose background fills the whole pane (`html, body`
  height 100%, banner background on `body`), so any extra height stays colored
  instead of showing a blank gap. Documented in `docs/extension.md`.
  *Updated 2026-10-09 (roadmap steps 3.5–3.6):* VS Code enforces a 120 px minimum
  webview pane body height that extensions cannot change, so the banner centers its
  content vertically in that height, and the view declares `"initialSize": 1`.
- **Pane header duplication.** The view's own header (`WINDOW`) sits above the
  banner. Mitigation: short name `Window`; accepted as native VS Code chrome.
- **XSS through branch names or CLI messages.** Mitigation: strict CSP with no
  script source, `enableScripts: false`, command URIs limited to one command id,
  and HTML-escaping covered by a unit test with a hostile string.
- **Lazy resolve race.** A refresh that lands before the view resolves would be lost
  if the provider rendered only on `update`. Mitigation: the provider keeps the
  latest model and renders it in `resolveWebviewView`; covered by the electron test,
  which focuses the view after refreshes have run.
- **Color test coupling.** The manifest-equality test in `statusStyle.test.ts`
  breaks until the new ids are both emitted and declared. Mitigation: roadmap step
  2.1 adds the module ids, the manifest entries, and the test updates in one commit,
  before any consumer.
- **Visual check needs the real VS Code window.** The agent cannot screenshot the
  user's desktop VS Code. Mitigation: same as status-colors. The agent packages and
  installs the VSIX itself; the one `(manual)` step is the user reloading and taking
  the screenshot. Automated coverage (unit + electron HTML/model assertions)
  finishes before that step.
- **Concurrent deliveries:** none open at planning time. Integrate `origin/main` by
  merge before every push.

## Out of scope

- Window-wide tinting (title bar, activity bar, status bar background) via
  `workbench.colorCustomizations`.
- Listing allowed commands in the banner (the Session & Doctor play action already
  does).
- Changing the status bar item text or colors, or the Session & Doctor rows.
- Any CLI (`scripts/`) change; the session record already carries every field
  needed.
- A user setting to hide the banner (VS Code's own view context menu can hide any
  view).

## Acceptance checklist

- [ ] The Agento sidebar's first view is a webview `agento.windowBanner` named
  `Window`, above Deliveries — verify: `extensionIntegration.test.ts` view-list
  assertion passes, and the 5.4 screenshot shows the banner at the top.
- [ ] The banner shows `PRIMARY WINDOW`, `PLAN WINDOW`, `BUILD WINDOW`,
  `FREEHAND WINDOW`, or `UNMANAGED WINDOW` from the session role. The detail line
  holds slug, branch (`detached` when null), and lifecycle (omitted for
  `no-delivery`), plus ` · hosted` for hosted sessions — verify:
  `windowBanner.test.ts` model cases pass.
- [ ] Load errors show a grey `AGENTO UNAVAILABLE` banner with the error message;
  unmanaged windows show a red banner telling the user to open the primary
  checkout — verify: `windowBanner.test.ts` error and unmanaged cases, and the
  electron invalid-session assertion.
- [ ] Each role uses its contributed `agento.role.*` background and the
  `agento.role.foreground` text color. All seven ids are declared in the manifest
  with four theme defaults, and each default background has contrast ≥ 4.5:1 against
  the default foreground — verify: `statusStyle.test.ts` manifest-equality and
  contrast tests pass.
- [ ] Clicking the banner focuses Session & Doctor; the tooltip shows the worktree
  path — verify: `windowBanner.test.ts` asserts the
  `command:agento.sessionDoctor.focus` link and `title` attribute; the provider sets
  `enableCommandUris: ["agento.sessionDoctor.focus"]`.
- [ ] The webview is safe: CSP `default-src 'none'` with a nonce-only style source,
  no `<script>`, `enableScripts: false`, and hostile text is HTML-escaped — verify:
  `windowBanner.test.ts` CSP and escaping cases pass.
- [ ] The banner follows every refresh (success, error, no workspace folder) and
  renders the latest state when the view first resolves — verify: the electron suite
  asserts `api.windowBanner.current` across role changes and `api.windowBanner.html`
  after `agento.windowBanner.focus`.
- [ ] `docs/extension.md` has a `## Window banner` section with the color table and
  override example; `extension/README.md` and `CHANGELOG.md` `## Unreleased` mention
  the banner — verify: `grep -n "agento.role.build" docs/extension.md` and
  `grep -n -i "window banner" CHANGELOG.md extension/README.md` match.
- [ ] Full gate green against the 2026-10-09 baseline:
  `git ls-files '*.sh' | xargs pnpm dlx shellcheck` (no findings), node suites
  (≥ 340), both guard smokes, extension typecheck/build, `test:unit` (≥ 139, new
  cases attributed), `test:electron` (all scenarios), and
  `node --test tests/extension-bundle.test.mjs` — verify: step 5.1 records each
  result.
- [ ] A screenshot from the user's VS Code shows the colored banner at the top of
  the Agento sidebar — verify: `evidence/step-5-4-window-banner.png` linked from
  roadmap step 5.4.
