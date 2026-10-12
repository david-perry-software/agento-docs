# Policy on demand: a ≤ 40-line always-on core, the full delivery policy loaded only where it is used

## Problem

This is member `### policy-on-demand` of the
[spend-reduction](../../../../initiatives/2026/10/spend-reduction/breakdown.md)
initiative (wave 1, size M). Brief: "Keep a ≤40-line always-on core (work boundary,
git musts, secrets, receipt one-liner); move §2–§12 into referenced, non-auto-applied
file(s) keeping `§N` anchors; trim command-invocation to the redirect rule; dedupe
SessionStart. Update the canary and cite tests in customizations.test.mjs. Risk:
confirm VS Code loads instruction files linked from agent/prompt bodies."

Today three instruction files carry `applyTo: "**"`:

- `.github/instructions/delivery-policy.instructions.md` (439 lines, 29 183 bytes);
- `.github/instructions/command-invocation.instructions.md` (60 lines, 1 919 bytes);
- `.github/instructions/ai-skills.instructions.md` (18 lines, 961 bytes).

That is 32 063 bytes on every request in every Agento window, including chats that
never run an `/agento` command. In an agent loop, it is re-sent on every tool-call turn.

Research for this plan found the reverse problem in target repositories:

- the plugin ships no instruction files;
- the agents' links to the policy are skipped by default;
- so agents and commands there read the policy only if the model decides to.

After this feature:

- the always-on payload is one ≤ 40-line core plus `ai-skills`;
- the full policy keeps its path and all twelve `§N` sections;
- every agent and every built-in-agent command reads the policy once, explicitly;
- the duplicate SessionStart block is gone.

## Decisions

The questions were asked with the ask-questions tool. The user picked the
recommended option for every question:

- **Q1: Target repos never get the policy auto-applied. Should this feature also make
  its on-demand load reliable there?** A: "Both: shrink Agento's always-on payload and
  make cited loads reliable in target repos" (recommended). Not chosen: "Only shrink
  the always-on payload in this repo".
- **Q2: How should the policy files be laid out?** A: "Keep
  delivery-policy.instructions.md (all 12 sections, same path) on demand; add a new
  ≤40-line always-on core file" (recommended). Not chosen: "Split the policy into
  several files (e.g. delivery §2–§8, commands §9–§12)"; "Shrink delivery-policy itself
  to the core and move §2–§12 to a new reference file".
- **Q3: How should the policy reach a running prompt?** A: "Agent prompts inherit the
  agent's link; the 11 built-in-agent prompts read the policy once via <agento-root>"
  (recommended). Not chosen: "Add a root instructions/ symlink so ../instructions/…
  resolves from both dirs; link from every prompt"; "Rely on the policy's description
  for on-demand discovery only". Q6 below amends this answer.
- **Q4: What happens to command-invocation.instructions.md?** A: "Fold the redirect
  rule into the core and drop the always-on file" (recommended). Not chosen: "Keep it
  always-on but trimmed to the redirect rule"; "Make it description-only (on demand)".
- **Q5: How should the duplicate SessionStart context be fixed?** A: "Plugin-mode
  SessionStart stays silent when the workspace has Agento's own wiring; doctor warns
  too" (recommended). Not chosen: "Doctor warning and docs only, no hook change";
  "Dedupe both SessionStart and the PreToolUse guard".
- **Q6 (follow-up).** After Q3, research found that `chat.includeReferencedInstructions`
  defaults to `false` (see Research), so agent links do not load the policy. The
  question: **"Your earlier choice assumed agent links auto-load the policy. They
  don't by default. How should agents load it?"** A: "Explicit read line in all 6
  agents and the 11 built-in-agent prompts" (recommended). Not chosen: "Keep agent
  links, document enabling the setting, doctor warns when it is off".
- **Q7 (amendment 2026-10-11).** Asked during the build, at the paused manual step
  5.2: **"Step 5.2 cannot be verified as written: this VS Code build (1.136.0) shows
  no References list on chat answers, and the Agent Debug Logs panel stays on 'Enable
  in Settings' even with `github.copilot.chat.agentDebugLog.enabled: true` in user
  settings and a reload. Replace 5.2 with agent-captured evidence of VS Code's own
  instruction list, or keep digging?"** A: "1. But I want to see the evidence"
  (option 1: replace 5.2 with that evidence and continue; the user wants to see the
  evidence content). Roadmap step 5.2 is marked obsolete and replaced by 5.5.

## Research

Skills consulted: agent-customization (built-in):

- an `applyTo: "**"` instruction loads on every interaction;
- instruction files apply through an `applyTo` glob or on demand through their
  `description`.

The repository has no `.agents/skills/` and no skills table in AGENTS.md.

### Always-on payload (measured 2026-10-11 at `54ffd54`)

| File | `applyTo` | Lines | Bytes |
| --- | --- | --- | --- |
| `.github/instructions/delivery-policy.instructions.md` | `**` | 439 | 29 183 |
| `.github/instructions/command-invocation.instructions.md` | `**` | 60 | 1 919 |
| `.github/instructions/ai-skills.instructions.md` | `**` | 18 | 961 |
| **Total** | | **517** | **32 063** |

`concurrent-delivery` (`features/**,issues/**`) and `delivery-artifacts`
(`features/**,issues/**,initiatives/**`) are already scoped and stay unchanged. This
planning session's own context shows all three `**` files attached in full.

### How the policy reaches a chat today

- **Plugin mode ships no instructions.** `.claude-plugin/plugin.json` declares
  `agents`, `commands`, and `hooks` only. VS Code's Claude-format plugins carry no
  instruction or rule component. Evidence:
  - the target repo `/home/david/DP/soshiki/.github/instructions/` holds no Agento
    policy file;
  - its companion holds only the `agento.instructions.md` artifact contract.

  So the 32 KB always-on cost exists only in Agento's own windows. In a target repo
  the policy arrives only by link or by an explicit read.
- **Links are skipped by default.** VS Code 1.136.0's bundle
  (`/usr/share/code/resources/app/out/vs/workbench/workbench.desktop.main.js`)
  declares `chat.includeReferencedInstructions` with `default: false` and
  `restricted: true`:
  - plugins and workspaces cannot set it, and the user's `settings.json` does not;
  - the Copilot extension logs "includeReferencedInstructions is disabled. Skipping
    referenced instructions.";
  - five of the six agents link the policy
    (`[delivery-policy.instructions.md](../instructions/delivery-policy.instructions.md)`),
    so today they get only the path. `.github/agents/copilot-mechanic.agent.md` cites
    it in plain text only (L13, L92).
- **Prompts cite the policy in plain text only.** None of the 25 prompts links it.
  - 11 prompts run on the built-in agent (`agent: "agent"`): `commit-current-changes`,
    `continue`, `delivery-status`, `doctor`, `finish-freehand`, `models`,
    `next-feature`, `quick-fix`, `ship`, `start-freehand`, `triage-followups`.
  - The other 14 dispatch to an Agento agent, whose body (and read line) they inherit.
- **Links cannot be made portable.** A prompt and its `commands/<name>.md` mirror must
  be byte-identical (`tests/customizations.test.mjs` L674–L681). So one relative link
  cannot resolve from both `.github/prompts/` and `commands/`; this rules out
  link-based loading for prompts.
- **The CLI path is already in context.** The SessionStart hook emits
  `Agento CLI: node <agento-root>/scripts/agento.mjs`
  (`scripts/hooks/session-context.mjs` L106–L111) in both plugin and workspace
  mode, so an explicit read can name `<agento-root>`.

### Duplicate SessionStart

- This planning session received two SessionStart blocks:
  - one with `Agento CLI: node /home/david/DP/agento-worktrees/plan-20261011-200239/…`
    (workspace-mode `.github/hooks/session-start.json`);
  - one with `Agento CLI: node /home/david/DP/agento/…` (plugin mode, from
    `chat.pluginLocations: { "/home/david/DP/agento": true }` in the user's
    `settings.json`).
- AGENTS.md and `docs/install.md` L31–L37 already advise against registering the
  clone, or disabling the plugin per workspace. The user keeps it registered for
  other repositories.
- VS Code's plugin loader sets the plugin-root environment variable for Claude-format
  hooks (`pluginRootEnvVars: ["PLUGIN_ROOT","CLAUDE_PLUGIN_ROOT"]` in the same
  bundle), and workspace hooks get none. A plugin-mode run is therefore detectable in
  process.
- `buildSessionContext` (`scripts/hooks/session-context.mjs` L84–L146) has no dedupe.
- `tests/session-context.test.mjs` covers the output shape (19 tests) but not the
  wiring mode.

### Tests and docs that constrain the change

- `tests/customizations.test.mjs`:
  - L148: every instruction file needs `description` and `applyTo`.
  - L166: every `§N` cited in agents, prompts, and instructions must be a `## N.`
    heading in `delivery-policy.instructions.md`; at least 12 sections.
  - L538: the canary list. Rule phrases may appear only in the policy, scanning every
    agent, prompt, and instruction file, so the new core must avoid them.
  - L616: the suffix allowlist names `command-invocation.instructions.md`.
  - L646: `command-invocation` must have `applyTo: "**"` and list every command.
  - L258, L368, L420: read sections of the policy file by path.
- `scripts/agento.mjs`:
  - doctor checks L860–L955;
  - `CAPABILITY_CHECKS` L972 (informational checks such as `model-profile` stay out);
  - `LOCAL_DOCTOR_CHECKS` L1034.
- `scripts/agento.test.mjs` asserts exact doctor check id lists (L1443, L1615, L1621,
  L3085).
- Docs that describe the policy as always-on or name `command-invocation`:
  - `docs/architecture.md` L50–L69;
  - `docs/commands.md` L470;
  - `.github/agents/copilot-mechanic.agent.md` L72–L74;
  - the AGENTS.md layout bullet;
  - `CHANGELOG.md` L611 (history, stays).

### Lint baseline (2026-10-11, `54ffd54`)

| Command | Exit | Findings |
| --- | --- | --- |
| `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | 0 | 441 tests, 441 pass, 0 fail |
| `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` | 0 | none |
| `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` | 0 | none |
| `git ls-files '*.sh' \| xargs pnpm dlx shellcheck` | 0 | none |

The `shellcheck` binary is not installed locally. `pnpm dlx shellcheck` is the
documented substitute (used by `model-profiles` 4.1). The baseline is green, so there
is no overlap to clean up and the full gate applies: every command above must stay
at exit 0 with no new findings.

### Open deliveries

`gh pr list --state open` returned no PRs, so no file overlap exists today.
`preflight-call` (wave 1, planned in parallel) will rewrite:

- the opening lines of every prompt and agent;
- the §9–§11 wording of `delivery-policy.instructions.md`.

See Risks.

## Approach

1. **New always-on core.** Add `.github/instructions/agento-core.instructions.md`.
   - Frontmatter: `description`, `applyTo: "**"`. The whole file is ≤ 40 lines.
   - Body, in this order:
     - One pointer: the full rules are in
       `.github/instructions/delivery-policy.instructions.md`, `§N` names its
       section N. Read it once before running an `/agento …` command or acting as an
       Agento agent, unless it is already in context.
     - Work boundary (§1, one line): the agent runs everything a CLI or a browser can
       do; only secrets, unreachable dashboards, approvals, and physical devices are
       the user's.
     - Secrets: never print, request, or log them. On an auth failure, stop and name
       the reauth command.
     - Git musts (§7, one or two lines): never commit or push to the default branch;
       no force-push, rebase or amend of pushed history, `--no-verify`, or
       `--admin`; integrate the default branch by merge; only `/agento ship` merges
       a delivery PR.
     - Receipts (§9, one line): every `/agento` command response opens with one
       receipt line and closes with one result line naming the next command.
     - Command spelling, folded from `command-invocation`: the canonical form
       `/agento <name> [args]` (names are the `.github/prompts/*.prompt.md`
       basenames); the six redirected forms and the redirect rule (name the
       canonical command in one sentence, proceed, arguments unchanged, no
       confirmation; example `/agento agento-init.prompt` → `/agento agento-init`);
       and the guidance rule that only this file may quote the old forms.
   - It must match none of the L538 canaries (for example, no `Receipt: accepted`
     spelling). The full spellings stay in §9.
2. **Policy on demand.** In `delivery-policy.instructions.md`, change only the
   frontmatter; the body and all twelve `## N.` headings are unchanged.
   - `description` starts "Use when running any /agento command or acting as an
     Agento agent (Planner, Builder, Reviewer, Autopilot, Architect, Mechanic): …",
     which enables on-demand discovery.
   - `applyTo` becomes
     `".github/agents/**,.github/prompts/**,.github/instructions/**,commands/**"`.
     It still attaches while Agento's own customization files are edited, and the
     L148 rule stays satisfied without a test change.
3. **Drop `command-invocation.instructions.md`.** Delete it and move its content into
   the core (item 1).
   - The 25-command list is dropped: the prompts directory is the list, and
     `docs/commands.md` `## Invocation` still lists every command.
   - Update `docs/commands.md` L470 to point at the core, update `docs/architecture.md`
     L50–L69 (core always-on; policy loaded by an explicit read), the AGENTS.md
     layout bullet, and `copilot-mechanic.agent.md` L72–L74 (`ai-skills` and the
     core are the always-on examples) and L92.
4. **Explicit policy load.** Add one line, `Policy: read
   \`<agento-root>/.github/instructions/delivery-policy.instructions.md\` once before
   the first step unless it is already in context; \`<agento-root>\` comes from the
   session context line \`Agento CLI: node <agento-root>/scripts/agento.mjs\`.`
   - It goes directly after the `Capability vocabulary … §10.` pointer, which
     keeps the `declarations()` contract (`Needs:` and `Fallback:` are the first two
     body lines).
   - Add it to all six agents and to the 11 `agent: "agent"` prompts.
   - Re-mirror `commands/<name>.md` byte for byte.
   - The 14 prompts that dispatch to an Agento agent inherit the agent's line.
   - The Mechanic also gains the relative link the other five agents have.
5. **Tests** (`tests/customizations.test.mjs`):
   - **(a)** "only the core and ai-skills are always-on": the set of instruction
     files whose `applyTo` is exactly `**` equals {`agento-core`, `ai-skills`}; the
     core is ≤ 40 lines; the policy's `applyTo` is not `**`.
   - **(b)** Replace the L646 test with "the core states the canonical form and the
     six redirected forms".
   - **(c)** The L616 allowlist names the core instead of `command-invocation`.
   - **(d)** "every agent and built-in-agent command loads the policy explicitly":
     the `Policy: read …` line is present in all six agents, in every prompt whose
     `agent:` is `"agent"`, and in its mirror.
   - **(e)** `tests/session-context.test.mjs` (Approach 6) and
     `scripts/agento.test.mjs` (Approach 7) cover the hook and doctor changes.
6. **SessionStart dedupe** (`scripts/hooks/session-context.mjs`; a hook edit, so it
   is gated behind the user's approval). `main()` emits nothing when both hold:
   - `CLAUDE_PLUGIN_ROOT` or `PLUGIN_ROOT` is set in the environment (plugin mode);
   - the session repo root (`git rev-parse --show-toplevel` of the payload `cwd`)
     carries Agento's workspace-mode wiring: `.github/hooks/session-start.json` whose
     `SessionStart` command is `./scripts/hooks/session-context.sh`, plus that script
     file.

   The workspace-mode run still emits the context once. No change to
   `delivery-guard`, the wrappers, or the wiring files. New test cases:
   - plugin env + wiring → no output;
   - plugin env without wiring → normal output;
   - wiring without plugin env → normal output.
7. **Doctor `hook-wiring` check** (`scripts/agento.mjs`). An informational check:
   added to `DOCTOR_CHECKS` and `LOCAL_DOCTOR_CHECKS`, not to `CAPABILITY_CHECKS`, so
   `doctor --for` never runs it.
   - `ok` when the session root has no Agento workspace-mode wiring.
   - With the wiring, read the VS Code user settings (JSONC tolerated: comments and
     trailing commas). The path is `AGENTO_VSCODE_SETTINGS` when set, else
     `$XDG_CONFIG_HOME/Code/User/settings.json` or
     `~/.config/Code/User/settings.json` on Linux, and
     `~/Library/Application Support/Code/User/settings.json` on macOS.
   - `warn` when `chat.pluginLocations` maps a path whose git common directory equals
     this repository's to `true`:
     - detail: plugin-mode and workspace-mode hooks both fire; SessionStart is
       deduplicated; the guard runs twice; a per-workspace disable is not visible to
       the CLI;
     - fallback: disable the Agento plugin for this workspace (Extensions → Agent
       Plugins – Installed) in each worktree window, or remove the clone from
       `chat.pluginLocations` (`docs/install.md`).
   - `ok` with a detail otherwise, including an unreadable settings file.
   - Update the exact-id assertions in `scripts/agento.test.mjs` and regenerate
     `extension/cli/` with `cd extension && npm run copy-cli`.
8. **Docs and changelog.**
   - `docs/hooks.md` SessionStart section: the plugin-mode dedupe.
   - `docs/install.md` "When developing Agento …": the dedupe and the `hook-wiring`
     check.
   - `CHANGELOG.md` `## Unreleased`: one entry with the before/after bytes.
9. **Measurement.** Record before and after `wc -l -c` of the `applyTo: "**"` set
   under `evidence/` (baseline 517 lines and 32 063 bytes). The tool-call count of a
   reference run is not a metric this member moves:
   - Agento windows save the per-turn payload;
   - target repos gain one policy read per agent or command run.

   `builder-step-cli` records the initiative's reference-run baseline.

Affected files:

- `.github/instructions/agento-core.instructions.md` (new);
- `.github/instructions/delivery-policy.instructions.md` (frontmatter only);
- `.github/instructions/command-invocation.instructions.md` (deleted);
- six `.github/agents/*.agent.md`;
- 11 `.github/prompts/*.prompt.md` and their 11 `commands/*.md` mirrors;
- `scripts/hooks/session-context.mjs`, `scripts/agento.mjs`, and `extension/cli/`
  (generated);
- `tests/customizations.test.mjs`, `tests/session-context.test.mjs`,
  `scripts/agento.test.mjs`;
- `docs/architecture.md`, `docs/commands.md`, `docs/hooks.md`, `docs/install.md`,
  AGENTS.md, `CHANGELOG.md`.

## Risks

- **Target repos spend more per command.** Each agent or built-in-agent command now
  reads about 29 KB once, where today the policy is usually never loaded. This is the
  intended correctness fix (Q1, Q6).
  - Mitigation: the line says "once … unless it is already in context", so resumed or
    chained turns do not reread.
  - The trade is recorded in the CHANGELOG entry.
- **Rules disappear from Agento's own chats that run no command.** Plain chats in this
  repository lose §2–§12. Mitigations:
  - the core keeps the safety-critical musts (work boundary, secrets, git, receipts);
  - the policy still attaches while customization files are edited (narrow
    `applyTo`) and stays discoverable through its description;
  - test (a) stops anyone from re-widening it to `**` by accident.
- **The model may skip the explicit read.** Mitigations:
  - the line is the third body line of every agent and built-in-agent prompt;
  - test (d) keeps it there;
  - the core repeats the instruction in Agento's own windows.
- **The plugin-mode signal may change.** The dedupe relies on VS Code setting
  `CLAUDE_PLUGIN_ROOT` or `PLUGIN_ROOT` for plugin hooks. If a future VS Code stops,
  the dedupe silently turns off and the duplicate returns, but context is never lost.
  If workspace hooks are disabled (untrusted workspace) while the wiring file
  exists, the plugin run goes silent and no context is injected. The doctor check
  and `docs/hooks.md` name this case.
- **The doctor warning cannot clear while the clone stays registered.** It cannot see
  a per-workspace plugin disable (VS Code keeps that state outside the settings file).
  The detail says so, the check is informational, and `doctor --for` never fails on
  it.
- **Concurrent delivery with `preflight-call`.** That member edits the opening lines
  of the same 31 prompt and agent files and the §9–§11 wording of the policy.
  Mitigations:
  - this member touches the policy frontmatter only, plus one inserted line per
    file;
  - integrate `origin/main` by merge before every push (policy §7);
  - whichever ships second resolves the one-line conflicts, keeping both sides;
  - regenerate `extension/cli/` after any merge that touches `scripts/`.
- **Hook edits are security-sensitive.** The guard asks for approval on every
  `scripts/hooks/` edit. Mitigation: the change is confined to `main()` and a
  pure helper in `session-context.mjs`, covered by new tests and both guard replays.

## Out of scope

- Shipping instruction files through the plugin to target repositories. The core and
  the redirect rule stay Agento-repo-only, as `command-invocation` is today. Recorded
  as a follow-up.
- Changes to the policy's rule text, section numbering, receipts, window boundaries,
  or §9–§11 wording (`preflight-call` owns the latter).
- Deduplicating the PreToolUse guard (Q5).
- Trimming prompt and agent prose beyond the inserted read line; model re-pinning;
  extension changes beyond `npm run copy-cli` (initiative exclusions).
- `concurrent-delivery` and `delivery-artifacts` instruction scoping (already narrow).

## Acceptance checklist

- [ ] Exactly two instruction files apply to `**`: `agento-core` (≤ 40 lines) and
  `ai-skills`. Verify: `grep -l '^applyTo: "\*\*"' .github/instructions/*.md` lists
  exactly those two; `wc -l .github/instructions/agento-core.instructions.md` ≤ 40;
  customizations test (a) passes.
- [ ] The always-on payload is recorded before and after, and is at most 4 096 bytes
  (from 32 063). Verify: `evidence/step-1-1-baseline.md` and
  `evidence/step-5-1-after.md` exist with `wc -l -c` output, and the after total is
  ≤ 4 096.
- [ ] `delivery-policy.instructions.md` keeps its path and its 12 `## N.` sections,
  and only its frontmatter changed. Verify: `git diff origin/main --
  .github/instructions/delivery-policy.instructions.md` touches lines 2–3 only;
  `grep -c '^## [0-9]*\. ' .github/instructions/delivery-policy.instructions.md` =
  12; the §N test passes.
- [ ] `command-invocation.instructions.md` is gone, and its redirect rule (canonical
  form, six forms, proceed without confirmation) is in the core. Verify: the file is
  absent; `git grep -n command-invocation -- ':!CHANGELOG.md'` prints nothing;
  customizations test (b) passes.
- [ ] All six agents and the 11 built-in-agent prompts (with byte-identical mirrors)
  carry the `Policy: read <agento-root>/.github/instructions/delivery-policy.instructions.md`
  line. Verify: customizations test (d) passes; a mutation that removes the line from
  one prompt fails it; `for f in .github/prompts/*.prompt.md; do cmp -s "$f"
  "commands/$(basename "$f" .prompt.md).md" || echo "DIFF $f"; done` prints nothing.
- [ ] In plugin mode, the SessionStart hook emits nothing when the session repo
  carries Agento's workspace-mode wiring, and emits as before otherwise. Verify: the
  three new `tests/session-context.test.mjs` cases pass; both guard replays exit 0.
- [ ] `agento.mjs doctor` reports a `hook-wiring` check. It warns in this worktree
  (the clone is registered), stays `ok` without the wiring or the registration, and
  never runs under `doctor --for`. Verify: the new `scripts/agento.test.mjs` cases
  pass; `node scripts/agento.mjs doctor` here shows `hook-wiring` `warn` naming
  `/home/david/DP/agento`; `node scripts/agento.mjs doctor --for ship` lists no
  `hook-wiring`.
- [ ] A fresh chat in an Agento window references the core and `ai-skills` but not the
  delivery policy or `command-invocation`. Verify (amended 2026-10-11, Q7):
  `evidence/step-5-5-instruction-list.md` from step 5.5 shows VS Code's injected
  instruction list with `applyTo: **` only for the core and `ai-skills` among this
  repository's files, and no `command-invocation`.
- [ ] Docs and changelog describe the new loading model. Verify: `grep -n
  'agento-core' docs/architecture.md docs/commands.md AGENTS.md` ≥ 1 each; `grep -n
  -i 'plugin mode' docs/hooks.md` covers the dedupe; `CHANGELOG.md` `## Unreleased`
  has the entry with both byte counts.
- [ ] The full gate is green and matches the baseline. Verify: `node --test
  'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exit 0 with ≥ 441 pass and 0 fail;
  both replays exit 0; `git ls-files '*.sh' | xargs pnpm dlx shellcheck` exit 0 with
  no findings; `cd extension && npm run copy-cli && npm run typecheck && npm run
  test:unit` exit 0; `node --test tests/extension-bundle.test.mjs` exit 0; `node
  scripts/agento.mjs initiative spend-reduction` reports `errors: []`.
