# Follow-up debt batch: paths worktreesDir, companion concurrency pointer, vendor-suffix warning, handoff model check

## Problem

Five follow-ups from shipped deliveries were never filed. Each one is small, and none
fits a thematic member of the initiative. This feature is the `followup-debt-batch`
member of the `agento-hardening` initiative
([breakdown](../../../../initiatives/2026/10/agento-hardening/breakdown.md), block
`### followup-debt-batch`). Its brief: "A follow-up debt batch closing the unfiled
items above, each with a test." The five items:

1. **`agento.mjs paths` reports the wrong `worktreesDir` from a managed worktree.**
   It resolves `worktrees.dir` against the current checkout, not the primary. From
   this planning worktree it reports
   `/home/david/DP/agento-worktrees/plan-20261009-083712-worktrees`; the correct
   value is `/home/david/DP/agento-worktrees`. The derived `worktree` and
   `workspace` paths are wrong in the same way, and so are `workspace` and `config`
   (`cli-dashboard-json` follow-up).
2. **`concurrent-delivery.instructions.md` never loads for artifact edits in the
   companion folder.** Its `applyTo: "features/**,issues/**"` only matches inside
   the product checkout, and in companion mode the artifacts are not there
   (`artifact-history-migration` follow-up).
3. **`gh pr edit --body` fails on gh 2.45.0.** This was already fixed by issue #62
   (`pr-cross-linking-deprecation`, `status: complete`). This member only records
   the evidence that it is closed (`artifact-history-migration` follow-up).
4. **No warning for model values without a `(vendor)` suffix.** VS Code silently
   ignores an unqualified non-Copilot pin, yet `models show`/`apply`/`pins` and
   `doctor` stay silent (`model-profiles` follow-up, 4.7 attempt 1).
5. **Unverified handoff pins.** Nobody has checked whether a mid-conversation
   handoff button honours the `handoffs[].model` pin that `models apply` writes
   (`model-profiles` 4.7 follow-up; the pin writer shipped with #79).

The user-visible effect: wrong paths from worktree windows, a policy file that
silently stops loading, misconfigured model pins with no diagnostic, and docs that
still say "unverified".

## Decisions

Clarifying questions were asked with the ask-questions tool on 2026-10-09. Every
answer was the option marked recommended.

- **Q: Item 1: how wide should the `worktreesDir` fix go?** A: "Fix every reader of
  the module-level worktreesDir" (recommended). That covers `paths`, `workspace`
  (through `resolveSessionPaths`), the plan-id taken check, and `config`'s
  `worktrees.dir`, all through `primaryWorktreesDir()`, with a regression test per
  subcommand run from a managed worktree.
- **Q: Item 2: which fix for the companion instructions gap?** A: "Init scaffolds a
  pointer file into the companion" (recommended). A new template (`applyTo` = the
  artifact roots) has a body that points at
  `<agento-root>/.github/instructions/concurrent-delivery.instructions.md`.
  `/agento agento-init` and its mirror list the new file, and this repository's
  `agento-docs` gets the file on this delivery's companion branch. It is a pointer,
  not a copy, so it cannot drift.
- **Q: Item 3: how to close the `gh pr edit` item?** A: "Verify-only step with
  recorded evidence" (recommended). Re-run the existing test and grep, and cite #62
  in the plan and CHANGELOG. No code change.
- **Q: Item 4: where should the missing `(vendor)` suffix warning appear?** A:
  "models show/apply/pins warnings[] + doctor model-profile warn" (recommended).
  These are the same surfaces as the BYOK tier warning. `apply` still exits 0, and
  each unqualified value (list entries too) is named once.
- **Q: Item 5: verify the handoff `model:` pin as a (manual) build step with a
  screenshot?** A: "Yes, (manual) step during build" (recommended). With a profile
  applied to the registered clone, the user clicks the Planner's "Build in this
  worktree" handoff and screenshots the picker. The result is recorded in
  `docs/model-profiles.md`. If the pin is not honoured, that becomes a documented
  limit plus a follow-up, not a fix in this member.

## Research

Skills consulted: none — no matching domain. The repository has no
`.agents/skills/` directory, and AGENTS.md has no `## Agento` skills table
(verified 2026-10-09).

### Item 1: `paths` / `workspace` / `config` resolve `worktrees.dir` against the cwd's checkout

- `scripts/agento.mjs` L192: `const worktreesDir = path.resolve(root,
  config.worktrees.dir);`. Here `root` is the current checkout's toplevel, and the
  default `worktrees.dir` is `../<basename(root)>-worktrees`
  (`scripts/agento-config.mjs` L9). In a managed worktree, the basename is the
  worktree's own name.
- `primaryWorktreesDir(worktrees = productWorktrees())` (L696–703) already
  resolves it correctly against `worktrees[0]` and the primary's config, memoised
  per primary (`worktreesDirByPrimary`, added by `dashboard-cli`). `session`,
  `next`, `status`, the doctor `worktrees-dir` check, and `start-session`'s owner
  lookup (L740, L845, L857, L1462, L1776, L2142) all use it.
- These readers still use the module-level `worktreesDir`:
  - `resolveSessionPaths` L367 (`managedWorktreePath(productList, kind, id,
    worktreesDir)`). It feeds `paths` (L2049), `workspace` (L2080), and
    `start-session` (L1451, L1463).
  - `paths` emits it verbatim (L2057).
  - `start-session`'s plan-id collision check (L1449, `takenPlanIds([worktreesDir,
    …])`).
  - `config` (L1943, `worktrees: { dir: worktreesDir }`).
- `start-session` only runs from the primary (window check), where the two
  resolutions agree. `paths`, `workspace`, and `config` are run from managed
  worktrees: the Planner calls `paths <type> <slug>` for `artifactRoot`.
- Reproduced 2026-10-09 from this worktree: `node scripts/agento.mjs paths feature
  followup-debt-batch` printed `worktreesDir:
  /home/david/DP/agento-worktrees/plan-20261009-083712-worktrees`, `worktree:
  …/plan-20261009-083712-worktrees/feature-followup-debt-batch`, and `workspace:
  …/plan-20261009-083712-worktrees/feature-followup-debt-batch.code-workspace`. The
  companion side was correct (`/home/david/DP/agento-docs-worktrees`) because
  `resolveArtifactsRoot` already anchors on the primary.
- Existing tests: `scripts/agento.test.mjs` L101 (config from a primary), L437 and
  L536 (`paths` companion/branch-aware), L1340 and L1361 (`paths` basics), and the
  `makeWorktreeRepo()` fixture at L1595 for managed-worktree cases.
- The hooks also read `worktrees.dir` (Python in `scripts/hooks/*.sh`). They are
  out of scope here; the `hooks-node-port` member owns them.

### Item 2: concurrent-delivery instructions in the companion

- `.github/instructions/concurrent-delivery.instructions.md` L3: `applyTo:
  "features/**,issues/**"`. The plugin manifest (`.claude-plugin/plugin.json`)
  ships `agents`, `commands`, and `hooks` only, with no instructions. So in a
  target repository this file never auto-loads, and in this repository it only
  matched the in-repo artifact roots that `artifact-history-migration` removed.
- The Builder (`.github/agents/delivery-builder.agent.md` L96), the Reviewer
  (`delivery-reviewer.agent.md` L31), and ship (`.github/prompts/ship.prompt.md`
  L117) already link it explicitly. The auto-load is what is missing.
- Precedent: `/agento agento-init` step 4
  (`.github/prompts/agento-init.prompt.md` L81–85) scaffolds
  `.github/instructions/agento.instructions.md` into the companion. It takes the
  frontmatter from `templates/project.instructions.md` and adds the verbatim body
  of `delivery-artifacts.instructions.md`. The same step publishes through the
  Contents API (a new companion) or a `changes/agento-init` PR (an existing
  companion). `commands/agento-init.md` is its byte-identical mirror.
- The companion of this repository
  (`/home/david/DP/agento-docs-worktrees/plan-20261009-083712/.github/instructions/`)
  holds only `agento.instructions.md` today.
- `tests/customizations.test.mjs` L521 includes `templates/*.md` in the guidance
  files: canonical `/agento <name>` spelling, no `.prompt`/`.md` suffixes, and
  relative links must resolve. A pointer must therefore name the plugin path in
  inline code, not as a relative link.
- Docs that describe the companion scaffold: `docs/artifacts.md` L59 and
  `docs/project-profile.md` L32–33 (`agento.instructions.md` `applyTo` note).

### Item 3: `gh pr edit --body` (already closed)

- Issue #62 (`issues/2026/09/pr-cross-linking-deprecation`, `status: complete`)
  replaced every instruction with the idempotent REST PATCH. Plan commit:
  `fd03c74`.
- `tests/customizations.test.mjs` L386 has the test `prompts and agents never
  direct users to gh pr edit --body`.
- `grep -rn "gh pr edit"` over `.github/`, `commands/`, `docs/`, and `templates/`
  finds nothing. The only hit is historical text in CHANGELOG.md L468.
- The PATCH form is present in `agento-init.prompt.md` L304–306 (M8),
  `new-feature.prompt.md` L63–68, `new-issue.prompt.md` L78–83, `ship.prompt.md`
  L175–176, and `delivery-planner.agent.md` L174–175.

### Item 4: vendor-suffix warning

- `scripts/model-profiles.mjs`:
  - `vendorOf(value)` (L356–361) returns the `(vendor)` suffix or `null`.
  - `byokTierWarning` (L366) uses it, but nothing reports a `null` vendor.
- `scripts/agento.mjs`:
  - `tierWarnings(targets)` (L1668) feeds `warnings[]` for `models list/show`
    (L2370) and `apply/clear` (L2428).
  - `models pins` and the doctor `model-profile` check (L901–925, informational,
    not in `CAPABILITY_CHECKS`) call `byokTierWarning` on `modelsPins()` (L913,
    L2377).
- `docs/model-profiles.md` L39–47 already states the value rule and quotes the VS
  Code log line `models "<name>" not found. Use format "<name> (<vendor>)"`.
  L114–119 describes the BYOK warning and says unqualified names give no tier
  warning.
- Tests: `scripts/model-profiles.test.mjs` (`vendorOf and byokTierWarning …`) and
  the `scripts/agento.test.mjs` doctor `model-profile` tests (L2972, L2999, L3815).
- Bundle: `extension/cli/` is a byte copy of `scripts/` (`cd extension && npm run
  copy-cli`). The six `extension/cli/*.mjs` files must `cmp` equal.

### Item 5: handoff `model:` pin

- Since #79 (`issues/2026/10/autopilot-subagent-model-pins`, complete), `models
  apply` writes a nested `model:` into every `handoffs:` item: Planner → 🔨
  Builder (`send: false`), Builder → 🔍 Reviewer, and Reviewer → 🤖 Autopilot.
  The value is the target's pin.
- `docs/model-profiles.md` L151–167 (`## Subagents and handoffs`) records the
  `runSubagent` observations (VS Code 1.136, Local harness). It says nothing
  observed about a handoff button.
- `features/2026/10/model-profiles/roadmap.md` 4.7 attempt 2 switched agents by
  selection in a fresh chat, so the handoff button was never exercised.
- Clicking a chat handoff button needs the VS Code chat UI, which the agent cannot
  drive (policy §1). That makes it a `(manual)` step. Profiles apply only to the
  registered plugin clone (`/home/david/DP/agento`). A worktree window of this
  repository loads its own unpinned workspace agents
  (`docs/model-profiles.md` "Developing Agento"). So the check runs in a window of
  a non-Agento repository. It tests `main`'s shipped pin writer, not this branch,
  so it does not need to wait for ship.

### Open deliveries and concurrency

`gh pr list --state open` returns `[]` in both `agento` and `agento-docs`
(2026-10-09). The other wave-1 member, `dashboard-cli`, is `complete`. There is no
overlap.

### Lint baseline (policy §5), 2026-10-09 at `a7cacfe`

- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`: exit 0, 347 tests,
  347 pass, 0 fail.
- Shellcheck is not on PATH, so it ran as `git ls-files '*.sh' | xargs pnpm dlx
  shellcheck` over `scripts/hooks/delivery-guard.sh`,
  `scripts/hooks/replay-guard.sh`, `scripts/hooks/session-context.sh`, and
  `scripts/wait-for-checks.sh`: exit 0, no findings.
- `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt`: exit 0.
- `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh <
  tests/guard-fixtures-companion.txt`: exit 0.
- `cd extension && npm run typecheck`: exit 0. `npm run test:unit`: 160/160 pass.
  `npm run test:electron`: exit 0 in all four scenarios.

Overlap decision: the baseline is green, so the **full gate** applies. Every
command above must be green at the end, plus `npm run package` and `cmp` on the six
`extension/cli/*.mjs` copies. No scoped gate is needed. This delivery changes no
shell or hook files.

## Approach

Two-commit rule (companion mode): code, tests, templates, prompts, and docs go in
the product half. The roadmap ticks, the evidence, and the companion's new
instruction file go in the companion half.

1. **`worktreesDir` from the primary** (`scripts/agento.mjs`).
   - Add the tests first (step 1.1), using `makeWorktreeRepo()` from a managed
     worktree:
     - `paths feature x` asserts `worktreesDir` equals the primary's resolved
       `worktrees.dir`, `worktree` equals `<that>/feature-x`, and `workspace` (in
       companion mode) sits beside it;
     - `workspace feature x` reports the same file;
     - `config` reports `config.worktrees.dir` equal to the primary's.
   - The new assertions must fail before the fix.
   - The fix replaces the module-level `worktreesDir` in `resolveSessionPaths`
     (L367), `paths` (L2057), `takenPlanIds` (L1449), and `config` (L1943) with
     `primaryWorktreesDir()`. Delete the constant, or make it a lazy accessor, so
     no reader is left on the cwd-relative value.
   - Field names, shapes, and exit codes stay unchanged. Only the value is
     corrected, and it now matches what `session` reports.
   - Then `npm run copy-cli`.
2. **Companion concurrency pointer.**
   - New `templates/companion-concurrency.instructions.md`:
     - frontmatter `description` (concurrent-delivery's description plus "pointer
       for the companion repository") and `applyTo: "features/**,issues/**"`;
     - a short body: before verifying a delivery branch or integrating the
       default branch, read the plugin's
       `<agento-root>/.github/instructions/concurrent-delivery.instructions.md`;
       `<agento-root>` comes from the session context line `Agento CLI: node
       <agento-root>/scripts/agento.mjs`; keep `applyTo` in sync with the product's
       artifact roots.
     - The path goes in inline code, with no relative link.
   - `/agento agento-init` step 4 gets a fourth companion file,
     `.github/instructions/agento-concurrency.instructions.md`, copied from that
     template (its `applyTo` rewritten to the configured feature/issue roots when
     they differ). It is published after `agento.instructions.md` in both the
     Contents-API order and the `changes/agento-init` PR path. Mirror the change
     byte-for-byte to `commands/agento-init.md`.
   - `docs/artifacts.md` and `docs/project-profile.md` name the second file.
   - New `tests/customizations.test.mjs` assertions:
     - the template exists, with `description` and `applyTo` equal to
       concurrent-delivery's `applyTo`;
     - its body names `concurrent-delivery.instructions.md`;
     - the init prompt names `agento-concurrency.instructions.md`.
   - Dogfood: add the same file to this repository's companion half under
     `.github/instructions/` on `feature/followup-debt-batch`, so it lands with the
     artifact PR.
3. **`gh pr edit` evidence.**
   - No code change.
   - A roadmap step re-runs the L386 test and the grep and records the results.
   - The CHANGELOG entry names #62 as the fix.
4. **Vendor-suffix warning.**
   - `scripts/model-profiles.mjs` gets a pure
     `unqualifiedWarning(entries)`:
     - `entries` is `[{ where, value }]` (string or list);
     - it returns one warning string naming each distinct unqualified value once,
       with the places it is used (`planner`, `default`, `prompts.doctor`, …), or
       `null`;
     - wording: values without a `(vendor)` suffix are resolved by VS Code only
       for some Copilot models and silently ignored otherwise; use `<picker name>
       (<vendor>)`.
   - In `scripts/agento.mjs`:
     - `tierWarnings` becomes the model warnings for a resolved target set: BYOK
       first, then unqualified. That covers `models list/show/apply/clear`.
     - `models pins` adds the unqualified warning over the current pins.
     - The doctor `model-profile` check returns `warn` when an applied, named
       profile has unqualified pins. The detail joins the BYOK and unqualified
       details with `; `.
   - `apply` still exits 0, and `custom`/error states are unchanged.
   - Tests:
     - unit tests in `scripts/model-profiles.test.mjs`: qualified → `null`; bare
       string; list with one bare entry; the same bare value used twice is named
       once with both places;
     - CLI tests in `scripts/agento.test.mjs`: `models show` and `apply` carry the
       warning and `apply` exits 0; `pins` carries it after apply; doctor
       `model-profile` is `warn` with an unqualified profile applied and `ok` with
       a fully qualified one.
   - Docs: `docs/model-profiles.md` value rule and warnings paragraph.
   - Then `npm run copy-cli`.
5. **Handoff pin check** (`(manual)`).
   - The Builder first confirms the setup itself:
     - `node /home/david/DP/agento/scripts/agento.mjs models pins --plugin-root
       /home/david/DP/agento` shows a named profile;
     - the planner's and builder's `model` differ;
     - `grep -n "model:" /home/david/DP/agento/.github/agents/delivery-planner.agent.md`
       shows the nested handoff line.
   - The user then reloads a non-Agento repository window and runs the handoff.
   - The observation goes into `docs/model-profiles.md` `## Subagents and
     handoffs`, with the VS Code version. If the pin is ignored, it also goes under
     `## Limits` and a roadmap follow-up is recorded.
6. **CHANGELOG** `## Unreleased`: one **Fixed.** entry for `paths`, `workspace`,
   and `config`, and one **Added.** entry for the companion pointer and the vendor
   warning. Both note that the `gh pr edit` item was closed by #62 and the handoff
   result. No version bump.

Files (product): `scripts/agento.mjs`, `scripts/model-profiles.mjs`,
`scripts/agento.test.mjs`, `scripts/model-profiles.test.mjs`,
`extension/cli/agento.mjs`, `extension/cli/model-profiles.mjs`,
`templates/companion-concurrency.instructions.md`,
`.github/prompts/agento-init.prompt.md`, `commands/agento-init.md`,
`tests/customizations.test.mjs`, `docs/artifacts.md`, `docs/project-profile.md`,
`docs/model-profiles.md`, `docs/commands.md` (only if the `paths`, `config`, or
`models` lines need a word), and `CHANGELOG.md`. Companion:
`.github/instructions/agento-concurrency.instructions.md` plus this slug
directory.

## Risks

- **A `config` consumer relies on the cwd-relative value.** The only readers are
  prompts and the extension, and both want the primary's. Mitigation: grep for
  `worktrees.dir`/`worktreesDir` consumers in `.github/`, `commands/`, and
  `extension/src/` in step 1.2, and record them on the step line.
- **The doctor `model-profile` turning `warn` changes the dashboard colour** for
  users whose bare Copilot names happen to resolve. This is accepted (Decision
  4): the warning is informational, and the check is not in `CAPABILITY_CHECKS`,
  so no command is rejected.
- **The user's current `mixed` profile may contain an unqualified value.** Then
  `doctor` in the registered clone turns `warn` after merge, which is the intended
  signal. The 4.9 requalification suggests it is already clean.
- **The handoff check depends on the user's profile and environment.** If
  planner and builder pin the same model, the check proves nothing. The Builder
  verifies they differ before asking the user. If they do not differ, the step's
  instructions tell the user to apply a profile where they do.
- **Concurrent delivery.** No open PRs today. The wave-2 members
  (`close-session-cli`, `hooks-node-port`) may open while this is in flight and
  touch `scripts/agento.mjs`. Mitigation: integrate `origin/main` by merge into
  both halves before every push (policy §7).
- **Init scaffold drift.** Existing companions created before this change do not
  get the pointer until `/agento agento-init` is re-run, which adds the missing
  file through a `changes/agento-init` PR (existing behaviour for missing files).
  CHANGELOG says so.

## Out of scope

- `worktrees.dir` resolution inside the hooks (`hooks-node-port`).
- The `dashboard-cli` review follow-ups (separate roadmap walks, docs wording).
- Fixing handoff pins if VS Code ignores them. That result is documented and
  becomes a follow-up.
- Validating or rewriting existing profiles. The warning is informational only.
- Copying the concurrent-delivery policy verbatim into companions.
- Version bump.

## Acceptance checklist

- [ ] From a managed worktree, `paths`, `workspace`, and `config` report the
  primary's `worktrees.dir`. Verify: the new `scripts/agento.test.mjs` tests failed
  before the fix (failure recorded on roadmap 1.1) and pass after it; `node
  scripts/agento.mjs paths feature followup-debt-batch` from the build worktree
  prints `worktreesDir: /home/david/DP/agento-worktrees`.
- [ ] No reader of the cwd-relative `worktreesDir` remains. Verify: `grep -n
  "worktreesDir\b" scripts/agento.mjs` lists no use of a module-level constant
  outside `primaryWorktreesDir`, or a lazy accessor that delegates to it; the full
  test suite passes.
- [ ] `templates/companion-concurrency.instructions.md` exists, with
  `description`, `applyTo: "features/**,issues/**"`, and a body naming
  `concurrent-delivery.instructions.md` by plugin path, with no relative link.
  Verify: the new `tests/customizations.test.mjs` assertions pass.
- [ ] `/agento agento-init` scaffolds
  `.github/instructions/agento-concurrency.instructions.md` into the companion, and
  the mirror is byte-identical. Verify: `grep -c 'agento-concurrency.instructions.md'
  .github/prompts/agento-init.prompt.md` ≥ 1; `cmp
  .github/prompts/agento-init.prompt.md commands/agento-init.md` is silent;
  `docs/artifacts.md` and `docs/project-profile.md` name the file.
- [ ] This repository's companion carries the pointer. Verify: `git -C
  <companion half> ls-tree -r --name-only HEAD .github/instructions/` lists
  `agento-concurrency.instructions.md`, and its body matches the template's.
- [ ] The `gh pr edit --body` item is recorded as closed by #62. Verify: `node
  --test --test-name-pattern "gh pr edit" tests/customizations.test.mjs` exit 0;
  `grep -rn "gh pr edit" .github commands docs templates` prints nothing; the
  CHANGELOG entry cites #62.
- [ ] Unqualified model values produce one warning in `models show`/`apply`/`pins`
  `warnings[]` and a `warn` doctor `model-profile` check; qualified values produce
  none. `apply` still exits 0. Verify: the new unit and CLI tests pass.
- [ ] The handoff pin observation is recorded. Verify:
  `evidence/step-3-2-handoff-model.png` is linked from roadmap 3.2 with a date;
  `docs/model-profiles.md` `## Subagents and handoffs` states the observed handoff
  behaviour and VS Code version; a non-honoured result also appears under
  `## Limits` and as a roadmap follow-up.
- [ ] CHANGELOG `## Unreleased` describes the fixes. Verify: `awk '/^##
  Unreleased/,/^## [0-9]/' CHANGELOG.md | grep -c 'paths\|vendor\|#62\|handoff'` ≥
  4.
- [ ] `extension/cli/` matches `scripts/`. Verify: `cmp` on all six
  `extension/cli/*.mjs` is silent after `npm run copy-cli`.
- [ ] Full gate green against the baseline in `## Research`:
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exit 0 with more
    than 347 tests and 0 failures;
  - shellcheck exit 0 with no findings;
  - both replay-guard runs exit 0;
  - `cd extension && npm run typecheck && npm run test:unit && npm run
    test:electron && npm run package` exit 0.
