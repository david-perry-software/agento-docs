```yaml
status: complete
branch: feature/model-pin-filter
last-updated: 2026-10-13
next-step: ""
artifact-pr: "#50"
```

## Phase 1: The filter script

- [x] 1.1 Add `scripts/model-filter.mjs` (`clean|smudge <path>`, stdin → stdout,
  imports only `./model-profiles.mjs`, reads `model-pins.json` from its own
  directory) per plan.md Approach 1: unrecorded paths and a missing state file pass
  through byte-identical; `clean` strips only pins equal to the recorded values;
  `smudge` inserts recorded pins only into empty slots; invalid state JSON exits
  nonzero with a one-line stderr — verify: `printf -- '---\nname: x\n---\n' | node
  scripts/model-filter.mjs clean a.md` echoes its input and exits 0
  — note (2026-10-13): added the `handoffModelLines` export to
  `scripts/model-profiles.mjs`; `model-filter.mjs` joined `copy-cli` `cliFiles` and
  the `tests/extension-bundle.test.mjs` list here (pulled forward from 4.1) so the
  bundle stays a byte copy at every step

- [x] 1.2 Add `scripts/model-filter.test.mjs`: round-trips `clean(smudge(x)) === x`
  and `smudge(clean(y)) === y` for top-level string and list pins, handoff pins,
  CRLF files; pass-through for unrecorded paths, mismatched (hand-edited) values,
  and files without frontmatter; nonzero exit on invalid state — verify: `node
  --test scripts/model-filter.test.mjs` passes

## Phase 2: Install, migrate, and remove the filter in `models`

- [x] 2.1 Add `installModelFilter` / `removeModelFilter` in `scripts/agento.mjs`
  (common dir via `git rev-parse --path-format=absolute --git-common-dir`; state
  file + copied `model-filter.mjs` and `model-profiles.mjs` under
  `<common>/agento/`; `filter.agento-models.{clean,smudge,required}`; marker block
  in `<common>/info/attributes`) and a git ≥ 2.31 check — verify: `node --test
  scripts/agento.test.mjs` still passes (no behaviour wired yet)

- [x] 2.2 Rewire `models apply`: migrate legacy skip-worktree bits, install the
  filter with the resolved per-file pins (top-level + handoffs), write the files,
  `git update-index -q --refresh`; keep the worktree and dirty refusals (reword the
  worktree message); update the existing apply/clear/handoff tests in
  `scripts/agento.test.mjs` from skip-worktree assertions to filter assertions
  (config, attributes block, state file, no `S` bits, `git status --porcelain`
  empty) — verify: `node --test scripts/agento.test.mjs` passes

- [x] 2.3 Rewire `models clear` (strip pins, remove filter config / attribute block
  / `<common>/agento/` and any legacy bits, refresh; from a linked worktree leave the
  shared state alone) and add the clear acceptance test (no config, no attributes
  block, no state dir, no `S` bits, `git diff --quiet HEAD`) — verify: `node --test
  scripts/agento.test.mjs` passes

- [x] 2.4 Add `models adopt` (record current file pins as filter state, clear
  legacy bits, file bytes unchanged, idempotent `changed: []`, same refusals) with
  usage header line; tests: legacy named-profile clone migrated by `apply` with
  identical pins, legacy `active: custom` clone migrated by `adopt` with
  byte-identical files and `active: custom` — verify: `node --test
  scripts/agento.test.mjs` passes

- [x] 2.5 `modelsState` / `modelsReport`: add `legacySkipWorktree` (keep
  `skipWorktree` as its alias) and `filter { installed, stateFile, script,
  scriptCurrent, attributes, unrecorded[] }`; replace `MODELS_HINT`; test that a new
  prompt committed after apply appears in `filter.unrecorded` — verify: `node --test
  scripts/agento.test.mjs` passes

- [x] 2.6 Dirty detection under the filter: tests that a body edit and a different
  hand-edited `model:` value both show in `git status --porcelain` and make `apply`
  refuse with `status: "dirty"` — verify: `node --test scripts/agento.test.mjs`
  passes
  — note (2026-10-13): 2.2–2.6 landed as one commit because apply, adopt, and clear
  share one code block in `case "models"`; verified together by one full
  `node --test scripts/agento.test.mjs` run (206/206, exit 0). Repairs to the plan:
  `git update-index -q --refresh` is not enough — git treats a size change as a
  modification without consulting the filter, so every verb re-records the stat of
  each tracked target file with `git update-index -- <files>` (cleaned content equals
  the index, nothing staged; files dirty beyond their pins are skipped). The pin
  state records every target file (unpinned ones as `model: null`), so
  `filter.unrecorded` lists only files that arrived after the last apply/adopt. A
  hand-edited `model:` value counts as dirty for `apply` only (`adopt` records it);
  `git restore` brings the recorded pin back. The report also carries
  `filter.config` and `filter.state` (`ok | missing | invalid`).

## Phase 3: Doctor and sync paths

- [x] 3.1 Extend the `doctor` `model-profile` check: `warn` for legacy bits
  (fallback names `models adopt` / `models apply <name>`), for pins without a
  healthy filter (missing config, attributes, state, or script; stale script copy),
  and for non-empty `unrecorded[]`; drop the clear → pull → apply advice; tests per
  case — verify: `node --test scripts/agento.test.mjs` passes

- [x] 3.2 Ship acceptance test: a ship fixture whose primary clone has a named
  profile applied ships a delivery changing a pinned prompt + mirror through
  `sync` with no manual step; `models list` `active` unchanged and pinned files equal
  the merged content plus the same pins; a second variant with an `adopt`ed custom
  pin set — verify: `node --test scripts/agento.test.mjs` passes

- [x] 3.3 `publish-pr --merge` sync and ship `reopen` (`checks-failed`) fast-forward
  tests with pins active on the clone that fast-forwards — verify: `node --test
  scripts/agento.test.mjs` passes

- [x] 3.4 Commit-hygiene test: with pins active, `git status --porcelain` is empty
  in the primary and a linked worktree, and a commit touching a pinned file's body in
  each has no `model:` line in `git show HEAD:<file>` — verify: `node --test
  scripts/agento.test.mjs` passes
  — note (2026-10-13): 3.1–3.4 committed together, verified by one run of
  `node --test scripts/model-filter.test.mjs scripts/agento.test.mjs` (223/223,
  exit 0). The ship/publish-pr fixtures pin a minimal plugin layout committed to the
  primary (`pinPrimary`); the reopen test covers both an owner worktree and the
  ownerless primary switched onto the branch.

## Phase 4: Docs, prompt, bundle, gate

- [x] 4.1 Update `docs/model-profiles.md`, `docs/install.md`, `docs/commands.md`,
  `.github/prompts/models.prompt.md` (argument-hint + `adopt` + filter health
  reporting) and its byte mirror `commands/models.md`, and add a **Fixed** entry to
  `CHANGELOG.md` `## Unreleased`; add `model-filter.mjs` to
  `extension/scripts/copy-cli.mjs` `cliFiles` and run `cd extension && npm run
  copy-cli` — verify: `grep -rn "skip-worktree" docs .github/prompts commands
  scripts/agento.mjs` shows only legacy-migration wording; `node --test
  tests/customizations.test.mjs tests/extension-bundle.test.mjs` passes

- [x] 4.2 Run the full suite inside a linked worktree of a temporary clone with a
  profile applied (pins smudged into the worktree), and record the result here —
  verify: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exits 0 in that
  worktree
  — note (2026-10-13): the first run in a pinned worktree failed 16/515 and exposed
  two real problems, fixed before re-running: (1) the stat re-record (`git
  update-index -- <files>`) staged pin-free content when HEAD itself carried pins —
  it now re-records only files whose cleaned content equals HEAD and that have no
  staged change; (2) tests that read the running checkout's working files —
  `modelsFixture` copied pinned agents/prompts (it now strips pins after copying),
  and two `doctor` tests read the running clone's `model-profile` state (they now
  pass `--plugin-root` to their own repo).
  — result (2026-10-13, at the repair commit): temporary clone of the branch,
  `models apply t` (56 files changed, `filter.installed: true`), `git worktree add`
  → 56 pinned files in the worktree, `git status --porcelain` empty before and after;
  `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` in the worktree →
  exit 0, 515 tests, 515 pass, 0 fail (commands/*.md ↔ prompt byte-equality held).

- [x] 4.3 Gate: integrate `origin/main`, then `node --test 'scripts/**/*.test.mjs'
  'tests/**/*.test.mjs'` and `cd extension && npm run build && npm run test:unit`;
  compare against the baseline (493/493, exit 0) and record both results here —
  verify: both exit 0 with no test removed
  — result (2026-10-13): `sync` → up-to-date (origin/main already integrated in both
  halves); `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → exit 0,
  515 tests, 515 pass, 0 fail (baseline 493/493; +22 new, none removed);
  `cd extension && npm ci && npm run build && npm run test:unit` → build exit 0,
  unit exit 0, 167/167; `git status --porcelain` empty. Shellcheck not run: no `.sh`
  file changed.
