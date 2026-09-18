# Review: guard-branch-delete-on-main

Verdict: approve

Reviewed 2026-09-18 at product HEAD `dbd9ddf` (`issue/guard-branch-delete-on-main`,
code PR #48, `origin/main` an ancestor, `mergeStateStatus: CLEAN`, draft) and
companion HEAD on the mirrored branch (artifact PR #4, `dirty: false`, `ahead: 0`).
Skills consulted: none — no matching domain (no `.agents/skills/`, no `## Agento`
skills table in AGENTS.md). Every command below was run by the Reviewer; full
transcripts in [evidence/review-verification-2026-09-18.md](evidence/review-verification-2026-09-18.md).

## Acceptance checklist results

1. **Exposing fixtures fail before / pass after** — **pass.** Guard extracted from
   `e8f4da6` (`git archive`) against the current `tests/guard-fixtures.txt`: exit 1,
   exactly the three `allow` lines of the `#47` block reported
   `-> deny (expected allow) MISMATCH`. Current guard: exit 0, 0 MISMATCH, 97 verdicts.
2. **Companion variant** — **pass.** `REPLAY_COMPANION=1 … guard-fixtures-companion.txt`
   exit 0, 0 MISMATCH; `switch trunk && … --delete feature/x` → allow, `:feature/x` →
   allow, `--delete trunk` → deny. Pre-fix guard: exit 1, the two `allow` lines MISMATCH.
3. **Default-branch delete stays denied; content push on `main` stays denied** —
   **pass.** Fixtures `git switch main && git push origin --delete main` / `:main` /
   `HEAD:feature/x` → deny; pre-existing `deny git push origin --delete main` /
   `:main` unchanged and passing. Direct probe: `--delete main` and `:main` → "Deleting
   main on the remote is forbidden."; `HEAD:feature/x`, `feature/x:feature/y`,
   `HEAD:main`, `main`, bare `git push` → "Direct commits/pushes to main are forbidden".
4. **Direct on-`main` probe allows the delete** — **pass.** Reviewer's own script
   (`/tmp/agento-review-probe-on-main.sh`, throwaway repo on `main`, guard at
   `dbd9ddf`): `git push origin --delete feature/copyable-command-blocks` → no output
   (allow); also `:feature/…`, `-d feature/…`, and the `git -C <companion> push origin
   --delete …` form → allow.
5. **Ship prompt names the commands; parity** — **pass.**
   `grep -c 'push origin --delete <branch>' .github/prompts/ship.prompt.md` = 2 (lines
   186, 198: primary and `git -C <artifactsRoot>` forms); `grep -c 'delete-branch'` = 1
   (line 188, "not an alternative because it also deletes the local branch");
   `cmp .github/prompts/ship.prompt.md commands/ship.md` exit 0;
   `node --test tests/customizations.test.mjs` 22/22.
6. **docs/hooks.md** — **pass.** `grep -n 'non-default' docs/hooks.md` hits line 52,
   inside the `| Rule | Decision |` table headed at line 48; the row still ends `| deny |`.
7. **Version and changelog** — **pass.** `package.json` and `.claude-plugin/plugin.json`
   both `0.5.2` (node check exit 0); `sed -n '3p' CHANGELOG.md` → `## 0.5.2 (unreleased)`;
   `#47` appears once in lines 3–12 as a **Fixed.** bullet.
8. **Full gate vs baseline (§5)** — **pass.** shellcheck exit 0, 0 findings (baseline
   0); node `# tests 206 / # pass 206 / # fail 0` (baseline 206); standard smoke exit 0,
   0 MISMATCH; companion smoke exit 0, 0 MISMATCH. No new or undocumented findings.
9. **Scope boundary and PR body** — **pass.** `git diff --name-only origin/main...HEAD`
   lists exactly the nine files from `## Approach`; `gh pr view 48` body starts
   `Fixes #47`.

## Plan vs implementation

- Implemented as designed: one focused change at the blanket rule in
  `scripts/hooks/delivery-guard.sh` (lines 408–410) adding `is_delete_push` and
  exempting it from the `branch == default_branch and is_push` clause only;
  `is_commit`, `is_merge`, `push_to_default`, and the line-381 default-branch delete
  denial are untouched. Ordering preserved: line 381 fires before the blanket rule.
- Fixture blocks match the plan's lists line-for-line (`-d feature/x` and
  `HEAD:feature/x` included in the standard file; three lines in the companion file).
- Deviation in wording only: the plan, the guard comment, and plan.md `## Resolution`
  describe the exemption as "delete-only", but the regex tests for the *presence* of a
  delete refspec (`\s(?:--delete\s+\S+|-d\s+\S+|:[\w./-]+)`), so a mixed refspec list
  (`feature/x :feature/y`) from `main` is also exempt. Not an acceptance item; recorded
  under Findings (minor) and Follow-ups.
- No undocumented changes; the companion diff is plan.md, roadmap.md, and two evidence
  files only.

## Roadmap audit

- 1.1, 1.2 — ticked; fixture lines present verbatim; pre-fix failure independently
  reproduced (exit 1, 3 and 2 MISMATCH respectively). Correct.
- 2.1, 2.2 — ticked; regex and clause match the step text; both smokes green;
  `shellcheck scripts/hooks/delivery-guard.sh` exit 0. Correct.
- 2.3 — ticked; linked [evidence/probe-after-fix.md](evidence/probe-after-fix.md)
  exists with the three outputs at `38fb601`; reproduced at `dbd9ddf`. Correct.
- 3.1, 3.2, 4.1 — ticked; all `verify:` commands rerun and green (see items 5–7).
  Correct.
- 5.1, 5.2 — ticked; gate rerun green, nine-file diff, PR CLEAN / `Fixes #47`,
  session `companion.dirty: false`, `companion.ahead: 0`. Correct.
- No `(manual)` steps; no falsely ticked boxes; no missing-work steps added.
- Repairs: `## Follow-ups` — corrected the `feature/main-thing` claim (the probe shows
  `--delete feature/main-thing` → allow because `/` precedes `main`; only a *bare*
  `main-thing` is affected) and added two follow-up lines from the reviewer's edge
  probes (below).

## Findings

1. **Minor — `refs/heads/<default>` delete spelling not covered.**
   `scripts/hooks/delivery-guard.sh` line 381 matches only `--delete main` / `:main`, so
   `git push origin :refs/heads/main` and `--delete refs/heads/main` are allowed — from
   any non-default branch before this change (pre-existing), and now also from `main`
   because the blanket rule no longer incidentally covers pushes there. The GitHub
   ruleset is the enforcement layer and the plan's `## Out of scope` excludes ruleset
   changes; a one-token regex widening (`(?:refs/heads/)?`) plus fixtures would close it.
   Not blocking: pre-existing gap, not introduced by the delivery's design.
2. **Minor — exemption is "contains a delete refspec", not "delete-only".** Line 409:
   `git switch main && git push origin feature/x :feature/y` → allow. The content half
   is a non-default branch (the class the plan already lists as a Follow-up); anything
   naming the default is still denied by `push_to_default` (probe:
   `-d feature/x main` → deny, `HEAD:main` → deny). The guard comment's "delete-only"
   wording slightly overstates the check.
3. **Info — over-widening checks passed.** `HEAD:<ref>`, `src:dst`,
   `refs/heads/main:refs/heads/feature/x`, `main:feature/x`, bare `main`, `--dry-run`,
   `+:feature/x` (force rule), `--delete feature/x --force` (force rule) all deny from
   `main`; `--delete origin <ref>` (option-before-remote) behaves correctly for both
   `main` (deny via `push_to_default`) and `feature/x` (allow).
4. **Info — security.** No secrets, no new shell-out surface; the change narrows a
   deny in a hook and the hook edit passed through the guard's own `ask` gate
   (commit `38fb601`). shellcheck clean.

## Follow-ups

- Extend the default-branch delete rule to the fully-qualified spelling
  (`--delete refs/heads/<default>` / `:refs/heads/<default>`) with fixtures.
- Tighten `is_delete_push` to "every refspec is a delete" (and reword the comment) if
  the sibling content-push false positives are revisited.
- The pre-existing `main-thing` word-boundary note in roadmap.md `## Follow-ups`
  (corrected wording; unchanged scope).
