# Preflight call: one agento.mjs call returns session, window verdict, doctor, resolve, config, and op-id

## Problem

This is member `### preflight-call` of the
[spend-reduction](../../../../initiatives/2026/10/spend-reduction/breakdown.md)
initiative (wave 1, size M). Brief: "`agento.mjs preflight <command> [<type> <slug>]`
returning session, window-check verdict (with allowed/elsewhere), doctor for that
command, resolve, config, and the op-id; every prompt/agent switches to it; update
the `doctor --for` test, the needs-table test, and §9–§11 wording."

Today every `/agento …` command opens with 3–4 separate CLI round-trips before any
work: `agento.mjs session` (the §11 window check), `agento.mjs doctor --for
<command>` (the §10 capability preflight), `agento.mjs resolve <type> <slug>` (or
`find <slug>`) for slug commands, and `git rev-parse --short HEAD` for the §9
operation ID. Each round-trip re-sends the full conversation context; in an agent
loop that cost is paid on every tool-call turn. The breakdown's research measured
"3–4 tool round-trips before any work" and 18 prompts running `doctor --for` plus
13 prompts/agents calling `session`.

After this feature, every prompt and agent opens with one
`node <agento-root>/scripts/agento.mjs preflight <command> [<type> <slug>]` call
that returns all of that in a single JSON document, including ready-to-print §9
receipt and preflight lines. `doctor --for` and the other subcommands stay
available, so the extension and any external consumer are unaffected.

## Decisions

The questions were asked with the ask-questions tool. The user picked the
recommended option for every question:

- **Q1 (preflight-output): How should `agento.mjs preflight` combine session,
  window-check verdict, doctor, resolve, config, and op-id into one result?**
  A: "Named sections (recommended)" — one JSON object whose keys (`session`,
  `window`, `doctor`, `resolve`, `config`, `opId`) each carry the verbatim output
  of the existing subcommand; easiest to test and reuse. Not chosen: "Flattened
  object"; "NDJSON stream".
- **Q2 (receipt-format): Should `preflight` return the §9 receipt/preflight lines
  ready to print, or raw data only?** A: "Ready-to-print lines (recommended)" —
  preflight returns `receipt` and `preflightLines` strings matching §9 spellings
  exactly, so agents/prompts print them verbatim and cannot drift. Not chosen:
  "Raw data only".
- **Q3 (rollout-breadth): Which prompts and agents switch to `preflight` in this
  delivery?** A: "All at once (recommended)" — every prompt and agent opens with
  one `agento.mjs preflight` call, enforced by a new customizations test. Not
  chosen: "Prompts first"; "Hot path only".
- **Q4 (doctor-fate): What happens to the standalone `doctor --for` subcommand
  after `preflight` exists?** A: "Keep standalone (recommended)" — additive:
  preflight embeds the same checks in-process, while `doctor --for` stays for the
  extension and direct use. Not chosen: "Deprecate it".

## Research

Skills consulted: agent-customization (built-in) — prompts are `*.prompt.md` in
`.github/prompts/`, custom agents are `*.agent.md` in `.github/agents/`, both with
YAML frontmatter and a `description`; the first two body lines are the `Needs:` /
`Fallback:` declarations this feature leaves untouched. The repository has no
`.agents/skills/` and no skills table in AGENTS.md (matching the breakdown's note).

### CLI structure (all in `scripts/agento.mjs` unless noted)

- The subcommand dispatch is a `switch (command)` at L3210. Existing cases:
  `config` (L3211), `resolve` (L3224), `find` (L3232), `status`, `close-decision`,
  `ship-preflight`, `ports`, `paths`, `workspace`, `initiative`, `metrics`,
  `session` (L3391), `start-session`, `close-session`, `ship`, `doctor` (L3412),
  `dashboard`, `next`, `migrate`, `models`, `release`.
- The building blocks to compose are all in-process functions:
  `sessionRecord()` (L~705), `doctorDocument(command)` (L3045), the `config` case's
  document, and `resolveWithLayout(type, slug)` (L298) + `withLayout` (L306) for
  `resolve`. `deriveAllowed` lives in `scripts/session-state.mjs` L427 and already
  returns `allowed`/`elsewhere`; `capabilityOf(checkId)` is at L1465.
- `COMMAND_NEEDS` (L1048) maps each command name to its §10 `Needs:` capabilities;
  `checksFor(needs)` (L1069) turns those into doctor check ids. `doctorDocument`
  emits `{ status, for: { command, needs } | null, checks[], root, configSource }`.
- `ship()` (L2000) is the existing model: it runs
  `runDoctor(checksFor(COMMAND_NEEDS.ship))` in-process, rejects on a hard `fail`
  with the §9 preflight rejection, and reports warn checks in `preflight[]`.
  `SHIP_EXIT` (L1970) maps `{ ok: 0, pending: 2, rejected: 3, blocked: 3, failed: 3 }`.
- There is **no** operation-ID helper today: each receipt is assembled by the
  prompt/agent running `git rev-parse --short HEAD` and formatting
  `<command>:<subject>:<short-sha>` itself (§9). `preflight` will own this.

### Prompts and agents to rewire

- 25 prompts in `.github/prompts/` (list confirmed on disk) and 6 agents in
  `.github/agents/` (`copilot-mechanic`, `delivery-autopilot`, `delivery-builder`,
  `delivery-planner`, `delivery-reviewer`, `initiative-architect`).
- 18 prompts need `gh`/`code`/`network` and today run `doctor --for <name>`; the
  customizations test "exactly the commands that need gh, code, or network run
  doctor --for themselves" (`tests/customizations.test.mjs` L501) enumerates them
  and must be rewritten to assert the single `preflight` call instead.
- 13 prompts and agents call `agento.mjs session` for their window check; several
  agents additionally call `agento.mjs resolve <type> <slug>` and `agento.mjs
  config` in their bodies (e.g. `delivery-builder.agent.md` L22, L125).

### Tests that constrain the change

- `tests/customizations.test.mjs`:
  - L290–L310: "…is one agento.mjs … call with no hand-run fallback procedure"
    for `start-session`, `close-session`, and `ship` — the model for a sibling
    `preflight` test.
  - L378–L398: every prompt/agent declares `Needs:`/`Fallback:` from the §10
    vocabulary (unchanged by this feature).
  - L501–L510: the `doctor --for` test (must become a `preflight` test).
  - L514–L522: "the CLI needs table agrees with every prompt's Needs: line" via
    `agento.mjs doctor --for <name>` — stays valid because `doctor --for` stays.
  - L538+: the canary list. `Receipt: accepted`, `Receipt: rejected`, `^Preflight:`,
    `; fallback: <`, and `duplicate of <op-id>` may appear only in the policy file,
    so prompts/agents must never spell these — the CLI returns the strings.
- `scripts/agento.test.mjs`: the usage test (~L1420) asserts the usage header lists
  `session [--pr]`, `worktrees`, and `doctor [--for <command>]`; the doctor tests
  (L1443+) assert the nine-check list, `--for` filtering, and fail/warn exits.
  A new `preflight` subcommand needs both a usage line and its own tests.

### Lint baseline (2026-10-12, `3582bdb`)

| Command | Exit | Findings |
| --- | --- | --- |
| `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | 0 | 447 tests, 447 pass, 0 fail |
| `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` | 0 | none |
| `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` | 0 | none |
| `git ls-files '*.sh' \| xargs pnpm dlx shellcheck` | 0 | none |

The baseline is green, so there is no overlap to clean up and the **full gate**
applies: every command above must stay at exit 0 with no new findings. (`shellcheck`
is not installed locally; `pnpm dlx shellcheck` is the documented substitute.)

### Open deliveries

`gh pr list --state open` returned `[]`, so no other delivery branch is open and
there is no concurrent file overlap today. `policy-on-demand` (the wave-1 sibling)
is `complete` and merged; this feature edits only §9–§11 wording, which that
delivery left intact.

## Approach

1. **New `preflight` subcommand (additive).**
   `node scripts/agento.mjs preflight <command> [<type> <slug>]` composes, in one
   process, the existing in-process functions and returns one JSON document:
   `{ status, command, opId, subject, session, window, doctor, resolve, config,
   receipt, preflightLines, root, configSource }`.
   - `session`: `sessionRecord()` verbatim.
   - `window`: a new `windowVerdict(command, record)` — `{ role, required, match,
     allowed, elsewhere, reject }` derived from a new `WINDOW_ROLES` table (command
     → required role plus the §11 branch/clean conditions) and `deriveAllowed`.
   - `doctor`: `doctorDocument(command)` verbatim (`status` `ok` | `warn` | `fail`).
   - `resolve`: `resolveWithLayout(type, slug)` when `<type> <slug>` are given,
     else `null`.
   - `config`: the same document the `config` case emits.
   - `opId` / `subject`: a new `opId(command, subject)` helper computing
     `<command>:<subject>:<short-sha>` per §9; `subject` is the slug when the
     command takes one and one was passed, else the managed session id, else the
     branch name, else `HEAD`.
   - `receipt` / `preflightLines`: strings in the exact §9 spellings — `Receipt:
     accepted <op-id>`, `Receipt: rejected — …`, `Preflight: <capability>
     <warn|missing> — <fallback>`. A hard doctor `fail` or a window mismatch yields
     the rejected receipt and exit 3; warn checks yield `preflightLines` and
     exit 0. `doctor --for` remains callable and unchanged.
2. **`WINDOW_ROLES` table.** Encode the per-command "Window check per §11:
   requires role …" lines (currently prose in each prompt/agent, including the
   branch conditions of §11 step 5) so the CLI can return the verdict instead of
   each prompt comparing `session.role` by hand.
3. **Rewire prompts and agents.** Replace each file's opening
   `session`/`doctor --for`/`resolve`/`rev-parse` calls with one
   `node <agento-root>/scripts/agento.mjs preflight <name> [<type> <slug>]` call,
   then print the returned `receipt`/`preflightLines` verbatim. The `Needs:` /
   `Fallback:` declarations and the `Policy:` read line stay unchanged. Files:
   all 25 `.github/prompts/*.prompt.md` and all 6 `.github/agents/*.agent.md`
   (plus their `commands/<name>.md` mirrors, which must stay byte-identical).
4. **Policy wording (§9–§11).** In
   `.github/instructions/delivery-policy.instructions.md`, update only: §9's op-id
   derivation (now returned by the CLI), §10's "When `doctor` runs" paragraph (the
   preflight call runs the doctor checks), and §11 step 1 (run `preflight` instead
   of `session`). Every `## N.` anchor and all spellings stay.
5. **Tests.**
   - `scripts/agento.test.mjs`: add a `preflight` test group — output shape with
     the named sections, op-id derivation, `window` verdict rows (match/mismatch),
     `resolve` embedding for slug commands and `null` without a slug, `receipt` /
     `preflightLines` strings, and exit codes (0 ok/warn, 3 fail/rejected); add the
     usage line and assert it in the usage test.
   - `tests/customizations.test.mjs`: rewrite the L501 `doctor --for` test into a
     "every command that needs gh/code/network opens with one `agento.mjs
     preflight <name>` call and no hand-run `session`/`doctor --for`/`resolve`"
     test; keep the L514 needs-table test; add a `WINDOW_ROLES` agreement test that
     compares the CLI table against each file's "Window check per §11: requires
     role" line.
6. **Extension copy and docs.** Regenerate `extension/cli/` with
   `cd extension && npm run copy-cli`; add the subcommand to the CLI usage header
   (first 30 lines of `scripts/agento.mjs`) and the CLI listing in
   `docs/commands.md`; add a `CHANGELOG.md` entry.

## Risks

- **The canary test forbids restating receipt spellings.** `Receipt: accepted`,
  `Receipt: rejected`, `^Preflight:`, and `; fallback: <` may appear only in the
  policy. *Mitigation:* prompts/agents print the CLI-returned `receipt` /
  `preflightLines` strings and never spell them; the new customizations test
  asserts the `preflight` call and does not introduce canaries.
- **`WINDOW_ROLES` could drift from the prose it replaces.** The window check
  today includes branch conditions (§11 step 5). *Mitigation:* a customizations
  test compares the table against each file's window-check line, exactly like the
  needs-table test keeps `COMMAND_NEEDS` honest.
- **One larger call could hide an intermediate failure.** *Mitigation:* `preflight`
  returns the ship-style contract (named sections plus `status` and exit 3 on
  rejection), so a doctor fail or a window mismatch is surfaced, not swallowed; the
  §9 idempotency and receipt semantics are preserved.
- **The `git-remote` doctor probe is a network call** (`git ls-remote origin`) and
  now runs inside every command's single call. This is the same probe the current
  `doctor --for` already performs, so there is no latency regression versus today.
- **Concurrent edits.** No delivery PRs are open today. `policy-on-demand` is
  merged and left §9–§11 intact; integrate `origin/main` by merge before every push
  (§7) as usual.

## Out of scope

- The other initiative members (`builder-step-cli`, `publish-cli`).
- Trimming prompt or agent prose; changing model pins; a Reviewer probe subagent.
- Extension changes beyond regenerating `extension/cli/`.
- Changing the receipt spellings, the §8 window boundaries, or the §9 idempotency
  table semantics.

## Acceptance checklist

- [ ] `node scripts/agento.mjs preflight new-feature` in the primary checkout
  returns the named sections `session`, `window`, `doctor`, `resolve`, `config`,
  `opId` plus `receipt` and `preflightLines`, and exits 0.
- [ ] `preflight` exits 3 (rejected) on a hard doctor `fail` or a window-role
  mismatch, with a receipt line in the exact §9 spelling.
- [ ] Every `.github/prompts/*.prompt.md` and `.github/agents/*.agent.md` opens
  with one `agento.mjs preflight` call and performs no separate `session`,
  `doctor --for`, `resolve`, or `rev-parse` for its own window check (asserted by
  the new customizations test).
- [ ] `node --test tests/customizations.test.mjs` passes, including the updated
  doctor→preflight test, the unchanged needs-table test, and the new
  `WINDOW_ROLES` agreement test.
- [ ] `node --test scripts/agento.test.mjs` passes, including the new `preflight`
  subcommand tests.
- [ ] `doctor --for <command>` still works standalone and unchanged.
- [ ] Full gate green: `node --test 'scripts/**/*.test.mjs'
  'tests/**/*.test.mjs'` (447+ tests, 0 fail), both replay-guard runs exit 0,
  `shellcheck` exits 0, and `cd extension && npm run copy-cli && npm run
  test:unit` passes.
