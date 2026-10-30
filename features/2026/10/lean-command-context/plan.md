# Lean per-command context: declared policy sections, a CLI section printer, and a slim preflight

## Problem

Every `/agento` command loads far more instruction text than it uses before any work
starts:

- It reads all of `.github/instructions/delivery-policy.instructions.md` (30,366
  bytes, 12 sections), because the agents and built-in-agent commands carry the
  `Policy: read <agento-root>/.github/instructions/delivery-policy.instructions.md once`
  line (`tests/customizations.test.mjs` "every agent and built-in-agent command loads
  the policy explicitly"), and the always-on core
  (`.github/instructions/agento-core.instructions.md`) tells the model to read the
  whole file before any `/agento …` command.
- Commands that run as an agent also load the agent file: 8.6–14.2 KB
  (`.github/agents/*.agent.md`).
- The opening `agento.mjs preflight <command>` call prints about 9 KB of JSON. Most of
  it is `session.worktrees[]` (3.2 KB), `doctor` (1.1 KB), and `config` (0.7 KB),
  measured in a plan window with this repository's worktrees.

Measured as policy + agent + command body, the per-command load today is 33–51 KB:
mean 40,224 bytes, max 50,827 (`new-issue`). That is about 12–15k tokens before any
work, and more for Autopilot loops that dispatch Builder and Reviewer subagents
repeatedly. Policy §9 (7.1 KB), §10 (4.4 KB), and §11 (3.2 KB) are about half the
policy, and they mostly describe what `agento.mjs preflight` already computes and
returns as JSON: the receipt and op-id, the doctor checks, and the window verdict.

User-visible effect: commands start faster and cheaper, and leave more of the context
window for the actual delivery work.

## Decisions

Questions were asked with the ask-questions tool. Each listed the recommended option
first. The answers are verbatim, and each note says whether the answer was the
recommended option.

1. **How should commands load only their policy sections?** Answer: `cli`: "Keep one
   policy file; each command declares `Policy: §1, §7, §9`, and the CLI prints only
   those sections (e.g. `agento.mjs policy 1 7 9`, or included in preflight output).
   One source, no file split" (recommended).
2. **Where do the CLI-enforced rules (§9 idempotency table, §10 doctor mechanics, §11
   window procedure) go?** Answer: `docs`: "Shrink each to a short 'trust the CLI
   JSON: print receipt, stop on rejected' clause; move the detailed reference to docs/
   (human-facing, never loaded by commands)" (recommended).
3. **Are the agent files (9–14 KB each) in scope?** Answer: `restated`: "Yes, but only
   to remove rules they restate that the CLI or the policy already owns (e.g. Planner
   step 1 re-describing preflight)" (recommended).
4. **Should the ~9 KB preflight JSON be slimmed too?** Answer: `brief`: "Yes: default
   output carries receipt, preflightLines, window verdict, and the session fields
   commands use; the full record behind a --full flag" (recommended).
5. **How should the saving be measured and kept?** Answer: `test`: "A test computes
   each command's loaded bytes (declared sections + agent + command) and enforces a
   ceiling, plus a before/after table in plan.md" (recommended).

## Research

Skills consulted: agent-customization (installed plugin skill; covers
`.instructions.md`, `.prompt.md`, `.agent.md`, and `SKILL.md` authoring). Its guidance
applied here: `applyTo: "**"` burns context, and description and frontmatter
discipline. The repository's AGENTS.md has no `## Agento` skills table, and there is
no `.agents/skills/`.

**Lint baseline (§5).** Run in the product checkout at `3ec4e5e`:

- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'`:
  exit 0, 827 tests, 827 pass, 0 fail.
- `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt`: exit 0, every
  fixture matched.
- `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`: exit 127, `shellcheck`
  is not installed on this machine. This delivery changes no shell script.
  `scripts/hooks/` and `.github/hooks/` are out of scope, so there is no overlap.
  The Builder runs shellcheck if `command -v shellcheck` finds it, and otherwise
  records it as unavailable.
- **Decision:** the baseline is green and has no overlap, so the full gate applies.
  It is the full suite and the guard smokes (all five AGENTS.md variants), rerun at
  the end and compared against 827/827.

**Concurrent deliveries.** `gh pr list --state open` returned `[]`, so no open PR
overlaps.

**Where things live** (product checkout at `3ec4e5e`):

- CLI dispatch: top-level `switch (command)` at `scripts/agento.mjs:4779`.
  `preflight` is at `:5015`, `doctor` at `:5006`, `paths` at `:4867`.
- `preflightDocument()` is at `scripts/agento.mjs:4595-4624`. It emits `status`,
  `command`, `opId`, `subject`, `receipt`, `preflightLines`, `session`, `window`,
  `doctor`, `resolve`, `config`, `root`, and `configSource`. Argument parsing is in
  `preflightArgs()` at `:4551`.
- Per-command tables: `COMMAND_NEEDS` at `scripts/agento.mjs:1205` (doctor `--for`),
  and `WINDOW_ROLES` at `scripts/session-state.mjs:452-479`, evaluated by
  `windowVerdict()` at `:485`.
- Measured preflight field sizes in this plan window, as JSON characters: `session`
  4,125 (of which `worktrees` 3,228, `allowed` 111, `root` 54, `configSource` 74),
  `doctor` 1,056, `config` 693, `window` 267, `receipt` 60.
- No program consumes `preflight` or `session` JSON. `extension/src` calls only
  `models resolve` (`extension/src/chatModel.ts:186`) through a generic parser
  (`extension/src/cliClient.ts:34`). `canvas/` reads persisted session snapshots
  (`canvas/agento-mission-control/snapshot.mjs:133-180`). The consumers are prompt,
  agent, and command prose, plus `scripts/agento.test.mjs` (66 `preflight`
  references).
- `skills/agento/commands/*.md` are byte copies of `.github/prompts/*.prompt.md`,
  enforced by `tests/customizations.test.mjs:479`. `extension/cli/` is a generated
  copy of `scripts/` (`cd extension && npm run copy-cli`), checked by
  `tests/extension-bundle.test.mjs:48-56`.
- Tests that pin today's policy text (`tests/customizations.test.mjs`):
  - "§N exists" (`:241`).
  - "§9 receipt" (`:253`) and "§11 window check line" (`:261`).
  - `Needs:`/`Fallback:` header regexes and the §10 vocabulary (`:578-598`).
  - `**Recommended choice.**`, `recommended: true`, and `(recommended)` (`:641`).
  - The `WINDOW_ROLES` and `COMMAND_NEEDS` agreement tests (`:786`, `:798`).
  - `**Pause kinds.**` (`:329-333`).
  - The restated-rule canaries (`:830-846`).
  - `receipt` followed by `preflightLines` (`:737`, `:760`).
  - The `Policy: read … once` regex (`:956-966`).
  - The always-on set: core ≤ 40 lines (`:930-941`). The core is at 38 lines today.
- §N citations: all 26 commands and 6 agents cite §9, §10, and §11. Other sections
  are cited unevenly. For example, `ship` cites §9 13 times, and `start-session`
  cites §9 9 times and §10 5 times.
- `docs/architecture.md:55-85` already summarizes receipts, idempotency, capability
  preflight, and the window check. It is where the moved reference detail fits.
- The router skill `skills/agento/SKILL.md` (3,577 bytes) step 5 says "read the
  agent's `.agent.md` … then the command body". It must now also say which `Policy:`
  line to load.

**Baseline per-command load** (bytes: policy 30,366 + agent + command body; the
always-on core and the ai-skills instructions are constant and excluded):

| Command | Command | Agent | Total |
| --- | ---: | ---: | ---: |
| new-issue | 6,311 | 14,150 | 50,827 |
| agento-init | 20,008 | 0 | 50,374 |
| new-feature | 5,228 | 14,150 | 49,744 |
| build-issue | 3,427 | 11,211 | 45,004 |
| build-feature | 3,145 | 11,211 | 44,722 |
| new-initiative | 4,006 | 10,127 | 44,499 |
| extend-copilot | 1,850 | 10,876 | 43,092 |
| fix-copilot | 1,591 | 10,876 | 42,833 |
| ap | 2,543 | 9,495 | 42,404 |
| review-issue | 3,130 | 8,606 | 42,102 |
| ship | 11,422 | 0 | 41,788 |
| review-feature | 2,749 | 8,606 | 41,721 |
| models | 9,958 | 0 | 40,324 |
| continue | 8,004 | 0 | 38,370 |
| start-freehand | 7,694 | 0 | 38,060 |
| close-session | 7,021 | 0 | 37,387 |
| triage-followups | 6,660 | 0 | 37,026 |
| start-session | 6,126 | 0 | 36,492 |
| finish-freehand | 5,939 | 0 | 36,305 |
| commit-current-changes | 5,888 | 0 | 36,254 |
| quick-fix | 5,690 | 0 | 36,056 |
| delivery-status | 4,408 | 0 | 34,774 |
| next-feature | 4,357 | 0 | 34,723 |
| install-skills | 4,123 | 0 | 34,489 |
| mission-control | 3,023 | 0 | 33,389 |
| doctor | 2,696 | 0 | 33,062 |
| **mean / max** | | | **40,224 / 50,827** |

**Build addendum (2026-10-30).** Per-command loaded bytes (declared policy sections + agent file when `agent:` names one of the six agents + command body), before at `3ec4e5e` and after this build:

| Command | Before | After | Delta |
| --- | ---: | ---: | ---: |
| new-issue | 50,827 | 33,291 | -17,536 |
| agento-init | 50,374 | 28,798 | -21,576 |
| new-feature | 49,744 | 32,174 | -17,570 |
| build-issue | 45,004 | 32,210 | -12,794 |
| build-feature | 44,722 | 31,928 | -12,794 |
| new-initiative | 44,499 | 25,494 | -19,005 |
| extend-copilot | 43,092 | 21,313 | -21,779 |
| fix-copilot | 42,833 | 21,054 | -21,779 |
| ap | 42,404 | 26,220 | -16,184 |
| review-issue | 42,102 | 28,951 | -13,151 |
| ship | 41,788 | 22,751 | -19,037 |
| review-feature | 41,721 | 28,570 | -13,151 |
| models | 40,324 | 18,553 | -21,771 |
| continue | 38,370 | 16,433 | -21,937 |
| start-freehand | 38,060 | 16,109 | -21,951 |
| close-session | 37,387 | 15,780 | -21,607 |
| triage-followups | 37,026 | 15,053 | -21,973 |
| start-session | 36,492 | 14,848 | -21,644 |
| finish-freehand | 36,305 | 14,305 | -22,000 |
| commit-current-changes | 36,254 | 14,252 | -22,002 |
| quick-fix | 36,056 | 14,091 | -21,965 |
| delivery-status | 34,774 | 12,836 | -21,938 |
| next-feature | 34,723 | 12,793 | -21,930 |
| install-skills | 34,489 | 12,737 | -21,752 |
| mission-control | 33,389 | 11,391 | -21,998 |
| doctor | 33,062 | 11,114 | -21,948 |
| **mean / max** | **40,224 / 50,827** | **20,502 / 33,291** | |

## Approach

### 1. `agento.mjs policy <N>…`: a section printer (`scripts/agento.mjs`)

- New subcommand `policy <N> [<N>…]`. It prints the named `## N.` sections of
  `<agento-root>/.github/instructions/delivery-policy.instructions.md` as raw
  Markdown in ascending order, deduplicated. The output starts with one header line
  naming the file and the sections, and has no frontmatter and no JSON wrapper.
- An unknown or malformed section is a usage error, exit 1. With no arguments it
  prints usage. The root resolves like every other subcommand, so in a target
  repository the plugin's policy is printed, not a repository copy.
- `--list` prints JSON `{ sections: [{ n, title, bytes }] }`. The context-budget test
  and the docs use it.
- Add a usage line and tests in `scripts/agento.test.mjs`.

### 2. Declared sections replace the read-the-whole-file line

- **New line format** in every agent (`.github/agents/*.agent.md`) and every command
  (all 26 `.github/prompts/*.prompt.md` and their `skills/agento/commands/*.md`
  mirrors). It replaces the `Policy: read … once` line where one exists:

  ```
  Policy: §1, §9, §10, §11, §12 — load once with `node <agento-root>/scripts/agento.mjs policy 1 9 10 11 12` before the first step.
  ```

- **Which sections are declared is mechanical, not judgement.** The set is the
  baseline {1, 9, 10, 11, 12} plus every other §N the file cites. For a command
  dispatched to an agent, it also includes every §N its agent cites. The command line
  is therefore a superset of its agent's line, so one `policy` call per command
  suffices. An agent's own line covers the agent when it is invoked without a command
  (handoffs, direct selection).
- **The core** (`agento-core.instructions.md`) replaces "Read it once before running
  an `/agento …` command" with: load the sections the command's (or, without a
  command, the agent's) `Policy:` line declares, with the command that line names.
  The core stays ≤ 40 lines; edit in place without adding lines.
- **The router skill** (`skills/agento/SKILL.md` step 5) says to run the dispatched
  command's `Policy:` line, not the agent's, when running as an agent or a subagent.
  A subagent receives the command body, so it sees the line.
- **Tests** (`tests/customizations.test.mjs`):
  - Replace the `Policy: read … once` test with:
    - Every agent and command carries exactly one `Policy:` line in the new format.
    - Its `§` list equals the `policy` arguments.
    - The set equals {1, 9, 10, 11, 12} ∪ cited (∪ agent-cited for agent-dispatched
      commands).
    - Every declared §N exists.
  - Keep the byte-identical mirror test.

### 3. Shrink §9, §10, §11 to "trust the CLI JSON" (`delivery-policy.instructions.md`)

Section numbers §1–§12 stay stable, because citations everywhere depend on them.

- **§9 Execution receipts** keeps:
  - Print preflight's `receipt`, then `preflightLines`, verbatim as the first lines.
  - Stop on `status: rejected` and emit its alternatives as §12 blocks.
  - The duplicate form of the receipt, for a resumed duplicate.
  - The model-authored `Result:` line spellings (completed / failed; paused and
    session-break states).
  - That the op-id is derived by the CLI.

  It moves to `docs/architecture.md`:
  - The op-id grammar.
  - The receipt variants the CLI assembles.
  - The **idempotency table**. Each row also moves into its own command file as a
    one-line `Duplicate submission:` sentence where the command does not already
    state it. Commands cite "this command's duplicate-submission line" instead of
    "§9 idempotency row" (59 citations today).
- **§10 Capability preflight** keeps:
  - "preflight already ran the command's doctor checks: `rejected` → print and stop;
    each `Preflight:` line names the fallback to apply."
  - The **standard fallbacks** the model executes (ask-questions, browser, code,
    network, and the hard-need rejections in one line each).
  - The **Recommended choice** paragraph, which tests pin.

  It moves to `docs/architecture.md` as the authoring contract, read by the 🛠️
  Agento Mechanic when it creates or edits a command:
  - The capability vocabulary.
  - The hard/soft classification.
  - The Declaration contract.
  - "When doctor runs".

  The `Needs:`/`Fallback:` test keeps its vocabulary list in the test itself, and the
  `COMMAND_NEEDS` agreement test is unchanged. Command `Fallback:` pointer lines
  become "Standard fallbacks: delivery-policy §10."
- **§11 Window check** keeps:
  - "`window.match: false` → print the preflight `receipt` and its alternatives as
    §12 blocks, write nothing."
  - "On a match, the record's `worktree`, `companion`, `delivery`, and `lifecycle`
    replace fresh git inspection. Only worktree-mutating commands (`start-session`,
    `start-freehand`, `close-session`, `ship` teardown) read
    `git worktree list --porcelain`, and they call `preflight --full` (or
    `agento.mjs session`) for `worktrees[]`."
  - The branch-condition sentence.

  The record field catalogue and the numbered procedure move to
  `docs/architecture.md`. The `WINDOW_ROLES` agreement test is unchanged.
- **Tests that pin moved text are updated, not deleted.** They now assert against
  `docs/architecture.md`: the restated-rule canaries, `**Pause kinds.**` (stays in
  §3), and `**Recommended choice.**` (stays in §10). Every `§N` existence check keeps
  passing because the numbering is unchanged.

### 4. Slim preflight output (`scripts/agento.mjs` `preflightDocument()`)

- **Default (brief) output** carries:
  - `status`, `command`, `opId`, `subject`, `receipt`, and `preflightLines`.
  - `window`: `role`, `required`, `match`, `reason`, `allowed`, `elsewhere`, and, for
    `role: unmanaged`, `primary` = `worktrees[0].path`, so the §11 fix text needs no
    full record.
  - `session`: `role`, `hosted`, `worktree`, `companion`, `workspace`, `delivery`,
    `pr`, `companionPr`, `lifecycle`, and `warnings`.
  - `doctor`: `{ status, for, failing: [non-ok checks] }`.
  - `resolve` only when non-null.

  It drops `session.worktrees`, `session.allowed`, and `session.elsewhere` (they
  duplicate `window`), plus `config`, `root`, and `configSource`.
- **`--full`** returns today's document unchanged, a superset of the brief output.
- Before slimming, the Builder greps every prompt, agent, and command (and
  `scripts/agento.test.mjs`) for each dropped field. Each consumer either moves to
  `--full` or `agento.mjs session`, or the field stays in the brief output. A
  customizations test asserts that every preflight field a prompt names
  (`` `session.X` ``, `` `window.X` ``, `` `doctor.X` ``) exists in the brief
  document produced against a fixture repository, unless that prompt invokes
  `preflight … --full`.

### 5. Trim restated rules from the six agents (`.github/agents/*.agent.md`)

Remove only passages that restate what the CLI JSON or the policy already owns, such
as:

- Planner step 1, which re-describes preflight's record fields and isolation checks.
- Planner step 8, which re-describes `plan-publish`'s commit and PR mechanics.
- Builder and Reviewer passages that restate receipt, window, or doctor behavior.
- Autopilot passages that restate the §8 handoff.

The replacement is "run X, print its `receipt`/`actions[]`, stop on `rejected`/
`failed`", with the authority named. No behavioral rule is deleted: every removed
sentence must be covered by the CLI (named function), a kept policy section, or the
command body. The Builder lists removed passages and their owner in the step commit
messages. No agent file grows, and the total agent bytes go down.

### 6. Context-budget test (`tests/customizations.test.mjs`)

- For each of the 26 commands, compute: bytes of the declared policy sections (from
  `agento.mjs policy --list`), plus the agent file when `agent:` names one of the six
  agents, plus the command body.
- Assert both:
  - Every command is ≤ 40,000 bytes (baseline max 50,827).
  - The mean is ≤ 24,000 bytes (≤ 60% of the 40,224 baseline mean).
- Assert the brief preflight output for a plan-window fixture with ≥ 3 registered
  worktrees is ≤ 2,500 bytes, and that `--full` still carries `session.worktrees`.
- Print the per-command table on failure. Record the before/after table in plan.md
  `## Research` at the end of the build (Builder addendum) and in the PR body.

### 7. Docs, changelog, extension copy

- `docs/architecture.md` gains the moved reference: the idempotency table, receipt
  and op-id grammar, the capability vocabulary and hard/soft split, the Declaration
  contract plus the new `Policy:` line contract, and the window-check procedure and
  record fields. The paragraph at `:55-85` is updated to say the policy is loaded per
  section.
- `docs/commands.md` and `README.md` mention the `policy` subcommand and `preflight
  --full`.
- `CHANGELOG.md` gets an entry under the next version's heading in the repository's
  existing style.
- After the `scripts/` edits: `cd extension && npm run copy-cli`.

## Risks

- **A command needs a rule from a section it did not load.** Mitigations:
  - The declared set is derived mechanically from every §N the file (and its agent)
    cites, and a test enforces it.
  - The baseline {1, 9, 10, 11, 12} always loads.
  - The core states that an uncited section can be loaded on demand with
    `agento.mjs policy N`.
- **Shrinking §9–§11 drops a behavior the model, not the CLI, performs.** Examples
  are the duplicate-receipt form, result-line spellings, alternatives as blocks, and
  the soft fallbacks. Mitigation: §9–§11 keep exactly the model-performed parts
  listed in Approach 3. Pinned-text tests move with the text, and the reviewer
  compares each removed sentence against a kept clause or a CLI function.
- **Moving the idempotency table loses per-command duplicate rules.** Mitigation:
  each row moves verbatim into its command body as a `Duplicate submission:` line,
  checked by a test (one per command, matching the docs table row).
- **A prompt still reads a field the brief preflight dropped.** Mitigations: the
  field-reference test (Approach 4); `--full` keeps today's document unchanged; no
  program consumes preflight JSON (research).
- **Agent trimming removes a rule.** Mitigations: only restatements are removed; each
  removal names its owner in the commit message; the full suite and the
  restated-rule canaries stay green.
- **The core exceeds 40 lines.** Mitigation: replace the existing policy sentence in
  place. It is at 38 lines today, and a test enforces the cap.
- **Concurrent deliveries.** No open PRs today. The Builder integrates `origin/main`
  by merge before every push (§7). The policy, the prompts, and `scripts/agento.mjs`
  are high-traffic files, so expect merge conflicts if another delivery lands first.

## Out of scope

- Splitting the policy into per-section files. The user chose a single file plus a
  CLI printer.
- Embedding policy text in the preflight JSON.
- Rewording §1–§8 or §12 beyond what the declared-section line needs.
- Trimming `delivery-artifacts.instructions.md`, `concurrent-delivery.instructions.md`,
  or command bodies beyond the `Policy:`/`Duplicate submission:`/`Fallback:` lines.
- Changes to hooks (`scripts/hooks/`, `.github/hooks/`), the extension UI, or the
  canvas.
- Model-profile or pin changes.

## Acceptance checklist

- [ ] `node scripts/agento.mjs policy 1 9` prints exactly the `## 1.` and `## 9.`
      sections of the policy file (plus one header line). `policy 13` and `policy x`
      exit 1, and `policy --list` returns all 12 sections with byte sizes. Verify with
      tests in `scripts/agento.test.mjs` and a manual run.
- [ ] Every agent and all 26 commands (prompts and byte-identical mirrors) carry
      exactly one `Policy: §… — load once with node <agento-root>/scripts/agento.mjs
      policy …` line. Its set equals {1, 9, 10, 11, 12} ∪ cited sections (∪ the
      agent's cited sections for agent-dispatched commands). No `Policy: read … once`
      line remains. Verify with a `tests/customizations.test.mjs` test.
- [ ] `agento-core.instructions.md` (≤ 40 lines) and `skills/agento/SKILL.md` direct
      the model to load the declared sections via the `Policy:` line, not the whole
      file. Verify with the core line-count test and a `grep` showing no "read it once
      before" text.
- [ ] Policy §9, §10, and §11 keep only the model-performed rules listed in plan
      Approach 3. The idempotency table, op-id grammar, capability vocabulary,
      hard/soft split, Declaration contract, and window procedure live in
      `docs/architecture.md`. Every command body carries its `Duplicate submission:`
      line. Verify with the updated customizations tests and a reviewer comparison of
      removed sentences.
- [ ] `preflight <command>` defaults to the brief document defined in Approach 4, and
      `--full` returns the previous document. Every preflight field a prompt, agent,
      or command references is present in the brief output, unless that file invokes
      `--full`. Verify with tests in `scripts/agento.test.mjs` and
      `tests/customizations.test.mjs`.
- [ ] Brief preflight output for a plan-window fixture with ≥ 3 worktrees is ≤ 2,500
      bytes. Verify with a test, and with a manual run in a plan window recorded in
      the PR.
- [ ] No agent file grows, and total agent bytes go down. Every removed agent passage
      restated a CLI behavior or policy rule, named in its commit message. Verify with
      `wc -c` before/after in the PR body and the reviewer's audit of the diff.
- [ ] Context-budget test: every command's (declared sections + agent + body) is ≤
      40,000 bytes, and the mean is ≤ 24,000 bytes. The before/after table is in
      plan.md and the PR body. Verify with `tests/customizations.test.mjs`.
- [ ] `extension/cli/` matches `scripts/`. Verify with `tests/extension-bundle.test.mjs`
      after `npm run copy-cli`.
- [ ] Full gate:
      `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'`
      exits 0 with no failures, compared against the 827/827 baseline. All five guard
      smokes in AGENTS.md exit 0. `cd extension && npm run test:unit` passes.
      shellcheck runs if installed; otherwise it is recorded as unavailable (no shell
      file changed).
- [ ] `docs/architecture.md`, `docs/commands.md`, `README.md`, and `CHANGELOG.md`
      describe the per-section policy load, `agento.mjs policy`, and
      `preflight --full`. Verify by reviewer reading.
