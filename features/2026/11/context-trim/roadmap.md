```yaml
status: in-progress
branch: feature/context-trim
last-updated: 2026-11-04
next-step: "1.2 Add the on-demand pointer form to the Policy: contract"
initiative: "agento-speed"
artifact-pr: "#76"
```

## Phase 1: Baseline and the on-demand pointer contract

- [x] 1.1 Record the Builder brief baseline: in this build window run `node
  scripts/agento.mjs brief build-feature context-trim` and every `--page N` it lists;
  note the total bytes (`| wc -c` summed), the page count, and the included / on-demand
  section numbers on this step line — verify: the three numbers are written on this
  line and the output's policy sections are §1, §2, §3, §4, §5, §7, §8, §9, §10, §11, §12
  — baseline: 5665 B, 1 page, sections §1 §2 §3 §4 §5 §7 §8 §9 §10 §11 §12 (§9 included, rest on demand)

- [ ] 1.2 Add the on-demand pointer form to the `Policy:` contract: in
  `tests/customizations.test.mjs` add a test that every `` `agento.mjs policy N` ``
  pointer in an agent, prompt, or mirror body names a section `policy --list` knows
  (`citedSections` keeps counting `§N` only, so pointers are not declared); update the
  `**Policy: line contract.**` paragraph in `docs/architecture.md` to define the
  pointer form and its exclusion from the declared set — verify: `node --test
  tests/customizations.test.mjs` passes; a temporary pointer `agento.mjs policy 99` in a
  scratch copy of a prompt makes the new test fail (reverted, not committed)

## Phase 2: Trim the Builder

- [ ] 2.1 In `.github/agents/delivery-builder.agent.md` rewrite the three citations as
  pointers — post-ship exception (`agento.mjs policy 4`, `:109`), lint baseline gate
  (`agento.mjs policy 5`, `:112`), cross-window handoff (`agento.mjs policy 8`, `:162`)
  — and cite policy §6 in the long-command guidance (`:30–32`); set the `Policy:` line to
  `§1, §2, §3, §6, §7, §9, §10, §11, §12` in the agent,
  `.github/prompts/build-feature.prompt.md`, `.github/prompts/build-issue.prompt.md`,
  `skills/agento/commands/build-feature.md`, and `skills/agento/commands/build-issue.md`;
  add a test in `tests/customizations.test.mjs` pinning that exact set for those five
  files — verify: `node --test tests/customizations.test.mjs` passes; `grep -n "§[458]"
  .github/agents/delivery-builder.agent.md` matches nothing; `grep -c "agento.mjs policy
  [458]" .github/agents/delivery-builder.agent.md` prints 3

- [ ] 2.2 Set `BRIEF_POLICY_PRIORITY["🔨 Agento Builder"]` in `scripts/lib/brief.mjs` to
  `["9","7","1","2","3","6","11","10","12"]`; change the Builder fixture in
  `scripts/lib/brief.test.mjs` ("paginateBrief honours the role's policy priority
  order") to sections `[1, 2, 3, 6, 7, 9, 10, 11, 12]`; add a test that every
  `BRIEF_POLICY_PRIORITY` entry is a permutation of the declared `Policy:` set of the
  agent file with that `name:`; run `cd extension && npm run copy-cli` — verify: `node
  --test scripts/lib/brief.test.mjs scripts/commands/brief.test.mjs
  tests/customizations.test.mjs tests/extension-bundle.test.mjs` passes

- [ ] 2.3 Measure the trimmed Builder brief: rerun `node scripts/agento.mjs brief
  build-feature context-trim` and all its pages; note total bytes, page count, and
  sections on this line — verify: total is ≥ 2,000 B below the 1.1 baseline; §6 is
  included or listed on demand; the output contains no `policy 4`, `policy 5`, or
  `policy 8` footer entry and no `## 4.`, `## 5.`, or `## 8.` section

## Phase 3: Autopilot pin and docs

- [ ] 3.1 Add `"autopilot": "<strong model: picker name (vendor)>"` to the `mixed`
  profile's `agents` in `templates/model-profiles.json`; add an `autopilot` entry to the
  `docs/model-profiles.md` example (`:20–40`) and a short "Autopilot model" note next to
  the BYOK tier warning (`:231–237`): keep the orchestrator on a strong Copilot model at
  least as high as its delegates, switch with `models use` — verify: `node -e
  'JSON.parse(require("fs").readFileSync("templates/model-profiles.json","utf8"))'` exits
  0; `node --test scripts/model-profiles.test.mjs scripts/commands/models.test.mjs`
  passes

- [ ] 3.2 Confirm the Autopilot pin is unchanged (Decision 3/4): `node
  scripts/agento.mjs models pins` reports `autopilot` as `Claude Opus 5.5 (copilot)` —
  verify: that output, and `git diff origin/main -- .github/agents/` touches only
  `delivery-builder.agent.md` and no `model:` line

- [ ] 3.3 Add `## Trimming per-call context` to `docs/copilot-harness.md` after
  `## Known stall sources`: the Builder's trimmed `Policy:` set and the pointer form with
  the 1.1/2.3 byte numbers; the Autopilot pin decision (stays `Claude Opus 5.5
  (copilot)`; how to switch); disabling the Python/Pylance synced customizations in
  non-Python workspaces — confirm the UI path in the running VS Code (Agent
  Customizations editor, Extensions → *Agent Plugins – Installed*) or the official VS
  Code docs before writing it, and name the check (the skills list of a fresh session no
  longer shows them) — verify: `grep -n "^## " docs/copilot-harness.md` shows the new
  heading between "Known stall sources" and "Reproduce"; `node --test
  tests/customizations.test.mjs` passes

## Phase 4: Final verification

- [ ] 4.1 Run the full gate: `shellcheck scripts/hooks/delivery-guard.sh
  scripts/hooks/session-context.sh scripts/hooks/replay-guard.sh
  scripts/wait-for-checks.sh` (install or download `shellcheck` if missing), the full
  suite `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'
  'canvas/**/*.test.mjs'`, and `cd extension && npm ci && npm run build && npm run
  test:unit` — verify: shellcheck exit 0 with no findings (baseline: 0); full suite 0
  failures and ≥ 891 tests; extension build and unit tests exit 0; results noted on this
  line
