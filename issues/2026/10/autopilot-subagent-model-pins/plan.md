# Autopilot subagents and handoffs keep the caller's model instead of the target agent's pin

## Problem

With a model profile applied, an agent's `model:` pin takes effect when the user
selects that agent directly. The user reports that it does **not** take effect when
another agent hands work to it. Profile `mixed` pins `autopilot` and `builder` to
`DeepSeek V4 Pro (deepseek)` and `reviewer` to `Claude Fable 5.1 (copilot)`. In
`/agento ap`, the 🔍 Agento Reviewer subagent then runs on the Autopilot's DeepSeek V4
Pro and never switches to Claude Fable 5.1. As a result, the reviewer the profile
chose (a stronger model, picked so it does not review its own builder's output) is
silently replaced by the builder-tier model. Agento sets no model explicitly on
either path. The Autopilot's `runSubagent` calls pass no `model`, and `models apply`
never writes `handoffs[].model`. `docs/model-profiles.md`
lists the latter under Limits.

## Evidence

GitHub issue: #79

- **Source.** This is the user's live report from the soshiki session
  `plan-20261002-213543`, run `/agento ap api-shared-kernel` (VS Code 1.136.0,
  Copilot Chat 0.64.0, Local harness). There is no screenshot.
- **Reproduction attempted (planner, 2026-10-02, read-only).**
  [evidence/transcript-plan-20261002-213543-subagents.txt](evidence/transcript-plan-20261002-213543-subagents.txt)
  holds what was extracted from that window's chat transcript.
  - The Autopilot requests ran on `deepseek/deepseek-v4-pro`.
  - Both `runSubagent` calls targeted 🔨 Agento Builder. Neither passed a `model`
    argument, and both subagents ran on `DeepSeek V4 Pro`.
  - These calls do not tell the two pins apart, because the Builder's own pin is
    also DeepSeek.
  - The run had not reached review, so there is no Reviewer subagent call in it.
  - No other local transcript contains a Reviewer subagent run since the profile
    was applied.
- **Status: unreproduced at planning time.** As decided (Decisions 1), roadmap
  phase 1 runs a live test that tells the two pins apart. Its outcome is recorded
  here and on #79. If the defect does not reproduce, the user re-runs and attaches a
  screenshot of the Reviewer subagent pill, which shows the model it ran on.
- **Observed vs expected.**
  - Observed (reported): the Reviewer subagent runs on the caller's model.
  - Expected: it runs on its own pin. If VS Code refuses that model, the run stops
    and says how to fix the profile.
- **Root-cause hypothesis.** The VS Code subagent docs (quoted in the evidence file)
  say a Local subagent takes, in order: the explicit `runSubagent` model, then the
  custom agent's `model:`, then Auto, then the caller's model. They also say
  *"Subagents of a bring your own key model continue to use that model unless you
  specify a different one,"* and that explicit or agent-configured models above the
  caller's cost tier are refused. DeepSeek V4 Pro is a bring-your-own-key (BYOK)
  model reached through the `deepseek` vendor, so the Reviewer's agent pin is
  ignored.

## Decisions

Intake (from the issue description): add `model:` to every `handoffs[]` entry, have
the Autopilot pass the target model when invoking Builder/Reviewer subagents,
verify the switch in a live window, and record the pin semantics in the
model-profiles docs.

Clarifying questions asked 2026-10-02 and the user's answers (verbatim):

1. *Reproduction — where was the Reviewer-on-DeepSeek observed; screenshot; or a
   discriminating live test as the plan's first step?* — "**Reproduction — I didn't
   reproduce it.** It's the user's live report from the `plan-20261002-213543`
   `/agento ap api-shared-kernel` run (transcript workspace `d8f8087a`, 21:36). I
   have no screenshot. So yes: make the plan's first step a live test that tells the
   two pins apart, and file the issue from its result. If it doesn't reproduce, the
   user re-runs and screenshots the Reviewer subagent pill (its model shows there).
   The cheap discriminator is the BYOK hypothesis: the same test with `autopilot`
   pinned to a Copilot model ≥ Fable 5.1 should *not* fall back."
2. *Cost tier — what should the Autopilot do when VS Code refuses an above-tier
   model?* — "**Cost tier — (a), plus apply-time warning.** If the Autopilot (BYOK)
   passes a Copilot-tier model and VS Code refuses it as above-tier: stop as blocked
   and say to pin `autopilot` at least as high as the highest-tier model in the
   profile. And surface it earlier — `models apply` (or the `model-profile` doctor
   check) should warn when `autopilot` is a BYOK model while any agent it delegates
   to pins a Copilot model."
3. *Shape — `models apply` writes `handoffs[].model`; the Autopilot reads pins via a
   CLI call or the agent files?* — "**Shape — yes, with the Autopilot consuming pins
   via the CLI.** `models apply` writing `model:` into every `handoffs[]` entry
   (target's resolved pin, first entry when it's a list; `clear` removes;
   active/dirty checks count these lines) is right. For the Autopilot, a read-only
   `agento.mjs models pins` call is the correct source — it has the `execute` tool,
   so its body says "run `models pins`; pass the Builder's pin as the `runSubagent`
   model, the Reviewer's pin likewise, and omit when unpinned." Don't make the
   Autopilot hand-parse the target agent files."
4. *Live check — accept as `(manual)`; which delivery?* — "**Live check — accept as
   `(manual)`, on `api-shared-kernel`.** No scratch delivery needed; it's already
   heading to review. But flag one thing in the plan: with the *current* profile
   (`autopilot` = DeepSeek BYOK), the check is expected to show the tier refusal,
   not Fable 5.1. So the step must first pin `autopilot` to a Copilot model ≥ Fable
   5.1's tier, then `apply mixed`, then run `/agento ap`. The post-ship form (clear →
   `git pull` → `apply mixed`) works."
5. *Docs wording — the user's phrasing or what was observed?* — "**Docs — name what
   was observed, not the harness I guessed.** `model-profiles.md` should say:
   observed on VS Code 1.136, Local harness, with a bring-your-own-key calling model
   — the subagent falls back to the caller's model when the target pin's cost tier
   exceeds the caller's; agent `model:` pins apply on direct selection and to Local
   subagents whose caller isn't a lower-tier BYOK model; Copilot-harness (Agent
   Host) behavior is unverified. CHANGELOG `## Unreleased` entry regardless."

Planner interpretations (flag in review if wrong):

- **Issue filed now.** The issue command requires a GitHub issue number for the
  roadmap header and the PR body's `Fixes #<n>`. So #79 was filed at planning time
  as an unreproduced report. Step 1.5 adds the live-test result to it, which is
  "file the issue from its result" in effect.
- **Live check after ship.** Decision 4's live check is a `(manual, post-ship)` step
  (see Risks). The reproduction (phase 1) runs before ship against current `main`
  code, since it tests the defect, not the fix.
- **Discriminator uses a probe.** Decision 1's discriminator ("the same test with
  `autopilot` pinned to a Copilot model") is run as a built-in-Agent probe whose
  picker model is that Copilot model (Approach, phase 1 Run B). It exercises the
  same `runSubagent` caller-model condition without rewriting the profile, and it
  works after api-shared-kernel is approved. The re-pinned Autopilot run is phase 6.
- **Docs text depends on phase 1.** The doc wording in Decision 5 is the user's
  prediction ("falls back") and is applied as given. Decision 2 instead names a
  refusal. If phase 1 shows a refusal rather than a fallback, step 5.2 states what
  was actually observed.

## Research

Skills consulted: none — no matching domain (the repository has no
`.agents/skills/` directory and AGENTS.md carries no `## Agento` skills table).

Codebase findings (product checkout, `dc88fb1`):

- **Pin writer.** `scripts/model-profiles.mjs`:
  - `resolveTargets` (line 118) maps each agent alias to its value and records
    `byName` (agent `name:` → value), but only uses that for prompts.
  - `readModel`/`setModel` (lines 168, 178) touch only the **top-level** `model:`
    block. `keyBlocks`/`blockEnd` (lines 153–166) treat the indented
    `handoffs:` items as continuation lines of `handoffs:`, so a nested
    `    model:` line is invisible to them today.
  - `detectActive` (line 206) compares `readModel` per file.
  - `differsBeyondModel` (line 217) strips only the top-level line.
- **CLI.** `scripts/agento.mjs`:
  - `case "models"` (line 1670) has verbs `list | show | apply | clear | init`.
    Apply/clear call `setModel(before, value)` per target (line 1732) and set
    skip-worktree on files whose value is non-null (lines 1739–1750).
  - `modelsState` (line 1141) builds `current` from `readModel` and `dirty` from
    `differsBeyondModel`.
  - The usage header is printed by `.slice(1, 24)` (line 43). Its `models` line is
    asserted verbatim by `scripts/agento.test.mjs` line 2582.
  - The `model-profile` doctor check is around line 676. It is not in
    `CAPABILITY_CHECKS`.
- **Handoffs today** (none carries `model:`):
  - `.github/agents/delivery-planner.agent.md`
    → 🔨 Builder (`send: false`).
  - `delivery-builder.agent.md` lines 9–13 → 🔍 Reviewer (`send: true`).
  - `delivery-reviewer.agent.md` → 🤖 Autopilot (`send: true`).
  - Each item is `  - label:` followed by 4-space-indented `agent:`, `prompt:`, and
    `send:` keys.
- **Autopilot.** `.github/agents/delivery-autopilot.agent.md`:
  - It has `tools: [execute, read, agent, search, browser]` and no `edit` tool, so
    it cannot write the roadmap.
  - It invokes the Builder in Loop step 1, on re-invocation in step 2, and in the
    request-changes fix in step 4. It invokes the Reviewer in Preflight step 2
    (when `in-review`) and in Loop step 3.
  - It never passes a model.
- **Tests.**
  - `tests/customizations.test.mjs` line 601 rejects a committed top-level
    `^model:` only. A committed nested handoff `model:` would pass unnoticed.
    `parseFrontmatter` (line 33) parses the `handoffs:` list of maps.
  - The `scripts/agento.test.mjs` `modelsFixture` (line 2485) copies the real
    agents, so it carries the three real handoffs.
- **Bundle.** `extension/scripts/copy-cli.mjs` bundles `agento.mjs` and
  `model-profiles.mjs`, and `extension/cli/` must be refreshed with
  `npm run copy-cli`.
- **Docs.** `docs/model-profiles.md`
  has `## Resolution` (line 53), `## Applying and clearing` (line 72), and
  `## Limits` (line 124, including the `handoffs[].model` limitation at line 128).
  The `models` CLI line appears in `docs/commands.md`
  line 141. CHANGELOG has an open `## Unreleased` section.
- **VS Code docs (fetched 2026-10-02).** Subagent model order, the cost-tier
  refusal, and the BYOK clause are quoted in the evidence file. `handoffs.model`
  takes a single qualified name `Model Name (vendor)`. The `runSubagent` tool
  accepts an optional `model` in the same qualified format.
- **Open delivery branches.** `gh pr list --state open` is `[]` in both `agento`
  and `agento-docs`, so there is no concurrent-delivery overlap.

Lint baseline (policy §5), run 2026-10-02 at `dc88fb1`:

- Tests: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` — exit 0,
  259 tests, 259 pass.
- Shell lint: `shellcheck` is not on PATH. It was run as
  `git ls-files '*.sh' | xargs pnpm dlx shellcheck` over
  `scripts/hooks/delivery-guard.sh`, `scripts/hooks/replay-guard.sh`,
  `scripts/hooks/session-context.sh`, and `scripts/wait-for-checks.sh` — exit 0,
  no findings.
- Extension: `cd extension && npm run typecheck` — exit 0.

Overlap decision: the baseline is green, so the **full gate** applies. The final
full test suite, the full shellcheck run, the extension typecheck, and the extension
unit tests must all be green. No scoped gate is needed. This delivery changes no
shell files.

## Approach

**Phase 1 — Live reproduction against current `main` (manual, before any fix).**
Three Reviewer subagent runs tell the hypotheses apart. The profile stays `mixed`
throughout, and no profile is edited:

- **Run A** is the reported scenario. The in-progress `/agento ap
  api-shared-kernel` run invokes the Reviewer itself once the build reaches
  `in-review`; if that run has already ended, re-run `/agento ap
  api-shared-kernel`. The Reviewer's model shows the reported fallback, a tier
  refusal, or Fable 5.1.
- **Run B** is the discriminator. In a new chat in the same soshiki window, the
  built-in Agent role is set in the picker to a Copilot model that is not Claude
  Fable 5.1 and whose cost tier is at least Fable 5.1's. It is asked to *use the
  🔍 Agento Reviewer subagent with the task: reply with one line naming the model
  you are running on; do not read, run, or change anything*. If the Reviewer shows
  Fable 5.1, the BYOK hypothesis holds: agent pins do apply to Local subagents
  whose caller is not a lower-tier BYOK model.
- **Run C** is the control: the same probe with the picker on DeepSeek V4 Pro. It
  repeats Run A's condition without depending on api-shared-kernel's state.

The probe uses the built-in Agent instead of a re-pinned Autopilot. An Autopilot on
an already-approved delivery invokes no subagent, and the probe exercises the same
`runSubagent` path without rewriting the profile or re-reviewing the delivery.

Each run's Reviewer `modelName` is read machine-checkably from the window's chat
transcript (`chatSessions/*.jsonl`, `toolSpecificData.kind == "subagent"`). The
user also captures each run's subagent pill as a screenshot. Results go into
`## Evidence` and onto #79. Phases 2–4 do not depend on phase 1's outcome, so they
may run before it (manual steps as late as possible). Step 5.2's doc wording does
depend on it.

**Phase 2 — Exposing regression test.** Add a new test to `scripts/agento.test.mjs`:
`issue #79 autopilot-subagent-model-pins: models apply pins handoffs[].model to the
target agent's model; clear removes it`.

- It uses `modelsFixture` with a profile pinning `planner`, `builder`, `reviewer`,
  and `autopilot` to distinct values, with `reviewer` as a list.
- After `models apply`, it asserts the following.
  - The handoff entries in the planner, builder, and reviewer files carry
    `    model: "<target's pin>"`, using the first entry of a list.
  - `models list` reports the profile active.
- It then asserts that `models clear` restores HEAD bytes.

It must fail on current code.

**Phase 3 — CLI fix (`scripts/`).**

- **`model-profiles.mjs`.**
  - New handoff helpers handle the nested `model:` line of each `handoffs:` list
    item, using the item's key indentation. An existing line is replaced in place.
    A missing one is inserted after the item's last key. A null value removes it.
    CRLF and all other bytes are preserved.
  - The per-file state string that `readModel` feeds to
    `detectActive`/`modelsState` becomes the top-level line plus the handoff lines.
    `differsBeyondModel` strips both. As a result, active and dirty detection count
    handoff pins (Decision 3).
  - `resolveTargets` also returns, per agent file, the handoff value for each
    target agent name: the target's resolved value, first entry when it is a list,
    and null when unpinned or unknown.
  - `renderModel`-style JSON quoting is reused.
  - Unit tests are byte-exact in `scripts/model-profiles.test.mjs`.
- **`agento.mjs`.**
  - `apply`/`clear` write both kinds of line. A file counts as pinned for
    skip-worktree when it carries either kind.
  - New read-only verb `models pins` takes no argument and honors `--plugin-root`.
    It emits `{ status, verb, pins: { <alias>: { name, file, model, subagentModel } },
    warnings, ...modelsReport }`. The values are read from the plugin root's
    current files, not the profile: `model` is the parsed pin (a string or a list),
    `subagentModel` is the string or the first entry, and both are `null` when the
    agent is unpinned.
  - Extend the usage header line to
    `models [list | pins | show <name> | apply <name> | clear | init]` and update
    the assertion at line 2582.
- **Tier warning (Decision 2).**
  - A pure helper reads the vendor from a qualified name `<name> (<vendor>)`. It
    warns when `autopilot`'s pin has a vendor other than `copilot` (BYOK) while
    `builder` or `reviewer` pins a `copilot` model. The message names both pins
    and the fix: pin `autopilot` at least as high as the highest-tier model it
    delegates to.
  - `models show <name>`, `apply`, and `pins` report it in `warnings[]`. `apply`
    still succeeds with exit 0.
  - The `model-profile` doctor check returns `warn` with that detail when the
    applied pins trigger it.
  - Unqualified names give no warning, because the vendor is unknown.
- **Bundle.** Run `cd extension && npm run copy-cli`. `tests/extension-bundle.test.mjs`
  stays green.

**Phase 4 — Autopilot and committed-file guard (`.github/`, `tests/`).**

- **Autopilot body**, in `delivery-autopilot.agent.md`:
  - Preflight gains a step: run `node <agento-root>/scripts/agento.mjs models pins`
    and keep `pins.builder.subagentModel` and `pins.reviewer.subagentModel`.
  - Every Builder invocation (Loop 1, 2, and the step 4 fix) and every Reviewer
    invocation (Preflight 2, Loop 3) passes the matching value as the
    `runSubagent` `model`. It is omitted when `null`. If `models pins` fails, the
    Autopilot proceeds unpinned and says so in a progress note.
  - **Refusal stop.** If VS Code refuses the model as above the caller's tier, stop
    the run without retrying unpinned. Relay the refusal and the models it lists,
    and name the fix: pin `autopilot` at least as high as the highest-tier model in
    the profile, then `/agento models apply <name>`. This is a stop that needs the
    user, so `next:` is `/agento ap <slug>`. The Autopilot has no edit tool and
    leaves the roadmap unchanged.
  - A `models pins` `warnings[]` entry is relayed as a progress note before the
    first invocation.
- **`tests/customizations.test.mjs`.**
  - The committed-file test also rejects an indented `model:` inside a committed
    `handoffs:` item.
  - A new assertion checks that the Autopilot body cites `models pins` and passing
    the `runSubagent` model.

**Phase 5 — Docs and changelog.**

- **`docs/model-profiles.md`.**
  - Add a handoff row to the Resolution table.
  - Describe handoff lines in `apply`/`clear` and a `models pins` paragraph.
  - Document the tier warning.
  - Replace the `handoffs[].model` Limits bullet with a "Subagents and handoffs"
    section per Decision 5, adjusted to phase 1's observations. It covers:
    - what was observed (VS Code 1.136, Local harness, BYOK caller, fallback or
      refusal as observed);
    - where pins apply: direct selection, and Local subagents whose caller is not a
      lower-tier BYOK model;
    - that Agento now passes explicit models;
    - that Copilot-harness (Agent Host) behavior is unverified.
- **`docs/commands.md`** line 141: add the
  `pins` verb.
- **CHANGELOG `## Unreleased`:** add a **Fixed.** entry citing #79.
- `/agento models` (the prompt) keeps its verbs. `pins` is a CLI-only verb for the
  Autopilot (Out of scope).

**Phase 6 — Post-ship live check (Decision 4).** The registered clone
`/home/david/DP/agento` takes the merged code (clear → `git pull`). Then:

1. `mixed` is changed so that `autopilot` is a Copilot model with a tier of at least
   Fable 5.1's.
2. `models apply mixed` is run.
3. The user reloads the soshiki window and runs `/agento ap api-shared-kernel`.

The Reviewer subagent must show Claude Fable 5.1. A Builder → *Review this work*
handoff must also switch the picker to the Reviewer's pin.

## Risks

- **The live test cannot run until api-shared-kernel reaches review.** Mitigation:
  phases 2–5 don't depend on it. The Builder runs them first and pauses on 1.1 with
  `(manual)` instructions. Only 5.2's wording waits for the result.
- **The VS Code behavior may differ from the docs, or change between versions.**
  Mitigation: the docs state the exact versions and harness observed. Explicit
  `runSubagent`/`handoffs[].model` values are the documented highest-priority
  source.
- **The tier refusal blocks a run.** Mitigation: this is intended (Decision 2). The
  `models apply`/doctor warning surfaces the problem at apply time. The Autopilot
  stops with the fix named and never silently downgrades.
- **The vendor heuristic is imperfect.** Treating `(copilot)` as Copilot and every
  other vendor as BYOK can misclassify a non-Copilot provider that is not BYOK, or
  miss tier differences between Copilot models. Mitigation: it is a warning only,
  never a refusal. The Autopilot's runtime stop is the real guard.
- **Handoff `model:` lines are local edits.** Mitigation: they live under the same
  skip-worktree and clear → pull → apply discipline. The committed-file test is
  extended to catch an accidentally committed nested `model:`.
- **The live check runs after ship (`(manual, post-ship)`, policy §4).**
  - Justification: in other repositories the agents are loaded from the registered
    plugin clone `/home/david/DP/agento` on `main`. A faithful pre-ship check would
    mean detaching that shared primary checkout onto this branch or re-registering
    `chat.pluginLocations`. Either would change the agents of every concurrent
    session, including the in-progress soshiki api-shared-kernel run. `models apply`
    also refuses linked worktrees by design.
  - A preview does not exist for a VS Code plugin.
  - The user explicitly accepted the post-ship form during clarification
    (Decision 4).
  - Everything else is verified pre-ship: unit and CLI tests, and an end-to-end run
    on a temporary clone (step 5.4).
- **Run A depends on api-shared-kernel reaching review.** Mitigation: the
  in-progress `/agento ap` run invokes the Reviewer on its own, so nothing extra is
  run against that delivery. Runs B and C are read-only probes that work in any
  delivery state. A re-run `/agento ap` is safe (a fresh verdict overwrites
  review.md). The user chose this delivery (Decision 4).
- **Concurrent deliveries.** None are open in either repository. Integrate
  `origin/main` before every push regardless.

## Out of scope

- A `pins` verb in the `/agento models` slash command (it stays CLI-only, for the
  Autopilot).
- Model selection for the built-in `Explore` subagent.
- Copilot-harness (Agent Host) verification.
- Per-project profiles and model tiers for Copilot models (no tier data source).
- Changing which agents declare handoffs.

## Acceptance checklist

- [ ] The exposing regression test `issue #79 autopilot-subagent-model-pins` in
  `scripts/agento.test.mjs` fails on the pre-fix code (recorded in roadmap 2.1) and
  passes after the fix — verify:
  `node --test --test-name-pattern "issue #79" scripts/agento.test.mjs` exit 0.
- [ ] `models apply <name>` writes `model:` into every `handoffs[]` entry with the
  target agent's resolved pin (first entry of a list). `models clear` removes them
  byte-exactly. `active` and `dirty` account for handoff lines — verify: unit tests
  in `scripts/model-profiles.test.mjs` and CLI tests in `scripts/agento.test.mjs`
  pass.
- [ ] `agento.mjs models pins` reports each agent's current `model` and
  `subagentModel` (`null` when unpinned), read from the plugin root's files —
  verify: CLI test on `modelsFixture` before and after apply.
- [ ] `models show`/`apply`/`pins` report a `warnings[]` entry, and the
  `model-profile` doctor check reports `warn`, when `autopilot` pins a non-`copilot`
  vendor while `builder` or `reviewer` pins a `copilot` model — verify: CLI and
  doctor tests.
- [ ] The Autopilot body runs `models pins`, passes the Builder's and Reviewer's
  `subagentModel` as the `runSubagent` model at every invocation (omitting it when
  null), and stops naming the fix on a tier refusal — verify: the new
  `tests/customizations.test.mjs` assertion and review of
  `delivery-autopilot.agent.md`.
- [ ] Committed agents carry no top-level or handoff `model:` line — verify: the
  extended customizations test passes and fails on a probe commit with a nested
  handoff `model:` (recorded in roadmap).
- [ ] `docs/model-profiles.md`
  documents the handoff pins, `models pins`, the tier warning, and the observed
  subagent/handoff behavior per Decision 5 and the phase 1 results. The `handoffs[].model`
  Limits bullet is gone. `docs/commands.md` lists `pins`. CHANGELOG `## Unreleased`
  has the #79 entry — verify: `grep -n "models pins\|handoffs\[\]" docs/model-profiles.md docs/commands.md CHANGELOG.md`.
- [ ] Phase 1's live test is recorded with screenshots and transcript `modelName`
  values for runs A, B, and C, and the result is posted on #79 — verify: roadmap 1.1–1.5
  evidence links and `gh issue view 79 --comments`.
- [ ] Full gate green: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`
  exit 0; `git ls-files '*.sh' | xargs pnpm dlx shellcheck` exit 0 with no
  findings; `cd extension && npm run typecheck && npm run test:unit` exit 0;
  `extension/cli/` byte-equal to `scripts/` (`tests/extension-bundle.test.mjs`).
- [ ] Post-ship (deferred, policy §4): after the clone is updated and `mixed` has a
  Copilot-tier `autopilot`, the `/agento ap api-shared-kernel` Reviewer subagent
  runs on Claude Fable 5.1 and the Builder → Reviewer handoff switches the picker to
  Fable 5.1 — verify: roadmap 6.x screenshots and transcript `modelName`.

## Resolution

_Written by the Builder at completion._
