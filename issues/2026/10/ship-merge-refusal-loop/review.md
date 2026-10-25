# Review: ship-merge-refusal-loop

Verdict: request-changes

Review round 1, 2026-10-25. Product branch `issue/ship-merge-refusal-loop` at
`21bbce2` (code PR #133, draft, open, `MERGEABLE`/`CLEAN`), companion branch at
`0c10d3a` (artifact PR agento-docs#68, draft, open, `MERGEABLE`/`CLEAN`), issue #132.
After `git fetch origin` in both halves, `origin/main` is an ancestor of both HEADs
(`git merge-base --is-ancestor`, exit 0), both halves are level with their remote
branches (`rev-list --left-right --count` → `0 0`), and the session record reads
`companion.dirty: false`, `ahead: 0`, `behind: 0`.

Skills consulted: none — no matching domain (no `.agents/skills/` in the repository
and no `## Agento` skills table in AGENTS.md); the work is internal to the Agento CLI,
its prompts, and its policy.

Verification re-run by the Reviewer at `21bbce2` (product checkout, 2026-10-25):

| Check | Exit | Result |
| --- | --- | --- |
| `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` | 0 | 815 tests, 815 pass, 0 fail (baseline 808 + 7 new) |
| `node --test --test-name-pattern='#132 ship-merge-refusal-loop' scripts/agento.test.mjs` | 0 | 3/3 pass at HEAD |
| Same pattern against `origin/main` (tree from `git archive`, HEAD's test file copied in) | 1 | 3/3 `not ok` — the exposing tests fail at the planning base |
| `node --test scripts/merge-state.test.mjs` | 0 | 3/3 |
| `node --test tests/customizations.test.mjs` | 0 | 56/56 |
| `node --test scripts/session-state.test.mjs` | 0 | 56/56 |
| `cd extension && npm run test:unit` | 0 | 251/251 |
| `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` (ShellCheck 0.10.0 release binary) | 0 | no findings |
| `cmp .github/prompts/ship.prompt.md skills/agento/commands/ship.md` | 0 | byte-identical |
| `cmp scripts/{agento,merge-state,delivery-roadmap-resolver}.mjs extension/cli/…` | 0 | all three copies identical; `diff -rq scripts extension/cli` shows only `Only in scripts` entries (14, the intentional skips) |
| `grep -n 'reopen.*in-review' docs/commands.md`; `grep -n 'in-review' delivery-policy.instructions.md \| grep reopen` | 1 | nothing left |
| Live read-only check of soshiki#541 through `scripts/merge-state.mjs` (`gh api` + `gh pr view`, never `gh pr merge`) | 0 | `mergeStateStatus: BLOCKED`, required `["Vercel","Modularity report"]`, classic protection 404, `absent: ["Vercel"]`, `classification: blocked` — matches `evidence/step-5-2-soshiki-541-classification.txt` |

Lint gate (§5): the recorded baseline is green (808/808, shellcheck exit 0), so the
full gate applies; fresh results above are green with no new findings.

## Acceptance checklist results

1. **Exposing regression tests fail at the base and pass after the fix — pass.**
   Three tests in `scripts/agento.test.mjs` are named `ship #132
   ship-merge-refusal-loop: …` (BLOCKED, DIRTY, checks-failed). Against an
   `origin/main` tree they fail 3/3 (`# fail 3`, exit 1); at `21bbce2` they pass 3/3.
   Roadmap step 1.1 records the same counts.
2. **BLOCKED / policy refusal never yields `pr-conflicting`, never reopens; pending
   within the grace, `merge-blocked` after it — pass.** The BLOCKED test asserts
   `status: pending`, `phase: checks`, exit 2, message naming `Vercel`,
   `gaps.hard: []`, no `roadmap-reopened`; after an out-of-grace head commit it
   asserts exit 3, `status: blocked`, `reason: merge-blocked`, `next: ["/agento ship
   widget"]`, roadmap still `status: complete`, review.md byte-equal. Code:
   `blockedMerge()` / `readPrState()` / `headCommitAge()` in `scripts/agento.mjs`
   (ship, after `waitChecks` and in the `merge-code` refusal branch).
3. **`scripts/merge-state.test.mjs` coverage — pass.** `classifyMergeRefusal`:
   BLOCKED, BEHIND, DIRTY, "merge conflict", draft, GraphQL-unknown, text-over-status
   precedence, status fallback for DIRTY/BEHIND/BLOCKED/CLEAN, empty. `requiredContexts`:
   ruleset-only, classic-only, both (de-duplicated), 404/empty/non-array. `missingRequired`:
   absent, pending (CheckRun and StatusContext), failed, complete, empty.
4. **Genuine conflict and `checks-failed` reopen to `in-progress` with a Ship-reopen
   step named by `next-step`; a second reopen adds no duplicate; build window routes
   to the Builder — pass with a finding.** The DIRTY and checks-failed tests assert
   `status: in-progress`, `## Phase \d+: Ship reopen (`, `next-step` `2.1 (added …`;
   the DIRTY test asserts `agento.mjs next` → `/agento build-feature widget` and
   `session.allowed` contains build and ap. The `reopenRoadmap` unit test asserts
   same-input idempotency. The letter of the item holds, but the "reuse" branch of
   `reopenRoadmap` drops steps for new codes and can leave no unticked step at all —
   Finding 1 (moderate), step 6.1.
5. **Ship's rejection JSON after a reopen: `allowed` is the primary row for the
   post-reopen lifecycle (no `/agento new-feature`), `elsewhere` equals `rejectTo` —
   pass.** Asserted in the DIRTY test; implemented by `receiptForRejectTo("building",
   …)` in `reopen()` (`scripts/agento.mjs`).
6. **Prompt mirror and docs — pass.** `ship.prompt.md` and `skills/agento/commands/ship.md`
   are byte-identical and describe the `in-progress` reopen with the added step, the
   `merge-blocked` mapping under `status: "blocked"`, and `checks-failed`.
   Delivery-policy §9 ship row, concurrent-delivery `mergeStateStatus` line,
   `docs/commands.md` ship section, and `CHANGELOG.md` 0.15.0 entry are updated;
   `tests/customizations.test.mjs` 56/56.
7. **`extension/cli/` regenerated with `merge-state.mjs` — pass.** `extension/cli/merge-state.mjs`
   exists and is byte-identical to `scripts/merge-state.mjs`; `extension/scripts/copy-cli.mjs`
   and `tests/extension-bundle.test.mjs` both list it; `npm run test:unit` 251/251.
8. **Full gate — pass.** 815/815, `# fail 0`, exit 0; shellcheck 0.10.0 exit 0.
9. **Live read-only check of soshiki#541 — pass.** `evidence/step-5-2-soshiki-541-classification.txt`
   records `blocked` with `Vercel` absent at head `98ff4e5a`; my independent re-run
   (table above) reproduces it exactly, using only `gh api` and `gh pr view`.

## Plan vs implementation

- `reopenRoadmap` (plan §Approach 3, roadmap 3.1: "Append, or reuse when already
  present, `## Phase N: Ship reopen (<date>)` with one `(added <date>)` step per
  code"): the reuse branch returns early when any `## Phase N: Ship reopen` section
  exists and only re-points `next-step` at the first unticked `(added …)` step. It
  adds no step for a code not yet present, and when the earlier reopen's steps are
  already ticked it leaves zero unticked steps with `next-step` whatever
  `completeRoadmap` left (`""`). `docs/commands.md` (L222–L226) promises "one `(added
  <date>)` step per code". Deviation → Finding 1.
- Plan §Risks ("Ruleset API access … treat the result as unknown required contexts.
  Ship then reports `merge-blocked` with gh's reason … and never guesses"):
  `blockedMerge()` ignores `contexts.known`; with `known: false` the message asserts
  "blocked by the base branch policy (required reviews or conversation resolution)",
  which is a guess. Deviation → Finding 2 (minor).
- The grace is measured with `git log -1 --format=%ct <codeRef>` rather than the
  GraphQL `committedDate`; equivalent for the head commit and documented in the plan's
  Resolution. Acceptable.
- `integrate()`'s `receiptForRejectTo("in-review", …)` fixes the lifecycle for the
  `allowed` row of an `integration-conflict`; at that point the roadmap is actually
  `in-review`+approve (lifecycle `approved`) or `complete`. `elsewhere` is still the
  exact `rejectTo`, so the receipt's routing is right; only `allowed` is an
  approximation. Noted, no action required (Finding 3, minor).
- plan.md `## Resolution` is written and consistent with the diff (root cause, the
  five change groups, the 3/3 → 815/815 proof, the live check).

## Roadmap audit

Every one of the 14 ticked boxes was spot-checked against the code and the recorded
verify lines re-run (table above): 1.1 (counts match: 3/0/3 at base), 2.1–2.3, 3.1–3.3,
4.1–4.4, 5.1 (815/815 and shellcheck 0 reproduced), 5.2 (evidence file present and
reproduced live), 5.3 (both halves clean, `origin/main` integrated, PRs `CLEAN`). No
`(manual)` or `(manual, post-ship)` steps exist. No box was unticked: 3.1's verify
line passes as written; its unmet sub-requirement ("one step per code" on reuse) is
recorded as missing work instead.

Repairs made: appended `## Phase 6: Review fixes (2026-10-25)` with steps 6.1–6.3
`(added 2026-10-25)` for Findings 1 and 2 and the re-gate; `next-step` set to `"6.1
(added 2026-10-25)"`; `last-updated` set to 2026-10-25; `status` left `in-review` so
the build window's fresh `request-changes` routes to the Builder fix handoff.

## Findings

1. **Moderate — `reopenRoadmap`'s reuse branch drops new codes and can reopen with
   nothing to do** (`scripts/delivery-roadmap-resolver.mjs`, `reopenRoadmap`,
   `if (existing) { … return next; }`). Reproduced with `node -e` against HEAD:
   - `reopenRoadmap(first, { codes: ["checks-failed"] })` on a roadmap whose only Ship
     reopen section holds the unticked `pr-conflicting` step adds **no**
     `checks-failed` step (`/Fix the failing required check/` → `false`).
   - After the Builder ticks 2.1, `completeRoadmap` runs at the next ship, and a
     `checks-failed` reopen follows, the result is `status: in-progress`,
     `next-step: ""`, **zero unticked steps**. The build window then routes to the
     Builder (`building`), whose resume finds nothing unticked, completes back to
     `in-review`, and the review → ship → reopen cycle repeats without the roadmap
     ever naming the failing check — a variant of the #132 loop on the second
     failure. This is the realistic second-reopen sequence (conflict fixed, then a
     failing check, or vice versa), so it is above minor.
   - The unit assertion meant to cover this is vacuous:
     `assert.equal(reopenRoadmap(plain, X), reopenRoadmap(plain, X), "a second reopen
     with different codes reuses the section, never duplicates")` compares one call
     with an identical call. Fix: in the reuse branch, append a step (continuing the
     section's numbering) for each code with no *unticked* step already present, and
     point `next-step` at the first unticked step of that section; assert (a) a
     different code gains its step with no duplicate of the existing one, and (b) a
     reopen after the earlier step was ticked yields exactly one unticked step named
     by `next-step`. Roadmap step 6.1.
2. **Minor — `blockedMerge()` guesses the policy when the required contexts are
   unknown** (`scripts/agento.mjs`, `blockedMerge`, final `finish(...)`). When
   `ghRequiredContexts` returns `known: false` (both endpoints failed), `required` is
   `[]` and the message states "required reviews or conversation resolution", though
   nothing was read. The plan's Risks commit to reporting gh's reason without
   guessing. Fix: when `!contexts.known`, say the required status checks could not
   be read and quote the refusal's first stderr line. Roadmap step 6.2.
3. **Minor — `integrate()` hardcodes lifecycle `"in-review"` for the
   `integration-conflict` receipt's `allowed` row.** Routing (`elsewhere` =
   `rejectTo`) is correct; `allowed` may show `start-session --resume` where the true
   row would show ship/close. No action required; a follow-up if the receipt is ever
   shown verbatim.
4. **Cosmetic — `next-step` written by the reuse branch uses the new reopen date,
   not the step's own `(added <date>)` date**, so the header and the step line can
   disagree. Fold into 6.1.

Nothing security-relevant: no secrets, no new network sinks beyond read-only
`gh api` GETs with a 15 s timeout and swallowed errors; `--admin`/`--auto` are not
used (plan §Out of scope).

## Follow-ups

- `deriveLifecycle` labels a `complete` roadmap with an OPEN code PR as `shipped`
  (seen after `merge-blocked`); a distinct "merging" lifecycle would make window rows
  read correctly (already in roadmap.md Follow-ups; extension and canvas impact).
- The `integration-conflict` receipt's `allowed` row (Finding 3) could derive the
  lifecycle from the roadmap actually on disk instead of a constant.
