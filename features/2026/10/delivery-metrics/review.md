# Review: delivery-metrics

Verdict: approve

Round 2, 2026-10-10. Re-review of the current head after a post-approval code change:
product `feature/delivery-metrics` at `eada205` (code PR
david-perry-software/agento#106, open, ready — state untouched) and companion at
`3508eb6` (agento-docs#43). Round 1 (approve) judged product `716df11` / companion
`fcdd64d`; the delta since then is roadmap step 4.3 (added 2026-10-10): product
`eada205` "fix(metrics): serialize timestamps timezone-independently (step 4.3)"
(5 files: `scripts/delivery-metrics.mjs`, `extension/cli/delivery-metrics.mjs`,
`scripts/delivery-metrics.test.mjs`, `scripts/agento.test.mjs`, `docs/commands.md`)
and companion `3508eb6` (the 4.3 roadmap line). It fixes CI run 38088883739
(`test` failed on `716df11`: git 2.55.0 renders a UTC `%cI` as `Z`, the fixture
expected git 2.43.0's `+00:00`). CI `test` on `eada205` is SUCCESS (run
38105481634, `gh pr checks 106` → `test pass 2m31s`). `origin/main` (product
`49e3617`, companion `20ccd21`) is an ancestor of both halves; both trees were clean
before and after the review. Skills consulted: none — no matching domain (no
`.agents/skills/`, no `## Agento` skills table in AGENTS.md; same as plan.md
`## Research`).

## Round 2: the step 4.3 change

- **Normalization is correct.** `canonicalTime(at)` =
  `new Date(Date.parse(at)).toISOString()` with the `.mmm` stripped, applied to every
  commit's `at` in `parseArtifactLog` and every merge `at` in `parseMergeLog`; every
  event, phase, cycle, `lastTickAt`, and `merged.at` derives from those, and the
  invalid/empty guards (`!at || Number.isNaN(Date.parse(at))`) run *before* the
  call, so `toISOString()` can never throw. Probed directly under
  `TZ=America/New_York`, `UTC`, and `Pacific/Kiritimati` (+14:00), with identical
  output each time: `2026-12-31T23:30:00-05:00` → `2027-01-01T04:30:00Z` (crosses a
  day and a year), `2027-01-01T01:15:00+14:00` → `2026-12-31T11:15:00Z` (goes back
  one day), `…10:00:00.999Z` → `…10:00:00Z` and `…10:00:00.5+02:00` → `…08:00:00Z`
  (sub-second input truncates toward the second), `""` and `not-a-date` skipped, and
  merge lines with an empty or garbage date skipped. Ordering and the earliest-merge
  comparison still use `Date.parse`, so they compare instants, not strings.
  Durations are unchanged because offsets never changed the instants.
- **Live document.** `node scripts/agento.mjs metrics` → `ok`, 56 items, 696 item
  timestamps, 0 not matching `^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$`;
  `generatedAt` (not git-derived, keeps its milliseconds) is the only other
  timestamp. `artifact-history-migration` `merged.at` is `2026-09-18T20:07:21Z`,
  the same instant the round-1 screenshot rendered as `16:07 -04:00`.
- **Bundle byte-identical.** `cmp` of every non-test `scripts/*.mjs` against
  `extension/cli/` printed nothing; the sets of bundled and source modules are equal
  (8 files, `diff` exit 0).
- **No extension code or test depends on the raw offset.**
  `git diff 716df11 eada205 -- extension/src extension/test extension/package.json`
  is empty. `formatTimestamp()` (`extension/src/deliveryTimeline.ts`) already
  accepted both `Z` and `±HH:MM` and renders `Z` as `+00:00`; the unit tests feed it
  both forms (`deliveryTimeline.test.ts` uses `+00:00`, `-04:00`, and `Z`
  fixtures), and the Electron live-CLI assertion
  (`extension/test/electron/suite.ts` L757) matches `Planned: .*` etc. without an
  offset. The injected Electron fixture (L1247) uses `+00:00` and is fed straight
  to the presentation layer, so it is unaffected.
- **Tooltip now shows UTC instead of the committer's offset — acceptable.** plan.md
  `## Approach` item 4 specifies tooltip lines `Planned: <start> → <end> (<d>)` and
  `Merged: <at> (PR #n)` with no zone requirement, and `## Risks` "Clock semantics"
  only needs the timestamps shown "so a surprising number can be checked" — an
  explicit `+00:00` instant still allows that, and every line of one tooltip now
  shares a single zone (before, a tooltip could mix the committer offsets of
  different commits). See Finding 3 for the documentation gap.

## Acceptance checklist results

Items 3–9 were scored in round 1 against `716df11`; the round-2 delta touches none
of the code they depend on beyond the timestamp serialization, and the suites that
verify them were re-run on `eada205` (item 11).

1. **`metrics` document, slug filter, missing slug — pass.** Round 2: `metrics` →
   `ok`, 56 items, all timestamps canonical (above). Round 1: `node scripts/agento.mjs
   metrics` → exit 0, `status: ok`, 56 items, `ref: {"artifacts":"origin/main",
   "product":"origin/main"}`, `aggregate.count` 56; `dashboard --pr` lists the same 56
   (`deliveries.items.length` 56). `metrics delivery-metrics` → 1 item, `ref:
   origin/feature/delivery-metrics`; `metrics no-such-slug` → exit 3; `metrics a b` →
   exit 1 usage error; `metrics ../x` → `usage-error` (slug pattern). Fixture test
   "metrics derives phases, rounds, pauses, the merge, and post-ship latency from
   fixed-date history in both layouts" passes.
2. **Item fields and exact seconds — pass.** `scripts/delivery-metrics.test.mjs` 14/14
   on `eada205` (round 1: 13; +"timestamps serialize as UTC `Z` whatever offset or
   git version rendered %cI", covering `+00:00`, `Z`, `+02:00`, `-04:00`, `+05:30`)
   (full lifecycle 3600/86400/7200/97200 s, pause, open pause, rounds, post-ship
   latency 5400 s, direct `in-progress`, missing `in-review`, reopened delivery,
   dedupe, quoted values/deleted files, merge-log parsing, no history, aggregate
   medians) and the CLI fixture test assert every field from fixed commit dates.
   Real-history cross-checks: `dashboard-cli` `merged.pr` 101, `ship-cli` 105;
   `pr-cross-linking-deprecation` `reviewRounds` 4 equals its four review.md commits
   leaving `Verdict: request-changes` (`6d8ecb4`, `8564b1b`, `b5b2a3f`, `52d7cd7`);
   this delivery's events (planned 17:11:38 → in-progress 17:14:08 → paused 17:52:56
   → in-progress 18:31:21 → in-review 18:31:55) give `pauses {count 1, seconds 2305}`
   and an open review phase.
3. **No `gh`, git log only — pass.** "metrics never invokes gh and reads history only
   through git log in the artifacts and product clones" and the extended worktree-list
   logging test pass; `scripts/delivery-metrics.mjs` imports only `node:path`;
   `agento.mjs` spawns `git` through `execFileSync`/`execAsync` argument arrays.
4. **Dashboard section — pass.** `assertDashboardMatches` now checks the `metrics`
   key, `timings.metrics`, deep-equality with standalone `metrics` (modulo
   `generatedAt`/open seconds) and item order in both layouts, with and without
   `--pr`; the `chmod 000` case asserts `metrics.status: "error"` with the other
   sections intact. Real run: `metrics.status ok`, 56 items, `timings.metrics` 14 ms.
5. **Dashboard budget — pass.** [evidence/timings.md](evidence/timings.md): primary
   1037 ms ≤ 1122 ms, build worktree 832 ms ≤ 1305 ms. Re-measured once from this
   worktree: `dashboard --pr` 0.778 s wall, `timings.total` 719 ms.
6. **Collapsible rows with a Timeline child; `unavailable` on error — pass.**
   `npm run test:unit` 167/167 (incl. `deliveryTimeline.test.ts` 5 cases and the
   model test); `npm run test:electron` exit 0, 4/4 scenarios (in-repo, companion,
   workspace, no-markdown) asserting `Collapsed`, unique `agento:` ids, the
   `agento.openRoadmap` click, one `Timeline` leaf (`history`, `None`, no command,
   `agento.timeline`), the fixture description/tooltip, and `unavailable` /
   `fixture git log failed` on a metrics-section error with Deliveries still `ready`.
7. **Start collapsed, keep expansion — pass.** Ids come from
   `treeId("deliveries", "delivery", item.roadmap)` (per-activation nonce scope,
   `extension/src/deliveryTreeProvider.ts`); Electron asserts state and id uniqueness.
8. **One `dashboard --pr` spawn — pass.** `extensionIntegration.test.ts` asserts
   `createTimelineRows(` in the refresh and a single `client.run(`; the diff of
   `extension/src/extension.ts` adds no spawn.
9. **Docs — pass.** `grep -c metrics`: docs/commands.md 8, AGENTS.md 2,
   CHANGELOG.md 5; `grep -ci timeline`: docs/extension.md 4, extension/README.md 1,
   CHANGELOG.md 2; `tests/customizations.test.mjs` passes inside the full run.
10. **Bundle byte-identical — pass.** Re-checked on `eada205`: `cmp` of every
    non-test `scripts/*.mjs` against `extension/cli/` printed nothing; `extension/cli/` lists `delivery-metrics.mjs`;
    `tests/extension-bundle.test.mjs` 4/4; the packaged VSIX contains
    `extension/cli/delivery-metrics.mjs` and `extension/out/deliveryTimeline.js`.
11. **Full gate vs baseline — pass.** Round 2 on `eada205`, each run wrapped so the
    shell stayed at 0 with the status captured: `node --test 'scripts/**/*.test.mjs'
    'tests/**/*.test.mjs'` 436 pass / 0 fail / 0 cancelled / 0 skipped under the
    default TZ (America/New_York) and again under `TZ=UTC` (baseline 420 + 16 new);
    the metrics-related subset (`--test-name-pattern` over
    `scripts/delivery-metrics.test.mjs` and `scripts/agento.test.mjs`) 37/37 under
    `Asia/Kolkata` (+05:30), `Pacific/Kiritimati` (+14:00), and `Pacific/Pago_Pago`
    (−11:00); `cd extension && npm run test:unit` exit 0, 167/167; both guard
    replays exit 0; CI `test` SUCCESS on `eada205` (git 2.55.0). Not re-run in
    round 2: shellcheck (no `.sh` changed since round 1), `test:electron` and
    `package` (no `extension/src`, `extension/test`, or manifest change since round
    1; the only bundled change is the byte-identical `extension/cli/delivery-metrics.mjs`,
    whose loadability `tests/extension-bundle.test.mjs` covers in the full run).
    Round 1: `git ls-files '*.sh' | xargs pnpm dlx
    shellcheck` exit 0, no output (= baseline); `node --test 'scripts/**/*.test.mjs'
    'tests/**/*.test.mjs'` exit 0, 435 pass / 0 fail / 0 skipped (baseline 420 + 15
    new); both guard replays exit 0; extension `typecheck` 0, `build` 0, `test:unit`
    0 (167, baseline 160), `test:electron` 0 (4/4 = baseline), `package` 0. The VSIX
    byproduct was deleted afterwards.
12. **Real-window screenshot — pass.**
    [evidence/step-3-7-timeline-row.png](evidence/step-3-7-timeline-row.png) shows
    the expanded `artifact-history-migration` row, its `Timeline` child (`build 24m ·
    review 35m · …`, `history` icon), the tooltip (Planned none, Build, Review, Cycle,
    rounds 0, pauses 0, Merged 2026-09-18 16:07 -04:00 (PR #45), Post-ship 1/1
    latency 1h 12m, Source origin/main), and the roadmap opened from the label. No
    secrets visible (only a private LAN IP in the OS bar). The screenshot predates
    step 4.3, so its `Merged` line shows `16:07 -04:00` where the current build
    renders `20:07 +00:00` (same instant); it still evidences what the item asks —
    the real row, its child, and its tooltip lines — and need not be retaken. The
    real VS Code window was not re-driven by the Reviewer; the Electron suite covers
    the same tree API.

## Plan vs implementation

The implementation follows `## Approach` items 1–6. Deviations, all recorded by the
Builder on the step lines and judged sound:

- **Review rounds count every review.md commit leaving `request-changes`** (step
  2.1). Under `--unified=0` a re-review that keeps the same verdict shows no
  `+Verdict:` line, so the module carries the dir's last verdict to every review.md
  commit. This matches plan.md Q1 ("review.md commits whose verdict is
  request-changes") and the real `pr-cross-linking-deprecation` history (4 = 4).
  Trade-off: two review.md commits in one round would count twice (Follow-up 2).
- **Reopened deliveries measure to the final `complete` run** (step 2.2) instead of
  the first `complete` the plan named; without it `pr-cross-linking-deprecation`'s
  cycle would end before its build. Covered by the "reopened delivery" unit case
  and documented in docs/commands.md.
- **`delivery-metrics.mjs` joins `extension/scripts/copy-cli.mjs` and
  `tests/extension-bundle.test.mjs`** (step 2.2) — required, since `agento.mjs` now
  imports it and the bundled CLI would otherwise fail to load; verified in the VSIX.
- **Timeline `cycle <d>` fallback** (step 3.1) — a history with events but no phases
  reads `cycle <d>` instead of `no phases`. Documented in docs/extension.md and
  asserted by unit and Electron tests; see Finding 1 for its effect on imported
  histories.
- Also recorded: `--no-color --no-ext-diff --no-renames` and fixed prefixes on the
  patch log, a 256 MB `maxBuffer`, `TimelineLookup` instead of `ReadonlyMap`, and
  `timeline: null` in `initiativeMemberActions.test.ts` literals — all hardening or
  type plumbing within scope.
- **Canonical UTC timestamps** (step 4.3, round 2) — plan.md's item-document
  example shows `"at": "2026-10-01T10:00:00+00:00"`, i.e. git's raw `%cI`; the
  CLI now emits `YYYY-MM-DDTHH:MM:SSZ` for every git-derived timestamp, which
  docs/commands.md now states as the contract. The example was illustrative (no
  acceptance item pins an offset form), and the change is what makes the fixture
  assertions git-version-independent; judged sound.

No undocumented changes: `git diff --stat origin/main...HEAD` is 24 files (1703+/50−),
all in the plan's affected list plus the recorded repairs; nothing under
`scripts/hooks/`, `.github/`, `commands/`, or `hooks/`. The round-2 delta is the 5
files named above.

## Roadmap audit

All 18 steps are ticked and the header reads `status: complete`, `next-step: ""`,
`artifact-pr: "#43"` — kept as is (the `complete` transition is the ship commit
`1aa2fb7`, made before the CI failure that 4.3 fixes). Each step was spot-checked
against the code, tests, and evidence. No falsely ticked boxes, no missing steps,
no repairs made.

- 4.3 (round 2) is a proper `(added 2026-10-10)` step: it names the failing run,
  the root cause, the fix, and its results; it is CLI-verifiable, not `(manual)`, so
  its evidence is the recorded command results, all re-run here (436/436 under the
  default TZ and `TZ=UTC`; `test:unit` 167/167; `cmp` empty) plus CI run
  38105481634. It follows the two-commit rule: product `eada205` + companion
  `3508eb6`, both naming the step; `session` showed `companion.dirty: false`,
  `ahead: 0` before this review.
- 2.2's verify expected `phases.planned.open: true` for this delivery; the Builder
  recorded why it was closed (the resume had already committed `in-progress`) —
  confirmed from the events listed above.
- 2.6's `cmp` loop skips `scripts/*.test.mjs` (never bundled); re-run here with the
  same filter, empty output.
- 3.7 (manual) links its evidence file, which exists and shows what the step asks.
- 4.1 ran before 3.7 at the user's direction; 3.7 changed no code and the gate was
  re-run here with identical results.
- History simplification check: `git log origin/main --no-merges` over the four
  roadmap/review pathspecs lists 668 commits with and without `--full-history`, so
  the default walk drops no transitions on this repository.

## Findings

1. **Minor — `cycle <1m` on imported histories reads as a real duration.** 17 of 56
   real deliveries (e.g. `canonical-commands`, `ship-dual-merge`) have a single
   `status: complete` event from the `docs(migration): import delivery artifacts`
   commit `d9a0dfc`, so `cycle.seconds` is 0 and the Timeline description shows
   `cycle <1m` (`extension/src/deliveryTimeline.ts`, the `parts.length === 0 &&
   cycle` fallback). The tooltip does carry `Warning: no in-progress transition` /
   `no in-review transition`, and the behaviour is documented, so this is not
   blocking; plan.md `## Risks` preferred omitting parts over a guessed number.
   Suggest showing the cycle fallback only for a non-zero or warning-free cycle and
   `no phases` otherwise.
2. **Info — round counting is commit-granular.** `scripts/delivery-metrics.mjs`
   `parseArtifactLog` emits one `review` event per review.md commit, so a reviewer
   who commits review.md twice in one round inflates `reviewRounds`. Agento's own
   Reviewer commits once per verdict, and the rule is documented in
   docs/commands.md; noted for adopters.
3. **Info — the Timeline tooltip's zone change is undocumented in the extension
   docs** (round 2). After step 4.3 every tooltip timestamp renders as `+00:00`
   (UTC) where it previously showed each committer's own offset. docs/commands.md
   states the CLI form, but docs/extension.md's Timeline subsection and
   extension/README.md ("with every timestamp in the tooltip") do not say the times
   are UTC. Judged acceptable against plan.md (above); a one-phrase note would
   prevent a local-time misreading.
4. **Info — `canonicalTime` is lenient beyond what git emits** (round 2,
   `scripts/delivery-metrics.mjs` `canonicalTime`). It accepts anything
   `Date.parse` accepts: an offset-less ISO string would be read in the process's
   local zone (probe: `2026-10-01T10:00:00` → `14:00:00Z` under New York, `10:00Z`
   under UTC, `2026-09-30T20:00:00Z` under Kiritimati), calendar overflow rolls over
   (`2026-02-30` → `2026-03-02`), and fractions truncate. None of these is reachable
   from the inputs the CLI feeds it — `%cI` always carries seconds and an offset
   (`Z` or `±HH:MM`) — so no action is needed; noted in case the parsers are ever
   fed other text.
5. **Info — out of this delivery's diff: the session record reports
   `lifecycle: shipped` while both PRs are open.** `agento.mjs session --pr` →
   `lifecycle: shipped`, `pr` #106 `OPEN`, `companionPr` #43 `OPEN`, and the
   `elsewhere[]` reason "the delivery is merged". That is because ship committed
   `status: complete` (`1aa2fb7`) before its merge, and the merge never ran because
   of the CI failure 4.3 fixes. `scripts/session-state.mjs` is untouched by this
   delivery (`git diff origin/main...HEAD -- scripts/session-state.mjs` is empty),
   so this is a Follow-up, not a blocker; re-sending `/agento ship delivery-metrics`
   from the primary window is still the right next step.
6. **Security — no issues.** Round 2: `canonicalTime` is a pure transform of
   already-validated strings (no new process, path, or eval). Round 1: Git is
   spawned with argument arrays (`execFileSync` / promisified `execFile`), never a
   shell; the slug argument passes `requireSlug`;
   refs come from `refFor()` (`rev-parse --verify` on `refs/remotes/origin/<b>` /
   `refs/heads/<b>`) and paths from the roadmap walk, all after `--`-separated
   options. The parser treats log text as data (regex matches, no eval). Tree item
   `tooltip`/`description` are plain strings, not `MarkdownString`, so roadmap- or
   commit-derived text cannot inject markup or command links; tree ids are the
   roadmap path under the existing per-activation `treeId` scope.

## Follow-ups

- Timeline: render `no phases` (not `cycle <1m`) when the only history is a single
  import/squash commit, keyed off the item's warnings or a zero-second cycle
  (Finding 1).
- `metrics`: consider counting review rounds per verdict *transition into*
  `request-changes` plus re-reviews separated by a roadmap status change, so
  incidental review.md edits in one round do not inflate the count (Finding 2).
- docs/extension.md Timeline subsection and extension/README.md: say the tooltip
  times are UTC (Finding 3); optionally align the extension test fixtures and the
  plan's item-document example with the canonical `…Z` form.
- `scripts/session-state.mjs`: derive `shipped` from a merged code PR (when
  `--pr` knows the PR is open) rather than from `status: complete` alone, so a
  ship interrupted between the `complete` commit and the merge reads as
  in-progress shipping instead of "the delivery is merged" (Finding 5).
