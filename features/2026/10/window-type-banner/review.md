# Review: window-type-banner

Verdict: approve

Reviewed 2026-10-09 (round 1) against product `aa4da61` (code PR #99, draft, CI `test`
SUCCESS) and companion `a4e5ff6` (artifact PR #35, draft), both on
`feature/window-type-banner`. `origin/main` is an ancestor of both halves
(`git merge-base --is-ancestor` exit 0 in each), both halves were clean before review,
and the product half stayed clean after the gate reruns and browser render.
Window check: `agento.mjs session` → `role: build`, `delivery.slug:
window-type-banner`, `companion.dirty: false`, `ahead: 0`, `behind: 0`;
`agento.mjs doctor --for review-feature` → `ok`; `agento.mjs resolve feature
window-type-banner` → `ok`. `gh pr list --state open` shows only #99, so there is no
concurrent file overlap.

Skills consulted: none — no matching domain (no `.agents/skills/` in the product
repository; AGENTS.md has no `## Agento` skills table).

Gate rerun by the Reviewer (all from the product worktree at `aa4da61`):

| Check | Result | Baseline (plan / step 1.1) |
| --- | --- | --- |
| `git ls-files '*.sh' \| xargs pnpm dlx shellcheck` | exit 0, no findings | exit 0, no findings |
| `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | 340/340, fail 0 | 340/340 |
| `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` | 101 verdicts, 0 MISMATCH | — |
| `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` | 30 verdicts, 0 MISMATCH | — |
| `cd extension && npm run typecheck` | exit 0, no findings | exit 0 |
| `cd extension && npm run build` | exit 0 | exit 0 |
| `cd extension && npm run test:unit` | exit 0, 152/152 | 139/139 |
| `cd extension && npm run test:electron` | exit 0; in-repo and companion scenarios report "window banner"; workspace scenario passed | 3/3 |
| `node --test tests/extension-bundle.test.mjs` | 4/4, fail 0 | — |
| `grep -c 'from "vscode"' extension/src/windowBanner.ts` | 0 | — |
| `grep -c "windowBanner.update(" extension/src/extension.ts` | 1 (`applySessionIndicators`) | — |

The electron log's `vaInitialize failed: unknown libva error` lines are host GPU
noise and appear in every scenario before the pass line.

**Independent rendering check (target: local file render, no ports).** I rendered
`renderWindowBannerHtml` from the built `extension/out/src/windowBanner.js` into
gitignored `extension/out/review-r1-*.html` (deleted afterwards). I loaded each file in
the integrated browser at 300 × 122 px, the narrowest sidebar width it would take,
and set the colors with `document.documentElement.style.setProperty` as VS Code's
webview host does:

- **build** (`--vscode-agento-role.build`, VS Code's real first-dot-only spelling):
  `body` background `rgba(0, 0, 0, 0)` before → `rgb(30, 123, 52)` after; text
  `rgb(255, 255, 255)`. The title is 19.2 px. Content spans 18.5–103.5 px, so it is
  vertically centered, and `scrollHeight` 122 = `clientHeight` (no overflow). The
  anchor `href` is `command:agento.sessionDoctor.focus`, `title` is the worktree path
  plus the click hint, the CSP is `default-src 'none'; style-src
  'nonce-reviewnonce1';`, and there are 0 scripts. Evidence:
  [evidence/review-r1-build-banner.png](evidence/review-r1-build-banner.png).
- **unavailable**, with an error message of `<img src=x onerror=alert(1)> "quoted" &
  'single'`: grey `rgb(95, 99, 104)` / white. The DOM under `body` is only `A, SPAN,
  SPAN`, with 0 images, so the hostile text rendered as literal text. Evidence:
  [evidence/review-r1-unavailable-hostile.png](evidence/review-r1-unavailable-hostile.png).
- **unmanaged**, set via the all-dashes spelling `--vscode-agento-role-unmanaged`
  (the forward-compatible fallback): `rgb(198, 40, 40)` / white. Both spellings in
  `cssColor` work.

I also confirmed the spelling claim behind step 3.4 at its source. The installed
`/usr/share/code/resources/app/out/vs/workbench/workbench.desktop.main.js` contains
`"vscode-"+v.id.replace(".","-")`, which replaces only the first dot.

## Acceptance checklist results

1. **First view is webview `agento.windowBanner` named `Window`, above Deliveries** —
   pass. `extension/package.json` `views.agento[0]` is `{ id: "agento.windowBanner",
   name: "Window", type: "webview", initialSize: 1 }`.
   `extensionIntegration.test.ts` deep-equals the list (unit 152/152), and
   `test/vsix/suite.ts` expects the same id order. The step 5.4 screenshot shows the
   green banner above Deliveries in the user's VS Code.
2. **Role titles; detail of slug, branch (`detached`), and lifecycle, without
   `no-delivery`, plus `· hosted`** — pass. `windowBanner.test.ts` covers all five
   titles and the full detail. It also covers `main` alone for no-delivery,
   `detached` for a fresh plan, and `· hosted` for both a delivery and an unmanaged
   window. The electron suite asserts `BUILD WINDOW` with
   `session-doctor-panel · feature/session-doctor-panel · building`, plus
   `PLAN WINDOW` matching `/^detached\b/` and `PRIMARY WINDOW`.
3. **Grey `AGENTO UNAVAILABLE` with the message; red unmanaged banner pointing at the
   primary checkout** — pass. Unit cases "load errors render a grey AGENTO
   UNAVAILABLE banner" and "unmanaged windows get a red banner" cover these. The
   electron invalid-session refresh asserts title, tone `unavailable`, and the
   `Invalid Session & Doctor response:` detail. The browser renders above show grey
   and red.
4. **Contributed `agento.role.*` backgrounds and foreground; seven ids with four theme
   defaults; contrast ≥ 4.5:1** — pass. `statusStyle.test.ts` covers manifest
   equality with `STATUS_COLOR_IDS`, the four defaults per id, and the WCAG test over
   six backgrounds against `#FFFFFF`. The browser check confirmed the CSS variables
   resolve to the declared defaults.
5. **Click focuses Session & Doctor; tooltip shows the worktree path** — pass. The
   unit test asserts `<a class="banner" href="command:agento.sessionDoctor.focus"
   title="/repo/worktrees/plan-1\nClick to open Session &amp; Doctor">` and exactly
   one `href`. `windowBannerProvider.ts` sets `enableCommandUris:
   [BANNER_CLICK_COMMAND]`, and my browser render showed the same `href` and
   `title`. The real click was exercised by the user at step 5.4. The screenshot
   cannot show it (see Findings, note 1).
6. **Safe webview** — pass. The CSP is `default-src 'none'; style-src
   'nonce-<nonce>'`. There is no `<script` and no `on*=` attribute (unit).
   `enableScripts: false` and `localResourceRoots: []` are set in the provider.
   Hostile branch, path, and error text is escaped (unit), and the hostile browser
   render produced no injected element.
7. **Follows every refresh; renders the latest state on first resolve** — pass.
   `extension.ts` routes all three former `applyStatusBar` sites (no workspace
   folder, snapshot success, error) through `applySessionIndicators`. The provider
   keeps the latest model and renders it in `resolveWebviewView`. In the electron
   suite, `focusWindowBanner` runs after the invalid-session refresh and asserts the
   HTML holds `AGENTO UNAVAILABLE`, the color variable, and the command link. The
   retry then asserts "an attached banner re-renders on refresh" with
   `PRIMARY WINDOW`.
8. **Docs** — pass. `docs/extension.md` has `## Window banner` before
   `## Session & Doctor`, with the title table, the color table (line 92), and the
   override example (line 102). `CHANGELOG.md:5` and `extension/README.md:6` match
   `window banner`.
9. **Full gate green against the baseline** — pass. See the table above: every
   command exits 0, shellcheck finds nothing, node 340 ≥ 340, unit 152 ≥ 139 (+13:
   2 `statusStyle`, 1 `sessionDoctorModel`, 10 `windowBanner`, matching step 5.1's
   attribution), and electron passes all scenarios.
10. **User screenshot shows the colored banner at the top of the sidebar** — pass.
    [evidence/step-5-4-window-banner.png](evidence/step-5-4-window-banner.png) is
    linked from step 5.4. It shows the green `BUILD WINDOW` banner with
    `window-type-banner · feature/window-type-banner · paused` above Deliveries,
    and no secrets are visible.

## Plan vs implementation

- **Documented deviations (steps 3.4–3.6, added during build, user-driven).** The
  banner uses both CSS-variable spellings, `initialSize: 1` and vertical centering
  for VS Code's 120 px pane minimum, and a smaller title with tighter padding. plan.md
  `## Research` and `## Risks` carry dated correction notes, and the docs pane-height
  note matches the final CSS.
- **Undocumented-in-plan but recorded change.** `extension/test/vsix/suite.ts` now
  expects `agento.windowBanner` first. This is recorded on step 3.2 and is needed so
  the packaged-VSIX check stays green.
- **Electron fixture change.** The detached-plan fixture now sets `branch: null`, as
  the CLI does for a detached HEAD. This is recorded on step 3.3 and makes that
  scenario more faithful.
- **Scope.** No `scripts/` or CLI change, no status-bar or Session & Doctor change,
  and no window-wide tint, matching `## Out of scope`. `git diff --stat
  origin/main...HEAD` lists only the 15 files in plan.md's affected-files list plus
  `test/vsix/suite.ts`.

## Roadmap audit

I spot-checked all 15 ticked steps against the code. None were falsely ticked, and no
repairs were needed.

- 2.1–2.3: `ROLE_BANNER_COLORS`, `roleBannerColor`, `ROLE_FOREGROUND_COLOR`, seven
  manifest entries, `hosted` parsing, and the `vscode`-free `windowBanner.ts` are
  present, with exactly 10 tests in `windowBanner.test.ts`.
- 3.1–3.3: the provider options, `onDidDispose` cleanup, and the per-render
  `randomBytes(16)` nonce are present. The `registerWebviewViewProvider`
  registration is in `context.subscriptions`, `windowBanner` is in `ExtensionApi`,
  and the electron assertions are there.
- 3.4–3.6: `cssColor` emits both spellings. The CSS has `initialSize: 1`, a flex
  column, `1.2em` title, `4px 12px` padding, and `margin-top: 2px`. Evidence files
  for 3.5 and 3.6 exist and are linked.
- 4.1: the greps match (above).
- 5.1: reproduced in full by this review.
- 5.2: `extension/*.vsix` no longer exists (`ls` reports none), as the step says.
- 5.3: `code --list-extensions --show-versions` lists
  `david-perry-software.agento-dashboard@0.7.0`, matching `extension/package.json`.
- 5.4 (manual): the evidence file exists, is linked, and is dated. There are no
  `(manual, post-ship)` steps.

## Findings

No findings above minor severity. Notes and nits, in descending order:

1. **Note — step 5.4 interaction is attested, not pictured.** The screenshot is
   static, so the hover tooltip and click-to-focus rest on the user's acceptance
   plus automated coverage (unit `href`/`title`/single-link assertions and the
   provider's `enableCommandUris`). No electron test performs the click, because
   webview content is not reachable from the extension host. This is acceptable as
   is.
2. **Nit — the electron HTML assertion checks only the all-dashes spelling**
   (`extension/test/electron/suite.ts`, `includes("--vscode-agento-role-unavailable")`
   and `-primary`). That is the spelling VS Code does *not* emit today. The real
   spelling, `--vscode-agento-role\.<tone>`, is asserted only in
   `windowBanner.test.ts`, which is enough to catch a regression.
3. **Nit — narrow sidebars wrap the detail mid-word at hyphens.** At 300 px the
   lifecycle `in-review` breaks as `in-` / `review` (see
   [evidence/review-r1-build-banner.png](evidence/review-r1-build-banner.png)),
   which comes from `.detail { overflow-wrap: anywhere }` in
   `extension/src/windowBanner.ts`. This is cosmetic, and the user accepted the
   look.
4. **Note — the 5.4 screenshot includes the desktop status bar**, which shows a
   private LAN address (`192.168.204.131`). It is not a secret and needs no action.
   Cropping to the VS Code window is worth doing for future screenshot steps.

Code quality: the model and HTML module is pure and fully unit-tested. Every dynamic
string goes through `escapeHtml`, including the nonce. `roleBannerColor` uses
`Object.hasOwn`, so `constructor` and `toString` roles fall back safely, and this is
tested. The three refresh sites share one helper so they cannot drift. The disposal
guard (`this.view === view`) handles re-resolution correctly. I found no OWASP
concern: there are no scripts, a single allow-listed command URI, no local resource
roots, and escaped untrusted text.

## Follow-ups

- None required. Finding 2 could be folded into any later banner change: add an
  `includes("--vscode-agento-role\\.<tone>")` assertion to the electron suite.
