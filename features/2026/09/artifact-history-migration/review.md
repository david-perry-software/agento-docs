# Review: artifact-history-migration

Verdict: approve

Reviewed 2026-09-18 at product `4d54703` on `feature/artifact-history-migration`
(draft code PR david-perry-software/agento#45) and companion `6bf0f09` on the same
branch (draft artifact PR david-perry-software/agento-docs#1, `artifact-pr: "#1"`).
Companion mode: session record `role: build`, `delivery.slug:
artifact-history-migration`, `companion { registered: true, dirty: false, ahead: 0,
behind: 0 }`; `origin/main` is an ancestor of HEAD in both halves; both working
trees clean and 0 ahead of upstream. `doctor --for review-feature` → `warn` only on
`artifact-repo` (stale in-repo roots in the primary — expected until #45 merges).
Skills consulted: none — no matching domain (no `.agents/skills/`, no `## Agento`
skills table in the product AGENTS.md; same as plan.md).

File references below are product-repository paths at `4d54703` (the companion
carries no code; see the companion README `## Migrated history` note for why
historical `../../../../` links are not used here).

## Acceptance checklist results

1. **Layout rule — `config` in a worktree whose branch sets `artifacts.repo.name`
   reports `<primary>/../<name>`; the primary stays in-repo** — **pass**.
   `scripts/agento.mjs` L157–L167 `resolveArtifacts()` anchors on `primaryConfig`
   only when the primary's own `repo` is set, else the checkout's config, both
   resolved against `primaryRoot`. Test `layout rule: a worktree whose own branch
   sets artifacts.repo is companion mode anchored on the primary, while the unset
   primary stays in-repo` (`scripts/agento.test.mjs` L254) asserts
   `artifactsRoot === <base>/project-docs` (not `<wt>/project-docs`) and the primary's
   `artifactsRoot === repo`, `companion: null`. Live: `node scripts/agento.mjs
   config` in this worktree → `artifactsRoot: /home/david/DP/agento-docs`,
   `configSource: <worktree>/.github/agento.json`.
2. **Branch-aware slug reads from an in-repo primary: `resolve`, `find`,
   `ship-preflight --pr`, `close-decision`, `next <slug>`, `paths` return the
   companion-only roadmap with `layout: "branch"`, `artifactsRoot` = clone,
   `companionPr` looked up inside the clone, `companionGaps: []`; a plain branch
   gets `layout: "checkout"`** — **pass**. `layoutFor()` L197–L226,
   `resolveWithLayout()` L236, `decideWithLayout()` L254, `paths` L1077–L1104.
   Test `branch-aware resolution: from an in-repo primary, …` (L309–L448) covers
   every subcommand including the `gh` stub's second call `$PWD` inside
   `project-docs`, `missing-pr` when the companion PR is absent, the absent-companion
   `nowhere-docs` message, the plain-branch control, and `next` candidates carrying
   `[slug, layout, artifactsRoot]`; `paths is branch-aware …` (L456). Live from the
   primary: `ship-preflight feature artifact-history-migration --pr --root
   /home/david/DP/agento` → `status: ok`, `layout: "branch"`, `artifactsRoot:
   /home/david/DP/agento-docs`, `owner.role: build`, `companion { dirty: false,
   ahead: 0 }`, `companionGaps: []`, `pr: 45`, `companionPr: 1`, `warnings: []`.
3. **`migrate` dry run / conflict / `--apply` / `nothing-to-migrate` / `not-sibling`
   covered by tests; usage header lists the subcommand** — **pass**. `case "migrate"`
   L1310–L1366 with `writeCompanionName` L855, `appendMigrationNote` L869,
   `recordsDiff` L888. Six `migrate` tests (`scripts/agento.test.mjs` L1965–L2135)
   cover the dry run writing nothing, the conflict exit 3, `Buffer.compare` on a
   binary `evidence/step-1-1-x.png`, template-created config, `branches.default:
   "trunk"` preserved, README note appended once, `records.identical: true`,
   `status`/`initiative` after the commits, `nothing-to-migrate`, the registered
   half, `not-sibling` and `not-a-checkout`. `grep -c 'migrate <companion-checkout>'
   scripts/agento.mjs` = 2; the usage output prints `migrate <companion-checkout>
   [--apply]`. Live negatives: `migrate /tmp` and `migrate /home/david/DP/agento-worktrees`
   → exit 3 `not-a-checkout`, `git status --porcelain` empty afterwards.
4. **Both hooks apply the layout rule; tests; shellcheck silent; replays exit 0**
   — **pass**. `scripts/hooks/delivery-guard.sh` L288–L311 and
   `scripts/hooks/session-context.sh` L81–L104 `resolve_artifacts()` keep the
   product root's own `repo` when the primary's is unset; the shared-helper bodies
   are byte-identical (`diff` of the marker-delimited regions after dropping the
   marker line → empty). Tests `companion: a worktree whose branch sets
   artifacts.repo denies pushing the companion's default branch when the primary
   has none` and `… consults the companion for the roadmap nudge`
   (`tests/guard.test.mjs` L285, L301); `… resolves the companion while the primary
   has none` (`tests/session-context.test.mjs` L279). Re-run here: `shellcheck` on
   the four scripts → exit 0, no output; `replay-guard.sh < tests/guard-fixtures.txt`
   → exit 0; `REPLAY_COMPANION=1 … < tests/guard-fixtures-companion.txt` → exit 0.
5. **`agento-init.prompt.md`: `argument-hint: "[--force] [--migrate]"`,
   `## Migration (--migrate)` with `--apply`, in-flight PR refusal, companion PR
   from inside the clone, product PR saying merge the companion first,
   `nothing-to-migrate` in the idempotency paragraph; grep ≥ 4; `cmp` silent;
   customizations suite exit 0** — **pass**. Frontmatter L3; section L239–L302 with
   M1–M9 (M1 dry run and `nothing-to-migrate`, M2 `gh pr list` refusal via
   ask-questions or its §10 fallback, M3 `switch -c changes/agento-init
   origin/<default>`, M4 `--apply`, M5/M6 commit + `cd ../<name> && gh pr create
   --draft`, M7 product PR "**merge the companion PR first**", M8 cross-link, M9
   report). `grep -c -- '--migrate'` = 9; `grep -c 'nothing-to-migrate\|nothing to
   migrate'` = 1; `cmp` against `commands/agento-init.md` silent; every
   `.github/prompts/*.prompt.md` is byte-identical to its `commands/` mirror;
   `tests/customizations.test.mjs` passes inside the 203/203 run.
6. **`ship.prompt.md` reads `artifactsRoot` and `layout` from `ship-preflight`;
   `layout: "branch"` is companion mode; `cmp` silent** — **pass**. L20–L43: reads
   both fields from the preflight, falls back to `config` only when absent, adds
   `or when its layout is "branch"` to the companion-mode condition and `layout:
   "checkout"` to the in-repo skip clause. `grep -c '"branch"'` = 2; `grep -c
   artifactsRoot` = 18; `cmp .github/prompts/ship.prompt.md commands/ship.md` silent.
7. **Policy §9 row mentions `--migrate`; README, docs/install.md, docs/commands.md
   mention `--migrate`; `layout` in docs/commands.md, docs/architecture.md,
   docs/project-profile.md; AGENTS.md names `../agento-docs`** — **pass**. `grep -l
   -- '--migrate' README.md docs/install.md docs/commands.md
   .github/instructions/delivery-policy.instructions.md` lists all four; `grep -c
   layout` → docs/commands.md 7, docs/architecture.md 1, docs/project-profile.md 1;
   `grep -c agento-docs AGENTS.md` = 3. README L144–L153 "Migrating an existing
   project" states one command, companion PR first, in-flight deliveries ship
   first, re-run reports nothing to migrate; docs/commands.md L100–L112 documents
   the subcommand's fields accurately against the implementation.
8. **Versions `0.5.0`; `## 0.5.0 (unreleased)` once; first bullet describes the
   migration and the layout rule** — **pass**. `grep -c '"version": "0.5.0"'` = 1 in
   `package.json` and `.claude-plugin/plugin.json`; `grep -c '^## 0.5.0
   (unreleased)' CHANGELOG.md` = 1; `^## Unreleased` = 0; the first bullet is
   **Artifact history migration** naming `migrate`, `--migrate`, the layout rule,
   `layout: "branch"`, the hooks, and this repository's move.
9. **This repository is migrated on the branch: no product paths under the roots,
   `.github/agento.json` with `"name": "agento-docs"`; companion branch carries
   the records; evidence count matches the before-snapshot; after-JSON shows
   `records.identical: true`** — **pass** (count differs from the plan's literal
   19, see Plan vs implementation). `git ls-tree -r --name-only
   origin/feature/artifact-history-migration | grep -c '^features/\|^issues/\|^initiatives/'`
   = 0 (origin equals HEAD `4d54703`); `.github/agento.json` present with `"name":
   "agento-docs"`. Companion `origin/feature/artifact-history-migration`: 18
   `roadmap.md` + 2 `breakdown.md` = 20 records (17 features — the plan's 16 plus
   this feature's own directory — + 1 issue + 2 initiatives). Evidence: the before
   snapshot lists 77 files of which 18 under `evidence/`; the companion branch has 18
   `evidence/` files outside `artifact-history-migration/` (plus this feature's own
   4). Byte identity re-derived: joining `git ls-tree -r 71d5b5b` (product, pre-move)
   with `git -C /home/david/DP/agento-docs ls-tree -r d9a0dfc` (import commit) by
   path, every one of the 77 blobs matches except this feature's own `roadmap.md`
   (ticked during the move — expected). `evidence/step-5-4-migrate-after.json`:
   `mode: "applied"`, `records.identical: true`, `diff: []`, `moved: [features,
   issues, initiatives]`, `readmeNoteAdded: true`, `configWritten` ending in
   `.github/agento.json`.
10. **`session --pr` from this worktree reports the companion half registered/clean,
    `delivery.roadmap`, `artifactPr` = roadmap header = `companionPr.number`;
    `ship-preflight … --root /home/david/DP/agento` from the primary reports
    `layout: "branch"`, `artifactsRoot: /home/david/DP/agento-docs`, `companionPr`
    non-null** — **pass**. `session --pr`: `companion { path:
    /home/david/DP/agento-docs-worktrees/plan-20260917-231812, branch:
    feature/artifact-history-migration, registered: true, dirty: false, ahead: 0,
    behind: 0 }`, `delivery.roadmap: features/2026/09/artifact-history-migration/roadmap.md`,
    `delivery.artifactPr: "#1"`, `companionPr { number: 1, OPEN, draft }`, `pr {
    number: 45, OPEN, draft }`, `lifecycle: in-review`, `warnings: []`. Primary
    preflight: see item 2.
11. **Prompt smoke on `agento-smoke-migrate-20260918`: companion
    `changes/agento-init` carries the seeded tree; product PR body links the
    companion PR and says merge it first; `doctor` `artifact-repo` `ok`; second pass
    `nothing-to-migrate` with no new PRs; recorded in
    `evidence/step-6-1-migrate-smoke.md`** — **pass**. Re-driven here (read-only):
    `git -C /tmp/agento-smoke/agento-smoke-migrate-20260918-docs ls-tree -r
    --name-only origin/changes/agento-init` lists
    `features/2026/09/demo/{evidence/step-1-1-demo.png,plan.md,roadmap.md}`,
    `issues/2026/09/bug/roadmap.md`, `initiatives/2026/09/init/breakdown.md`; product
    PR #1 body: 1 match each for `agento-smoke-migrate-20260918-docs/pull/1` and
    "merge the companion PR first"; `doctor --root <product>` → overall `ok`,
    `artifact-repo ok`; second-pass M1 from the product root → `{"status":"ok",
    "mode":"nothing-to-migrate","configSet":true}` exit 0; `gh pr list --state all`
    → exactly one PR per repository, both `changes/agento-init`, both OPEN; both
    working trees clean. Repositories left in place per the plan.
12. **Full-repository gate against the §5 baseline (190/190/0, shellcheck silent,
    both replays exit 0)** — **pass**. Fresh run: `node --test 'scripts/**/*.test.mjs'
    'tests/**/*.test.mjs'` → exit 0, `# tests 203`, `# pass 203`, `# fail 0`, `#
    skipped 0` (+13 over the baseline, all this feature's tests); `shellcheck
    scripts/hooks/delivery-guard.sh scripts/hooks/replay-guard.sh
    scripts/hooks/session-context.sh scripts/wait-for-checks.sh` → exit 0, no output;
    both replay commands exit 0. No new or undocumented findings; matches the Builder's
    6.2 record.
13. **`initiative external-artifact-repo` lists `artifact-history-migration` as
    `in-review` with `errors: []` at handoff** — **pass (with `--root <half>`)**.
    `node scripts/agento.mjs initiative external-artifact-repo --root
    /home/david/DP/agento-docs-worktrees/plan-20260917-231812` → `status: ok`,
    `errors: []`, member `{ slug: artifact-history-migration, state: in-review,
    artifactPr: "#1", wave: 5 }`, `done: false`. Without `--root` the same command
    from this worktree exits 3 `missing` because `artifactsRoot` is the companion
    clone on `main`, which is empty until agento-docs#1 merges — documented on
    roadmap steps 5.7 and 6.3 and in `## Follow-ups`; not a defect of this delivery.
14. **(deferred to post-ship) prismicon run** — **deferred to post-ship**. Step 6.4
    is `(manual, post-ship)` with the §4 justification in plan.md `## Risks` and Q5;
    it stays unticked through review and is landed by the ship epilogue.

## Plan vs implementation

- Implemented as designed: layout rule (Approach 1), `layoutFor` + branch-aware
  `resolve`/`find`/`close-decision`/`ship-preflight`/`next`/`paths` (Approach 2),
  `migrate` (Approach 3), hook edits (Approach 4), prompts (5), docs/changelog/version
  (6), dogfood (7), smoke + gate + in-review (8). No undocumented source changes; the
  only file outside the plan's list is `scripts/session-state.mjs` (+2 lines:
  `layout`/`artifactsRoot` on `next` candidate summaries) with its test update —
  within Approach 2's "emit `layout` and `artifactsRoot` … on `next` candidates".
- Count deviation: the plan's acceptance item 9 says 19 records (16 features); the
  branch carries 20 (17 features) because the plan counted the pre-existing
  directories and this feature's own directory was created by the same planning
  session. The Builder notes on 5.3/5.4 explain the same off-by-one for `status.items`
  (18) and roadmaps (18). Accepted.
- `initiative`/`status` from the build worktree read the companion clone's `main`,
  not the half (item 13). Pre-existing behaviour called out in the plan's Research
  ("`status` from the primary lists the clone, which is correct there"); recorded as
  a follow-up by the Builder.
- Smoke M8: `gh pr edit --body` failed on gh 2.45.0 (Projects-classic GraphQL
  deprecation); the Builder cross-linked with `gh api -X PATCH …/pulls/<n>` and
  filed a follow-up to document the fallback in the prompt. The prompt text still
  names only `gh pr edit`.

## Roadmap audit

Every ticked step spot-checked against the codebase and both origins; no false
ticks; no repairs made.

- 1.1–1.4, 2.1–2.3: tests listed in items 1–3 present and passing; `find
  artifact-history-migration` now prints `layout: "checkout"`, `source: "remote"`
  (the 1.3 `source: local` verify predates the flip — correct today, since the
  roadmap is on the companion's origin branch, not in the clone's `main`).
- 3.1/3.2: hook diffs and identical helper bodies confirmed (item 4); the 3.2
  Builder note about the marker line is accurate.
- 4.1–4.4: grep/cmp/version checks in items 5–8.
- 5.1: companion `origin/main` lists exactly the five bootstrap files; `gh api
  repos/david-perry-software/agento-docs/rulesets` → `Agento default branch`; clone on
  `main`.
- 5.2: `git -C /home/david/DP/agento-docs worktree list --porcelain` lists the half on
  `refs/heads/feature/artifact-history-migration`; the `.code-workspace` file exists
  with both folders.
- 5.3: commit `71d5b5b` adds `evidence/step-5-4-migrate-before.json` (77 files, 18
  evidence, 18 status items — Builder note accurate).
- 5.4 (repaired tick): re-verified — roots absent from the worktree and from
  `origin/<branch>`, config names `agento-docs`, after-JSON `applied`/`identical:
  true`, import commit `d9a0dfc` carries every pre-move blob byte-identically (item 9).
  The repair note is consistent with git history (the roadmap moved into the half in
  the same step).
- 5.5: `artifact-pr: "#1"` in the header; PR #45 body contains the companion PR URL
  and PR agento-docs#1 body contains the code PR URL; both draft, both OPEN.
- 5.6: `git ls-tree -r --name-only HEAD | grep -c '^features/\|^issues/\|^initiatives/'`
  = 0; `.github/agento.json` tracked; clean; 0 ahead.
- 5.7: `evidence/step-5-7-session-converted.md` present on the companion branch;
  `session --pr` and primary `ship-preflight` re-derived (items 2, 10).
- 6.1: `evidence/step-6-1-migrate-smoke.md` present; second pass re-driven (item 11).
- 6.2: gate re-run with identical counts (item 12).
- 6.3: `origin/main` is an ancestor of HEAD in both halves; `status: in-review`,
  `next-step: ""`; both halves clean and 0 ahead.
- 6.4 `(manual, post-ship)`: correctly unticked under the §4 exception.

## Findings

No finding above minor severity.

- **Minor — relative `migrate` destination resolves against the cwd, not `--root`.**
  `scripts/agento.mjs` L1314 `path.resolve(process.cwd(), rest[0])`: `node
  scripts/agento.mjs migrate ../<name> --root <product>` from another directory fails
  `not-a-checkout` naming `<cwd>/../<name>`. The prompt runs the command from the
  product root (M1/M4) so the documented path is unaffected, and the error message is
  clear. Consider resolving relative destinations against `root` or stating the
  cwd rule in the usage line.
- **Minor — `agento-init.prompt.md` M8 names only `gh pr edit --body`,** which the
  smoke showed failing on gh 2.45.0; already a Builder follow-up.
- **Minor — plan count off by one** (item 9: 19 vs 20 records) — explained above;
  no artifact rewrite needed.
- Security: no secrets in any evidence file or PR body; `migrate` performs no git
  writes (the guard governs every commit/push); config writes use `JSON.stringify` on
  parsed input; the origin-URL parse in `productName()` is used only for README prose.

## Follow-ups

- CLI: resolve a relative `migrate <destination>` against `--root` (or document that
  it is cwd-relative) so `--root` invocations behave like the in-directory ones.
- Prompt: document the `gh api -X PATCH repos/<owner>/<repo>/pulls/<n> -f body=…`
  fallback for M8 (`gh pr edit --body` fails on gh 2.45.0) — duplicate of the
  Builder's roadmap follow-up, kept here so triage sees it from the review too.
- CLI: `status`/`initiative` from a build worktree in companion mode should walk the
  session's companion half, not only the clone's default branch (Builder follow-up;
  surfaced by acceptance item 13).
