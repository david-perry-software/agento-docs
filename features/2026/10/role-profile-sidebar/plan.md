# Role profile sidebar: show and switch the primary and secondary model profiles from the Model Profiles view and the window banner

## Problem

This feature implements the `### role-profile-sidebar` block of the
[model-profile-manager breakdown](../../../../initiatives/2026/10/model-profile-manager/breakdown.md)
(wave 5). Brief: "We should be able to turn certain profiles on and off in primary
and secondary windows" and "easily switch between profiles through the UI sidebar."

`role-active-profiles` gave primary and secondary windows separate active profiles,
but only on the CLI: `models use <name|none> --role primary|secondary` and the
`roles`/`rolesFile`/`rolesErrors` fields of `models list`. The sidebar does not know
about roles yet:

- The Model Profiles view's inline Apply always writes the clone's file pins (the
  primary role), even in a plan, build, or freehand window. There is no way to set or
  turn off the secondary profile from the UI, and no row shows which profile each role
  uses.
- The window banner names the window role and delivery, but not the profile in effect
  in that window.
- The view only watches `model-profiles.json`, so a role change made in another window
  (or from the terminal) does not refresh it.
- Delete passes `--force` only for the applied (primary) profile. Deleting the profile
  assigned to the secondary role hits the CLI's `assigned` refusal (exit 3), and the
  user just sees an error.

After this feature, each profile row shows `primary` and `secondary` labels, two
pinned rows show both roles' state (including "off"), the inline action switches the
current window's own role, the context menu switches or turns off either role, and
the banner names the profile in effect in this window. Every window of the affected
role refreshes when a role changes.

## Decisions

The ask-questions tool was not available in this session, so the Planner asked these
on 2026-10-22 as a numbered list in chat (the §10 fallback). The user answered "use
all recommended", so every answer is the recommended option, quoted below.

- **Q1: What should a profile row's inline action do?** A: `a` — "'Use here': switch
  the current window's role (recommended). In a primary window this runs `use --role
  primary`; in a plan, build, or freehand window it runs `use --role secondary`. The
  right-click menu adds 'Use in primary windows', 'Use in secondary windows', and
  'Turn off for primary/secondary'. This is what the breakdown asks for."
- **Q2: How should the view show each role's state?** A: `a` — "Two rows pinned at
  the top, plus labels on profile rows (recommended). The top rows read 'Primary
  windows: `<name|custom|off>`' and 'Secondary windows: `<name|off>`'. Each has an
  inline turn-off and a click-to-pick. Profile rows also show `primary` / `secondary`
  labels, and the icon marks the profile in effect in this window. Reason: the 'off'
  state stays visible, which labels on profile rows alone can't show."
- **Q3: What should the window banner show?** A: `a` — "A third line, 'Models:
  `<profile>` (`<role>`)' (recommended). When the secondary role is off, it shows
  'secondary off → primary pins: `<name>`' so it names what actually runs. Clicking
  still opens Session & Doctor, and the banner stays script-free."
- **Q4: Switching the primary profile from a secondary window.** A: `a` — "Allow it,
  with a confirmation dialog only when run from a secondary window (recommended)."
- **Q5: What happens to the existing entry points?** A: `a` — "Make them all act on
  the current window's role (recommended). The *Agento: Select Model Profile* quick
  pick also offers 'Turn off' for this window's role. The editor's 'Save & Apply'
  becomes 'Save & Use here'. The title-bar Clear becomes 'Turn off (this window's
  role)'. Delete asks for confirmation and passes `--force` when the profile is
  applied or assigned to the secondary role."

Inherited from the initiative (breakdown `## Decisions`) and `role-active-profiles`:
two role buckets only (primary; plan/build/freehand share secondary); primary = the
clone's file pins (`use --role primary` ≡ `apply`, `use none --role primary` ≡
`clear`); secondary off means secondary windows use the file pins; `unmanaged` and
"outside any repository" count as primary.

## Research

Skills consulted: none — no matching domain. The repository's AGENTS.md has no
`## Agento` skills table and there is no `.agents/skills/` directory. Both test suites
use `node:test`.

- **CLI role data already exists (no CLI change needed).** `models list` returns
  `roles: { primary, secondary }` (`primary` is the clone's `active`: a profile name,
  `custom`, or `null`), `rolesFile: { path, exists, hash }`, and `rolesErrors`
  (probed on 2026-10-22 against a temp `AGENTO_CONFIG_HOME`). A dangling secondary
  assignment comes back as the raw name (`{"secondary":"ghost"}` with no error), and
  an invalid roles file as `secondary: null` plus `rolesErrors: ["invalid JSON: …"]`.
  The view must detect "dangling" itself by checking the name against `profiles[]`.
- **The `use` verb** (`scripts/agento.mjs` around 5189–5209): `--role primary` runs
  the same `pinModels` path as `apply`/`clear` and rejects `--expect`; `--role
  secondary` validates the profile (`not-found` / `invalid` exit 3), then writes the
  roles file through `writeRoles` with `--expect` compared against the **roles
  file** hash (`rolesFile.hash`). It returns `{ verb: "use", role, profile,
  secondaryBefore, … }`. `models delete <name>` of the secondary profile returns
  `status: "assigned"` (exit 3) without `--force` (around line 5157). The
  documentation is `docs/model-profiles.md` "Window roles" (lines 246–287).
- **Tree model.** `extension/src/modelProfilesTree.ts` is the pure model
  (`createModelProfilesModel`, `modelProfilesChildren`, `profileItemSpec`,
  `summarizePins`). It parses `profiles`, `active`, `profilesFile`, and `errors`, but
  ignores `roles`, `rolesFile`, and `rolesErrors`. `profileItemSpec` marks the
  applied profile with `pass-filled`, an `applied ·` description prefix, and the
  `agento.modelProfile.applied` contextValue. The provider
  (`extension/src/modelProfilesProvider.ts`) is a thin `TreeItem` converter that sets
  the `agento.modelProfiles.state` context key.
- **Commands and helpers.** `extension/src/modelProfiles.ts` has `ModelsSelection`
  (`apply` | `clear`), `toQuickPickItems`, `selectionToArgs`, the write arg builders
  (`createProfileArgs`, `renameProfileArgs`, `deleteProfileArgs`, `updateProfileArgs`,
  `aliasSetArgs`, `initProfilesArgs`), and `summarizeModelsResult` (no `use` verb or
  `assigned` status yet). `extension/src/extension.ts` (around 610–890) registers
  `agento.selectModelProfile` and the `agento.modelProfiles.*` commands (`apply`,
  `clear`, `new`, `duplicate`, `rename`, `delete`, `edit`, `openFile`, `init`), with
  prompts behind the `setModelProfilePrompts` test hook. Delete passes `--force` only
  when `active === profile.name` (line ~857).
- **Window role in the extension.** `sessionDoctor.current.session.role` (from the
  CLI session record via `sessionDoctorModel.ts`) is already used to bucket windows
  into `primary` / `secondary` for chat dispatch (`extension.ts:421`).
- **Watchers.** `rebuildModelProfileWatchers` (`extension.ts` ~217–250) watches the
  clone's agent files (so primary pin changes already refresh every window) and only
  `model-profiles.json` in the config directory, not `model-roles.json`. Each VS Code
  window runs its own extension host, so adding the roles-file watcher refreshes every
  open window.
- **Banner.** `extension/src/windowBanner.ts` builds `{ tone, title, detail, tooltip,
  colorId }` from the session model only; `renderWindowBannerHtml` emits a
  scripts-disabled webview (CSP `default-src 'none'`, nonce style) whose only link is
  `command:agento.sessionDoctor.focus`. `applySessionIndicators` (`extension.ts:136`)
  updates it on session refresh only.
- **Editor.** The editor's footer button "Save & Apply" (`extension/media/
  profileEditor.js:383`) posts `saveAndApply`; `profileEditorPanel.ts:311` calls
  `host.apply(name)`, wired in `extension.ts` to `runModelsSelection({ kind: "apply"
  })`.
- **package.json contributions.** `view/item/context` has inline Apply on
  `viewItem =~ /^agento\.modelProfile(\.invalid)?$/` (hidden on `.applied`), and
  Edit/Duplicate/Rename/Delete in `1_modify`. `view/title` has New, Clear (when
  ready), Refresh, and Open Profiles File. Row-only commands are hidden from the
  Command Palette.
- **Tests.** Unit tests: `extension/test/unit/modelProfilesTree.test.ts`,
  `modelProfiles.test.ts`, `windowBanner.test.ts`. Electron:
  `extension/test/electron/suite.ts` `assertModelProfilesView` (~672) runs against a
  temp git plugin clone (`AGENTO_E2E_PLUGIN_ROOT`) and a temp `AGENTO_CONFIG_HOME`,
  so role writes never touch the developer's real files. A stubbed-client scenario
  (~1540–1580) already drives the session role to `build`.
- **Release convention.** Each member bumps the version in `.claude-plugin/plugin.json`,
  `package.json`, `extension/package.json`, and `extension/package-lock.json` and
  adds `## <version> (unreleased)`; `/agento ship` stamps the date
  (`scripts/agento.mjs` ~3487). The current version is `0.12.0`, so this feature uses
  `0.13.0`.
- **Lint baseline (policy §5).** The full-repository lint command from AGENTS.md is
  `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`. `shellcheck` is not on
  `PATH`; the Planner ran the v0.10.0 release binary already unpacked at
  `/tmp/shellcheck-v0.10.0/shellcheck` on 2026-10-22: **exit 0, no findings**.
  `cd extension && npm ci && npm run typecheck`: exit 0. Test baselines on 2026-10-22:
  `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` 641/641 pass;
  `cd extension && npm run test:unit` 201/201 pass. The baseline is clean, so there is
  no overlap to clean up and no scoped-gate waiver: the gate is the full lint, the
  extension typecheck, and the full root, unit, and electron suites, all green. This
  delivery touches no shell files. `xvfb-run` is not installed; electron tests run
  with `DISPLAY=:0`, as earlier members did.
- **Concurrent deliveries.** `gh pr list --state open` returned no open PRs on
  2026-10-22, so there is no file overlap. `chat-model-preselect` (the other wave-5
  member) is unplanned; it will touch `commandDispatcher.ts`/`commandAgent.ts` and a
  CLI verb, not the files below.

## Approach

Extension-only presentation over the existing role data. No CLI or `scripts/` change,
so no `copy-cli` run.

1. **Window role bucket** (`extension/src/modelProfilesTree.ts`, pure). Add
   `type ProfileRole = "primary" | "secondary"` and `windowProfileRole(sessionRole:
   string | null): ProfileRole`: `plan`, `build`, and `freehand` → `secondary`;
   everything else (`primary`, `unmanaged`, unknown, or no session) → `primary`. This
   matches the CLI's rule for `models pins`.
2. **Role-aware model** (same file). `createModelProfilesModel` takes a `windowRole`
   input and parses `roles`, `rolesFile`, and `rolesErrors` into `model.roles`:
   - `primary`: the name, `custom`, or `null` (off);
   - `secondary`: the name or `null`, plus a `secondaryState` of `on`, `off`,
     `dangling` (the name is not in `profiles[]`), or `invalid` (`rolesErrors`
     non-empty, with the first error kept);
   - `rolesFile` (for `--expect`).

   Add `effectiveProfile(model)` → `{ role, name, source: "role-profile" |
   "file-pins", label }`: the secondary profile when the window is secondary and
   `secondaryState` is `on`, otherwise the primary pins (`<name>`, `custom pins`, or
   `picker default`).
3. **Pinned role rows** (`modelProfilesChildren`, `modelProfilesItemSpec`). In the
   `ready` state, the first two rows are `{ kind: "role", role }`:
   - label `Primary windows` / `Secondary windows`; description the assignment
     (`<name>`, `custom pins`, `off`, `<name> (missing) → primary pins`, or
     `invalid roles file → primary pins`), suffixed `· this window` on the row
     matching `windowRole`;
   - icon `pass-filled` when on, `circle-slash` when off, `warning` for dangling or
     invalid;
   - contextValue `agento.modelRole.<role>.<on|off>`;
   - a Markdown tooltip explaining what the role controls, and for dangling/invalid
     the fix;
   - a click command `agento.modelProfiles.pickForRole` with the role.

   The existing `custom` info row and the profile rows follow.
4. **Profile row labels.** `profileItemSpec(profile, model)` replaces the `applied ·`
   prefix with role labels: `primary` when `roles.primary === name`, `secondary` when
   `roles.secondary === name` (state `on`), joined with ` · ` and followed by the
   description. The icon is `pass-filled` for the profile in effect in this window,
   then `error` / `warning` / `symbol-misc` as today. The contextValue is
   `agento.modelProfile` followed, in this order, by `.primary`, `.secondary`,
   `.here` (in effect in this window), and `.invalid`, each only when it applies. The
   tooltip gains a **Roles** section ("Used by primary windows", "Used by secondary
   windows", "In effect in this window").
5. **Selections and args** (`extension/src/modelProfiles.ts`). Replace
   `ModelsSelection` with `{ kind: "use"; role: ProfileRole; profile: string } | {
   kind: "off"; role: ProfileRole }`. `selectionToArgs(selection, pluginRoot, {
   rolesHash })`:
   - primary keeps today's exact args (`models apply <name>` / `models clear`), so
     the primary path and its `worktree`/`dirty` findings are unchanged;
   - secondary → `models use <name|none> --role secondary [--expect <rolesHash>]`.

   `toQuickPickItems(listJson, windowRole)` marks each item with its role labels,
   ends with a "Turn off" item for that role ("use the picker's model" for primary,
   "use the primary windows' pins" for secondary), and its title/placeholder names
   the role. `summarizeModelsResult` gains `verb: "use"` messages for the secondary
   role (`Secondary windows now use <name>.` / `Turned off the secondary profile;
   secondary windows use the primary pins.`), a `STATUS_FALLBACK` for `assigned`, and
   treats `conflict` on the roles file like the profiles file. `deleteProfileArgs`
   takes `force` when the profile is applied **or** assigned to the secondary role.
6. **Commands** (`extension/src/extension.ts`, `extension/package.json`):
   - `agento.modelProfiles.apply` keeps its ID, is retitled **Use Here**
     (`$(check)`), and uses the profile for `windowRole`. It shows inline on rows
     without `.here`.
   - New row commands `agento.modelProfiles.usePrimary` ("Use in Primary Windows",
     shown without `.primary`), `useSecondary` ("Use in Secondary Windows", shown
     without `.secondary`), `offPrimary` / `offSecondary` ("Turn Off for Primary /
     Secondary Windows", shown on `.primary` / `.secondary`) in a `0_roles` context
     group. The role rows get an inline `offPrimary` / `offSecondary` (`$(circle-slash)`)
     on `.on` and click-to-pick through the new `agento.modelProfiles.pickForRole`
     (a quick pick of the profiles plus "Turn off" for that role). Every new command is
     hidden from the Command Palette.
   - `agento.modelProfiles.clear` keeps its ID, is retitled **Turn Off for This
     Window's Role**, and turns off `windowRole`.
   - `agento.selectModelProfile` uses the role-aware quick pick for `windowRole`.
   - Any action that changes the **primary** role (`usePrimary`, `offPrimary`,
     `pickForRole primary`) while `windowRole` is `secondary` first asks a modal
     confirm through a new `confirmPrimaryChange` prompt on `ModelProfilePrompts`
     ("This changes the clone's file pins, used by every primary window and by
     directly selected agents."). In a primary window it does not ask.
   - Delete computes `assigned = applied || roles.secondary === name`, names the
     roles in the confirm message, and passes `--force` when assigned.
   - Secondary writes pass `rolesFile.hash` as `--expect`; a `conflict` reloads the
     view with the existing warning.
   - The window role comes from `sessionDoctor.current` (ready → `session.role`, else
     `primary`). Whenever the session model updates, the model-profiles model is
     rebuilt with the new `windowRole` (no extra CLI call).
7. **Editor** (`profileEditorPanel.ts`, `media/profileEditor.js`). The host's
   `apply(profile)` becomes `useHere(profile)`, wired to `use` for `windowRole`. The
   footer button reads **Save & Use Here** with the tooltip "Save, then use the
   profile in this window's role". The `saveAndApply` message name stays as is
   (internal), so the message schema and its tests are unchanged.
8. **Watchers.** `rebuildModelProfileWatchers` watches `model-roles.json` next to
   `model-profiles.json` (the same directory, a `{model-profiles.json,model-roles.json}`
   pattern), keyed on `rolesFile.path` as well. A secondary change in any window or
   the terminal then refreshes every open window. Primary changes already refresh
   through the clone agent-file watcher.
9. **Banner** (`windowBanner.ts`, `windowBannerProvider.ts`, `extension.ts`).
   `createWindowBannerModel(session, models?)` takes an optional `models` line from a
   pure `modelsBannerLine(modelProfilesModel)`:
   - primary: `Models: <name> (primary)`, `Models: custom pins (primary)`, or
     `Models: picker default (primary off)`;
   - secondary on: `Models: <name> (secondary)`;
   - secondary off: `Models: secondary off → primary pins: <label>`;
   - dangling/invalid: `Models: secondary <name> missing → primary pins: <label>` /
     `Models: secondary invalid → primary pins: <label>`;
   - `null` (no line) when the view is not `ready`.

   `renderWindowBannerHtml` renders it as a third escaped `<span class="models">`
   inside the same anchor, and the tooltip appends one explanation line. The CSP,
   `enableScripts: false`, and the single `command:agento.sessionDoctor.focus` link
   are unchanged. `applySessionIndicators` is called on both session and
   model-profile updates.
10. **Docs and release.**
   - `docs/extension.md` "Model profiles": role rows, labels, Use Here, role menu,
     Turn Off, the primary confirm, the banner line, and the roles watcher.
   - `extension/README.md` "Model Profiles": the same, in short.
   - `docs/model-profiles.md` "Window roles": one paragraph pointing at the sidebar.
   - `CHANGELOG.md`: `## 0.13.0 (unreleased)`.
   - Version `0.13.0` in the four version files.

## Risks

- **Changing primary pins from a secondary window surprises other windows.** The file
  pins are clone-wide. Mitigation: the modal confirm (Decision Q4) in secondary
  windows, and the banner in every primary window refreshes through the agent-file
  watcher.
- **Breaking the existing Apply/Clear behavior and tests.** Mitigation: the command
  IDs `agento.modelProfiles.apply`/`clear` stay, and in a primary window they produce
  exactly today's `models apply`/`models clear` args. The existing electron
  apply/clear/delete assertions keep passing (the e2e window is primary).
- **contextValue regex drift hides or duplicates menu items.** Mitigation: unit tests
  assert the contextValue for every combination (primary/secondary/here/invalid), and
  the electron test asserts the `package.json` `when` clauses match the expected rows
  through `getTreeItem(...).contextValue`.
- **Stale role state across windows.** Mitigation: the `model-roles.json` watcher in
  every window, plus `--expect` on secondary writes (`conflict` → reload).
- **Dangling or invalid roles file looks "on".** Mitigation: the model derives
  `dangling`/`invalid` explicitly; the role row and banner say "→ primary pins", which
  is what the CLI's `models pins` actually resolves.
- **Banner webview security.** Mitigation: the new line is escaped text inside the
  existing scripts-disabled document; no new command URI is enabled.
- **Concurrent delivery.** No open PRs. `chat-model-preselect` may later touch
  `extension.ts`. Mitigation: integrate `origin/main` by merge before every push.

## Out of scope

- Any CLI change (`models list`/`use` already carry the data), the pin filter, and
  `copilotModels` rules.
- Applying the role profile to chat dispatch (that is `chat-model-preselect`).
- Separate profiles for plan, build, and freehand, or per-worktree profiles (two
  buckets only).
- Team-shared, per-project, or imported/exported profiles; cost estimation.
- Making the banner itself a switcher (Decision Q3 kept it script-free).

## Acceptance checklist

- [ ] `windowProfileRole` maps `plan`/`build`/`freehand` to `secondary` and every
  other role (or none) to `primary` — verified by
  `extension/test/unit/modelProfilesTree.test.ts`.
- [ ] In the `ready` state, the view's first two rows are the Primary and Secondary
  role rows. Each shows its assignment (`<name>`, `custom pins`, `off`, missing, or
  invalid → primary pins), marks `· this window` on the current role, has the
  documented icon and contextValue, and clicks to `pickForRole` — verified by unit
  tests over every state.
- [ ] Profile rows show `primary` / `secondary` labels before the description, mark
  the profile in effect in this window with `pass-filled`, and carry the
  `.primary`/`.secondary`/`.here`/`.invalid` contextValue tokens and a Roles tooltip
  section — verified by unit tests.
- [ ] The inline **Use Here** runs `models apply <name>` in a primary window and
  `models use <name> --role secondary --expect <rolesHash>` in a secondary window.
  **Turn Off for This Window's Role** runs `models clear` / `models use none --role
  secondary` — verified by unit tests on `selectionToArgs`, and in the electron test
  for the primary window.
- [ ] The context menu's Use in Primary/Secondary Windows and Turn Off for
  Primary/Secondary Windows, and the role rows' inline turn-off and click-to-pick,
  write the right role. Driven in the electron test against the temp
  `AGENTO_CONFIG_HOME`: after `useSecondary` on a profile, `model-roles.json` names
  it and the view shows the `secondary` label; after `offSecondary` it reads `off`.
- [ ] A primary-role change from a secondary window asks `confirmPrimaryChange`
  first, and declining writes nothing; in a primary window it does not ask —
  verified by unit tests on the decision helper and an electron or unit test on the
  command path.
- [ ] Deleting a profile assigned to the secondary role confirms and passes
  `--force`, and the secondary role ends `off` — verified in the electron test (the
  CLI's `assigned` refusal is no longer reachable from the view).
- [ ] *Agento: Select Model Profile* lists the profiles with role labels plus "Turn
  off" for this window's role, and its selection runs the role-aware args — verified
  by unit tests on `toQuickPickItems`.
- [ ] The editor footer reads **Save & Use Here** and, after saving, uses the
  profile for this window's role — verified by the editor unit/harness tests and the
  wiring in `extension.ts`.
- [ ] A role change made outside the window (`models use <name> --role secondary` from
  the CLI) refreshes the view and the banner through the `model-roles.json` watcher —
  verified in the electron test by waiting for `roles.secondary` to change without
  invoking any view command.
- [ ] The window banner shows a third escaped `Models: …` line for every documented
  case. The CSP, `enableScripts: false`, and the single command URI are unchanged —
  verified by `extension/test/unit/windowBanner.test.ts`, and by the electron banner
  HTML containing `Models:`.
- [ ] `docs/extension.md`, `extension/README.md`, `docs/model-profiles.md`, and
  `CHANGELOG.md` (`## 0.13.0 (unreleased)`) describe the behavior, and the version is
  `0.13.0` in all four version files — verified by reading the diff and by
  `node --test tests/*.test.mjs`.
- [ ] Full gate green against the clean baseline:
  `/tmp/shellcheck-v0.10.0/shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`
  exit 0 with no findings, and `node --test 'scripts/**/*.test.mjs'
  'tests/**/*.test.mjs'` with at least 641 passing. The four guard replays pass. `cd
  extension && npm ci && npm run build && npm run typecheck && npm run test:unit`
  passes at least 201 plus the new tests, `DISPLAY=:0 npm run test:electron` passes
  every scenario, and `npm run package` succeeds.
