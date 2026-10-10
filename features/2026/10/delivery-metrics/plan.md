# Delivery metrics: `agento.mjs metrics` and a Timeline row per delivery

## Problem

The `agento-hardening` initiative
([breakdown](../../../../initiatives/2026/10/agento-hardening/breakdown.md), member
`### delivery-metrics`) asks for "derived delivery metrics (`agento.mjs metrics`):
cycle time per phase, review rounds, pause durations, and post-ship latency computed
from git and roadmap history only, shown as a Timeline row per delivery in the
dashboard". Today nothing reports where delivery time goes: `agento.mjs status` and
the Deliveries view show the current `status:`/lifecycle, ticks, and PR state, and the
only timestamp anywhere is the hand-maintained `last-updated:` header. The history
that answers "how long did the build take, how many review rounds, how long was it
paused, how long after the merge did the post-ship step land" is already in the
artifact repository's git log (every `status:` transition is a commit) and in the
product repository's merge commits, but nobody derives it. After this feature:

- `node scripts/agento.mjs metrics [<slug>]` prints per-delivery phase durations,
  review rounds, pause intervals, the code PR's merge date, and post-ship latency,
  plus an `aggregate` block of medians across the listed deliveries — read-only,
  no new state, no network, no `gh`.
- `agento.mjs dashboard` carries the same document as an additive `metrics` section,
  and every delivery node in the Deliveries view gains one `Timeline` child whose
  description is a compact summary and whose tooltip lists every phase and
  timestamp.

No existing CLI field, exit code, lifecycle rule, or command boundary changes.

## Decisions

Clarifying questions were asked with the ask-questions tool. Every answer was the
option marked recommended.

- **Q1: Which event source defines phase boundaries for cycle time, review rounds,
  pauses, and post-ship latency?** A: "Roadmap header transitions in git log"
  (recommended) — commit dates of `status:` changes to roadmap.md in the artifact
  checkout; review rounds = review.md commits whose verdict is request-changes;
  pauses = intervals in `status: paused`; post-ship latency = code PR merge commit →
  last `(manual, post-ship)` tick commit. (Not chosen: "Header transitions plus PR
  events" via `gh`; "Header transitions plus `last-updated`".)
- **Q2: How should the Timeline appear in the Deliveries tree?** A: "Collapsible
  child row per delivery" (recommended) — each delivery node becomes expandable with
  one `Timeline` child whose description is a compact summary (e.g. `plan 2d · build
  5d · review 1d · 2 rounds · paused 3h`) and whose tooltip lists every phase and
  timestamp. (Not chosen: "Tooltip only"; "Separate Metrics view".)
- **Q3: What should `agento.mjs metrics [<slug>]` return?** A: "Per-delivery
  metrics plus an aggregate block" (recommended) — `items[]` with per-phase
  durations, rounds, pauses, post-ship latency, and `aggregate` with count and median
  per metric across the items (all deliveries without a slug; one item with a slug).
  (Not chosen: "Per-delivery metrics only"; "Per-delivery plus per-initiative
  rollups".)
- **Q4: Which deliveries get metrics computed in the `dashboard` document on every
  refresh?** A: "All deliveries, one git log over the artifact roots" (recommended)
  — a single `git log` over the artifact roots parsed once per refresh; metrics for
  every item; measured against the existing timings budget. (Not chosen:
  "Non-complete deliveries only"; "Lazy: on expand".)

Planner interpretation of Q4: "one git log" is the walk over the artifact default
branch. Roadmaps that exist only on an unmerged delivery branch (in-flight items read
from a managed half) need their branch-only commits too, which is one bounded extra
`git log <ref> --not origin/<default> -- <dir>` per non-complete item (today 0–3 such
items). The product merge dates come from one `git log --first-parent --merges` over
the product default. All of these are started asynchronously beside the dashboard's
PR lookups so they overlap the synchronous doctor and initiative work (see
`## Approach`).

## Research

Skills consulted: none — no matching domain. The repository has no `.agents/skills/`
directory and no `## Agento` skills table in AGENTS.md (verified 2026-10-10:
`ls .agents/skills` fails, `grep '## Agento' AGENTS.md` is empty).

**Initiative intake.** `node scripts/agento.mjs initiative agento-hardening` →
`status: ok`, `errors: []`; member `delivery-metrics` is `state: unplanned`,
`requires: ["dashboard-cli"]`, `blockedBy: []`, `ready: true`, and the CLI's `next`.
`dashboard-cli` (#38 / product PR #101) is `complete`, so the `dashboard` document
this member extends exists.

**History is complete and dated (2026-10-10, companion `origin/main` `20ccd21`,
product `origin/main` `49e3617`).**

- Both repositories merge with merge commits, never squash: `git log --first-parent
  origin/main --format='%h %p | %s'` shows `Merge pull request #42 from
  david-perry-software/feature/ship-cli` (companion) and `Merge pull request #105
  from david-perry-software/feature/ship-cli` (product); 42 and 78 first-parent
  merges respectively. Every branch commit — hence every `status:` transition — is
  reachable from the default branch after the merge, and the product merge commit
  names the branch, which is how the code PR's merge date is derived from git alone.
- The companion has 725 commits on `origin/main`; `git log origin/main -p
  --unified=0 -- 'features/*/roadmap.md' 'issues/*/roadmap.md'` contains 395
  `±status:` lines. Measured cost of the walks the design needs (warm cache):
  roadmap + review patch log over the whole history 2.1 MB in 0.19 s;
  `--first-parent` roadmap patch log 0.58 MB in 0.015 s. Both fit inside the
  dashboard's existing budget (`dashboard --pr` median 1 069 ms from the primary,
  `features/2026/10/dashboard-cli/evidence/timings.md` round 2).
- The `status: complete` transition is committed on the delivery branch by `ship`
  (`scripts/agento.mjs` ~L2270: `completeRoadmap(...)` then `git commit -m
  "docs(<type>): ship <slug>"`) just before the code PR merge, so `complete` marks
  the start of shipping and the product merge commit marks the merge; the
  post-ship tick lands later through the `<post-ship-prefix><slug>` PR.
- `status: paused` is a real header value (`scripts/session-state.mjs` L322,
  L337–338 map it to lifecycle `paused`); `review.md` starts with a `Verdict:
  approve|request-changes` line (`delivery-artifacts.instructions.md` `# review.md`
  item 1; `describeContent()` reads it at `scripts/agento.mjs` L516); post-ship steps
  are `- [ ] N.M (manual, post-ship)` lines (`describeContent()` `postShipPending`,
  L526).

**Existing code the design builds on (`scripts/agento.mjs`).**

- `describeContent()`/`describe()` (L507–544) give each roadmap record `type, slug,
  dir, roadmap, status, branch, …` with `dir` repository-relative to the artifacts
  root — the key the metrics join on.
- `allRoadmaps(typeFilter, halves)` (L569–598) walks managed halves before the
  artifacts root; `managedHalves()` (L603) lists them; `agit` (L231) binds git to
  `artifactsRoot`; `refFor(branch, g)` (L1288) picks `origin/<branch>`, the local
  branch, or `HEAD` the way `reviewFreshness()` (L1299) does — the same choice
  decides which ref an in-flight item's branch-only commits are read from.
- `statusDocument()` (L2851) and `dashboardDocument()` (L2949–3010): the dashboard
  computes `roadmaps` once, queues PR lookups through `lookupPullRequests()` (a
  promisified `execFile` pool, limit 4) right after `probeAsync("gh", ["--version"])`,
  runs the local doctor checks and initiatives while the pool runs, and names every
  section in `timings`; a section that throws becomes `{ status: "error", message }`.
  The usage header (L7–28) is printed by `usage()` with `slice(1, 29)` — adding a
  line means widening the slice.
- `docs/commands.md` L282–293 describes `dashboard`'s sections; `AGENTS.md`
  `scripts/` bullet lists the CLI subcommands; `extension/cli/` is a byte copy of
  `scripts/` refreshed by `cd extension && npm run copy-cli`.

**Existing extension code.**

- `extension/src/dashboardDocument.ts` `splitDashboardDocument()` validates the
  envelope and turns a `{ status: "error" }` section into an `Error`;
  `extension/src/extension.ts` L209–231 is the single refresh that feeds
  `createDeliveryTreeModel(status)`.
- `extension/src/deliveryTreeModel.ts` `parseItem()` (L188–247) builds each
  `DeliveryTreeItem` (`description`, `tooltip`, `actions`); `createDeliveryTreeModel`
  (L250) groups by `lifecycles[]`.
- `extension/src/deliveryTreeProvider.ts`: delivery rows are
  `TreeItemCollapsibleState.None` with no `id` and a click command
  (`agento.openRoadmap`); groups are `Collapsed` with
  `treeId("deliveries", "group", lifecycle)` (`collapsed-tree-default`: ids only on
  collapsible nodes, nonce per activation, so a delivery row that becomes collapsible
  needs its own unique id — the roadmap path is unique per item even when
  `duplicates[]` share a slug).
- `extension/test/electron/suite.ts`: `statusResponse()` (L229) and
  `dashboardResponse()` (L240) fixtures; `assertLeaf()` (L455) currently asserts
  delivery rows are leaves with no id — it changes with Q2.
- `extension/test/unit/deliveryTreeModel.test.ts` pins `description` strings and
  tooltip lines; `extensionIntegration.test.ts` asserts the refresh source.

**Lint baseline (policy §5, 2026-10-10, product half at `origin/main` `49e3617`).**

- Full-repository shell lint from AGENTS.md, `shellcheck scripts/hooks/*.sh
  scripts/wait-for-checks.sh`: the system `shellcheck` is not installed (exit 127),
  so the route the previous deliveries recorded was used — `git ls-files '*.sh' |
  xargs pnpm dlx shellcheck` (ShellCheck v0.11.0) → exit 0, no findings.
- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → exit 0, 420 pass /
  0 fail / 0 skipped.
- Extension: `extension/node_modules` is absent in this worktree; the Builder runs
  `npm ci`, `build`, `typecheck`, `test:unit`, `test:electron` in step 1.1 and
  records the counts next to this baseline (previous delivery recorded unit 160/160
  and Electron 4/4 scenarios).
- Overlap decision: the baseline is green, so the **full gate** applies — no scoped
  gate, no cleanup prerequisite. This delivery touches no shell files.

**Concurrent deliveries.** `gh pr list --state open --json number,headRefName` →
`[]` in the product repository and in the companion (2026-10-10). No open delivery
branch, no file overlap. Every other `agento-hardening` member is `complete`.

## Approach

1. **Pure module `scripts/delivery-metrics.mjs`** (importable, no CLI side effects,
   tested in isolation):
   - `parseArtifactLog(text)` — parses `git log --format='%x00commit %H %cI' -p
     --unified=0` output restricted to `roadmap.md` and `review.md` files into
     events keyed by the roadmap's `dir`: `{ at, sha, kind: "status", value }` for
     each `+status: <value>` hunk line in a `roadmap.md`, `{ kind: "review", value:
     approve|request-changes }` for each `+Verdict: <value>` line in a `review.md`,
     `{ kind: "post-ship-tick", value: "N.M" }` for each `+- [x] N.M (manual,
     post-ship)` line. Events are returned oldest first (the log is read with
     `--reverse`, or sorted by `at`), deduplicated by `(sha, dir, kind, value)`.
   - `parseMergeLog(text)` — parses `git log --first-parent --merges
     --format='%H%x09%cI%x09%s'` into `Map<branch, { at, sha, pr }>` from subjects
     matching `/^Merge pull request #(\d+) from [^/]+\/(.+)$/` (first merge of a
     branch wins).
   - `deriveMetrics({ record, events, merged, now })` → the item document below.
     Phase boundaries use the *first* occurrence of each status: `planned.start` =
     first status event of any value (the roadmap's first commit); `build.start` =
     first `in-progress`; `review.start` = first `in-review`; `cycle.end` = first
     `complete`. A phase whose end is missing is `{ end: null, seconds: <to now>,
     open: true }` when it has started and the delivery is not complete, else
     `null`. `pauses` = every `paused` event up to the next status event of another
     value (an unterminated pause is open, measured to `now`); `reviewRounds` =
     number of `review` events with value `request-changes`; `merged` = the product
     merge for `record.branch` or `null`; `postShip` = `{ total, ticked, lastTickAt,
     latencySeconds, pending }` with `total`/`ticked` from the record's post-ship
     lines, `latencySeconds` = `merged.at` (else `cycle.end`) → `lastTickAt`, and
     `pending: true` while unticked post-ship steps remain.
   - `aggregateMetrics(items)` → `{ count, complete, median: { plannedSeconds,
     buildSeconds, reviewSeconds, cycleSeconds, pauseSeconds, reviewRounds,
     postShipLatencySeconds } }`, each median over the items where the value is a
     number and the interval is closed (`open: false`), `null` with no sample.
   - `formatDuration(seconds)` is **not** here; it is a presentation concern of the
     extension (item 4).

   Item document:

   ```json
   {
     "type": "feature", "slug": "x", "dir": "features/2026/10/x",
     "roadmap": "features/2026/10/x/roadmap.md", "branch": "feature/x",
     "status": "complete", "ref": "origin/main",
     "events": [{ "at": "2026-10-01T10:00:00+00:00", "sha": "…", "kind": "status", "value": "planned" }],
     "phases": {
       "planned": { "start": "…", "end": "…", "seconds": 3600, "open": false },
       "build":   { "start": "…", "end": "…", "seconds": 86400, "open": false },
       "review":  { "start": "…", "end": "…", "seconds": 7200, "open": false }
     },
     "cycle": { "start": "…", "end": "…", "seconds": 97200, "open": false },
     "reviewRounds": 1,
     "pauses": { "count": 1, "seconds": 1800, "open": false },
     "merged": { "at": "…", "sha": "…", "pr": 105 },
     "postShip": { "total": 1, "ticked": 1, "lastTickAt": "…", "latencySeconds": 600, "pending": false },
     "warnings": []
   }
   ```

2. **`metricsDocument({ slugFilter, roadmaps, now, logs })` in `scripts/agento.mjs`**
   and `case "metrics"`:
   - Items are `roadmaps ?? allRoadmaps(null, managedHalves(productWorktrees()))`
     filtered by slug, in `status`'s order; a slug with no roadmap → `{ status:
     "missing", message }`, exit 3 via `withExit()`.
   - Artifact default ref: `origin/<default>` when it resolves in the artifacts
     clone, else `<default>`, else `HEAD`. One `agit("log", ref, "--reverse",
     "--format=%x00commit %H %cI", "-p", "--unified=0", "--", ":(glob)<features>/**/roadmap.md",
     ":(glob)<features>/**/review.md", ":(glob)<issues>/**/roadmap.md",
     ":(glob)<issues>/**/review.md")` feeds `parseArtifactLog`.
   - For each non-complete item whose `refFor(branch, agit)` is not `HEAD`-only (an
     `origin/<branch>` or local branch exists), one more `agit("log", <ref>,
     "--not", <default ref>, …same format…, "--", "<dir>/roadmap.md",
     "<dir>/review.md")` adds the branch-only events; the item's `ref` names what
     was read.
   - Product merges: one `git(root, "log", "--first-parent", "--merges",
     "origin/<default>" | "<default>", "--format=%H%x09%cI%x09%s")` into
     `parseMergeLog`. In the in-repo layout the artifacts clone is the product, so
     the same clone serves both logs.
   - Output: `{ status: "ok", generatedAt, ref: { artifacts: <ref>, product: <ref> },
     items, aggregate, root, configSource }`, exit 0. Never `gh`, never network.
   - `logs` is an injection point: `dashboardDocument` passes the three log texts it
     fetched asynchronously; the standalone case runs them synchronously.
   - Usage header gains `node scripts/agento.mjs metrics [<slug>]   (phase durations,
     review rounds, pauses, merge date, post-ship latency from git history; +
     aggregate medians)`; `usage()`'s slice widens by one.

3. **Dashboard section.** `dashboardDocument()` starts the artifact log, the
   per-in-flight-branch logs, and the product merge log with the promisified
   `execFile` right after the PR lookups are queued (before `setImmediate`), awaits
   them after the local doctor checks, and adds `metrics: section("metrics", () =>
   metricsDocument({ roadmaps, logs }))` plus `timings.metrics`. `deliveries`,
   `session`, `doctor`, and `initiatives` are unchanged, so their deep-equality
   tests stay as they are. A failing metrics section is `{ status: "error",
   message }` like the others.

4. **Extension.**
   - `extension/src/deliveryTimeline.ts` (pure, no `vscode` import):
     `formatDuration(seconds)` (`<1m`, `42m`, `3h 05m`, `2d 4h`, `3w 2d`) and
     `createTimelineRow(item)` → `{ description, tooltip }`: description joins the
     non-null parts `plan <d>`, `build <d>`, `review <d>`, `<n> round(s)`, `paused
     <d>`, `post-ship <d>` with ` · `, an open interval suffixed `…`, and reads
     `no history` when there are no events; the tooltip lists one line per phase
     (`Planned: <start> → <end> (<d>)`), `Cycle`, `Review rounds`, `Pauses`,
     `Merged: <at> (PR #n)`, `Post-ship: <ticked>/<total>, latency <d>`, and
     `Source: <ref>`. `createTimelineRows(metricsDocument)` → `Map<roadmap,
     row>`; an `Error` section yields a map whose `get` returns `{ description:
     "unavailable", tooltip: <message> }` for every key.
   - `extension/src/dashboardDocument.ts` adds `metrics: unknown` to
     `DashboardSections` (section-error → `Error`; absent → `null`).
   - `extension/src/deliveryTreeModel.ts`: `createDeliveryTreeModel(status,
     timelines?: ReadonlyMap<string, TimelineRow> | TimelineFallback)` attaches
     `timeline: TimelineRow | null` to each `DeliveryTreeItem` keyed by `roadmap`.
     Existing descriptions and tooltips are untouched.
   - `extension/src/deliveryTreeProvider.ts`: delivery rows become
     `TreeItemCollapsibleState.Collapsed` with `item.id = treeId("deliveries",
     "delivery", item.roadmap)` (unique per item, nonce per activation, so they open
     collapsed in a new window and keep the user's expansion across refreshes); the
     click command, `contextValue`, icon, and description are unchanged.
     `getChildren(delivery)` returns one `{ kind: "timeline", item }` element
     rendered as label `Timeline`, `description`/`tooltip` from the row, icon
     `history`, `contextValue: "agento.timeline"`, `None`, no command.
   - `extension/src/extension.ts`: the refresh passes `createTimelineRows(metrics)`
     into `createDeliveryTreeModel`; nothing else changes (still one `dashboard
     --pr` spawn).

5. **Tests.**
   - `scripts/delivery-metrics.test.mjs` (new): synthetic log texts for every
     derivation rule (full lifecycle; a pause and its end; an open pause; two
     request-changes rounds then approve; post-ship tick; a roadmap created directly
     `in-progress`; missing `in-review`; duplicate `+status:` in one commit; merge
     log parsing incl. a non-matching subject), aggregate medians (odd and even
     sample counts, open intervals excluded, no sample → `null`).
   - `scripts/agento.test.mjs`: `makeRepo` fixtures (in-repo and companion) that
     commit transitions with `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE` fixed, merge a
     delivery branch into `main` with `git merge --no-ff -m "Merge pull request #7
     from owner/feature/x"`, then assert `metrics` item fields exactly (seconds
     computed from the fixed dates), `metrics <slug>` for one item, `missing` exit 3,
     an in-flight roadmap committed only in a managed half (branch-only events read
     from `origin/<branch>`, `ref` named, `open: true` on the current phase), and
     `dashboard`'s `metrics` section deep-equal to standalone `metrics` with
     `generatedAt` and open `seconds` excluded; the existing dashboard
     deep-equality tests for the other sections pass unchanged; a `gh` marker proves
     `metrics` never spawns `gh`.
   - Extension unit: `deliveryTimeline.test.ts` (formatting table, description
     composition, open suffix, no history, error fallback), `deliveryTreeModel.test.ts`
     (timeline attached by roadmap, null without metrics), `dashboardDocument.test.ts`
     (metrics section present, error, absent), `extensionIntegration.test.ts` (source
     passes `createTimelineRows`).
   - Electron (`extension/test/electron/suite.ts`): `dashboardResponse` gains a
     `metrics` fixture; delivery rows assert `Collapsed` + an `agento:` id; the
     `Timeline` child asserts label, description, tooltip, `history` icon, `None`;
     a metrics-section error leaves the Deliveries tree `ready` with `Timeline`
     rows reading `unavailable`.

6. **Docs.** `docs/commands.md` (the `metrics` subcommand paragraph after
   `initiative`, the `dashboard` paragraph's section list and timings), `AGENTS.md`
   `scripts/` bullet, `docs/extension.md` (a "Timeline" subsection under Deliveries:
   the child row, the format, where the numbers come from, and that delivery rows
   now start collapsed), `extension/README.md` (one sentence), `CHANGELOG.md`
   `## Unreleased` **Added**. `/agento delivery-status` is untouched (follow-up:
   show the aggregate there).

Affected files: `scripts/delivery-metrics.mjs` (new), `scripts/delivery-metrics.test.mjs`
(new), `scripts/agento.mjs`, `scripts/agento.test.mjs`, `extension/cli/*` (copy),
`extension/src/deliveryTimeline.ts` (new), `extension/src/dashboardDocument.ts`,
`extension/src/deliveryTreeModel.ts`, `extension/src/deliveryTreeProvider.ts`,
`extension/src/extension.ts`, `extension/test/unit/deliveryTimeline.test.ts` (new),
`extension/test/unit/deliveryTreeModel.test.ts`,
`extension/test/unit/dashboardDocument.test.ts`,
`extension/test/unit/extensionIntegration.test.ts`,
`extension/test/electron/suite.ts`, `docs/commands.md`, `docs/extension.md`,
`extension/README.md`, `AGENTS.md`, `CHANGELOG.md`. No hook, prompt, agent, or
policy file changes; no version bump (additive, like `dashboard-cli`).

## Risks

- **Dashboard budget.** The metrics walk adds ~0.2 s of git on this repository.
  *Mitigation:* the logs run asynchronously beside the PR lookups and overlap the
  synchronous sections; step 2.5 re-measures `dashboard --pr` against the
  `dashboard-cli` budget (`dashboard --pr median ≤ slowest standalone median`) and
  adds an `(added <date>)` step if it is exceeded.
- **Histories that were rewritten or squashed** (another project adopting Agento with
  squash merges) collapse the transitions into one commit: phases read as zero
  seconds and `merged` is `null`. *Mitigation:* every derived field is nullable and
  the item carries `warnings[]` (`no in-progress transition`, `no merge commit names
  feature/x`); the extension renders `no history`/omits parts rather than guessing.
  Documented in `docs/commands.md`.
- **Clock semantics.** Commit dates are committer dates (`%cI`), which a merge or
  rebase can move. *Mitigation:* policy §7 forbids rebasing pushed history; the
  document names its source (`ref`) and the tooltip shows the timestamps so a
  surprising number can be checked.
- **Collapsible delivery rows change the tree's handles.** A delivery row gains an
  `id`; VS Code rejects duplicate ids. *Mitigation:* the id is the roadmap path (unique
  per item by construction of `allRoadmaps()`), prefixed by the per-activation nonce;
  the Electron suite asserts the state and id of every delivery row.
- **Clicking a collapsible row.** The row keeps its `agento.openRoadmap` click
  command; VS Code toggles expansion on the twistie and runs the command on the
  label, which is the behaviour the initiative tree already has for its collapsible
  rows. *Mitigation:* the manual step 3.7 confirms it in a real window.
- **Concurrent deliveries.** None open at planning time. *Mitigation:* integrate
  `origin/main` into both halves by merge before every push (policy §7).

## Out of scope

- PR-event timestamps from GitHub (`gh`), CI durations, token or cost metrics.
- Per-initiative rollups and a separate Metrics view (Q3/Q2 alternatives).
- Changing `/agento delivery-status` output, `status`, or `session` fields.
- Persisting metrics anywhere; every number is recomputed from git on each call.
- Bumping the plugin or extension version.

## Acceptance checklist

- [ ] `node scripts/agento.mjs metrics` prints `{ status: "ok", generatedAt, ref, items[], aggregate }` for every roadmap the dashboard lists, exit 0; `metrics <slug>` lists one item; an unknown slug is `status: "missing"`, exit 3 — verified by `scripts/agento.test.mjs` and by running the command in this worktree.
- [ ] Each item carries `phases.planned|build|review`, `cycle`, `reviewRounds`, `pauses`, `merged`, `postShip`, `events[]`, `ref`, and `warnings[]` exactly as `## Approach` item 1 defines, with seconds matching the fixed commit dates in the fixtures — verified by `scripts/delivery-metrics.test.mjs` and `scripts/agento.test.mjs`.
- [ ] `metrics` runs no `gh` process and reads only `git log` in the artifacts clone and the product clone — verified by the `gh` marker test and the logging-`git` wrapper test.
- [ ] `dashboard` and `dashboard --pr` carry a `metrics` section deep-equal to standalone `metrics` (modulo `generatedAt` and open-interval seconds) and `timings.metrics`; a failing metrics section becomes `{ status: "error", message }` while the other sections are unaffected — verified by `scripts/agento.test.mjs`.
- [ ] `dashboard --pr` median on this repository stays ≤ the slowest standalone median — verified by `evidence/timings.md` (step 2.5).
- [ ] In the Deliveries view every delivery row is collapsible with one `Timeline` child whose description is the compact summary and whose tooltip lists every phase, rounds, pauses, merge date, post-ship latency, and source ref; a metrics-section error shows `unavailable` on each Timeline row — verified by `extension/test/unit/deliveryTimeline.test.ts`, `deliveryTreeModel.test.ts`, and `cd extension && npm run test:electron`.
- [ ] Delivery rows start collapsed in a new window and keep their expansion across refreshes (per-activation nonce ids keyed by roadmap path) — verified by the Electron suite assertions on `collapsibleState` and `id`.
- [ ] The extension still refreshes with one `dashboard --pr` spawn — verified by `extensionIntegration.test.ts`.
- [ ] `docs/commands.md`, `docs/extension.md`, `extension/README.md`, `AGENTS.md`, and `CHANGELOG.md` describe `metrics` and the Timeline row — verified by `grep -n metrics` in each and `node --test tests/customizations.test.mjs`.
- [ ] `extension/cli/*.mjs` are byte-identical to `scripts/*.mjs` after `npm run copy-cli` — verified by `cmp`.
- [ ] Full gate equal to the `## Research` baseline: `git ls-files '*.sh' | xargs pnpm dlx shellcheck` exit 0 with no findings; `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exit 0 with ≥ 420 tests and 0 failures; both guard replays exit 0; `cd extension && npm run typecheck && npm run build && npm run test:unit && npm run test:electron && npm run package` exit 0 — recorded on the gate step.
- [ ] A screenshot of the real Deliveries view with an expanded delivery and its Timeline row is linked from the manual step with no secrets visible.
