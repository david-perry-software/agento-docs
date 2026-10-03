```yaml
status: in-progress
branch: issue/autopilot-subagent-model-pins
last-updated: 2026-10-02
next-step: "4.1 pass runSubagent model pins in the Autopilot body"
github-issue: "#79"
artifact-pr: "#22"
```

## Phase 1: Live reproduction

- [ ] 1.1 (manual) Run A — keep `mixed` applied to `/home/david/DP/agento`
  unchanged. When the soshiki `plan-20261002-213543` `/agento ap api-shared-kernel`
  run invokes the 🔍 Agento Reviewer subagent, take a screenshot of the subagent
  pill showing its model. If that run has already ended, re-run
  `/agento ap api-shared-kernel` in that window — verify:
  `node scripts/agento.mjs models list --plugin-root /home/david/DP/agento` reports
  `active: "mixed"`. The screenshot is saved as `evidence/step-1-1-run-a-reviewer.png`
  and linked here. The Reviewer subagent's `modelName` (or the refusal text) is read
  from `~/.config/Code/User/workspaceStorage/d8f8087a25de51c2b43f460bb22c5af2/chatSessions/*.jsonl`
  (`toolSpecificData.kind == "subagent"`, `agentName` "🔍 Agento Reviewer") and
  recorded on this line.
- [ ] 1.2 (manual) Run B — in a new chat in the same soshiki window, select the
  built-in Agent role and set the picker to a Copilot model that is not Claude
  Fable 5.1 and whose cost tier is at least Fable 5.1's. Send: "Use the 🔍 Agento
  Reviewer subagent with this task: reply with one line naming the model you are
  running on; do not read, run, or change anything." Take a screenshot of the
  subagent pill — verify: the screenshot is saved as
  `evidence/step-1-2-run-b-copilot-caller.png` and linked here, with the caller
  model named. The Reviewer subagent's `modelName` from the new chat's transcript
  is recorded on this line.
- [ ] 1.3 (manual) Run C (control) — repeat 1.2 in a new chat with the picker on
  DeepSeek V4 Pro and take a screenshot of the subagent pill — verify: the
  screenshot is saved as `evidence/step-1-3-run-c-byok-caller.png` and linked here.
  The Reviewer subagent's `modelName` (or refusal text) is recorded on this line.
- [ ] 1.4 Classify the result for each run: pin honored, fallback to the caller's
  model, or tier refusal. Write the reproduction steps, the observed vs expected
  behavior, and links to the three screenshots into plan.md `## Evidence`, and
  replace "Status: unreproduced". If Run A and Run C show Claude Fable 5.1 (no
  defect), stop and ask the user to re-run with a screenshot, per Decision 1 —
  verify: `grep -n "Run A\|Run B\|Run C" plan.md` shows each run's model in
  `## Evidence`.
- [ ] 1.5 Post the classified result on the issue with links to the evidence on the
  companion branch: `gh issue comment 79 --body-file <tmp>` — verify:
  `gh issue view 79 --comments` shows the comment with all three runs.

## Phase 2: Exposing regression test

- [x] 2.1 Add to `scripts/agento.test.mjs` the test `issue #79
  autopilot-subagent-model-pins: models apply pins handoffs[].model to the target
  agent's model; clear removes it`. It runs on `modelsFixture` with a profile
  pinning `planner`, `builder`, `reviewer` (a two-entry list), and `autopilot` to
  distinct qualified names. After `models apply` it asserts that each handoff item
  in the planner, builder, and reviewer agent files carries
  `    model: "<target's pin>"` (first list entry for the Reviewer target) and that
  `models list` reports the profile active. After `models clear` it asserts that
  `git diff --quiet` passes. Record the failure output on this line — verify:
  `node --test --test-name-pattern "issue #79" scripts/agento.test.mjs` exits
  non-zero, and the failure is the missing handoff `model:` assertion.
  **Result (2026-10-02):** exit 1, 1 fail — `AssertionError: The input did not
  match the regular expression /^    model: "Builder Model \(copilot\)"$/m` on
  `.github/agents/delivery-planner.agent.md` (top-level `model: "Planner Model
  (copilot)"` present, nested handoff `model:` absent) — the missing handoff
  `model:` assertion, as expected.

## Phase 3: CLI fix

- [x] 3.1 In `scripts/model-profiles.mjs`, add handoff-pin helpers. They read, set,
  replace in place, and remove the nested `model:` line of each `handoffs:` list
  item, using the item's key indentation and inserting after the item's last key.
  They use JSON-quoted rendering and preserve CRLF and every other byte. Extend the
  per-file state used by `readModel`/`detectActive` and `differsBeyondModel` to
  cover handoff lines. `resolveTargets` returns each agent file's handoff values:
  target name → resolved pin, first entry of a list, `null` when unpinned. Add
  byte-exact tests (insert, replace, remove, CRLF, list → first entry, unpinned
  target) to `scripts/model-profiles.test.mjs` — verify:
  `node --test scripts/model-profiles.test.mjs` exit 0.
  **Result (2026-10-02):** exit 0 — 24 tests, 24 pass. Fixed two in-flight bugs:
  replace-in-place re-applies the item's key indentation, and the handoff key regex
  now tolerates a trailing `\r` so CRLF files parse.
- [x] 3.2 In `scripts/agento.mjs`, `models apply`/`clear` write and remove the
  handoff lines. A file counts as pinned for skip-worktree when it carries a
  top-level or a handoff pin. `modelsState` `active`/`dirty` count handoff lines
  (dirty refusal test: an edit beyond both kinds of line still refuses) — verify:
  `node --test --test-name-pattern "issue #79" scripts/agento.test.mjs` exit 0 and
  `node --test scripts/agento.test.mjs` exit 0.
  **Result (2026-10-02):** exposing test passes after the fix; full
  `scripts/agento.test.mjs` 81 tests, 81 pass. Added
  `models apply ignores handoff model: lines in dirty detection and still refuses
  other edits`.
- [x] 3.3 Add the read-only verb `models pins` (no argument; honors
  `--plugin-root`). It emits `pins: { <alias>: { name, file, model, subagentModel } }`
  read from the plugin root's current files, plus `warnings` and the usual
  `modelsReport` fields. Change the usage header line to
  `models [list | pins | show <name> | apply <name> | clear | init] [--plugin-root <dir>]`
  and update the usage assertion (line ~2582). Add CLI tests: unpinned → every
  `model`/`subagentModel` is `null`; after apply → values match, list →
  `subagentModel` is the first entry; `pins extra` → exit 1 — verify:
  `node --test scripts/agento.test.mjs` exit 0.
  **Result (2026-10-02):** exit 0 — 82 tests, 82 pass.
- [x] 3.4 Add the BYOK tier warning. A pure helper reads the vendor from a
  `<name> (<vendor>)` value and warns when `autopilot`'s pin is a non-`copilot`
  vendor while `builder` or `reviewer` pins a `copilot` vendor. The message names
  the pins and says to pin `autopilot` at least as high as the highest-tier model
  it delegates to. Unqualified names give no warning. `models show`/`apply`/`pins`
  report it in `warnings[]` (apply still exits 0), and the `model-profile` doctor
  check returns `warn` with that detail when the applied pins trigger it. Add unit,
  CLI, and doctor tests — verify: `node --test scripts/model-profiles.test.mjs
  scripts/agento.test.mjs` exit 0.
  **Result (2026-10-02):** exit 0 — 108 tests, 108 pass. Added CLI show/apply/pins
  warning test and a doctor model-profile warning test.
- [x] 3.5 Refresh the extension bundle: `cd extension && npm run copy-cli` —
  verify: `node --test tests/extension-bundle.test.mjs` exit 0 and
  `cmp scripts/model-profiles.mjs extension/cli/model-profiles.mjs` and
  `cmp scripts/agento.mjs extension/cli/agento.mjs` both exit 0.
  **Result (2026-10-02):** exit 0 — 4 tests, 4 pass; both `cmp` exit 0.

## Phase 4: Autopilot and committed-file guard

- [ ] 4.1 Update `.github/agents/delivery-autopilot.agent.md`:
  - Add a Preflight step: run `node <agento-root>/scripts/agento.mjs models pins`
    and keep `pins.builder.subagentModel` and `pins.reviewer.subagentModel`. If the
    call fails, proceed unpinned and say so in a progress note. Relay each
    `warnings[]` entry as a progress note.
  - Every Builder invocation (Loop 1, the Loop 2 re-invocation, the Loop 4 fix) and
    every Reviewer invocation (Preflight 2, Loop 3) passes that value as the
    `runSubagent` `model`, and omits it when `null`.
  - On a tier refusal, stop without retrying unpinned. Relay the refusal and the
    models it lists, and name the fix (pin `autopilot` at least as high as the
    highest-tier model in the profile, then `/agento models apply <name>`), with
    `next:` `/agento ap <slug>`. Leave the roadmap unchanged.

  Keep the §9/§11/§12 lines intact — verify:
  `grep -n "models pins" .github/agents/delivery-autopilot.agent.md` matches, and
  `node --test tests/customizations.test.mjs` exit 0.
- [ ] 4.2 Extend `tests/customizations.test.mjs`:
  - The committed-file test also rejects an indented `model:` line inside a
    `handoffs:` item.
  - A new test asserts that the Autopilot body cites `models pins`, the
    `runSubagent` `model`, and the tier-refusal stop.

  Record the probe on this line — verify:
  `node --test tests/customizations.test.mjs` exit 0. A temporary local commit
  adding `    model: "X"` to the Builder's handoff makes the committed-file test
  fail. Then reset that unpushed probe commit.

## Phase 5: Docs, end-to-end, and gate

- [ ] 5.1 In `docs/model-profiles.md`:
  - Add a handoff row to the `## Resolution` table: target agent's pin, first entry
    of a list.
  - Describe handoff lines under `## Applying and clearing`.
  - Add a `models pins` paragraph (what the Autopilot uses).
  - Document the BYOK tier warning and its doctor `warn`.

  Then add `pins` to the `docs/commands.md` CLI line (~141) — verify:
  `grep -n "models pins" docs/model-profiles.md docs/commands.md` matches both.
- [ ] 5.2 (requires 1.4) Replace the `## Limits` bullet ``handoffs[].model` is not
  written…`` with a `## Subagents and handoffs` section per Decision 5, worded to
  phase 1's classified results. It covers:
  - the observed setup: VS Code 1.136, Local harness, a bring-your-own-key calling
    model;
  - what happened when the target pin's cost tier exceeds the caller's (fallback or
    refusal, as observed);
  - where agent `model:` pins apply: on direct selection, and to Local subagents
    whose caller is not a lower-tier BYOK model;
  - that Agento now passes explicit `runSubagent`/handoff models;
  - that Copilot-harness (Agent Host) behavior is unverified.

  Verify: `grep -n "Subagents and handoffs\|1.136\|Agent Host" docs/model-profiles.md`
  matches, and `grep -n "handoffs\[\].model. is not written" docs/model-profiles.md`
  matches nothing.
- [ ] 5.3 Add a **Fixed.** entry citing #79 to CHANGELOG `## Unreleased` — verify:
  `grep -n "#79" CHANGELOG.md` matches under `## Unreleased`.
- [ ] 5.4 Run an end-to-end check on a temporary clone of this branch, with
  `AGENTO_CONFIG_HOME` set to a temporary copy of `~/.config/agento/model-profiles.json`:
  - `models apply mixed`: three handoff `model:` lines carrying the target pins,
    `warnings[]` naming the BYOK `autopilot` vs the Copilot `reviewer`, and
    `git status --porcelain` empty;
  - `models pins`: builder `DeepSeek V4 Pro (deepseek)` and reviewer
    `Claude Fable 5.1 (copilot)`;
  - `doctor`: `model-profile` warn;
  - re-apply: `changed: []`;
  - `clear`: `git diff --quiet` and no `S` bits.

  Record the transcript summary on this line — verify: every listed check holds.
- [ ] 5.5 Run the full gate:
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exit 0 (≥ 259
    tests, 0 fail);
  - `git ls-files '*.sh' | xargs pnpm dlx shellcheck` exit 0 with no findings
    (baseline: 0);
  - `cd extension && npm run typecheck && npm run test:unit` exit 0.

  Compare the results with the baseline in plan.md `## Research` — verify: all
  three exit 0, and the comparison is recorded on this line.
- [ ] 5.6 Write plan.md `## Resolution` (root cause per phase 1, what changed, the
  exposing test passing). Integrate `origin/main` in both halves, set
  `status: in-review`, and push product and companion — verify:
  `node scripts/agento.mjs session --pr` reports `delivery.status: in-review`.

## Phase 6: Post-ship live check

- [ ] 6.1 (manual, post-ship) In `/home/david/DP/agento`, run
  `node scripts/agento.mjs models clear`, then `git pull`. In
  `~/.config/agento/model-profiles.json`, set `mixed`'s `agents.autopilot` to a
  Copilot model whose cost tier is at least Claude Fable 5.1's. Run
  `node scripts/agento.mjs models apply mixed` (expect no BYOK warning), reload the
  soshiki window, and run `/agento ap api-shared-kernel` so it invokes the Reviewer
  subagent. If the delivery is already approved, use the next in-review delivery or
  a `/agento ap` run at the review phase. Take a screenshot of the Reviewer subagent
  pill — verify: the screenshot is saved as
  `evidence/step-6-1-reviewer-pinned.png` and linked here, and the transcript's
  Reviewer subagent `modelName` is `Claude Fable 5.1`.
- [ ] 6.2 (manual, post-ship) In a soshiki chat, select 🔨 Agento Builder (picker
  shows DeepSeek V4 Pro), finish a turn, and click **Review this work**. Take a
  screenshot of the picker after the switch — verify: the screenshot is saved as
  `evidence/step-6-2-handoff-picker.png` and linked here, and shows
  Claude Fable 5.1 on 🔍 Agento Reviewer.
