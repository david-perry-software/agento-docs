# Review: role-profile-sidebar

Verdict: approve

Reviewed on 2026-10-22 against product HEAD `401c718` (`feature/role-profile-sidebar`,
PR #128, `origin/main` is an ancestor) and companion HEAD `223325a`
(agento-docs PR #65). Diff: `git diff origin/main...HEAD` — 21 files, +1116/−190,
extension-only plus docs and version files; no `scripts/` or shell change.

Verification run by the Reviewer in the product worktree (every command re-run,
none trusted from the roadmap):

| Check | Command | Result |
| --- | --- | --- |
| Shell lint (policy §5 gate) | `/tmp/shellcheck-v0.10.0/shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` | exit 0, no findings (= baseline) |
| Root tests | `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | 641/641 pass, exit 0 |
| Guard replays | the five `replay-guard.sh` lines in AGENTS.md (default, companion, copilot, copilot+companion, copilot fixtures) | 5/5 exit 0 |
| Extension install/build/typecheck | `cd extension && npm ci && npm run build && npm run typecheck` | exit 0 / 0 / 0 |
| Extension unit tests | `npm run test:unit` | 215/215 pass (baseline 201 + 14 new) |
| Electron | `DISPLAY=:0 npm run test:electron` | exit 0, 4/4 scenarios; in-repo log names "model profiles (role rows, secondary writes, roles watcher), model-profile editor" |
| Package | `npm run package` | exit 0, `agento-dashboard-0.13.0.vsix` (56 files), VSIX assertion passed |
| Clean trees | `git status --porcelain --untracked-files=all` in both halves | empty |

The user-visible behaviour is a VS Code tree view, context menu, quick pick, and
webview banner; the faithful driver for it is the electron suite above (temp plugin
clone + temp `AGENTO_CONFIG_HOME`), which the Reviewer re-ran independently. No
browser target applies, so no screenshot evidence is attached.

## Acceptance checklist results

1. **`windowProfileRole` buckets plan/build/freehand → secondary, else primary** — **pass**.
   `extension/src/modelProfilesTree.ts:129-131`; unit test `windowProfileRole buckets
   plan, build, and freehand to secondary and everything else to primary`
   (`modelProfilesTree.test.ts:267`) covers `null`, `primary`, `unmanaged`, and an
   unknown role.
2. **Two pinned role rows first, with assignment, `· this window`, icon,
   contextValue, click-to-pick** — **pass**. `modelProfilesChildren` seeds
   `[{role:"primary"},{role:"secondary"}]` (`modelProfilesTree.ts:196`);
   `roleItemSpec` (`:298-340`) renders `<name>`, `custom pins`, `off`, `<name>
   (missing) → primary pins`, `invalid roles file → primary pins`, icons
   `pass-filled`/`circle-slash`/`warning`, and `agento.modelRole.<role>.<on|off>`;
   `modelProfilesProvider.ts:44-46` sets `command: agento.modelProfiles.pickForRole`
   with the role. Unit tests `modelProfilesChildren puts the two role rows first…`
   and `roleItemSpec renders the primary and secondary pinned rows` cover every
   state including `primary: "custom"`, `null`, dangling `ghost`, and `rolesErrors`.
   Electron step 11 asserts the first two children are `["primary","secondary"]`.
3. **Profile rows: role labels, `pass-filled` for the profile in effect,
   `.primary/.secondary/.here/.invalid` tokens, Roles tooltip** — **pass**.
   `profileItemSpec` (`modelProfilesTree.ts:281-296`) and `profileTooltip`; unit
   tests at `modelProfilesTree.test.ts:178` and `:213` assert
   `agento.modelProfile.primary.here`, `.invalid`, plain, and
   `.primary.secondary.here` with the three Roles lines. Electron asserts
   `primary · Everyday models` / `agento.modelProfile.primary.here` after apply.
4. **Use Here → `models apply <name>` (primary) / `models use <name> --role secondary
   --expect <rolesHash>` (secondary); Turn Off → `models clear` / `models use none
   --role secondary`** — **pass**. `selectionToArgs` (`modelProfiles.ts:112-126`)
   keeps the exact pre-existing primary args and adds `--expect` only on secondary;
   `extension.ts` `agento.modelProfiles.apply` and `.clear` call
   `runModelsSelection` with `currentWindowRole()`, which passes
   `modelProfiles.current.roles.rolesFile.hash` as `rolesHash`. Unit tests
   `selectionToArgs maps use/off for each role and passes --expect on secondary
   writes` and `Use Here in a secondary window issues models use <name> --role
   secondary`; electron steps 4–5 (primary apply/clear) still pass unchanged.
5. **Context-menu Use/Turn Off per role and role-row inline turn-off / click-to-pick
   write the right role (electron, temp config home)** — **pass**. Electron step 11:
   `useSecondary` on `editor-renamed` → `model-roles.json` matches
   `"secondary": "editor-renamed"` and the row description/contextValue carry
   `secondary`; `offSecondary` → `secondaryState === "off"` and the file no longer
   names it. The role rows' inline buttons invoke the same `offPrimary`/`offSecondary`
   commands (`package.json` `view/item/context` on `agento.modelRole.*.on`).
   `pickForRole` itself is registered (electron command check at `suite.ts:1230`)
   and wired by code reading (`extension.ts` → `pickProfile(list, placeholder,
   targetRole)` → `runRoleSelection`), not driven end-to-end — see Findings (minor).
6. **Primary change from a secondary window asks `confirmPrimaryChange`; declining
   writes nothing; primary window does not ask** — **pass**. `needsPrimaryConfirm`
   and `gateRoleSelection` (`modelProfiles.ts:129-144`); `runRoleSelection` returns
   `undefined` before any CLI call when the gate is false (`extension.ts:720-724`).
   Unit tests `needsPrimaryConfirm is true only for a primary target in a secondary
   window` and `gateRoleSelection asks … and a declined confirm writes nothing`;
   electron asserts `primaryChangeConfirms` stays `[]` through `useSecondary`,
   `offSecondary`, and delete in the primary e2e window.
7. **Deleting a secondary-assigned profile confirms and passes `--force`; role ends
   `off`** — **pass**. `extension.ts:946-950` computes `assignedSecondary` and passes
   `force: applied || assignedSecondary`; the CLI's `delete --force` then writes
   `secondary: null` (`scripts/agento.mjs:5162-5166`). Electron: `confirmDelete`
   stub asserts `assignedSecondary === true` for `watched`, and the wait condition
   requires the profile gone **and** `roles.secondary === null`.
8. **Select Model Profile quick pick: role labels + "Turn off" for this window's
   role, role-aware args** — **pass**. `toQuickPickItems(listJson, windowRole)`
   (`modelProfiles.ts:79-110`); unit test `toQuickPickItems marks role labels and
   ends with a role-aware Turn off`; `agento.selectModelProfile` passes the result
   to `runModelsSelection`, and its placeholder names the role. Electron step 9
   still applies `review` through the quick pick.
9. **Editor footer "Save & Use Here" uses this window's role** — **pass**.
   `extension/media/profileEditor.js:383`; `ProfileEditorHost.useHere` wired to
   `runModelsSelection({ kind: "use", role: currentWindowRole(), profile })`
   (`extension.ts:757`); electron editor step 6 relabelled and passing.
10. **External `models use … --role secondary` refreshes the view through the
    `model-roles.json` watcher** — **pass**. `rebuildModelProfileWatchers` watches
    `model-roles.json` in `dirname(rolesFile.path)` and keys on the path
    (`extension.ts:242-289`); electron step 11 runs `runCli(["models","use",
    "editor-renamed","--role","secondary"])` and waits for `roles.secondary` to
    change with no view command.
11. **Banner third escaped `Models:` line for every documented case; CSP,
    `enableScripts: false`, single command URI unchanged** — **pass**.
    `modelsBannerLine` (`windowBanner.ts:58-71`) and the `<span class="models">`
    render; unit tests `modelsBannerLine renders every documented case and null when
    not ready`, `… marks an invalid roles file`, and `banner HTML renders the models
    line escaped and keeps the CSP and single command link` (hostile `<img onerror>`
    escaped, `default-src 'none'; style-src 'nonce-abc'`, exactly one `href=`).
    Electron asserts `api.windowBanner.html` contains `Models:`.
12. **Docs, CHANGELOG `## 0.13.0 (unreleased)`, version `0.13.0` in four files** —
    **pass**. `grep -c '"version": "0.13.0"'` = 1 in `extension/package.json`,
    `.claude-plugin/plugin.json`, `package.json`; `extension/package-lock.json` lines
    3 and 9; `grep -n "applied ·" docs/extension.md extension/README.md` prints
    nothing; `docs/model-profiles.md` "Window roles" gains the sidebar paragraph;
    CHANGELOG entry present. `node --test tests/*.test.mjs` is part of the 641 pass.
13. **Full gate green against the clean baseline** — **pass**. See the table above:
    shellcheck exit 0 / no findings, 641 root tests, 5/5 guard replays, unit 215,
    electron 4/4, package OK.

## Plan vs implementation

- Decisions Q1–Q5 are implemented as written: Use Here per window role; two pinned
  role rows with `on`/`off`/`dangling`/`invalid`; the banner line stays inside the
  scripts-disabled webview with no new command URI; the primary confirm fires only
  from secondary windows (`gateRoleSelection`); Delete confirms with the role names
  and forces when applied or secondary-assigned; the quick pick, editor
  "Save & Use Here", and the title-bar "Turn Off for This Window's Role" all act on
  the current role.
- Pre-existing primary behaviour is unchanged: `selectionToArgs` produces byte-for-
  byte the old `models apply <name> --plugin-root` / `models clear --plugin-root`
  args, and the existing electron apply/clear/delete/conflict steps pass without
  loosening.
- `package.json` `when` clauses were checked against the contextValue grammar
  `agento.modelProfile[.primary][.secondary][.here][.invalid]`: Use Here hidden on
  `.here`, `usePrimary` hidden on `.primary`, `useSecondary` hidden on `.secondary`,
  `offPrimary` on `.primary`, `offSecondary` on `(.primary)?.secondary`; none match the
  `agento.modelRole.*`, `agento.modelProfileInfo`, or `agento.modelProfileMessage`
  rows for the role group. Every new command is `when: false` in `commandPalette`.
- Small deviation, documented in the roadmap step itself: 4.2's secondary-window
  path is covered by unit tests on the extracted `gateRoleSelection` /
  `selectionToArgs` plus `windowProfileRole` rather than by driving the stubbed
  `build`-role electron scenario. The step text allowed this alternative.
- Undocumented but harmless: the primary role row treats `custom` pins as `off`
  (`circle-slash`, `agento.modelRole.primary.off`), so it has no inline turn-off;
  the plan's item 3 did not specify `custom`. Clear remains reachable through the
  row click (pick → Turn off) and the title bar.

## Roadmap audit

Every ticked box was spot-checked against the code and the commit that ticked it
(`f7cc0f9` … `401c718`): 1.1–1.3 (`modelProfilesTree.ts`, `modelProfiles.ts`,
their tests), 2.1 (`package.json` contributions, verified with `node -e`), 2.2–2.3
(`extension.ts` commands, `runRoleSelection`, roles watcher), 2.4 (editor),
3.1 (banner), 4.1–4.2 (electron step 11 and the wiring unit tests), 5.1–5.2 (docs
and version files), 5.3 (gate counts reproduced above). No falsely ticked box, no
`(manual)` or `(manual, post-ship)` step, no missing work found; no repairs made.

Note on 5.3: the line records "4/4 guard replays" while AGENTS.md lists five
`replay-guard.sh` invocations (the Copilot-fixtures one is the fifth). All five pass
in this review; the tick stands.

## Findings

No finding above minor severity.

1. **Minor — `pickForRole` is not driven end-to-end.** The role rows' click command
   is registered and wired (`modelProfilesProvider.ts:44-46`, `extension.ts`
   `modelProfilesPickForRoleCommand`), but neither the electron suite nor a unit test
   exercises the stubbed `pickProfile(list, placeholder, role)` → `runRoleSelection`
   path. The code is short and read correct; a follow-up assertion would close it.
2. **Minor — docs wording on `--expect`.** `docs/extension.md` and
   `extension/README.md` say writes pass "the profiles-file hash for primary writes";
   `models apply` / `models clear` pass no `--expect` (unchanged from before — the
   profiles-file hash applies to create/rename/delete/update/alias). Reword to "the
   profiles-file hash for profile edits" on the next docs touch.
3. **Minor — secondary-window command path proved by unit tests only** (roadmap 4.2
   alternative). `currentWindowRole()` → `windowProfileRole(session.role)` →
   `selectionToArgs` are each unit-tested; the composed path in a `build`-role
   window is read, not executed.

## Follow-ups

- Extend the electron `build`-role stubbed scenario (`suite.ts` ~1644) to execute
  `agento.modelProfiles.apply` and `pickForRole` with a stubbed `pickProfile` and
  assert the `models use … --role secondary` args and the declined
  `confirmPrimaryChange` writing nothing.
- Consider an inline Clear on the primary role row when it shows `custom pins`
  (today it is `.off` with no inline action).
- Reword the `--expect` sentence in `docs/extension.md` / `extension/README.md` as in
  Finding 2.
