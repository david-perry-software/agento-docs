# Dashboard CLI: one `agento.mjs dashboard` spawn per extension refresh

## Problem

Every dashboard refresh in the VS Code extension spawns the CLI five-plus times:
`session --pr`, `doctor`, and `status --pr` in parallel, then `initiative` and one
`initiative <slug>` per initiative (`extension/src/extension.ts` L201–L290). Each
process re-runs the module-level bootstrap in `scripts/agento.mjs` (`anchorRoot()`
L131, `resolveArtifacts()` L189), re-reads `git worktree list --porcelain` (23 call
sites in the file), walks every roadmap again, and — under `--pr` — probes
`gh --version` before every `gh pr view`, serially, once per non-complete item and
again in the companion clone (`lookupPullRequest` L593, `lookupCompanionPullRequest`
L612, the `status` loop L1671). The initiative breakdown measured about 3.9 s of
process time per refresh on `main` with a 1.5 s critical path.

This feature is the `dashboard-cli` member of the
[agento-hardening](../../../../initiatives/2026/10/agento-hardening/breakdown.md)
initiative (`### dashboard-cli` block). It adds one additive subcommand,
`agento.mjs dashboard [--pr] [--plugin-root <dir>]`, that returns the session
record, the doctor report, the status document, and every initiative — list and
details — in one JSON document from one process, with the worktree list and primary
root computed once, the `gh` probe run once, and PR lookups executed concurrently.
The extension then refreshes with one spawn and keeps today's tree models and views
unchanged. The member also absorbs two recorded follow-ups: the shared `gh --version`
probe (`ship-dual-merge`, `mirrored-artifact-branches`) and the memoised primary-root
and worktree-list lookup (`artifact-repo-config` review).

User-visible effect: the Deliveries, Initiatives, Session & Doctor, and Window banner
views update from one consistent snapshot, sooner, with less CPU per refresh. No
existing CLI field, exit code, lifecycle rule, or command boundary changes.

## Decisions

Clarifying questions were asked with the ask-questions tool on 2026-10-09. Every
answer was the option marked recommended.

- **Q: How should the `dashboard` JSON nest the four sub-documents?** (The envelope
  already uses `status: "ok"` for the overall result, and the `status` subcommand's
  document would collide with that key.)
  A: **Named sections, status renamed to `deliveries`** (recommended) —
  `{ status, session, doctor, deliveries, initiatives: { list, details: { <slug>: … } },
  root, configSource }`; each section is byte-identical to its subcommand's output.
  Alternatives offered: under a `sections` object; flat merge.
- **Q: If one section throws (e.g. a doctor probe explodes) while the others succeed,
  what does `dashboard` return?**
  A: **Per-section status, document still exit 0** (recommended) — the failing
  section becomes `{ status: "error", message }`; the others render; the extension
  shows that view's error state only. Alternative offered: whole document fails
  (exit 3).
- **Q: How should `dashboard --pr` run the `gh pr view` lookups concurrently?**
  A: **Async `execFile` with a bounded pool, same per-branch semantics**
  (recommended) — promisified `child_process.execFile` with a small concurrency cap
  (e.g. 4); one `gh --version` probe; results identical to today's `gh pr view
  <branch>` per item. Alternatives offered: one batched `gh pr list --state all` per
  repo; keep serial and just share the probe.
- **Q: Should the extension keep the old multi-spawn refresh as a fallback?**
  A: **No fallback: one `dashboard --pr` spawn replaces both refresh runs**
  (recommended) — `extension/cli/` is a byte copy of `scripts/`, so the bundled CLI
  always has `dashboard`; the source-regex tests in `extensionIntegration.test.ts`
  are updated accordingly. Alternative offered: fall back to today's five calls when
  `dashboard` returns `usage-error`.
- **Q: What is the measurable acceptance for "one spawn and measurably faster"?**
  A: **Spawn count = 1 asserted in tests + timing evidence vs the breakdown's table**
  (recommended) — the Electron suite asserts exactly one `dashboard` call per
  refresh; the Builder records `dashboard --pr` wall time on this repository and
  requires it ≤ the slowest of today's three calls (≈1.5 s) with the sum of today's
  calls as the baseline. Alternatives offered: a hard numeric budget in a test;
  spawn count only.

## Research

Skills consulted: none — no matching domain. The repository has no `.agents/skills/`
directory and AGENTS.md has no `## Agento` skills table (verified 2026-10-09).

### Today's refresh path (extension)

- `extension/src/extension.ts` L201–L254: `scheduler.onDidRefresh` runs
  `latestDeliveryRefresh.run(...)` with `Promise.all([client.run(["session",
  "--pr"]), client.run(root ? ["doctor", "--plugin-root", root] : ["doctor"]),
  client.run(["status", "--pr"])])`, then builds `createDeliveryTreeModel(statusResult.json)`,
  `createSessionDoctorModel(session, doctor, status)`, and `windowGate(session)`.
- L255–L290: a second guard `latestInitiativeRefresh.run(...)` runs
  `client.run(["initiative"])`, then `Promise.all(initiativeSlugs(list).map(slug =>
  client.run(["initiative", slug])))`, each detail failure captured as an `Error` in
  the details map, then `createInitiativeTreeModel(list, new Map(details))`.
- `extension/src/cliClient.ts`: `CliClient.run(args, root, { timeoutMs })` spawns
  `node <cli> …args --root <root>` with a 30 s default timeout, accepts exit 0/1/3,
  and logs `cli: <args> -> exit <code> in <ms> ms` to the output channel.
- `extension/src/latestDeliveryRefresh.ts`: a generation counter that drops stale
  results; two instances exist today because the two refresh runs are independent.
- Models consume plain JSON: `createDeliveryTreeModel(value)`
  (`extension/src/deliveryTreeModel.ts` L250), `createInitiativeTreeModel(list,
  details)` and `initiativeSlugs(list)` (`extension/src/initiativeTreeModel.ts`
  L243, L305), `createSessionDoctorModel(session, doctor, status)`
  (`extension/src/sessionDoctorModel.ts` L164) which requires `session.status === "ok"`,
  `doctor.status` to be a string, and `status.status === "ok"`.
- Tests that pin the current shape: `extension/test/unit/extensionIntegration.test.ts`
  L59–L96 asserts the source contains `client.run(["session", "--pr"]`,
  `client.run(root ? ["doctor", "--plugin-root", root] : ["doctor"]`,
  `client.run(["status", "--pr"]`, `client.run(["initiative"]`,
  `client.run(["initiative", slug]`, `Promise.all(initiativeSlugs`, and
  `const latestInitiativeRefresh = new LatestDeliveryRefresh()`.
  `extension/test/electron/suite.ts` L951–L1000 stubs `api.client.run`, asserts
  `pending.length === 8` after two refreshes (4 spawns each), resolves batches by
  `request.args[0]` (`session` | `doctor` | `initiative` | status), and
  `refreshWithSession` (L1073) asserts `pending.length === start + 4`.
- The Electron scenarios (`extension/test/electron/runTest.ts`) run the real bundled
  CLI against generated fixtures with a `gh` stub on PATH that answers `--version`
  and prints a fixed PR per cwd (`*/artifacts` → 202, else 101).
- `extension/scripts/copy-cli.mjs` copies six `scripts/*.mjs` files into
  `extension/cli/`; `npm run build` runs it first. All six are byte-identical today
  (`cmp` on 2026-10-09).

### Today's CLI (scripts/agento.mjs, 2 237 lines)

- Bootstrap runs for every subcommand at module level: `anchorRoot(toplevel)` L131
  (a `git worktree list` on the cwd's toplevel, a `readdir` of the primary's parent,
  and a config parse per sibling checkout in the companion-anchor case),
  `loadAgentoConfig(root)`, `resolveArtifacts()` L189 (another `git worktree list`
  in companion mode), `companionWorktrees()` L211 (already memoised, companion clone).
- `git(root, "worktree", "list", "--porcelain")` is parsed afresh in `layoutFor`
  (L246), `resolveSessionPaths` (L350), `managedHalves` (L569 via
  `primaryWorktreesDir`), `sessionRecord` (L629), doctor checks `worktrees-dir`
  (L719), `session-workspace` (L731), `artifact-repo` (L767), `case "status"`
  (L1674), `case "initiative"` (L1853), `case "next"` (L1908), and several
  `start-session` sites (L1281, L1326, L1343, L1374–L1375) — the `start-session`
  reads after `git worktree add` must stay fresh. `primaryWorktreesDir(worktrees)`
  L619 re-derives the primary config each call.
- `lookupPullRequest(branch, { cwd, label })` L593 runs `execFileSync("gh",
  ["--version"])` then `gh pr view <branch> --json number,state,isDraft,mergeStateStatus,url`
  synchronously, 15 s timeout, every failure a warning. `lookupCompanionPullRequest`
  L612 repeats it in `layout.artifactsRoot`. `case "status"` L1687 loops over items
  serially; `sessionRecord` L635 does the product and companion lookups serially.
  `case "release"` L2208 runs its own `gh --version`. The doctor `gh` check L699
  probes `gh --version` and `gh auth status` (network).
- Output: `emit(result, code)` L50 writes one JSON document and calls
  `process.exit`; `withExit` L586 appends `root` and `configSource`. `case
  "status"`, `case "initiative"`, and `case "doctor"` build their documents inline
  in the `switch` (L1636) and emit immediately — they need to become functions that
  return the document so `dashboard` can compose them. `sessionRecord()` L627 already
  returns its record.
- `usage()` L45 prints header-comment lines `slice(1, 26)`; adding a `dashboard`
  line to the header means widening that slice.
- `--plugin-root` (L85) already exists for `doctor`'s `model-profile` check and
  `models`; the extension passes it on `doctor`.
- `once(fn)` L1547 is a memoiser already used by `releaseContext`.
- The module is ESM (`.mjs`); top-level `await` is available for an async
  `case "dashboard"`.

### Measurements on this repository (2026-10-09)

From the detached planning worktree (no delivery, no non-complete items):
`session --pr` 130 ms, `doctor` 1 421 ms, `status --pr` 93 ms, `initiative` 77 ms,
`initiative agento-hardening` 83 ms. The breakdown's table (measured from `main`
`4b38ce5` with in-flight deliveries) is 979 / 1 286 / 1 465 / 92 / 86 ms. `doctor`
dominates in both: its `git ls-remote` and `gh auth status` probes are network
round-trips run serially. A `dashboard` that composes the sections serially would
therefore be ≥ `doctor` alone; the design below starts those probes concurrently with
the PR lookups so the critical path is one network round-trip, not the sum.

### Test conventions

- `scripts/agento.test.mjs` (3 602 lines, 340 tests across the node suites) spawns
  the CLI with `run(cwd, ...args)` / `runWith({ cwd, env }, ...args)` (L69–L91)
  against `makeRepo({ config, companion })` fixtures (a clone with a bare origin;
  `companion: true` adds a sibling `project-docs` clone), `writeRoadmap`,
  `writeBreakdown`, and `makeWorktreeRepo`. `restrictedPath({ gh: script })` L93
  builds a PATH holding only `node`, `git`, and the given stubs; `prStub(marker,
  …)` L1845 is the `gh` stub that logs `$PWD $*` for `pr view` calls (it exits on
  `--version` before logging, so a probe-counting test needs a variant that logs
  `--version` too). A `git` wrapper that logs its arguments and execs the real binary
  can be installed the same way to count `worktree list --porcelain` calls.
- Extension unit tests live in `extension/test/unit/*.test.ts` (155 pass today) and
  the Electron suite in `extension/test/electron/suite.ts` (four scenarios: in-repo,
  companion, workspace, no-markdown).

### Documentation that enumerates subcommands or the refresh

- `docs/commands.md` L28–L205: the prose list of every `agento.mjs` subcommand and
  the exit-code paragraph.
- `AGENTS.md` L18–L21: the `scripts/` bullet lists the CLI subcommands.
- `extension/README.md` L15, L28, L44–L54: the Deliveries, Initiatives, and Session &
  Doctor sections name `status --pr`, `initiative`, `session --pr`, `doctor`.
- `docs/extension.md` L173–L179 "Refresh and recovery".
- `CHANGELOG.md` `## Unreleased` (L3).
- `tests/customizations.test.mjs` L499 checks that every slash command is in
  `docs/commands.md`; it does not enumerate CLI subcommands, so no test change is
  forced by the docs edit.

### Lint baseline (policy §5)

- Full-repository shell lint on 2026-10-09 at `origin/main` `1377a18`:
  `git ls-files '*.sh' | xargs pnpm dlx shellcheck` → exit 0, no findings, over
  `scripts/hooks/delivery-guard.sh`, `scripts/hooks/replay-guard.sh`,
  `scripts/hooks/session-context.sh`, `scripts/wait-for-checks.sh` (the system
  `shellcheck` binary is not installed on this machine; `pnpm dlx` is the route the
  previous deliveries used, and CI runs the same files).
- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → exit 0, 340/340.
- `cd extension && npm ci && npm run build && npm run test:unit` → exit 0, 155/155.
- The baseline is green, so the **normal full gate** applies: every verification
  step reruns the full repository lint and compares against zero findings; no scoped
  gate is needed. This delivery adds no shell files.

### Concurrent deliveries

`gh pr list --state open` returned `[]` in both `david-perry-software/agento` and
`david-perry-software/agento-docs` on 2026-10-09. The initiative's other wave-1
member, `followup-debt-batch`, is unplanned but may start concurrently; it edits
`scripts/agento.mjs` (`paths`), `scripts/agento.test.mjs`, `docs/commands.md`, and
`CHANGELOG.md` — all files this plan touches. See `## Risks`.

### Observed, not fixed

`agento.mjs paths feature dashboard-cli` from this planning worktree reports
`artifactRoot: /home/david/DP/agento-docs/features` (the companion clone) rather than
the companion half of this session. That is the `paths` follow-up assigned to
`followup-debt-batch`; the artifacts for this plan were written to the companion half
(`companion.path` in the session record) as the Planner procedure requires.

## Approach

All CLI changes are additive and land in `scripts/agento.mjs` (then `npm run
copy-cli`). Existing subcommands keep their fields, ordering, and exit codes.

1. **Memoise the product worktree list and primary root.** Add a module-level
   `productWorktrees({ fresh = false })` that parses `git worktree list --porcelain`
   for `root` once (seeded from `anchorRoot`'s own read when `dir` is `root`) and a
   memoised `primaryWorktreesDir()` keyed on that list. Replace every read-only call
   site (`layoutFor`, `resolveArtifacts`, `resolveSessionPaths`, `managedHalves`,
   `sessionRecord`, the three doctor checks, `status`, `initiative`, `next`, and
   `start-session`'s pre-mutation reads). `start-session`'s reads after `git worktree
   add` call `productWorktrees({ fresh: true })`, which refreshes the cache. The
   companion list already has `companionWorktrees()`.
2. **Share the `gh` probe.** One memoised `ghVersion()` (`once(() => probe("gh",
   ["--version"]))`) backs `lookupPullRequest`, the doctor `gh` check, and
   `release`. Behaviour per call is unchanged; the probe runs at most once per
   process.
3. **Extract document builders.** Move the bodies of `case "status"`, `case
   "initiative"` (list and detail), and `case "doctor"` into functions that return
   the exact document each case emits today (`statusDocument({ typeFilter,
   slugFilter, pr, lookup })`, `initiativeListDocument(roadmaps)`,
   `initiativeDetailDocument(slug, roadmaps)`, `doctorDocument(ids)`), and give
   `sessionRecord` and `statusDocument` an injectable `lookup(branch, { cwd, label })`
   defaulting to today's `lookupPullRequest`. The cases become one-line emits.
4. **Bounded concurrency.** Add a small pool (`runPool(tasks, limit = 4)`) over a
   promisified `execFile`. Two users: `lookupPullRequests(requests)` — deduplicated
   `{ cwd, branch, label }` requests resolved to a `Map` keyed by `cwd` + `branch`,
   each result identical in shape to `lookupPullRequest`'s `{ pr, warnings }` — and
   `prewarmProbes()`, which runs the doctor's external probes (`gh --version`, `gh
   auth status`, `git ls-remote … origin <default>`, `code --version`, `python3
   --version`) concurrently and fills a per-process `probe` cache keyed by command
   and arguments, so the synchronous doctor checks then hit the cache.
5. **`case "dashboard"`** (top-level `await`): compute the worktree list and roadmaps
   once; collect the PR lookups the session record and the status items need (the
   session's `delivery?.branch ?? worktree.branch`, every non-complete item's branch,
   each in the product clone and, in companion mode, the companion clone); run them
   with `prewarmProbes()` in the same pool when `--pr` is given (no `gh` process
   without `--pr`, as today); then build the sections with the prefetched lookup.
   Output `{ status: "ok", session, doctor, deliveries, initiatives: { list,
   details: { <slug>: <detail document> } }, timings: { session, doctor,
   deliveries, initiatives, total } (ms), root, configSource }`, exit 0. Each section
   is built inside a try/catch; a thrown section becomes `{ status: "error",
   message: <error message> }` and the others are unaffected. `--plugin-root` is
   forwarded to the doctor section's `model-profile` check exactly as `doctor`
   does. The usage header gains the `dashboard` line and `usage()`'s slice widens.
6. **Extension cutover.** New pure module `extension/src/dashboardDocument.ts`:
   `splitDashboardDocument(json)` validates the envelope and returns `{ session,
   doctor, deliveries, initiatives: { list, details: ReadonlyMap<string, unknown> } }`,
   where a section carrying `status: "error"` is returned as an `Error(message)` so
   the view-specific error creators (`createDeliveryTreeError`,
   `createSessionDoctorError`, `createInitiativeTreeError`) render it. `extension.ts`
   runs one `client.run(["dashboard", "--pr", ...(root ? ["--plugin-root", root] :
   [])])` per refresh under a single `LatestDeliveryRefresh`, applies all four views
   (Deliveries, Session & Doctor, status bar/banner via the existing
   `applySessionIndicators`, Initiatives, and the window gate) from that one
   snapshot, logs the CLI `timings` line to the output channel, and drops the
   second refresh guard. Tree models are unchanged.
7. **Tests.** CLI: `dashboard` sections deep-equal the standalone subcommand outputs
   (`timings` excluded) in in-repo and companion fixtures; `--pr` runs `gh
   --version` once and `gh pr view` once per distinct `(cwd, branch)`; without `--pr`
   no `gh` runs; `worktree list --porcelain` runs once per clone from a product cwd;
   a section failure (one roadmap made unreadable with `chmod 000`, skipped when
   running as root) yields `deliveries.status === "error"` with the doctor section
   intact and exit 0; `--plugin-root` reaches the doctor section. Extension:
   `dashboardDocument` unit tests (valid, per-section error, malformed envelope);
   `extensionIntegration.test.ts` regexes updated to the single `dashboard` spawn
   and the removal of `latestInitiativeRefresh`; Electron suite asserts
   `pending.length === 2` after two refreshes and resolves each request with a
   dashboard document (`refreshWithSession` asserts `start + 1`).
8. **Docs and evidence.** `docs/commands.md`, `AGENTS.md`, `extension/README.md`,
   `docs/extension.md`, `CHANGELOG.md`. Timing evidence recorded in
   `evidence/timings.md` in this slug directory: three runs each of the five
   standalone calls and of `dashboard --pr`, from the product primary on `main`
   state and from the build worktree, with the breakdown's table beside them.

Expected product files: `scripts/agento.mjs`, `scripts/agento.test.mjs`,
`extension/cli/*` (generated), `extension/src/extension.ts`,
`extension/src/dashboardDocument.ts` (new), `extension/test/unit/dashboardDocument.test.ts`
(new), `extension/test/unit/extensionIntegration.test.ts`,
`extension/test/electron/suite.ts`, `extension/README.md`, `docs/commands.md`,
`docs/extension.md`, `AGENTS.md`, `CHANGELOG.md`. No prompt, agent, hook, or
instruction file changes.

## Risks

- **`doctor`'s network probes bound the critical path.** `git ls-remote` and `gh auth
  status` take ~1.3 s serially here; a serial `dashboard` could not beat today's
  slowest call. *Mitigation:* `prewarmProbes()` runs them concurrently with the PR
  lookups (approach step 4); the Builder measures after step 2.2 and, if the target
  (≤ slowest standalone call) is still missed, records the numbers in
  `evidence/timings.md` and adds a `(added <date>)` step rather than silently
  shipping a slower refresh.
- **Refactoring 23 `git worktree list` call sites.** A stale cache after
  `start-session`'s `git worktree add` would misreport the new half. *Mitigation:*
  only read-only sites use the cache; post-mutation reads call `productWorktrees({
  fresh: true })`; the existing `start-session` tests (created, resumed, post-add
  check) must stay green, and a new test counts the list calls.
- **Deduplicating PR lookups changes call counts, not results.** When the session
  branch equals a status item's branch, `dashboard --pr` runs one `gh pr view` where
  the two standalone commands ran two. *Mitigation:* the deep-equality test compares
  section content, and the call-count test documents the deduplicated count.
- **`chmod 000` section-failure test is skipped as root.** CI runners are non-root;
  the test guards on `process.getuid?.() !== 0`.
- **Concurrent delivery (`followup-debt-batch`, wave 1).** Shared files:
  `scripts/agento.mjs`, `scripts/agento.test.mjs`, `docs/commands.md`,
  `CHANGELOG.md`. *Mitigation:* integrate `origin/main` by merge in both halves before
  every push; keep edits to `paths` out of this branch; append (never reorder)
  `CHANGELOG.md` and `docs/commands.md` entries.
- **Electron suite timing.** The suite's stubbed `client.run` and the real-CLI
  scenarios both change shape. *Mitigation:* the dashboard fixture helper composes
  the existing `sessionResponse`, `doctorResponse`, and `statusResponse` fixtures;
  waits stay on provider events as today.
- **No `(manual)` or post-ship steps.** Everything is CLI- or test-driven.

## Out of scope

- The `metrics` subcommand and the Timeline row (`delivery-metrics`, which requires
  this member).
- Changing any existing subcommand's fields, ordering, or exit codes; removing the
  standalone `session`, `doctor`, `status`, or `initiative` subcommands.
- A fallback to the multi-spawn refresh; batched `gh pr list` lookups.
- The `paths` worktrees-dir fix, prompt wording, `models` vendor warnings, and the
  other `followup-debt-batch` items.
- Hooks, prompts, agents, instructions, and `commands/*.md` mirrors.
- Making the doctor checks themselves asynchronous beyond the probe prewarm.

## Acceptance checklist

- [ ] `node scripts/agento.mjs dashboard` exits 0 and returns `{ status: "ok",
      session, doctor, deliveries, initiatives: { list, details }, timings, root,
      configSource }`; in both an in-repo and a companion fixture, `session`,
      `doctor`, `deliveries`, `initiatives.list`, and each `initiatives.details[slug]`
      deep-equal the standalone `session [--pr]`, `doctor`, `status [--pr]`,
      `initiative`, and `initiative <slug>` outputs run in the same state — verified
      by `scripts/agento.test.mjs` tests.
- [ ] Without `--pr` no `gh` process runs during `dashboard`; with `--pr`, `gh
      --version` runs exactly once and `gh pr view` runs exactly once per distinct
      `(clone, branch)` across the session record and every non-complete status item
      (companion clone included in companion mode) — verified by a logging `gh` stub
      in `scripts/agento.test.mjs`.
- [ ] From a product checkout cwd, `dashboard` runs `git worktree list --porcelain`
      once for the product clone and once for the companion clone; `session`,
      `status --pr`, and `initiative` each do the same — verified by a logging `git`
      wrapper in `scripts/agento.test.mjs`.
- [ ] A section that throws becomes `{ status: "error", message }` while the other
      sections and the exit code (0) are unaffected — verified by the unreadable-
      roadmap test (skipped as root).
- [ ] `dashboard --plugin-root <dir>` applies `<dir>` to the doctor section's
      `model-profile` check exactly as `doctor --plugin-root <dir>` does — verified by
      a test comparing the two check results.
- [ ] Existing subcommands are unchanged: every pre-existing test in
      `scripts/agento.test.mjs`, `scripts/*.test.mjs`, and `tests/*.test.mjs` passes
      without modification of its assertions (`node --test 'scripts/**/*.test.mjs'
      'tests/**/*.test.mjs'`, 0 failures).
- [ ] `extension/src/extension.ts` spawns the CLI exactly once per refresh with
      `["dashboard", "--pr", …]` and no longer runs `session`, `doctor`, `status`, or
      `initiative` on refresh — verified by `extensionIntegration.test.ts` source
      assertions and by the Electron suite asserting `pending.length === 2` after two
      refreshes and `start + 1` per further refresh.
- [ ] All four views (Deliveries, Initiatives, Session & Doctor incl. status bar and
      window banner, window gate) render the same data as before from the one
      snapshot, and a per-section `status: "error"` renders only that view's error
      state — verified by `dashboardDocument.test.ts` and the Electron suite
      (`local:3165/4165 — cd extension && npm run test:electron`, all four scenarios).
- [ ] `evidence/timings.md` records three runs each of today's five standalone calls
      and of `dashboard --pr` on this repository, and `dashboard --pr`'s median is ≤
      the slowest standalone call's median and ≤ the sum of the five — verified by the
      Reviewer re-running the measurement.
- [ ] `docs/commands.md`, `AGENTS.md`, `extension/README.md`, `docs/extension.md`,
      and `CHANGELOG.md` describe `dashboard` and the single-spawn refresh — verified
      by `grep -n "dashboard" <file>` on each and `node --test
      tests/customizations.test.mjs` passing.
- [ ] `extension/cli/*.mjs` are byte-identical to `scripts/*.mjs` (`cmp` on each of
      the six files) after the final `npm run copy-cli`.
- [ ] Full gate green: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`;
      `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt`;
      `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt`;
      `git ls-files '*.sh' | xargs pnpm dlx shellcheck` (or system `shellcheck`) with
      zero findings matching the recorded baseline; `cd extension && npm run build &&
      npm run test:unit && npm run test:electron && npm run package` — all exit 0.
