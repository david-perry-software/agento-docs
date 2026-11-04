# Context trim: a smaller Builder policy load, an explicit Autopilot pin, and a Python-skills note

## Problem

Every Builder start loads its declared policy sections through the opening
`agento.mjs brief build-<type> <slug>` call. The Builder's `Policy:` line
(`.github/agents/delivery-builder.agent.md:21`, mirrored in
`.github/prompts/build-feature.prompt.md:11`, `.github/prompts/build-issue.prompt.md:11`,
`skills/agento/commands/build-feature.md:11`, `skills/agento/commands/build-issue.md:11`)
names 11 of the 12 sections — §1–§5 and §7–§12, ≈ 17.7 KB of policy text
(`.github/instructions/policy/*.md`) — although three of them are needed only at one
point each: §4 (post-ship exception, `delivery-builder.agent.md:109`), §5 (lint baseline
gate, `:112`) and §8 (cross-window handoff, `:162`). Meanwhile §6 (shell hygiene: bounded
CI/deploy waits, wrapping builds and tests), the rules the Builder applies on almost every
step, is *not* loaded. The [agento-speed brief](../../../../initiatives/2026/11/agento-speed/brief.md)
also flags the Autopilot model (Opus hit "Credit limit reached") and the 7 Python/Pylance
skills synced into every prompt of non-Python workspaces.

This feature implements the `### context-trim` member block of the initiative
[agento-speed breakdown](../../../../initiatives/2026/11/agento-speed/breakdown.md):
cut the Builder's `Policy:` list to the sections it acts on (rest on demand), settle the
Autopilot's model pin, and document disabling the Python/Pylance synced customizations.
It lands after `startup-brief-command` as recommended, so the trim is written once against
the per-section files.

## Decisions

Clarifying questions (numbered-list fallback per §10; the recommended option of each
question was **a**):

1. "Builder `Policy:` set (agent + `build-feature` / `build-issue`)?" — options: a. §1, §2,
   §3, §6, §7, §9, §10, §11, §12 — drop §4/§5/§8, add §6 (recommended); b. same without
   adding §6; c. minimal §1, §7, §9, §11. → **"1.a"** (recommended).
2. "Which agents get a trimmed list?" — options: a. Builder only, plus its two build
   commands (recommended); b. Builder and Reviewer; c. Builder, Reviewer, and Autopilot.
   → **"2.a"** (recommended).
3. "Autopilot default model?" — options: a. `Claude Fable 5.1 (copilot)` (recommended);
   b. a Sonnet-class Copilot model; c. `DeepSeek V4 Pro (deepseek)`. → **"Opus 5.5"**
   (free-text answer, not the recommended option): the Autopilot stays on
   `Claude Opus 5.5 (copilot)`, its current pin. The brief's "Autopilot on a
   cheaper/faster profile" item is therefore declined by the user.
4. "Where does the Autopilot change land?" — options: a. both your `mixed` profile (via
   the `agento.mjs models` CLI so `models apply` rewrites the committed pin) and the
   shipped `templates/model-profiles.json` + `docs/model-profiles.md` with an explicit
   `autopilot` entry (recommended); b. template/docs only; c. your profile only.
   → **"a"** (recommended). With answer 3, the user's `mixed` profile and the committed
   pin already name `Claude Opus 5.5 (copilot)` (`~/.config/agento/model-profiles.json`,
   `.github/agents/delivery-autopilot.agent.md:5`), so that half is a verified no-op; the
   template and docs gain an explicit strong-model `autopilot` entry.
5. "Python/Pylance note location?" — options: a. `docs/copilot-harness.md` "Trimming
   per-call context" section next to "Known stall sources" (recommended); b. that plus a
   `doctor` warning; c. README troubleshooting. → **"a"** (recommended).

## Research

Skills consulted: none — no matching domain (this repository's AGENTS.md has no
`## Agento` skills table; the work is Markdown agent text, a JSON template, docs, and
node:test suites).

**Lint baseline (§5).** AGENTS.md's lint is `shellcheck scripts/hooks/*.sh
scripts/wait-for-checks.sh`. `shellcheck` is not installed on this machine; the baseline
ran with the official v0.10.0 release binary (downloaded to `/tmp`):
`shellcheck scripts/hooks/delivery-guard.sh scripts/hooks/session-context.sh
scripts/hooks/replay-guard.sh scripts/wait-for-checks.sh` → exit 0, no findings. Full
test suite `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'
'canvas/**/*.test.mjs'` at `38ba3d0` → 891 tests, 891 pass, 0 fail. Overlap decision:
the baseline is green and this delivery touches no shell file, so the gate is the full
lint rerun (exit 0, no findings) plus the full test suite — no scoped gate needed.

**The `Policy:` line contract is mechanical.** `tests/customizations.test.mjs:1018–1069`
(`citedSections`, `expectedSections`, test "every agent, prompt, and mirror declares its
policy sections on one Policy: line") requires the declared set to equal
{1, 9, 10, 11, 12} ∪ every `§N` the file's body cites (∪ the agent's citations for a
command dispatched to that agent), for agents, prompts, and the
`skills/agento/commands/` mirrors. `docs/architecture.md:267–271` states the same
contract. So the trim cannot just edit the line: the Builder body cites `policy §4`
(`:109`), `policy §5` (`:112`), and `policy §8` (`:162`), and it cites no `§6` (its
long-command guidance at `:30–32` names `initial_wait` without a section). The build
prompts carry no §4/§5/§6/§8 citations of their own; their declared set derives from the
Builder's.

**Brief priority.** `scripts/lib/brief.mjs:29–36` `BRIEF_POLICY_PRIORITY` orders each
role's declared sections for pagination ("each list is a permutation of that role's
declared set"); the Builder's is `["9","7","1","2","3","5","11","10","12","8","4"]`.
`scripts/lib/brief.test.mjs:108–130` builds its Builder fixture from the current
sections `[1,2,3,4,5,7,8,9,10,11,12]`. No test checks that every priority list is a
permutation of its agent's declared set. `extension/cli/` is a byte copy of `scripts/`
(`cd extension && npm run copy-cli`), checked by `tests/extension-bundle.test.mjs`.

**Size.** Section files (`wc -c .github/instructions/policy/*.md`): §1 1,280; §2 1,269;
§3 2,339; §4 876; §5 1,496; §6 1,101; §7 2,086; §8 1,168; §9 1,174; §10 2,002; §11 1,235;
§12 2,811. Current Builder set = 17,736 B; new set = 15,297 B (−2,439 B, −13.8 %) per
Builder start, with §6 now included.

**Mirrors.** `skills/agento/commands/build-feature.md` and `build-issue.md` carry the
same `Policy:` line (no byte-identity test for these two; the policy-line test covers
them). No other copy of the agent or build prompts exists under `extension/`.

**Model profiles.** `templates/model-profiles.json` defines `mixed` with planner,
reviewer, architect placeholders and no `autopilot` key (placeholders are rejected by
validation, `scripts/model-profiles.test.mjs:98` — the template is instructional).
`docs/model-profiles.md:20–40` shows the `mixed` example without `autopilot`;
`:231–237` documents the BYOK tier warning (pin `autopilot` at least as high as the
highest-tier model it delegates to). The user's profile already pins `autopilot` to
`Claude Opus 5.5 (copilot)`.

**Docs.** `docs/copilot-harness.md` headings: … `## Known stall sources` (`:452`),
`## Reproduce` (`:496`). No document mentions Python/Pylance synced customizations;
per-workspace plugin disabling is documented in `docs/install.md:37–40` and
`README.md:597–600` (Extensions → *Agent Plugins – Installed* → context menu, or the
Agent Customizations editor).

**Concurrent deliveries.** `gh pr list --state open` is empty in both
`david-perry-software/agento` and `david-perry-software/agento-docs` at planning time
(2026-11-04): no file overlap.

## Approach

1. **On-demand pointer form (contract).** Introduce an explicit on-demand pointer —
   `` `agento.mjs policy N` `` written in a body — that names a section the file reaches
   only at one point and therefore does *not* declare. `citedSections` keeps counting
   `§N` only; a new test asserts every pointer names a section that `policy --list`
   knows. Update the `**Policy: line contract.**` paragraph in `docs/architecture.md`
   (declared set = baseline ∪ every `§N` cited; `agento.mjs policy N` pointers are
   on-demand and excluded) — `tests/customizations.test.mjs:886` keeps the paragraph
   heading.
2. **Builder text.** In `.github/agents/delivery-builder.agent.md`: rewrite the three
   citations as pointers — post-ship exception (`agento.mjs policy 4`), lint baseline
   gate (`agento.mjs policy 5`), cross-window handoff (`agento.mjs policy 8`) — and cite
   §6 in the long-command guidance (bounded waits and wrapped builds/tests per shell
   hygiene, policy §6). Set the `Policy:` line to `§1, §2, §3, §6, §7, §9, §10, §11, §12`
   in the agent, both build prompts, and both mirrors. A regression test pins that exact
   set for those five files.
3. **Brief priority.** Builder priority becomes `["9","7","1","2","3","6","11","10","12"]`
   (§6 right after the step-execution sections). Update the `brief.test.mjs` fixture to
   the new set and add a test that every `BRIEF_POLICY_PRIORITY` entry is a permutation
   of its agent file's declared set. Regenerate `extension/cli/`.
4. **Autopilot pin.** No pin change (Decision 3). Add `"autopilot": "<strong model:
   picker name (vendor)>"` to the `mixed` template profile and an `autopilot` entry to
   the `docs/model-profiles.md` example, with a short "Autopilot model" note: keep the
   orchestrator on a strong Copilot model (tier warning; few, short turns, so the
   per-call cost is small) and use `models use` / profile edits to change it. Confirm
   `models pins` still reports `Claude Opus 5.5 (copilot)` for `autopilot` and the
   agent files are unchanged.
5. **Docs.** New `## Trimming per-call context` section in `docs/copilot-harness.md`
   after "Known stall sources": the Builder's trimmed `Policy:` set and the pointer form
   (with the measured brief bytes before/after), the Autopilot pin decision, and how to
   disable the Python/Pylance synced customizations in non-Python workspaces (verified
   UI path, how to confirm the skills list shrank).

Affected files: `.github/agents/delivery-builder.agent.md`,
`.github/prompts/build-feature.prompt.md`, `.github/prompts/build-issue.prompt.md`,
`skills/agento/commands/build-feature.md`, `skills/agento/commands/build-issue.md`,
`scripts/lib/brief.mjs`, `scripts/lib/brief.test.mjs`, `tests/customizations.test.mjs`,
`extension/cli/lib/brief.mjs` (generated), `templates/model-profiles.json`,
`docs/model-profiles.md`, `docs/architecture.md`, `docs/copilot-harness.md`.

## Risks

- **A Builder skips an on-demand section** (lint gate, post-ship, handoff) because it is
  no longer in the brief. Mitigation: each pointer sits at the exact point of use and
  names the command; plans already encode the lint gate and post-ship steps in roadmap
  `verify:` lines (§5, §4); the Reviewer still loads §4, §5, and §8 and checks both.
- **The pointer form loosens the declared-set check** (a file could avoid declaring a
  section). Mitigation: the form is narrow (`agento.mjs policy N`, validated against
  `policy --list`), documented in the contract, and the Builder's exact set is pinned by
  a test.
- **Initiative definition of done deviates.** The breakdown's DoD line "the Autopilot's
  default profile is the cheaper model" is not met: the user chose to keep
  `Claude Opus 5.5 (copilot)` (Decision 3). The Opus "Credit limit reached" risk stays;
  `agento.mjs models use` switches profiles when needed. The breakdown is not edited by
  this delivery.
- **Python/Pylance UI path may differ by VS Code version.** Mitigation: the Builder
  confirms the path against the running VS Code (Agent Customizations editor /
  Extensions view) or the official docs before writing it, and the doc names the check
  (skills listed in a new session) rather than a version-specific screenshot.
- **Concurrent delivery.** `plugin-snapshot-slim` (same wave) may edit `docs/` or
  `scripts/`. Mitigation: integrate `origin/main` before every push (`step-commit`
  does), rerun the tests after any merge.
- **Mirror drift.** The two `skills/agento/commands/` mirrors are edited in the same step
  as the prompts; the policy-line test covers mirrors.

## Out of scope

- Trimming the Reviewer, Planner, Autopilot, or any other `Policy:` line (Decision 2).
- Changing the Autopilot's (or any agent's) model pin (Decision 3).
- Disabling Python/Pylance customizations on the user's machine — documented only.
- Changing the brief budget (`BRIEF_BUDGET`) or the pagination algorithm.
- Plugin snapshot size (`plugin-snapshot-slim`).

## Acceptance checklist

- [ ] `.github/agents/delivery-builder.agent.md`, `.github/prompts/build-feature.prompt.md`,
  `.github/prompts/build-issue.prompt.md`, `skills/agento/commands/build-feature.md`, and
  `skills/agento/commands/build-issue.md` each declare exactly `Policy: §1, §2, §3, §6, §7,
  §9, §10, §11, §12 — …` — verify: the new pinning test in `tests/customizations.test.mjs`
  passes and `grep -n "^Policy:"` on the five files shows that set.
- [ ] The Builder body reaches §4, §5, and §8 only through `agento.mjs policy N` pointers at
  their point of use and cites §6 in its long-command guidance — verify: `grep -n "§[458]"
  .github/agents/delivery-builder.agent.md` prints nothing outside the `Policy:` line;
  `grep -n "agento.mjs policy [458]"` finds three pointers; `grep -n "§6"` finds the
  citation.
- [ ] The on-demand pointer form is documented in `docs/architecture.md`'s `Policy:` line
  contract and enforced: a test fails when a body's `agento.mjs policy N` names an unknown
  section — verify: `node --test tests/customizations.test.mjs` passes; the paragraph names
  the pointer form.
- [ ] `BRIEF_POLICY_PRIORITY["🔨 Agento Builder"]` is a permutation of the new set, and a test
  asserts every priority entry is a permutation of its agent's declared set — verify:
  `node --test scripts/lib/brief.test.mjs scripts/commands/brief.test.mjs` passes.
- [ ] A Builder start is smaller: `agento.mjs brief build-feature context-trim` (all pages,
  run in the build window) totals at least 2,000 B less than the baseline recorded in
  roadmap step 1.1, §6 is included or listed on demand, and §4/§5/§8 appear nowhere in its
  output — verify: byte counts on roadmap steps 1.1 and 2.3.
- [ ] Reviewer, Planner, Autopilot, Architect, and Mechanic `Policy:` lines and every agent
  `model:` line are unchanged — verify: `git diff origin/main -- .github/agents/` touches
  only `delivery-builder.agent.md`, and not its `model:` line.
- [ ] `templates/model-profiles.json` and the `docs/model-profiles.md` example carry an explicit
  strong-model `autopilot` entry with the "Autopilot model" note; `agento.mjs models pins`
  still reports `Claude Opus 5.5 (copilot)` for `autopilot` — verify: `node -e` JSON parse of
  the template; `node --test scripts/model-profiles.test.mjs` passes; `models pins` output.
- [ ] `docs/copilot-harness.md` has a `## Trimming per-call context` section after "Known stall
  sources" covering the Builder trim (with measured bytes), the Autopilot pin decision, and the
  Python/Pylance per-workspace disable steps — verify: `grep -n "^## " docs/copilot-harness.md`
  and a read of the section.
- [ ] `extension/cli/` is regenerated and the extension still builds and passes its unit tests —
  verify: `node --test tests/extension-bundle.test.mjs` passes; `cd extension && npm ci &&
  npm run build && npm run test:unit` exit 0.
- [ ] Lint gate (§5, full rerun): `shellcheck scripts/hooks/delivery-guard.sh
  scripts/hooks/session-context.sh scripts/hooks/replay-guard.sh scripts/wait-for-checks.sh`
  exits 0 with no findings (baseline: 0 findings), and the full suite `node --test
  'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` has 0 failures with at
  least the baseline's 891 tests — verify: command output recorded on roadmap step 4.1.
