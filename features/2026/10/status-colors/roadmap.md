```yaml
status: planned
branch: feature/status-colors
last-updated: 2026-10-08
next-step: "1.1 Install extension dependencies and record the extension baseline"
```

## Phase 1: Baseline

- [ ] 1.1 Install extension dependencies and record the extension baseline next to the planning baseline. Run `cd extension && npm ci`, then `npm run build`, `npm run typecheck`, `npm run test:unit` (pass count), and `npm run test:electron` (scenario count), and record exit codes and counts on this line. Planning baseline: shellcheck via `git ls-files '*.sh' | xargs pnpm dlx shellcheck` exit 0, no findings; typecheck exit 0; node tests 340/340; unit 128/128. A red extension baseline triggers the §5 overlap reassessment before continuing — verify: results are recorded on this line and `git status --porcelain --untracked-files=all` is empty

## Phase 2: Style mapping and contributed colors

- [ ] 2.1 Add `extension/src/statusStyle.ts` (no `vscode` import). It exports `StatusStyle`, `lifecycleStyle`, `initiativeGroupStyle`, `healthStyle`, and `STATUS_COLOR_IDS` exactly per plan.md `## Approach` item 1. Add `extension/test/unit/statusStyle.test.ts` covering the table, the unknown-value fallbacks, and coverage of every bundled `extension/cli/session-state.mjs` `LIFECYCLES` value except `no-delivery` — verify: `cd extension && npm run build && npm run test:unit` exit 0
- [ ] 2.2 Add `contributes.colors` to `extension/package.json`, one entry per `STATUS_COLOR_IDS` id with a description and `dark`/`light`/`highContrast`/`highContrastLight` defaults referencing the `charts.*` ids in plan.md `## Approach` item 2. Extend `statusStyle.test.ts` to assert the two-way match (every emitted id is declared with all four defaults; every declared `agento.*` color is emitted) — verify: `cd extension && npm run build && npm run test:unit` exit 0

## Phase 3: Apply colors to every surface

- [ ] 3.1 Deliveries: in `extension/src/deliveryTreeProvider.ts`, lifecycle groups use `lifecycleStyle(group.lifecycle)` for glyph and color. Leaves keep the `git-pull-request` glyph, tinted by their lifecycle color. The error message row becomes `error` tinted `agento.health.fail`; the empty row stays uncolored `info` — verify: `cd extension && npm run build && npm run typecheck && npm run test:unit` exit 0
- [ ] 3.2 Initiatives:
  - Add `color?: string` to `InitiativeTreeItemSpec` and replace `GROUP_ICONS` with `initiativeGroupStyle` for groups and members.
  - Initiative rows: done and valid → `type-hierarchy` tinted `agento.status.complete`; invalid → `warning` tinted `agento.health.fail`; otherwise uncolored `type-hierarchy`.
  - The Completed folder is `archive` tinted `agento.status.complete`. Diagnostics are tinted `agento.health.fail` (error) or `agento.health.warn` (anomaly). The error message row is tinted `agento.health.fail`.
  - `InitiativeTreeProvider` passes `new ThemeColor(spec.color)` into the `ThemeIcon`.
  - Update `extension/test/unit/initiativeTreeProvider.test.ts` expectations to include colors.

  — verify: `cd extension && npm run build && npm run typecheck && npm run test:unit` exit 0
- [ ] 3.3 Session & Doctor: in `extension/src/sessionDoctorProvider.ts`, add `color?` to `RowElement`.
  - Check rows and Warning rows use `healthStyle`.
  - The Session `Lifecycle` row uses `lifecycleStyle`, uncolored for `no-delivery`.
  - The Doctor group's `pulse` glyph is tinted by the worst check status (fail > warn > ok).
  - The load-error row is tinted `agento.health.fail`.

  — verify: `cd extension && npm run build && npm run typecheck && npm run test:unit` exit 0
- [ ] 3.4 Status bar:
  - Add `statusBarStyle: { color?: string; background?: "warning" | "error" }` to both `SessionDoctorModel` kinds in `extension/src/sessionDoctorModel.ts`. `color` comes from `lifecycleStyle(lifecycle)`; `background` is `"warning"` when doctor `status` is `warn` and `"error"` when it is `fail`; the error model uses `background: "error"`.
  - In `extension/src/extension.ts`, add one `applyStatusBar(statusBar, model)` helper that sets `text`, `color`, and `backgroundColor` (`statusBarItem.warningBackground` / `statusBarItem.errorBackground`), and use it at all three sites that set `statusBar.text` today. The text stays unchanged.
  - Extend `extension/test/unit/sessionDoctorModel.test.ts` for ok/warn/fail and the error model.

  — verify: `cd extension && npm run build && npm run typecheck && npm run test:unit` exit 0 and `grep -n "statusBar.text =" extension/src/extension.ts` matches only inside `applyStatusBar` and the initial creation

## Phase 4: Integration evidence and docs

- [ ] 4.1 In `extension/test/electron/suite.ts`, assert `(iconPath as ThemeIcon).id` and `.color?.id` for:
  - every Deliveries group and leaf in the fixture (Planned, Building, In Review, Shipped);
  - initiative groups and members;
  - the Doctor check rows;
  - `api.statusBar.color` / `backgroundColor`, matching the fixture's lifecycle and doctor status.

  Target: local electron test host, no ports — verify: `cd extension && npm run build && npm run test:electron` exit 0 in all scenarios
- [ ] 4.2 In `docs/extension.md`, add a "Status colors" section with the mapping table, the `workbench.colorCustomizations` override example, and the note that the status bar background (doctor warn/fail) overrides the lifecycle color. Add a `CHANGELOG.md` `## Unreleased` entry — verify: `grep -n "agento.status.paused" docs/extension.md` and `grep -n -i "status colors" CHANGELOG.md` both match
- [ ] 4.3 Package the extension for the manual check with `cd extension && npm run package`, and name the produced `.vsix` absolute path on this line. The `.vsix` is a gitignored byproduct: delete it after 4.4 and never commit it — verify: `npm run package` exit 0 and the named file exists
- [ ] 4.4 (manual) In your own VS Code:
  1. Extensions view → `…` → *Install from VSIX…*, select the `.vsix` named in 4.3, and reload the window.
  2. Open the Agento activity-bar container and expand groups in Deliveries, Initiatives, and Session & Doctor.
  3. Take a screenshot showing colored status icons in all three views and the colored status bar item, with no secrets visible.

  — verify: the screenshot is saved as `evidence/step-4-4-status-colors.png`, linked on this line, and shows tinted icons in all three views

## Phase 5: Verification

- [ ] 5.1 Run the full gate after merging `origin/main` into both halves and record each result against the step 1.1 baseline on this line:
  - `git ls-files '*.sh' | xargs pnpm dlx shellcheck`
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`
  - `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt`
  - `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt`
  - `cd extension && npm run typecheck && npm run build && npm run test:unit && npm run test:electron`
  - `node --test tests/extension-bundle.test.mjs`

  — verify: all commands exit 0; shellcheck has no findings; node ≥ 340; unit ≥ 128 with every new case attributed to this delivery; `git status --porcelain --untracked-files=all` is empty in both halves
