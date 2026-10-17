# Copilot-harness documentation, 0.8.0 release metadata, and two-harness acceptance

## Problem

The `copilot-harness` initiative made Agento work when the chat's Session Target is
**Copilot** (Agent Host): dual-shape hooks (`copilot-hook-compat`), agent pins under
the `task` tool (`agents-copilot-models`), the `agento` router skill
(`agento-router-skill`), `agento.mjs harness install|status|uninstall` plus a doctor
`harness` check (`harness-install`), and dashboard dispatch in both harnesses
(`dispatch-copilot-harness`). All six earlier members are `status: complete`, but the
user-facing docs still describe a Local-only plugin: docs/install.md, commands.md,
architecture.md, and extension.md never mention the Copilot harness, the router link,
or the `harness` subcommand; README.md has no pointer; CHANGELOG.md has no entry; and
the plugin is still `0.7.0`. A Copilot user today has to read the probe findings in
docs/copilot-harness.md to learn that `/agento` needs `harness install`, and nobody
has run the initiative's two-harness acceptance in a target repository.

This feature implements the `harness-docs` member of the
[copilot-harness breakdown](../../../../initiatives/2026/10/copilot-harness/breakdown.md)
(`### harness-docs`, wave 6): document Copilot-harness use end to end, bump the
plugin version with a CHANGELOG entry, and run the full two-harness acceptance in
soshiki. It changes no runtime behavior.

## Decisions

Initiative member intake: `/agento new-feature initiative:copilot-harness/harness-docs`
on 2026-10-17. `agento.mjs initiative copilot-harness` reported the member
`state: unplanned`, `ready: true`, `blockedBy: []`. Description baseline (the
member's `Brief:`): "Tests and docs: update docs/install.md, hooks.md,
architecture.md, extension.md, and commands.md; bump the version in
.claude-plugin/plugin.json and add a CHANGELOG entry; verification for the initiative
overall (full test suites and replays, and the manual Copilot-session and
Local-session checks in soshiki)."

Clarifying questions asked with the ask-questions tool on 2026-10-17 (the recommended
option was chosen every time):

- **Q: How should the release metadata be bumped?** A: "0.8.0 minor: bump all three
  manifests + lockfile, turn '## Unreleased' into '## 0.8.0 (<ship date>)' and add a
  Copilot-harness entry" (recommended).
- **Q: Which files beyond the brief's five docs (install, hooks, architecture,
  extension, commands) should this feature update?** A: "Also README.md (install +
  troubleshooting pointer), AGENTS.md layout (skills/ dir), and
  docs/model-profiles.md copilotModel follow-up" (recommended).
- **Q: Members left docs/copilot-harness.md follow-ups (dispatch matrix V2–V8,
  'predates router' wording, ask-user card vs 'no ask-user tool'). How much here?**
  A: "Wording reconciliations only (soften dispatch hypothesis, clarify ask-user
  contexts); no new V2–V8 live probing" (recommended).
- **Q: The two-harness soshiki checks are manual (you set Session Target and type in
  chat). Where should '/agento new-feature runs in the Planner' be checked?** A: "In
  a throwaway soshiki planning session (start-session → new-feature up to its first
  question → close-session to abandon)" (recommended).
- **Q: The router link points at /home/david/DP/agento-plugin, 8 commits behind
  origin/main. May the Builder fast-forward it (git pull --ff-only) before the
  acceptance run?** A: "Yes, Builder fast-forwards agento-plugin before the soshiki
  checks" (recommended).

## Research

Skills consulted: none — no matching domain. The repository has no `.agents/skills/`
directory and AGENTS.md has no skills table; the work is Markdown and JSON metadata
only. (The built-in agent-customization skill covers customization files, which this
feature does not change.)

### What shipped (on `main` `1f0d3de`) and where the docs stand

- **Router skill.** `skills/agento/SKILL.md` exists; it dispatches by
  `commands/<name>.md` `agent:` — inline for missing/`agent` and for Planner,
  Architect, Mechanic, Autopilot; subagent for Builder and Reviewer
  (docs/copilot-harness.md "Router skill", L234–L307).
- **Harness CLI.** `scripts/agento.mjs` L33 usage
  `harness <status|install|uninstall> [--plugin-root <dir>] [--force]`; doctor
  `harness` check at L1014–L1027 (`foreign`/`dangling` → `warn` with an
  `install --force` fallback); `LOCAL_DOCTOR_CHECKS` (L1183) includes `hook-wiring`
  and `harness`; refusal states at L4676–L4679 (`worktree`, `not-a-link`,
  foreign/dangling without `--force`); `LOCAL_TAKEOVER` text at L1028.
- **Local takeover.** With the link installed, Local also routes `/agento` through the
  router; Builder/Reviewer keep pins via `runSubagent` + `subagentModel`, but the
  inline agents and prompt-level `model:` pins do not switch; `harness uninstall`
  restores the Local prompt commands (`scripts/agento.mjs` L1028;
  docs/copilot-harness.md L230–L290). Carried to this member by
  `agento-router-skill` review.md Follow-ups and `harness-install` review.md
  Follow-ups.
- **Dispatch.** `extension/src/commandDispatcher.ts` L48–L52 still passes the
  command file's `agent:` as `mode`; docs/copilot-harness.md "Dispatch" (L309–L326)
  records V1 submitting in both harnesses with the router installed.
- **docs/install.md** (108 lines): Options A–C and "Verifying the install" are
  Local-only; no `harness`, Session Target, or router mention.
- **docs/hooks.md**: already states the dual-shape SessionStart output (L24–L29) and
  `permissionDecisionReason` (L73); no Copilot tool-name normalization, Copilot
  replay commands, or Copilot `ask` caveat.
- **docs/architecture.md**: "Pieces" (L41–L121) has no router skill or harness CLI.
- **docs/extension.md**: "Command routing" (L215–L278) describes agent-mode
  dispatch with no Copilot note.
- **docs/commands.md**: the CLI `doctor` check list (L408–L409) stops at
  `model-profile` (missing `hook-wiring` and `harness`); no `harness` subcommand
  entry; "Invocation" (L540–L582) does not say how `/agento` resolves per harness.
- **docs/model-profiles.md**: the `models pins` paragraph (L137–L142) lacks
  `copilotModel` and the `task` rule (`agents-copilot-models` review.md Follow-up
  F1).
- **docs/copilot-harness.md**: carries open wording follow-ups from
  `dispatch-copilot-harness` review.md ("predates the router install" stated as fact)
  and `agento-router-skill` review.md ("no ask-user tool" vs the structured card
  seen inline).
- **README.md**: Install (L91–L126) and Documentation (L576–L582) have no Copilot
  harness pointer. **AGENTS.md** layout omits `skills/`.
- **Versions.** `.claude-plugin/plugin.json`, `package.json`, `extension/package.json`
  are `0.7.0`, and `extension/package-lock.json` L3 and L9 too;
  `tests/customizations.test.mjs` L990–L999 asserts the three manifests are equal.
  CHANGELOG.md has `## Unreleased` (L3) above `## 0.7.0 (2026-10-02)` (L362) and no
  Copilot-harness entry.
- **Prose rules.** `tests/customizations.test.mjs` enforces the canonical
  `/agento <name>` spelling in repository prose, and `tests/harness-probe/probe.test.mjs`
  checks every relative link in docs/copilot-harness.md.

### Acceptance environment

- The router link `~/.copilot/skills/agento` → `/home/david/DP/agento-plugin/skills/agento`;
  that clone is the registered `chat.pluginLocations` entry and was 8 commits behind
  `origin/main` on 2026-10-17 (fast-forward approved in `## Decisions`).
- `/home/david/DP/soshiki` is on `main`, in sync with `origin/main`, clean.

### Baselines (`main` `1f0d3de`, 2026-10-17)

- **Lint (policy §5).** The full-repository lint is `shellcheck scripts/hooks/*.sh
  scripts/wait-for-checks.sh` (AGENTS.md). `shellcheck` is not installed locally
  (`command -v shellcheck` finds nothing); the authoritative baseline is CI's
  Shellcheck step: `ci` run `39054365546` on `1f0d3de` concluded `success`, zero
  findings.
- **Node suite.** CI's "Unit tests" step (`node --test 'scripts/**/*.test.mjs'
  'tests/**/*.test.mjs'`) in the same run `39054365546` on `1f0d3de`: tests 565,
  pass 565, fail 0, cancelled 0, skipped 0. That is the pass-count baseline; the
  Builder's local runs compare against it.
- **Overlap decision:** none. This delivery touches no shell script and no code, so
  no lint cleanup is in scope. The gate is the full-repository Shellcheck in the PR's
  CI compared against the zero-finding baseline, the full node suite (customizations
  and probe link tests guard the prose and versions), the five guard replays, and
  the extension build and unit tests (the extension version changes).

### Concurrent delivery

`gh pr list --state open` returned no open PRs in `david-perry-software/agento` or
`david-perry-software/agento-docs` on 2026-10-17: no file overlap.

## Approach

Docs-only and metadata-only; no file under `scripts/`, `extension/src/`, `hooks/`,
`.github/`, `skills/`, or `commands/` changes.

1. **Docs (Phase 1).** One step per file so each commit is reviewable:
   docs/install.md (new Copilot harness section + per-harness verification),
   docs/hooks.md, docs/architecture.md, docs/extension.md, docs/commands.md
   (`harness` CLI entry, doctor list, per-harness invocation), docs/model-profiles.md
   (`copilotModel`, `task`), docs/copilot-harness.md (shipped wording and the two
   reconciliations), README.md + AGENTS.md (pointers and layout). Each claim is
   checked against the cited code before it is written; docs/copilot-harness.md
   stays the observation record and the other docs link to it rather than copying
   its tables.
2. **Release metadata (Phase 2).** `0.8.0` in the three manifests and the two
   `extension/package-lock.json` root entries; a CHANGELOG **Added** entry summarising
   the initiative, then `## Unreleased` becomes `## 0.8.0 (<build date>)`.
3. **Acceptance (Phase 3).** Run the full local gate; fast-forward the plugin clone
   the router link resolves to and confirm `harness status` / doctor `harness`; open a
   throwaway soshiki planning session from the CLI; the user runs the six definition-
   of-done checks in Copilot and then Local (manual: only the user can set the
   Session Target and type into VS Code chat; screenshots under `evidence/`); the
   Builder abandons the session with `close-session` and records the results table
   in docs/copilot-harness.md.
4. **Final gate (Phase 4).** Integrate `origin/main`, rerun everything, and wait for
   CI (Shellcheck included) with `scripts/wait-for-checks.sh`.

Verification targets: no step serves a web UI; the user-visible checks are VS Code
chat sessions in soshiki (manual, §1 — the agent cannot set Session Target or type
into the VS Code chat), each with linked screenshots.

## Risks

- **Docs drift from code.** Mitigation: every step cites the file/line it documents;
  the Reviewer re-checks claims against `main`.
- **Prose trips the customizations tests** (an old command form, a broken relative
  link). Mitigation: each Phase 1 step's `verify:` runs the customizations test (and
  the probe link test for docs/copilot-harness.md).
- **The plugin clone cannot fast-forward** (local commits or a dirty tree, e.g. a
  model profile). Mitigation: `--ff-only`; on failure the Builder stops and reports
  instead of resetting anything (blocker pause).
- **The acceptance tests `main`'s behavior, not this branch.** That is intended: the
  branch changes docs and versions only, and every behavior under test shipped with
  the earlier members.
- **The throwaway soshiki session leaves state.** Mitigation: the Planner is stopped
  at its first question (before any branch exists); 3.7 closes the session and
  verifies no worktree or branch remains in soshiki or soshiki-docs.
- **The hook-file check could create `.github/hooks/x.json` in soshiki** if the
  approval is accepted. Mitigation: the user denies it; the step verifies soshiki's
  `git status --porcelain` is empty.
- **Copilot turns are slow** (~4–12 min per `/agento` turn, docs/copilot-harness.md).
  Mitigation: a check passes once its receipt or verdict is visible; the user may
  stop the turn after that.
- **The CHANGELOG date is the build date**, which can differ from the merge date.
  Mitigation: accepted; the heading is re-dated in a later step if the build spans
  days.
- **Concurrent delivery.** No open PRs. Mitigation: integrate `origin/main` before
  every push.

## Out of scope

- Any runtime change: scripts, hooks, the router skill, agents, commands, the
  extension source.
- Completing the dispatch matrix V2–V8 or other live probing (only wording
  reconciliations).
- Restoring Local's prompt-level model switching lost to the router takeover (it is
  documented, not fixed).
- An extension install action for the router link.
- Other review follow-ups not named in `## Decisions` (guard diagnostic hardening,
  primary-window extension UI, soshiki `wait-for-checks.sh`).
- Claude and Codex harnesses; deleting `.github/prompts/`.

## Acceptance checklist

- [ ] docs/install.md has a Copilot harness section covering `harness install
  --plugin-root`, `status`, `uninstall`, `install --force`, the Local takeover and
  its model-switch gap, and per-harness verification including the doctor `harness`
  check — verified by reading the section against `scripts/agento.mjs` L1014–L1028
  and L4661–L4680.
- [ ] docs/hooks.md, architecture.md, extension.md, and commands.md each describe the
  Copilot harness as listed in roadmap steps 1.2–1.5, and commands.md's doctor list
  includes `hook-wiring` and `harness` — verified by reading each section and the
  step's grep.
- [ ] docs/model-profiles.md documents `copilotModel` and the `runSubagent`/`task`
  rule — verified by reading the `models pins` paragraph against
  `agento.mjs models pins` output.
- [ ] docs/copilot-harness.md states the dispatch "predates the router" point as a
  hypothesis, reconciles the ask-user contexts, and has a two-harness acceptance
  section with 12 dated rows — verified by reading the file.
- [ ] README.md links docs/copilot-harness.md and names `harness install`; AGENTS.md
  layout lists `skills/` — verified by grep.
- [ ] `.claude-plugin/plugin.json`, `package.json`, `extension/package.json`, and both
  `extension/package-lock.json` root entries are `0.8.0` — verified by grep and the
  customizations version-parity test.
- [ ] CHANGELOG.md's first heading is `## 0.8.0 (<date>)` with a Copilot-harness
  **Added** entry, and no `## Unreleased` heading remains — verified by
  `grep -n "^## " CHANGELOG.md`.
- [ ] The node suite passes with a pass count ≥ the baseline; the five guard replays,
  the extension build, and `npm run test:unit` exit 0 — verified by fresh runs.
- [ ] PR CI is green, Shellcheck with zero findings (scoped gate vs the zero-finding
  baseline) — verified by `scripts/wait-for-checks.sh pr <n>`.
- [ ] `harness status` reports `installed` and doctor's `harness` check is `ok` for
  `/home/david/DP/agento-plugin` at its `origin/main` — verified by the CLI output
  recorded on step 3.2.
- [ ] In soshiki, Copilot session: `/agento delivery-status` prints its receipt, the
  `Agento CLI:` line is present, an agent-typed `git push origin main` is denied,
  editing `.github/hooks/x.json` asks for approval, `/agento new-feature` runs in the
  Planner, and dashboard dispatch works — verified by the linked step 3.4/3.5
  screenshots.
- [ ] The same six checks pass in a Local session — verified by the step 3.6
  screenshots.
- [ ] The throwaway soshiki session is closed with no leftover worktree or branch,
  and soshiki's primary checkout is clean — verified by `git worktree list`,
  `git ls-remote`, and `git status --porcelain`.
- [ ] No file outside docs/, README.md, AGENTS.md, CHANGELOG.md, and the version
  fields changed — verified by `git diff --stat origin/main...HEAD`.
