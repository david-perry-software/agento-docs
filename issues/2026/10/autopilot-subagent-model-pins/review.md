# Review: autopilot-subagent-model-pins

Verdict: approve

## Acceptance checklist results

1. **Exposing regression test fails pre-fix and passes after** — pass.
   `node --test --test-name-pattern "issue #79" scripts/agento.test.mjs` exits 0
   (1/1 pass) on the work branch (`a9d5aa6`). The pre-fix failure is recorded in
   roadmap 2.1: exit 1, `AssertionError: The input did not match the regular
   expression /^    model: "Builder Model \(copilot\)"$/m` on
   `delivery-planner.agent.md` (missing nested handoff `model:`), as expected.

2. **`models apply` writes handoff `model:` lines; `clear` removes byte-exactly;
   `active`/`dirty` account for handoff lines** — pass.
   Independent re-drive on a temp clone of the branch with a temp copy of
   `~/.config/agento/model-profiles.json`: `models apply mixed` wrote exactly
   three handoff pins — planner → `DeepSeek V4 Pro (deepseek)`, builder →
   `Claude Fable 5.1 (copilot)`, reviewer → `DeepSeek V4 Pro (deepseek)` —
   `git status --porcelain` empty; `models clear` then `git diff --quiet` exit 0
   with no `S` skip-worktree bits. Unit coverage: `scripts/model-profiles.test.mjs`
   24/24 pass.

3. **`models pins` reports each agent's `model`/`subagentModel`** — pass.
   `node scripts/agento.mjs models pins` emits all six aliases with
   `model`/`subagentModel` `null` when unpinned; against the applied primary
   clone (`--plugin-root /home/david/DP/agento`) it reports builder
   `DeepSeek V4 Pro (deepseek)` and reviewer `Claude Fable 5.1 (copilot)`
   (verified by re-running the CLI directly).

4. **BYOK tier warning in `show`/`apply`/`pins` and doctor `warn`** — pass.
   `node scripts/agento.mjs models show mixed` and `models pins` (applied) both
   emit a `warnings[]` entry naming the BYOK `autopilot` vs the Copilot
   `reviewer`; on the temp clone, `doctor`'s `model-profile` check returns
   `warn` with the same detail.

5. **Autopilot runs `models pins`, passes the pins, stops on tier refusal** — pass.
   Read `delivery-autopilot.agent.md`: Preflight 2 runs `agento.mjs models pins`,
   every Builder/Reviewer invocation passes `pins.<alias>.subagentModel` as the
   `runSubagent` `model` (omitted when `null`), and a tier refusal stops without
   retrying unpinned. The §9/§11/§12 lines are intact. The new
   `tests/customizations.test.mjs` assertion passes (full suite).

6. **Committed agents carry no `model:` line (top-level or handoff)** — pass.
   `grep -E '^[[:space:]]*model:' .github/agents/*.agent.md .github/prompts/*.prompt.md commands/*.md`
   finds nothing; the extended customizations test passes and its probe commit
   was reset (recorded in roadmap 4.2).

7. **Docs and changelog** — pass.
   `models pins` appears in `docs/model-profiles.md` (line 99) and
   `docs/commands.md` (line 147); `## Subagents and handoffs` at
   `docs/model-profiles.md:144` with `VS Code 1.136` and `Agent Host` wording;
   the old `handoffs[].model is not written` bullet greps nothing; CHANGELOG
   `## Unreleased` carries the #79 **Fixed.** entry (line 12).

8. **Phase 1 live test recorded and posted on #79** — pass.
   Three evidence screenshots viewed directly — each shows the 🔍 Agento Reviewer
   subagent on `Model: Claude Fable 5.1` (Run A: Autopilot on DeepSeek, Run B:
   built-in Agent on Claude Opus 5.5, Run C: built-in Agent on DeepSeek). The
   classified result comment is on issue #79 (comment id 5970149015), confirmed
   via `gh api repos/david-perry-software/agento/issues/79/comments`.

9. **Full gate green** — pass.
   `node --test` over all 10 test files: 273 tests, 273 pass, 0 fail;
   `git ls-files '*.sh' | xargs pnpm dlx shellcheck` exit 0, 0 findings;
   `cd extension && npm run typecheck` exit 0 and `npm run test:unit` 106/106;
   `cmp scripts/{agento,model-profiles}.mjs extension/cli/` both exit 0.

10. **Post-ship live check** — deferred to post-ship (policy §4).
    Roadmap 6.1 and 6.2 stay unticked `(manual, post-ship)`; `plan.md ## Risks`
    carries the justification (registered clone loads agents from `main`;
    pre-ship would re-register or detach the shared checkout; no preview exists
    for a VS Code plugin) and Decision 4 records the user's explicit acceptance.

## Plan vs implementation

- **No defect reproduced — deviation anticipated and handled.** Phase 1 predicted
  a fallback or tier refusal per the VS Code docs; all three live runs instead
  honored the Reviewer pin for every caller. The plan explicitly routed this
  outcome: step 5.2 reworded the docs to the observed result ("pin honored by
  every caller; no defect reproduced") and the fix ships as defensive hardening,
  which the user chose to keep.
- **Preflight renumbering in the Autopilot.** Adding the `models pins` step as
  Preflight 2 shifted the roadmap read to Preflight 3; roadmap 4.1's step text
  still calls the Reviewer direct invocation "Preflight 2". The roadmap result
  note flags this and the behavior is unchanged — wording nit only, no code
  impact.
- **No undocumented changes.** The product diff (`git diff origin/main...HEAD`)
  touches exactly the planned files: `scripts/{agento,model-profiles}.mjs` and
  their tests, `extension/cli/` (byte-equal bundle, `npm run copy-cli`),
  `.github/agents/delivery-autopilot.agent.md`, `tests/customizations.test.mjs`,
  `docs/model-profiles.md`, `docs/commands.md`, `CHANGELOG.md`.

## Roadmap audit

- All 19 ticked boxes verified against the codebase, test runs, and evidence; no
  falsely ticked boxes found.
- `(manual)` steps 1.1–1.3 carry linked `evidence/step-1-*.png` screenshots and
  transcript `modelName` values; step 1.5's issue comment (5970149015) is live on
  #79.
- Steps 6.1–6.2 remain unticked `(manual, post-ship)` with the §4 justification
  in place.
- No missing work discovered; no steps added or repaired.

## Findings

None above minor severity.

- Minor: roadmap 4.1's description references "Preflight 2" for the Reviewer
  direct invocation, which the new `models pins` step renumbered to Preflight 3.
  The result note already documents this; consider a one-word correction on a
  later touch (no behavior impact).

## Follow-ups

- None. The two post-ship checks are carried by `/agento ship`'s epilogue
  (roadmap 6.1–6.2), not by a new issue.
