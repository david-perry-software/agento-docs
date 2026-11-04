# Review: context-trim

Verdict: approve

Reviewed 2026-11-04 (round 2 of 3) in the build worktree
`/home/david/DP/agento-worktrees/plan-20261104-162748` at product `b325991`
(`feature/context-trim`, `origin/main` an ancestor, `ahead 0 / behind 0`; companion
`/home/david/DP/agento-docs-worktrees/plan-20261104-162748` at `7da8405` on the same
branch, `dirty: false`, companion `origin/main` an ancestor). Both halves print nothing
for `git status --porcelain --untracked-files=all`. Product PR #141 and companion PR
agento-docs#76 are both open drafts.

Round 1 (companion `cbd961b`, product `1e760f4`) requested changes for Finding 1 only.
Delta since then: `git diff 1e760f4..HEAD --stat` → one file,
`.github/agents/delivery-builder.agent.md` (+3/−3, commit `b325991` "fix(builder): drop
stray :NNN locator tokens from policy pointers (5.1)"). Neither `extension/` nor
`scripts/` changed, so round 1's extension build/unit-test evidence (252/252 at
`1e760f4`) still describes byte-identical files. Full code diff vs `origin/main`: 13
files, +91/−15 — the same file set as round 1. Companion delta: `e6f4c01` (reopen),
`ed097a9` (5.1 artifact commit), `7da8405` (return to in-review) — the two-commit rule
holds for 5.1; 5.2/5.3 are no-change steps with no code commit by design.

Skills consulted: none — no matching domain (AGENTS.md has no `## Agento` skills table,
`.agents/skills/` does not exist; Markdown agent text, JSON template, docs, node:test).

## Round 1 finding verification

- **Finding 1 (moderate) — fixed.** `.github/agents/delivery-builder.agent.md:109` now
  reads ``stays unticked (`agento.mjs policy 4`).``, `:112` ``component of it
  (`agento.mjs policy 5`).``, and `:162` ``End the completion report with the
  cross-window sequence (`agento.mjs policy 8`) (review here; …`` — the three `` `:NNN` ``
  tokens are gone and line 162 is grammatical again. Whole-delivery check per step 5.1:
  `git diff origin/main...HEAD | grep '^+' | grep -E '`:[0-9]+'` matches nothing.
- **Finding 2 (minor) — no change required**, confirmed: the permutation test lives in
  `tests/customizations.test.mjs` and passed (`ok 208`), and roadmap 2.2's verify command
  covers it. Step 5.2 records this.
- **Finding 3 (observation) — no change required**, confirmed; step 5.3 records it.

## Acceptance checklist results

1. **Five Builder files declare exactly `Policy: §1, §2, §3, §6, §7, §9, §10, §11, §12`**
   — **pass**. `grep -n "^Policy:"` on `.github/agents/delivery-builder.agent.md:21`,
   `.github/prompts/build-feature.prompt.md:11`, `.github/prompts/build-issue.prompt.md:11`,
   `skills/agento/commands/build-feature.md:11`, `skills/agento/commands/build-issue.md:11`
   each print that set; pinning test `ok 207 - the Builder and its build commands declare
   exactly §1, §2, §3, §6, §7, §9, §10, §11, §12`.
2. **Builder body reaches §4/§5/§8 only through pointers; cites §6 in the long-command
   guidance** — **pass** (text now clean, see above). `grep -n "§[458]"
   .github/agents/delivery-builder.agent.md` → no match (exit 1); `grep -c "agento.mjs
   policy [458]"` → 3 (`:109`, `:112`, `:162`); `grep -n "§6"` → `:21` (Policy line) and
   `:32` "never the 30 s default (policy §6)".
3. **Pointer form documented in `docs/architecture.md` and enforced** — **pass**.
   `docs/architecture.md:273` defines the pointer form, its exclusion from the declared
   set, and the `policy --list` check. Negative test re-run by me this round: appended
   `` `agento.mjs policy 99` `` to `.github/prompts/build-issue.prompt.md` → `node --test
   --test-name-pattern="pointer" tests/customizations.test.mjs` → `not ok 3 … names a
   section policy --list does not know` (1 fail); file restored, product tree clean.
4. **`BRIEF_POLICY_PRIORITY["🔨 Agento Builder"]` is a permutation of the new set; a test
   asserts it for every entry** — **pass**. `scripts/lib/brief.mjs:30` =
   `["9","7","1","2","3","6","11","10","12"]`; `cmp scripts/lib/brief.mjs
   extension/cli/lib/brief.mjs` byte-identical; `ok 208 - every BRIEF_POLICY_PRIORITY
   entry is a permutation of its agent's declared Policy: set`; `node --test
   tests/customizations.test.mjs scripts/lib/brief.test.mjs scripts/commands/brief.test.mjs
   scripts/model-profiles.test.mjs scripts/commands/models.test.mjs
   tests/extension-bundle.test.mjs` → 222 pass / 0 fail.
5. **A Builder start is ≥ 2,000 B smaller; §6 included or on demand; §4/§5/§8 absent** —
   **pass**. Recomputed from `.github/instructions/policy/`: old declared set 17,736 B,
   new 15,297 B, saving 2,439 B — identical to roadmap 1.1/2.3. Live `brief build-feature
   context-trim --as-subagent`: 1 page, 6,367 B, footer `On demand: policy 7, 2, 3, 6,
   11, 10, 12`; `grep -c 'policy [458] —\|^## [458]\.'` → 0. (Metric is the declared
   policy load, as round 1 Finding 3 and `docs/copilot-harness.md:505–506` state.)
6. **Other agents' `Policy:` lines and every `model:` line unchanged** — **pass**.
   `git diff --name-only origin/main -- .github/agents/` → only
   `delivery-builder.agent.md`; `git diff origin/main -- .github/agents/ | grep
   "^[-+]model:"` → nothing.
7. **Template and docs carry an explicit strong-model `autopilot` entry; `models pins`
   still reports `Claude Opus 5.5 (copilot)`** — **pass**. `templates/model-profiles.json`
   parses (`node -e`), `mixed.agents.autopilot` = `"<strong model: picker name (vendor)>"`;
   `docs/model-profiles.md:34` example entry and `:240–244` "**Autopilot model.**" note;
   `node scripts/agento.mjs models pins` → `autopilot.model: "Claude Opus 5.5 (copilot)"`;
   `.github/agents/delivery-autopilot.agent.md:5` unchanged. Decision 3 (Opus 5.5 stays)
   is the user's recorded choice, not a defect.
8. **`docs/copilot-harness.md` has `## Trimming per-call context` after "Known stall
   sources"** — **pass**. `grep -n "^## "` → `452 ## Known stall sources`, `496 ##
   Trimming per-call context`, `522 ## Reproduce`; section re-read (`:496–521`): trimmed
   set, pointer form, 15,297 / 17,736 / −2,439 B, Opus 5.5 pin + `models use`,
   Python/Pylance disable path and its check.
9. **`extension/cli/` regenerated; extension builds and passes unit tests** — **pass**.
   `tests/extension-bundle.test.mjs` passed this round (in the 222 and 894 runs);
   `extension/` and `scripts/` are byte-identical to `1e760f4`, where round 1 ran `cd
   extension && npm ci && npm run build && npm run test:unit` → build exit 0, 252 pass /
   0 fail.
10. **Lint gate (§5, full rerun) and full suite** — **pass**. `shellcheck` not
    installed; downloaded the official v0.10.0 release to `/tmp/sc-review`, ran
    `shellcheck scripts/hooks/delivery-guard.sh scripts/hooks/session-context.sh
    scripts/hooks/replay-guard.sh scripts/wait-for-checks.sh` → exit 0, no output
    (baseline 0 findings; `scripts/hooks/*.sh` is exactly those three files); `/tmp`
    cleaned. Full suite `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'
    'canvas/**/*.test.mjs'` → `# tests 894 / # pass 894 / # fail 0` (baseline 891).

## Plan vs implementation

Follows plan.md `## Approach` 1–5; touches exactly the 13 "Affected files". No scope
creep (no other agent/prompt/`model:` line, `BRIEF_BUDGET`, pagination, or breakdown
edits). The round-1 textual deviation is resolved.

## Roadmap audit

All twelve ticks checked: 1.1–4.1 reproduced this round (byte numbers, greps, pins,
headings, tests, shellcheck, full suite); 5.1 verified by the fix diff, the three
greps, the focused tests, and the full suite; 5.2 and 5.3 are no-change steps whose
claims match the code and the round-1 findings. No `(manual)` or post-ship steps. No
falsely ticked boxes; no repairs made to roadmap.md.

## Findings

None above minor.

1. **Observation (carried, no change)** — the ≥ 2,000 B threshold is a declared-policy-load
   metric, not raw brief bytes; both numbers are recorded on roadmap 1.1/2.3 and the doc
   wording is accurate.

## Follow-ups

- None new. The existing `startup-brief-command` page-1 packing observation (budget left
  unused when a smaller lower-priority section would still fit) still applies.
