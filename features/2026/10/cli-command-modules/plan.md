# Split the agento.mjs CLI into per-command modules behind a thin dispatcher

## Problem

`scripts/agento.mjs` is a single 5,627-line module (product `ad9e8f3`). It holds
argument parsing, repository and companion discovery, ~170 top-level helpers, and
one `switch (command)` dispatcher with 32 cases (`scripts/agento.mjs:4843`). Its
black-box test file `scripts/agento.test.mjs` is 9,478 lines with 307 tests.
Earlier deliveries already moved pure logic out: `merge-state.mjs`,
`release-state.mjs`, `session-state.mjs`, `model-profiles.mjs`,
`delivery-metrics.mjs`, and others.

The remaining monolith is costly to work in. Anyone changing one subcommand (an
agent or a human) has to page through 5k lines to find its case, its helpers, and
the shared state they read. This hits the 🛠️ Agento Mechanic hardest: its scope
names `scripts/agento.mjs` as a whole (`.github/agents/copilot-mechanic.agent.md:19`).
Context-limited agents re-read large ranges, and unrelated deliveries collide in one
file.

This feature continues the extraction. Each subcommand family moves into
`scripts/commands/<name>.mjs`, and the helpers more than one family needs move
into `scripts/lib/*.mjs`. `scripts/agento.mjs` becomes a thin dispatcher. The CLI's
external behavior does not change: same commands, same JSON documents, same exit
codes.

## Decisions

Asked 2026-10-31 with the ask-questions tool. Every answer was the recommended
option.

1. **Module granularity.** Q: How to group the 32 subcommands into
   `scripts/commands/*.mjs`? A: *"(Recommended) One module per command family —
   e.g. ship.mjs (ship, ship-preflight, close-decision), session.mjs
   (start/close-session, session, paths, workspace), publish.mjs (plan/review/
   publish-pr, step-commit, sync), models.mjs, doctor.mjs (doctor, preflight),
   status.mjs, next.mjs, … ~12–15 files"* (recommended).
2. **Shared state & helpers.** Q: `agento.mjs` computes root/options/config/layout
   at import time and many helpers read them. How should that be shared? A:
   *"(Recommended) Shared helpers move to scripts/cli/*.mjs core modules (context,
   git/gh, layout, emit); commands import what they need; agento.mjs becomes a thin
   dispatcher (<~200 lines) with lazy import() per command"* (recommended).
   **Planner refinement:** the core directory is `scripts/lib/`, not
   `scripts/cli/`. `scripts/` is byte-copied to `extension/cli/`, so `scripts/cli/`
   would ship as `extension/cli/cli/`. The design is otherwise exactly the chosen
   one, and the delivery PR states the rename for the user to veto.
3. **Test file.** Q: `scripts/agento.test.mjs` is 9,478 lines — split it or leave
   it? A: *"(Recommended) Split it alongside: shared fixtures into a test helper,
   tests into scripts/commands/<name>.test.mjs per module — test bodies moved
   unchanged"* (recommended).
4. **Behavior guarantee.** Q: Pure refactor, or allow changes along the way? A:
   *"(Recommended) Pure move: byte-identical JSON output and exit codes, no behavior
   changes; any found bugs become Follow-ups"* (recommended).
5. **Delivery shape.** Q: One big PR or staged? A: *"(Recommended) One feature/PR,
   roadmap moves one command family per step (each step green and committed), so it
   pauses/resumes safely"* (recommended).

## Research

Skills consulted: none — no matching domain. This repository has no `.agents/skills/`
directory and no AGENTS.md `## Agento` skills table. The work is a plain Node ESM
refactor.

- **Structure of `scripts/agento.mjs` (product `ad9e8f3`, 5,627 lines).**
  - Lines 1–41: a usage header comment, one line per subcommand. This is the CLI's
    only synopsis.
  - Lines 43–68: imports from the already-split modules.
  - Lines 72–4840: helpers. Lines 4843–5627: the dispatcher `switch`.
  - Some cases are long inline bodies: `next` (4843+, ~130 lines), `migrate` (~60),
    `harness` (~87), and `models` (5393–5615, ~220).
- **Import-time state** (the reason a shared context module is needed):
  - `parseArgs` produces `positional`/`options`, then `command`/`rest` (207–208);
    `startDir`/`toplevel` follow (209–210).
  - The mutable `anchorListing` cache (232) feeds `anchorRoot`, which yields
    `anchor`/`root` (281–282). Product worktree caches,
    `worktreesDirByPrimary`, and `roleCwd` follow (286–293).
  - `config`/`source` come from `loadAgentoConfig(root)` (294);
    `repoName`/`currentBranch`/`gitAdapter` (295–301);
    `artifacts`/`artifactsRoot`/`artifactsGit`/`agit` (317–325); and the mutable
    `companionWorktreesCache` (328–329).
  - Process-local memo caches: `recordBases` (665), PR/probe caches (867, 898),
    and `doctorResults` (1278).
  - `layoutFor()` (348) builds a second, branch-specific layout.
- **Paths derived from `import.meta.url`.** Moving any of these changes their value:
  - `PLUGIN_ROOT` (70) uses `dirname(dirname(<scripts/agento.mjs>))`.
  - `WAIT_FOR_CHECKS` (2979) is built from `PLUGIN_ROOT`.
  - `CLI_DIR` (3781) is the `scripts/` directory. The models filter installs
    `MODEL_FILTER_FILES` (3776: `model-filter.mjs`, `model-profiles.mjs`) from it
    (3810, 4075).
- **Families, sized from the helper map** (approximate lines once shared helpers
  move out):
  - ship + ship-preflight + close-decision: ~700–900
  - sync/step-commit/plan-publish/review-publish/publish-pr: ~650–800
  - status/initiative/metrics/dashboard: ~650–800
  - models: ~500–650
  - doctor/preflight/policy: ~450–600
  - session/start-session/close-session: ~450–650
  - paths/workspace/windows/artifacts/handoff: ~350–500
  - harness: ~350–450
  - release: ~300–400
  - next: ~250–350
  - migrate: ~250–350
  - config/resolve/find/ports: ~250
  - Shared core (`lib/`): output (`usage`, `emit`, `emitRaw`, `withExit`, 72–110),
    discovery/layout (127–~480), record/roadmap traversal (~500–1900), PR lookups
    and probes (737–~1100), and branch/remote helpers (2261–2400).
  - `dashboard` composes the status, doctor, metrics, and initiative documents, so
    those document builders are shared core.
- **External layout dependencies:**
  - `extension/scripts/copy-cli.mjs:8–24` copies a fixed, flat `cliFiles` list into
    `extension/cli/` and deletes any other entry.
  - `tests/extension-bundle.test.mjs:9–34` asserts that `extension/cli/` holds
    exactly that flat list, byte-equal to `scripts/`.
  - `extension/scripts/assert-vsix.mjs:10–31` asserts the packaged CLI entries.
  - `extension/cli/` is committed, so every step that changes `scripts/` must run
    `cd extension && npm run copy-cli` and commit the copy.
  - The hooks (`scripts/hooks/session-context.mjs:107`) and the canvas
    (`canvas/agento-mission-control/cli.mjs:1`, `snapshot.mjs:2`) spawn
    `scripts/agento.mjs` by path and import no internals. Hooks import only
    `agento-config.mjs` (`scripts/hooks/hook-lib.mjs:8`).
  - `tests/customizations.test.mjs:364–441` asserts on prompt and agent text that
    mentions `agento.mjs <command>`, not on the CLI source, so it is unaffected.
  - CI already globs nested tests: `.github/workflows/ci.yml:17` runs
    `node --test 'scripts/**/*.test.mjs' …`.
- **Documentation that describes the layout:**
  - AGENTS.md "Layout" (`scripts/` bullet) and "Commands"
  - `docs/architecture.md:95` ("Scripts … fronted by `scripts/agento.mjs`")
  - `.github/agents/copilot-mechanic.agent.md:19` (its edit scope) and `:115`
- **Tests.** `scripts/agento.test.mjs` is fully black-box. It spawns
  `node scripts/agento.mjs …` (`runWith`, ~line 93) and never imports CLI
  internals. Its fixture helpers sit at lines 14–~110 (`makeRepo`,
  `cloneWithOrigin`, roadmap/config writers, `runWith`). Tests are grouped by
  command in file order; a few combine commands (e.g. ~140, ~192). The black-box
  suite is the regression net for a pure move.
- **Test baseline (product `ad9e8f3`, 2026-10-31).**
  `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'`
  exited 0: 838 tests, 838 pass, 0 fail, ~375 s. `scripts/agento.test.mjs` holds
  307 `test(` blocks.
- **Lint baseline (policy §5), 2026-10-31 at product `ad9e8f3`.** AGENTS.md has
  exactly one lint command, `shellcheck scripts/hooks/*.sh
  scripts/wait-for-checks.sh`. `shellcheck` is not installed on this machine (exit
  127), so the run used the official ShellCheck v0.10.0 release binary unpacked
  into `/tmp`. Result: exit 0, no findings.
  - The repository configures no JS linter or formatter (no ESLint, Prettier, or
    Biome; CI `ci.yml:12–29` runs only node tests, shellcheck, and the guard
    replays).
  - Overlap decision: the baseline is green and this delivery touches no shell
    scripts, so no cleanup or scoped gate is needed. The full-repository shellcheck
    must still exit 0 with no findings at the end.
- **Concurrent deliveries.** `gh pr list --state open` returned no open PRs on
  2026-10-31, so there is no file overlap. Any delivery that starts later and
  touches `scripts/agento.mjs` will conflict heavily with this one; see `## Risks`.

## Approach

**Target layout** (all under `scripts/`):

```text
agento.mjs                thin dispatcher (≤ 200 lines incl. the usage header)
lib/context.mjs           argv parse, PLUGIN_ROOT/CLI_DIR, anchor/root, config,
                          artifacts/agit, layout, worktree caches, emit/usage/withExit
lib/*.mjs                 shared helpers grouped by concern (e.g. git.mjs, github.mjs,
                          records.mjs, session.mjs, documents.mjs, delivery-run.mjs)
commands/resolve.mjs      config, resolve, find, ports
commands/status.mjs       status, initiative, metrics, dashboard
commands/paths.mjs        paths, workspace, windows, artifacts, handoff
commands/session.mjs      session, start-session, close-session
commands/ship.mjs         ship, ship-preflight, close-decision
commands/publish.mjs      sync, step-commit, plan-publish, review-publish, publish-pr
commands/doctor.mjs       doctor, preflight, policy
commands/next.mjs         next
commands/migrate.mjs      migrate
commands/harness.mjs      harness
commands/models.mjs       models
commands/release.mjs      release
commands/<module>.test.mjs   the moved tests for that module
test-helpers/agento-fixtures.mjs   the moved shared test fixtures (not a test file)
```

The table is the target grouping. The Builder may move a single subcommand to a
neighboring family when its helper graph makes that clearly cheaper, but must record
the change on the roadmap step. File names in `lib/` beyond `context.mjs` are
indicative.

**Rules the split follows:**

1. **Dependency direction.**
   - `agento.mjs` imports `lib/context.mjs` (eagerly) and command modules (lazily).
   - Command modules import only `lib/*.mjs` and the existing flat modules. A
     command module never imports another command module or `agento.mjs`.
   - `lib/*.mjs` never imports `commands/`.
   - Any helper used by two or more command modules lives in `lib/`. A helper used
     by exactly one moves with that module.
2. **Module contract.** Each command module exports a map from subcommand name to
   handler: `export const commands = { ship: () => …, "ship-preflight": () => … }`.
   - Handlers keep today's case bodies verbatim apart from imports. They read
     `rest`/`options` from `lib/context.mjs` exactly as the cases read the module
     globals today, and they end the process through the same
     `emit`/`emitRaw`/`usage`/`withExit` calls.
   - `async` cases (`dashboard`) stay `async`, and the dispatcher awaits the handler.
3. **Dispatcher.**
   - Keep the shebang and the full usage header comment, which stays the CLI's one
     synopsis.
   - `import "./lib/context.mjs"` eagerly, so argument-parse errors and repository
     discovery happen in the same order and with the same output as today.
   - Then look the command up in a static `COMMAND_MODULES` table
     (`{ ship: "ship", "ship-preflight": "ship", … }`), `await import(\`./commands/${file}.mjs\`)`,
     and call the handler. A missing or unknown command still hits
     `usage(command ? \`unknown command ${command}\` : "missing command")`.
   - While the migration runs, commands not yet in the table fall through to the
     remaining legacy `switch`. The final family step deletes the `switch`.
4. **Import-time state stays import-time.** `lib/context.mjs` evaluates the current
   top-level discovery code in the same order, on first import, once per process.
   ES modules are singletons, so every importer sees the same `root`, `config`,
   `agit`, and so on.
   - Mutable caches (`anchorListing`, `companionWorktreesCache`,
     `productWorktreeCache`, memo maps) stay private to the module that mutates
     them and are exposed through functions. Importers cannot reassign an imported
     `let` binding.
5. **Path constants are pinned.** In `lib/context.mjs`, `CLI_DIR` is the `scripts/`
   directory (`path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")`)
   and `PLUGIN_ROOT` is `path.dirname(CLI_DIR)`. `WAIT_FOR_CHECKS` and the
   models-filter install paths keep deriving from them, so every emitted path and
   every installed filter file is unchanged.
6. **Extension bundle follows the tree.**
   - `extension/scripts/copy-cli.mjs` copies `agento.mjs`, the flat module list,
     `lib/*.mjs`, and `commands/*.mjs`, excluding `*.test.mjs` and
     `test-helpers/`. It still deletes stale entries.
   - `tests/extension-bundle.test.mjs` derives the expected file set the same way
     (recursively, byte-equal).
   - `extension/scripts/assert-vsix.mjs` asserts the dispatcher plus at least one
     `lib/` and one `commands/` file in the VSIX.
   - Every step that changes `scripts/` runs `npm run copy-cli` and commits
     `extension/cli/` with it.
7. **Tests move unchanged.**
   - Fixtures (lines 14–~110 of `agento.test.mjs`) move to
     `scripts/test-helpers/agento-fixtures.mjs`. That module resolves the CLI path
     as `scripts/agento.mjs` from its own location, not from the test file's
     location.
   - Each `test(...)` block moves byte-for-byte (apart from imports) into the test
     file of the module whose command it exercises.
   - Cross-command scenarios go to `scripts/commands/integration.test.mjs`.
   - `scripts/agento.test.mjs` is removed once empty.
   - The suite keeps every test name, and the total test count does not drop.
8. **Layout guard.** A new `tests/cli-layout.test.mjs` pins the structure:
   - `scripts/agento.mjs` stays at or under 200 lines and declares no function
     besides the dispatcher.
   - Every `COMMAND_MODULES` entry resolves to a module that exports that handler.
   - Every subcommand in the usage header is in `COMMAND_MODULES`, and the other
     way round.
   - No `commands/*.mjs` imports another command module or `agento.mjs`, and no
     `lib/*.mjs` imports `commands/`.
   - No non-test file under `scripts/commands/` or `scripts/lib/` exceeds 1,500
     lines.
9. **Output parity harness (evidence, not product code).** The harness script lives
   at `evidence/parity.sh` in the slug directory, so the Builder can resume it and
   the Reviewer can re-run it.
   - Before the first move, the Builder extracts the base CLI
     (`git archive ad9e8f3 scripts | tar -x -C <tmp>`). It then records stdout and
     exit code for a fixed list of read-only invocations, all run from the same
     checkout with `--root`: `config`, `find cli-command-modules`, `status`,
     `status feature`, `session`, `paths feature cli-command-modules`, `ports x`,
     `doctor`, `doctor --for ship`, `policy --list`, `policy 9`,
     `preflight new-feature`, `next`, `initiative`, `metrics`, `models list`,
     `models pins`, `harness status`, `release` (usage error),
     `unknown-cmd` (usage error), and no command (usage error).
   - It repeats the run against the branch's CLI after each phase and diffs the
     results. The base tree's own path is normalized to the checkout's path.
   - The final diff must be empty. It is stored as
     `evidence/output-parity.txt` with the invocation list and both commits.
10. **Docs.** Update the AGENTS.md `scripts/` layout bullet to describe
    `agento.mjs` (dispatcher), `lib/`, `commands/`, and `test-helpers/`. Update
    `docs/architecture.md`'s "Scripts" paragraph. In
    `.github/agents/copilot-mechanic.agent.md`, scope its edits to
    `scripts/agento.mjs`, `scripts/lib/`, and `scripts/commands/`, and add a line
    on finding a subcommand (`COMMAND_MODULES` → `commands/<module>.mjs`). The
    canonical-command and receipt rules are untouched.

**Affected files:**

- `scripts/agento.mjs` (shrinks to the dispatcher)
- new `scripts/lib/*.mjs`, `scripts/commands/*.mjs` (+ `.test.mjs`), and
  `scripts/test-helpers/agento-fixtures.mjs`
- `scripts/agento.test.mjs` (removed)
- `extension/scripts/copy-cli.mjs`, `extension/scripts/assert-vsix.mjs`, and the
  regenerated `extension/cli/**`
- `tests/extension-bundle.test.mjs` and the new `tests/cli-layout.test.mjs`
- `AGENTS.md`, `docs/architecture.md`, and `.github/agents/copilot-mechanic.agent.md`

## Risks

- **Silent behavior drift in a 5k-line move.** A helper that loses a closure over a
  global, or a changed evaluation order, can alter output only on rarely tested
  paths.
  - Mitigation: verbatim moves, the full black-box suite after every step, and the
    output-parity harness after every phase.
  - Pure-move rule: any bug found is recorded as a Follow-up, never fixed here.
- **Path constants change with file depth** (`PLUGIN_ROOT`, `CLI_DIR`,
  `WAIT_FOR_CHECKS`). Mitigation: they are pinned in `lib/context.mjs` per Approach
  rule 5. The parity list includes `harness status` and `models list`/`pins`, and
  the existing models-filter install tests run unchanged.
- **Reassigning imported `let` bindings throws (`TypeError: Assignment to constant
  variable`).** Mitigation: each mutable cache stays inside the module that owns
  it, behind accessor functions (Approach rule 4). The full suite exercises every
  cache path.
- **Import cycles between `lib/` modules.** Cycles can expose uninitialized
  bindings at import time. Mitigation: `lib/context.mjs` imports no other `lib/`
  module, other `lib/` modules form an acyclic graph, and the layout test flags
  `commands` ↔ `commands` and `lib` → `commands` edges.
- **Extension bundle drift.** `extension/cli/` is committed and byte-compared.
  Mitigation: every step's `verify:` runs `npm run copy-cli` and
  `tests/extension-bundle.test.mjs`. Phase 6 runs the extension build, unit, and
  electron activation tests, plus `npm run package` with `assert-vsix`.
- **More test files run in parallel.** `node --test` runs files concurrently, while
  today 307 tests run serially in one file. Shared fixtures that rely on serial
  order (fixed temp names, shared `HOME`, ports) could collide.
  - Mitigation: fixtures already use `mkdtemp`. The Builder runs the split suite
    three times and records it. Any collision is fixed in the fixture helper (unique
    temp roots), never by changing test bodies or the documented test command.
- **Concurrent deliveries touching `scripts/agento.mjs`.** A delivery that starts
  during this one conflicts on nearly every hunk.
  - Mitigation: there are no open PRs today. Integrate `origin/main` by merge
    before every push.
  - If another delivery lands changes to `scripts/agento.mjs`, port its hunk into
    the corresponding new module during the merge, and re-run the suite and the
    parity harness.
  - Ship promptly once approved.
- **`shellcheck` is not installed locally.** Mitigation: use the ShellCheck v0.10.0
  release binary as in the baseline. CI runs shellcheck independently.

## Out of scope

- Any behavior, output, flag, or exit-code change, including bugs found along the
  way. Those become roadmap Follow-ups.
- Converting import-time globals into an explicit `ctx` object passed to each
  command (the alternative rejected in Decisions 2).
- Renaming or re-splitting the existing flat modules (`session-state.mjs`,
  `model-profiles.mjs`, and others).
- Adding a JS linter or formatter.
- Changing prompts, command files, or the canonical `/agento` command spelling.
- Splitting other large tests (`tests/customizations.test.mjs`, extension tests).

## Acceptance checklist

- [ ] `scripts/agento.mjs` is a thin dispatcher of 200 lines or fewer. It has the
      shebang, the unchanged usage header, the eager `lib/context.mjs` import, the
      `COMMAND_MODULES` table, and lazy `import()` dispatch, and no legacy `switch`.
      Verify: `wc -l scripts/agento.mjs`, read the file, and run
      `tests/cli-layout.test.mjs`.
- [ ] Every one of the 32 subcommands is served from `scripts/commands/<module>.mjs`
      per the Approach grouping (or a recorded deviation). The dependency rules hold:
      no command module imports another command module or `agento.mjs`, and no
      `lib/` module imports `commands/`. Verify: `tests/cli-layout.test.mjs` passes,
      and a grep of `import` lines in `scripts/commands/` and `scripts/lib/` agrees.
- [ ] No non-test module under `scripts/commands/` or `scripts/lib/` exceeds 1,500
      lines. Verify: `wc -l scripts/commands/*.mjs scripts/lib/*.mjs`, and
      `tests/cli-layout.test.mjs` asserts it.
- [ ] CLI behavior is byte-identical to product `ad9e8f3`. The output-parity
      harness over the invocation list in Approach rule 9 produces an empty diff
      of stdout and exit codes. Verify: `evidence/output-parity.txt` shows the
      list, both commits, and an empty diff, and the Reviewer re-runs it.
- [ ] `PLUGIN_ROOT`, `CLI_DIR`, and `WAIT_FOR_CHECKS` resolve to the same absolute
      paths as before. Verify: `harness status` and `models list` are in the parity
      list, and the existing models-filter and ship wait tests pass.
- [ ] `scripts/agento.test.mjs` is gone. Its 307 tests live unchanged in
      `scripts/commands/*.test.mjs` with shared fixtures in
      `scripts/test-helpers/agento-fixtures.mjs`, and the set of test names is
      identical. Verify: compare the sorted test names from the base and final TAP
      output (`node --test --test-reporter=tap`), recorded in
      `evidence/test-names.txt`.
- [ ] The full documented test command
      `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'`
      exits 0 with 0 failures and at least 838 tests, three times in a row (the
      parallel-file collision check). Verify: the counts are recorded on the final
      roadmap step.
- [ ] The extension bundle mirrors the new tree. `copy-cli` copies `agento.mjs`,
      the flat modules, `lib/`, and `commands/` without tests or test helpers, and
      `tests/extension-bundle.test.mjs` asserts the recursive byte-equal set.
      `cd extension && npm run build && npm run test:unit && npm run test:electron &&
      npm run package` exits 0, including `assert-vsix`. Verify: run those commands.
- [ ] The full-repository lint gate is unchanged:
      `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` exits 0 with no
      findings, matching the baseline. All five guard-smoke replays from AGENTS.md
      "Commands" exit 0. Verify: run them.
- [ ] AGENTS.md, `docs/architecture.md`, and `.github/agents/copilot-mechanic.agent.md`
      describe the dispatcher/`lib/`/`commands/` layout, and the Mechanic's edit
      scope names the new directories. Verify: read the changed paragraphs; the
      `tests/customizations.test.mjs` suite passes.
