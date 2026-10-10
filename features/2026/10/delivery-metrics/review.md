# Review: delivery-metrics

Verdict: approve

Round 1, 2026-10-10. Reviewed product `feature/delivery-metrics` at `716df11` (code PR
david-perry-software/agento#106) and companion `feature/delivery-metrics` at
`fcdd64d` (agento-docs#43). `origin/main` (product `49e3617`, companion `20ccd21`)
is an ancestor of both halves; both trees were clean before and after the review.
Skills consulted: none — no matching domain (no `.agents/skills/`, no `## Agento`
skills table in AGENTS.md; same as plan.md `## Research`).

## Acceptance checklist results

1. **`metrics` document, slug filter, missing slug — pass.** `node scripts/agento.mjs
   metrics` → exit 0, `status: ok`, 56 items, `ref: {"artifacts":"origin/main",
   "product":"origin/main"}`, `aggregate.count` 56; `dashboard --pr` lists the same 56
   (`deliveries.items.length` 56). `metrics delivery-metrics` → 1 item, `ref:
   origin/feature/delivery-metrics`; `metrics no-such-slug` → exit 3; `metrics a b` →
   exit 1 usage error; `metrics ../x` → `usage-error` (slug pattern). Fixture test
   "metrics derives phases, rounds, pauses, the merge, and post-ship latency from
   fixed-date history in both layouts" passes.
2. **Item fields and exact seconds — pass.** `scripts/delivery-metrics.test.mjs` 13/13
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
10. **Bundle byte-identical — pass.** `cmp` of every non-test `scripts/*.mjs` against
    `extension/cli/` printed nothing; `extension/cli/` lists `delivery-metrics.mjs`;
    `tests/extension-bundle.test.mjs` 4/4; the packaged VSIX contains
    `extension/cli/delivery-metrics.mjs` and `extension/out/deliveryTimeline.js`.
11. **Full gate vs baseline — pass.** `git ls-files '*.sh' | xargs pnpm dlx
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
    secrets visible (only a private LAN IP in the OS bar). The real VS Code window
    was not re-driven by the Reviewer; the Electron suite covers the same tree API.

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

No undocumented changes: `git diff --stat origin/main...HEAD` is 24 files, all in the
plan's affected list plus the recorded repairs; nothing under `scripts/hooks/`,
`.github/`, `commands/`, or `hooks/`.

## Roadmap audit

All 17 steps are ticked; each was spot-checked against the code, tests, and evidence
above. No falsely ticked boxes, no missing steps, no repairs made.

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
3. **Security — no issues.** Git is spawned with argument arrays (`execFileSync` /
   promisified `execFile`), never a shell; the slug argument passes `requireSlug`;
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
