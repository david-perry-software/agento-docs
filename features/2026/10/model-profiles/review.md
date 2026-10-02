# Review: model-profiles

Verdict: approve

Re-review on 2026-10-01 at product `afc5114` (feature/model-profiles, PR #71), with the
companion artifacts at `09cc0b2` on feature/model-profiles (PR #18). Both halves match
their remotes and contain their `origin/main`. The roadmap is `status: in-review` with
28 of 28 steps ticked. Earlier reviews were at `483c207` and `330c7bb`; the last one
requested changes only because the runtime check (4.7) and the cleanup (4.8) were
outstanding.

Since then, 4.5–4.8 are done and a new step, 4.9, makes the guidance require
vendor-qualified model names. Attempt 1 of 4.7 found that VS Code ignores an
unqualified pin for a non-Copilot model. The only product change since `330c7bb` is
`afc5114` (4.9): four documentation and template files. Every automated check passes
again, the runtime evidence is in place, and the primary clone is clean. Every
acceptance item passes and there are no findings above informational.

Skills consulted: none — no matching domain (the repository has no `.agents/skills/`
and AGENTS.md has no `## Agento` skills table).

## Acceptance checklist results

1. **pass**: `scripts/model-profiles.test.mjs` covers schema errors, the resolution
   table, byte-exact insert/replace/remove (including CRLF and the `description:`
   fallback), array values, and active detection. It passes inside the full run,
   259/259.
2. **pass**: the `agento.test.mjs` apply/clear cases (files, mirrors, `S` bits,
   `changed: []` on repeat, `git diff --quiet` after clear, dirty refusal, non-git
   roots, `init` once, linked-worktree refusal) pass inside the full run. The code
   is unchanged since the reviewer's independent temp-clone end-to-end run at
   `483c207`.
3. **pass**: `node scripts/agento.mjs doctor --plugin-root /home/david/DP/agento`
   reports `model-profile` `ok` "no profile applied to /home/david/DP/agento".
   `doctor --for models` reports `needs: ["terminal"]`. The warn cases are covered by
   agento.test.mjs (259/259).
4. **pass**: the usage assertion (`usage()` `.slice(1, 24)`) passes in the full run.
5. **pass**: the no-pin test in `tests/customizations.test.mjs` passes. Registrations
   are enforced by the suite. `cmp commands/models.md .github/prompts/models.prompt.md`
   gives exit 0 after the 4.9 edit.
6. **pass**: `docs/model-profiles.md`, `templates/model-profiles.json`, the
   docs/install.md Updating paragraph, and the Mechanic lines are present. The
   template still parses (`node -e 'JSON.parse(…)'` exit 0). Its 4.9 placeholders
   still contain `<…>`, so the shipped-template case (exit 3, placeholder errors)
   still passes.
7. **pass**: CHANGELOG `## 0.7.0 (unreleased)` with **Added**; all three manifests
   are 0.7.0; the customizations version test passes.
8. **pass** (rerun at `afc5114`): `cd extension`, then:
   - `npm run copy-cli` exit 0, leaving the tree clean.
   - `npm run typecheck` exit 0.
   - `npm run test:unit` exit 0, 85/85.
   - `node --test tests/extension-bundle.test.mjs` exit 0.

   The extension sources have not changed since `330c7bb`, where `test:electron` and
   `package` were rerun by the reviewer (exit 0, agento-dashboard-0.7.0.vsix).
9. **pass**: the 4.2 transcript matches the reviewer's independent temp-clone run
   (code unchanged since).
10. **pass**: full gate rerun by the reviewer at `afc5114`:
    - `git ls-files '*.sh' | xargs pnpm dlx shellcheck` exit 0 with empty output, the
      same as the baseline.
    - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exit 0, 259 tests,
      259 pass, 0 fail (baseline 229; same count as at `330c7bb`, since 4.9 adds no
      tests).
    - `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` exit 0.
    - `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt`
      exit 0.
    - Extension typecheck exit 0.
    - GitHub check `test` on PR #71 at `afc5114`: pass.
11. **pass**: runtime check in VS Code.
    - 4.6 applied `mixed` to `/home/david/DP/agento`; 4.9 re-applied it with
      qualified names. The user's `~/.config/agento/model-profiles.json` now reads
      `DeepSeek V4 Pro (deepseek)` for default and builder, `Claude Opus 5.5
      (copilot)` for planner and architect, and `Claude Fable 5.1 (copilot)` for
      reviewer. `models show mixed` gives `errors: []`.
    - [evidence/step-4-7-planner.png](evidence/step-4-7-planner.png) (20:02:32) shows
      📋 Agento Planner with Claude Opus 5.5 in the picker.
      [evidence/step-4-7-model-picker.png](evidence/step-4-7-model-picker.png)
      (20:03:13) shows 🔨 Agento Builder with DeepSeek V4 Pro. Both are in a window
      with no folder open, so no workspace `.github/agents` competes with the plugin.
    - The attempt-1 captures ([planner](evidence/step-4-7-attempt-1-planner.png),
      [builder](evidence/step-4-7-attempt-1-builder.png), 19:58) show the Builder
      staying on Opus. The VS Code log `~/.config/Code/logs/20261001T094453` has one
      warning, `19:58:27.273 [warning] [chat] … "DeepSeek V4 Pro" not found. Use
      format "<name> (<vendor>)"`, and none after 20:00. The only later match is a
      20:04 terminal-command echo, not a warning.
    - Cleared afterwards (4.8), checked independently:
      - `git -C /home/david/DP/agento diff --quiet` exit 0.
      - `status --porcelain` is empty.
      - `ls-files -v | grep -c '^S'` gives 0.
      - No `^model:` line remains in any agent, prompt, or mirror.
      - `models list --plugin-root /home/david/DP/agento` gives `active: null`.
      - The clone is on `main`.
    - Agents were switched by selection, not by a handoff button. Roadmap 4.7 allows
      "(or select it)", and the plan's Risks call for a follow-up when the handoff is
      unproven. That follow-up is recorded (finding 6).

## Plan vs implementation

- 4.9 `(added 2026-10-01)` came out of 4.7 attempt 1. Its diff (`330c7bb..afc5114`,
  4 files, +19/−11) is limited to its stated scope:
  - `docs/model-profiles.md`: the value rule, the log message, and how to read the
    vendor from the model id.
  - `templates/model-profiles.json`: the placeholders.
  - `.github/prompts/models.prompt.md` and `commands/models.md`: the `init`
    instruction, byte-identical.

  No code, test, or extension change. The docs' example profile already used the
  qualified form, and a search finds no unqualified model-name examples left in the
  product.
- Model-name validation stays pass-through (decision 2, "no vendor-suffix warning" is
  out of scope). The failure mode is now documented, and the warning is a recorded
  follow-up rather than a scope change.
- Everything else is as recorded in the earlier reviews: the template landed early
  in 1.5; the `summarizeModelsResult` helper; "stale" folded into `custom`; fix-round
  steps 1.10, 2.4, 3.4, and 3.5. The 31 files changed against `origin/main` match the
  plan's affected-files list plus generated and test files.

## Roadmap audit

- 4.5 (manual): ticked, linked evidence
  [step-4-5-profiles-filled.png](evidence/step-4-5-profiles-filled.png) exists, and
  `models show mixed` currently gives `errors: []`.
- 4.6: the recorded numbers (changed=54, skipWorktree=54) were verified live in the
  previous review.
- 4.7 (manual): ticked, with both attempts recorded. All four linked screenshots exist
  under `evidence/`. The required `evidence/step-4-7-model-picker.png` is present
  and linked. The log claim checks out.
- 4.9: `cmp` equal, template parses, 259/259, and the requalified profile matches the
  line. The re-apply itself is no longer observable, because 4.8 cleared it.
- 4.8: every verify claim holds against the live clone (see item 11).
- Steps 1.1–4.4 are unchanged since the previous audit, which spot-checked each one.
  `afc5114` touches none of their code.
- The header is `status: in-review` with `next-step: ""`, which is correct for a
  fully ticked roadmap.
- No `(manual, post-ship)` steps.
- No falsely ticked boxes; no repairs made.

## Findings

No findings above informational.

Open findings come first, then resolved ones. Numbers are kept from earlier reviews.

- **3, info**: the doctor check warns on template placeholders until the user fills
   them in. Accepted as planned behavior (roadmap Follow-ups).
- **4, info**: `dirty` is computed on every verb, about 230 ms on `models list`.
   Accepted (roadmap Follow-ups).
- **6, info**: a mid-conversation handoff (Planner → Builder button) was not
   exercised, so whether a handoff honors the target agent's `model:` is still
   unproven. Recorded as a roadmap follow-up for `handoffs[].model`.
- **7, info**: an unqualified name for a non-Copilot model is accepted by `models
   apply` and silently ignored by VS Code, apart from a log warning. The docs, the
   template, and `/agento models init` now say to qualify names. A
   `models show`/doctor warning for values without a `(vendor)` suffix is a recorded
   follow-up.
- **8, info**: runtime evidence covers agent pins only. Pins on built-in-agent prompts
   (`commands/*.md` in plugin mode) were not exercised at runtime; the user's
   per-command overrides are pending (roadmap Follow-ups). The acceptance item does
   not require it.
- **1, resolved**: linked-worktree plugin roots (1.10, 2.4).
- **2, resolved**: invalid `agento.pluginRoot` named in the error (3.4).
- **5, resolved**: the primary clone pinned during verification. 4.8 cleared it, so
   `/agento ship` can sync `main` in the primary.

Security: 4.9 changes only documentation and template text. The input validation
(control characters, `<`/`>`, JSON escaping, prompt keys matched against discovered
files) is unchanged and was checked in the earlier reviews. No secrets appear in the
evidence screenshots.

## Follow-ups

- Consider teaching `/agento ship`'s `main` sync to detect pinned skip-worktree files
  and suggest clear → pull → apply (plan Risks).
- Exercise a Planner → Builder handoff with a profile applied on the next real
  delivery (roadmap Follow-ups).
- Optional vendor-suffix warning in `models show`/doctor (roadmap Follow-ups).
