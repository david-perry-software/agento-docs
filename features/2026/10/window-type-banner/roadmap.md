```yaml
status: in-progress
branch: feature/window-type-banner
last-updated: 2026-10-09
next-step: "3.1 Create the WindowBannerProvider webview view provider"
artifact-pr: "#35"
```

## Phase 1: Baseline

- [x] 1.1 Install extension dependencies and record the extension baseline next to the planning baseline. Run `cd extension && npm ci`, then `npm run build`, `npm run typecheck`, `npm run test:unit` (pass count), and `npm run test:electron` (scenario count), and record each result on this line — verify: every command exits 0; unit 139/139 and electron scenario count match or are explained against plan.md `## Research` — done 2026-10-09 at product `987618b`: `npm ci` 0, `build` 0, `typecheck` 0 (no findings), `test:unit` 0 (139/139), `test:electron` 0 (3 scenarios: in-repo, companion, workspace)

## Phase 2: Colors and banner model

- [x] 2.1 Add role colors in one step so the manifest-equality test never goes red.
  - In `extension/src/statusStyle.ts`, add `ROLE_BANNER_COLORS` and `roleBannerColor(role)`. Map `primary`/`plan`/`build`/`freehand`/`unmanaged` to `agento.role.<role>` and anything else to `agento.role.unavailable`. Export `ROLE_FOREGROUND_COLOR = "agento.role.foreground"`. Include all seven ids in `STATUS_COLOR_IDS`.
  - In `extension/package.json` `contributes.colors`, declare the seven ids with descriptions and the defaults from plan.md `## Approach` item 2 for all four theme kinds.
  - In `extension/test/unit/statusStyle.test.ts`, cover `roleBannerColor` for every role and an unknown role. Update the expected `STATUS_COLOR_IDS` list. Add a WCAG contrast-ratio test: each `agento.role.*` background default against the `agento.role.foreground` default is ≥ 4.5.

  — verify: `cd extension && npm run build && npm run typecheck && npm run test:unit` exit 0, with the manifest-equality and contrast tests passing — done 2026-10-09: build 0, typecheck 0, unit 0 (141/141; +2: roleBannerColor mapping, WCAG contrast)
- [x] 2.2 In `extension/src/sessionDoctorModel.ts`, add `hosted: boolean` to `SessionSummary`, read as `sessionValue.hosted === true`. Extend `extension/test/unit/sessionDoctorModel.test.ts` with a hosted and a non-hosted case, and update existing `deepEqual` expectations — verify: `cd extension && npm run build && npm run typecheck && npm run test:unit` exit 0 — done 2026-10-09: build 0, typecheck 0, unit 0 (142/142; +1: hosted true/false/absent/non-boolean)
- [x] 2.3 Create the pure module `extension/src/windowBanner.ts` (no `vscode` import) with `createWindowBannerModel(model: SessionDoctorModel)` and `renderWindowBannerHtml(banner, nonce)` per plan.md `## Approach` items 3–4.
  - Titles per role; the detail line; ` · hosted`; the unmanaged and `AGENTO UNAVAILABLE` banners.
  - CSP `default-src 'none'; style-src 'nonce-<nonce>'`.
  - A single `command:agento.sessionDoctor.focus` link with the tooltip in `title`.
  - Colors via `var(--vscode-agento-role-<tone>)` and `var(--vscode-agento-role-foreground)`, with the banner background on `body` filling the pane.
  - HTML-escape every dynamic string.

  Add `extension/test/unit/windowBanner.test.ts` covering:
  - every role, with a delivery and with `no-delivery`;
  - detached, hosted, and the error model;
  - CSP, nonce, no `<script`, the command link, and the role CSS variable;
  - a branch and an error message containing `<script>"'&` rendered escaped.

  — verify: `cd extension && npm run build && npm run typecheck && npm run test:unit` exit 0, and `grep -c "from \"vscode\"" extension/src/windowBanner.ts` prints 0 — done 2026-10-09: build 0, typecheck 0, unit 0 (152/152; +10 in `windowBanner.test.ts`: roles, delivery detail, no-delivery, detached plan, hosted, unmanaged, unknown role, error, CSP/link/colors HTML, hostile escaping); grep prints 0

## Phase 3: Webview view and wiring

- [ ] 3.1 Create `extension/src/windowBannerProvider.ts`: `WindowBannerProvider implements vscode.WebviewViewProvider`.
  - It keeps the latest banner model. `resolveWebviewView` sets `webview.options = { enableScripts: false, enableCommandUris: ["agento.sessionDoctor.focus"], localResourceRoots: [] }` and renders the latest model immediately.
  - `update(banner)` re-renders when a view is attached. The view reference is dropped `onDidDispose`.
  - Each render uses a fresh nonce from `crypto.randomBytes`.
  - Exposes `current` and `html` getters.

  — verify: `cd extension && npm run build && npm run typecheck` exit 0
- [ ] 3.2 Wire the view.
  - `extension/package.json`: prepend `{ "id": "agento.windowBanner", "name": "Window", "type": "webview" }` to `contributes.views.agento`.
  - `extension/src/extension.ts`: construct `WindowBannerProvider` and register it with `vscode.window.registerWebviewViewProvider("agento.windowBanner", windowBanner)`, pushing the registration into `context.subscriptions`.
  - Replace the three `applyStatusBar(statusBar, model)` call sites with one helper that updates the status bar and calls `windowBanner.update(createWindowBannerModel(model))`.
  - Add `windowBanner` to `ExtensionApi` and the returned API object.
  - Update `extension/test/unit/extensionIntegration.test.ts`: the expected `views.agento` list, plus a `registerWebviewViewProvider\("agento\.windowBanner"` source assertion.

  — verify: `cd extension && npm run build && npm run typecheck && npm run test:unit` exit 0, and `grep -c "windowBanner.update(" extension/src/extension.ts` prints 1 (inside the helper)
- [ ] 3.3 In `extension/test/electron/suite.ts`:
  - After the existing `build` refresh, assert `api.windowBanner.current` (title `BUILD WINDOW`, detail containing the fixture slug, branch, and `building`, tone `build`).
  - After the detached-plan refresh, assert `PLAN WINDOW` with `detached`.
  - After the invalid-session refresh, assert `AGENTO UNAVAILABLE` with tone `unavailable`.
  - Assert the primary-window case where the suite already drives one.
  - Run `vscode.commands.executeCommand("agento.windowBanner.focus")`, wait until `api.windowBanner.html` is defined, and assert it contains the current title, `--vscode-agento-role-<tone>`, and `command:agento.sessionDoctor.focus`.

  Target: local electron test host, no ports — verify: `cd extension && npm run build && npm run test:electron` exit 0 in all scenarios

## Phase 4: Docs

- [ ] 4.1 In `docs/extension.md`, add a `## Window banner` section before `## Session & Doctor`. Cover: what each role shows, the unmanaged and unavailable banners, the click → Session & Doctor behavior, the `agento.role.*` color table, a `workbench.colorCustomizations` override example, and the pane-height note. Add one sentence about the banner to `extension/README.md`. Add a `CHANGELOG.md` `## Unreleased` **Added** entry — verify: `grep -n "agento.role.build" docs/extension.md` and `grep -n -i "window banner" CHANGELOG.md extension/README.md` all match

## Phase 5: Verification

- [ ] 5.1 Run the full gate after merging `origin/main` into both halves, and record each result against the step 1.1 / plan.md baseline on this line:
  - `git ls-files '*.sh' | xargs pnpm dlx shellcheck`
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`
  - `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt`
  - `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt`
  - `cd extension && npm run typecheck && npm run build && npm run test:unit && npm run test:electron`
  - `node --test tests/extension-bundle.test.mjs`

  — verify: all commands exit 0; shellcheck has no findings; node ≥ 340; unit ≥ 139 with every new case attributed to this delivery; electron all scenarios; `git status --porcelain --untracked-files=all` is empty in both halves
- [ ] 5.2 Package the extension with `cd extension && npm run package` and name the produced `.vsix` absolute path on this line. The `.vsix` is a gitignored byproduct: delete it after 5.4 and never commit it — verify: `npm run package` exit 0 (VSIX archive assertion passed) and the named file exists
- [ ] 5.3 Install the packaged VSIX into the user's VS Code with `code --install-extension <path from 5.2> --force` — verify: `code --list-extensions --show-versions` lists `david-perry-software.agento-dashboard@<manifest version>`
- [ ] 5.4 (manual) In your own VS Code, in this build window:
  1. Run *Developer: Reload Window*.
  2. Open the Agento activity-bar container. The `Window` view should sit at the top with a green `BUILD WINDOW` banner showing `window-type-banner · feature/window-type-banner · <lifecycle>`.
  3. Hover the banner to see the worktree-path tooltip, then click it and confirm Session & Doctor gets focus.
  4. Take a screenshot of the sidebar showing the banner, with no secrets visible.

  — verify: the screenshot is saved as `evidence/step-5-4-window-banner.png`, linked on this line, and shows the colored banner above Deliveries
