# Model-profile pins that survive fast-forwards: a git clean/smudge filter replaces skip-worktree

## Problem

Every `/agento ship` (and every `publish-pr --merge`, `/agento finish-freehand`, and
hand-run `git pull`) in a clone with `/agento models apply` active fails at the sync
phase with `sync-failed: git merge --ff-only origin/main: error: Your local changes to
the following files would be overwritten by merge` whenever the merged delivery
touched a pinned file (`.github/agents/*.agent.md`, `.github/prompts/*.prompt.md`,
`commands/*.md`) — which is nearly every Agento delivery. `models apply` hides its
edits with `git update-index --skip-worktree`, so `git status --porcelain` is clean
and the CLI's failure names no files. The documented recovery (`models clear` →
merge → `models apply <name>`) discards the pins when `models list` reports
`active: custom`. On 2026-10-13, shipping publish-cli (PR #112), recovery took 56
hand-saved `diff -u` patches, `models clear`, `git merge --ff-only`, `git apply`, and
re-flagging the same files with `git update-index --skip-worktree`.

Goal: pins are invisible to git's merge/checkout machinery. A fast-forward, pull,
switch, or stash on a clone with any profile (named or custom) active succeeds with
no user action, and the same pins are present afterwards. Commits made from the clone
or any linked worktree never contain a pin.

## Decisions

Clarifying questions asked 2026-10-13 (recommended option listed first in each;
answers verbatim):

1. *Which mechanism should carry the pins?* — Options: Clean/smudge filter (preferred
   approach) **(recommended)**; withModelPinsLifted helper (fallback); Filter plus
   helper as belt-and-braces. **Answer: "Clean/smudge filter (preferred approach)".**
2. *Where does the filter command point?* — Options: Copy script into
   `<common-dir>/agento/`, invoke via `$(git rev-parse --git-common-dir)`
   **(recommended)**; Absolute path into the plugin clone's
   `scripts/model-filter.mjs`. **Answer: "Copy script into <common-dir>/agento/,
   invoke via $(git rev-parse --git-common-dir)".**
3. *Which git filter protocol?* — Options: Per-file clean/smudge with
   `required=true` **(recommended)**; Long-running `filter.<driver>.process`
   protocol. **Answer: "Per-file clean/smudge with required=true".**
4. *A merge adds a new prompt/agent not in the state file. What happens?* — Options:
   Stays unpinned; models list/doctor report drift with a re-apply hint
   **(recommended)**; State also records the profile name and smudge applies its
   resolution to unknown files. **Answer: "Stays unpinned; models list/doctor report
   drift with a re-apply hint".**
5. *Where may `models apply`/`clear` run once state is shared via the common dir?* —
   Options: Primary clone only (keep the current worktree refusal), worktrees inherit
   pins **(recommended)**; Any worktree of the clone. **Answer: "Primary clone only
   (keep the current worktree refusal); worktrees inherit pins".**
6. *How does a clone with legacy skip-worktree pins that are `active: custom` move to
   the filter without losing them?* — Options: New verb `models adopt`
   **(recommended)**; Only `models apply <name>` migrates; Automatic migration on any
   models call. **Answer: "New verb `models adopt`"** — records the files' current
   pins as filter state and clears the legacy bits; `apply <name>` also migrates but
   pins the profile.

## Research

Skills consulted: none — no matching domain (no `.agents/skills/` covers git
filters or the Agento CLI; AGENTS.md has no `## Agento` skills table in this
repository).

Current code (product repository, `origin/main` at `a8c622b`):

- `scripts/agento.mjs` `case "models"` (~L4470–L4565): `apply` refuses a linked
  worktree (`status: "worktree"`, via `primaryCheckoutOf`, ~L3500) and files that
  differ from HEAD beyond their pins (`status: "dirty"`), writes pins with
  `setModel`/`setHandoffModels`, then `git update-index --skip-worktree` on pinned
  tracked files and `--no-skip-worktree` on unpinned ones (~L4545–L4560). `clear`
  is the same loop with every value `null`.
- `modelsState` (~L3478) derives `skipWorktree` from `git ls-files -v` (`S `
  entries), `dirty` from `differsBeyondModel(HEAD, working)`, and `active` from
  `detectActive`; `modelsReport` (~L3509) puts `skipWorktree`, `dirty`, and
  `hint: MODELS_HINT` on every verb's output. `MODELS_HINT` (~L3430) documents the
  clear → pull → apply workaround.
- `doctor`'s `"model-profile"` check (~L943) reports `active` and the BYOK /
  unqualified warnings; its `custom` fallback repeats the clear → pull → apply advice.
  `LOCAL_DOCTOR_CHECKS` (~L1125) lists it.
- Pin editing primitives live in `scripts/model-profiles.mjs`: `setModel`,
  `setHandoffModels`, `readModel`, `renderModel`, `renderFileModel`,
  `parseModelValue`, `detectActive`, `differsBeyondModel` (pure, dependency-free,
  so a standalone filter script can import them).
- Fast-forwards / checkouts that break today in a pinned clone: ship `syncDefault`
  (`merge --ff-only origin/<default>`, ~L3205–L3232) and its `switch <default>`;
  ship `reopen` (`merge --ff-only origin/<branch>`, ~L3050); the owner/write-target
  ff loop (~L3109); ship `switchTo(primary, branch)`; `publish-pr` sync
  (`switch` + `merge --ff-only`, ~L2680–L2693). A filter fixes all of them (and
  hand-run git) generically — no per-call-site change is needed.
- `extension/scripts/copy-cli.mjs` copies a fixed `cliFiles` list from `scripts/`
  into `extension/cli/`; `tests/extension-bundle.test.mjs` pins copy-cli as the only
  writer. A new `scripts/model-filter.mjs` must join `cliFiles`.
- `tests/customizations.test.mjs` "committed agents, prompts, and command mirrors
  carry no model: line" (~L953) reads `HEAD` content, not the working tree, so it
  holds under smudged pins. The `commands/*.md` ↔ `.github/prompts/*.prompt.md`
  byte-equality tests (~L282–L405) read working files; a prompt and its mirror carry
  the same resolved value, so they stay equal under pins — to be confirmed in a
  pinned linked worktree.
- Tests: `scripts/agento.test.mjs` `modelsFixture` (~L2798) and the models group
  (~L2830–L3190, incl. "models apply pins agents, prompts, and mirrors under
  skip-worktree; clear restores HEAD", the linked-worktree refusal, the doctor
  `model-profile` checks); ship fixtures `makeWorktreeRepo` / `shippable` /
  `shipStub` / `shipRun` (e.g. "ship --confirm (in-repo, owner) …", ~L5172) and
  `makePairRepo` (~L424) / `planPair` (~L4279); publish-pr `--merge` tests
  (~L7023).
- Docs describing the breakage as expected: `docs/model-profiles.md` L90–L160,
  `docs/install.md` L104–L109, `docs/commands.md` L24 and L465–L473,
  `.github/prompts/models.prompt.md` + `commands/models.md` (`skipWorktree` count,
  `hint`), `CHANGELOG.md` 0.7.0 entry (history, untouched).

Git facts the design relies on (git ≥ 2.31 for `--path-format`):

- `$GIT_COMMON_DIR/info/attributes` and the repository's `config` are shared by all
  linked worktrees, so one `models apply` covers the clone and every worktree.
- With `filter.<d>.required=true`, a failing clean/smudge aborts the git command
  instead of silently passing content through — a missing script can never let a
  pin reach a commit.
- `git status`/`diff` compare the *cleaned* working file to the index; when clean
  strips exactly the pins, a pinned file is clean, and any other edit (including a
  different hand-edited `model:` value) still shows as modified — dirty-beyond-model
  detection keeps working.
- Filter commands run through the shell from the worktree root, so
  `node "$(git rev-parse --path-format=absolute --git-common-dir)/agento/model-filter.mjs" clean %f`
  resolves in the clone and every linked worktree and survives the clone moving.

Lint baseline (policy §5), run 2026-10-13 at `a8c622b` in the product planning
worktree:

- `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` → exit 127
  (`shellcheck: command not found` on this machine). This delivery changes no shell
  file; the shell lint is not part of the gate unless a `.sh` file is touched, in
  which case the Builder installs shellcheck first and runs it.
- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → exit 0, 493 tests,
  493 pass, 0 fail.
- No JavaScript linter is configured (AGENTS.md lists none). Baseline is green; no
  pre-existing findings overlap.

Open delivery PRs at planning time: none (`gh pr list --state open` → `[]`), so no
concurrent-delivery overlap.

## Approach

### 1. `scripts/model-filter.mjs` (new, standalone)

`node model-filter.mjs clean|smudge <path>` — reads stdin, writes stdout, imports only
`./model-profiles.mjs` (copied next to it). It loads the state file
`model-pins.json` from its own directory:

```json
{ "version": 1, "files": { "<repo-relative path>": { "model": <value|null>, "handoffs": [{ "target": "<agent name>", "value": <value|null> }] } } }
```

- A path absent from `files` (or a missing/empty state file) passes through
  byte-identical.
- `clean`: removes the top-level `model:` block only when its rendering equals
  `renderModel(recorded.model)`, and each handoff `model:` line only when it equals
  the recorded value for that target; anything else (another value, any non-pin
  byte) passes through untouched, so hand edits stay visible to git.
- `smudge`: inserts the recorded pins with `setModel` / `setHandoffModels` only where
  the incoming (HEAD) content carries no `model:` line for that slot.
- Invalid state JSON → exit nonzero with a one-line stderr naming the file and the
  fix (`models clear` or `models adopt`); with `required=true` git then refuses the
  operation rather than committing or checking out wrong content. A file without
  frontmatter passes through.
- Round-trip invariant (unit-tested): `clean(smudge(x)) === x` for every pin-free
  `x`, and `smudge(clean(y)) === y` for every `y` pinned with the recorded values.

### 2. Installing and removing the filter (in `scripts/agento.mjs`)

A helper pair `installModelFilter(pluginRoot, files)` / `removeModelFilter(pluginRoot)`
over the common dir (`git rev-parse --path-format=absolute --git-common-dir`):

- writes `<common>/agento/model-pins.json` (only per-file resolved values — no
  profile name, no journal) and copies `model-filter.mjs` + `model-profiles.mjs`
  from the CLI's own directory into `<common>/agento/` (overwritten on every apply,
  so plugin updates refresh them);
- sets `filter.agento-models.clean`, `.smudge`, and `.required=true` in the clone's
  local config;
- maintains a marker-delimited block in `<common>/info/attributes`:
  `/.github/agents/*.agent.md`, `/.github/prompts/*.prompt.md`, `/commands/*.md`,
  each `filter=agento-models`;
- removal deletes the config section, the attribute block (leaving other lines),
  and `<common>/agento/`.

### 3. `models` verbs

- `apply <name>` keeps the worktree and dirty refusals (worktree message reworded:
  linked worktrees inherit the clone's pins), resolves targets as today, then:
  migrates legacy bits (`--no-skip-worktree` on every `S` entry among the target
  files), installs the filter with the resolved per-file pins, writes the pinned
  file contents, and runs `git update-index -q --refresh` so the index stat matches.
  Idempotent: a repeat reports `changed: []`.
- `adopt` (new): records the target files' *current* pins (`parseModelValue` +
  handoff values read from the working files) as the filter state, clears legacy
  skip-worktree bits, installs the filter; file bytes are unchanged. Refuses a
  linked worktree and dirty-beyond-model files like `apply`; `changed: []` when the
  filter already records exactly those pins and no legacy bit exists. `/agento
  models` and its `argument-hint` gain the verb; the usage header lists it.
- `clear` strips every pin from the files, removes the filter (config, attributes
  block, state dir) and any legacy bits, refreshes the index; files equal HEAD.
  Still allowed in a linked worktree for its own files, but it only removes the
  shared filter when run on the primary clone (from a worktree it reports the
  primary as `primaryCheckout` and leaves the shared state alone).
- `modelsState` / `modelsReport`: replace `skipWorktree` semantics with
  `legacySkipWorktree` (the `S` entries, `[]` once migrated, `null` outside git) and
  add `filter: { installed, stateFile, script, scriptCurrent, attributes,
  unrecorded[] }`, where `unrecorded` lists target files carrying no recorded pin
  while the state has others (new prompts/agents that arrived by merge — Decision 4).
  Keep the `skipWorktree` key as an alias of `legacySkipWorktree` for one release so
  the extension and existing consumers keep parsing. `MODELS_HINT` becomes: pins
  are applied by a local git filter and survive pull/merge/switch; re-run
  `models apply <name>` after an update adds new agents or prompts.

### 4. `doctor` `model-profile` check

Adds filter health to the existing check: `warn` when legacy skip-worktree bits are
present (fallback: `models adopt` keeps the current pins, or `models apply <name>`),
when pins exist but the filter config/attributes/script/state is missing or the
copied script differs from the CLI's (fallback: `models apply <name>` or `models
adopt`), and when `unrecorded[]` is non-empty (fallback: re-run `models apply
<name>`). The `custom` fallback drops the clear → pull → apply advice.

### 5. Docs, prompt, changelog, bundle

`docs/model-profiles.md` (Applying and clearing, Updating the clone → filter
mechanics + adopt + migration, Developing Agento → worktrees inherit pins and commits
are cleaned), `docs/install.md` (update paragraph), `docs/commands.md` (table row +
`models` CLI reference: `adopt`, `filter`, `legacySkipWorktree`),
`.github/prompts/models.prompt.md` + `commands/models.md` (byte mirror; report
`filter` health instead of the skip-worktree count; `adopt` verb), `CHANGELOG.md`
`## Unreleased` (**Fixed** entry), `extension/scripts/copy-cli.mjs` adds
`model-filter.mjs`, then `cd extension && npm run copy-cli`.

Affected files: `scripts/model-filter.mjs` (new), `scripts/model-filter.test.mjs`
(new), `scripts/agento.mjs`, `scripts/agento.test.mjs`, `extension/scripts/copy-cli.mjs`,
`extension/cli/*` (generated), `.github/prompts/models.prompt.md`,
`commands/models.md`, `docs/model-profiles.md`, `docs/install.md`,
`docs/commands.md`, `CHANGELOG.md`.

Lint decision (§5): baseline green, no overlap → the gate is the full
`node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` run plus
`cd extension && npm run build && npm run test:unit` (the bundle and
`modelProfiles` unit tests consume the `models` JSON); shellcheck only if a `.sh`
file changes.

## Risks

- **Filter script unavailable → every git operation on pinned paths fails**
  (`required=true`). Mitigation: script and its one import live in the common dir,
  invoked through `rev-parse --git-common-dir`, so moving the clone or deleting the
  plugin checkout does not break it; `doctor` flags a missing/stale copy; `models
  clear` removes the config without needing the script (it edits config and
  attributes directly, then rewrites files).
- **`node` missing from git's `PATH`** (GUI git clients, hooks with a stripped env).
  Mitigation: Node ≥ 20 is already a hard prerequisite of the CLI and hooks
  (policy §10); document the requirement; failure is loud, never a pinned commit.
- **Per-file node start-up cost** (~56 files on a full re-checkout). Mitigation:
  filters run only for paths git actually rewrites or re-stats; accepted per
  Decision 3; the process protocol stays a possible follow-up.
- **Existing linked worktrees keep unpinned files** until git rewrites them (the
  next checkout/merge that touches them). Harmless: status stays clean (cleaned ==
  index); documented under Developing Agento.
- **Linked development worktrees now show pins in their working files.** Tests that
  read working frontmatter could see `model:` lines. Mitigation: roadmap step runs
  the full suite inside a pinned linked worktree; the committed-content test reads
  `HEAD`, and a commit from that worktree is asserted pin-free.
- **New prompts/agents after a merge stay unpinned** (Decision 4) and `active` may
  read `custom` until re-apply. Mitigation: `filter.unrecorded[]`, the doctor warn,
  and the new hint.
- **Older git without `--path-format`** (< 2.31). Mitigation: `apply`/`adopt` check
  `git --version` and refuse with a clear message; the doctor check reports it.
- Concurrent deliveries: none open at planning time; integrate `origin/main` before
  every push (policy §7).

## Out of scope

- The long-running `filter.<driver>.process` protocol (Decision 3).
- Auto-pinning files that are new since the last apply (Decision 4).
- Running `apply`/`adopt` from a linked worktree (Decision 5).
- The `withModelPinsLifted` fallback helper (Decision 1).
- Extension UI changes beyond keeping its `models` JSON parsing green.
- Rewriting the 0.7.0 CHANGELOG entry or historical artifacts.

## Acceptance checklist

- [ ] Ship with a pinned primary clone: in a ship fixture (`makeWorktreeRepo` /
  `shippable` or `makePairRepo` / `planPair`) whose primary has a profile applied, a
  delivery that changes a pinned prompt and its mirror ships through `sync` with no
  manual step; afterwards `models list` reports the same `active` and every pinned
  file is byte-identical to its pre-ship pinned form plus the merged change — covered
  for a named profile and for an `adopt`ed custom pin set — verify: the new
  `scripts/agento.test.mjs` tests pass.
- [ ] The same holds for `publish-pr --merge` sync and for the ship `reopen`
  fast-forward (`checks-failed` path) — verify: new tests in `scripts/agento.test.mjs`
  pass.
- [ ] With pins active, `git status --porcelain` is empty in the primary clone and a
  linked worktree, and a commit made in each (touching a pinned file's body) carries
  no `model:` line in `git show HEAD:<file>` — verify: new test passes.
- [ ] `models clear` leaves no `filter.agento-models.*` config, no attribute block in
  `<common>/info/attributes`, no `<common>/agento/`, no skip-worktree bit, and
  `git diff --quiet HEAD` succeeds — verify: updated clear test passes.
- [ ] `models apply <name>` on a clone with legacy skip-worktree pins migrates them
  (no `S` entries afterwards, filter installed); `models adopt` on a legacy
  `active: custom` clone keeps byte-identical files and `active: custom`; `doctor`'s
  `model-profile` check warns on the legacy state and on `unrecorded[]` — verify: new
  tests pass.
- [ ] Dirty-beyond-model detection still works: a non-pin edit (and a different
  hand-edited `model:` value) shows in `git status` and makes `apply` refuse with
  `status: "dirty"` — verify: updated tests pass.
- [ ] `scripts/model-filter.test.mjs` covers clean/smudge round-trips (top-level,
  list values, handoff pins, CRLF, unrecorded path pass-through, mismatched value
  pass-through, invalid state exit code) — verify: `node --test
  scripts/model-filter.test.mjs` passes.
- [ ] The full suite passes inside a linked worktree of a pinned clone (byte-equality
  of `commands/*.md` ↔ prompts holds) — verify: step 4.2 output recorded in the
  roadmap.
- [ ] `MODELS_HINT`, `docs/model-profiles.md`, `docs/install.md`, `docs/commands.md`,
  `.github/prompts/models.prompt.md` = `commands/models.md`, and `CHANGELOG.md`
  `## Unreleased` describe the filter, `adopt`, and migration, and no longer prescribe
  clear → pull → apply — verify: `grep -rn "skip-worktree" docs .github/prompts
  commands scripts/agento.mjs` shows only legacy-migration wording.
- [ ] `extension/cli/` is a byte copy of `scripts/` including `model-filter.mjs` —
  verify: `cd extension && npm run copy-cli && git status --porcelain extension/cli`
  is empty after the commit; `tests/extension-bundle.test.mjs` passes.
- [ ] Gate: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exits 0 and
  `cd extension && npm run build && npm run test:unit` exits 0 — verify: commands
  re-run at the end of the build, results recorded in the roadmap.
