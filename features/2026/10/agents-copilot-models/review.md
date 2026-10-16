# Review: agents-copilot-models

Verdict: approve

Reviewed 2026-10-16 against product `feature/agents-copilot-models` @ `a654bad`
(PR #116, base `main`, `origin/main` is an ancestor of HEAD) and companion
`feature/agents-copilot-models` @ `26e9457` (PR #54). Both halves clean and in sync
with `origin` at the start of the review. Skills consulted: none — no matching
domain (the repository has no `.agents/skills/` directory and no `## Agento` skills
table; the plan's `agent-customization` built-in skill covers the agent-file format,
which was reviewed against the GitHub custom-agent alias list the plan quotes).

## Acceptance checklist results

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Probe records effective model per pin variant, tool set (ask-user / browser), and whether the subagent tool accepts a model | **pass** | `docs/copilot-harness.md`: the "Can a subagent ask the user" and "Do model pins apply" rows are rewritten and a new `## Agents and models` section records accepted form, `finding: picker-rejected`, BYOK result, the 13 Copilot tools (no ask-user, no browser), and `task`'s `model` parameter (bare id / `<vendor>/<id>`); it names the evidence path `features/2026/10/agents-copilot-models/evidence/step-1-2-*.png` in the companion repository (the same convention the file already uses for `harness-probe`). 14 `step-1-2-*.png` files are committed and linked from roadmap 1.2; I viewed `step-1-2-local-probe-unpinned.png` (picker stays on the session's `DeepSeek V4 Pro`, nested `probe-pinned` returned `Claude Opus 5.5`). |
| 2 | Every `tools:` entry is a GitHub primary alias or on the explicit VS Code-only allowlist; the test fails on an unknown entry | **pass** | `tests/customizations.test.mjs` "every agent tools: entry is a GitHub primary alias or an explicit VS Code-only tool" passes in the full run. Negative case run by me in a throwaway `git archive HEAD` copy under `/tmp` (never the worktree): adding `bogus-tool` to the Reviewer's `tools:` → `not ok 1 … .github/agents/delivery-reviewer.agent.md: bogus-tool`, `# fail 1`. Copy deleted afterwards. |
| 3 | Copilot ask-user / browser tool names added only if observed; otherwise docs state the §10 fallbacks apply | **pass** | Probe observed neither (`## Agents and models`, "Tool set" bullet). `git diff origin/main...HEAD -- .github/agents/` touches only `delivery-autopilot.agent.md` body text; no `tools:` line changed. `docs/copilot-harness.md` states "the §10 `ask-questions` and `browser` fallbacks apply there". Roadmap 2.2 marked obsolete with that reason. |
| 4 | On picker-rejected: `copilotModels` parsed and validated; `models apply` writes `[<picker>, <copilot id>]` agent pins; missing-alias warning in `show`/`apply`/`pins` and doctor. Otherwise the steps are marked obsolete with the finding | **pass (scope deviation recorded)** | Parsing/validation: `scripts/model-profiles.mjs` `parseProfiles` (object check, non-empty string, `<`/`>` placeholder, control character; unknown top-level keys still rejected) with two new `scripts/model-profiles.test.mjs` cases — pass. Warning: `missingAliasWarning` wired into `tierWarnings` (show/apply), `pinWarnings` (pins), and doctor's `model-profile` check (`warn`, detail joined with `; `), covered by "models show, apply, and pins warn for agent pins without a Copilot alias" and "doctor model-profile warns …" in `scripts/agento.test.mjs` — pass. **Not built:** the `[<picker>, <copilot id>]` list-pin write (`resolveTargets` expansion). The probe produced a third outcome the plan did not anticipate — the picker form is rejected *and* the list form `["Claude Opus 5.5 (copilot)", "claude-opus-5.5"]` is equally ignored for a directly selected agent — so writing the Copilot id into `model:` cannot help. That is recorded on roadmap 3.2 (obsolete, with the reason), on 1.3 (`finding: picker-rejected`), and in `docs/model-profiles.md` ("writing the Copilot id into a `model:` line was found not to help"). The item's own alternative route (mark obsolete with the finding — verify: roadmap and docs) is satisfied for that sub-part; nothing is silent. |
| 5 | `models pins` reports `copilotModel`; the Autopilot selects the subagent model form by its subagent tool | **pass** | `scripts/agento.mjs` `modelsPins(pluginRoot, copilotModels)` adds `copilotModel` (alias of the first entry, else `null`); test "models pins reports copilotModel for mapped, unmapped, and unpinned agents" passes. `.github/agents/delivery-autopilot.agent.md` Preflight step 2: `runSubagent` (Local) → `subagentModel`; `task` (Copilot) → `copilotModel` as the `task` tool's `model`, omitted when `null`; build, resume, review, and fix invocations all point at it. The extended Autopilot assertion in `tests/customizations.test.mjs` (`pins.builder.copilotModel`, `pins.reviewer.copilotModel`, `` `task` (Copilot harness) ``, `` `copilotModel` as the `task` tool's `model` ``) passes. |
| 6 | All six agents selected in a Copilot session run on their pinned model *or the documented fallback* | **pass** | Documented fallback (1.3, `docs/copilot-harness.md`, `docs/model-profiles.md`): a directly selected agent runs on the **session** model. Six screenshots `evidence/step-5-2-copilot-{planner,builder,reviewer,autopilot,mechanic,architect}.png` are committed and linked from roadmap 5.2 (plus the labelled extra `…-planner-plugin-copy.png`). I viewed planner, reviewer, and autopilot: each shows the agent picker set to the Agento agent, the scratch-clone agent file with its distinct pin (`Claude Opus 5.5`, `Claude Fable 5.1`, `Claude Sonnet 5.5`), and the chat footer / model picker on `Claude Haiku 5.5` — the fallback, exactly as documented. The agents' self-reported model lines were not used as evidence. |
| 7 | Local parity: pinned overrides, unpinned inherits | **pass (evidence reuse recorded)** | Pinned half: `evidence/step-5-3-local-builder.png` — Local session, selecting the scratch 🔨 Agento Builder switched the picker to `DeepSeek V4 Pro` and the footer shows `DeepSeek V4 Pro` (pin overrides). Unpinned half: by the user's decision the Architect re-run was skipped and roadmap 5.3 reuses `step-1-2-local-probe-unpinned.png` / `…-unpinned-ask.png` — a Local session, same VS Code build, same day, an agent file without `model:` stays on the session's `DeepSeek V4 Pro`. The mechanism under test (agent frontmatter with no `model:` inherits the parent) is identical for a probe agent and an Agento agent, so I accept it as satisfying the item; the deviation is documented on the step line, not silent. |
| 8 | `docs/model-profiles.md` no longer says Copilot is unverified; documents `copilotModels` (or why it is unnecessary) | **pass** (one stale paragraph — Findings F1) | "Copilot-harness (Agent Host) behavior is unverified." is replaced by the measured finding (L239–L249); `copilotModels` is documented in the file-format bullets, the Resolution-table note, the warnings section, and the template example. |
| 9 | Full tests, extension unit tests, `extension/cli` byte copy, four guard replays | **pass** | Run by me on `a654bad`: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → exit 0, `# tests 551 / # pass 551 / # fail 0`. `cd extension && npm run test:unit` → exit 0, 167/167. `cmp` of every `extension/cli/*.mjs` against `scripts/*.mjs` → no differences. Guard replays: default, companion, Copilot format, Copilot format + companion, and Copilot fixtures → all exit 0. |
| 10 | Lint gate: the PR's CI Shellcheck step passes with zero findings | **pass** | `gh pr checks 116` on head `a654bad…` → `test pass`; `gh run view 38935104818` → `Shellcheck: success` (plus Unit tests and all four guard replay steps `success`). No shell file is in the diff. Local reproduction was not possible in this session: `shellcheck` is not on PATH, and the only copy is a `pnpm dlx` cache binary the delivery guard refuses to run against hook files — the plan names CI as the gate, so this does not weaken the result. |
| 11 | Committed agent files still carry no `model:` line | **pass** | The existing `tests/customizations.test.mjs` no-`model:` test passes in the full run; the `git archive HEAD` copy used for item 2 showed the Reviewer file without a `model:` line (pins are working-tree-only via the filter). |

## Plan vs implementation

- **Probe outcome beyond the plan's two branches.** The plan modelled `picker-honoured`
  vs `picker-rejected` and, for the latter, list pins `[<picker>, <copilot id>]`.
  The probe found a third state: no `model:` form at all is applied to a directly
  selected agent in Copilot (picker, list, BYOK, specific, Auto), while the `task`
  tool takes a `model` (bare id / `<vendor>/<id>`). The Builder adapted correctly:
  3.1, 3.3, 3.4, 4.1, 4.2 were built (the alias map now feeds `copilotModel` for
  `task`), 3.2 and 3.5 were obsoleted with reasons, and 4.1's fallback chain
  collapsed to "alias of the first entry, else `null`" (noted on the step). All of
  this is recorded in roadmap.md and both docs; plan.md itself was not amended
  (single commit `ff64c75`). Acceptable — historical artifacts are not rewritten — but
  a future reader of the plan alone will expect list pins; review.md is the pointer.
- **2.2 obsolete** (no Copilot ask-user/browser tool) is consistent with decision 3
  and the docs state the §10 fallbacks.
- **Live verification semantics changed mid-build and were re-stated** on 5.2 and 5.3
  as `(added 2026-10-16)` text before the user ran them: 5.2 expects the session model
  (fallback), and 5.3 explains the `probe-unpinned` profile switch. Good practice.
- **5.3 evidence file naming** deviates from the verify line
  (`step-5-3-local-parity.png` → `step-5-3-local-builder*.png`) and the unpinned half
  reuses 1.2 Local evidence — both documented on the step line (scored above).
- **Process deviation:** commit `e3c75e1` (step 1.1: probe agents, PROMPTS.md Prompt 7,
  `probe.test.mjs` cases) was authored during the Autopilot's turn rather than the
  Builder's. Reviewed like any other commit: Conventional Commit naming the step,
  scoped to the step's files, structural tests added, no stray changes. No defect
  found; the orchestration deviation is noted for the harness/router follow-up.
- **No undocumented changes.** The 17-file product diff matches the plan's affected-files
  list (minus the obsoleted `resolveTargets` change); no prompt/`commands/` mirror
  needed to change because the Autopilot body is not a prompt.

## Roadmap audit

Spot-checked all 19 ticked boxes against the codebase and evidence:

- 1.1 — files and tests present (`probe-pinned-byok`, `probe-pinned-list`, extended
  `probe-pinned`/`probe-unpinned`, Prompt 7, two new structural tests). OK.
- 1.2 `(manual)` — 14 linked evidence files exist in `evidence/`, completion date on the
  line, the planned `step-1-2-local-probe.png` split is explained. OK.
- 1.3 — docs rows and section present; `finding: picker-rejected` on the line. OK.
- 2.1 — test present and effective (negative case verified). OK.
- 2.2, 3.2, 3.5 — obsolete with `~text~ (obsolete: <reason>)` per the artifact format;
  each reason traces to the 1.3 finding. OK.
- 3.1, 3.3, 3.4, 4.1, 4.2, 4.3 — code, tests, docs, template, and byte copy verified
  above. OK.
- 5.1 — scratch clone and profile recorded with concrete paths and six pins; 5.4
  confirms deletion and both halves clean (confirmed: `git status --porcelain
  --untracked-files=all` empty in both halves at review start). OK.
- 5.2 `(manual)` — six linked screenshots plus one labelled extra; completion date
  on the line; the outcome (fallback) matches the documented finding. OK.
- 5.3 `(manual)` — two linked screenshots, completion date, deviation documented. OK.
- 5.5 — test and guard results reproduced; the local shellcheck claim could not be
  reproduced here (no binary on PATH) but CI's Shellcheck step covers the same
  command, which is the plan's gate. Not a false tick.
- 5.6 — CI run on the current head re-checked green. OK.

No falsely ticked boxes; no missing-work steps added; no repairs made.

## Findings

1. **F1 (minor, docs)** — `docs/model-profiles.md` L137–L142 still describes a
   `models pins` entry as `{ name, file, model, subagentModel }` and says the Autopilot
   passes `subagentModel` as the `runSubagent` model, without `copilotModel` or the
   `task` rule the same file documents further down. Stale sentence, not a behavioral
   error; the later sections and the Autopilot body are correct.
2. **F2 (minor, design note)** — `missingAliasWarning` (`scripts/model-profiles.mjs`)
   returns `null` when `copilotModels` is absent or empty, so a profile with no map at
   all gets no nudge toward Copilot support. This matches the documented behavior
   ("when `copilotModels` is present") and avoids noise for Local-only users; flagged
   only so the router-skill member can decide whether a one-time hint belongs in
   `doctor`.
3. **F3 (info, process)** — Step 1.1's product commit was written in the Autopilot's
   turn (see Plan vs implementation). Content clean.
4. **Security** — no concerns. `copilotModels` values are validated (non-empty, no
   `<`/`>`, no control characters) and are only reported in JSON/warnings, never
   executed or interpolated into shell. No secrets in code, docs, or screenshots.

## Follow-ups

- Update the `models pins` paragraph in `docs/model-profiles.md` (L137–L142) to list
  `copilotModel` and the `runSubagent`/`task` selection rule (F1).
- `agento-router-skill` (initiative wave 3) should consume `pins.<agent>.copilotModel`
  for `task` orchestration and settle whether a `model:` pin applies to
  `task`-launched subagents, which 1.3 left undetermined.
- Decide whether `doctor` should hint once when `copilotModels` is absent entirely (F2).
