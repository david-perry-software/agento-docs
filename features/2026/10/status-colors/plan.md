# Status colors in the Agento dashboard

## Problem

Every Agento dashboard item looks the same regardless of status. Deliveries lifecycle
groups all use the plain `folder` glyph and every delivery leaf uses `git-pull-request`
([extension/src/deliveryTreeProvider.ts](https://github.com/david-perry-software/agento/blob/main/extension/src/deliveryTreeProvider.ts)).
Initiative groups and members have per-group glyphs but no color
([extension/src/initiativeTreePresentation.ts](https://github.com/david-perry-software/agento/blob/main/extension/src/initiativeTreePresentation.ts) `GROUP_ICONS`).
Session & Doctor rows have uncolored pass/warning/error glyphs
([extension/src/sessionDoctorProvider.ts](https://github.com/david-perry-software/agento/blob/main/extension/src/sessionDoctorProvider.ts)).
The status bar item is plain text (`extension/src/extension.ts` `statusBar.text`). To
spot what is paused, blocked, in review, or shipped, the user has to read labels.

The user wants color to show status on every dashboard item: folders,
initiatives, shipped, paused, and so on.

## Decisions

Clarifying questions asked on 2026-10-08 (recommended option marked); answers verbatim:

1. **How should status color be applied to tree items?**
   Options: *Tinted icons (ThemeIcon + ThemeColor)* (recommended) / Tinted icons +
   colored label text / Colored label text only.
   Answer: "Tinted icons (ThemeIcon + ThemeColor)" (the recommended option).
2. **Where should the colors come from?**
   Options: *Contributed agento.\* color ids* (recommended) / Built-in theme colors directly.
   Answer: "Contributed agento.* color ids" (the recommended option).
3. **Accept this status → color mapping?** Proposed mapping:
   Deliveries: planned=blue, building=yellow, paused=orange, in-review=purple,
   approved=green, shipped=green (muted/archive feel), post-ship-pending=orange.
   Initiatives: ready=blue, in-flight=yellow, blocked=red, complete=green; invalid
   initiative=red warning; Completed folder=green.
   Session & Doctor: ok=green, warn=yellow, fail/error=red; warnings rows=yellow.
   Options: *Yes, use the proposed mapping* (recommended) / Yes, but shipped/complete
   gray / No, I'll specify my own.
   Answer: "Yes, use the proposed mapping" (the recommended option).
4. **For grouping folders (Deliveries lifecycle groups, initiative member groups,
   Completed folders), what should change?**
   Options: *Status-specific glyph + color* (recommended; folder and its children
   share the status color) / Keep folder glyph, tint it by status / Leave folders
   uncolored.
   Answer: "Status-specific glyph + color" (the recommended option).
5. **Which surfaces are in scope?** (multi-select; the three views were recommended)
   Answer: "Deliveries view", "Initiatives view", "Session & Doctor view", "Status bar
   item (color by session lifecycle/doctor health)". The status bar was not among the recommended options; the user added it.

## Research

Skills consulted: none — no matching domain (this repository has no `.agents/skills/`
directory and its AGENTS.md has no `## Agento` skills table).

- **Tree rendering.**
  - Deliveries: `DeliveryTreeProvider.getTreeItem` (`extension/src/deliveryTreeProvider.ts`)
    builds `vscode.ThemeIcon("folder")` for lifecycle groups and
    `ThemeIcon("git-pull-request")` for leaves. `DeliveryTreeItem` carries both
    `lifecycle` and `status` (`extension/src/deliveryTreeModel.ts`).
  - Initiatives: the provider is a thin adapter over the pure, unit-tested
    `initiativeTreeItemSpec` (`extension/src/initiativeTreePresentation.ts`), whose
    spec has only `icon: string`. The Completed folder uses `archive`.
  - Session & Doctor: `SessionDoctorProvider.row(...)` takes an optional icon. Check
    rows map `ok`/`warn`/other to `pass`/`warning`/`error`. Warning rows use
    `warning`. The Doctor group uses `pulse`, other groups use `folder`.
- **Status bar.** Created in `extension/src/extension.ts` (around lines 95-100). Its
  text is set from `SessionDoctorModel.statusBarText` at three sites (around lines
  181, 210, and 233). `createSessionDoctorModel` (`extension/src/sessionDoctorModel.ts`)
  only checks that `doctor.status` is a string; the CLI emits `ok` | `warn` | `fail`
  (`agento.mjs doctor`).
- **Lifecycles.** `LIFECYCLES` in `scripts/session-state.mjs:322` is `no-delivery,
  planned, building, paused, in-review, approved, shipped, post-ship-pending`. The
  extension's bundled copy is `extension/cli/session-state.mjs`, which `npm run
  copy-cli` regenerates as part of `npm run build`.
- **VS Code API facts.**
  - A tree item honors `new ThemeIcon(id, new ThemeColor(colorId))`.
  - `contributes.colors` entries need an `id`, a `description`, and `defaults` for
    `dark`/`light`/`highContrast` (`highContrastLight` optional). A default can
    reference another color id such as `charts.blue`, so themes and
    `workbench.colorCustomizations` can override it.
  - `StatusBarItem.backgroundColor` only honors `statusBarItem.errorBackground` and
    `statusBarItem.warningBackground`. `StatusBarItem.color` accepts any
    `ThemeColor`, but a background color overrides it.
- **Manifest.** `extension/package.json` `contributes` has no `colors` today.
- **Tests.**
  - `extension/test/unit/initiativeTreeProvider.test.ts` asserts `[contextValue,
    icon]` pairs and the full Completed-folder spec. Adding a `color` field changes
    these `deepEqual` expectations.
  - `extension/test/electron/suite.ts` asserts delivery group labels and the status
    bar text `Agento: primary · 2 active` / `Agento: build · 1 active`. Keeping the
    text unchanged keeps those assertions valid.
  - `extension/test/unit/sessionDoctorModel.test.ts` asserts `statusBarText`.
- **Lint baseline (policy §5), 2026-10-08 at product `f3944be`.**
  - Full-repository shell lint: `git ls-files '*.sh' | xargs pnpm dlx shellcheck`,
    exit 0, no findings. A bare `shellcheck` is not installed on this machine
    (exit 127), so the same `pnpm dlx` form used by
    `features/2026/10/collapsed-tree-default` is the baseline command.
  - Extension typecheck: `cd extension && npm ci && npm run typecheck`, exit 0, no
    findings.
  - Supporting baselines: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`
    exit 0, 340/340; `cd extension && npm run test:unit` exit 0, 128/128.
  - **Overlap decision:** the baseline is green, so there are no findings to overlap.
    The **full gate** applies: full shell lint, extension typecheck/build, and all
    test suites must stay green. No scoped gate is needed.
- **Concurrent deliveries:** `gh pr list --state open` returned no open PRs at
  planning time, so no file overlap.

## Approach

All changes are in `extension/` plus docs. The CLI and `scripts/` are unchanged.

1. **Pure style module** `extension/src/statusStyle.ts` (no `vscode` import, so it can
   be unit-tested). It exports `interface StatusStyle { icon: string; color?: string }`
   and:
   - `lifecycleStyle(lifecycle)`:
     - `planned` → `circle-large-outline` / `agento.status.planned`
     - `building` → `sync` / `agento.status.building`
     - `paused` → `debug-pause` / `agento.status.paused`
     - `in-review` → `eye` / `agento.status.inReview`
     - `approved` → `check` / `agento.status.approved`
     - `shipped` → `pass-filled` / `agento.status.shipped`
     - `post-ship-pending` → `clock` / `agento.status.postShipPending`
     - any unknown value → `folder` with no color
   - `initiativeGroupStyle(kind)`:
     - `ready` → `play-circle` / `agento.status.ready`
     - `in-flight` → `sync` / `agento.status.inFlight`
     - `blocked` → `lock` / `agento.status.blocked`
     - `complete` → `pass-filled` / `agento.status.complete`
   - `healthStyle(status)`:
     - `ok` → `pass` / `agento.health.ok`
     - `warn` → `warning` / `agento.health.warn`
     - anything else → `error` / `agento.health.fail`
   - `STATUS_COLOR_IDS`: every color id the module can return.
2. **Contributed colors.** Add a `contributes.colors` entry for each id in
   `extension/package.json`, with a description and `dark`/`light`/`highContrast`/
   `highContrastLight` defaults:

   | Color ids | Default |
   | --- | --- |
   | `agento.status.planned`, `agento.status.ready` | `charts.blue` |
   | `agento.status.building`, `agento.status.inFlight`, `agento.health.warn` | `charts.yellow` |
   | `agento.status.paused`, `agento.status.postShipPending` | `charts.orange` |
   | `agento.status.inReview` | `charts.purple` |
   | `agento.status.approved`, `agento.status.shipped`, `agento.status.complete`, `agento.health.ok` | `charts.green` |
   | `agento.status.blocked`, `agento.health.fail` | `charts.red` |
3. **Deliveries.** In `deliveryTreeProvider.ts`:
   - A lifecycle group uses `lifecycleStyle(group.lifecycle)` for both glyph and color.
   - A delivery leaf keeps the `git-pull-request` glyph, tinted with its lifecycle's
     color. The folder and its children share the color.
   - Message rows: error → `error` tinted `agento.health.fail`; empty → uncolored `info`.
4. **Initiatives.**
   - `InitiativeTreeItemSpec` gains `color?: string`. `initiativeTreeItemSpec` takes
     group and member glyphs and colors from `initiativeGroupStyle`, replacing
     `GROUP_ICONS`.
   - A valid initiative that is not done keeps an uncolored `type-hierarchy`. A done,
     valid initiative uses `type-hierarchy` tinted `agento.status.complete`. An
     invalid initiative uses `warning` tinted `agento.health.fail`.
   - The Completed folder uses `archive` tinted `agento.status.complete`.
   - Diagnostics: error → `agento.health.fail`, anomaly → `agento.health.warn`.
     Message rows follow the Deliveries rule.
   - `InitiativeTreeProvider` builds `new ThemeIcon(spec.icon, spec.color ? new
     ThemeColor(spec.color) : undefined)`.
5. **Session & Doctor.** In `sessionDoctorProvider.ts`, `RowElement` gains `color?`.
   - Check rows and the Warning rows use `healthStyle`.
   - The Session group's `Lifecycle` row gets `lifecycleStyle(lifecycle)`. The
     `no-delivery` lifecycle falls back to the uncolored default.
   - The Doctor group's `pulse` glyph is tinted by the worst check status.
   - The load-error row is tinted `agento.health.fail`.
6. **Status bar.**
   - `SessionDoctorModel` (both kinds) gains `statusBarStyle: { color?: string;
     background?: "warning" | "error" }`. `color` comes from
     `lifecycleStyle(session.lifecycle).color`. `background` comes from the doctor's
     overall `status`: `warn` → `"warning"`, `fail` → `"error"`, `ok` → none. The
     error model uses `background: "error"`.
   - A single helper in `extension.ts` (`applyStatusBar(statusBar, model)`) replaces
     the three `statusBar.text = …` sites. It sets text, `color` (a `ThemeColor` or
     `undefined`), and `backgroundColor` (`statusBarItem.warningBackground` /
     `statusBarItem.errorBackground` / `undefined`).
   - The status bar text is unchanged.
7. **Tests.**
   - New `extension/test/unit/statusStyle.test.ts`:
     - The table mappings and fallbacks.
     - Every `LIFECYCLES` value from the bundled `extension/cli/session-state.mjs`
       except `no-delivery` has a colored style.
     - Every id in `STATUS_COLOR_IDS` is declared in `package.json`
       `contributes.colors` with all four defaults, and every declared `agento.*`
       color is used.
   - Update `initiativeTreeProvider.test.ts` and `sessionDoctorModel.test.ts`.
   - Electron suite: assert `iconPath` glyph and color ids for delivery groups and
     leaves, initiative groups and members, Doctor check rows, and the status bar
     `color`/`backgroundColor`.
8. **Docs.**
   - `docs/extension.md`: add a short "Status colors" section with the mapping table
     and how to override with `workbench.colorCustomizations`.
   - `CHANGELOG.md`: add a `## Unreleased` entry.

## Risks

- **Theme contrast.** `charts.*` colors may be hard to read in some themes.
  Mitigation: every color is a contributed id that users and themes can override,
  and high-contrast defaults are provided.
- **Lifecycle drift.** A new CLI lifecycle would render uncolored. Mitigation: the
  fallback style plus the unit test that iterates the bundled `LIFECYCLES`.
- **Status bar override semantics.** The background color hides the foreground
  `color` while the doctor reports `warn` or `fail`. This is intended: health
  outranks lifecycle. The docs state it.
- **Visual check needs the user's editor.** Tree icon colors are asserted
  programmatically in the electron host. The final visual confirmation in the
  user's own themed window is a `(manual)` screenshot step, as in
  `features/2026/10/collapsed-tree-default` step 3.4.
- **Concurrent delivery.** No open PRs at planning time. Integrate `origin/main`
  before every push.

## Out of scope

- Coloring label text or adding badges (`FileDecorationProvider`).
- Changing status bar text, tree labels, descriptions, or tooltips.
- New CLI fields or lifecycle values; `scripts/` stays untouched.
- Per-member state colors inside an initiative's In-flight group (the group color applies).
- A settings toggle to disable colors (theme overrides cover customization).

## Acceptance checklist

- [ ] `extension/src/statusStyle.ts` maps every lifecycle, initiative group, and
  health status per the Approach table, with uncolored fallbacks. Verified by
  `extension/test/unit/statusStyle.test.ts`.
- [ ] Every color id the code can emit is declared in `extension/package.json`
  `contributes.colors` with `dark`/`light`/`highContrast`/`highContrastLight`
  defaults, and no declared `agento.*` color is unused. Verified by the same unit
  test.
- [ ] Every `LIFECYCLES` value from the bundled CLI except `no-delivery` has a
  colored style. Verified by the same unit test.
- [ ] Deliveries lifecycle groups show the status glyph and color, and their leaves
  share the color. Initiative groups, members, the Completed folder, done and
  invalid initiatives, and diagnostics are colored per the mapping. Session &
  Doctor check, warning, lifecycle, and error rows are colored per the mapping.
  Verified by `cd extension && npm run test:electron` (all scenarios) asserting
  `ThemeIcon.id` and `ThemeIcon.color.id`.
- [ ] The status bar `color` follows the session lifecycle and its
  `backgroundColor` follows doctor `warn`/`fail`; its text is unchanged. Verified
  by `sessionDoctorModel.test.ts` and the electron suite.
- [ ] The user sees the colors in their own VS Code with the packaged VSIX.
  Verified by the screenshot `evidence/step-4-4-status-colors.png` linked on
  roadmap step 4.4.
- [ ] `docs/extension.md` documents the mapping and the override, and
  `CHANGELOG.md` has an Unreleased entry. Verified with `grep`.
- [ ] Full gate green against the baseline:
  - `git ls-files '*.sh' | xargs pnpm dlx shellcheck`: exit 0, no findings.
  - `cd extension && npm run typecheck`: exit 0.
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`: ≥ 340 passing.
  - Guard smoke (in-repo and companion): exit 0.
  - `npm run test:unit`: ≥ 128 plus the new cases.
  - `npm run test:electron`: all scenarios.
  - `node --test tests/extension-bundle.test.mjs`: exit 0.
  - `git status --porcelain --untracked-files=all` is empty in both halves.
