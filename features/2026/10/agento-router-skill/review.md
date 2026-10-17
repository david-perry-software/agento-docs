# Review: agento-router-skill

Verdict: approve

Reviewed 2026-10-17 against product `a8ecc4d` (PR #117, `origin/main` is an
ancestor) and companion `6954342` (PR #55), both on `feature/agento-router-skill`,
both clean (`git status --porcelain --untracked-files=all` empty) and at
`ahead: 0` of their remotes. Skills consulted: agent-customization (built-in VS Code
skill; `references/skills.md` for SKILL.md frontmatter and location rules) — the
repository has no `.agents/skills/` table, so no project skill applies.

Verification run by the Reviewer (all in the product worktree):

- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` — exit 0, 554 tests,
  554 pass, 0 fail (270.8 s); matches the roadmap 3.1 record and the plan baseline
  of 551 + 3 new router tests.
- Guard replays from AGENTS.md — Local, companion, Copilot format, Copilot format +
  companion, Copilot fixtures: all exit 0.
- `node --test tests/harness-probe/probe.test.mjs` — 23/23 pass (docs links resolve).
- `shellcheck` is not installed locally (`command -v` empty, exit 127), exactly as the
  plan baseline records; the authoritative gate is CI: `ci` run `39007995465` on
  `a8ecc4d` concluded `success` with the `Shellcheck` step `success` (zero findings,
  matching the `main` `6ee4bdd` zero-finding baseline), plus Unit tests and all four
  guard-replay steps `success` (`gh run view 39007995465 --json jobs`).
- Guidance-coverage proof without touching the worktree: `git archive HEAD` into
  `/tmp/router-proof`, appended a bare `/delivery-status` to the copied
  `skills/agento/SKILL.md`, ran `tests/customizations.test.mjs` → test 46 "active
  guidance qualifies Agento slash commands with the plugin name" failed with
  `skills/agento/SKILL.md contains an unqualified Agento command` (the only other
  failure, test 54, was the copy lacking `.git`). Copy removed; worktree stayed clean.
- Evidence: every `evidence/*.png` linked from roadmap.md exists and every file under
  `evidence/` is linked; the 13 screenshots were viewed (details per item below).
- Teardown: `~/.copilot/skills/agento` is absent (`~/.copilot/skills/` holds only
  `use-railway`); `git worktree list` has no `plan-20261016-191841` entry.

## Acceptance checklist results

1. **`skills/agento/SKILL.md` frontmatter** — pass. File exists with `name: agento`
   (directory `skills/agento`), `argument-hint: "<command> [args]"`,
   `user-invocable: true`, `disable-model-invocation: true` (the value Phase 2
   settled — 2.3 reached the router with it), description starts `Use when` and is
   quoted (it contains colons, per the agent-customization skill's pitfall list).
   Enforced by "the router skill exists with the decided frontmatter" in
   `tests/customizations.test.mjs` (passes in the 554/554 run).
2. **Router body content** — pass. `skills/agento/SKILL.md` §1 parse, §2 redirect
   rule written with placeholders only (`<name>.prompt`), §3 root discovery (`Agento
   CLI:` line, else `realpath` two levels up), §4 unknown-name list and no-guessing,
   §5 dispatch table naming all six agents exactly once with Planner/Architect/
   Mechanic/Autopilot inline and Builder/Reviewer subagent, §6 no own receipt.
   Enforced by "the router dispatch content names every agent exactly once…" (passes).
3. **Every `commands/*.md` `agent:` valid** — pass. `grep -h '^agent:' commands/*.md`
   gives 11 × `"agent"` and 10 real agent names (Architect 1, Autopilot 1, Builder 2,
   Mechanic 2, Planner 2, Reviewer 2); 4 files have none. Enforced by "every command's
   agent: is absent, agent, or an existing agent name" (passes).
4. **`skills/**/SKILL.md` covered by the guidance and link tests** — pass.
   `listSkillFiles()` is in `guidanceFiles` (`tests/customizations.test.mjs` L878)
   and in the relative-link test (L229–L230); the `/tmp` archive proof above made
   the qualified-command test fail on the skill, as the item requires.
5. **Copilot `/agento delivery-status`** — pass.
   `evidence/step-2-3-copilot-delivery-status.png` shows "Read skill · agento" and
   `Receipt: accepted delivery-status:main:6ee4bdd`;
   `evidence/step-2-3-copilot-delivery-status-result.png` shows the
   `Result: completed — … next: /agento build-feature agento-router-skill` line.
6. **Copilot redirect and unknown name** — pass.
   `evidence/step-2-3-copilot-redirect-steps.png` shows "Read skill · agento", the
   sentence "Reading `/agento delivery-status.prompt` as `/agento delivery-status`",
   then the preflight/delivery-status run (`-result.png` has the receipt and result
   line); `evidence/step-2-3-copilot-unknown.png` shows "`not-a-command` isn't a
   valid Agento command, so I haven't run anything" followed by all 25
   `/agento <name>` entries and no receipt (3 steps, 8 s). Note: Copilot renders the
   redirect sentence inside the collapsed "Completed N steps" block, as the Builder
   recorded in `docs/copilot-harness.md`.
7. **Copilot `/agento new-feature` inline as the Planner** — pass (after the 2.9
   fix, re-verified in 2.10). `evidence/step-2-3-copilot-new-feature.png` shows
   "Read skill · agento", the Planner dispatched inline, and a structured
   clarifying-question card with option 1 "(Recommended)" — but no visible receipt;
   `evidence/step-2-10-copilot-new-feature-receipt.png` shows
   `Receipt: accepted new-feature:plan-20261016-191841:6ee4bdd` printed before the
   question card. The throwaway session `plan-20261016-191841` is gone
   (`git worktree list`, roadmap 2.8).
8. **Local `/agento delivery-status` unchanged** — pass with a user-accepted
   deviation. `evidence/step-2-6-local-delivery-status.png` shows Session Target
   Local, `Receipt: accepted delivery-status:main:6ee4bdd`, and the full report;
   `-result.png` shows the result line. The literal "no Read skill · agento" clause
   did **not** hold: the reply itself states "This run came through the user skill
   `~/.copilot/skills/agento`". The user chose on 2026-10-17 to accept the Local
   takeover (plan.md `## Decisions`, last entry; `## Risks`, last bullet), recording
   the lost Local model switching as a known gap for `harness-install` /
   `harness-docs`. Output and receipt were correct, so the item's behavioral intent
   holds under the accepted decision.
9. **`docs/copilot-harness.md` `## Router skill`** — pass. Section at L234 carries
   the `ln -s <clone>/skills/agento ~/.copilot/skills/agento` command, the dispatch
   table, and the dated Phase 2 results (all four Copilot checks, redirect placement,
   the ask-user card, the missing-receipt fix and 2.10 confirmation, the Local
   takeover and model-switch gap, the settled `disable-model-invocation: true`, turn
   timings); the "Implication for `agento-router-skill`" paragraph is updated; no
   placeholder text remains (`grep -i placeholder|pending|TODO` empty).
   `tests/harness-probe/probe.test.mjs` 23/23.
10. **Gates** — pass. Full suite 554/554 (exit 0), five guard replays exit 0,
    Shellcheck zero findings in CI run `39007995465` on `a8ecc4d` (locally not
    installed, as the baseline recorded); results are on roadmap 3.1/3.2 and
    re-run here.
11. **Teardown** — pass. `~/.copilot/skills/agento` absent; both halves clean
    (`git status --porcelain --untracked-files=all` empty in product and companion).

## Plan vs implementation

- Files touched match `## Approach` exactly: `skills/agento/SKILL.md` (new),
  `tests/customizations.test.mjs`, `docs/copilot-harness.md`; nothing in
  `commands/`, `.github/prompts/`, `.github/agents/`, `scripts/`, the extension, or
  `.claude-plugin/plugin.json` (no `skills` key).
- Two user-approved deviations, both recorded in plan.md: (1) the Local takeover
  (item 8 above); (2) added step 2.9 — the receipt-verbatim rule in SKILL.md §5 and
  its assertion in the dispatch-content test — after 2.3 showed the Planner
  summarising the preflight instead of printing the receipt; 2.10 re-verified it live.
- Steps 2.4/2.5 (flip to `disable-model-invocation: false`) were correctly marked
  obsolete: 2.3's four screenshots show "Read skill · agento" with `true`.
- `docs/copilot-harness.md` records that the Planner's question rendered as a
  structured ask-user card in Copilot, contradicting the earlier "no ask-user tool"
  finding; the Builder scoped that finding to the `task` subagent tool. Reasonable;
  no plan change needed.

## Roadmap audit

All 17 boxes are ticked; every tick was spot-checked and holds:

- 1.1–1.4: tests present and passing; 1.4's proof reproduced in a `/tmp` copy.
- 1.5, 2.7: docs section present, complete, link test green.
- 2.1, 2.2, 2.8: link and throwaway worktree created (the Copilot screenshots prove
  the link worked and the 2.10 screenshot shows the `plan-20261016-191841`
  workspace) and both torn down (verified absent).
- 2.3, 2.6, 2.10 `(manual)`: every linked evidence file exists and was viewed;
  completion dates are on the lines. The unlinked name
  `evidence/step-2-3-copilot-unresolved.png` in 2.3's verify text is the
  conditional alternative that was not needed, not a missing file.
- 2.4, 2.5: obsolete markers use `~text~ (obsolete <date>: <reason>)` — a harmless
  variant of the contract's `(obsolete: <reason>)`; left as is.
- 2.9 `(added 2026-10-17)`: rule and assertion present; tests green.
- 3.1, 3.2: re-run by the Reviewer (554/554, replays 0, CI `39007995465` success).

No falsely ticked boxes, no missing steps added, no repairs made.

## Findings

1. **Minor — wording in `skills/agento/SKILL.md` §5** (L67): "the dispatched
   command's §9 receipt line must be printed verbatim as visible text, before any
   question or other output" can be read as forbidding the router's own redirect
   sentence (§2/§6), which legitimately precedes the receipt
   (`evidence/step-2-3-copilot-redirect-steps.png`). Suggest "before any question or
   other output *of the dispatched command*". The live behaviour was correct.
2. **Minor — plan.md `## Acceptance checklist` item 8** still states "no Read skill ·
   agento" although the user accepted the opposite outcome in `## Decisions`. The
   decision is documented; a one-line amendment to the item would remove the
   apparent contradiction for future readers (Planner/Builder edit, not Reviewer).
3. **Minor — test token check** in `tests/customizations.test.mjs` ("the router
   dispatch content names…"): `body.includes("task")` would be satisfied by any word
   containing "task"; `` `task` `` (backticked) would pin the tool name. Low risk.
4. **Observation — Local takeover**: with the link installed, Local loses the
   command file's profile-applied prompt `model:` and the agent-mode switch for
   Planner/Architect/Mechanic/Autopilot (Builder/Reviewer pins survive via
   `runSubagent` + `subagentModel`). Accepted by the user and assigned to
   `harness-install` / `harness-docs`; not a defect of this delivery.

No security-relevant change: the skill is prose, reads `commands/*.md` under the
clone root, and adds no shell, hook, or network behaviour.

## Follow-ups

- `harness-install`: decide whether Local should be taken over by the router link at
  all (e.g. a Copilot-only skill location, if one exists) — carried from plan.md
  `## Risks`.
- `harness-docs`: document the Local model-switch gap and the by-hand link.
- Tighten SKILL.md §5 wording per finding 1 and the `task` token check per finding 3
  in the next touch of the router (no separate issue needed).
- `docs/copilot-harness.md`: reconcile the "no ask-user tool" finding with the
  structured ask-user card observed inline in Copilot (which contexts have it).
