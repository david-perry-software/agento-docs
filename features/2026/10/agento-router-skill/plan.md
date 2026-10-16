# Agento router skill: `/agento <name> [args]` in Copilot sessions

## Problem

In a chat whose Session Target is **Copilot** (the Agent Host harness), prompt files
and plugin prompt commands are not loaded, so `/agento <name> [args]` resolves to
nothing Agento ships today. The harness-probe found that a **user-level skill** named
`agento` (`~/.copilot/skills/agento`, symlink or copy) does resolve as `/agento` and
receives the full argument tail (`delivery-status --probe-arg x` exactly) —
`docs/copilot-harness.md` "Skill resolution with arguments".

This feature adds that skill: `skills/agento/SKILL.md` in the Agento clone, a router
that parses the command name, applies the canonical-spelling redirect rule, reads
`commands/<name>.md`, and runs it — inline, or by handing it to the command's
`agent:` custom agent as a subagent. After it ships, a user who links the skill into
`~/.copilot/skills/agento` by hand can run every Agento command in a Copilot session;
`harness-install` later automates the link.

It is the `agento-router-skill` member of the `copilot-harness` initiative
([breakdown](../../../../initiatives/2026/10/copilot-harness/breakdown.md), block
`### agento-router-skill`); `harness-probe` and `copilot-hook-compat` (its hard
requirements) and `agents-copilot-models` (recommended before) are complete.

## Decisions

Clarifying questions asked with the ask-questions tool on 2026-10-16 (recommended
option listed first in each; every answer was the recommended option):

- **Q: Copilot has no ask-user tool and subagent output never reaches the user
  directly. Which agents should the router run inline (main session follows the
  agent file body) instead of as a subagent?** A: "Planner, Architect, Mechanic,
  Autopilot inline; Builder, Reviewer as subagents" (recommended). This is the
  user's explicit approval of decision 3's inline fallback for interactive and
  orchestrating agents, which the initiative's `## Risks` and the harness-probe
  review (finding 5) deferred to this delivery.
- **Q: The brief says disable-model-invocation: true, but the probe only proved
  resolution with false. How should the router ship?** A: "Ship true; live-verify in
  Copilot; switch to false only if /agento stops resolving" (recommended).
- **Q: How should the router find and parse commands/<name>.md?** A: "Prose-only
  skill: root from the 'Agento CLI:' context line, else realpath of the skill
  dir/../..; reads commands/<name>.md itself" (recommended). No new CLI subcommand.
- **Q: Which live checks should the (manual) Copilot-session step cover (router
  symlinked by hand into ~/.copilot/skills/agento)?** A: "delivery-status, a
  redirected old form, an unknown name, and new-feature up to its clarifying
  questions (then abandon); plus Local /agento delivery-status unchanged"
  (recommended).
- **Q: When /agento <name> matches no commands/<name>.md, what should the router
  do?** A: "Reply with the list of valid command names and stop; no fuzzy guessing"
  (recommended).

Carried from the initiative breakdown (decisions 2–4): one router skill named
`agento` keeps the canonical spelling exactly (no per-command `/agento:<name>`
skills); `commands/*.md` stays the single source the router reads;
`.github/prompts/` is unchanged.

## Research

Skills consulted: agent-customization (built-in VS Code skill: SKILL.md frontmatter
fields `name`, `description`, `argument-hint`, `user-invocable`,
`disable-model-invocation`, and skill locations). The Agento repository has no
`.agents/skills/` directory and its AGENTS.md has no skills table, so no project
skill applies (verified 2026-10-16 on `main` `6ee4bdd`).

Harness facts (all from `docs/copilot-harness.md`, VS Code 1.141.0 / Copilot Chat
0.69.0):

- **Resolution.** In Copilot, `/agento delivery-status --probe-arg x` resolved to the
  symlinked user skill as "Read skill · agento" with ARGUMENTS
  `delivery-status --probe-arg x`; plugin prompt commands are not loaded, so nothing
  shadows it. In Local, a registered plugin's `/agento <name>` commands shadow the
  user skill. The probe skill used `disable-model-invocation: false`
  (`tests/harness-probe/skills/agento/SKILL.md`); `true` is unobserved.
- **Tools.** Copilot has no ask-user and no browser tool; the subagent tool is
  `task`, with an optional `model` taking bare Copilot ids or `<vendor>/<id>`. A
  question asked as plain chat text works (the agent ends its turn; the reply arrives
  as a new turn). Local subagents use `runSubagent` and can call
  `vscode/askQuestions`, but a nested subagent has no subagent tool.
- **Model pins.** A directly selected agent in Copilot ignores its `model:` pin
  (`finding: picker-rejected`); the per-subagent model is set through `task`'s
  `model`. `agento.mjs models pins` reports `subagentModel` and `copilotModel` per
  agent (`scripts/agento.mjs` `modelsPins`, L3673), and the Autopilot already picks
  between them by the subagent tool it has
  (`.github/agents/delivery-autopilot.agent.md` Preflight step 2).
- **Root discovery.** The `Agento CLI: node <root>/scripts/agento.mjs` context line
  comes from `scripts/hooks/session-context.mjs` (`AGENTO_ROOT`, L16; emitted L109),
  and the Copilot workspace hook injects it (copilot-hook-compat live check). A skill
  reached through `~/.copilot/skills/agento` sees the link path, so `../..` from it
  is `~/.copilot`, not the clone; the clone is `realpath` of the skill directory,
  two levels up.

Agento surfaces (code, `main` `6ee4bdd`):

- `commands/*.md` — 25 byte mirrors of `.github/prompts/*.prompt.md`
  (`tests/customizations.test.mjs` "plugin manifest uses suffix-less command
  names…"). `agent:` values: `🤖 Agento Autopilot` (ap), `🔨 Agento Builder`
  (build-feature, build-issue), `🛠️ Agento Mechanic` (extend-copilot, fix-copilot),
  `📋 Agento Planner` (new-feature, new-issue), `🏛️ Agento Architect`
  (new-initiative), `🔍 Agento Reviewer` (review-feature, review-issue); 11 use
  `agent: "agent"`; 4 have none (agento-init, close-session, install-skills,
  start-session).
- `.github/agents/` — six agents: `copilot-mechanic`, `delivery-autopilot`,
  `delivery-builder`, `delivery-planner`, `delivery-reviewer`,
  `initiative-architect`.
- `tests/customizations.test.mjs` — "every prompt dispatches to a real agent" (L133)
  checks `.github/prompts` only; `guidanceFiles` (L797–L806) feeds the
  qualified-command and no-suffix tests and does not include skills; the no-suffix
  test (L819) allowlists only `agento-core.instructions.md` and `CHANGELOG.md`, so
  the router must state the redirect rule with placeholders (`<name>.prompt`), never
  with real command names.
- No `skills/` directory exists; `.claude-plugin/plugin.json` declares no skills and
  stays that way (a plugin skill is not the load path that works in Copilot).
  Top-level `skills/` is not a VS Code workspace skill location, so the clone's own
  sessions do not pick it up implicitly.
- `.github/agento.json` / `package.json` — no packaging list to update.

**Lint baseline (policy §5).** The full-repository lint is `shellcheck
scripts/hooks/*.sh scripts/wait-for-checks.sh` (AGENTS.md). On 2026-10-16 it could
not run locally: `shellcheck: command not found` (exit 127). The authoritative
baseline is CI: the `ci` workflow's Shellcheck step on `main` `6ee4bdd` concluded
`success` (zero findings). Unit tests on `main` `6ee4bdd`:
`node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` — exit 0, 551 tests, 551
pass, 0 fail (~304 s); the `ci` run on `6ee4bdd` (unit tests, Shellcheck, four guard
replays) concluded `success`.
**Overlap decision:** none — this delivery touches no shell script, so no cleanup is
in scope; the gate is the full-repository Shellcheck (locally when installed, and in
CI on the PR) compared against the zero-finding baseline, plus the full test suite.

**Concurrent deliveries.** `gh pr list --state open` returned no open PRs on
2026-10-16, so no file overlap.

## Approach

Files touched (product half): `skills/agento/SKILL.md` (new),
`tests/customizations.test.mjs`, `docs/copilot-harness.md`. Nothing in `commands/`,
`.github/prompts/`, `.github/agents/`, `scripts/`, the plugin manifest, or the
extension changes.

**`skills/agento/SKILL.md` frontmatter:**

```yaml
name: agento
description: "Use when the user types /agento <command> [args]: routes an Agento command to its commands/<name>.md and runs it inline or through its custom agent."
argument-hint: "<command> [args]"
user-invocable: true
disable-model-invocation: true
```

**Body — the routing procedure, in order:**

1. **Parse.** The first whitespace token of the arguments is the command name; the
   rest is the command's argument, passed on unchanged. No arguments → list the
   commands (step 4) and stop.
2. **Redirect rule.** A name carrying a `.prompt.md`, `.prompt`, or `.md` suffix, or
   a leading `/`, is the canonical command written in an old form: strip it, say in
   one sentence which canonical command it is read as ("Reading `/agento
   <name>.prompt` as `/agento <name>`."), and proceed without asking. Stated with
   placeholders only, mirroring agento-core's "Command spelling".
3. **Root.** `<agento-root>` is the path in the `Agento CLI: node
   <agento-root>/scripts/agento.mjs` context line when present; otherwise the
   `realpath` of this skill's directory, two levels up (the link
   `~/.copilot/skills/agento` points at `<clone>/skills/agento`). Confirm
   `<agento-root>/commands/` exists.
4. **Resolve.** Read `<agento-root>/commands/<name>.md`. Missing → reply with the
   valid names (the basenames of `<agento-root>/commands/*.md`, each as `/agento
   <name>`) and stop; no closest-match guessing.
5. **Dispatch** by the file's `agent:` frontmatter, via a table in the skill naming
   every agent in `.github/agents/` exactly once:

   | `agent:` | Mode |
   | --- | --- |
   | missing or `agent` | inline |
   | `📋 Agento Planner`, `🏛️ Agento Architect`, `🛠️ Agento Mechanic`, `🤖 Agento Autopilot` | inline, as that agent |
   | `🔨 Agento Builder`, `🔍 Agento Reviewer` | subagent |

   - **Inline:** follow the command file's body as this turn's instructions, with the
     argument as its argument. **Inline, as that agent:** first read the agent's
     `.github/agents/*.agent.md` (matched by its `name:`) and follow its body as the
     operating rules, then the command body. Where the agent needs `ask-questions` or
     `browser` and the tool is absent, its §10 fallback applies (numbered questions in
     chat; headless verify).
   - **Subagent:** run `node <agento-root>/scripts/agento.mjs models pins`, take the
     agent's pin (`builder` / `reviewer`), and invoke the agent with the subagent
     tool available — `task` (Copilot) with `copilotModel` as `model`, or
     `runSubagent` (Local) with `subagentModel` as `model`, omitting it when `null`
     — passing the command body and the argument. Relay the subagent's final message
     verbatim, including its receipt and result lines and its command blocks.
6. The router adds no receipt or result line of its own; the dispatched command
   owns §9 (the router's own outputs are the redirect sentence and the unknown-name
   list).

**Tests (`tests/customizations.test.mjs`):**

- the router skill exists at `skills/agento/SKILL.md`; frontmatter `name` equals
  `agento` and its directory name; `argument-hint` is `<command> [args]`;
  `user-invocable: true`; `disable-model-invocation` is `true` (or the value Phase 2
  settles on); `description` starts with `Use when`;
- every `commands/*.md` `agent:` is absent, `"agent"`, or an existing agent `name:`;
- the router's dispatch table names every `.github/agents` agent exactly once, the
  inline set is exactly Planner, Architect, Mechanic, Autopilot, and the body names
  `models pins`, `task`, `runSubagent`, `copilotModel`, `subagentModel`, the
  `Agento CLI:` line, and `realpath`;
- `skills/**/SKILL.md` joins `guidanceFiles` (qualified commands, no suffixed
  command) and the relative-link test.

**Docs:** `docs/copilot-harness.md` gains a `## Router skill` section — location,
the by-hand link (`ln -s <clone>/skills/agento ~/.copilot/skills/agento`) until
`harness-install`, the dispatch table, and the Phase 2 live results — and its
"Implication for `agento-router-skill`" paragraph is updated. User-facing install
and command docs stay with `harness-install` and `harness-docs`.

**Verification:** the Builder creates the symlink itself (CLI work, §1) and removes
it afterwards only if it still points at this delivery's worktree. Copilot and Local
chat sessions cannot be driven by the agent's browser tools, so the live checks are
`(manual)` steps with screenshots, as in harness-probe and agents-copilot-models.

## Risks

- **`disable-model-invocation: true` may hide the skill from `/agento` in Copilot**
  (only `false` was probed). Mitigation: live check 2.3; if it fails, step 2.4 flips
  it to `false`, updates the test and docs, and step 2.5 repeats the checks — as the
  user decided.
- **Inline dispatch runs a custom agent's rules on the session model.** Copilot
  ignores directly selected agent pins anyway (`finding: picker-rejected`); the
  Planner/Architect/Mechanic/Autopilot run on whatever the user picked. Accepted
  with decision 1; Builder/Reviewer keep their pins through `task`'s `model`.
- **`~/.copilot/skills/agento` may already exist** (a user's own skill or a stale
  probe link). Mitigation: the Builder creates the link only when the path is absent
  and stops if it exists, naming it; teardown removes it only if it points at this
  worktree.
- **The user's registered `agento-plugin` checkout is a confound** (session warning
  `companion-anchor`; harness-probe confound). In Local it shadows the user skill
  (that is exactly the parity check); in Copilot its prompt commands do not load.
  The screenshots must show "Read skill · agento" for the Copilot checks.
- **Copilot turns are slow** (~4 min per `/name` turn in the probe). Mitigation:
  keep the live checks to the five decided prompts.
- **A long command body passed to `task` might be truncated or lose its receipt.**
  Mitigation: the router relays the subagent's final message verbatim; Builder and
  Reviewer are exercised by tests here and end to end in `harness-docs`' acceptance
  run (not in this member's live checks, per decision 4).
- **Concurrent deliveries:** none open on 2026-10-16. Mitigation if that changes:
  integrate `origin/main` before every push.

## Out of scope

- Installing the link (`agento.mjs harness install|status`, doctor `harness` check)
  — `harness-install`.
- Extension dispatch in Copilot — `dispatch-copilot-harness`.
- `docs/install.md`, `docs/commands.md`, README, version bump, CHANGELOG —
  `harness-docs`.
- Declaring the skill in `.claude-plugin/plugin.json`, per-command
  `/agento:<name>` skills, deleting `.github/prompts/` or `commands/`.
- Changing any command or agent body; a new `agento.mjs route` subcommand.
- Live end-to-end checks of Builder/Reviewer via `task` (the initiative's
  `harness-docs` acceptance run covers them).

## Acceptance checklist

- [ ] `skills/agento/SKILL.md` exists with `name: agento`, `argument-hint:
  "<command> [args]"`, `user-invocable: true`, the decided
  `disable-model-invocation` value, and a `Use when` description — verified by the
  new router-frontmatter test in `tests/customizations.test.mjs`.
- [ ] The router body states parsing, the placeholder-only redirect rule, root
  discovery (`Agento CLI:` line, else `realpath` two levels up), the unknown-name
  list, and the dispatch table covering every agent exactly once with the decided
  inline set — verified by the new router-content tests and by reading the file.
- [ ] Every `commands/*.md` `agent:` is absent, `"agent"`, or an existing agent name
  — verified by the new commands-agent test.
- [ ] `skills/**/SKILL.md` is covered by the qualified-command, no-suffix, and
  relative-link tests — verified by a temporary bare `/<command>` in the skill making
  the qualified-command test fail (reverted).
- [ ] In a Copilot session with the link installed, `/agento delivery-status` shows
  "Read skill · agento" and prints the delivery-status receipt and result line —
  verified by a linked screenshot under `evidence/`.
- [ ] In Copilot, `/agento delivery-status.prompt` prints the redirect sentence and
  then runs delivery-status; `/agento not-a-command` lists the valid commands and
  stops — verified by linked screenshots.
- [ ] In Copilot, `/agento new-feature <description>` in a throwaway plan session
  runs inline as the Planner: prints the new-feature receipt and asks numbered
  clarifying questions with a recommended option — verified by a linked screenshot;
  the throwaway session is closed afterwards.
- [ ] In a Local session, `/agento delivery-status` behaves as before (no "Read skill
  · agento"; delivery-status receipt printed) — verified by a linked screenshot.
- [ ] `docs/copilot-harness.md` has a `## Router skill` section with the link
  command, dispatch table, and live results — verified by reading it and
  `node --test tests/harness-probe/probe.test.mjs` (links resolve).
- [ ] Gates: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exits 0;
  the guard replays from AGENTS.md exit 0; full-repository Shellcheck (locally if
  installed, and the PR's `ci` Shellcheck step) reports zero findings, matching the
  baseline — results recorded on the roadmap gate steps.
- [ ] Teardown: `~/.copilot/skills/agento` is removed if it points at this worktree,
  and both halves are clean (`git status --porcelain --untracked-files=all` empty).
