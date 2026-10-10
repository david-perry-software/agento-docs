# hooks-node-port: one Node implementation behind both hook wrappers

## Problem

Agento's two hooks — the PreToolUse delivery guard and the SessionStart context — are
Bash wrappers around two large Python heredocs (`scripts/hooks/delivery-guard.sh`,
454 lines; `scripts/hooks/session-context.sh`, 189 lines). The config loader and the
companion resolver are duplicated byte-for-byte between them by convention (`# ---
shared with … keep both copies identical ---`, guard L252–L302, session-context
L43–L93), the occupant check now exists a third time in Node
(`scripts/worktree-occupants.mjs`, ported for `close-session-cli`), and `python3` is
a runtime requirement that exists only for these two scripts while every other part
of Agento already runs on Node ≥ 20.

This feature is the `hooks-node-port` member of the
[agento-hardening](../../../../initiatives/2026/10/agento-hardening/breakdown.md)
initiative (`### hooks-node-port` block). Its brief: "One source of truth for the hook
logic … with the replay harness and fixtures unchanged, `PROTECTED` extended to
`hooks.json` and `.claude-plugin`, the nudge re-targeted to the session's companion
half, and the explicit-refspec false positive fixed with fixtures."

User-visible effect: both hooks keep their wiring (`hooks/hooks.json`,
`.github/hooks/*.json`), their file names, their JSON output, and every existing
fixture verdict, but run one Node implementation; `python3` disappears from the
requirements, from `doctor`, and from policy §10; the guard additionally protects the
plugin wiring files, judges pushes from the default branch by their refspec
destinations instead of denying every content push, and the recorded companion-half
nudge gap is either proven closed or fixed.

## Decisions

Clarifying questions were asked with the ask-questions tool on 2026-10-09. Every
answer was the option marked recommended.

- **Q: Where should the single Node hook implementation live, and may it import the
  CLI's shared modules?** A: `scripts/hooks/*.mjs`, importing
  `scripts/agento-config.mjs` + `scripts/worktree-occupants.mjs` (recommended). It
  stays under the existing `PROTECTED` pattern; one config loader and one occupant
  check are shared with the CLI; `agento-config.mjs` itself stays unprotected.
- **Q: After the port nothing needs python3 (replay-guard.sh's two python one-liners
  move to node too). What happens to the python3 token and doctor check?** A: Remove
  python3 entirely: doctor check, `COMMAND_NEEDS`/`CAPABILITY_CHECKS`, §10
  vocabulary/fallback, README/install/docs (recommended). Node ≥ 20 is already a hard
  requirement; the fallback text "hooks do not run" moves onto the existing `node`
  check.
- **Q: How should the port prove it is behaviour-preserving before the Python heredocs
  are deleted?** A: Differential step: run both implementations against all fixtures +
  guard/session tests, then delete Python in the final step (recommended). A temporary
  switch (`AGENTO_HOOK_IMPL=python|node`) exists only until the deletion step and never
  ships.
- **Q: The explicit-refspec fix has sibling follow-ups in guard-branch-delete-on-main.
  Which are in scope?** A: All three: content push of a non-default ref from the
  default branch allowed; delete-only = every refspec is a delete; `refs/heads/<default>`
  caught (recommended). They share one refspec parser.
- **Q: The guard already pairs `<companion>-worktrees/<same basename>` for the nudge
  (delivery-guard.sh ~L298). Regression test only, or is a behavioural change still
  expected?** A: Verify first: write a failing test for the half case; if it already
  passes, record evidence and close the follow-up without a code change (recommended).

## Research

Skills consulted: none — no matching domain. The repository has no `.agents/skills/`
directory and no skills table in AGENTS.md (verified 2026-10-09).

### Lint baseline (policy §5)

Run 2026-10-09 from the planning worktree at `origin/main` `1d27a66`:

| Command | Exit | Findings |
| --- | --- | --- |
| `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | 0 | `# tests 382`, `# pass 382`, `# fail 0` |
| `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` | 0 | 110 fixture lines, 0 MISMATCH |
| `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` | 0 | 44 fixture lines, 0 MISMATCH |
| `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` | 127 | `shellcheck` is not installed on this machine (`command -v shellcheck` empty); CI installs it with `apt-get` and runs the same command (`.github/workflows/*.yml` L20–L21) |

Green baseline (the shellcheck 127 is an environment gap, not a finding) → no overlap
decision and no scoped gate: the Builder reruns the **full** baseline at every step
that touches `scripts/`, `tests/`, or `hooks/`, running shellcheck through
`npx --yes shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` locally (the
npm package wraps the binary; `network` is in scope) and treating the CI shellcheck
job as the authoritative run (`scripts/wait-for-checks.sh pr <n>`). The Reviewer
compares a fresh run against 382/382/0, both replays exit 0 with 0 MISMATCH, and
shellcheck silent. Builder notes: (1) every edit-tool change to `scripts/hooks/*`
draws one `ask` from the guard itself (`PROTECTED`, delivery-guard.sh L123–L126) —
keep edits few and large; (2) the guard denies a `{ … }` group or a `>` redirection
on a segment naming `scripts/hooks/` — run the replay harness and shellcheck as plain
commands, redirecting only via a separate segment or not at all; (3) after step 4.1
lands, edits to `hooks/hooks.json` and `.claude-plugin/` draw the same `ask`.

### Codebase findings (file:line at `1d27a66`)

- **Guard structure** (`scripts/hooks/delivery-guard.sh`): wrapper reads stdin into
  `DELIVERY_HOOK_INPUT` and runs `python3 - <<'PY'` (L16–L19); `decide()` prints the
  `hookSpecificOutput.permissionDecision` JSON or nothing for `allow` and exits 0
  (L23–L31); payload fields `tool_name|toolName`, `tool_input|toolInput`,
  `command|commandLine|text`, `filePath|file_path|path|uri`, `cwd|workingDirectory`
  (L38–L49); `worktree_remove_target()` + the `/proc` scan + `code --status` parse
  (L51–L116); `PROTECTED = (\.github/hooks/|scripts/hooks/)` and `WRITE_TOOL`
  (L123–L126); `SEGMENT_SPLIT` (L130); `READ_ONLY`, `GIT_SAFE_SUBCOMMANDS`,
  `PREFIXES` (L135–L148); `tokens_of()` via `shlex.split` with whitespace fallback
  (L150–L154); `command_word()` skipping `VAR=` and prefixes (L156–L169); the
  hook-file segment loop including the redirect regex `(?<![<])>{1,2}\s*\S*(\.github/hooks/|scripts/hooks/)`
  (L171–L197); `WATCHER` (L203–L209); `gh pr merge` rules (L215–L221); `target_dir()`
  honouring `git -C` and a leading `cd … &&` (L229–L237); shared `CONFIG_DEFAULTS`,
  `load_config()` (invalid JSON → next candidate → defaults), `resolve_artifacts()`
  (L252–L302); companion detection via `--git-common-dir` and the paired-half
  re-target `paired = <companion>-worktrees/<basename(product_root)>` when it matches
  `^(plan|feature|issue|freehand)-` and is a directory (L311–L330); `DEFAULT`, `GIT`,
  `REDIRECT` (L335–L341); `commit_files()` (L343–L373); the per-segment git loop:
  force/no-verify/delete-default rules (L383–L396), chain-aware branch tracking
  (L400–L406), `is_merge`, `push_to_default = \spush\b.*(?:\s|:)<default>\b`,
  `is_delete_push`, the default-branch deny (L408–L415), the nudge — companion
  (index + working tree + untracked + HEAD of the paired half) or in-repo
  `commit_files` (L417–L433).
- **SessionStart structure** (`scripts/hooks/session-context.sh`): wrapper exports
  `AGENTO_ROOT` (L17–L18); `session_summary()` shells out to `node <cli> session
  --root <cwd>` with a 5 s timeout and returns `None` on any failure (L96–L123);
  `MANAGED_DIR` half re-target (L129–L133); output lines in order `Current git
  branch:`, `Agento CLI:`, `Session:`, `Artifacts:`, `Delivery work:` ×N or the
  "No in-progress delivery work in features/ or issues/." line (L137–L186); the
  roadmap walk reads `^status:` and `^next-step:` with `[^\n#]+` (L166–L180).
- **Replay harness** (`scripts/hooks/replay-guard.sh`): builds the hook payload and
  extracts the verdict with two `python3 -c` one-liners (L57, L59); `REPLAY_COMPANION=1`
  sets `branches.default: trunk` and substitutes `{companion}` (L33–L42).
- **Existing Node pieces to reuse**: `scripts/worktree-occupants.mjs` exports
  `findOccupants(target, { procDir, platform, codeStatus })` returning `{ processes,
  folderWindow, workspaceWindow, details }` with the guard's exact `details` phrases
  (L47–L67); `scripts/agento-config.mjs` exports `loadAgentoConfig(rootDir)` →
  `{ config, source }` (L46–L53; `parseConfigText` throws on invalid JSON, unlike the
  Python loader) and `resolveArtifactsRoot({ config, rootDir, primaryRoot })` (L61–L69).
  `scripts/agento.mjs` `resolveArtifacts()` (L208) is module-private and bound to the
  CLI's bootstrap, so the hook module ports the Python `resolve_artifacts()` on top of
  `resolveArtifactsRoot` instead of importing the CLI.
- **Tests**: `tests/guard.test.mjs` (466 lines) spawns `bash delivery-guard.sh` via
  `decide(command, { cwd, filePath, tool, env })` (L12–L30) and already covers the
  paired-half nudge ("companion: the nudge on a product-half commit inspects the
  paired companion half", L327–L347, via `makeSessionPair()` L294+);
  `tests/session-context.test.mjs` (314 lines) has four tests that pin the **no-node**
  output to the with-node output minus `Session:` (L122–L133, L186–L197, L269–L279,
  L281–L314) using `pathWithoutNode()` (L54–L60, symlinks `bash python3 git cat
  dirname`); `tests/customizations.test.mjs` checks the plugin layout and that every
  wired hook command resolves to an executable file (L680–L696) and that `doctor
  --for <name>` agrees with each prompt's `Needs:` line under a node+git-only PATH
  (L471–L490); `tests/wait-for-checks.test.mjs` L25 stubs `gh` with a `python3`
  heredoc; `tests/extension-bundle.test.mjs` checks `extension/cli/` against
  `scripts/` for the files `extension/scripts/copy-cli.mjs` lists (hook modules are
  not in that list and the extension never runs hooks).
- **python3 surface to remove**: `scripts/agento.mjs` `doctorProbes` (L818),
  `DOCTOR_CHECKS.python3` (L850–L855), `CAPABILITY_CHECKS.terminal` and
  `CAPABILITY_CHECKS.python3` (L968, L974); `scripts/agento.test.mjs` check-id lists
  and stubs (L1431, L1443, L1546, L1567–L1579, L1617, L1623, L3087, L3301–L3305);
  `.github/instructions/delivery-policy.instructions.md` §10 vocabulary bullet
  (L298), soft list (L302), fallback bullet (L318–L319); `docs/commands.md` L23, L191,
  L366; `.github/prompts/doctor.prompt.md` + `commands/doctor.md` descriptions;
  `README.md` L86–L88; `docs/install.md` L13–L16; `docs/hooks.md` L15–L19, L27–L28,
  L89–L104; `.github/agents/copilot-mechanic.agent.md` L108 (heredoc + pipe note);
  `CHANGELOG.md` (an `## Unreleased` entry). No template, extension source, or
  prompt `Needs:` line mentions `python3`.
- **Recorded follow-ups this member absorbs**:
  - `issues/2026/09/plugin-hooks-layout/roadmap.md` Follow-ups: extend `PROTECTED` to
    `hooks/hooks.json` and `.claude-plugin/` with new fixtures.
  - `features/2026/09/artifact-history-migration/roadmap.md` Follow-ups: the nudge
    inspects the companion clone, not the session's half. The guard code at L325–L330
    and the test at `tests/guard.test.mjs` L327 indicate this was closed by
    `paired-artifact-worktrees`; step 4.3 verifies it against a half whose `HEAD`
    (not index) touched `roadmap.md` while the clone's did not.
  - `issues/2026/09/guard-branch-delete-on-main/roadmap.md` Follow-ups: (a)
    explicit-refspec content push of a non-default branch from the default branch is
    denied; (b) `push_to_default` matches `main-thing` through `\b`; (c)
    `--delete refs/heads/<default>` / `:refs/heads/<default>` is not caught; (d)
    `is_delete_push` tests presence, not delete-only. Fixture line 116 of
    `tests/guard-fixtures.txt` (`deny git switch main && git push origin
    HEAD:feature/x`) pins the current false positive and flips to `allow`.
- **Concurrent deliveries**: `gh pr list --state open` is empty in both
  `david-perry-software/agento` and `david-perry-software/agento-docs` (2026-10-09).
  No overlap risk at planning time.

## Approach

### Module layout (all under `scripts/hooks/`, so `PROTECTED` already gates edits)

- `scripts/hooks/hook-lib.mjs` — shared helpers, each a named export with unit tests:
  `readPayload()` (stdin → JSON, `{}` on parse error), `runGit(dir, ...args)` (5 s
  timeout, `""` on any failure), `loadHookConfig(root)` (wraps `loadAgentoConfig`;
  invalid JSON or unreadable file → the next candidate → defaults, matching the Python
  loader), `resolveArtifacts(productRoot)` (the Python algorithm on top of
  `resolveArtifactsRoot`: primary = first `git worktree list --porcelain` entry, the
  primary's `repo` wins when it sets one), `shellSplit(text)` (POSIX `shlex.split`
  port: single/double quotes, backslash escapes, `ValueError` → whitespace split),
  `emit(json)`.
- `scripts/hooks/session-context.mjs` — `buildSessionContext({ payload, agentoRoot,
  env })` returning the `additionalContext` lines, plus a `main()` that prints the
  SessionStart JSON. `AGENTO_ROOT` is derived from `import.meta.url` (no wrapper
  export needed). The `Session:` line still comes from `node <cli> session --root
  <cwd>` with the 5 s timeout and is omitted on any failure.
- `scripts/hooks/delivery-guard.mjs` — `decide(payload, deps)` returning
  `{ decision, reason }` and a `main()` that prints the PreToolUse JSON for non-allow.
  Sections in the Python order: occupant check (via `findOccupants`), hook-file
  protection, watchers, `gh pr merge`, git policy, nudge. Regexes are transcribed
  one-to-one (`re.MULTILINE` → `m`; `re.match` → `^`; the lookbehind is supported on
  Node ≥ 20).
- Wrappers `delivery-guard.sh` / `session-context.sh` shrink to: header comment,
  `set -u`, `command -v node >/dev/null 2>&1 || exit 0`, `exec node
  "$(dirname "${BASH_SOURCE[0]}")/<name>.mjs"` with stdin inherited. Both wirings and
  the executable-file check in `tests/customizations.test.mjs` are untouched. Without
  `node` the hooks are silent and exit 0 (guard → allow; SessionStart → no context),
  which is the behaviour `doctor`'s `node` fallback text now names.
- `replay-guard.sh` builds the payload and reads the verdict with `node -e` instead
  of `python3 -c`; fixture format and the `{companion}` substitution are unchanged.

### Transition (Phases 1–3)

1. Phase 1 adds the three modules beside the Python and gives each wrapper a
   temporary `AGENTO_HOOK_IMPL` switch (default `python`). With `AGENTO_HOOK_IMPL=node`
   the existing `guard.test.mjs`, both replay runs, and `session-context.test.mjs`
   (minus the four no-node tests, which encode Python-only semantics) must pass
   unchanged — the port is behaviour-preserving before any fix.
2. Phase 2 adds a temporary `tests/hook-parity.test.mjs` that drives every fixture
   command from both fixture files, a corpus of the guard-test commands (hook-path
   writes, watchers, merges, redirections, chained switches), and the SessionStart
   hook against the plain, companion, pair, and managed repos, once per
   implementation, and asserts byte-identical stdout. Its run is recorded as
   `evidence/step-2-1-parity.md`.
3. Phase 3 cuts over: the Python heredocs, the switch, and the parity test are
   deleted; the four no-node session tests become one "no node → exit 0, empty
   stdout" test per hook; the `python3` doctor check, probe, capability entries, the
   `wait-for-checks` test stub, policy §10, and the docs are updated;
   `extension/cli/agento.mjs` is regenerated with `npm run copy-cli`.

### Guard fixes (Phase 4, fixtures first)

- **4.1 `PROTECTED`** becomes
  `(\.github/hooks/|scripts/hooks/|(?:^|/)hooks/hooks\.json|\.claude-plugin/)`, used
  by the edit-tool rule, the segment loop, and the redirect rule (one constant, no
  second copy of the alternation). New fixtures: `deny rm hooks/hooks.json`,
  `deny rm -rf .claude-plugin`, `deny tee hooks/hooks.json`, `ask chmod 644
  hooks/hooks.json`, `allow cat hooks/hooks.json`, `allow git add hooks/hooks.json
  .claude-plugin/plugin.json`; guard tests for edit-tool `ask` on both paths.
- **4.2 Refspec rule.** A `pushRefspecs(tokens)` helper parses the `push` segment:
  options and their arguments (`-o/--push-option`, `--receive-pack`, `--exec`,
  `--repo`) are skipped; the first positional is the remote; the rest are refspecs
  `[+]src[:dst]`, `:dst`, or — with `--delete`/`-d` — bare `dst`. `HEAD` and a bare
  `src` resolve to themselves; `refs/heads/` is stripped; the destination is
  compared to the default branch as a **whole token**. The on-default-branch push rule
  becomes: deny when the segment has no refspec and no `--tags` (pushes the current
  default branch), or carries `--all`/`--mirror`, or any refspec destination (or
  source, for `--delete`) is the default branch; `push_to_default` and the
  delete-default rule use the same token comparison from any branch. This closes all
  four recorded siblings at once (delete-only becomes irrelevant: a mixed list is
  judged per destination). Fixtures: line 116 flips to `allow`; new lines cover
  `allow git switch main && git push origin feature/x`, `… push -u origin feature/x`,
  `… push origin feature/x :feature/y`, `… push origin HEAD:refs/heads/feature/x`;
  `deny git switch main && git push`, `… push origin HEAD`, `… push --all origin`,
  `… push origin feature/x main`; `deny git push origin HEAD:refs/heads/main`,
  `deny git push origin :refs/heads/main`, `deny git push origin --delete
  refs/heads/main`; `allow git push origin main-thing`, `allow git push origin
  --delete main-thing`; the companion file mirrors them with `trunk`.
- **4.3 Nudge half case.** A new guard test seeds the companion **half**'s `HEAD`
  (not its index) with a `roadmap.md` commit while the clone's `HEAD` touches none,
  and expects `allow` from the product half; and the reverse (clone `HEAD` touched a
  roadmap, half did not) expects `ask` naming the half. If both pass on the ported
  guard, the follow-up is recorded as closed with the test as evidence; otherwise the
  re-target is fixed in `delivery-guard.mjs`.

### Docs

`docs/hooks.md` (implementation paragraph, the two push rows, a new `hooks/hooks.json`
/ `.claude-plugin/` row, the Testing section), `docs/install.md`, `README.md`,
`docs/commands.md`, `.github/prompts/doctor.prompt.md` + its `commands/` mirror,
`.github/agents/copilot-mechanic.agent.md` (the heredoc note becomes "hook input is
read from stdin by the Node module"), policy §10, `CHANGELOG.md` `## Unreleased`.

### Affected files

`scripts/hooks/{delivery-guard.sh,session-context.sh,replay-guard.sh}` (edited),
`scripts/hooks/{hook-lib.mjs,delivery-guard.mjs,session-context.mjs}` (new),
`scripts/agento.mjs`, `scripts/agento.test.mjs`, `extension/cli/agento.mjs`
(regenerated), `tests/{hook-lib.test.mjs (new), guard.test.mjs,
session-context.test.mjs, wait-for-checks.test.mjs, guard-fixtures.txt,
guard-fixtures-companion.txt, customizations.test.mjs}`, the docs and policy files
above. `tests/hook-parity.test.mjs` exists only between steps 2.1 and 3.1.

## Risks

- **Regex and tokenizer drift between Python and JS.** `\w` is ASCII-only in JS and
  Unicode-aware in Python; `shlex` edge cases (backslash inside double quotes, `#`
  handling with `posix=True`) differ subtly. *Mitigation:* the Phase 2 parity test
  runs the full fixture corpus and the guard-test corpus through both implementations
  and diffs stdout byte-for-byte; the shellSplit unit tests pin the quoting cases the
  guard relies on (`'feat: widget'`, `"docs(feature): x"`, `2>&1`, `--format=`).
- **The guard gates its own development.** Every edit under `scripts/hooks/` asks for
  approval and `{ … }` groups or redirections naming the directory are denied.
  *Mitigation:* Builder notes in `## Research`; large edits per step; the Builder runs
  tests as plain commands.
- **Intentional verdict change.** Fixture 116 flips `deny` → `allow`; the rule "no
  content push from the default branch" becomes "no push whose destination is the
  default branch". *Mitigation:* the new rule still denies the bare `git push`, `HEAD`,
  `--all`, and `--mirror` cases from the default branch; the GitHub ruleset remains
  the enforcement layer (docs/hooks.md). The change is called out in CHANGELOG and the
  rule table.
- **Policy §10 edit.** Removing the `python3` token touches the file the
  customizations test treats as the single source of the vocabulary; the CLI's
  `CAPABILITY_CHECKS` and `doctor` output must change in the same step.
  *Mitigation:* step 3.2 and 3.3 verify with `node --test tests/customizations.test.mjs`
  and `node scripts/agento.mjs doctor`.
- **shellcheck not installed locally.** *Mitigation:* `npx --yes shellcheck …`
  locally and the CI job as the authoritative run; both recorded on the gate step.
- **Concurrent deliveries.** None open at planning; other `agento-hardening` members
  (`delivery-metrics`, `ship-cli`) touch `scripts/agento.mjs` too. *Mitigation:*
  merge `origin/main` into both halves before every push (policy §7).

## Out of scope

- Any change to hook wiring paths, the fixture file format, the replay harness's
  interface, or hook JSON output shapes.
- Making the CLI (`agento.mjs`) call the guard's occupant check differently; the
  shared `findOccupants` is reused as is.
- Windows support for the hooks (the `/proc` scan stays Linux-only).
- Protecting `scripts/agento-config.mjs` or `scripts/worktree-occupants.mjs` with
  `PROTECTED` (decided against in Decisions Q1).
- The remaining `guard-branch-delete-on-main` and `plugin-hooks-layout` follow-ups
  not named in Research (upstream VS Code bug, install options B/C).
- `ship-cli`'s use of the guard; it lands after this member.

## Acceptance checklist

- [ ] `scripts/hooks/delivery-guard.sh` and `scripts/hooks/session-context.sh` contain
  no `python3` and no heredoc; each is a wrapper that `exec`s
  `node scripts/hooks/<name>.mjs` and exits 0 silently when `node` is absent —
  verify: `grep -c 'python3\|<<' scripts/hooks/*.sh` prints 0 for each; a test per
  hook with a `bash git`-only PATH asserts exit 0 and empty stdout.
- [ ] `hooks/hooks.json` and `.github/hooks/*.json` are byte-identical to `origin/main`
  and `tests/customizations.test.mjs` passes — verify: `git diff origin/main --
  hooks/ .github/hooks/` empty; `node --test tests/customizations.test.mjs`.
- [ ] Every pre-existing fixture keeps its verdict except
  `deny git switch main && git push origin HEAD:feature/x`, which becomes `allow` —
  verify: `git diff origin/main -- tests/guard-fixtures.txt
  tests/guard-fixtures-companion.txt` shows only that flip plus added lines; both
  replays exit 0 with 0 MISMATCH.
- [ ] The parity step was executed and recorded: `evidence/step-2-1-parity.md` lists
  the command count per corpus and "0 differences" for both hooks — verify: the file
  exists and is linked from roadmap step 2.1.
- [ ] `agento.mjs doctor` has no `python3` check, `CAPABILITY_CHECKS` has no `python3`
  key, and the `node` check's fallback names the hooks — verify: `node
  scripts/agento.mjs doctor | grep -c python3` prints 0; `node --test
  scripts/agento.test.mjs`.
- [ ] `grep -rn python3 --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=out
  .` reports hits only in `CHANGELOG.md` (released entries plus this entry) — verify:
  the grep output.
- [ ] `extension/cli/agento.mjs` equals `scripts/agento.mjs` — verify: `diff` empty;
  `node --test tests/extension-bundle.test.mjs`.
- [ ] `PROTECTED` gates `hooks/hooks.json` and `.claude-plugin/`: the new fixtures and
  the edit-tool tests pass and were observed failing first — verify: the step 4.1
  line records the failing run; `node --test tests/guard.test.mjs`.
- [ ] Pushes from the default branch are judged per refspec destination and the
  default branch is matched as a whole token including the `refs/heads/` spelling:
  the step 4.2 fixtures and tests pass and were observed failing first — verify: the
  step 4.2 line records the failing run; both replays exit 0.
- [ ] The companion-half nudge case is covered by a test that seeds the half's `HEAD`
  (not index) and the clone's `HEAD` in opposite ways — verify: `node --test
  tests/guard.test.mjs` names the test; the step 4.3 line records whether a code
  change was needed.
- [ ] `docs/hooks.md`, `docs/install.md`, `README.md`, `docs/commands.md`, the doctor
  prompt + mirror, the Mechanic agent, policy §10, and `CHANGELOG.md` describe the
  Node hooks and no longer require `python3` — verify: the `python3` grep above; `diff
  .github/prompts/doctor.prompt.md commands/doctor.md` empty.
- [ ] Full-repository gate equals or beats the baseline: `node --test` ≥ 382 tests,
  0 fail; both replays exit 0; shellcheck silent (npx locally, CI job green) — verify:
  counts recorded on the gate step; `scripts/wait-for-checks.sh pr <n>` exit 0.
