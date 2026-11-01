# Review: cli-command-modules

Verdict: approve

Reviewed 2026-10-31 (round 1) against product `feade39` (branch
`feature/cli-command-modules`, PR #138) with `origin/main` an ancestor of HEAD, and
companion `6d6d1d8` (agento-docs PR #72). Base for parity: product `ad9e8f3`. Every
check below was run by the Reviewer in the product worktree; nothing was taken from
the Builder's recorded results alone.

## Acceptance checklist results

1. **Thin dispatcher ≤ 200 lines, unchanged usage header, eager `lib/context.mjs`
   import, `COMMAND_MODULES`, lazy `import()`, no legacy `switch`** — **pass**.
   `wc -l scripts/agento.mjs` = 88; `grep -c "^\s*case "` = 0. Lines 1–42 (shebang
   + usage header) are byte-identical to `ad9e8f3` (`diff` of the two ranges is
   empty). The file holds exactly `import { command, usage } from
   "./lib/context.mjs"`, the 32-entry `COMMAND_MODULES` table, and the
   `Object.hasOwn` → `await import(...)` → `await handlers.commands[command]()`
   dispatch with the `usage(command ? \`unknown command ${command}\` : "missing
   command")` fallthrough. `node --test tests/cli-layout.test.mjs` 5/5 pass.
2. **All 32 subcommands served from `scripts/commands/<module>.mjs` per the
   Approach grouping; dependency rules hold** — **pass**. `COMMAND_MODULES` maps
   32 names onto 12 modules (`release`, `migrate`, `harness`, `models`, `resolve`,
   `status`, `doctor`, `paths`, `session`, `publish`, `ship`, `next`), exactly the
   plan's table. A grep of `from "…"` specifiers over `scripts/commands/*.mjs` and
   `scripts/lib/*.mjs` shows every command module imports only `../lib/*` and the
   flat modules; no `commands/` → `commands/` or `→ agento.mjs` edge; no `lib/` →
   `commands/` edge; the `lib/` graph is acyclic (`context` ← `records` ← `layout`
   ← `github` ← `session` ← `doctor` ← `documents`; `ship`, `paths`,
   `delivery-run`, `models`, `copilot`, `probe`, `release`, `resolve`, `git` hang
   off that chain without back-edges). `cli-layout` test 4 passes. One recorded
   deviation (step 3.6): `doctorDocument` lives in `lib/doctor.mjs` rather than
   `lib/documents.mjs` — a name the plan called indicative.
3. **No non-test module in `commands/` or `lib/` exceeds 1,500 lines** — **pass**.
   Largest: `commands/ship.mjs` 836, `commands/publish.mjs` 737,
   `lib/models.mjs` 602. `cli-layout` test 5 passes.
4. **CLI behavior byte-identical to `ad9e8f3`; parity harness empty diff** —
   **pass**. `bash <companion>/…/evidence/parity.sh` from the product worktree:
   `PARITY OK: all 21 invocations byte-identical (stdout, stderr, exit code)`,
   exit 0. `evidence/output-parity.txt` lists the 21 invocations, base `ad9e8f3`,
   branch `feade39…`, "Diff: empty". The Reviewer additionally ran 22 invocations
   outside the fixed list (`resolve feature <slug>`, `resolve feature nope`,
   `resolve`, `policy`, `policy 99`, `--bogus`, `status --step 1`, `models resolve
   ship --role primary`, `models show nope`, `preflight review-feature feature
   <slug>`, `close-decision`, `ship-preflight`, `workspace`, `artifacts`,
   `windows <path>`, `harness`, `release abc --wait 99`, `doctor --for nope`,
   `paths plan 20261031-055136`, `initiative nope`, `migrate`, `find`) against the
   same extracted base tree: all 22 identical in stdout+stderr and exit code.
   A mechanical pure-move check also holds: normalizing the base monolith and the
   union of `agento.mjs` + `lib/*.mjs` + `commands/*.mjs` (dropping import/export
   lines, comments, and blank/brace-only lines) and diffing the line multisets
   leaves only the `switch`/`case`/`break` scaffolding, `export` prefixes, import
   specifier lists, the handler method headers, the `COMMAND_MODULES` table, the
   intentional `CLI_DIR`/`PLUGIN_ROOT` pin, and `usage()` reading
   `CLI_DIR/agento.mjs`. The one `break;` → `return;` (`policy --list`,
   `commands/doctor.mjs:125`) follows an `emit()` that exits the process.
5. **`PLUGIN_ROOT`, `CLI_DIR`, `WAIT_FOR_CHECKS` resolve to the same paths** —
   **pass**. `node -e 'import("./scripts/lib/context.mjs")…'` prints
   `CLI_DIR=<root>/scripts`, `PLUGIN_ROOT=<root>`; the bundled copy
   (`extension/cli/lib/context.mjs`) prints `<root>/extension/cli` and
   `<root>/extension`, the same values the base's `import.meta.url` arithmetic
   gave from `agento.mjs` in each location. `lib/ship.mjs:16` derives
   `WAIT_FOR_CHECKS` from `PLUGIN_ROOT`; `lib/models.mjs:48` keeps
   `MODEL_FILTER_FILES` resolving from `CLI_DIR`. `harness status`, `models list`,
   `models pins` are in the passing parity list; the models-filter and ship
   wait-for-checks tests are in the green full suite.
6. **`scripts/agento.test.mjs` gone; 307 tests live unchanged in
   `commands/*.test.mjs` with fixtures in `test-helpers/agento-fixtures.mjs`; test
   names identical** — **pass**. `test -e scripts/agento.test.mjs` fails. A script
   that splits `ad9e8f3:scripts/agento.test.mjs` into its 307 top-level `test(…)`
   blocks and searches the concatenated `scripts/commands/*.test.mjs` finds all 307
   verbatim (0 missing). The Reviewer's own TAP run (`node --test
   --test-reporter=tap …`) yields 843 names; sorted with `LC_ALL=C` and compared to
   the base half of `evidence/test-names.txt`, the only additions are the 5
   `tests/cli-layout.test.mjs` names — all 838 base names are present.
   `evidence/test-names.txt`'s two halves are set-identical (838 = 838).
7. **Full documented test command exits 0, 0 failures, ≥ 838 tests, three times
   in a row** — **pass**. Three consecutive Reviewer runs of `node --test
   'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'`: 843
   pass / 0 fail / 843 total, exit 0, each (≈159 s, ≈165 s, ≈171 s). No
   parallel-file fixture collisions observed.
8. **Extension bundle mirrors the tree; build/unit/electron/package with
   `assert-vsix` exit 0** — **pass**. `cd extension && npm run build` exit 0
   (`copy-cli` reports 13 flat modules + 16 `lib/*.mjs` + 12 `commands/*.mjs`,
   no tests, no `test-helpers/`); `npm run test:unit` 251/251; `npm run
   test:electron` exit 0 ("Electron no-markdown scenario passed"); `npm run
   package` exit 0, "VSIX archive assertion passed: 15 required entries, license
   bytes preserved, exclusions clean" (`cli/` 41 files). `node --test
   tests/extension-bundle.test.mjs` 4/4. `copy-cli.mjs` collects `lib/` and
   `commands/` recursively, skips `*.test.mjs` and `test-helpers/`, and prunes
   stale files and emptied directories; `extension-bundle.test.mjs` derives the
   same set and byte-compares; `assert-vsix.mjs` requires `cli/lib/context.mjs`
   and ≥ 1 `cli/commands/*.mjs`.
9. **Lint gate unchanged; five guard-smoke replays exit 0** — **pass**.
   `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` with the ShellCheck
   v0.10.0 release binary (not on PATH; unpacked to `/tmp` and deleted after):
   exit 0, no findings — matches the plan's recorded baseline (§5: no shell files
   changed, no overlap, no scoped gate needed). All five replays from AGENTS.md
   "Commands" (`replay-guard.sh` plain, `REPLAY_COMPANION=1`,
   `REPLAY_FORMAT=copilot`, both, and the Copilot fixtures) exit 0.
10. **AGENTS.md, `docs/architecture.md`, and `copilot-mechanic.agent.md` describe
    the layout; Mechanic scope names the new directories** — **pass**. AGENTS.md
    `scripts/` bullet now names the dispatcher, `COMMAND_MODULES`, `lib/`,
    `commands/` (+ `*.test.mjs`), and `test-helpers/agento-fixtures.mjs`; its
    `extension/` bullet says the copy covers `lib/` and `commands/` and excludes
    tests and `test-helpers/`. `docs/architecture.md` "Scripts" names all three.
    `copilot-mechanic.agent.md` scope lists `scripts/lib/` and `scripts/commands/`
    and adds the "locate a subcommand via `COMMAND_MODULES`" bullet.
    `tests/customizations.test.mjs` is in the green full suite (60 tests).

Score: 10 / 10 pass, 0 fail, 0 deferred.

## Plan vs implementation

- Grouping matches the Approach table exactly (12 command modules, 32 subcommands).
- `lib/` file names beyond `context.mjs` were indicative; the delivered set
  (`context`, `copilot`, `delivery-run`, `doctor`, `documents`, `git`, `github`,
  `layout`, `models`, `paths`, `probe`, `records`, `release`, `resolve`,
  `session`, `ship`) is a sensible by-concern split. `doctorDocument` in
  `lib/doctor.mjs` instead of `lib/documents.mjs` is recorded on step 3.6.
- One layout-driven test edit outside the move, recorded on step 3.11:
  `tests/customizations.test.mjs` #88 now reads `scripts/commands/ship.mjs` for
  the `--literal-pathspecs clean` guard; its assertion is unchanged.
- The fixtures module grew from the ~10 original shared helpers to 57 exports
  (cross-family helpers the split required), recorded on steps 4.2 and 4.3. Test
  bodies are untouched.
- No behavior, flag, output, or exit-code changes found; no Follow-ups were needed
  for latent bugs (none were surfaced by the move).
- Undocumented changes: none.

## Roadmap audit

All 23 steps are ticked; none is `(manual)` or `(manual, post-ship)`. Spot checks
against the codebase:

- 2.1/2.2: `lib/context.mjs` holds the import-time state in the original order
  with private caches behind accessors; `copy-cli.mjs`/`extension-bundle.test.mjs`/
  `assert-vsix.mjs` changed as described. ✓
- 3.1–3.12: every named handler exists and is exported from the stated module
  (`cli-layout` test 3 imports each and asserts `typeof === "function"`). ✓
- 3.13: 88 lines, 0 `case`, header intact. ✓
- 4.1–4.3: fixtures module resolves `cli` from its own location
  (`agento-fixtures.mjs:13–15`); `agento.test.mjs` deleted; 307/307 blocks
  verbatim; name set preserved. ✓
- 4.4 and 6.1: the Reviewer's own three full runs reproduce 843/843 ×3; shellcheck,
  five replays, and the extension gate reproduce exit 0. ✓
- 5.1: 5/5 layout tests. The step's negative check (an unlisted header command
  fails test 2) was verified by reading the test — it `deepEqual`s the sorted
  header set against the sorted table keys both ways — rather than by mutating
  product source. ✓
- 5.2: doc paragraphs read as recorded. ✓

No falsely ticked boxes. No missing-work steps added. No repairs made.

## Findings

No findings above minor severity.

- **Minor** — `evidence/test-names.txt`: the base half and the final half are
  sorted under different collations (the final half places the `\#121`/`\#60`
  names and capitalised names differently), so a plain line `diff` of the two
  halves is non-empty even though the sets are identical. Future evidence of this
  kind should sort both halves with `LC_ALL=C sort` so the file is self-evidently
  a match. Not a correctness issue.
- **Minor / informational** — `tests/cli-layout.test.mjs` test 1 asserts the
  dispatcher contains no `function` keyword and no `=>`. That is the intended
  guard, but it also forbids a future comment containing either token; acceptable
  for a file whose purpose is to stay inert.

## Follow-ups

- None.
