```yaml
status: in-progress
branch: feature/cli-command-modules
last-updated: 2026-10-31
next-step: "3.2 Move migrate to scripts/commands/migrate.mjs"
artifact-pr: "#72"
```

## Phase 1: Baseline

- [x] 1.1 Record the baselines and write the output-parity harness.
  - Run the full test command and record the pass/fail/total counts. Save the
    sorted test names from `node --test --test-reporter=tap 'scripts/**/*.test.mjs'
    'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` as the base half of
    `evidence/test-names.txt`.
  - Run `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`. If shellcheck
    is not on PATH, use the ShellCheck v0.10.0 release binary as in plan.md
    `## Research`.
  - Run `cd extension && npm ci && npm run build && npm run test:unit` and record
    the pass count.
  - Write `evidence/parity.sh` per plan.md Approach rule 9. It extracts
    `git archive ad9e8f3 scripts` to a temp dir, runs the fixed invocation list
    against both CLIs from the product worktree with `--root`, normalizes the base
    tree path, and diffs stdout and exit codes.
  - Run it once against the unchanged branch.

  — verify: the full test command exits 0 with 838/838; shellcheck exits 0 with no
  findings; the extension build and unit tests exit 0; `evidence/parity.sh` exits 0
  with an empty diff. Record all results on this line.

  Results (2026-10-31): full test command exit 0 — 838 pass / 0 fail / 838 total
  (~368 s). TAP names saved as the base half of `evidence/test-names.txt` (838
  sorted names). `shellcheck` (ShellCheck v0.10.0 binary from /tmp) exit 0, no
  findings. Extension: `npm ci` (317 packages) → `npm run build` exit 0 →
  `npm run test:unit` exit 0 — 251 pass / 0 fail. `evidence/parity.sh` exit 0:
  all 21 invocations byte-identical (stdout, stderr, exit code) against the
  unchanged branch. Harness faithfulness notes (evidence, not product code): the
  base CLI's `skills/`, `.github/`, and `templates/` are symlinked into its temp
  `PLUGIN_ROOT` for `policy`/`next`, every invocation passes `--plugin-root
  <PRODUCT_ROOT>` so doctor/models/harness probe the real clone, and `metrics`'
  `generatedAt`/`seconds` are normalized on both sides.

## Phase 2: Shared context and dispatcher scaffold

- [x] 2.1 Create `scripts/lib/context.mjs`. Move the import-time state into it
  unchanged and in the same order: `parseArgs` and `positional`/`options`/
  `command`/`rest`, `startDir`/`toplevel`, `anchorRoot`/`anchor`/`root`, worktree
  caches, `config`/`source`, `repoName`/`currentBranch`/`gitAdapter`,
  `resolveArtifacts`/`artifacts`/`artifactsRoot`/`artifactsGit`/`agit`, and the
  companion worktree cache. Move the helpers they need with them (`git`,
  `samePath`, `hasCompanionConfig`, the `MANAGED_HALF` regex) and the output helpers
  (`usage`, `emit`, `emitRaw`, `withExit`).
  - Pin `CLI_DIR` (the `scripts/` dir) and `PLUGIN_ROOT` (its parent) per plan.md
    Approach rule 5, and derive `WAIT_FOR_CHECKS` and the models-filter paths
    from them.
  - Keep mutable caches private behind accessor functions.
  - `scripts/agento.mjs` imports what it uses from `./lib/context.mjs`.

  — verify: `cd extension && npm run copy-cli`, then the full test command exits 0,
  0 fail, ≥ 838 tests; `evidence/parity.sh` diff is empty (covers `harness status`
  and `models list`/`pins` paths)

  Results (2026-10-31): `cd extension && npm run copy-cli` exit 0. Full test
  command exit 0 — 838 pass / 0 fail / 838 total (~364 s). `evidence/parity.sh`
  exit 0: all 21 invocations byte-identical. `scripts/lib/context.mjs` pins
  `CLI_DIR` (scripts/) and `PLUGIN_ROOT` (its parent) per Approach rule 5;
  `WAIT_FOR_CHECKS` and the models-filter copy paths derive from them. Mutable
  caches (`anchorListing`, `productWorktreeCache`, `worktreesDirByPrimary`,
  `companionWorktreesCache`) are private to context.mjs behind accessor functions;
  `usage()` now reads the header from `CLI_DIR/agento.mjs`.
- [x] 2.2 Add the `COMMAND_MODULES` table and the lazy `await import("./commands/<file>.mjs")`
  dispatch in front of the legacy `switch`. The table starts empty; unlisted
  commands fall through to the `switch`.
  - Make `extension/scripts/copy-cli.mjs` copy `agento.mjs`, the flat modules,
    `lib/*.mjs`, and `commands/*.mjs`, excluding `*.test.mjs` and `test-helpers/`,
    and still prune stale entries.
  - Make `tests/extension-bundle.test.mjs` derive and byte-compare the same
    recursive set.
  - Make `extension/scripts/assert-vsix.mjs` require `cli/agento.mjs`,
    `cli/lib/context.mjs`, and (from Phase 3 on) at least one `cli/commands/*.mjs`.

  — verify: `cd extension && npm run copy-cli && npm run build` exits 0; the full
  test command exits 0, ≥ 838 tests; `node --test tests/extension-bundle.test.mjs`
  passes; `evidence/parity.sh` diff is empty

  Results (2026-10-31): `cd extension && npm run copy-cli && npm run build` exit 0
  (copy-cli now copies the flat modules plus `lib/*.mjs` and `commands/*.mjs`,
  excluding `*.test.mjs` and `test-helpers/`, and prunes stale entries; the tree
  holds `lib/context.mjs`). Full test command exit 0 — 838 pass / 0 fail / 838
  total (~370 s). `node --test tests/extension-bundle.test.mjs` 4/4 pass.
  `evidence/parity.sh` exit 0: all 21 invocations byte-identical.
  `extension/scripts/assert-vsix.mjs` now requires `cli/lib/context.mjs` and at
  least one `cli/commands/*.mjs` (dormant until Phase 3). `COMMAND_MODULES` is
  empty; unlisted commands still fall through to the legacy switch.

## Phase 3: Move command families

Every step in this phase follows the same recipe:

- Move the family's `case` bodies verbatim into handlers exported as
  `commands = { <name>: … }` from `scripts/commands/<module>.mjs`.
- Move helpers only that family uses into the module, and helpers it shares with
  any remaining command into `scripts/lib/`.
- Add the family's entries to `COMMAND_MODULES`, delete the moved cases, and run
  `npm run copy-cli`.
- Never edit behavior. Record any bug you notice as a Follow-up.

- [x] 3.1 Move `release` to `scripts/commands/release.mjs` (`RELEASE_EXIT`,
  `RELEASE_STATUS`, `ghApi`, `ghRequiredContexts`, `releaseContext`,
  `releaseSnapshot`, `releaseVerdict`, plus `once` if not yet shared) — verify: the
  full test command exits 0, ≥ 838 tests; `node scripts/agento.mjs release` still
  exits 1 with the same usage message; the extension-bundle test passes

  Results (2026-10-31): `scripts/commands/release.mjs` exports the `release`
  handler; `scripts/lib/release.mjs` holds the shared release/GitHub helpers
  (`GhFailure`, `ghApi`, `ghRequiredContexts`, `runSummary`, `once`,
  `releaseContext`, `releaseSnapshot`, `releaseVerdict`, `RELEASE_EXIT`,
  `RELEASE_STATUS`) since `ship` also uses `releaseVerdict`/`ghRequiredContexts`/
  `once`; `scripts/lib/probe.mjs` holds the shared probe block (`probe`,
  `probeAsync`, `ghVersion`, `execAsync`). `COMMAND_MODULES = { release:
  "release" }`; the `case "release"` body is deleted. `npm run copy-cli` now ships
  `lib/probe.mjs`, `lib/release.mjs`, and `commands/release.mjs`. Full test
  command exit 0 — 838 pass / 0 fail / 838 total (~366 s). `node
  scripts/agento.mjs release` exits 1 with the same usage message;
  extension-bundle test passes; `evidence/parity.sh` exit 0 (21 invocations
  byte-identical).
- [ ] 3.2 Move `migrate` to `scripts/commands/migrate.mjs` (`ROOT_KEYS`,
  `listFiles`, `recordsUnder`, `productName`, `writeCompanionName`,
  `appendMigrationNote`, `recordsDiff`, unless shared) — verify: the full test
  command exits 0, ≥ 838 tests; the extension-bundle test passes
- [ ] 3.3 Move `harness` to `scripts/commands/harness.mjs`. Keep `harnessFacts`
  and the Copilot-dir helpers in `lib/` if doctor uses them — verify: the full test
  command exits 0, ≥ 838 tests; the `node scripts/agento.mjs harness status`
  output is identical to base via `evidence/parity.sh`
- [ ] 3.4 Move `models` to `scripts/commands/models.mjs`, with the model constants
  and the filter/profile/pin helpers (~3775–4330). `currentWindowRole` and any
  helper doctor or preflight needs go to `lib/`. `MODEL_FILTER_FILES` keep
  resolving from `CLI_DIR` — verify: the full test command exits 0, ≥ 838 tests
  (the models-filter install/remove tests included); the `models list`/`models
  pins` parity diff is empty
- [ ] 3.5 Move `config`, `resolve`, `find`, and `ports` to
  `scripts/commands/resolve.mjs`. `resolveDocument`/`configDocument` go to `lib/`
  if preflight or next use them — verify: the full test command exits 0, ≥ 838
  tests; the parity diff is empty
- [ ] 3.6 Move `status`, `initiative`, `metrics`, and `dashboard` to
  `scripts/commands/status.mjs`. The document builders (`statusDocument`,
  `initiative*Document`, `metricsDocument`, `doctorDocument`) go to
  `lib/documents.mjs` (or similar), since `dashboard`, `next`, and `preflight`
  share them. `dashboard` stays `async` and the dispatcher awaits it — verify:
  the full test command exits 0, ≥ 838 tests; the parity diff is empty
- [ ] 3.7 Move `doctor`, `preflight`, and `policy` to `scripts/commands/doctor.mjs`.
  `DOCTOR_CHECKS`/`CAPABILITY_CHECKS`/`COMMAND_NEEDS`/`runDoctor` go to `lib/`,
  since start-session and dashboard use them — verify: the full test command exits
  0, ≥ 838 tests; the `doctor`, `doctor --for ship`, `policy --list`, `policy 9`,
  and `preflight new-feature` parity diff is empty
- [ ] 3.8 Move `paths`, `workspace`, `windows`, `artifacts`, and `handoff` to
  `scripts/commands/paths.mjs` — verify: the full test command exits 0, ≥ 838
  tests; the parity diff is empty
- [ ] 3.9 Move `session`, `start-session`, and `close-session` to
  `scripts/commands/session.mjs`. `sessionRecord`/`sessionContext`,
  `removeSessionPair`, and `branchVerdict` go to `lib/` if ship or next use them
  — verify: the full test command exits 0, ≥ 838 tests; the parity diff is empty
- [ ] 3.10 Move `sync`, `step-commit`, `plan-publish`, `review-publish`, and
  `publish-pr` to `scripts/commands/publish.mjs`. The delivery-run helpers
  (`buildWindow`, `deliveryRun`, `integrateHalves`, `pushHalves`, and others) go
  to `lib/` if ship uses them — verify: the full test command exits 0, ≥ 838 tests;
  the parity diff is empty
- [ ] 3.11 Move `ship`, `ship-preflight`, and `close-decision` to
  `scripts/commands/ship.mjs` (`SHIP_EXIT`, `SHIP_PR_FIELDS`, `waitForChecks`,
  `shipArgs`, `shipPrLookup`, `ship`, `stampChangelog`, `confirmTokenFor`, the
  roadmap-step parsers) — verify: the full test command exits 0, ≥ 838 tests; the
  ship tests that drive `wait-for-checks.sh` pass, which proves `WAIT_FOR_CHECKS`
  resolves
- [ ] 3.12 Move `next` to `scripts/commands/next.mjs` — verify: the full test
  command exits 0, ≥ 838 tests; the `next` parity diff is empty
- [ ] 3.13 Delete the now-empty legacy `switch` and any orphaned helpers left in
  `scripts/agento.mjs`, keeping the shebang and the unchanged usage header. Fall
  through to `usage(command ? \`unknown command ${command}\` : "missing command")`
  for unknown or missing commands — verify: `wc -l scripts/agento.mjs` ≤ 200;
  `grep -c "^\s*case " scripts/agento.mjs` is 0; the full test command exits 0,
  ≥ 838 tests; `evidence/parity.sh` diff is empty (the unknown and missing
  command usage errors included), saved to `evidence/output-parity.txt`

## Phase 4: Split the test file

- [ ] 4.1 Move the shared fixtures (lines ~14–110 of `scripts/agento.test.mjs`:
  `makeRepo`, `cloneWithOrigin`, the roadmap/config writers, `runWith`, `baseEnv`,
  the `cli` path) to `scripts/test-helpers/agento-fixtures.mjs`. That module
  resolves `cli` from its own location as `scripts/agento.mjs`.
  `scripts/agento.test.mjs` imports them — verify: the full test command exits 0
  with the same total as Phase 3; `ls extension/cli` does not contain
  `test-helpers`
- [ ] 4.2 Move the `test(...)` blocks for release, migrate, harness, models,
  resolve, status, and doctor byte-for-byte into
  `scripts/commands/<module>.test.mjs`, importing from the fixtures module —
  verify: the full test command exits 0 with an unchanged total; no moved block
  differs except in imports (`git diff --stat -M` plus a spot check)
- [ ] 4.3 Move the remaining blocks: paths, session, publish, ship, and next go to
  their `scripts/commands/<module>.test.mjs`, and cross-command scenarios go to
  `scripts/commands/integration.test.mjs`. Delete the then-empty
  `scripts/agento.test.mjs` — verify: `test -e scripts/agento.test.mjs` fails;
  the full test command exits 0 with an unchanged total; the sorted TAP test names
  match the base exactly, saved as the final half of `evidence/test-names.txt`
- [ ] 4.4 Run the full test command three times in a row to check for
  parallel-file fixture collisions. Fix any collision only in
  `scripts/test-helpers/agento-fixtures.mjs` (unique temp roots or env), never in
  test bodies or the documented command — verify: three consecutive runs exit 0
  with 0 failures and identical totals, recorded on this line

## Phase 5: Layout guard and documentation

- [ ] 5.1 Add `tests/cli-layout.test.mjs` per plan.md Approach rule 8. It checks:
  - `scripts/agento.mjs` is at most 200 lines and declares no function besides
    the dispatcher.
  - `COMMAND_MODULES` ↔ the usage-header subcommands, both ways.
  - Each table entry's module exports that handler.
  - No `commands/` → `commands/` or `agento.mjs` import, and no `lib/` →
    `commands/` import.
  - No non-test module in `scripts/commands/` or `scripts/lib/` exceeds 1,500
    lines.

  — verify: `node --test tests/cli-layout.test.mjs` passes. Temporarily adding an
  unlisted command name to the usage header makes it fail (the change is
  reverted, not committed).
- [ ] 5.2 Update the docs per plan.md Approach rule 10:
  - AGENTS.md "Layout" `scripts/` bullet (dispatcher, `lib/`, `commands/`,
    `test-helpers/`, and the `extension/cli/` copy covering the subdirectories)
  - the `docs/architecture.md` "Scripts" paragraph
  - `.github/agents/copilot-mechanic.agent.md`: the edit scope names
    `scripts/agento.mjs`, `scripts/lib/`, and `scripts/commands/`, plus how to
    locate a subcommand's module via `COMMAND_MODULES`

  — verify: `node --test tests/customizations.test.mjs` passes; the changed
  paragraphs name the three paths

## Phase 6: Final verification

- [ ] 6.1 Run the complete gate on the integrated branch (after `agento.mjs sync`):
  - the full test command, three times: exit 0, 0 fail, ≥ 838 tests
  - `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`: exit 0, no
    findings (the same as the baseline)
  - all five guard-smoke replays from AGENTS.md "Commands": exit 0
  - `cd extension && npm run build && npm run test:unit && npm run test:electron &&
    npm run package` (with `assert-vsix`): exit 0
  - `evidence/parity.sh`: empty diff, refreshed in `evidence/output-parity.txt`

  — verify: every command above exits 0 with the stated counts, recorded on this
  line, and `git status --porcelain --untracked-files=all` is empty in both halves
