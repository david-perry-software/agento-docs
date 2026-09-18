# Review: copyable-command-blocks

Verdict: approve

Reviewed 2026-09-18 in the build worktree `/home/david/DP/agento-worktrees/plan-20260918-212304`
(product `feature/copyable-command-blocks` at `f686f28`; companion half
`/home/david/DP/agento-docs-worktrees/plan-20260918-212304` on the same branch,
`dirty: false`, `ahead: 0`). `origin/main` (product `1b874bd`) and the companion's
`origin/main` are both ancestors of the reviewed HEADs; nothing stale. Code PR
david-perry-software/agento#46 (draft), companion PR agento-docs#3.

Skills consulted: none — no matching domain (`.agents/skills` absent; AGENTS.md has
no `## Agento` skills table).

## Acceptance checklist results

1. **Policy §12 "Command presentation"** — **pass.** `grep -n '^## 12\. '
   .github/instructions/delivery-policy.instructions.md` → L356. Section states one
   bare fenced block per user-run command, exactly one command, no language tag or
   extra text; `next:` repeated directly above the unchanged, last §9 result line;
   descriptive mentions inline; repository prose excluded; agent-run shell commands
   never presented as blocks; ordering rule. Frontmatter `description` ends with
   ", and command presentation". `sections.size >= 12` test passes in the suite run
   below.
2. **Every agent and prompt cites §12** — **pass.** Test "every command and agent
   cites the §12 command presentation rule" passes; independent `grep -c "§12"
   .github/agents/*.agent.md` ≥ 1 for all six agents, and a per-file loop over
   `.github/prompts/*.prompt.md` reports no prompt missing `§12`.
3. **Canary phrase** — **pass.** `grep -rl "copyable command block" .github/agents
   .github/prompts .github/instructions` lists only
   `delivery-policy.instructions.md`; count in that file is 1; canary test passes.
4. **`next-feature` one command per bare block** — **pass.** Test "next-feature prints
   one command per fenced block" passes (6 blocks, all bare, one `/agento` line, no
   `#`). Confirmed the test is exposing by replaying its logic against
   `git show origin/main:.github/prompts/next-feature.prompt.md`: violations
   `L42: tag ```text`, `L48: 5 lines`, `L48: # comment`. `cmp` of every
   `.github/prompts/<n>.prompt.md` against `commands/<n>.md` shows no drift.
5. **Handoff sites present commands as blocks / cite §12** — **pass.** Diff reviewed
   at each cited location: Builder pause (L113–117) and completion (L128–133);
   Reviewer step 8; Autopilot loop step 4 and `## Reporting`; Planner step 9;
   Architect step 9; `continue` step 4/5 and the `ship` example; `ship` hard-reject
   path and teardown pause; `start-freehand`, `close-session`, `new-feature`,
   `new-issue`, `doctor`, `quick-fix`, `agento-init`. `grep -rl "paused at
   teardown"` over agents/prompts/instructions → only `ship.prompt.md`.
6. **Rendered block with copy button** — **pass (browser fallback, §10).** The step
   is a VS Code chat-UI capture the agent cannot drive from a shell or the integrated
   browser, so per §10 I performed the headless-faithful check: viewed
   `evidence/step-4-2-copy-button.png` (269,849 bytes, PNG) myself. It shows the
   chat panel rendering a bare fenced block whose only content is
   `/agento build-feature copyable-command-blocks`, the hover toolbar with the copy
   icon visible at the block's top-right, then "Or unattended, in this window:" and
   a second bare block `/agento ap copyable-command-blocks`, then the single
   `Result: completed — paused; …` last line. No secrets in frame (only a LAN
   address in the OS status bar). I could not capture an independent screenshot;
   recorded as the limitation, not a failure.
7. **Docs, changelog, version** — **pass.** `grep -n "§12" docs/commands.md
   docs/architecture.md` → L210 and L56; `CHANGELOG.md` L3 `## 0.5.1 (unreleased)`;
   `package.json` L3 and `.claude-plugin/plugin.json` L4 both `"0.5.1"`; version
   equality test passes.
8. **Full lint baseline** — **pass.** Reviewer's fresh run at `f686f28`, each command
   in its own status-capturing wrapper:

   | Command | Exit | Findings |
   | --- | --- | --- |
   | `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | 0 | 206 tests, 206 pass, 0 fail (baseline 203; +3 from this delivery) |
   | `shellcheck scripts/hooks/delivery-guard.sh scripts/hooks/replay-guard.sh scripts/hooks/session-context.sh scripts/wait-for-checks.sh` | 0 | none |
   | `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` | 0 | all fixtures match |
   | `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` | 0 | all fixtures match |

   Matches the plan.md baseline and both Builder reruns; no new or undocumented
   finding.
9. **(added 2026-09-18) ap alternative after build/review blocks** — **pass.** Test
   "build and review handoffs offer the /agento ap alternative" passes;
   `grep -n "/agento ap <slug>"` shows the rule in policy L387, `docs/commands.md`
   L211 (Receipts), `CHANGELOG.md` L13; the nine files of roadmap 6.2 all match
   `/agento ap <slug>|<feature-slug>` (9/9). Policy §12 restricts the ap block to
   build/review commands and keeps `next:` on the build/review command.

## Plan vs implementation

- Implementation matches the Approach: policy §12 + citation in all six agents and
  all 24 prompts, `commands/` mirror byte-identical, three new tests, docs/changelog,
  version bump. No CLI, hook, or config change (as planned).
- Minor deviation, documented on the roadmap: step 4.2 planned a `/agento doctor`
  response as the capture subject; the captured response is the Builder's pause
  handoff. It still demonstrates the same thing (bare one-command block, copy button,
  ap block, single result line) — accepted.
- Planned file `delivery-mechanic.agent.md` does not exist; the Builder edited
  `copilot-mechanic.agent.md` and noted it on step 2.2 — correct.
- The mid-build addition (Phase 6, plan `## Decisions` verbatim quote) is in scope and
  fully delivered.

## Roadmap audit

All 16 ticks spot-checked against the codebase and the commit list
(`bf0aab0..f686f28`, one Conventional Commit per step): 1.1–1.2 (policy + test),
2.1–2.2 (agents), 3.1–3.4 (prompts + mirror + test), 4.1 (docs/version), 4.2
(manual, evidence file present and linked, completion date on the line), 5.1–5.2
(gate rerun recorded in plan.md; `status: in-review`, both PRs open), 6.1–6.4 (ap
rule, nine handoff sites, test, gate rerun, plan updates). No falsely ticked boxes;
no steps added; no repairs made.

## Findings

- **Minor** — `docs/architecture.md` L53–56: the enumeration now reads "…, and the
  window check (§11: …), and command presentation (§12: …)" — a doubled "and" from
  appending to a list that already had its final conjunction. Prose only.
- **Minor** — `tests/customizations.test.mjs` "build and review handoffs offer the
  /agento ap alternative" checks seven files; `delivery-autopilot.agent.md` and
  `continue.prompt.md` also carry the ap block (roadmap 6.2 lists nine) but are not
  guarded by the test. Matches the plan's step 6.3 wording, so not a gap — a
  cheap strengthening.
- No security-relevant change: no hook, CLI, or config edits; no secrets in the
  evidence screenshot.

## Follow-ups

- Fix the doubled "and" in `docs/architecture.md` §12 clause (one-word prose edit).
- Extend the ap-alternative test to `delivery-autopilot.agent.md` and
  `continue.prompt.md` so every site roadmap 6.2 names is guarded.
