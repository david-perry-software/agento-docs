# Review: context-trim

Verdict: request-changes

Reviewed 2026-11-04 (round 1) in the build worktree
`/home/david/DP/agento-worktrees/plan-20261104-162748` at product `1e760f4`
(`feature/context-trim`, `origin/main` an ancestor, both halves clean,
`ahead 0 / behind 0` against their remotes; companion
`/home/david/DP/agento-docs-worktrees/plan-20261104-162748` on the same branch,
`dirty: false`). Code diff: `git diff origin/main...HEAD` (13 files, +91/−15; 5 step
commits plus the opening commit). Artifact diff: companion `origin/main..HEAD` (13
commits — one artifact commit per step; the two-commit rule holds, the three
artifact-only steps 1.1, 2.3, 3.2 have no code commit by design). Product PR #141 and
companion PR agento-docs#76 are both open drafts.

Skills consulted: none — no matching domain (AGENTS.md has no `## Agento` skills table,
`.agents/skills/` does not exist; the work is Markdown agent text, a JSON template,
docs, and node:test suites).

## Acceptance checklist results

1. **Five Builder files declare exactly `Policy: §1, §2, §3, §6, §7, §9, §10, §11, §12`**
   — **pass**. `grep -n "^Policy:"` on `.github/agents/delivery-builder.agent.md:21`,
   `.github/prompts/build-feature.prompt.md:11`, `.github/prompts/build-issue.prompt.md:11`,
   `skills/agento/commands/build-feature.md:11`, `skills/agento/commands/build-issue.md:11`
   all print that set. The pinning test "the Builder and its build commands declare
   exactly §1, §2, §3, §6, §7, §9, §10, §11, §12" (`tests/customizations.test.mjs`) passed
   in the full run.
2. **Builder body reaches §4/§5/§8 only through pointers; cites §6 in the long-command
   guidance** — **pass on the letter, see Finding 1 on the text**. `grep -n "§[458]"
   .github/agents/delivery-builder.agent.md` prints nothing (exit 1); `grep -c
   "agento.mjs policy [458]"` prints 3 (lines 109, 112, 162); `grep -n "§6"` finds the
   `Policy:` line and `:32` "never the 30 s default (policy §6)". The pointer lines carry
   stray `:109` / `:112` / `:162` tokens and line 162 is ungrammatical — Finding 1.
3. **Pointer form documented in `docs/architecture.md` and enforced** — **pass**.
   `docs/architecture.md:273` is the new paragraph ("pointer form `agento.mjs policy
   N` … Pointers are not citations … `policy --list` knows"). Negative test run by me:
   appended `` `agento.mjs policy 99` `` to a scratch copy of
   `.github/prompts/build-issue.prompt.md` → `node --test
   --test-name-pattern="pointer names a section" tests/customizations.test.mjs` failed
   with "`agento.mjs policy 99` names a section policy --list does not know" (1 fail);
   file restored, `git status --porcelain` empty afterwards.
4. **`BRIEF_POLICY_PRIORITY["🔨 Agento Builder"]` is a permutation of the new set and a
   test asserts it for every entry** — **pass**. `scripts/lib/brief.mjs:30` is
   `["9","7","1","2","3","6","11","10","12"]`; `extension/cli/lib/brief.mjs` carries the
   identical hunk. The test "every BRIEF_POLICY_PRIORITY entry is a permutation of its
   agent's declared Policy: set" lives in `tests/customizations.test.mjs` (not in
   `scripts/lib/brief.test.mjs`, so the item's own `verify:` command does not exercise
   it — Finding 2, minor); it passed in the full run, as did the updated fixture in
   `scripts/lib/brief.test.mjs:109`.
5. **A Builder start is ≥ 2,000 B smaller; §6 included or on demand; §4/§5/§8 absent** —
   **pass, with the metric clarified**. Recomputed from `.github/instructions/policy/`
   sizes: old declared set 17,736 B, new 15,297 B, −2,439 B — exactly the numbers on
   roadmap 1.1/2.3. Live `brief build-feature context-trim --as-subagent` today: 1 page,
   6,365 B (§9 and §1 printed because the in-review Delivery block is shorter than the
   in-progress one the Builder measured at 5,528 B), footer `On demand: policy 7, 2, 3,
   6, 11, 10, 12`; `grep -c "policy [458] —\|^## [458]\."` on it prints 0. Note the raw
   brief output itself shrank only 137 B (5,665 → 5,528) because pagination fills page 1
   from the priority order regardless; the ≥ 2,000 B saving is in the declared policy
   load the Builder reads across the brief plus its on-demand pages, which is the metric
   plan.md `## Research` ("Size") defines the threshold against.
6. **Other agents' `Policy:` lines and every `model:` line unchanged** — **pass**.
   `git diff --name-only origin/main -- .github/agents/` prints only
   `delivery-builder.agent.md`; `git diff origin/main -- .github/agents/ | grep
   "^[-+]model:"` matches nothing.
7. **Template and docs carry an explicit strong-model `autopilot` entry; `models pins`
   still reports `Claude Opus 5.5 (copilot)`** — **pass**. `templates/model-profiles.json`
   `mixed.agents.autopilot` = `"<strong model: picker name (vendor)>"`, `node -e
   JSON.parse(...)` exit 0; `docs/model-profiles.md:34` adds `"autopilot": "Claude Opus
   5.5 (copilot)"` and `:240–244` the "**Autopilot model.**" note; `node scripts/agento.mjs
   models pins` → `pins.autopilot.model` = `Claude Opus 5.5 (copilot)`,
   `.github/agents/delivery-autopilot.agent.md:5` unchanged. `scripts/model-profiles.test.mjs`
   and `scripts/commands/models.test.mjs` passed in the full run. (Decision 3 — Autopilot
   stays on Opus 5.5 — is the user's recorded choice, not a defect.)
8. **`docs/copilot-harness.md` has `## Trimming per-call context` after "Known stall
   sources"** — **pass**. `grep -n "^## "` → `452 ## Known stall sources`, `496 ##
   Trimming per-call context`, `522 ## Reproduce`. The section carries the trimmed set,
   the pointer form, 15,297 / 17,736 / −2,439 B, the Opus 5.5 pin and `models use`, and
   the Python/Pylance disable path. UI names cross-checked: the official VS Code
   agent-plugins docs page (fetched with curl) contains "Chat: Open Customizations",
   "Disable (Workspace)", and "Chat: Configure Skills"; the Extensions-view path matches
   `docs/install.md:38` and `README.md:599`.
9. **`extension/cli/` regenerated; extension builds and passes unit tests** — **pass**.
   `tests/extension-bundle.test.mjs` passed in the full run; `cd extension && npm ci &&
   npm run build && npm run test:unit` → copy-cli ran, build exit 0, `# tests 252 / #
   pass 252 / # fail 0`. Product tree clean afterwards.
10. **Lint gate (§5, full rerun) and full suite** — **pass**. `shellcheck` is not
    installed; downloaded the official v0.10.0 release to `/tmp`, ran `shellcheck
    scripts/hooks/delivery-guard.sh scripts/hooks/session-context.sh
    scripts/hooks/replay-guard.sh scripts/wait-for-checks.sh` → exit 0, no output
    (baseline: 0 findings; `scripts/hooks/*.sh` is exactly those three files); `/tmp`
    cleaned. Full suite `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'
    'canvas/**/*.test.mjs'` → `# tests 894 / # pass 894 / # fail 0` (baseline 891; the
    three new customizations tests account for the delta). Matches roadmap 4.1.

## Plan vs implementation

The implementation follows plan.md `## Approach` 1–5 and touches exactly the 13 files
in "Affected files". No scope creep: no other agent, prompt, or `model:` line changed;
`BRIEF_BUDGET` and the pagination algorithm are untouched; the breakdown is not edited
(Risks). The one deviation from the plan's intent is textual — Finding 1: the roadmap
step 2.1 wording "post-ship exception (`agento.mjs policy 4`, `:109`)" used `:109` as
the *location to edit* (as plan.md `## Problem` does), and the Builder transcribed the
locators into the agent body as if they were part of the pointer.

## Roadmap audit

All nine ticks spot-checked against the codebase and my own runs: 1.1 (numbers on the
line, 17,736 B reproduced), 1.2 (test + paragraph + negative test), 2.1 (Policy lines,
3 pointers, §6 cite, pinning test), 2.2 (priority, fixture, permutation test,
`extension/cli` byte copy), 2.3 (15,297 B / −2,439 B reproduced), 3.1 (template + docs),
3.2 (pins output + agents diff), 3.3 (heading order, UI names), 4.1 (shellcheck 0 /
894 / 252 reproduced). No falsely ticked boxes, no `(manual)` steps, no post-ship
steps. No repairs made to roadmap.md.

## Findings

1. **Moderate — stray self-referencing line numbers and a garbled sentence in the
   Builder agent body** (`.github/agents/delivery-builder.agent.md:109`, `:112`,
   `:162`). The three pointers read ``(`agento.mjs policy 4`, `:109`)``,
   ``(`agento.mjs policy 5`, `:112`)``, and ``… cross-window sequence from
   (`agento.mjs policy 8`, `:162`) (review here; …``. The `:NNN` tokens are the roadmap
   step's edit locators (the file's own line numbers), mean nothing to the Builder
   model reading the prompt, and will drift on the next edit; line 162 also lost its
   grammar ("sequence from (`…`) (review here"). This is the feature's primary
   deliverable — text every Builder session loads — and it is shipped in the plugin's
   customization files, so it is above cosmetic. Fix: drop the three `, `:NNN`` tokens
   and restore line 162 to the shape of the original, e.g. "End the completion report
   with the cross-window sequence (`agento.mjs policy 8`) (review here; …" or
   "…sequence from policy 8 (`agento.mjs policy 8`)…" — the latter keeps the pointer
   and still cites no `§8`. Re-run `node --test tests/customizations.test.mjs`
   afterwards (the pointer-form, pinning, and Policy-line tests all stay satisfied;
   `grep -c "agento.mjs policy [458]"` must still print 3). No `extension/cli` copy is
   affected.
2. **Minor — permutation test location vs. acceptance verify command.** Acceptance item
   4's `verify:` is `node --test scripts/lib/brief.test.mjs scripts/commands/brief.test.mjs`,
   but the new permutation test was added to `tests/customizations.test.mjs` (sensible
   — that file already has `agentByName` / `declaredSections`). The claim is met and
   covered by roadmap 2.2's wider verify command and the full suite; no change required.
3. **Observation — "brief totals ≥ 2,000 B less".** Item 5 and roadmap 2.3 are worded as
   if the brief output itself shrinks; it does not materially (−137 B), because the page
   is filled from the priority order. The real saving (−2,439 B) is the declared policy
   load. The roadmap lines record both numbers side by side, and
   `docs/copilot-harness.md` states the saving as "declared policy sections total" —
   accurate. No change required; future plans should word this metric as "declared
   policy load".

## Follow-ups

- None new. The existing `startup-brief-command` review's page-1 packing observation
  (budget left unused when a smaller lower-priority section would still fit) is what
  makes the live Builder brief print §9 + §1 only; the trimmed set makes that
  observation slightly more valuable, not less.
