# Review: role-active-profiles

Verdict: approve

Round 3 — 2026-10-22. Reviewed product `feature/role-active-profiles` at `03f687a`
(PR david-perry-software/agento#127, draft, `mergeStateStatus: CLEAN`, `origin/main`
`ed9cb36` is an ancestor, `origin/feature/role-active-profiles` = HEAD) and the
companion half at `4b59299` (PR agento-docs#64, draft, `origin/main` `88052a3` is an
ancestor, `dirty: false`, `ahead: 0`, `behind: 0`). Round 2 approved at `ada5659` /
`b686d7a`; the user's `/agento ship` audit then rejected with the hard gap
`changelog-heading-without-version` (CHANGELOG.md carried `## 0.12.0 (unreleased)`
while every `"version"` was still `0.11.0`). The Builder landed step 4.3 (`03f687a`
product, `4b59299` companion) to close it. This round re-verifies that delta in full
and re-runs the whole gate; rounds 1–2's findings and evidence are summarised where
they still apply. Skills consulted: none — the repository has no `## Agento` skills
table and no `.agents/skills/`, matching plan.md `## Research`.

Verification run by the Reviewer in the product worktree at `03f687a`:

- **Delta `ada5659..HEAD`** — exactly one commit (`03f687a chore(release):
  role-active-profiles — 4.3 bump version to 0.12.0`); `git diff --stat` = 4 files,
  +5/−5: `.claude-plugin/plugin.json:4`, `package.json:3`, `extension/package.json:5`
  (one line — the `npm version` reformat was reverted as the step records),
  `extension/package-lock.json:3` and `:9`. Every hunk is `"version": "0.11.0"` →
  `"0.12.0"`; nothing else changed. All four files still parse as JSON (`JSON.parse`
  on each → ok). `grep -n '"version": "0.12.0"'` over the four files → 5 lines, as
  the step's verify states. No other `0.11.0` reference remains outside
  `CHANGELOG.md` history (`grep -rn '0\.11\.0'` over `*.json|*.md|*.mjs|*.ts`,
  excluding `node_modules` and `CHANGELOG.md` → none). The file set matches the
  previous member's bump `dcbe9ee` (minus its CHANGELOG hunk, which step 3.3 already
  landed).
- **Ship audit replay** (`scripts/agento.mjs:2993-3008` `changelogFacts`, gap at
  `:3067`): `origin/main:.claude-plugin/plugin.json` → `0.11.0`, `HEAD:` → `0.12.0`,
  so `versionChanged: true`, `from: 0.11.0`, `to: 0.12.0`; `HEAD:CHANGELOG.md`
  unreleased heading → `0.12.0`; therefore `headingWithoutVersionChange: false` (the
  hard gap no longer fires) and `needsStamp: true` (the expected *confirm* gap
  `changelog-unstamped`, which ship stamps with today's date). `origin/main:
  CHANGELOG.md` still tops out at `## 0.11.0 (2026-10-22)`, so the heading is new
  to this branch.
- **Companion delta `b686d7a..HEAD`** — one commit `4b59299`, `roadmap.md` +1 line:
  step `4.3 (added 2026-10-22)`; no other artifact changed.
- `/tmp/shellcheck-v0.10.0/shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`
  → exit 0, no findings (baseline: exit 0, none). `git diff --stat origin/main...HEAD
  -- scripts/hooks scripts/wait-for-checks.sh` → empty; the delivery touches no shell
  file.
- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → 641 tests, 641 pass,
  0 fail, 0 `not ok`, exit 0 (baseline 612/612; equals the 4.1 record). This run
  includes `tests/customizations.test.mjs:997` ("… plugin.json, package.json, and
  extension/package.json versions differ"), `tests/publish-replay.test.mjs`, and
  `tests/extension-bundle.test.mjs` — the three suites step 4.3 names.
- `diff -q skills/agento/commands/models.md .github/prompts/models.prompt.md` →
  silent; `cmp scripts/agento.mjs extension/cli/agento.mjs` and `cmp
  scripts/model-profiles.mjs extension/cli/model-profiles.mjs` → byte-identical.
- Doc greps re-run: `## Window roles` at `docs/model-profiles.md:246`; `grep -c "One
  profile is active per clone"` → 0; `README.md:443` lists `use <name\|none> --role
  primary\|secondary`; `CHANGELOG.md:3` is `## 0.12.0 (unreleased)` with an
  **Added** entry; `grep -n "window role"` hits `skills/agento/SKILL.md:62` and
  `.github/agents/delivery-autopilot.agent.md:69`.
- **Headline CLI smoke re-driven at `03f687a`** in this build worktree against a
  fresh `AGENTO_CONFIG_HOME`: `models create b` + `update b` (builder `Claude Opus 5.5
  (copilot)`, reviewer list) → ok; `models use b --role secondary` → `ok`,
  `roles: {"secondary":"b"}`, `written: true`; `models pins` → `windowRole: build`,
  `role: secondary`, `roleSource: window`, `source: role-profile`, `profile: b`,
  `builder.subagentModel = Claude Opus 5.5 (copilot)`, `reviewer.subagentModel =
  GPT-5 (copilot)`; `models pins --role primary` → `role: primary`, `roleSource:
  flag`, `source: file-pins`; `models use none --role secondary` → `ok`, `{"secondary":
  null}`; the config home held only `model-profiles.json` and `model-roles.json` (no
  `.tmp`); the product porcelain was empty afterwards. Matches step 2.6's recorded
  statuses 4–7, 9–10 and round 2's reproduction.
- `git status --porcelain --untracked-files=all` → empty in both halves at review
  start and after the smoke and test run (the suite log was written to `/tmp` and
  deleted).
- Both PRs are `OPEN`, `isDraft: true`, `mergeable: MERGEABLE`; the code PR is
  `mergeStateStatus: CLEAN`.

## Acceptance checklist results

1. **Pure helpers** (`rolesFile`, `parseRoles`, `serializeRoles`, `roleBucket`) —
   **pass**. `scripts/model-profiles.mjs` unchanged since round 1; its tests are in
   the 641/641 run.
2. **`use <name> --role secondary`** (`not-found`/`invalid` exit 3, atomic write,
   `--expect` → `conflict` byte-identical, no temp files, `use none` turns off) —
   **pass**. `writeRoles` unchanged since round 2; tests pass; the smoke above shows
   `ok`/`written: true`/no `.tmp`/`secondary: null`.
3. **`use … --role primary` ≡ `apply`/`clear`; usage errors exit 1** — **pass**.
   Shared `pinModels` tail unchanged since round 2; the tests pass in the full run.
4. **`models list` reports `roles`/`rolesFile`** — **pass**. Unchanged; tests pass.
5. **`models pins` resolves by window role** — **pass**. Re-driven above
   (`role-profile` in this build worktree, `file-pins` under `--role primary`); the
   build/freehand/primary fixture tests, the off → deep-equal test, and the
   dangling/invalid fallback tests pass.
6. **Rename/delete keep roles consistent; `none` reserved** — **pass**. Unchanged since
   round 2; tests pass (including `assigned` exit 3 and `roles-failed` agreement by
   reading, F4 below).
7. **Doctor `model-profile` names both roles and warns** — **pass**. Unchanged since
   round 2 (`secondary: <name|off|invalid>`); the doctor check-list test passes.
8. **Real-CLI smoke recorded on the step** — **pass**. Recorded on 2.6 and 2.7;
   reproduced at `03f687a` (Verification above).
9. **Instructions** (`models.md` ≡ prompt; SKILL.md and Autopilot sentences) — **pass**.
   `diff -q` silent; both `window role` greps hit; `tests/customizations.test.mjs`
   passes.
10. **User docs** (Window roles section, Limits reworded, README `use`, CHANGELOG
    0.12.0 Added) — **pass**. Greps above. The version files now agree with the
    heading, which is what the ship audit required.
11. **`extension/cli/` byte copy** — **pass**. `cmp` identical; bundle test passes.
12. **Lint gate** — **pass**. shellcheck v0.10.0 exit 0 / no findings (= baseline);
    full suite 641/641, exit 0 (baseline 612/612, all still green; no new or
    undocumented lint finding, no overlap with shell files).
13. **Both halves clean at handoff** — **pass**. Empty porcelain in both halves;
    `review-publish` re-checks at publish.

13 of 13 pass. No item is deferred to post-ship; the roadmap has no `(manual)` or
`(manual, post-ship)` steps.

## Plan vs implementation

- Steps 1.1–3.3 and 4.1–4.2 are as approved in round 2; the only code delta since
  is the version bump, which plan.md did not list (its `## Approach` item 10 names
  the CHANGELOG heading but not a `"version"` bump). The bump is required by the
  ship audit's invariant (`changelog-heading-without-version`) and follows the
  convention of the previous member (`dcbe9ee`), so it is a documented, necessary
  addition recorded as roadmap step 4.3 rather than an undocumented change.
- Documented deviations from rounds 1–2 stand: `writeRoles` replaces an invalid
  CLI-owned `model-roles.json` (option (a) of step 2.7, recorded in
  `docs/model-profiles.md` and `models.md`), and doctor's detail reads `secondary:
  <name|off|invalid>` (step 2.8).
- `rolePins` still duplicates `modelsPins`' per-alias body (N1, nit, unchanged).

## Roadmap audit

All 15 ticked steps were checked; none is falsely ticked. Repairs this round:

- `next-step` in the header updated from "review round 2 after request-changes fixes
  (2.7, 2.8, 4.1, 4.2)" to "review round 3 after the 4.3 version bump (ship audit gap
  changelog-heading-without-version)" so the pointer names the state actually under
  review. `status` stays `in-review`; `/agento ship` moves it on.

Spot-checks:

- `4.3 (added 2026-10-22)` — the diff is exactly the four files / five lines the step
  records; `extension/package.json` carries a one-line change (reformat reverted as
  stated); `grep -n '"version": "0.12.0"'` → 5 lines; the three named test files pass
  inside the full run. The ship-audit replay confirms the gap is closed. Correctly
  ticked.
- `4.1` — its 641/641 and shellcheck-exit-0 record reproduces at `03f687a` (the step
  was recorded before 4.3; the full suite re-run here covers the bump).
- `4.2` — `origin/main` is an ancestor of both halves' HEAD; both `ahead: 0`, clean;
  the code PR is `CLEAN`.
- `2.6`, `2.7` smoke statuses — reproduced (headline subset at `03f687a`; the full
  ten-call and invalid-file sequences at `ada5659` in round 2, with no code change
  since in those paths).
- `1.1`–`2.5`, `2.8`, `3.1`–`3.3` — files unchanged since round 2's audit; their
  greps/diffs re-run above.

No `(manual)` or `(manual, post-ship)` steps exist, so no evidence file is required.

## Findings

No finding above minor severity.

**F5 — minor — the version bump was discovered at ship, not planned.** plan.md
`## Approach` item 10 and step 3.3 add the `## 0.12.0 (unreleased)` CHANGELOG heading
without the matching `"version"` bump that `/agento ship`'s audit enforces
(`scripts/agento.mjs:3067`). The Builder repaired it correctly in 4.3, so nothing is
outstanding; recorded so the Planner template for future members pairs the two.

**F4 — minor — the `roles-failed` branch of `rename`/`delete` has no test** (carried
from round 2, unchanged). Reachable only when `writeRoles` fails after the profiles
write succeeded; verified by reading; not provokable from a CLI subprocess without
root. Not blocking.

**N1 — nit — `rolePins` repeats `modelsPins`' per-alias body** (carried, unchanged).
No action required.

Round 1 findings F1, F2, F3 remain closed (round 2 evidence). No security concerns:
the delta is four version strings; the roles-file design (CLI-owned, validated,
atomic, `--expect`-guarded, no secrets, no `gh` call in `currentWindowRole()`) is
unchanged.

## Follow-ups

- When a member feature adds a `## <x.y.z> (unreleased)` CHANGELOG heading, plan the
  `"version"` bump in the same step (`package.json`, `.claude-plugin/plugin.json`,
  `extension/package.json`, `extension/package-lock.json`) so the ship audit's
  `changelog-heading-without-version` gap cannot fire (F5).
- Share the per-alias pin-entry construction between `modelsPins` and `rolePins`
  (N1) — a small refactor outside this delivery's acceptance scope.
- Make `writeRoles`' failure branch testable (export it, or route the fs through an
  injectable module) and add the `roles-failed` test step 2.7 named (F4).
- `loadRoles` and `loadProfiles` both `readFileSync` an existing path without a
  guard, so a `model-roles.json` that is a directory throws EISDIR uncaught instead
  of being reported as `invalid`; pre-existing shape shared with the profiles file,
  out of scope here.
