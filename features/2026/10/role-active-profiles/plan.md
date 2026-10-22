# Role-active profiles: separate primary and secondary model profiles, resolved per window role

## Problem

Today exactly one model profile is active per plugin clone. `models apply <name>`
writes the profile into the clone's agent and command `model:` lines
(`scripts/agento.mjs`, apply block around lines 4950–5038), and `models pins` reads
those same file pins back (`modelsPins`, `scripts/agento.mjs:3810`). The router
(`skills/agento/SKILL.md`, "Subagent" dispatch) and the Autopilot
(`.github/agents/delivery-autopilot.agent.md`, Preflight step 2) pass these pins as
the Builder and Reviewer subagent models. So every window uses the same models, and
switching the profile for a build worktree also switches it for the primary window.
`docs/model-profiles.md` "Limits" states this: "One profile is active per clone
(machine-wide, last apply wins)".

This feature gives the two window buckets separate active profiles:

- **Primary windows** (role `primary`, and `unmanaged` per Q5) keep using the clone's
  file pins. `models use <name> --role primary` is `apply`, and
  `models use none --role primary` is `clear`.
- **Secondary windows** (roles `plan`, `build`, `freehand`) get their own profile.
  It is stored in a separate user-level `model-roles.json` and can be turned off with
  `models use none --role secondary`.
- **`models pins` resolves for the current window's role.** The role comes from the
  session record (`deriveRole`) unless `--role` overrides it. In a secondary window
  with a secondary profile assigned, the pins come from that profile. Otherwise they
  are today's file pins. The router and the Autopilot keep their call shape, so
  Builder and Reviewer subagents in plan, build, and freehand windows run on the
  secondary profile's models.
- **`models list` reports `roles: { primary, secondary }`.** Rename and delete keep
  the secondary assignment consistent, and doctor's `model-profile` check reports
  both roles and flags a dangling secondary assignment.

This is the `role-active-profiles` member of the
[model-profile-manager initiative](../../../../initiatives/2026/10/model-profile-manager/breakdown.md)
(its `### role-active-profiles` block, wave 4). Brief: "We should be able to turn
certain profiles on and off in primary and secondary windows." It is CLI and
instruction work only. The sidebar presentation (`role-profile-sidebar`) and
chat-dispatch preselection (`chat-model-preselect`) build on it.

## Decisions

The ask-questions tool was not available in this session, so the Planner asked these
on 2026-10-22 as a numbered list in chat (the §10 fallback). The user answered
"1.a 2. a 3. a 4. a 5. a". Every answer is the recommended option, and the option
text is quoted verbatim below.

- **Q1: Where is the secondary-window assignment stored?** A: `a` — "A separate
  user-level `model-roles.json` next to `model-profiles.json`, written atomically with
  the same `--expect` check (recommended): keeps the user-authored profiles file and
  its validator unchanged."
- **Q2: What does the primary role mean?** A: `a` — "Primary = the clone's file pins
  (recommended): `models use <name> --role primary` ≡ `apply`, `use none --role
  primary` ≡ `clear`; `roles.primary` is derived from the clone's `active`, so it
  can't drift."
- **Q3: When the secondary role is off, what model do subagents in
  plan/build/freehand windows get?** A: `a` — "The file pins (the primary's models),
  as today (recommended) — matches the breakdown."
- **Q4: Renaming or deleting a role-assigned profile?** A: `a` — "Rename moves the
  assignment; delete is refused without `--force`, and `--force` turns that role off
  (recommended) — same rule as the applied profile today."
- **Q5: Which role does `models pins` use in an `unmanaged` window or outside any
  repository?** A: `a` — "Primary (the file pins) (recommended): today's behavior, so
  nothing changes outside managed worktrees."

Inherited from the initiative (breakdown `## Decisions`): two buckets only, primary
and secondary, with plan, build, and freehand sharing one (follow-up (b)). Team-shared
profiles are out of scope.

## Research

Skills consulted: none — no matching domain. The repository's AGENTS.md has no
`## Agento` skills table and there is no `.agents/skills/` directory. Both test suites
use `node:test`.

- **Profiles file, path, and parsing.** `profilesFile(env, home)`
  (`scripts/model-profiles.mjs:13-17`) resolves `AGENTO_CONFIG_HOME`, else
  `$XDG_CONFIG_HOME/agento`, else `~/.config/agento`. `parseProfiles`
  (`scripts/model-profiles.mjs:121-175`) treats unknown top-level keys as errors.
  That is why Q1 keeps role state out of this file. `serializeProfiles` and
  `profilesHash` (`:30-39`) are the stable serializer and the sha256 used by
  `--expect`.
- **Write path.** `writeProfiles` (`scripts/agento.mjs:3635-3681`) re-reads and
  compares the file, honors `--expect`, refuses file-level errors, re-parses the
  result, and writes atomically (temp file opened `wx`, fsync, rename, mode kept,
  temp cleanup on failure). The roles writer reuses this pattern for
  `model-roles.json`.
- **`models` dispatch.** `case "models"` (`scripts/agento.mjs:4792`) uses a per-verb
  spec table `MODEL_VERBS` (`argc`, `names`, `accepts`, `writes`). Option names are
  checked against `accepts` (`:4822-4824`), and profile names must match
  `[a-z0-9-]+` (`:4821`). Global options are parsed at `scripts/agento.mjs:100-120`
  (`--force`, `--dry-run`, `--expect`, `--from`, `--description`). There is no
  `--role` yet. `list` emits `profiles`, `pinnable`, `copilotModels`, `errors`, and
  `modelsReport` (`:4847-4866`). `pins` emits `pins` and `warnings` (`:4873-4878`).
  `delete` refuses the applied profile without `--force` (`status: "active"`, exit 3).
  `rename` keeps `active` by content.
- **Pin shape.** `modelsPins` (`scripts/agento.mjs:3810-3829`) returns
  `{ <alias>: { name, file, model, subagentModel, copilotModel } }`.
  `subagentModel` is the string or the first list entry, and `copilotModel` is its
  `copilotModels` alias or `null`. `resolveProfile` (`:3684-3690`) yields a
  profile's per-file `targets`, and `agentTargetValue` (`:3832-3834`) picks one
  alias's value. Together they produce the same pin shape from a profile without
  touching files. `pinWarnings` (`:3851-3857`) computes the BYOK-tier, unqualified,
  and missing-alias warnings over a pin set.
- **Window roles.** `deriveRole` (`scripts/session-state.mjs:192-207`) classifies a
  cwd as `primary`, `plan`, `build`, `freehand`, or `unmanaged`. Hosted workspaces
  derive the role from the branch (`build` or `primary`). `roleForManaged`
  (`:128-133`) maps a `freehand-*` directory to `freehand`, a delivery branch to
  `build`, and anything else to `plan`. `sessionContext` (`scripts/agento.mjs:801-806`)
  calls it with `productWorktrees()`, `primaryWorktreesDir(...)`, `config`,
  `roleCwd`, and `companionWorktreesDir`. A pins-time helper can reuse exactly that
  call without building the full record, which needs PR lookups.
- **Consumers of `models pins`.** The router's "Subagent" mode
  (`skills/agento/SKILL.md`, step 5) and the Autopilot's Preflight step 2 and loop
  steps 1–3 read `pins.builder` and `pins.reviewer` `subagentModel`/`copilotModel`.
  The extension does not call `pins`. It uses `models list`, `show`, `apply`, and the
  CRUD verbs, and parses `list` permissively, so extra fields are ignored
  (`extension/src/modelProfilesTree.ts:97-112`, `extension/src/modelProfiles.ts`).
  The router and Autopilot run `models pins` from the workspace cwd, which is
  what makes cwd-based role derivation correct for them.
- **Doctor.** The informational `model-profile` check (`scripts/agento.mjs:959-1004`)
  reports profiles-file errors, filter health, `custom` pins, and pin warnings. It is
  not in `CAPABILITY_CHECKS`, so `doctor --for` never runs it. The doctor test at
  `scripts/agento.test.mjs:1442` asserts the check list. Its count stays the same
  because no check is added.
- **Command, docs, mirrors.** `skills/agento/commands/models.md` and
  `.github/prompts/models.prompt.md` are identical (`diff -q` is silent) and map
  arguments to verbs. Its `Needs:` line is `terminal`, matching
  `COMMAND_NEEDS.models` (`scripts/agento.mjs:1157`). `README.md:443` lists the
  `/agento models` verbs. `docs/model-profiles.md` has "Subagents and handoffs"
  (`:305`) and "Limits" (`:339`). `CHANGELOG.md` tops out at `## 0.11.0 (2026-10-22)`
  and has no unreleased section yet. `extension/cli/` is a byte copy of `scripts/`
  (`cd extension && npm run copy-cli`), guarded by `tests/extension-bundle.test.mjs`.
  `tests/customizations.test.mjs:1068` forbids committed `model:` lines, which only
  matters if a test fixture leaks pins into the clone.
- **Tests.** `scripts/model-profiles.test.mjs` covers the pure helpers.
  `scripts/agento.test.mjs` has about 300 `models` assertions (from about line 3094)
  and isolates the config home with `AGENTO_CONFIG_HOME`.
  `scripts/session-state.test.mjs:35` drives `deriveRole` over fixture layouts.
- **Lint baseline (policy §5).** The full-repository lint command from AGENTS.md is
  `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`. `shellcheck` is not
  installed on this machine (`command not found`, exit 127). The Planner ran the
  official v0.10.0 release binary from
  `https://github.com/koalaman/shellcheck/releases/download/v0.10.0/shellcheck-v0.10.0.linux.x86_64.tar.xz`,
  unpacked under `/tmp`. Result: **exit 0, no findings**. Test baseline:
  `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` gave 612 tests, 612
  pass, exit 0. Overlap decision: the baseline is green, so there is nothing to clean
  up and no scoped-gate waiver. The gate is the full lint plus the full test suite,
  both staying green. This delivery touches no shell files.
- **Concurrent deliveries.** `gh pr list --state open` returned no open PRs on
  2026-10-22, so there is no file overlap with another delivery.

## Approach

All code lands in `scripts/model-profiles.mjs` (pure helpers) and
`scripts/agento.mjs` (CLI), mirrored to `extension/cli/` with `npm run copy-cli`. No
extension source changes.

1. **Role state file (pure, `scripts/model-profiles.mjs`).**
   - `rolesFile(env, home)`: `model-roles.json` in the same directory
     `profilesFile` resolves.
   - `parseRoles(text)`: returns `{ secondary, errors }`. The file is a JSON object
     whose only allowed key is `secondary`, and its value is a profile name
     (`[a-z0-9-]+`) or `null`. Any other key, or a bad value, is an error.
   - `serializeRoles(data)`: 2-space JSON plus a trailing newline. Hashing reuses
     `profilesHash`.
   - `ROLE_BUCKETS = ["primary", "secondary"]`.
   - `roleBucket(windowRole)`: `plan`, `build`, and `freehand` map to `secondary`.
     `primary`, `unmanaged`, and anything else map to `primary` (Q5).
   - An absent file means the secondary role is off.
2. **Roles I/O (`scripts/agento.mjs`).**
   - `loadRoles()` mirrors `loadProfiles()`:
     `{ rolesFile: { path, exists, hash }, raw, secondary, errors }`.
   - `writeRoles(loaded, next, { expect })` mirrors `writeProfiles`: re-read and
     compare (`conflict`), `--expect` check, refuse a file with errors (`invalid`,
     left untouched), then atomic temp, fsync, rename keeping the mode, and temp
     cleanup. Its temp-file prefix is `.model-roles.json.`.
3. **`--role` option.** Add `--role <primary|secondary>` to the global parser. Any
   other value, or a missing value, is a usage error (exit 1). Only `use` and `pins`
   accept it.
4. **`models list`** adds `roles: { primary, secondary }` and
   `rolesFile: { path, exists, hash }`. `roles.primary` is the clone's derived
   `active` (a name, `custom`, or `null`). `roles.secondary` is the stored name or
   `null`. A roles-file parse error is reported in `rolesErrors` and leaves `list`
   otherwise unchanged. The additions are additive, so the extension's permissive
   parser is unaffected.
5. **`models use <name|none> --role <primary|secondary>`**, a new `MODEL_VERBS`
   entry: `argc: 1`, accepts `role` and `expect`, writes. `--role` is required.
   - `--role primary` with a name runs exactly the `apply <name>` path, and with
     `none` exactly the `clear` path, including the `worktree`, `dirty`, and
     `git-too-old` findings. Factor the apply/adopt/clear tail into a function both
     the old verbs and `use` call, so behavior cannot diverge. `--expect` with
     `--role primary` is a usage error because nothing in the profiles file is
     written.
   - `--role secondary` with a name requires the profile to exist (`not-found`,
     exit 3) and to resolve without errors (`invalid`, exit 3). It then writes
     `{ "secondary": "<name>" }` via `writeRoles`. With `none` it writes
     `{ "secondary": null }`. The result reports `roles`, `rolesFile`,
     `secondaryBefore`, and `written`.
   - `none` is reserved: `models create none` and `models rename <x> none` become
     usage errors (exit 1) naming the reservation. An existing profile literally
     named `none` can still be applied with `apply none`. The docs say so.
6. **`models pins [--role <primary|secondary>]`.**
   - Determine `windowRole` from `deriveRole` with the same inputs `sessionContext`
     uses, through a small `currentWindowRole()` helper that never calls `gh`. If
     derivation throws or the cwd is outside a repository, the role is `unmanaged`.
   - `role` is `--role` when given (`roleSource: "flag"`), else
     `roleBucket(windowRole)` (`roleSource: "window"`).
   - If `role` is `secondary`, a secondary profile is assigned, it exists, and it
     resolves without errors, build `pins` from the profile. For each
     `AGENT_ALIASES` entry, take `agentTargetValue(resolved.targets, alias)`. The
     entry has the same `name`/`file` as today, `model` set to that value,
     `subagentModel` set to the string or the first list entry, and `copilotModel`
     set to its alias or `null`. Set `source: "role-profile"` and
     `profile: "<name>"`.
   - Otherwise use today's `modelsPins` (`source: "file-pins"`, `profile` set to the
     derived `active`). A dangling assignment (profile deleted out of band) or an
     invalid secondary profile falls back to file pins and adds a warning naming the
     assignment and the fix (`models use none --role secondary` or
     `models use <name> --role secondary`). An invalid roles file does the same.
   - Output adds `role`, `roleSource`, `windowRole`, `profile`, and `source`. The
     `pins` shape and `warnings` (via `pinWarnings` over the chosen pins) are
     unchanged, so router and Autopilot calls keep working as written.
7. **Rename and delete keep roles consistent (Q4).**
   - `models rename <old> <new>`: when `secondary === old`, write the roles file
     after the profiles file succeeds, and report `secondaryBefore`/`roles`. If the
     roles write fails, the result says so and the `pins` fallback and doctor warning
     cover the dangling state.
   - `models delete <name>`: when `secondary === name` and there is no `--force`,
     return `status: "assigned"` (exit 3, message naming `models use none --role
     secondary` and `--force`) with both files byte-identical. With `--force`, delete
     the profile, then write `{ "secondary": null }`. The existing applied-profile
     rule (`status: "active"`) is checked first and is unchanged.
8. **Doctor `model-profile`.** After the existing checks, include the roles in
   `detail` (`primary: <active|none>; secondary: <name|off>`). `warn` with a fallback
   when the roles file is invalid, the secondary assignment is dangling, or the
   secondary profile has errors. The healthy path stays `ok`, and the check count is
   unchanged.
9. **Instructions.**
   - `skills/agento/commands/models.md` and `.github/prompts/models.prompt.md` stay
     identical. Add the `use` verb, the `--role` argument shape, and what to report
     for `use`, `list` `roles`, and `pins` `role`/`source`. Add the `assigned`
     finding, and a `next:` rule: after `use … --role primary`, as after `apply`/`clear`;
     after `use … --role secondary`, run `/agento models`.
   - `skills/agento/SKILL.md` (Subagent mode) and
     `.github/agents/delivery-autopilot.agent.md` (Preflight step 2) each gain one
     sentence: `models pins` already resolves the current window role's profile, so
     the call stays unchanged and must not pass `--role`.
10. **Docs.**
    - `docs/model-profiles.md` gets a new "Window roles" section: the buckets, `use`,
      the roles file, `pins` resolution, off behavior, and rename and delete.
      "Limits" replaces the one-profile-per-clone bullet with the role model.
      "Subagents and handoffs" adds a note that a directly selected agent in a
      secondary window still reads the clone's file pins (the primary's). Only
      router and Autopilot subagents, and later `chat-model-preselect`, use the
      secondary profile.
    - `README.md:443` adds `use <name|none> --role primary|secondary` to the
      `/agento models` row.
    - `CHANGELOG.md` gets a new top `## 0.12.0 (unreleased)` section with an
      **Added** entry.
    - The header usage comment at `scripts/agento.mjs:32` lists `use` and `--role`.

## Risks

- **Two files are written non-atomically on rename and delete of the secondary
  profile.** A crash between the profiles write and the roles write leaves a dangling
  assignment. Mitigation: profiles first, then roles. `pins` falls back to file pins
  with a warning, and doctor warns with the one-command fix. No silent wrong model.
- **Role derivation cost and failure inside `models pins`.** It runs on every router
  subagent dispatch. Mitigation: reuse `deriveRole` with only `git worktree list`
  inputs (no `gh`, no PR lookups). Any failure falls back to `unmanaged`, which maps
  to primary, which is today's behavior (Q5).
- **A directly selected agent in a secondary window still runs on the primary's file
  pins (Local harness) or the session model (Copilot harness).** The secondary
  profile only reaches dispatch-time subagents. Mitigation: the docs state this
  explicitly. `chat-model-preselect` is the planned follow-up for extension-launched
  commands.
- **The reserved name `none`.** An existing profile named `none` cannot be
  role-assigned by `use`. Mitigation: `create` and `rename` refuse it going forward,
  `apply none` still works, and the docs note it.
- **Behavior change in managed worktrees for users who never set a secondary
  profile.** None: with no `model-roles.json`, the secondary role is off and `pins`
  returns today's file pins (Q3). Tests assert this explicitly.
- **Generated-copy drift (`extension/cli/`).** Mitigation: every CLI step runs
  `cd extension && npm run copy-cli`, and its verify includes
  `tests/extension-bundle.test.mjs`.
- **Concurrent deliveries.** No open PRs at planning time. Mitigation: integrate
  `origin/main` by merge before every push. `role-profile-sidebar` and
  `chat-model-preselect` are blocked on this feature, so they cannot overlap it.

## Out of scope

- Any extension UI for roles: badges, per-role switch actions, banner text. That is
  `role-profile-sidebar`.
- Preselecting chat models for extension-launched commands. That is
  `chat-model-preselect`.
- Separate profiles for `plan`, `build`, and `freehand`, or per individual window or
  worktree (initiative follow-up (b)).
- Per-project profiles, import/export, cost estimation, and team-shared profiles
  (initiative out of scope).
- Changing the pin filter transport, the `copilotModels` resolution rules, or the
  profiles-file schema.
- Pinning commands that run inline (Planner, Architect, Mechanic, Autopilot itself);
  they keep using the session model.

## Acceptance checklist

- [ ] `rolesFile`, `parseRoles`, `serializeRoles`, and `roleBucket` exist in
  `scripts/model-profiles.mjs` and are covered in `scripts/model-profiles.test.mjs`
  (path resolution under `AGENTO_CONFIG_HOME`/XDG/home, unknown key and bad value are
  errors, `null` allowed, round-trip, and the bucket mapping for all five window
  roles) — verify: `node --test scripts/model-profiles.test.mjs` exits 0.
- [ ] `models use <name> --role secondary` validates the profile (`not-found`,
  `invalid` exit 3) and writes `model-roles.json` atomically. It honors `--expect`
  (stale value → `conflict`, file byte-identical) and leaves no temp files.
  `models use none --role secondary` turns the role off — verify: tests in
  `scripts/agento.test.mjs`.
- [ ] `models use <name> --role primary` and `models use none --role primary` behave
  exactly like `apply <name>` and `clear`, including the `worktree`/`dirty` findings.
  A missing `--role`, a bad `--role` value, or `--expect` with `--role primary` exits
  1 — verify: tests in `scripts/agento.test.mjs`.
- [ ] `models list` reports `roles: { primary, secondary }` (primary = derived
  `active`) and `rolesFile` — verify: tests in `scripts/agento.test.mjs`.
- [ ] `models pins` resolves by window role. In a managed build worktree fixture with
  a secondary profile, it reports `role: "secondary"`, `roleSource: "window"`,
  `source: "role-profile"`, and the profile's builder/reviewer
  `subagentModel`/`copilotModel`. In the primary checkout it reports `file-pins`.
  `--role` overrides the window. With no roles file, or the role off, it reports
  file pins identical to today's output. A dangling or invalid assignment falls back
  to file pins with a warning — verify: tests in `scripts/agento.test.mjs`.
- [ ] Rename moves the secondary assignment. Delete of the secondary profile without
  `--force` → `status: "assigned"` (exit 3, both files byte-identical). With
  `--force` it deletes and turns the role off. `create none` and `rename x none` exit
  1 — verify: tests in `scripts/agento.test.mjs`.
- [ ] Doctor's `model-profile` check names both roles and warns on a dangling or
  invalid secondary assignment and an invalid roles file. The doctor check list is
  unchanged — verify: tests in `scripts/agento.test.mjs`.
- [ ] Real-CLI smoke in the build worktree against a throwaway `AGENTO_CONFIG_HOME`:
  `models pins` reports `windowRole: "build"`, `role: "secondary"`, and the secondary
  profile's models, and `models pins --role primary` reports file pins. The results
  are recorded on the roadmap step — verify: the step's recorded statuses.
- [ ] `skills/agento/commands/models.md` and `.github/prompts/models.prompt.md` are
  identical and document `use`, `--role`, `roles`, `pins` role fields, and
  `assigned`. `skills/agento/SKILL.md` and
  `.github/agents/delivery-autopilot.agent.md` state that `models pins` is
  role-resolved with an unchanged call — verify: `diff -q` is silent and
  `node --test tests/customizations.test.mjs` exits 0.
- [ ] `docs/model-profiles.md` has a "Window roles" section, "Limits" no longer says
  one profile per clone, and "Subagents and handoffs" states the direct-selection
  limit in secondary windows. `README.md` lists `use`, and `CHANGELOG.md` has a
  `## 0.12.0 (unreleased)` **Added** entry — verify: `grep` for each.
- [ ] `extension/cli/` is a byte copy of `scripts/` — verify:
  `node --test tests/extension-bundle.test.mjs` exits 0.
- [ ] Lint gate: the full-repository lint stays green against the recorded baseline
  (exit 0, no findings), and the full test suite passes — verify:
  `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` exits 0, and
  `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exits 0. Use the v0.10.0
  release binary from `## Research` if `shellcheck` is not installed.
- [ ] Both worktree halves are clean at handoff
  (`git status --porcelain --untracked-files=all` prints nothing in each).
