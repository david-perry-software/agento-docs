# Review: role-active-profiles

Verdict: approve

Round 2 — 2026-10-22. Reviewed product `feature/role-active-profiles` at `ada5659`
(PR david-perry-software/agento#127, draft, `origin/main` is an ancestor) and the
companion half at `b5f63bf` (PR agento-docs#64, draft, `origin/main` is an
ancestor, `dirty: false`, `ahead: 0`). Round 1 (`d51b26f`) requested changes for F1
(invalid-roles-file remediation was a dead end), F2 (`rename`/`delete` `status: "ok"`
with exit 3), F3 (doctor detail named a profile `pins` ignored) and nit N1. The
Builder landed steps 2.7 and 2.8 (`3dce8d0`, `ada5659`) and re-ran 4.1/4.2. Skills
consulted: none — the repository has no `## Agento` skills table and no
`.agents/skills/`, matching plan.md `## Research`.

Verification run by the Reviewer in the product worktree at `ada5659`:

- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → 641 tests, 641 pass,
  0 fail, exit 0 (baseline 612/612; matches the 4.1 record). New since round 1 and
  passing: "models use --role secondary replaces an invalid roles file", "models
  rename and delete --force repair an invalid roles file", "doctor model-profile
  reports secondary invalid when the roles file has errors".
- `/tmp/shellcheck-v0.10.0/shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`
  → exit 0, no findings (baseline: exit 0, none). The delivery touches no shell file.
- `diff -q skills/agento/commands/models.md .github/prompts/models.prompt.md` → silent;
  `cmp scripts/agento.mjs extension/cli/agento.mjs` and `cmp
  scripts/model-profiles.mjs extension/cli/model-profiles.mjs` → byte-identical.
- **F1 re-driven verbatim per step 2.7's verify** against a fresh
  `AGENTO_CONFIG_HOME` holding `{"secondary":"a","extra":1}`, in this build worktree:
  `models pins` → `role: secondary`, `windowRole: build`, `source: file-pins`,
  warning "… has errors and was ignored; run models use none --role secondary …";
  `models use none --role secondary` → `status: ok`, `written: true`,
  `rolesErrors: []`, exit 0; `models pins` re-run → `warnings: []`; the file is
  `{ "secondary": null }`; no `.model-roles.json.*.tmp` left. `use a --role
  secondary --expect <rolesFile.hash>` on an invalid file → `ok`; a stale 64-hex
  `--expect` → `conflict`, exit 3, file byte-identical (step 1 of `writeRoles` still
  guards the replacement).
- **F3 re-driven**: `doctor --plugin-root <tmp>` with the invalid file → `warn`,
  detail `… has 1 error(s), first: unknown top-level key "extra"; primary: none;
  secondary: invalid`; after the repair → `ok`, `…; secondary: a`.
- **F2 verified by reading** `scripts/agento.mjs:5147-5149` and `:5163-5165`: both
  follow-up-failure branches now emit `status: "roles-failed"` with a message naming
  the partial outcome and exit `rolesWrite.code` (3), so status and exit agree. The
  branch cannot be provoked from the CLI without root — the profiles file shares the
  directory, so a read-only directory fails the profiles write first (reproduced:
  `rename a b` → `status: failed`, roles untouched) — see Finding F4.
- The step 2.6 ten-call smoke re-driven at `ada5659` against a fresh config home:
  every status matched the values recorded on the step (6: `windowRole=build,
  role=secondary, roleSource=window, source=role-profile,
  builder.copilotModel=claude-opus-5.5, reviewer.subagentModel="GPT-5 (copilot)"`;
  7: `role=primary, roleSource=flag, source=file-pins`; 8: `assigned`, exit 3; 9:
  `secondary: null`; 10: `role=secondary, source=file-pins, warnings=[]`); no `.tmp`
  left; product worktree porcelain empty afterwards.
- `git status --porcelain --untracked-files=all` → empty in both halves at the start
  of the review.

## Acceptance checklist results

1. **Pure helpers** (`rolesFile`, `parseRoles`, `serializeRoles`, `roleBucket`) —
   **pass**. Unchanged since round 1 (`scripts/model-profiles.mjs:21-52` and `:202-221`,
   `ROLE_BUCKETS`/`roleBucket`); `scripts/model-profiles.test.mjs` covers path
   resolution, valid shapes, every error class, the round-trip, and all five window
   roles plus unknown. Part of the 641/641 run.
2. **`use <name> --role secondary`** — **pass**. `writeRoles`
   (`scripts/agento.mjs:3723-3761`) pins the current bytes, honours `--expect`,
   re-parses the candidate, writes `wx` temp + fsync + rename keeping the mode. Tests
   137–141 pass, including the new "replaces an invalid roles file". The CLI
   re-drive above confirms `ok`/`conflict`/no temp files.
3. **`use … --role primary` ≡ `apply`/`clear`** — **pass**. Shared `pinModels` tail;
   tests "changes the same files as apply and clear", "from a linked worktree reports
   worktree", "usage errors: missing --role and --expect with --role primary" pass.
4. **`models list` reports `roles`/`rolesFile`** — **pass**. Smoke step 5 →
   `roles={primary:null,secondary:b}, rolesFile.exists=true` (primary is the fixture
   root's derived `active`); tests 99–100 pass.
5. **`models pins` resolves by window role** — **pass**. Smoke steps 6, 7, 10 above;
   invalid-file fallback re-driven (file pins + a warning whose command now works,
   closing round 1's caveat). Tests cover build/freehand fixtures, the primary
   checkout, both flag overrides, off → deep-equal to file pins, dangling and invalid
   → `file-pins` + warning, outside a repository → `unmanaged`/`primary`.
6. **Rename/delete keep roles consistent; `none` reserved** — **pass**. Smoke step 8
   `assigned`, exit 3; test 152 shows rename/`delete --force` also repair an invalid
   roles file; `create none`/`rename a none` exit 1 tests pass. The follow-up-failure
   status now agrees with its exit code (F2 closed).
7. **Doctor `model-profile` names both roles and warns** — **pass**. Re-driven: the
   invalid-file case now reads `secondary: invalid` (F3 closed) and its fallback's
   `models use none --role secondary` command succeeds (F1 closed); dangling and
   invalid-profile paths unchanged from round 1; the doctor check-list test is
   unchanged and passes (test 49 added alongside).
8. **Real-CLI smoke recorded on the step** — **pass**. Recorded on 2.6 and 2.7 and
   reproduced by the Reviewer at `ada5659` (Verification above).
9. **Instructions** — **pass**. `diff -q` silent; `models.md:75-81` documents `use`,
   the CLI-owned repair rule, `--role`, `roles`, the `pins` role fields, `assigned`
   and the `next:` rules; `grep -n "window role"` hits `skills/agento/SKILL.md:62`
   and `.github/agents/delivery-autopilot.agent.md:69`; `tests/customizations.test.mjs`
   passes in the full run.
10. **User docs** — **pass**. `grep -n "## Window roles" docs/model-profiles.md` →
    line 246; `grep -c "One profile is active per clone"` → 0; `docs/model-profiles.md:264-268`
    records the CLI-owned-vs-user-authored rule and `:285-287` the
    `<name|off|invalid>` doctor detail; `README.md:443` lists `use <name|none> --role
    primary|secondary`; `CHANGELOG.md:3` is `## 0.12.0 (unreleased)` with an
    **Added** entry.
11. **`extension/cli/` byte copy** — **pass**. `cmp` identical for both files;
    `tests/extension-bundle.test.mjs` passes in the full run.
12. **Lint gate** — **pass**. shellcheck v0.10.0 exit 0 / no findings (= baseline);
    full suite 641/641, exit 0.
13. **Both halves clean at handoff** — **pass** (empty porcelain in both halves at
    review start and after the smokes; `review-publish` re-checks at publish).

13 of 13 pass. No item is deferred to post-ship (the roadmap has no `(manual)` or
`(manual, post-ship)` steps).

## Plan vs implementation

- The implementation follows `## Approach` items 1–10. Round 1's plan-level
  inconsistency (item 2 "refuse an invalid file" vs item 6 "the fix is `use none`")
  is resolved by step 2.7 choosing option (a): `writeRoles` treats
  `model-roles.json` as CLI-owned and replaces an invalid current file after the
  conflict/`--expect` checks, while `writeProfiles` keeps refusing an invalid
  user-authored profiles file. The rule is recorded in `docs/model-profiles.md`,
  `models.md`, and the `writeRoles` comment, so it is a documented deviation from
  `## Approach` item 2, not an undocumented one.
- Step 2.8 extends `## Approach` item 8's detail format to `secondary:
  <name|off|invalid>`; docs updated to match.
- No other behaviour changes since round 1: the diff `d51b26f..HEAD` touches only
  `writeRoles` step 2, the two `roles-failed` emits, `rolesDetail`, three tests, and
  the docs/instruction wording (plus the `extension/cli/` mirror).
- `rolePins` still duplicates `modelsPins`' per-alias body (N1, unchanged, nit).

## Roadmap audit

All 14 ticked steps were spot-checked against the codebase and the test run; none is
falsely ticked, and no repairs were needed this round:

- `2.7` — the F1 option (a) change, the F2 `roles-failed` status, the three
  behaviours listed under "Tests:" (the first two have tests 141 and 49/152; the
  third, the follow-up-failure status, is verified by reading only — Finding F4),
  the verify line (`node --test …` exit 0 and the invalid-file smoke) all check out;
  the recorded smoke statuses reproduce.
- `2.8` — `rolesDetail` and the docs wording changed as described; test 49 added.
- `4.1` — re-recorded 641/641 and shellcheck exit 0; reproduced here.
- `4.2` — `origin/main` is an ancestor of both halves' HEAD; both halves `ahead: 0`,
  clean.
- Steps 1.1–2.6 and 3.1–3.3 were audited in round 1 at `d51b26f` and their files are
  unchanged since, except the models.md/prompt wording extension under 3.1 (still
  byte-identical to each other).

No `(manual)` or `(manual, post-ship)` steps exist, so no evidence file is required.
`status` stays `in-review`; `/agento ship` moves it on.

## Findings

**F4 — minor — the `roles-failed` branch of `rename`/`delete` has no test.**
`scripts/agento.mjs:5148` and `:5164` are reached only when `writeRoles` fails after
the profiles write succeeded; with option (a) the remaining causes are a concurrent
change to `model-roles.json` between load and write (`conflict`) or an fs error on
the temp/rename. Neither can be provoked from a CLI subprocess without root (the
read-only-directory approach fails the profiles write first, as reproduced). The
branch is five lines and was verified by reading; a unit-level test would need
`writeRoles` to be importable or an injectable fs. Not blocking.

**N1 — nit — `rolePins` repeats `modelsPins`' per-alias body.** Carried over from
round 1 unchanged; a shared `pinEntry(text, rel, model, copilotModels)` would keep
them from drifting. No action required.

Round 1 findings **F1, F2, F3 are closed** (evidence in Verification above).

No security concerns: the roles file holds a profile name or `null`, lives under the
user's config home, is validated by `parseRoles` before every write, and is written
with the existing atomic pattern; replacing an invalid CLI-owned file still goes
through the conflict and `--expect` checks. No secrets or external calls are
involved. `currentWindowRole()` makes no `gh` call and falls back to `unmanaged`.

## Follow-ups

- Share the per-alias pin-entry construction between `modelsPins` and `rolePins`
  (N1) — a small refactor outside this delivery's acceptance scope.
- Make `writeRoles`' failure branch testable (export it, or route the fs through an
  injectable module) and add the `roles-failed` test step 2.7 named (F4).
- `loadRoles` and `loadProfiles` both `readFileSync` an existing path without a
  guard, so a `model-roles.json` that is a directory throws EISDIR uncaught instead
  of being reported as `invalid`; pre-existing shape shared with the profiles file,
  out of scope here.
