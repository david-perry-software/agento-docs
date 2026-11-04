```yaml
status: in-progress
branch: feature/startup-brief-command
last-updated: 2026-11-04
next-step: "3.3 Rewire the 6 agents' opening brief sentence and the Builder/Reviewer initial_wait guidance"
initiative: "agento-speed"
artifact-pr: "#75"
```

## Phase 1: Policy split

- [x] 1.1 Move `policySections(root)` from `scripts/commands/doctor.mjs` to a new
  `scripts/lib/policy.mjs` (plus `policyIndex(root)` → `{ n, title, bytes, file }`),
  route `commands.policy` and the §10-vocabulary reader in `scripts/lib/doctor.mjs`
  through it. Add `scripts/lib/policy.test.mjs` pinning the sha256 of each section's
  `raw` and of the full `policy 1 2 3 4 5 6 7 8 9 10 11 12` output at `3f14f7f`, and run
  `cd extension && npm run copy-cli` — verify: `node --test scripts/lib/policy.test.mjs
  scripts/commands/doctor.test.mjs tests/customizations.test.mjs
  tests/extension-bundle.test.mjs` passes

- [x] 1.2 Split `.github/instructions/delivery-policy.instructions.md` into
  `.github/instructions/policy/NN-<kebab-title>.md` (12 files, each starting with its
  `## N. Title` heading, text moved byte for byte). Turn the original into the index of
  plan.md Approach §1 (frontmatter and intro kept, one line per section, "read with
  `agento.mjs policy N`; never `view`"). Make `policySections` read the directory, make
  the non-recursive instructions scan in `tests/customizations.test.mjs` skip `policy/`,
  and update the other readers (`scripts/commands/doctor.test.mjs:648,673`). Run copy-cli
  — verify: the 1.1 hashes are unchanged; `node --test scripts/lib/policy.test.mjs
  scripts/commands/doctor.test.mjs tests/customizations.test.mjs
  tests/extension-bundle.test.mjs` passes; `wc -c .github/instructions/*.md
  .github/instructions/policy/*.md` shows every file ≤ 20,000 B

## Phase 2: The brief subcommand

- [x] 2.1 Export `currentStep(content)` from `scripts/delivery-roadmap-resolver.mjs`
  (first unticked `N.M` step → `{ id, line, verify, manual, postShip }`, `null` when all
  ticked; obsolete `~…~` steps count as ticked), with unit tests covering planned,
  mid-way, all-ticked, `(manual)`, `(manual, post-ship)`, `(added …)`, and multi-line
  steps — verify: `node --test scripts/delivery-roadmap-resolver.test.mjs` passes

- [x] 2.2 Create pure `scripts/lib/brief.mjs`: `BRIEF_BUDGET = 7000`, `DISPATCH_MODES`,
  `BRIEF_POLICY_PRIORITY` per agent, the block model of plan.md Approach §2.4,
  pagination (mandatory blocks paged at `##`/paragraph/line boundaries; policy blocks
  that do not fit go to `onDemand`), `More:` / `On demand:` footer, Markdown and JSON
  renderers. Add `scripts/lib/brief.test.mjs`: every page ≤ budget (including a
  12.6 KB agent body and an oversized single paragraph), receipt first on page 1 only,
  the footer lists every continuation page, deterministic pages, priority order
  honoured — verify: `node --test scripts/lib/brief.test.mjs` passes

- [x] 2.3 Create `scripts/commands/brief.mjs` and register `brief` in
  `COMMAND_MODULES` and the `scripts/agento.mjs` usage header: command lookup under
  `<PLUGIN_ROOT>/skills/agento/commands/` (unknown → exit 1 with every `/agento <name>`),
  dispatch mode from `agent:`, the subagent `Dispatch:` block (pin from the `models pins`
  logic, exact `--as-subagent` prompt, no preflight), `briefArgs(command, argument)`,
  `preflightDocument` reuse (rejected → receipt + alternatives, exit 3), Session and
  Delivery blocks (`resolve` + `currentStep`), `--page N`, `--json`. Add
  `scripts/commands/brief.test.mjs` over the fixtures (`makeRepo`, `makeWorktreeRepo`,
  `makePairRepo`, `inRepoDelivery`, `modelsFixture`). It covers every mode, a window
  mismatch, a hard-capability fail, an unknown name, the companion layout, and a loop
  over all 26 commands asserting every page ≤ 7,000 B in a window that accepts each.
  Run copy-cli — verify: `node --test scripts/commands/brief.test.mjs
  scripts/lib/brief.test.mjs tests/extension-bundle.test.mjs` passes and `node
  scripts/agento.mjs brief new-feature | wc -c` in this worktree is ≤ 7000

## Phase 3: Rewire router, agents, and commands

- [x] 3.1 Change the `Policy:` line contract to the new form of plan.md Approach §3 in
  `tests/customizations.test.mjs`: parse the § list from the new sentence, keep the
  declared-set rule, compute the 40,000 / 24,000 budget from the § list, add the
  `brief --json` (included ∪ onDemand) equality test, add the router-table ↔
  `DISPATCH_MODES` test, and rewrite all 6 agents' and 26 × 2 commands' `Policy:` lines
  to the new form (declared sets unchanged) — verify: `node --test
  tests/customizations.test.mjs` passes and `grep -rn "load once with"
  .github/agents .github/prompts skills/agento` prints nothing

- [x] 3.2 Rewrite `skills/agento/SKILL.md` steps 4–5 around one `brief` call per plan.md
  Approach §3 (exit 1 → relay names; `Dispatch:` → invoke the agent with the given
  prompt and pin; otherwise follow the printed bodies and every `More:` page; the
  never-`view`-under-`<agento-root>` rule; no `models pins`, no file reads, no policy
  load), keeping the dispatch table — verify: `node --test tests/customizations.test.mjs`
  passes and `grep -n "Read \`<agento-root>\|models pins\|commands/<name>.md\`"
  skills/agento/SKILL.md` finds no instruction to read files or run pins

- [ ] 3.3 Rewire the 6 agents in `.github/agents/`: opening `brief` sentence replaces
  the `preflight` sentence; the Builder and Reviewer drop their startup roadmap/plan
  reads in favour of the brief's Delivery block (plan.md sections read only when a step
  needs them); the Builder and Reviewer gain the `initial_wait ≥ 120` (≥ 300 for this
  repository's full suite) sentence; the Mechanic's `Policy:` contract text (`:76`)
  describes the new form — verify: `node --test tests/customizations.test.mjs` passes

- [ ] 3.4 Rewire all 26 `.github/prompts/*.prompt.md` and their
  `skills/agento/commands/*.md` mirrors: the opening `brief <name> <argument>` sentence
  replaces the `preflight` sentence (argument forms per `briefArgs`). Add the text test
  that no agent, prompt, mirror, or the router contains an opening `preflight` sentence
  or an instruction to read a file under `<agento-root>` — verify: `node --test
  tests/customizations.test.mjs` passes

- [ ] 3.5 Add the never-`view` bullet to `.github/instructions/agento-core.instructions.md`;
  bring `.github/prompts/agento-init.prompt.md` and its mirror under 20,000 B without
  dropping a rule; add the size-gate test (every file under `.github/agents/`,
  `.github/prompts/`, `.github/instructions/` recursive, and `skills/agento/` ≤ 20,000 B)
  — verify: `node --test tests/customizations.test.mjs` passes and `wc -c
  .github/prompts/agento-init.prompt.md skills/agento/commands/agento-init.md` shows
  both < 20,000

## Phase 4: Documentation

- [ ] 4.1 Document `brief` and the policy split: `docs/commands.md` (CLI reference:
  arguments, `--as-subagent`, `--page`, `--json`, budget, exit codes),
  `docs/architecture.md:61-80` and `:266-270` (startup via `brief`, per-section policy
  files, new `Policy:` form), `docs/copilot-harness.md` (router flow, the measured ≈ 8 KB
  offload threshold, the never-`view` rule), `README.md` where it describes `policy` —
  verify: `node --test tests/customizations.test.mjs` passes (canonical spellings) and
  `grep -rn "load once with" docs README.md` prints nothing

## Phase 5: Verification

- [ ] 5.1 Live CLI in this build worktree: run `node scripts/agento.mjs brief
  build-feature startup-brief-command --as-subagent`, `… brief build-feature
  startup-brief-command` (router form), `… brief review-feature startup-brief-command
  --as-subagent`, `… brief ap startup-brief-command`, and `… brief delivery-status`,
  recording each byte count (`| wc -c`), page count, and first line into
  `evidence/step-5-1-live-brief.txt` — verify: every page ≤ 7,000 B; the build-window
  briefs open with `Receipt: accepted`; the router form prints only a `Dispatch:` block;
  the build brief's current step equals roadmap step 5.1

- [ ] 5.2 Live subagent start: dispatch a Builder subagent (`task`, agent `🔨 Agento
  Builder`) with the exact prompt from the router-form `Dispatch:` block, told to stop
  after printing its receipt and current step, and save the transcript of its tool calls
  to `evidence/step-5-2-subagent-start.txt` — verify: the transcript shows exactly one
  `agento.mjs brief … --as-subagent` call before the receipt and no `view` of any file
  under the `<agento-root>` named by the session context's `Agento CLI:` line

- [ ] 5.3 Full gate against the plan.md baseline: integrate `origin/main` by merge (both
  halves); run `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'
  'canvas/**/*.test.mjs'` (`initial_wait ≥ 300`), shellcheck (static v0.10.0 binary if
  not installed), all five guard smokes from AGENTS.md, `cd extension && npm run
  copy-cli && git diff --exit-code extension/cli`, and `cd extension && npm ci && npm run
  build && npm run test:unit`, recording each command, exit status, and count in
  `evidence/step-5-3-full-gate.txt` — verify: full suite 0 failures (≥ 862 tests);
  shellcheck exit 0 with no findings; guard smokes exit 0; `extension/cli` has no diff;
  extension build and unit tests exit 0
