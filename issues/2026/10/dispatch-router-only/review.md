# Review: dispatch-router-only

Verdict: approve

Reviewed 2026-10-18 against product `issue/dispatch-router-only` @ `4da1b19`
(PR #122, `origin/main` is an ancestor) and companion `issue/dispatch-router-only`
@ `2ebc1d2` (PR #59, companion `origin/main` is an ancestor); both halves clean and
in sync with origin at the start of the review. Skills consulted: none — no matching
domain (no `.agents/skills/` and no skills table in this repository).

## Acceptance checklist results

1. **Exposing regression test fails before the fix and passes after** — pass.
   Commit `4ce4b21` (step 2.1) records the pre-fix failure
   (`plugin.commands === 'commands'`, expected `undefined`). I re-ran the
   post-re-plan form of the test against the tree at `620e78c` (step 6.1, before
   the move) from a `git archive` copy: `not ok 1 … error: 'a root-level commands/
   directory must not exist …'`. At HEAD `node --test --test-name-pattern '#121'
   tests/customizations.test.mjs` → `# pass 1`.
2. **`.claude-plugin/plugin.json` has no `commands`, keeps `agents` and `hooks`** —
   pass. The diff removes exactly the `"commands": "commands"` line; the
   customizations suite asserts `plugin.agents` exists and `plugin.commands ===
   undefined`.
3. **Doctor `harness` is `fail` for absent/foreign/dangling/not-a-link, `ok` when
   installed or with no router skill, never in preflight** — pass.
   `scripts/agento.mjs` L1017–L1024; `scripts/agento.test.mjs` "doctor harness check
   is ok without a router and when installed, fails per state, and never runs in
   preflight" passes in the full suite; live: `agento.mjs doctor` from this worktree
   reports `harness fail — cannot run /agento in any session — ~/.copilot/skills/agento
   resolves to /home/david/DP/agento-plugin/skills/agento` with the `--force`
   fallback, while the review preflight (`doctor --for review-issue`) ran only the six
   capability checks.
4. **`commands/*.md` and `.github/prompts/` unchanged** — pass as superseded. The
   re-plan (plan.md Decisions, option A) moves `commands/*.md`; `git diff
   origin/main...HEAD --stat` shows the 25 files as pure renames (`0` changed lines
   each) and `git diff origin/main --stat -- .github/prompts` is empty.
5. **Docs: `harness install` required; both harnesses route through the router;
   Local model-switching gap** — pass. `grep -rn "restores the Local
   prompt\|Local loads the plugin's prompt commands\|prompt commands load" docs
   README.md` prints nothing; `docs/install.md:68` carries the required `harness
   install` step; `docs/copilot-harness.md` (manifest registers no commands, uninstall
   stops `/agento`, the #121 existing-chat finding), `docs/model-profiles.md` (prompt
   `model:` and inline agent modes not applied through the router) and README read as
   planned; `grep -n "prompt commands" skills/agento/SKILL.md` prints nothing.
6. **Full node suite** — pass: `node --test 'scripts/**/*.test.mjs'
   'tests/**/*.test.mjs'` → `# tests 566 / # pass 566 / # fail 0`.
7. **Five guard replays** — pass, all exit 0 with zero mismatches: default 128
   verdicts, companion 61, Copilot format 128, Copilot companion 61, Copilot fixtures
   15.
8. **Extension builds, unit tests pass, `extension/cli/` matches `scripts/`** — pass:
   `npm run build` exit 0; `npm run test:unit` → 167/167; after `npm run copy-cli`,
   `git status --porcelain --untracked-files=all` prints nothing; `diff -rq scripts
   extension/cli` lists only the files copy-cli excludes (tests, hooks, shell).
9. **Lint gate (shellcheck zero findings vs. clean baseline)** — pass via CI.
   shellcheck is not installed locally (exit 127, as the plan recorded);
   `scripts/wait-for-checks.sh pr 122` → `RESULT: success` for head `4da1b19`, run
   39094255890, step `Shellcheck: success` (shellcheck 0.9.0 under `bash -e`, so zero
   findings), matching the clean baseline run 39054365546. No shell file changed.
10. **Pre-check (step 1.2)** — pass: `evidence/step-1-2-copilot-existing-chat.png`
    (existing Copilot chat, request sent, receipt printed) and
    `evidence/step-1-2-local-router.png` exist and are linked from the step.
11. **soshiki four-cell acceptance** — pass via the superseding 6.7/6.9 evidence
    (the literal `step-5-3-*` set holds only the failed pre-re-plan run, documented
    as obsolete). I inspected each screenshot: `step-6-7-copilot-new.png` (Copilot
    new chat, sent, receipt), `step-6-7-copilot-existing-attached.png` (Copilot
    existing chat with a prior `/agento` turn, `delivery-status.md` attachment chip
    from the branch extension, sent, receipt), `step-6-7-local-new.png`,
    `step-6-7-local-existing.png`, `step-6-7-local-existing-typed.png` (Local
    target, new / existing-with-prior-turn / hand-typed, each sent with `Receipt:
    accepted delivery-status:main:897c27bf`). The "file not found" editor tab in
    every shot is the stale `agento-plugin/commands/delivery-status.md` tab, not a
    failure.
12. **#121 test asserts no root `commands/` and the mirrors under
    `skills/agento/commands/`** — pass (see item 1: fails at `620e78c`, passes at
    HEAD).
13. **No root `commands/`; every consumer reads `skills/agento/commands/`** — pass.
    `test ! -d commands` holds; `git grep` for `commands/` outside
    `skills/agento/commands` finds no code consumer (`scripts/agento.mjs`
    `dispatchFor`/`MODEL_ATTR_PATTERNS`/`modelTargetFiles`, `extension/src/commandAgent.ts`,
    `extension/cli/agento.mjs`, all tests, harness probe, docs, SKILL.md and the
    delivery-policy `applyTo` all use the new path); 25/25 mirrors are
    byte-identical to `.github/prompts/`. One prose remnant remains in
    `.github/prompts/models.prompt.md:42` / its mirror (Follow-ups).
14. **`.github/prompts/` unchanged** — pass: `git diff origin/main --stat --
    .github/prompts` is empty.

Additional checks requested for this review:

- **No committed `model:` lines**: `git grep -E '^model:' HEAD -- skills/agento/commands
  .github/prompts .github/agents` prints nothing (the suite's "committed agents,
  prompts, and command mirrors carry no model: line" test covers the same at HEAD).
- **Models filter migration for existing pinned clones** (simulated, not just read):
  in a throwaway clone at `origin/main` I ran the *old* CLI's `models apply tiny`
  (attribute block `/commands/*.md`, pin state keyed `commands/doctor.md`), then
  merged `origin/issue/dispatch-router-only`. The merge was clean and the tree clean;
  the moved mirrors came out pin-free; the new CLI's `models list` reported
  `active: custom`, `filter.installed: true`, `unrecorded: 25`; `doctor` →
  `model-profile warn — 25 agent/prompt file(s) added since the last apply carry no
  pin … re-run agento.mjs models apply <name>`; `models apply tiny` then rewrote the
  attribute block to `/skills/agento/commands/*.md`, dropped the stale
  `commands/…` keys from `model-pins.json`, re-pinned the three mirrors, and left the
  tree clean; `models clear` removed everything. Nothing breaks and the doctor names
  the fix; the CHANGELOG does not mention this one-time re-apply (Follow-ups).
- **CHANGELOG**: the Unreleased entry carries the breaking install change, the
  `doctor` failure, the `harness uninstall` consequence, the lost prompt-`model:`
  switching, and the released-extension compatibility note (older dashboard builds
  attach no command file until updated).
- **Restore of user-level state**: `/home/david/DP/agento-plugin` is on `main` @
  `1f0d3de`, clean, matching `evidence/step-5-2-plugin-clone-head.txt`;
  `code --list-extensions --show-versions` shows
  `david-perry-software.agento-dashboard@0.7.0`, matching
  `evidence/step-6-8-extension-before.txt` and `step-6-10-restore.txt`.

## Plan vs implementation

- The re-plan (option A) is recorded in plan.md Decisions/Research/Approach §6 and
  the Resolution section; the implementation matches it: pure `git mv` of the 25
  mirrors, every consumer repointed, manifest field removed, doctor semantics as
  decided (decision 3), docs as decided (decision 5, merged after `origin/main`).
- AGENTS.md's layout list never named `commands/`, so there was nothing to update
  there; it still does not name `skills/agento/` either (pre-existing gap, Follow-ups).
- `templates/`, `hooks/`, `scripts/hooks/`, and `extension/README.md` carry no
  `commands/` reference (verified by `git grep`).
- Commit `4da1b19` on the product branch changes only `CHANGELOG.md` but is titled
  with the companion's artifact message ("record 6.7 Copilot evidence …; add
  6.8/6.9/6.10 re-check steps") — cosmetic mislabel, no content problem.
- The Copilot **new-chat** cell (6.7) was exercised only against the released 0.7.0
  extension (no attachment chip); the branch extension's attachment path was
  exercised for the Copilot existing-chat cell and both Local cells (6.9). The
  router resolution is identical in both, so the fix is covered; noted for
  completeness.

## Roadmap audit

All 23 boxes spot-checked against the codebase and evidence; no falsely ticked box.

- 1.1/1.3: `step-1-1-plugin-locations.txt` recorded; restore confirmed by the
  current `chat.pluginLocations` still naming `/home/david/DP/agento-plugin`
  (the plugin clone the harness link resolves to).
- 1.2, 6.7, 6.9 (manual): each links existing evidence files that I viewed.
- 2.1, 6.1: failing-before evidence in the step commit message and reproduced for 6.1.
- 3.1–3.4, 4.1, 6.2–6.5: verified by the diff, the suite, the replays, and the
  extension gate above.
- 5.3, 5.4: marked `~…~ (obsolete: …)` per the artifact format, with the failure
  evidence linked; correctly superseded by 6.7–6.10.
- 5.2, 6.6, 6.8, 6.10: text evidence present and consistent with the restored state.
- **Repair made**: step 6.7's annotation had a mis-spliced "Completed 2026-10-17"
  inside the sentence "the editor kept a stale … tab" and a stale instruction
  "Tick 6.7 once 6.9's Local cells complete"; restored the sentence and recorded the
  tick date. No tick changed; no step added.

## Findings

No finding above minor severity.

1. **Minor — `doctor` is red in the documented two-clone development setup.** With
   `~/.copilot/skills/agento` → the registered plugin clone (`agento-plugin`), running
   `agento.mjs doctor` from the development clone or any of its worktrees now reports
   overall `fail` (`harness`: foreign link). This is the risk plan.md accepts
   (decision 3; fallback offers `--force` or "keep the other clone's link"), and
   preflight is unaffected; it is still a permanent red for Agento's own
   contributors. `scripts/agento.mjs` L1021.
2. **Minor — stale prose.** `.github/prompts/models.prompt.md:42` (and its
   byte-identical mirror `skills/agento/commands/models.md`) still says "`commands/`
   mirrors". `.github/prompts/` is out of scope by the plan, so it stays; see
   Follow-ups.
3. **Minor — CHANGELOG omits the pinned-clone step.** A clone with `models apply`
   active ends up `active: custom` with 25 unrecorded mirrors after pulling; the
   doctor names `models apply <name>`, but the breaking-change entry does not.
4. **Minor — commit message mislabel** on `4da1b19` (see Plan vs implementation).

## Follow-ups

- Soften doctor `harness` for a foreign link whose target is itself a valid Agento
  router (e.g. `warn` with the clone named) so a development clone next to a
  registered plugin clone is not permanently `fail`; or document the recommended
  link target for contributors in AGENTS.md.
- Update `.github/prompts/models.prompt.md:42` wording ("`commands/` mirrors" →
  "`skills/agento/commands/` mirrors") and regenerate its mirror, in a delivery that
  is allowed to touch `.github/prompts/`.
- Add one CHANGELOG sentence for clones with model pins: after pulling this change
  run `agento.mjs models apply <name>` (or `adopt`) once to move the filter's
  attribute block and pin state to `skills/agento/commands/`.
- Add `skills/agento/` (router skill + command mirrors) to the AGENTS.md layout list.
