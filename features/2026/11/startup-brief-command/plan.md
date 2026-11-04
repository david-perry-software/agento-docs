# One-call startup brief: `agento.mjs brief`, router rewiring, and the policy split

## Problem

Every Agento command start runs a ~25-call ritual before any product work: the router
`view`s the command file and the agent file under `<agento-root>`, the agent runs
`policy …`, then `preflight …`, then reads plan.md and roadmap.md in several chunks
(measured in the [agento-speed brief](../../../../initiatives/2026/11/agento-speed/brief.md):
agent file 3×, policy 5×, plan 5×, roadmap 5×, ≈ 25 tool calls / 10 turns). Two parts of
that ritual are worse than slow:

- A `view` of a file under `<agento-root>` is an out-of-workspace read in a managed
  worktree window, so it raises a permission prompt. An unattended Builder or
  Autopilot run then blocks until the user comes back (20 min in session `10097e97`).
- Large output costs extra reads. `delivery-policy.instructions.md` (20,109 B) and
  `agento-init.prompt.md` (20,296 B) sit just over the 20 KB `view` truncation. Tool
  output over ≈ 8 KB is saved to a file instead of shown inline (measured during this
  plan: 7.5 KB inline, 8.3 KB and up offloaded). The Builder's `policy` load alone is
  ≈ 18 KB, so every start pays an extra read.

This feature implements the `### startup-brief-command` member block of the
initiative [agento-speed breakdown](../../../../initiatives/2026/11/agento-speed/breakdown.md):
a new `agento.mjs brief <command> [<argument>]` subcommand. It prints everything a
command needs to start in one host-approved bash call, within a 7 KB budget. The router,
every command, and every agent are rewired to call it instead of reading files. The
delivery policy is split into per-section files under 20 KB, `agento-init.prompt.md`
drops under 20 KB, and the Builder and Reviewer get `initial_wait ≥ 120` guidance for
long commands.

## Decisions

Clarifying questions (asked 2026-11-04 as a numbered list — the ask-questions tool was
not available in this session — each with a recommended option). The user's answer,
verbatim: **"all recommended"**. The selected options:

1. *How `brief` relates to `preflight`* → **a (recommended)**: "`brief` runs `preflight`
   internally and replaces it as every command's single opening call. It prints the
   receipt and preflight lines first and stops on `rejected`. `preflight` stays for the
   extension, canvas and tests."
2. *Output format* → **a (recommended)**: "Markdown by default (receipt, then labelled
   sections: command body, agent body, policy sections, roadmap header and current step,
   paths), with a `--json` flag for the extension and tests."
3. *Output size budget* (revised after the explore report showed the ≈ 8 KB offload
   threshold) → **a (recommended)**: "Hard budget of about 7 KB, enforced by a test.
   Policy sections that don't fit are listed as on-demand `policy N` pointers, in a
   fixed priority order per role."
4. *Splitting the policy file* → **a (recommended)**: "Split
   `delivery-policy.instructions.md` into one file per section (e.g.
   `.github/instructions/policy/NN-<title>.md`, each under 20 KB). The main file becomes
   a short index that keeps its `applyTo` and `§N` anchors. `policy N` and `brief` read
   the section files."
5. *How much of the routing to rewire in this delivery* → **a (recommended)**:
   "Everything: the router `SKILL.md`, all command files (prompts and their
   `skills/agento/commands/` mirrors), and all six agents. Add the 'never `view` under
   `<agento-root>`' rule, add the `initial_wait ≥ 120` Builder guidance, shrink
   `agento-init.prompt.md` under 20 KB, and regenerate `extension/cli/`."

Initiative intake: `initiative:agento-speed/startup-brief-command` (state `unplanned`,
`ready: true`, recommended after `session-stall-diagnostics`, which is `complete`).

## Research

Skills consulted: none — no matching domain (this repository's AGENTS.md has no
`## Agento` skills table; the work is Node CLI, Markdown customization files, and
node:test suites).

### Codebase (Explore subagent and direct reads at `3f14f7f`)

- **CLI dispatch.** `scripts/agento.mjs:75-91` `COMMAND_MODULES` maps each subcommand to
  `scripts/commands/<module>.mjs`; `policy` and `preflight` both map to `doctor`
  (`scripts/agento.mjs:63`). The usage header (`scripts/agento.mjs:1-47`, `policy` at
  `:32`) doubles as `usage()` text (`scripts/lib/context.mjs:19-21`).
- **Policy reader.** `policySections(root)` (`scripts/commands/doctor.mjs:17-31`) builds
  `path.join(root, ".github", "instructions", "delivery-policy.instructions.md")` and
  slices it on `^## (\d+)\. (.+)$`, returning `{ n, title, bytes, raw }`.
  `commands.policy()` (`:119-136`) prints the header
  `# delivery-policy.instructions.md — sections …` and then the raw sections. It reads
  from `PLUGIN_ROOT` (`scripts/lib/context.mjs:17`, the parent of the CLI dir). Other
  readers of the file: `scripts/lib/doctor.mjs:342` (§10 vocabulary),
  `scripts/commands/doctor.test.mjs:648,673`,
  `tests/customizations.test.mjs:242-259` (≥ 12 `## N. ` sections; every `§N` cites a
  real section). `policy --list` today: §1 1,280 · §2 1,269 · §3 2,339 · §4 876 ·
  §5 1,496 · §6 1,101 · §7 2,086 · §8 1,168 · §9 1,174 · §10 2,002 · §11 1,235 ·
  §12 2,811 bytes.
- **Preflight.** `preflightDocument({ command, type, slug, full })`
  (`scripts/commands/doctor.mjs:71-116`) returns `status, command, opId, subject,
  receipt, preflightLines, window, session, doctor, resolve?`. `receiptLines`
  (`:53-63`) spells the §9 receipt. `preflightArgs` (`:42-51`) accepts
  `<command> [<type> <slug> | <type>/<slug> | <slug>]`. The extension and canvas do not
  call `policy` or `preflight` (no hits in `extension/src/*.ts`).
- **Roadmap steps.** `scripts/delivery-roadmap-resolver.mjs:60-89` parses
  `- [ |x] N.M …` lines with their `verify:` text but exports no "current step" helper;
  `describeContent()` / `header()` in `scripts/lib/records.mjs:39-58` give the header
  fields and tick counts.
- **Router.** `skills/agento/SKILL.md` (3,874 B): step 4 `Read`s
  `<agento-root>/skills/agento/commands/<name>.md`; step 5 dispatches on `agent:` with a
  three-row table (inline / inline-as-agent / subagent). Inline-as-agent `read`s the
  agent file; subagent runs `agento.mjs models pins` and passes the command body.
  Router metadata and table contents are tested at `tests/customizations.test.mjs:167-225`.
- **Agent startup.** For example `.github/agents/delivery-builder.agent.md:21-31`:
  `Policy: §1, §2, §3, §4, §5, §7, §8, §9, §10, §11, §12 — load once with … policy 1 2 3 4
  5 7 8 9 10 11 12`, then `preflight build-<type> <type> <slug>`, then the roadmap and
  plan reads. The Planner, Reviewer, Autopilot, Architect, and Mechanic follow the same
  pattern.
- **`Policy:` line contract.** `tests/customizations.test.mjs:1002-1055` requires
  exactly one line matching
  `` Policy: §… — load once with `node <agento-root>/scripts/agento.mjs policy …` before the first step. ``
  It also requires the declared set to equal {1, 9, 10, 11, 12} ∪ cited §N
  (∪ agent-cited for agent-dispatched commands). `:1081-1101` caps declared policy bytes
  + agent + body at ≤ 40,000 per command, with a mean ≤ 24,000, parsing the `policy N`
  arguments out of the line. The contract is documented at `docs/architecture.md:266-270`
  and in `.github/agents/copilot-mechanic.agent.md:76`.
- **Mirrors.** `skills/agento/commands/<name>.md` mirror `.github/prompts/<name>.prompt.md`
  (26 commands; transform checked at `tests/customizations.test.mjs:1111-1229`).
  `extension/cli/` is a byte copy made by `cd extension && npm run copy-cli`, checked by
  `tests/extension-bundle.test.mjs:65-79`.
- **Sizes over the 20 KB `view` limit:** `delivery-policy.instructions.md` 20,109 B and
  `agento-init.prompt.md` 20,296 B. All other agents, prompts, and instructions are under
  12.6 KB (largest: `delivery-planner.agent.md` 12,597 B; `delivery-builder.agent.md`
  10,852 B).
- **Instruction loading.** `tests/customizations.test.mjs:101` reads `.github/instructions`
  non-recursively, and `:231-239` require `description` + `applyTo` on each
  `*.instructions.md`. Section files named `NN-<title>.md` (without the
  `.instructions.md` suffix) are not instruction files, so VS Code does not auto-attach
  them.
- **Fixtures.** `scripts/test-helpers/agento-fixtures.mjs` exports `makeRepo`,
  `makeWorktreeRepo`, `makePairRepo`, `inRepoDelivery`, `harnessFixture`, and
  `modelsFixture` (`:634-641`), enough to drive `brief` in primary, plan, and build
  windows, in-repo and companion layouts.
- **Docs to update:** `docs/architecture.md:61-80` (policy loading, receipts,
  preflight) and `:266-270` (`Policy:` contract); `docs/commands.md:650-680` (CLI
  reference); `docs/copilot-harness.md` (router flow); `README.md` (mentions
  `agento.mjs policy`).
- **Harness output threshold** (measured in this session): 7,500 B of bash output stays
  inline; 8.3 KB, 9.3 KB, and 12.2 KB results are saved to a file. The 7,000 B budget
  leaves headroom under that undocumented limit.

### Lint and test baseline (2026-11-04, `3f14f7f`)

- Full-repository lint (AGENTS.md "Shell lint"): `shellcheck scripts/hooks/*.sh
  scripts/wait-for-checks.sh` → **exit 0, no findings**. shellcheck is not installed on
  this machine; the run used the official static v0.10.0 release binary unpacked to
  `/tmp/shellcheck-v0.10.0/`. Builders do the same when `command -v shellcheck` fails,
  and record it.
- There is no JS/TS linter. The extension type gate is `tsc` via `cd extension && npm
  run build` (`npm ci` first).
- Tests: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'
  'canvas/**/*.test.mjs'` → **862 tests, 862 pass, 0 fail** (163 s; run with
  `initial_wait ≥ 300`). Guard smoke `./scripts/hooks/replay-guard.sh <
  tests/guard-fixtures.txt` → exit 0.
- Decision: the baseline is green with no overlap to clean up, so the **full gate
  applies**. The final step reruns shellcheck, the full node suite, all five guard
  smokes, and the extension build and unit tests, and compares them to this baseline.

### Concurrent deliveries

`gh pr list --state open` is empty in both `david-perry-software/agento` and
`david-perry-software/agento-docs`, so there is no file overlap. Within the initiative,
`context-trim` (unplanned) will edit the same `Policy:` lines and agent frontmatter; the
breakdown already orders it after this feature (see Risks).

## Approach

### 1. Policy split (per-section files, unchanged `policy N` output)

- Move `policySections(root)` from `scripts/commands/doctor.mjs` to a new
  `scripts/lib/policy.mjs` (exported; also `policyIndex(root)` returning `{ n, title,
  bytes, file }`). Every reader (`commands.policy`, `scripts/lib/doctor.mjs` §10
  vocabulary, `brief`, tests) goes through it.
- Before the split, pin the current output: a test records the sha256 of each section's
  `raw` and of the full `policy 1 2 … 12` output, so the split cannot change one byte of
  what agents receive (only the source location changes).
- Split `.github/instructions/delivery-policy.instructions.md` into
  `.github/instructions/policy/NN-<kebab-title>.md` (`01-who-does-the-work.md` …
  `12-command-presentation.md`). Each file starts with its `## N. Title` heading and
  holds the section text moved byte for byte.
  `delivery-policy.instructions.md` keeps its frontmatter (`description`, `applyTo`) and
  its intro paragraph, and becomes an index: one line per section
  (`- §N [Title](policy/NN-….md) — <one-line scope>`), plus "read sections with
  `agento.mjs policy N`; never `view` them". `§N` citations stay valid: the index and
  `policy --list` resolve them.
- `policySections` reads the `policy/` directory in numeric order.
  `tests/customizations.test.mjs` (section count, §N resolution, the 40,000 / 24,000
  budget) reads sections via `policy --list`. The non-recursive instructions scan at
  `:101` skips the `policy/` directory.

### 2. `agento.mjs brief <command> [<argument>…] [--as-subagent] [--page N] [--json]`

New `scripts/lib/brief.mjs` (pure: block model, priority, pagination, rendering) and
`scripts/commands/brief.mjs` (I/O: files, preflight, pins), registered in
`COMMAND_MODULES` and in the `scripts/agento.mjs` usage header.

1. **Resolve the command.** `<command>` must be a basename of
   `<PLUGIN_ROOT>/skills/agento/commands/*.md`. An unknown name exits 1 and lists every
   valid name as `/agento <name>`; this replaces the router's step-4 file listing. The
   command file's `agent:` gives the dispatch mode through a `DISPATCH_MODES` table
   (missing/`agent` → inline; Planner, Architect, Mechanic, Autopilot → inline-as-agent;
   Builder, Reviewer → subagent). A test asserts the table equals the router SKILL.md
   table.
2. **Subagent commands from the router** (no `--as-subagent`): print only a
   `Dispatch:` block — agent name, the `models pins` pin (`copilotModel`,
   `subagentModel`, each possibly `null`), and the exact one-paragraph prompt to pass:
   "Run `/agento <command> <argument>`: open with `node <root>/scripts/agento.mjs brief
   <command> <argument> --as-subagent`…". No preflight runs and no receipt prints,
   because the subagent owns §9. Exit 0.
3. **Everything else** (inline, inline-as-agent, or `--as-subagent`): derive preflight
   arguments from the command's argument with a per-command `briefArgs(command,
   argument)` mapping. Build/review/ap/ship/close-session-style commands take
   `<slug>`, `<type> <slug>`, or `<type>/<slug>`, and the type is implied for
   `build-feature` and the like. Free-text and `initiative:<i>/<f>` arguments run
   preflight without a slug. Then run `preflightDocument`. On `status: rejected`, print
   the receipt and the alternatives (`allowed`, `elsewhere`) and exit 3.
4. **Accepted: render blocks in priority order** within `BRIEF_BUDGET = 7000` bytes per
   page (UTF-8, measured on the rendered output):
   1. the receipt line and `Preflight:` lines, verbatim (always first, page 1 only);
   2. **Session**: role, worktree path and branch, companion path and branch (companion
      mode), the slug's artifact dir from `resolve`, lifecycle, CLI path;
   3. **Delivery** (when a slug resolves): the roadmap yaml header, ticked/total, and the
      **current step** — the first unticked step line including its `verify:` — from a
      new exported `currentStep(content)` in `scripts/delivery-roadmap-resolver.mjs`
      (`{ id, line, verify, manual, postShip }` or `null`). Not plan.md.
   4. **Command body** (frontmatter stripped) — mandatory;
   5. **Agent body** — inline-as-agent only (a subagent or custom agent already holds
      its own) — mandatory;
   6. **Policy sections** declared on the command's `Policy:` line (the command line is
      already the superset of the agent's), included in the role's fixed priority order
      (`BRIEF_POLICY_PRIORITY` per agent, e.g. Builder §9 §7 §1 §2 §3 §5 §11 §10 §12 §8
      §4) as long as they fit;
   7. **Footer**: `More:` lists `agento.mjs brief … --page N` for each continuation page
      holding mandatory content (command or agent body) that did not fit. `On demand:`
      lists each declared policy section that was not included, as `policy N — <title>
      (<bytes> B)`.

   Mandatory blocks that overflow continue on page 2, 3, … and split at `##`/paragraph
   boundaries, so no page exceeds the budget. A single paragraph larger than the budget
   is split at line boundaries. `--page N` recomputes the same blocks (read-only and
   deterministic for an unchanged HEAD and session) and prints page N under a one-line
   `Brief page N/M for <opId>` header, without repeating the receipt.
5. `--json` emits `{ status, command, dispatch, opId, receipt, preflightLines, session,
   delivery: { header, ticked, total, currentStep }, blocks: [{ kind, id, bytes, page }],
   pages, onDemand: [{ n, title, bytes }] }`. Exit codes match preflight: 0 ok, 3
   rejected, 1 usage.

### 3. Rewiring the text (router, 26 commands × 2 mirrors, 6 agents, core)

- **New `Policy:` line form** (one per file, same declared set as today):
  `` Policy: §1, §9, §10, §11, §12 — loaded by the opening `agento.mjs brief` call; any other §N on demand with `agento.mjs policy N`. ``
  `tests/customizations.test.mjs` parses the new form, keeps the declared-set rule, and
  computes the 40,000 / 24,000 budget from the § list. A new test asserts that the set
  `brief --json` reports (included ∪ onDemand) equals the line.
- **Opening sentence** of every command file and agent: replace "Open with one
  `node <agento-root>/scripts/agento.mjs preflight <command> …` call … print its
  `receipt` and then its `preflightLines` verbatim, and stop on `status: rejected`" with
  "Open with one `node <agento-root>/scripts/agento.mjs brief <command> <argument>`
  call (§9–§11): print its receipt and `Preflight:` lines verbatim, stop on
  `status: rejected` (exit 3), and read every `More:` page before the first step".
  Builder and Reviewer drop their separate roadmap/plan startup reads: the brief's
  current step replaces them, and plan.md sections are read only when the step needs
  them.
- **Router `skills/agento/SKILL.md`**: steps 4–5 become "run `node <agento-root>/
  scripts/agento.mjs brief <name> <argument>`". On exit 1, relay the valid-name list. A
  `Dispatch:` block means: invoke the named agent with the given prompt and pin
  (`task` + `copilotModel` / `runSubagent` + `subagentModel`). Otherwise follow the
  printed command body (and agent body) as this turn's instructions. The router no
  longer reads command or agent files, no longer runs `models pins`, and no longer
  loads policy itself. The dispatch table stays as documentation and is tested against
  `DISPATCH_MODES`.
- **Never `view` under `<agento-root>`**: one bullet in
  `.github/instructions/agento-core.instructions.md` and the router. Command, agent, and
  policy text comes from `brief` and `policy`; files inside the current workspace are
  unaffected.
- **Long commands**: one sentence each in the Builder and Reviewer agent bodies — use
  `initial_wait ≥ 120` (≥ 300 for this repository's full node suite) for builds, test
  suites, installs, and database commands, never the 30 s default.
- **`agento-init.prompt.md` < 20,000 B** (and its mirror): condense without dropping a
  rule, for example by moving long scaffold text into `templates/` where `agento-init`
  already copies from.
- **Size gate test**: every file under `.github/agents/`, `.github/prompts/`,
  `.github/instructions/` (recursive), and `skills/agento/` is ≤ 20,000 B.
- Regenerate `extension/cli/` with `cd extension && npm run copy-cli`.

### 4. Documentation

`docs/architecture.md` (policy loading → brief; `Policy:` contract; per-section policy
files), `docs/commands.md` (the `brief` CLI reference, flags, budget, exit codes),
`docs/copilot-harness.md` (router flow, the 8 KB offload threshold, the never-`view`
rule), `README.md` (where it describes `policy`), and the Mechanic's `Policy:` contract
text (`.github/agents/copilot-mechanic.agent.md:76`).

Affected files: `scripts/agento.mjs`, `scripts/lib/policy.mjs` (new), `scripts/lib/brief.mjs`
(new), `scripts/commands/brief.mjs` (new), `scripts/commands/doctor.mjs`,
`scripts/lib/doctor.mjs`, `scripts/delivery-roadmap-resolver.mjs`, their `*.test.mjs`,
`tests/customizations.test.mjs`, `.github/instructions/delivery-policy.instructions.md` +
`.github/instructions/policy/*.md` (new), `.github/instructions/agento-core.instructions.md`,
`.github/agents/*.agent.md` (6), `.github/prompts/*.prompt.md` (26),
`skills/agento/commands/*.md` (26), `skills/agento/SKILL.md`, `extension/cli/**`
(generated), `docs/*.md`, `README.md`. No change to `scripts/hooks/`, `.github/hooks/`,
the extension's TypeScript, or the canvas.

## Risks

- **`brief` re-creates the context cost it removes.** Mitigation: the 7,000 B per-page
  budget is enforced by a test across every command in fixture windows; plan.md is never
  printed; only the current roadmap step; policy beyond the budget becomes on-demand
  pointers.
- **Inline-as-agent starts still need more than one call.** The Planner body (12.6 KB)
  plus a command body cannot fit in 7 KB, so those starts take 2–3 `brief` pages.
  Mitigation: pages are bash calls (no permission prompt, no offload), down from about
  25 calls. `context-trim` and later trims shrink the bodies, and the budget test reports
  page counts so regressions are visible.
- **The offload threshold is undocumented harness behaviour** (measured ≈ 8 KB) and may
  change. Mitigation: one `BRIEF_BUDGET` constant, the measurement recorded in
  `docs/copilot-harness.md`, and headroom below the measured limit.
- **The policy split silently changes what agents read.** Mitigation: step 1.1 pins
  per-section and full-output sha256 before the split; step 1.2 must keep them.
- **Missing a mandatory continuation page.** Mitigation: the footer names each page as
  an exact command; command and agent text say "read every `More:` page before the
  first step"; a test asserts the footer lists every page.
- **Router and CLI dispatch tables drift.** Mitigation: a test asserts SKILL.md's table
  equals `DISPATCH_MODES`.
- **Mirror drift across 26 commands × 2 copies and `extension/cli/`.** Mitigation:
  existing mirror and byte-copy tests gate every step, and copy-cli reruns in the steps
  that touch `scripts/`.
- **The live router is the primary clone's `main`.** `~/.copilot/skills/agento` links to
  the primary clone, so the rewired router only takes effect after merge. Mitigation:
  verification exercises the branch's CLI directly and through a dispatched subagent
  using the branch's `SKILL.md` text (step 5.2); the end-to-end effect shows after ship.
- **Concurrent delivery: `context-trim`** (same initiative, unplanned) edits the same
  `Policy:` lines and agent files. Mitigation: the breakdown orders it after this
  feature. If it is planned in parallel, both branches integrate `origin/main` by merge
  before every push, and whichever ships second rebuilds its `Policy:` lines on the new
  form.
- **Rejected-receipt semantics.** Mitigation: `brief` reuses `receiptLines` and
  `preflightDocument` unchanged and keeps exit 3; tests cover the window-mismatch and
  hard-capability-fail rejections.

## Out of scope

- Shrinking any role's `Policy:` section list or changing model profiles (`context-trim`).
- Plugin snapshot slimming (`plugin-snapshot-slim`).
- Changing `preflight`'s output shape or its extension and canvas consumers.
- Rewriting agent or command behaviour beyond the startup sequence, the never-`view`
  rule, and the `initial_wait` sentence.
- Hooks (`scripts/hooks/`, `.github/hooks/`) and their guard fixtures.
- Changes to ship, review, or planning flows beyond the startup bundle.

## Acceptance checklist

- [ ] `node scripts/agento.mjs policy 1 2 3 4 5 6 7 8 9 10 11 12` output and every
  `policy --list` byte count are identical to the pre-split values pinned in step 1.1
  (sha256 test passes), and section text now lives in
  `.github/instructions/policy/NN-*.md` — verify: `node --test scripts/lib/policy.test.mjs
  tests/customizations.test.mjs`.
- [ ] Every file under `.github/agents/`, `.github/prompts/`, `.github/instructions/`
  (recursive), and `skills/agento/` is ≤ 20,000 bytes, including `agento-init.prompt.md`
  and its mirror — verify: the size-gate test in `tests/customizations.test.mjs` passes.
- [ ] `agento.mjs brief <command> [<arg>]` exists. For every one of the 26 commands, in a
  fixture window that accepts it, every page is ≤ 7,000 bytes; page 1 starts with the
  verbatim §9 receipt; overflow is listed as `--page N` / `policy N` — verify:
  `node --test scripts/lib/brief.test.mjs scripts/commands/brief.test.mjs`.
- [ ] A rejected window prints the rejected receipt with its alternatives and exits 3;
  an unknown command exits 1 listing `/agento <name>` for every command; a
  subagent-dispatched command without `--as-subagent` prints only the `Dispatch:` block
  (agent, pin, prompt) and runs no preflight — verify: the same test files.
- [ ] With a slug, the brief shows the roadmap header, ticked/total, and the first
  unticked step with its `verify:` text, and never plan.md content — verify:
  `currentStep` unit tests in `scripts/delivery-roadmap-resolver.test.mjs` and a brief
  fixture test.
- [ ] Every agent, prompt, and command mirror carries exactly one `Policy:` line in the
  new `brief` form with the unchanged declared set; `brief --json`'s included ∪
  onDemand sections equal it; the 40,000 / 24,000 budget test still passes — verify:
  `node --test tests/customizations.test.mjs`.
- [ ] No agent, prompt, command mirror, or the router tells the model to read a file
  under `<agento-root>` or to run `preflight`/`policy` as the opening load. The router
  and agento-core state the never-`view` rule; Builder and Reviewer state the
  `initial_wait ≥ 120` rule — verify: a text test in `tests/customizations.test.mjs`
  (no `Read <agento-root>/`, no opening `preflight` sentence, rule sentences present)
  passes.
- [ ] The router SKILL.md dispatch table equals `DISPATCH_MODES` in
  `scripts/lib/brief.mjs` — verify: `node --test tests/customizations.test.mjs`.
- [ ] Live: in this build worktree, `node scripts/agento.mjs brief build-feature
  startup-brief-command --as-subagent` prints an accepted receipt, the current step,
  and ≤ 7,000 bytes, and `brief build-feature startup-brief-command` (router form) prints
  only a `Dispatch:` block — verify: commands run and byte counts recorded in roadmap
  step 5.1 evidence.
- [ ] Live: a Builder subagent dispatched with the `Dispatch:` prompt reaches its first
  step after exactly one `brief` call, with no `view` of a file under the
  `<agento-root>` path — verify: the subagent transcript excerpt recorded in
  `evidence/step-5-2-subagent-start.txt`.
- [ ] Docs (`docs/architecture.md`, `docs/commands.md`, `docs/copilot-harness.md`,
  `README.md`) describe `brief`, the per-section policy files, the new `Policy:` form,
  the budget, and the never-`view` rule — verify: reviewer reads the diffs; the
  customizations tests' canonical-spelling checks pass.
- [ ] Full gate against the recorded baseline (862/862, shellcheck exit 0): the full
  node suite passes with no failures; shellcheck exits 0 with no findings; all five
  guard smokes exit 0; `extension/cli/` is byte-identical to `scripts/`; and `cd
  extension && npm ci && npm run build && npm run test:unit` pass — verify: commands
  and outputs recorded in roadmap step 5.3.
