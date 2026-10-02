# Model profiles for Agento agents and prompts

## Problem

Every Agento agent and slash command runs on whatever model the chat picker happens
to hold. Planning and review benefit from a strong model while mechanical commands
(`/agento delivery-status`, `/agento doctor`, `/agento continue`) do not, and users
switch the picker by hand — or forget to. VS Code honors a `model:` frontmatter field
on both `.agent.md` and `.prompt.md` files (a string, or a prioritized fallback
array), so pinning a model per agent/command is possible today, but only by editing
the plugin's files by hand, which then shows up as local changes, breaks
`/agento start-session`'s clean-primary requirement, and conflicts on `git pull`.

This feature adds named **model profiles** (for example `mixed`) defined once in a
user-level file and applied deterministically to the plugin clone by the CLI
(`agento.mjs models …`), a slash command (`/agento models`), and an extension quick
pick (*Agento: Select Model Profile*). The active profile is derived from the files
themselves (no journal), in line with Agento's "state from git, not prose" design.

## Decisions

Intake decisions (from the feature description, adopted as given):

- Definitions live in the user-level `~/.config/agento/model-profiles.json`
  (`$XDG_CONFIG_HOME/agento/…` when set; `AGENTO_CONFIG_HOME` overrides the
  directory for tests). Agento ships only `templates/model-profiles.json` with
  placeholder values; `apply` rejects unfilled `<…>` values.
- The plugin clone is rewritten in place (machine-wide, last apply wins); rewritten
  files are marked `skip-worktree` so the Agento primary stays clean for
  `/agento start-session` / `/agento quick-fix`; `models clear` restores bytes and
  flags; a pull or merge touching those files needs clear → `git pull` → apply
  (documented, plus a hint in the CLI output and the doctor check).
- Prompts dispatching to a custom agent inherit that agent's model; only prompts on
  the built-in agent (`agent: "agent"` or no `agent:`) are pinned individually.
  `handoffs[].model` is out of scope (the manual step checks whether handoffs honor
  the target agent's `model:`).
- Out of scope: per-project profiles in `.github/agento.json`, a `Models:` line in
  the SessionStart hook, install options B/C (overwritten on update; docs say
  re-apply).

Clarifying questions asked 2026-10-01 and the user's answers (verbatim):

1. *CHANGELOG already has `## Unreleased` (pause-semantics fix). How should this
   feature land?* — "Rename Unreleased to `## 0.7.0 (unreleased)`; bump all three
   manifests to 0.7.0"
2. *How strictly should `models apply` validate model names?* — "A: pass through
   verbatim; reject only `<…>` placeholders"
3. *Keep verification step 4 (you drive the chat UI, screenshot into evidence/)
   before review?* (applied via this worktree's CLI with
   `--plugin-root /home/david/DP/agento`) — "Yes — pre-review (manual) step, then
   `models clear` afterwards"
4. *Which profiles should `templates/model-profiles.json` ship (values as `<…>`
   placeholders)?* — "Only mixed (one worked example)"
5. *When a profile gives no value for a file (no entry and no `default`), what
   should apply do?* — "Remove any `model:` line (file follows the picker)"

## Research

Skills consulted: none — no matching domain (the repository has no
`.agents/skills/` directory and AGENTS.md carries no `## Agento` skills table).

VS Code docs (custom agents, fetched 2026-10-01): `model` is "a single model name
(string) or a prioritized list of models (array)"; `handoffs.model` exists separately
and uses the qualified `Model Name (vendor)` form.

Codebase findings:

- **CLI shape.** `scripts/agento.mjs` defines `PLUGIN_ROOT` as the parent of
  `scripts/` (line 39), `usage()` prints header lines via `.slice(1, 23)` (lines
  41–44) — the header currently fills that window exactly (commands end at line 20,
  `// Options:` paragraph at lines 22–23), so adding one usage line requires
  widening the slice to `(1, 24)` or the Options paragraph is truncated.
  `parseArgs` (lines 66–80) accepts `--root`, `--pr`, `--write`, `--apply`, `--for`
  and rejects any other `--` option. `DOCTOR_CHECKS` (line 578) returns
  `{ status, detail, fallback }` per id; `CAPABILITY_CHECKS` (line ~690) maps §10
  tokens to check ids, so a check left out of it never runs under `--for`;
  `COMMAND_NEEDS` follows it.
- **Pure helper pattern.** `scripts/session-state.mjs` exports pure functions
  imported by `agento.mjs` and unit-tested in `scripts/session-state.test.mjs`;
  `model-profiles.mjs` follows the same split.
- **Doctor id assertions.** `scripts/agento.test.mjs` asserts the exact check-id
  list of a full `doctor` run (line 1237) and of two `--for` runs (lines 1411,
  1417); the full-run list gains `model-profile`, the `--for` lists stay unchanged.
- **Customization tests.** `tests/customizations.test.mjs` `parseFrontmatter`
  (lines 33–66) already parses top-level scalars and flow lists, so `model:` lines
  parse. The tests force: `Needs:`/`Fallback:` lines from the §10 vocabulary; the
  CLI needs table agreeing with every prompt (`doctor --for <name>`); README.md,
  docs/commands.md, and its `## Invocation` listing every command; the
  command-invocation instruction listing every command; `commands/<name>.md`
  byte-identical to `.github/prompts/<name>.prompt.md` (line ~534); and
  `.claude-plugin/plugin.json`, `package.json`, `extension/package.json` versions
  equal.
- **Plugin layout.** `.claude-plugin/plugin.json` points `agents` at
  `.github/agents` and `commands` at `commands/`, so in plugin mode VS Code reads
  prompts from `commands/*.md`; `apply` must rewrite both the prompt and its mirror.
- **Rewrite targets.** Six agents, all with `description:` and `argument-hint:`
  and no `model:` line: `delivery-planner` (📋 Agento Planner),
  `delivery-builder`, `delivery-reviewer`, `delivery-autopilot`,
  `copilot-mechanic`, `initiative-architect`. Prompts on a custom agent: `ap`
  (Autopilot), `build-feature`/`build-issue` (Builder), `review-feature`/
  `review-issue` (Reviewer), `new-feature`/`new-issue` (Planner), `new-initiative`
  (Architect), `extend-copilot`/`fix-copilot` (Mechanic). Prompts on the built-in
  agent: `commit-current-changes`, `continue`, `delivery-status`, `doctor`,
  `finish-freehand`, `next-feature`, `quick-fix`, `ship`, `start-freehand`,
  `triage-followups` (`agent: "agent"`) and `agento-init`, `close-session`,
  `install-skills`, `start-session` (no `agent:`). None carries `model:`.
- **Extension.** `extension/src/cliClient.ts` runs the bundled
  `extension/cli/agento.mjs` and appends `--root`; it rejects a caller-supplied
  `--root` but passes other options through. The bundled CLI's `PLUGIN_ROOT` is
  `extension/`, so the extension must always pass `--plugin-root`. The Session &
  Doctor view runs `client.run(["doctor"], folder)` (`extension/src/extension.ts`
  line 154) — it would report the bundle, not the plugin clone, unless that call
  also passes `--plugin-root`; the plan adds this (the brief assumed "no extra
  work"). `extension/scripts/copy-cli.mjs` and `tests/extension-bundle.test.mjs`
  each hold the bundled file list. Contributed commands are asserted in
  `extension/test/electron/suite.ts` (lines ~390–397). Current settings:
  `agento.nodePath`, `agento.refreshDebounceMs`.
- **skip-worktree behavior (verified in a temp repo, git 2.43.0).** A file marked
  `skip-worktree` with a local `model:` line keeps `git status --porcelain` empty;
  a `git pull --ff-only` whose upstream changes that file aborts with "Your local
  changes to the following files would be overwritten by merge" and leaves the
  file and bit intact — safe, but it blocks the pull until `models clear`.
- **Templates.** `templates/` holds `AGENTS-section.md`, `agento.json`,
  `companion-README.md`, `project.instructions.md`; no JSON profile template yet.
- **Open delivery branches:** `gh pr list --state open` is empty in both
  `agento` and `agento-docs` — no concurrent-delivery overlap.

Lint baseline (policy §5), run 2026-10-01 at `5eebf92`:

- Shell lint: `shellcheck` is not on PATH (exit 127); run instead as
  `git ls-files '*.sh' | xargs pnpm dlx shellcheck` over
  `scripts/hooks/delivery-guard.sh scripts/hooks/replay-guard.sh
  scripts/hooks/session-context.sh scripts/wait-for-checks.sh` — exit 0, no
  findings. (A direct `pnpm dlx shellcheck scripts/hooks/*.sh …` is denied by the
  delivery guard, which reads hook paths on the command line as a write.)
- Tests: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` — exit 0,
  229 tests, 229 pass.
- Extension: `cd extension && npm ci && npm run typecheck` — exit 0.

Overlap decision: the baseline is green, so the **full gate** applies — the final
full shellcheck run, the full test suite, and the extension typecheck must all be
green; no scoped gate is needed. This delivery changes no shell files.

## Approach

**Phase 1 — CLI core (`scripts/`).**

- New pure module `scripts/model-profiles.mjs`:
  - `profilesFile(env)` → `$AGENTO_CONFIG_HOME/model-profiles.json`, else
    `$XDG_CONFIG_HOME/agento/model-profiles.json`, else
    `~/.config/agento/model-profiles.json`.
  - `parseProfiles(text)` → `{ profiles, errors[] }`; schema
    `{ profiles: { <name>: { description?, default?, agents?: { <alias>: value },
    prompts?: { <command>: value } } } }`; profile names match `[a-z0-9-]+`; a value
    is a non-empty string or a non-empty array of non-empty strings; every string
    is rejected when it contains `<` or `>` (unfilled placeholder) or any control
    character (U+0000–U+001F, U+007F) — the latter keeps a value from injecting
    frontmatter lines. Unknown aliases and unknown top-level keys are errors.
    Model names are otherwise passed through verbatim (decision 2).
  - `AGENT_ALIASES`: `planner → delivery-planner.agent.md`, `builder →
    delivery-builder`, `reviewer → delivery-reviewer`, `autopilot →
    delivery-autopilot`, `mechanic → copilot-mechanic`, `architect →
    initiative-architect`. The agent display name (`name:`) is read from each
    file so a prompt's `agent:` maps back to its alias.
  - `resolveTargets({ profile, agents, prompts })` → `[{ file, value }]` and
    `errors[]`: agent → `agents.<alias>` ?? `default` ?? `null`; prompt whose
    `agent:` is a custom agent → that agent's resolved value, and a
    `prompts.<name>` entry for it is an error; prompt with `agent: "agent"` or no
    `agent:` → `prompts.<name>` ?? `default` ?? `null`; a `prompts.<name>` key
    with no matching `.github/prompts/<name>.prompt.md` is an error. `null` means
    "no `model:` line" (decision 5). Prompt names are matched against discovered
    files, never used to build paths.
  - `readModel(text)` / `setModel(text, value | null)`: operate on exactly one
    top-level `model:` line inside the leading `---` block; insert after
    `argument-hint:`, else after `description:`; replace in place when present;
    remove when `value` is `null`; serialize as `model: "<JSON string>"` or a flow
    list `model: ["a", "b"]` (JSON escaping is valid YAML double-quoted); every
    other byte unchanged, line endings preserved.
  - `detectActive({ profiles, current })` → `null` when no target carries a
    `model:` line, the name of the first profile whose rendering equals every
    target's current line, else `"custom"`. A profile edited after apply is
    reported as `custom` (no journal records what was applied); the doctor detail
    says so — this folds the brief's separate "stale" case into `custom`.
- `scripts/agento.mjs` `case "models"`: verbs `list` (default), `show <name>`,
  `apply <name>`, `clear`, `init`. `parseArgs` gains `--plugin-root <dir>`
  (default `PLUGIN_ROOT`; usage error when `<dir>/.github/agents` is missing).
  Output always includes `profilesFile` (`{ path, exists }`), `pluginRoot`,
  `active`, `skipWorktree` (paths currently flagged), `dirty` (targets whose
  content differs from `HEAD` beyond the `model:` line), and `hint` (the clear →
  `git pull` → apply sequence). `apply` refuses (exit 3, `status: "dirty"`) when
  `dirty` is non-empty — `skip-worktree` would hide real edits; otherwise it
  rewrites the six agents, every prompt, and each prompt's `commands/<name>.md`
  mirror with the same bytes, then `git update-index --skip-worktree` on every
  file now carrying a `model:` line (and `--no-skip-worktree` on any that no
  longer do); `clear` removes every `model:` line and clears the bits. Both report
  `changed[]` and are idempotent (`changed: []` on repeat). A plugin root that is
  not a git checkout is rewritten without flags and reports
  `skipWorktree: null`. `init` copies `<plugin-root>/templates/model-profiles.json`
  to `profilesFile` only when absent (`created: false` otherwise). Invalid
  profiles file, unknown profile, resolution errors → exit 3 with `errors[]`.
  The usage header gains one `models` line and the `usage()` slice widens to
  `(1, 24)`.
- Doctor: new `model-profile` check in `DOCTOR_CHECKS`, honoring `--plugin-root`:
  `ok` "no Agento plugin clone at <root>" (bundle case), `ok` "no profile applied"
  or "<name> applied"; `warn` when the profiles file is invalid or `active` is
  `custom`, with a fallback naming `models apply <name>` / `models clear` and the
  pull dance. Not added to `CAPABILITY_CHECKS`, so `doctor --for` is unchanged.
  `COMMAND_NEEDS.models = ["terminal"]`.
- Bundle: `extension/scripts/copy-cli.mjs` and `tests/extension-bundle.test.mjs`
  gain `model-profiles.mjs`; `npm run copy-cli` refreshes `extension/cli/`.
- `tests/customizations.test.mjs`: new test "committed agents and prompts carry no
  `model:` line" reading `git show HEAD:<file>` for every agent, prompt, and
  command mirror; its message names `models clear`.

**Phase 2 — slash command, policy, docs.**

- `.github/prompts/models.prompt.md` and byte-identical `commands/models.md`:
  `agent: "agent"`, `tools: [read, execute]`, `Needs: terminal`,
  `Fallback: none — every need is hard`, §9 receipt/result, `Window check per §11:
  requires role any`, §12 blocks; arguments `[list | show <name> | apply <name> |
  clear | init]`; runs the CLI and quotes `active`, `changed[]`, `hint`; tells the
  user to run *Developer: Reload Window* if the picker does not reflect the change;
  never edits frontmatter by hand.
- Registration: `.github/instructions/command-invocation.instructions.md` list;
  `delivery-policy.instructions.md` §9 idempotency row (`apply` of the active
  profile and `clear` on an unpinned clone change nothing; `list`/`show`/`init` on
  an existing file are reads); README.md command table; docs/commands.md table,
  `## Invocation`, and the CLI subcommand paragraph (`models`, `--plugin-root`,
  the `model-profile` doctor check).
- Docs: new `docs/model-profiles.md` (schema, resolution rules, clear → pull →
  apply, skip-worktree semantics, Agento-development caveat that worktree windows
  use their own unpinned workspace `.github/agents`); `templates/model-profiles.json`
  with one `mixed` profile of `<…>` placeholders (decision 4); docs/install.md
  `## Updating` paragraph; one file-list line and one Known-pitfalls line in
  `.github/agents/copilot-mechanic.agent.md`.
- Release notes: CHANGELOG `## Unreleased` renamed `## 0.7.0 (unreleased)` with an
  **Added** entry; `package.json`, `.claude-plugin/plugin.json`,
  `extension/package.json`, and `extension/package-lock.json` root entries bumped
  to 0.7.0 (decision 1).

**Phase 3 — extension.**

- Pure `extension/src/modelProfiles.ts`: `resolvePluginRoot({ configured,
  pluginLocations, homedir, exists, readJson })` — the `agento.pluginRoot` setting
  first, else the first `chat.pluginLocations` key whose value is `true`, with `~`
  expanded, containing `.claude-plugin/plugin.json` whose `name` is `"agento"`;
  `toQuickPickItems(listJson)` — one item per profile (description, "applied"
  marker on `active`) plus "Clear — use the picker's model"; `selectionToArgs(item,
  root)` → `["models", "apply", name, "--plugin-root", root]` or
  `["models", "clear", "--plugin-root", root]`.
- `extension/package.json`: command `agento.selectModelProfile` ("Agento: Select
  Model Profile") and setting `agento.pluginRoot` (string, default empty).
  `extension/src/extension.ts`: register the command via the bundled `CliClient`;
  info message quotes `changed.length` and the reload hint; errors go to the Agento
  output channel; the Session & Doctor `doctor` call appends `--plugin-root` when a
  root resolves.
- Tests: `extension/test/unit/modelProfiles.test.ts`; the electron suite asserts
  the new command id; one paragraph each in `extension/README.md` and
  `docs/extension.md`.

Affected files: `scripts/model-profiles.mjs` (new), `scripts/model-profiles.test.mjs`
(new), `scripts/agento.mjs`, `scripts/agento.test.mjs`, `extension/cli/*`
(generated), `extension/scripts/copy-cli.mjs`, `tests/extension-bundle.test.mjs`,
`tests/customizations.test.mjs`, `.github/prompts/models.prompt.md` (new),
`commands/models.md` (new), `.github/instructions/command-invocation.instructions.md`,
`.github/instructions/delivery-policy.instructions.md`,
`.github/agents/copilot-mechanic.agent.md`, `README.md`, `docs/commands.md`,
`docs/model-profiles.md` (new), `docs/install.md`, `docs/extension.md`,
`templates/model-profiles.json` (new), `CHANGELOG.md`, `package.json`,
`.claude-plugin/plugin.json`, `extension/package.json`, `extension/package-lock.json`,
`extension/src/modelProfiles.ts` (new), `extension/src/extension.ts`,
`extension/test/unit/modelProfiles.test.ts` (new), `extension/test/electron/suite.ts`,
`extension/README.md`. No hook files change.

## Risks

- **Pull/ship blocked by pinned files.** With a profile applied, `git pull` (and
  `/agento ship`'s sync of `main` in the primary, when the primary is also the
  registered plugin clone) aborts if upstream changed a pinned file — verified
  safe (nothing overwritten) but blocking. Mitigation: `hint` in every `models`
  output, the doctor fallback, and docs/model-profiles.md + docs/install.md spell
  out clear → pull → apply; a follow-up may teach `/agento ship` to detect it.
- **skip-worktree hiding real edits.** Mitigation: `apply` refuses when any target
  differs from `HEAD` beyond its `model:` line (`status: "dirty"`), and `clear`
  only clears bits on files it restored.
- **Frontmatter injection via profile values.** Mitigation: control characters and
  `<`/`>` rejected; values serialized with JSON escaping; prompt keys matched
  against discovered files, never joined into paths.
- **VS Code may not honor `model:` on plugin commands or through handoffs.**
  Mitigation: the (manual) runtime step checks the picker and a handoff; if a
  handoff ignores the agent's model, record a follow-up for `handoffs[].model`.
- **Extension bundle's `PLUGIN_ROOT` is `extension/`.** Mitigation: the extension
  always passes `--plugin-root`; the doctor check reports `ok` "no Agento plugin
  clone" instead of a false state when no root is given.
- **Usage header window.** Adding a line silently truncates the Options paragraph
  unless the `usage()` slice widens; a test asserts the new line and the full
  Options paragraph.
- **Tests touching the real home directory.** Mitigation: every test sets
  `AGENTO_CONFIG_HOME` to a temp dir; the doctor check tolerates a missing file.
- **Developer clones with a profile applied.** The mirror-equality test still
  passes (prompt and mirror rewritten identically) and the no-pin test reads
  `HEAD`, so local runs are unaffected.
- **Concurrent deliveries.** No open PRs in either repository today; CHANGELOG and
  the version bump are conflict-prone, so integrate `origin/main` by merge before
  every push.

## Out of scope

- Per-project profiles in `.github/agento.json`.
- A `Models:` line in the SessionStart hook (hook edits are approval-gated; the
  doctor check surfaces the profile in the Session & Doctor view).
- `handoffs[].model` pinning.
- Install options B/C (from-source and Copilot CLI installs are overwritten on
  update; docs say re-apply).
- Model-name validation beyond placeholders (no vendor-suffix warning).
- Teaching `/agento ship` to clear/re-apply around its `main` sync.

## Acceptance checklist

- [ ] `scripts/model-profiles.test.mjs` covers schema errors (bad value types,
  empty arrays, placeholders, control characters, unknown alias/key/prompt), the
  resolution table (agent alias, default, custom-agent prompt inheritance and its
  `prompts.<name>` error, built-in prompts, `null` → no line), byte-exact
  insert/replace/remove (after `argument-hint:`, fallback after `description:`,
  CRLF preserved), array values, and active detection (`null`, name, `custom`) —
  verify: `node --test scripts/model-profiles.test.mjs` exit 0.
- [ ] `agento.mjs models apply <name> --plugin-root <fixture>` rewrites the six
  agents, the prompts, and every `commands/<name>.md` mirror byte-identically,
  sets skip-worktree on each pinned path, reports `changed[]`; a repeat reports
  `changed: []`; `clear` leaves `git diff --quiet` true and no `S` entries in
  `git ls-files -v`; `apply` on a dirty target exits 3 with `status: "dirty"`;
  `init` creates the file once — verify: `node --test scripts/agento.test.mjs`
  exit 0 with the new cases.
- [ ] `doctor` lists `model-profile` (`ok` none/applied, `warn` invalid file or
  `custom`) and `doctor --for models` reports `needs: ["terminal"]` with the
  unchanged terminal check set — verify: agento.test.mjs cases and
  `node scripts/agento.mjs doctor --for models`.
- [ ] The usage error output lists the `models` line and the complete `// Options:`
  paragraph — verify: agento.test.mjs usage assertion.
- [ ] `tests/customizations.test.mjs` fails when any committed agent, prompt, or
  command mirror carries `model:` and passes on this branch; README.md,
  docs/commands.md (`## Invocation` and CLI paragraph), command-invocation
  instructions, and the §9 idempotency table list `/agento models`;
  `commands/models.md` equals its prompt — verify: full test suite exit 0.
- [ ] `docs/model-profiles.md`, `templates/model-profiles.json` (one `mixed`
  profile with `<…>` placeholders that `apply` rejects), the docs/install.md
  Updating paragraph, and the Mechanic agent lines exist — verify: file review and
  an agento.test.mjs case applying the shipped template expecting exit 3 with
  placeholder errors.
- [ ] CHANGELOG.md has `## 0.7.0 (unreleased)` with an **Added** entry and all
  version manifests read 0.7.0 — verify: customizations version test and
  `grep -n '"version"' package.json .claude-plugin/plugin.json extension/package.json`.
- [ ] Extension: `resolvePluginRoot` precedence, item mapping, and args are
  unit-tested; `agento.selectModelProfile` is contributed and registered;
  `agento.pluginRoot` is a setting; the Session & Doctor doctor call passes
  `--plugin-root` — verify: `cd extension && npm run copy-cli && npm run typecheck
  && npm run test:unit && npm run test:electron && npm run package` all exit 0.
- [ ] End-to-end on a temp copy of the clone: `models init` → `apply mixed` (filled)
  → `git status --porcelain` empty while all six agents carry `model:`; each
  `commands/<n>.md` `cmp`-equal to its prompt; `list` → `active: "mixed"`; repeat
  apply → `changed: []`; `clear` → `git diff --quiet`, no `S` bits; `doctor` →
  `model-profile ok`; a hand-edited agent model → `warn` custom — verify:
  transcript recorded in roadmap step 4.2.
- [ ] Full gate (policy §5): `git ls-files '*.sh' | xargs pnpm dlx shellcheck`
  exit 0, full `node --test` exit 0, extension typecheck exit 0, both replay-guard
  fixture runs unchanged — verify: roadmap step 4.1 record.
- [ ] Runtime check in VS Code: with `mixed` applied to `/home/david/DP/agento`
  and the window reloaded, the model picker shows the pinned model for 📋 Agento
  Planner in a non-Agento repository and switches when moving to 🔨 Agento Builder
  via a handoff; screenshot linked in `evidence/`; profile cleared afterwards
  (`git -C /home/david/DP/agento diff --quiet`, no `S` bits) — verify: roadmap
  steps 4.4–4.7.
