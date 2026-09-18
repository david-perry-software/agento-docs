# Copyable command blocks in chat output

## Problem

Whenever an Agento agent or command tells the user to run a `/agento …` command —
the `next:` of every §9 result line, the §8 cross-window handoff (review here, ship
from the primary window), the Builder's pause resume point, `/agento continue`
naming the command for another window, `/agento next-feature`'s "exact commands"
report, `/agento ship`'s reject-back-to-the-build-window handoff, the alternatives in
a `Receipt: rejected — …; allowed: …` line — it is written inline in backticks or in
plain prose. VS Code chat renders a one-click **Copy** button only on fenced code
blocks, not on inline code, so the user has to select the text by hand every time
(and often picks up the surrounding punctuation). The one place that already uses a
fenced block, `/agento next-feature`
(`.github/prompts/next-feature.prompt.md` L42–48), puts five commands plus trailing `# comments` in a single block, so the
copy button copies all of them at once — unusable as a paste.

User-visible effect after this delivery: every command the user is asked to run
*now or next* appears in its own fenced code block containing exactly that command
and nothing else, so one click on the block's copy button yields a paste-ready
command. Descriptive mentions of commands stay inline; repository prose (README,
docs, templates) is unchanged.

## Decisions

Clarifying questions asked in this planning session (ask-questions tool unavailable;
§10 fallback — numbered list in chat) and the user's answers, verbatim:

1. **Which surfaces are in scope?** (a) Only chat output from Agento agents/prompts
   (handoffs, `next:` commands, step-by-step instructions, "run this in the primary
   window", `/agento next-feature`'s report) — or (b) also repository prose (README,
   docs/, templates) rendered on GitHub? My default: (a) only; repo prose keeps
   inline backticks.
   **A:** `a`
2. **The §9 `Result:` line must stay a single last line.** Do you want the `next:`
   command (i) kept inline in the `Result:` line *and* repeated in a fenced block
   immediately above it, or (ii) the `Result:` line itself changed so that `next:` is
   followed by a fenced block (breaking "last line" and every existing test/canary)?
   My default: (i).
   **A:** `i`
3. **Block shape.** One command per fenced block (one-click copies exactly one
   command), no language tag (so VS Code does not offer "Run in terminal" for a chat
   command) — or a tag such as `text`? Multi-step handoffs (§8: review here, then
   ship in the primary window) become a numbered list with one block per step.
   Confirm or adjust.
   **A:** `confirm`
4. **Does "even just mentioned" literally include every passing mention** (e.g. "the
   Builder never runs `/agento ship`", the redirect sentence "Reading
   `/agento x.prompt` as `/agento x`", the `allowed:` list in a `rejected` receipt)?
   Or only commands the user is being told to run *now or next*? My default: only
   actionable commands (to run now/next, including every entry in a `rejected`
   receipt's `allowed:` list); descriptive mentions stay inline.
   **A:** `No, only when you want me to run it`
5. **Where should the rule live and how strictly enforced?** Proposal: a new
   "Command presentation" section in `delivery-policy.instructions.md` (agents/prompts
   cite `§N`, never restate) or a section in `command-invocation.instructions.md`;
   plus a `tests/customizations.test.mjs` check that every agent and
   command-emitting prompt cites it. Preference, and should the test also scan for
   specific wording as a canary?
   **A:** `default`

Derived from the answers: the rule is policy §12 "Command presentation" in
`delivery-policy.instructions.md`; the §9 `Result:` line is untouched and stays the
last line, with the `next:` command repeated in a fenced block directly above it;
one command per block, no language tag; a `rejected` receipt's `allowed:` list is
also emitted as blocks (the user is being offered those to run); the customizations
test requires every agent and every prompt that names a command for the user to
cite §12 and treats the section's distinctive wording as a canary.

## Research

Skills consulted: none — no matching domain (`ls -d .agents/skills` → absent;
AGENTS.md has no `## Agento` skills table).

### How commands reach the user today (product checkout at `origin/main` `1b874bd`)

Paths below are relative to the product checkout (`david-perry-software/agento`).

- **Policy §8 cross-window handoff**
  (`.github/instructions/delivery-policy.instructions.md` L150–166): "Every Builder completion, Reviewer verdict, and Autopilot stop ends
  with the exact commands" — a two-item numbered list with inline-backtick commands.
- **Policy §9 result line** (same file, L207–216): `Result: completed — <state>;
  next: <command>` is "the last line of the response"; the `Result: completed` /
  `Result: failed` spellings are canaries in `tests/customizations.test.mjs`
  L267–279 (may appear only in the policy file). The `Receipt: rejected — …;
  allowed: <cmd>[, <cmd>…]` receipt (L188–192) lists alternatives copied from
  `agento.mjs session` `allowed[]`/`elsewhere[]`.
- **Agents** (`.github/agents/`): Builder completion cites §8 and makes the first
  command the `next:` (`delivery-builder.agent.md` L126–130) and its pause protocol
  reports "the exact resume point" (L110–116); Reviewer step 8
  (`delivery-reviewer.agent.md` L106–110); Autopilot loop step 4 and "never run
  ship" rule (`delivery-autopilot.agent.md` L40–42, L80–83); Planner step 9 "Offer
  the **Build in this worktree** handoff … `/agento build-<type> <slug>` is the
  `next:`" (`delivery-planner.agent.md` L180–190); Architect step naming
  `/agento next-feature <slug>` (`initiative-architect.agent.md` L133).
- **Prompts** (`.github/prompts/`, byte-mirrored in `commands/`): `next-feature`
  L40–51 (multi-command fenced block, then `/agento start-session` →
  `/agento new-feature …` pairs inline); `continue` L72–76 and L101 ("name
  `next.invocation` as the command to run there"); `ship` L142–147 (hard-reject
  `next:` names `/agento review-<type>`, `/agento build-<type>`, or
  `/agento start-session … --resume`) and L223 (`paused at teardown … next: close
  that VS Code window, then /agento ship <slug>` — its wording is a canary that only
  `ship.prompt.md` may carry, test L280–287); `start-freehand` L95–98 (follow-up
  commands); `close-session` L129–132 (`/agento finish-freehand`,
  `/agento start-freehand <slug> --resume`); `new-feature` L66–70 and `new-issue`
  L80–85 (Build-in-this-worktree offer, `/agento ship <slug>`); `doctor` L34–36
  (`next:` is `/agento doctor` again or the command the user was about to run);
  `quick-fix` L35 ("Stop and name the right command instead of proceeding").
- **CLI**: `agento.mjs next` already returns `next.invocation` and
  `candidates[].invocation` as ready-to-paste strings (`scripts/session-state.mjs`
  L343–360);
  the session record's `allowed[]`/`elsewhere[]` likewise. No CLI change is needed —
  presentation is a prompt/agent concern.
- **Docs that describe the response format**: `docs/commands.md` `## Receipts`
  (L199–206) and `docs/architecture.md` L49–50; `README.md` has no receipt/result description (grep `Receipt:|Result:` →
  no hits).

### Test infrastructure the delivery extends

`tests/customizations.test.mjs`:

- L152–161 "policy section references (§N) point at sections that exist" parses
  `^## (\d+)\. ` headings and asserts `sections.size >= 11` — a new `## 12.`
  heading makes `§12` citable.
- L163–169 / L171–177: every prompt and agent body must match `§9\b` and `Window
  check per .*§11.*requires role` — the pattern to copy for a `§12` citation check.
- L262–288 "the policy file is the only place the shared rules are spelled out":
  the `canaries` array scanned over agents/prompts/instructions except the policy
  file — the new section's distinctive phrase goes here.
- L318–330 "active guidance qualifies Agento slash commands with the plugin name"
  and L332–347 (no `.prompt`/`.md` suffix) scan `guidanceFiles` — fenced blocks
  containing `/agento <name> …` satisfy both as long as the plugin name is present.
- L380–397: `commands/<name>.md` must be byte-identical to
  `.github/prompts/<name>.prompt.md`; `.claude-plugin/plugin.json` version must
  equal `package.json` version.
- `/agento ship`'s audit (ship.prompt.md L128–132) expects a
  `## <version> (unreleased)` CHANGELOG heading when the version changes; the top
  of `CHANGELOG.md` is `## 0.5.0 (2026-09-18)`
  (released), so this delivery adds `## 0.5.1 (unreleased)` and bumps both version
  fields.

### Lint baseline (policy §5)

Run in this planning worktree at `origin/main` `1b874bd`, each in a
status-capturing wrapper (the `shellcheck` glob was spelled out per file because the
delivery guard blocks a combined redirect + hook-glob command line):

| Command | Exit | Findings |
| --- | --- | --- |
| `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | 0 | 203 tests, 203 pass, 0 fail |
| `shellcheck scripts/hooks/delivery-guard.sh scripts/hooks/replay-guard.sh scripts/hooks/session-context.sh scripts/wait-for-checks.sh` | 0 | none |
| `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` | 0 | all fixtures match |
| `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` | 0 | all fixtures match |

Baseline is green with no findings, so there is nothing to overlap: the gate for this
delivery is the **full** baseline rerun (all four commands, same exit codes, test
count ≥ 203 plus the tests this delivery adds) at the end of every phase and before
`status: in-review`. No scoped gate is needed.

### Concurrent deliveries

`gh pr list --state open` in both the product and the companion repository → `[]`.
No open delivery branches, so no file overlap to sequence around; the standard rule
(integrate `origin/main` by merge before every push) is the only mitigation.

## Approach

Presentation only: no CLI, hook, or config change. The rule is written once in the
policy, cited from every agent and prompt, and the concrete handoff texts are
rewritten to emit blocks.

### 1. Policy §12 "Command presentation" (`.github/instructions/delivery-policy.instructions.md`)

New section after `## 11. Window check`, plus "command presentation" appended to the
frontmatter `description` enumeration. Content, in the policy's register:

- **Rule.** Every `/agento …` command the response asks the user to run — now, next,
  or in another window — is emitted in its own fenced code block containing exactly
  that one command (with its arguments substituted), no language tag, no comment, no
  prompt character, nothing else. VS Code chat puts a one-click copy button on such
  a block; inline code has none. This is the *copyable command block*.
- **Where it applies.** The `next:` command of the §9 result line (repeated in a
  block directly above the result line — the result line itself is unchanged and
  stays the last line); each command of the §8 cross-window handoff (a numbered
  list, one block per item, the window named in the item's prose); the resume
  command of a pause; each `allowed:`/`elsewhere` alternative of a `rejected`
  receipt (the receipt line stays a single first line; the blocks follow it); the
  command `/agento continue` names for another window; the "exact commands" of
  `/agento next-feature`; `/agento ship`'s reject-back handoff and teardown pause;
  the Build-in-this-worktree offer's `/agento build-<type> <slug>` alternative.
- **Where it does not apply.** Descriptive mentions (what a command does, what an
  agent never runs, the redirect sentence, table rows, headers) stay inline in
  backticks; repository prose (README, docs, templates) is out of scope. Raw shell
  commands the *agent* runs itself are never presented as copyable blocks — they are
  the agent's work (§1), not the user's.
- **Ordering.** When several blocks appear, they are in execution order and each is
  preceded by one line saying where/when to run it (e.g. "In this window:", "From
  the primary window, after approval:").

### 2. Agents (`.github/agents/*.agent.md`)

Each of the six agents gains a one-clause citation ("commands for the user are
presented per policy §12") at the point where it names commands, and the handoff
wording is adjusted so it produces blocks:

- `delivery-builder.agent.md`: completion (L126–130) and pause protocol (L110–116).
- `delivery-reviewer.agent.md`: step 8 (L106–110).
- `delivery-autopilot.agent.md`: rules bullet L40–42 stays descriptive (inline);
  loop step 4 (L80–83) and `## Reporting` emit blocks.
- `delivery-planner.agent.md`: step 9 (L180–190) — the Build-in-this-worktree offer
  plus a `/agento build-<type> <slug>` block and, for the abandon path,
  `/agento close-session <type>/<slug>` stays descriptive.
- `initiative-architect.agent.md`: L133 `/agento next-feature <slug>` as a block.
- `delivery-mechanic.agent.md`: §12 citation only (its `next:` is a block like every
  other response).

### 3. Prompts (`.github/prompts/*.prompt.md`) and the `commands/` mirror

Every prompt gains the §12 citation in its receipt paragraph (the one that already
cites §9 and §11). Prompts whose text names commands for the user are rewritten:

- `next-feature.prompt.md` L40–51: replace the five-line block with a numbered list —
  one line of prose per step naming the window, then a block holding exactly one
  command (`/agento start-session`; `/agento new-feature initiative:<i>/<f>`;
  `/agento build-feature <f>` with the Build-in-this-worktree alternative in prose;
  `/agento review-feature <f>`; `/agento ship <f>`) — and the "other ready members"
  paragraph emits one block per `/agento new-feature initiative:<i>/<f>` (the
  `/agento start-session` step is stated once in prose since it is identical).
- `continue.prompt.md` L72–76, L101, and step 5: `next.invocation` (and `then`) as a
  block.
- `ship.prompt.md` L142–147 and L223: the hard-reject `next:` command and the
  teardown-pause resume command as blocks (the canary sentence `paused at teardown`
  itself is unchanged).
- `start-freehand.prompt.md` L95–98, `close-session.prompt.md` L129–132,
  `new-feature.prompt.md` L66–70, `new-issue.prompt.md` L80–85, `doctor.prompt.md`
  L34–36, `quick-fix.prompt.md` L35 ("name the right command" → as a block),
  `agento-init.prompt.md` L57.
- Every edited prompt is copied byte-for-byte to `commands/<name>.md`.

### 4. Tests (`tests/customizations.test.mjs`)

- Bump `sections.size >= 11` to `>= 12`.
- New test "every command and agent cites the §12 command presentation rule":
  every prompt and agent body matches `§12\b`.
- Add the §12 distinctive phrase (`copyable command block`) to `canaries` so only
  the policy file spells it out.
- New test "next-feature prints one command per fenced block": parse the
  `next-feature.prompt.md` body's fenced blocks and assert each contains exactly one
  non-empty line starting with `/agento ` and no `#` comment — the regression guard
  for the only pre-existing multi-command block.
- Existing tests keep passing unchanged: bare-command and suffix scans (blocks still
  read `/agento <name>`), `commands/` mirror, §9/§11 citations.

### 5. Docs and changelog

- `docs/commands.md` `## Receipts` (L199–206): one sentence — commands the user is
  asked to run are also emitted as one-command fenced blocks (policy §12) so chat
  offers a copy button.
- `docs/architecture.md` L49–50: append "commands for the user as copyable blocks".
- `CHANGELOG.md`: `## 0.5.1 (unreleased)` entry; `package.json` and
  `.claude-plugin/plugin.json` `version` → `0.5.1`.

### Verification

Everything is text plus `node --test`; no served UI, so no `local:<ports>` target.
The one user-visible check — that the rendered block carries a copy button — is
performed by the Builder by sending `/agento doctor` in this worktree's chat and
capturing the rendered response with a one-command block and its hover copy button
to `evidence/step-4-2-copy-button.png`; the Reviewer repeats it independently.

## Risks

- **Canary collision.** The §12 phrase added to `canaries` must not already occur in
  any agent/prompt/instruction file, or the existing test fails on day one.
  *Mitigation:* roadmap step 1.1 greps for the phrase before writing the section.
- **`Result:` line drift.** Rewriting handoffs could tempt a multi-line result.
  *Mitigation:* §12 states explicitly that the result line is unchanged and last;
  the existing `Result: completed`/`Result: failed` canaries and `docs/commands.md`
  wording are untouched.
- **Blocks with a language tag** would make VS Code offer "Run in terminal" for a
  chat command. *Mitigation:* §12 mandates no tag; the next-feature block test
  asserts the fence is bare (` ``` ` followed by newline).
- **Mirror drift.** Every prompt edit must be mirrored into `commands/`.
  *Mitigation:* existing byte-identity test; each roadmap step's `verify:` runs the
  suite.
- **Concurrent deliveries.** None open at planning time; integrate `origin/main`
  before every push regardless.
- **Version bump and ship audit.** Bumping to `0.5.1` requires the `(unreleased)`
  CHANGELOG heading that `/agento ship` stamps; both version fields must match
  (test L390–391). *Mitigation:* one roadmap step does both together.

## Out of scope

- Repository prose (README, docs, templates, AGENTS-section) — commands there stay
  inline (Decision 1).
- Changing the §9 receipt/result line spellings or their single-line form
  (Decision 2).
- Descriptive mentions of commands, the redirect sentence, table rows (Decision 4).
- Any CLI (`agento.mjs`), hook, or `agento.json` change; a VS Code extension or
  custom renderer; copy buttons for non-`/agento` commands (e.g. `gh auth login`
  reauth instructions — follow-up if wanted).
- Rewriting historical delivery artifacts in `features/**`.

## Acceptance checklist

- [ ] `.github/instructions/delivery-policy.instructions.md` has `## 12. Command
  presentation` stating: one fenced block per command the user is asked to run, the
  block holds exactly that command with no language tag or extra text, the §9 result
  line is unchanged and last with its `next:` repeated in a block above it,
  descriptive mentions stay inline, repository prose is excluded; frontmatter
  `description` enumerates it — verify: read the section; `node --test
  'tests/customizations.test.mjs'` passes with `sections.size >= 12`.
- [ ] Every `.github/agents/*.agent.md` and `.github/prompts/*.prompt.md` body cites
  `§12` — verify: the new customizations test "every command and agent cites the
  §12 command presentation rule" passes.
- [ ] The §12 distinctive phrase is a canary: it appears in the policy file and in no
  other agent, prompt, or instruction file — verify: the canary test passes and
  `grep -rl "copyable command block" .github/agents .github/prompts
  .github/instructions` lists only `delivery-policy.instructions.md`.
- [ ] `next-feature.prompt.md` (≡ `commands/next-feature.md`) emits one command per
  bare fenced block with no trailing comments — verify: the new test "next-feature
  prints one command per fenced block" passes; `diff .github/prompts/next-feature.prompt.md
  commands/next-feature.md` is empty.
- [ ] Builder completion/pause, Reviewer step 8, Autopilot step 4 and Reporting,
  Planner step 9, Architect L133, and the `continue`, `ship`, `start-freehand`,
  `close-session`, `new-feature`, `new-issue`, `doctor`, `quick-fix`, `agento-init`
  prompts present their user-run commands as blocks (the `paused at teardown`
  wording remains only in `ship.prompt.md`) — verify: `grep -n` of each cited
  location shows the block instruction or the §12 citation; full test suite passes.
- [ ] A real response renders a one-command block with a copy button — verify:
  `evidence/step-4-2-copy-button.png` captured by the Builder from `/agento doctor`
  in this worktree's chat, linked from roadmap step 4.2; the Reviewer captures its
  own.
- [ ] `docs/commands.md` `## Receipts` and `docs/architecture.md` mention copyable
  command blocks with a §12 reference; `CHANGELOG.md` has a `## 0.5.1 (unreleased)`
  entry; `package.json` and `.claude-plugin/plugin.json` both read `0.5.1` — verify:
  `grep -n "§12" docs/commands.md docs/architecture.md`; `grep -n "0.5.1"
  CHANGELOG.md package.json .claude-plugin/plugin.json`.
- [ ] Full lint baseline rerun is green and no lower than the recorded baseline:
  `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exit 0 with ≥ 205
  tests; `shellcheck scripts/hooks/delivery-guard.sh scripts/hooks/replay-guard.sh
  scripts/hooks/session-context.sh scripts/wait-for-checks.sh` exit 0; both
  `replay-guard.sh` smoke runs exit 0 — verify: the commands' captured exit codes
  recorded on roadmap step 5.1.
