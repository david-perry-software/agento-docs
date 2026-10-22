# Review: role-active-profiles

Verdict: request-changes

Round 1 — 2026-10-22. Reviewed product `feature/role-active-profiles` at `d51b26f`
(PR david-perry-software/agento#127, `origin/main` is an ancestor) and the companion
half at `565cb0c` (PR agento-docs#64). Skills consulted: none — the repository has no
`## Agento` skills table and no `.agents/skills/`, matching plan.md `## Research`.

Verification run by the Reviewer in the product worktree:

- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → 638 tests, 638 pass,
  0 fail, exit 0 (baseline 612/612; +26 are this delivery's tests).
- `/tmp/shellcheck-v0.10.0/shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`
  → exit 0, no findings (baseline: exit 0, none). The delivery touches no shell file.
- `node --test scripts/model-profiles.test.mjs tests/extension-bundle.test.mjs
  tests/customizations.test.mjs` → 108/108, exit 0.
- `diff -q skills/agento/commands/models.md .github/prompts/models.prompt.md` → silent.
- `cmp scripts/agento.mjs extension/cli/agento.mjs` and `cmp
  scripts/model-profiles.mjs extension/cli/model-profiles.mjs` → byte-identical.
- The step 2.6 ten-call CLI smoke, re-driven against a fresh `AGENTO_CONFIG_HOME` in
  this build worktree: every status matched the values recorded on the step
  (`6: windowRole=build, role=secondary, source=role-profile,
  builder.copilotModel=claude-opus-5.5, reviewer.subagentModel="GPT-5 (copilot)"`;
  `8: assigned`, exit 3; `10: role=secondary, source=file-pins`); no `.tmp` left.
- `git status --porcelain --untracked-files=all` → empty in both halves at the start
  of the review.

## Acceptance checklist results

1. **Pure helpers** (`rolesFile`, `parseRoles`, `serializeRoles`, `roleBucket`) —
   **pass**. Present in `scripts/model-profiles.mjs` (diff `origin/main...HEAD`);
   five new tests in `scripts/model-profiles.test.mjs` cover path resolution
   (AGENTO_CONFIG_HOME / XDG / home), the valid shapes, unknown key / numeric /
   uppercase / array / invalid JSON / non-object errors, the round-trip, and all five
   window roles plus unknown. `node --test scripts/model-profiles.test.mjs` exits 0.
2. **`use <name> --role secondary`** — **pass**. `writeRoles` (`scripts/agento.mjs`)
   re-reads/compares, honours `--expect` (absent file never matches), writes `wx`
   temp + fsync + rename keeping the mode. Tests: "writes and clears the roles file",
   "rejects a missing or invalid profile without writing", "honors --expect", "leaves
   no temp files and keeps the mode" all pass in the full run.
3. **`use … --role primary` ≡ `apply`/`clear`** — **pass**. The apply/adopt/clear
   tail is factored into `pinModels({ mode, verb, … })` and `use --role primary`
   calls it with `mode: apply|clear`. Tests: "changes the same files as apply and
   clear", "from a linked worktree reports worktree", "usage errors: missing --role
   and --expect with --role primary" (exit 1) pass.
4. **`models list` reports `roles`/`rolesFile`** — **pass**. Smoke step 5 printed
   `roles={primary:custom,secondary:b}`; tests "list reports roles" and "list reports
   rolesErrors … still exits 0" pass.
5. **`models pins` resolves by window role** — **pass**. Smoke step 6 in this build
   worktree: `windowRole: "build"`, `role: "secondary"`, `roleSource: "window"`,
   `source: "role-profile"`, builder `copilotModel: claude-opus-5.5`, reviewer
   `subagentModel: "GPT-5 (copilot)"`; step 7 `--role primary` → `roleSource: "flag"`,
   `source: "file-pins"`. Tests cover the managed build and freehand fixtures, the
   primary checkout, both flag overrides, off → deep-equal to file pins, dangling and
   invalid → `file-pins` + warning, and outside a repository → `unmanaged`/`primary`.
   The warning *text* for the invalid-file case is wrong (Finding F1), but the
   checklist item's wording (falls back with a warning) is met.
6. **Rename/delete keep roles consistent; `none` reserved** — **pass**. Smoke step 8:
   `delete b` → `assigned`, exit 3, then `use none` → `secondary: null`. Tests:
   rename moves the assignment with `secondaryBefore`, non-assigned rename leaves the
   file byte-identical, delete refuses / `--force` turns off, `active` is checked
   before `assigned`, `create none` and `rename a none` exit 1.
7. **Doctor `model-profile` names both roles and warns** — **pass**. Driven on a
   throwaway plugin root: invalid file → `warn` with `… has 1 error(s) …; primary:
   custom; secondary: a`; dangling → `warn` "the secondary role names \"gone\" …";
   healthy path appends `; primary: …; secondary: a`. The doctor check-list test is
   unchanged and passes. The invalid-file fallback text is affected by F1 (it names
   `use none` as one of two options; the other, "fix or delete", works).
8. **Real-CLI smoke recorded on the step** — **pass**. Recorded on 2.6 and reproduced
   by the Reviewer (see Verification above).
9. **Instructions** — **pass**. `diff -q` silent; `models.md` documents `use`,
   `--role`, `roles`, the `pins` role fields, `assigned`, and the `next:` rules;
   `grep -n "window role"` hits `skills/agento/SKILL.md:62` and
   `.github/agents/delivery-autopilot.agent.md:69`; `tests/customizations.test.mjs`
   passes.
10. **User docs** — **pass**. `grep -n "## Window roles" docs/model-profiles.md` →
    line 246; `grep -c "One profile is active per clone"` → 0; "Subagents and
    handoffs" carries the secondary-window direct-selection note; `README.md:443`
    lists `use <name|none> --role primary|secondary`; `CHANGELOG.md:3` is
    `## 0.12.0 (unreleased)` with an **Added** entry.
11. **`extension/cli/` byte copy** — **pass**. `cmp` identical;
    `tests/extension-bundle.test.mjs` exits 0.
12. **Lint gate** — **pass**. shellcheck exit 0 / no findings (= baseline); full suite
    638/638, exit 0.
13. **Both halves clean at handoff** — **pass** (empty porcelain in both halves).

13 of 13 pass. The verdict is driven by Finding F1 below, not by a checklist failure.

## Plan vs implementation

- The implementation follows `## Approach` items 1–10 closely: the roles file, the
  `--role` option, `use`, role-resolved `pins`, rename/delete consistency, doctor,
  instructions, docs, and the header usage comment are all present where the plan
  put them.
- **Internal plan inconsistency surfaced by the code.** `## Approach` item 2 says
  `writeRoles` refuses a file with errors (`invalid`, left untouched), and item 6 says
  an invalid roles file "does the same" as a dangling assignment — a warning "naming
  the assignment and the fix (`models use none --role secondary` …)". Both halves
  were implemented literally, so for an invalid roles file the advertised fix is
  refused by the writer (F1). The plan did not resolve which rule wins; the added
  roadmap step 2.7 asks the Builder to pick one and apply it consistently.
- No undocumented behaviour changes found: `apply`/`adopt`/`clear` route through the
  shared `pinModels` tail with the same checks, messages, and output shape as before;
  the pre-existing `models` tests all pass.
- `rolePins` duplicates the `modelsPins` loop body (name/file/subagentModel/
  copilotModel derivation) rather than sharing it — acceptable, noted as a nit.

## Roadmap audit

All 12 ticked steps were spot-checked against the codebase and the test run; none
was falsely ticked. Repairs made:

- Added `2.7 (added 2026-10-22)` under Phase 2 for F1/F2 (make the invalid-roles-file
  remediation work; make `rename`/`delete`'s follow-up roles-write failure report a
  status that agrees with its exit code), with its tests and a CLI verify.
- Unticked `4.1` and `4.2` (annotated "unticked 2026-10-22 by review") so the lint
  gate, the full suite, and the `origin/main` integration are re-run after 2.7 lands;
  their recorded results were true for `d51b26f` and will be stale once code changes.
- `next-step` now names 2.7. `status` stays `in-review`; the Builder's resume
  protocol sets `in-progress` when it picks the step up.

No `(manual)` or `(manual, post-ship)` steps exist in this roadmap, so no evidence
file is required and nothing is deferred to post-ship.

## Findings

**F1 — moderate — the remediation advertised for an invalid `model-roles.json` does
not work.** `scripts/agento.mjs`, `pins` verb: when `loadedRoles.errors.length`, the
warning reads "the roles file … has errors and was ignored; run models use none
--role secondary to turn the secondary role off". Doctor's `model-profile` fallback
for the same state names the same command as one of two options. But `writeRoles`
step 2 returns `{ status: "invalid", message: "the roles file has errors and was
left untouched" }` (exit 3) whenever the current file has errors. Reproduced:

```
$ echo '{"secondary":"a","extra":1}' > $AGENTO_CONFIG_HOME/model-roles.json
$ agento.mjs models pins   → warnings: ["… run models use none --role secondary to turn the secondary role off"]
$ agento.mjs models use none --role secondary
{"status":"invalid","message":"the roles file has errors and was left untouched","errors":["unknown top-level key \"extra\""]}
```

The `pins` warning is the only advice a secondary window gets, and it is a dead end;
`scripts/agento.test.mjs` ("models pins warns and falls back … for a dangling or
invalid secondary") asserts the broken text for the `Bad_Name` case, so the test
enshrines it. Either let `use … --role secondary` replace an invalid CLI-owned file
(when `--expect` is absent or matches), or change the invalid-file warning and
fallback to the working action (fix or delete the file). Roadmap step 2.7.

**F2 — minor — `rename`/`delete` report `status: "ok"` with exit 3 when the
follow-up roles write fails.** `scripts/agento.mjs`, `rename` and `delete` verbs:
`emit({ verb, profile, ...result, secondaryBefore, rolesWrite }, rolesWrite.code)`
spreads the profiles write's `status: "ok", written: true` and exits with the roles
write's code. Reproduced with an invalid roles file and `rename a b`: exit 3, body
`{"status":"ok","written":true,"secondaryBefore":"a","rolesWrite":"invalid"}`, the
profile renamed, the roles file untouched. The partial outcome is by design (plan
`## Risks`), but status and exit code should agree. Folded into step 2.7.

**F3 — minor — doctor's `rolesDetail` reports `secondary: a` for an invalid roles
file that `pins` ignores.** `parseRoles` returns the valid `secondary` value even
when an unrelated unknown key produced an error, so the doctor detail says
`secondary: a` while `pins` treats the role as off. Consider `secondary: invalid`
(or `off`) in the detail when `loadedRoles.errors.length`. Cosmetic; can ride along
with 2.7 or be left.

**N1 — nit — `rolePins` repeats `modelsPins`' per-alias body.** Both loops build
`{ name, file, model, subagentModel, copilotModel }` identically except for where
`model` comes from; a shared `pinEntry(text, rel, model, copilotModels)` would keep
them from drifting. No action required for approval.

No security concerns: the roles file holds a profile name only, is written under the
user's config home with the existing atomic pattern, and no secrets or external
calls are involved. `currentWindowRole()` makes no `gh` call (verified: it reads
`productWorktrees()` and `deriveRole` only) and falls back to `unmanaged`.

## Follow-ups

- Share the per-alias pin-entry construction between `modelsPins` and `rolePins`
  (N1) — a small refactor outside this delivery's acceptance scope.
- Resolve the plan-level rule for CLI-owned state files: whether a validated writer
  may replace an invalid file it owns (`model-roles.json`) versus a user-authored
  one (`model-profiles.json`). Whichever option 2.7 picks, record the rule in
  `docs/model-profiles.md` so `role-profile-sidebar` and `chat-model-preselect`
  follow it.
