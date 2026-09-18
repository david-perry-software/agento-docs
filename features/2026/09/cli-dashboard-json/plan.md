# Additive dashboard JSON on `agento.mjs status` and `next`

## Problem

The `agento-extension` initiative
([breakdown](../../../../initiatives/2026/09/agento-extension/breakdown.md), member
`### cli-dashboard-json`) renders every delivery as a tree node "with type, slug,
lifecycle, ticks/total, status, PR and companion PR state, owning worktree, initiative;
grouped by lifecycle in the CLI's order", and must "never re-derive lifecycle,
ownership, allowed commands, or next transition; it renders the JSON". Today
`agento.mjs status` emits none of that: its `items[]` carry only the roadmap record
(`describeContent()` — status, branch, steps, verdict, headers), sorted by roadmap
status, and `agento.mjs next` names a window *kind* (`here | primary | secondary`)
without the path or `.code-workspace` file a launcher would open. `deriveLifecycle`,
`findOwner`, `describeCompanion`, `describeWorkspace`, and the `gh pr view` lookups
already compute every missing piece for `session` and `ship-preflight`; this feature
exposes them on `status` and `next` as **additive JSON** — no existing field, order,
or exit code changes — so the first extension members (`deliveries-tree`,
`command-dispatch`) can render and route without derivation of their own. Users of
`/agento delivery-status` gain the same facts from one CLI call, and a roadmap that
lives only on a delivery branch's companion half becomes visible from the primary.

## Decisions

- **Q1: From the primary window, `status` today walks only the artifact checkout
  (companion clone on main). Should it also surface roadmaps that exist only on a
  delivery branch?** A: "Also walk registered companion halves" — read each managed
  pair's companion half working tree (like `session`/`next` do); origin-only roadmaps
  stay out of scope.
- **Q2: `status --pr` costs one `gh pr view` per item (two in companion mode). Which
  items should it look up?** A: "Non-complete items only" — skip `status: complete`
  roadmaps; their `pr`/`companionPr` stay `null` and no warning is emitted for them.
- **Q3: Should `status` keep its current `items` sort (in-progress, paused, in-review,
  planned, complete) and only add a top-level `lifecycles[]` array, or re-sort items
  by lifecycle?** A: "Keep sort, add lifecycles[]" — strictly additive;
  `/agento delivery-status` table order unchanged; the renderer groups using
  `lifecycles[]`.
- **Q4: Should `/agento delivery-status` adopt `status --pr` in this feature
  (replacing its own `gh pr list` cross-reference), or stay untouched?** A: "Leave
  prompts untouched" — only CLI, tests, and `docs/commands.md` change; adoption is a
  follow-up.

Planner interpretation of Q1 for the in-repo layout: the analogue of a companion half
is a managed product worktree on a delivery branch (`worktrees[]` entry with
`isManaged: true` and `role: build`), whose working tree carries the roadmap the
primary's `main` has not merged yet. `status` walks those the same way, so both
layouts surface in-flight deliveries from the primary. Origin-only roadmaps
(`resolve … source: remote`) are still out of scope per Q1.

## Research

Skills consulted: none — no matching domain (the repository has no `.agents/skills/`
directory and no `## Agento` skills table in AGENTS.md).

**Lint baseline (policy §5).** Command from AGENTS.md: `shellcheck scripts/hooks/*.sh
scripts/wait-for-checks.sh` → exit 0, no findings (2026-09-18, product half at
`8c7c35e`). Test baseline: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`
→ 206 pass / 0 fail. The baseline is green, so the full gate applies unchanged: the
same shellcheck command and full test run close every phase. No `.mjs` linter is
configured (`package.json` has only `lint:hooks`); node:test is the gate for the CLI.

**Concurrent deliveries.** `gh pr list --state open` in the product repository and
from inside `/home/david/DP/agento-docs` both return `[]` (2026-09-18): no open
delivery branches, no file overlap. The sibling wave-1 member `extension-scaffold` may
be planned concurrently; it touches `extension/`, `tests/extension-bundle.test.mjs`,
`tests/customizations.test.mjs` (version assertion), `AGENTS.md`, and `package.json`
scripts — none of the files below except possibly `CHANGELOG.md` and
`docs/commands.md` (both append-only here; integrate `origin/main` by merge before
every push).

**Current `status` (`scripts/agento.mjs` L997–1008).** Filters `allRoadmaps(typeFilter)`
by slug, computes `duplicates` (same slug, several roadmap paths), sorts by the order
`["in-progress", "paused", "in-review", "planned", "complete"]` then slug, and emits
`{ status, root, currentBranch, defaultBranch, items, duplicates, resumable }` where
`resumable` is the slugs whose status is `in-progress | paused | in-review`. Each item
is `describeContent()` (L344–362): `type, slug, dir, roadmap, plan, review,
reviewVerdict, status, branch, lastUpdated, nextStep, githubIssue, artifactPr,
initiative, steps { ticked, total }, postShipPending`. Consumers that must keep
working: `commands/delivery-status.md` (L28–33: the field list and "the CLI's order"
at L46), `commands/ap.md` L25 (`resumable`), `commands/build-*.md` L25 and
`commands/review-*.md` (`status feature|issue` slug listings),
`commands/triage-followups.md` L44, and tests at `scripts/agento.test.mjs` L135–143,
L242, L654, L815–840, L1586, L2058.

**Roadmap sources.** `allRoadmaps(typeFilter, half = null)` (L402–421) walks
`[half, artifactsRoot]` in that order with first-seen-wins on the repository-relative
`roadmap` path, so a registered companion half's copy shadows the clone's. `session`
and `next` pass `companionHalfOf(describeCompanion(worktree))` — only the *current*
session's half; `status` passes nothing. `companionWorktrees()` (L179–184) lists the
companion clone's registered worktrees once; `classifyWorktrees` (session-state
L159–180) tags them `repo: "companion"` with the product half's role, and
`pairFor` (L141–156) maps a managed product entry to its half path. The test at
`scripts/agento.test.mjs` L654 asserts today's clone-only behaviour ("status walks the
clone") and will be updated to the new precedence.

**Pieces already computed elsewhere.** `deriveLifecycle({ delivery, pr, companionPr })`
(session-state L227–258) needs `roadmap, status, reviewVerdict, postShipPending` —
all present on a status item — and returns `warnings[]` (`unknown-roadmap-status`,
`merged-but-not-complete`, `companion-pr-open`). `LIFECYCLES` (L223) is the order.
`findOwner({ worktrees, worktreesDir, branch, config })` (L182–194) returns
`{ path, role, dirPrefix, id } | null`. `companionOfOwner(owner, layout)` (agento.mjs
L294–297) → `describeCompanion` (L273–284) returns `{ path, branch, detached, dirty,
ahead, behind, registered } | null` with three git calls per registered half.
`describeWorkspace(worktree, sessionWorktreesDir)` (L286–291) returns
`{ path, exists } | null` for a managed worktree in companion mode.
`lookupPullRequest(branch, { cwd, label })` (L434–451) and
`lookupCompanionPullRequest(branch, layout)` (L455–458) return `{ pr, warnings }`,
never throw, and cost one `gh pr view --json number,state,isDraft,mergeStateStatus,url`
each. `primaryWorktreesDir(worktrees)` (L460–466) resolves `worktrees.dir` against
the primary. `parseArgs` (L57–74) already accepts `--pr` for any subcommand; `usage()`
prints header lines 2–22 (L39–42), so a new usage line must stay inside that range.

**Current `next` (agento.mjs L1185–1308; session-state L343–492).** `transition()`
builds `{ command, args, invocation, window, then, reason }`; `deriveNext` emits
`window: "here"` or `"primary"` only (`secondary` exists in the vocabulary and in
`deriveAllowed`'s `elsewhere[]` but no `deriveNext` branch produces it). The CLI has
`classified` (every worktree with `repo`), `sessionWorktreesDir`, and
`describeWorkspace` in scope when it emits, so a `target` can be resolved there
without touching the pure transition table. `worktrees[0]` is always the product
primary (`classifyWorktrees` contract; `docs/commands.md` L84–86).

**Test scaffolding.** `scripts/agento.test.mjs`: `makeRepo({ config, companion })`,
`cloneWithOrigin`, `companionOf`, `writeRoadmap(root, rel, header, steps)`,
`makeWorktreeRepo()` (worktrees.dir `../wt`), `makePairRepo()` (product + companion
+ both worktree dirs), `restrictedPath(extra)` (PATH with node, git, and stub
executables), `prStub(marker, { product, companion, companionMerge })` (a `gh` that
answers `pr view` per repo and logs `$PWD $*`), `runWith({ cwd, env }, ...args)`.
`scripts/session-state.test.mjs`: `layout()` / `pairLayout()` fake worktree lists,
`roadmapRecord()` mirrors `describe()` output, the `next()` wrapper asserts
`NEXT_STATUSES`, prompt basenames, and the `window` vocabulary.

**Docs and history.** `docs/commands.md` L35–110 is the CLI paragraph (`status [type]
[slug]` at L44; `next [<slug>]` at L102–107); `docs/architecture.md` L79–81 names the
status lister in prose only; `CHANGELOG.md` top entry is `## 0.5.2 (2026-09-18)`;
`package.json` and `.claude-plugin/plugin.json` are both `0.5.2` and the initiative's
Q1 forbids a bump before every member is complete, so the entry goes under
`## Unreleased`. `AGENTS.md` L27–30 already lists `status` and `next` among the CLI
subcommands (no change needed).

## Approach

Everything is additive: no existing key is renamed, removed, reordered, or retyped;
no exit code changes; without `--pr` no `gh` process is spawned.

### `status [feature|issue] [slug] [--pr]`

1. **Roadmap sources.** Generalise `allRoadmaps(typeFilter, halves = [])` to take an
   ordered list of extra bases (the current single `half` call sites pass `[half]`).
   Add `managedHalves()` in `agento.mjs`: in companion mode, every entry of
   `companionWorktrees()` that is a managed `<kind>-<id>` directory under
   `companionWorktreesDir` and exists on disk; in the in-repo layout, every product
   `worktrees[]` entry classified `isManaged && role === "build"`. `status` walks
   `[...managedHalves(), artifactsRoot]`. Precedence for one repository-relative
   roadmap path seen in several bases: the copy whose `branch:` header equals the
   base's checked-out branch wins (that delivery's own half is its truth); otherwise
   the first base listed; the clone/primary copy is the fallback. Items keep `dir` and
   `roadmap` repository-relative, so `duplicates` and the prompts' path listings are
   unchanged. `session`/`next` keep passing only their own half (behaviour unchanged).
2. **Per-item additive fields**, computed once per item after sorting:
   - `lifecycle` — `deriveLifecycle({ delivery: item, pr, companionPr }).lifecycle`;
     its `warnings[]` (prefixed `<slug>: `) join a new top-level `warnings[]`.
   - `owner` — `findOwner({ worktrees, worktreesDir: sessionWorktreesDir, branch:
     item.branch, config })` → `{ path, role, dirPrefix, id } | null`.
   - `workspace` — `describeWorkspace({ isManaged: true, dirPrefix, id },
     sessionWorktreesDir)` when `owner` is managed, else `null` (always `null` in the
     in-repo layout) → `{ path, exists } | null`.
   - `companion` — `companionOfOwner(owner, checkoutLayout())` →
     `{ path, branch, detached, dirty, ahead, behind, registered } | null`.
   - `pr`, `companionPr` — `null` unless `--pr` **and** `item.status !== "complete"`
     (Q2); then `lookupPullRequest(item.branch)` and
     `lookupCompanionPullRequest(item.branch)` (the latter is `null` with no `gh`
     call in the in-repo layout); their warnings join `warnings[]` prefixed
     `<slug>: `. Keys are always present so a renderer sees a stable shape.
3. **Top-level additive fields**: `lifecycles: LIFECYCLES` (imported from
   `session-state.mjs`) and `warnings: []`. `items` order (Q3), `duplicates`, and
   `resumable` are untouched.
4. Usage header line 10 becomes `status [feature|issue] [slug] [--pr]` with a short
   parenthetical; the header stays within the 21 lines `usage()` prints.

### `next [<slug>]`

5. Add a pure `resolveNextTarget({ next, worktrees, primaryPath, branch, workspaceFor })`
   to `scripts/session-state.mjs`: returns `null` when `next` is null or
   `next.window === "here"`; `{ path: primaryPath, workspace: null }` for `primary`;
   for `secondary`, the managed `worktrees[]` entry with `repo: "product"` and
   `branch === branch`, as `{ path, workspace: workspaceFor(entry) }`, or `null` when
   no such entry exists. `deriveNext` and `transition()` are unchanged.
6. In the CLI's `case "next"`, after `deriveNext`, set `result.next.target =
   resolveNextTarget({ next: result.next, worktrees: classified, primaryPath:
   worktrees[0]?.path ?? root, branch: target?.branch ?? delivery?.branch ?? null,
   workspaceFor: (w) => describeWorkspace(w, sessionWorktreesDir) })`. `target` is
   `{ path, workspace: { path, exists } | null } | null`, matching `session.workspace`'s
   shape. `candidates[]`, `dispatch`, statuses, and exit codes are unchanged.

### Tests

7. `scripts/session-state.test.mjs`: `resolveNextTarget` table — `here` → null;
   `primary` → primary path with `workspace: null`; `secondary` with a managed product
   entry on the branch → its path and the `workspaceFor` result; `secondary` with only
   a companion entry or no entry → null; null `next` → null.
8. `scripts/agento.test.mjs`:
   - in-repo: `status` items carry `lifecycle` for every roadmap status (planned →
     `planned`, in-progress → `building`, paused → `paused`, in-review → `in-review`
     / `approved` by verdict, complete → `shipped` / `post-ship-pending`),
     `owner` from a managed worktree and `null` otherwise, `workspace: null`,
     `companion: null`, `pr: null`, `companionPr: null`, top-level `lifecycles`
     deep-equals `LIFECYCLES`, `warnings: []`, `items` order and `resumable` unchanged,
     and a roadmap present only in a managed build worktree's working tree appears
     from the primary; no `gh` invocation without `--pr` (marker file).
   - in-repo `--pr`: `prStub` → non-complete items get `pr`, complete items stay
     `null` with no `gh` call for them (marker line count), a failing `gh` yields
     `pr: null` plus one `<slug>: pr: …` warning, a `MERGED` PR on an in-progress
     roadmap adds `<slug>: merged-but-not-complete` without changing `lifecycle`.
   - companion mode (`makePairRepo`): a roadmap committed only on a registered half's
     branch is listed from the primary with the half's status; a same-path clone copy
     is shadowed by the half whose branch matches the header; `companion` reports the
     half (dirty/ahead/behind as `close-decision` does), `workspace` names the pair's
     `.code-workspace` with `exists` true/false; `--pr` runs `gh pr view` from the
     product checkout and from inside the companion clone (`prStub` marker) and
     reports both PRs; existing L654 assertion updated to the new precedence.
   - `next`: from a build worktree with a fresh `approve`, `next.target` is
     `{ path: <primary>, workspace: null }`; from a plan or build worktree with
     `window: here`, `target` is `null`; in companion mode the primary transition
     for an initiative member (`start-session`, `here`) also has `target: null`.
   - usage: `run(repo).json.usage` matches `status [feature|issue] [slug] [--pr]`.

### Docs

9. `docs/commands.md`: extend the `status` clause with the new per-item and top-level
   fields, `--pr`, the Q2 skip rule, and the roadmap-source rule; extend the `next`
   clause with `target`. `CHANGELOG.md`: a `## Unreleased` section with one entry (no
   version bump, per the initiative's Q1).

### Files touched

`scripts/agento.mjs`, `scripts/session-state.mjs`, `scripts/agento.test.mjs`,
`scripts/session-state.test.mjs`, `docs/commands.md`, `CHANGELOG.md` (product half);
`features/2026/09/cli-dashboard-json/{plan,roadmap}.md` (companion half).

## Risks

- **`status` becomes slower.** Each item adds `findOwner` (pure) and, when a managed
  owner exists in companion mode, three git calls for `describeCompanion`; `--pr`
  adds one or two `gh` calls per non-complete item. Mitigation: `--pr` is opt-in and
  skips complete items (Q2); git calls happen only for owned items; the extension
  debounces refreshes (initiative risk register). No change without owners or `--pr`
  beyond a pure derivation per item.
- **Changed roadmap precedence surprises a prompt.** From the primary, an in-flight
  delivery's roadmap now reflects its half/worktree copy rather than the clone's
  `main` copy. This is the truthful state (`session`/`next` already report it) and
  affects only rows whose branch is checked out in a managed worktree; the test at
  L654 is updated deliberately and the docs say which copy wins.
- **Half on an unexpected branch.** A registered half that is detached or on a
  different branch than the roadmap header loses the precedence tie to the
  clone/primary copy, so a half-promoted pair never masks the published record.
- **Concurrent edits to `docs/commands.md` / `CHANGELOG.md`** by `extension-scaffold`.
  Mitigation: merge `origin/main` before every push (policy §7); both edits are
  append-style within distinct clauses.
- **`secondary` target is untested against live `deriveNext` output** because
  `deriveNext` never emits it today. Mitigation: `resolveNextTarget` is a pure
  function with its own table test, so the code path is covered when a future
  transition uses `secondary`.

## Out of scope

- Any change to `/agento delivery-status` or other prompts/commands (Q4); they may
  adopt the fields in a follow-up.
- Reading roadmaps from `origin/<branch>` refs in `status` (Q1); `resolve`/`next`
  keep their existing remote fallback.
- Re-sorting `items` (Q3), changing `resumable`, or altering any existing field.
- New transitions in `deriveNext`, changes to `session`, `initiative`, `doctor`,
  `paths`, or the hooks.
- A version bump or release (initiative Q1); extension code (`extension/`).

## Acceptance checklist

- [ ] `node scripts/agento.mjs status` in a repository with roadmaps in every status
  emits per item `lifecycle`, `owner`, `workspace`, `companion`, `pr`, `companionPr`
  and top-level `lifecycles` (deep-equal to `LIFECYCLES`) and `warnings`; every field
  present before this change is unchanged in name, type, and value, and `items` keep
  the order in-progress, paused, in-review, planned, complete then slug — verified by
  `node --test scripts/agento.test.mjs` (the new status tests and the untouched
  "status lists roadmaps with progress, verdicts, and duplicate slugs" test).
- [ ] Without `--pr`, `status` spawns no `gh` process (marker-file test) and every
  `pr`/`companionPr` is `null`; with `--pr`, non-complete items carry the `gh pr view`
  JSON (`number, state, isDraft, mergeStateStatus, url`) and complete items stay
  `null` with no lookup — verified by `node --test scripts/agento.test.mjs`.
- [ ] Lookup or lifecycle problems land in `status` `warnings[]` prefixed with the
  slug (`<slug>: pr: gh pr view … failed`, `<slug>: merged-but-not-complete: …`) and
  never change exit code or lifecycle — verified by `node --test scripts/agento.test.mjs`.
- [ ] In companion mode, `status` from the primary lists a roadmap that exists only in
  a registered companion half's working tree, prefers the half whose branch matches
  the roadmap's `branch:` header over the clone's same-path copy, and reports
  `companion { path, branch, detached, dirty, ahead, behind, registered }` and
  `workspace { path, exists }` for that item; in the in-repo layout it lists a roadmap
  present only in a managed build worktree and reports `workspace: null`,
  `companion: null` — verified by `node --test scripts/agento.test.mjs`.
- [ ] `node scripts/agento.mjs next` emits `next.target` = `null` for `window: here`,
  `{ path: <primary path>, workspace: null }` for `window: primary`, and for
  `window: secondary` the owning managed product worktree's `path` and
  `workspace { path, exists } | null`; `candidates`, `dispatch`, statuses, and exit
  codes are unchanged — verified by `node --test scripts/session-state.test.mjs
  scripts/agento.test.mjs` and by `node scripts/agento.mjs next` in this promoted
  worktree printing `target: null` (window `here`).
- [ ] `node scripts/agento.mjs bogus` prints a usage line matching
  `status [feature|issue] [slug] [--pr]` — verified by `node --test scripts/agento.test.mjs`.
- [ ] `docs/commands.md` documents the new `status` fields, `--pr`, the skip rule for
  complete items, the roadmap-source precedence, and `next.target`; `CHANGELOG.md`
  has a `## Unreleased` entry; `package.json` and `.claude-plugin/plugin.json` stay
  `0.5.2` — verified by `grep -n "lifecycles\|next.target\|target" docs/commands.md`
  and `grep -n "^## Unreleased" CHANGELOG.md`.
- [ ] No prompt, command, agent, instruction, or hook file changes
  (`git diff --stat origin/main -- .github commands scripts/hooks templates` is empty).
- [ ] Full gate on the final commit: `shellcheck scripts/hooks/*.sh
  scripts/wait-for-checks.sh` exit 0; `node --test 'scripts/**/*.test.mjs'
  'tests/**/*.test.mjs'` 0 failures and total > 206; `./scripts/hooks/replay-guard.sh
  < tests/guard-fixtures.txt` and `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh
  < tests/guard-fixtures-companion.txt` exit 0; `origin/main` is an ancestor of both
  halves' HEADs.
