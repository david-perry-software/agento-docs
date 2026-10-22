```yaml
status: in-progress
branch: feature/role-profile-sidebar
last-updated: 2026-10-22
next-step: "2.1 Retitle and register the role commands in package.json"
initiative: "model-profile-manager"
artifact-pr: "#65"
```

## Phase 1: Pure role model

- [x] 1.1 In `extension/src/modelProfilesTree.ts`, add `ProfileRole`, `windowProfileRole(sessionRole)`, the `windowRole` input of `createModelProfilesModel`, and `model.roles`, parsed from `roles`, `rolesFile`, and `rolesErrors`. `secondaryState` is `on`, `off`, `dangling` (the name is not in `profiles[]`), or `invalid` (`rolesErrors` non-empty). Add `effectiveProfile(model)`, per plan.md `## Approach` items 1–2. Extend `extension/test/unit/modelProfilesTree.test.ts` for every role mapping and every `secondaryState`, including `primary: "custom"` and `null` — verify: `cd extension && npm run typecheck && npm run test:unit` exits 0 with the new cases passing
- [x] 1.2 Add the two pinned `{ kind: "role" }` rows to `modelProfilesChildren` and their `modelProfilesItemSpec`, per plan.md `## Approach` item 3: label, assignment description with `· this window`, icon, contextValue `agento.modelRole.<role>.<on|off>`, tooltip, and the `pickForRole` click command spec. Change `profileItemSpec` to role labels, `.here` `pass-filled`, the `.primary`/`.secondary`/`.here`/`.invalid` contextValue tokens, and the Roles tooltip section (item 4). Update the existing `applied` expectations and add cases for each token combination, a dangling role, and an invalid roles file — verify: `cd extension && npm run test:unit` exits 0
- [x] 1.3 In `extension/src/modelProfiles.ts`, replace `ModelsSelection` with the `use`/`off` × role union. Make `selectionToArgs` role-aware: primary keeps the exact `apply`/`clear` args; secondary runs `use <name|none> --role secondary` with `--expect <rolesHash>`. Make `toQuickPickItems(listJson, windowRole)` role-aware with the "Turn off" item. Add `use`-verb messages and the `assigned` fallback to `summarizeModelsResult`, and pass `force` to `deleteProfileArgs` for applied or secondary-assigned profiles (item 5). Add a pure `needsPrimaryConfirm(targetRole, windowRole)`. Extend `extension/test/unit/modelProfiles.test.ts` — verify: `cd extension && npm run typecheck && npm run test:unit` exits 0

## Phase 2: View commands and watchers

- [ ] 2.1 In `extension/package.json`, retitle `agento.modelProfiles.apply` to "Use Here" (inline on rows without `.here`) and `agento.modelProfiles.clear` to "Turn Off for This Window's Role". Add `usePrimary`, `useSecondary`, `offPrimary`, `offSecondary`, and `pickForRole` with icons, the `0_roles` context group `when` clauses on the contextValue tokens, the role rows' inline turn-off on `agento.modelRole.*.on`, and `commandPalette` hiding for every row-only command (plan.md `## Approach` item 6) — verify: `cd extension && npm run build && npm run typecheck` exits 0 and `node -e` over `package.json` lists every new command in `commands`, `view/item/context`, and `commandPalette`
- [ ] 2.2 In `extension/src/extension.ts`, derive `windowRole` from `sessionDoctor.current` and rebuild the model-profiles model on every session update. Register the five new commands and make `apply`, `clear`, and `selectModelProfile` role-aware through `runModelsSelection`, passing `rolesFile.hash` on secondary writes. Add `confirmPrimaryChange` to `ModelProfilePrompts` (with its modal default) and call it when `needsPrimaryConfirm` is true. Make Delete confirm with the role names and pass `--force` when assigned — verify: `cd extension && npm run build && npm run typecheck && npm run test:unit` exits 0
- [ ] 2.3 Extend `rebuildModelProfileWatchers` to watch `model-roles.json` beside `model-profiles.json`, keyed on `rolesFile.path` too (plan.md `## Approach` item 8) — verify: `cd extension && npm run build && npm run typecheck` exits 0; the watcher refresh itself is asserted in 4.1
- [ ] 2.4 Replace the editor host's `apply` with `useHere`, wired to `use` for `windowRole`, and relabel the footer button in `extension/media/profileEditor.js` to "Save & Use Here" with the new tooltip, keeping the `saveAndApply` message type. Update any editor unit or harness test that names the label — verify: `cd extension && npm run build && npm run typecheck && npm run test:unit` exits 0

## Phase 3: Window banner

- [ ] 3.1 Add the pure `modelsBannerLine(model)` and the optional `models` field to `createWindowBannerModel`. Render it in `renderWindowBannerHtml` as an escaped `<span class="models">` with one tooltip line, leaving the CSP, `enableScripts: false`, and the single command URI unchanged. Call `applySessionIndicators` on model-profile updates as well as session updates (plan.md `## Approach` item 9). Extend `extension/test/unit/windowBanner.test.ts` for every documented line, `null` when not ready, HTML escaping of a hostile name, and the unchanged CSP — verify: `cd extension && npm run build && npm run typecheck && npm run test:unit` exits 0

## Phase 4: Electron coverage

- [ ] 4.1 Extend `assertModelProfilesView` in `extension/test/electron/suite.ts` (temp plugin clone and temp `AGENTO_CONFIG_HOME`). It must cover, in order:
  - the two role rows appear first, and the primary window's inline Use Here still applies (the existing apply/clear assertions stay);
  - `useSecondary` on `review` writes `model-roles.json` naming it, and the row shows the `secondary` label;
  - `offSecondary` reads `off`;
  - an external `runCli(["models", "use", "review", "--role", "secondary"])` refreshes the view's `roles.secondary` with no view command (the roles watcher);
  - deleting the secondary-assigned profile with the stubbed confirm succeeds and leaves the role `off`;
  - `confirmPrimaryChange` is not called in this primary window;
  - `api.windowBanner.html` contains `Models:`.

  verify: `cd extension && DISPLAY=:0 npm run test:electron` exits 0 and the scenario log names the role checks
- [ ] 4.2 Cover the secondary-window path: in the existing stubbed-client scenario that drives the session role to `build` (or in a unit test of the command wiring, if the stub cannot answer `models` calls), assert that Use Here issues `models use <name> --role secondary` and that `usePrimary` calls `confirmPrimaryChange` and writes nothing when it is declined — verify: `cd extension && npm run test:unit && DISPLAY=:0 npm run test:electron` exits 0

## Phase 5: Docs, release, and final gate

- [ ] 5.1 Update `docs/extension.md` "Model profiles", `extension/README.md` "Model Profiles", and `docs/model-profiles.md` "Window roles" per plan.md `## Approach` item 10. Replace the `applied ·` wording with the role labels, and document Use Here, the role menu, the role rows, Turn Off, the primary confirm, the banner line, and the roles watcher — verify: `node --test tests/*.test.mjs` exits 0 and `grep -n "applied ·" docs/extension.md extension/README.md` prints nothing
- [ ] 5.2 Bump the version to `0.13.0` in `.claude-plugin/plugin.json`, `package.json`, `extension/package.json`, and `extension/package-lock.json` (via `npm version 0.13.0 --no-git-tag-version` in `extension/`). Add a `## 0.13.0 (unreleased)` entry to `CHANGELOG.md` describing the role-aware sidebar and banner — verify: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exits 0 and `grep -c '"version": "0.13.0"' extension/package.json` prints 1
- [ ] 5.3 Run the full gate and record the counts in this line:
  - `/tmp/shellcheck-v0.10.0/shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` (or the same release binary);
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`;
  - the four guard replays from AGENTS.md;
  - `cd extension && npm ci && npm run build && npm run typecheck && npm run test:unit && DISPLAY=:0 npm run test:electron && npm run package`.

  verify: shellcheck exits 0 with no findings, at least 641 root tests plus any new ones pass, every guard replay passes, at least 201 unit tests plus the new ones pass, every electron scenario passes, the VSIX packages, and `git status --porcelain --untracked-files=all` is empty in both halves
