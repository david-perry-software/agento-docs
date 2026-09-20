# Managed session windows auto-approve the agent's own commands (session-auto-approve)

## Problem

Every managed Agento session window — the `<kind>-<id>.code-workspace` pair that
`/agento start-session` and `/agento start-freehand` open in companion mode — runs
with VS Code's stock terminal-approval configuration. The Builder, Reviewer, and
Autopilot are told by delivery-policy §1 to run `git push`, `gh pr create/edit`,
`gh issue create`, `node scripts/agento.mjs …`, `npm run …`, and the test/lint
commands themselves, but none of those are in VS Code's default
`chat.tools.terminal.autoApprove` allow set, so each one surfaces a confirmation.
The user reports that `/agento ap <slug>` therefore runs for only 1–2 minutes before
it needs a click — mostly on git/gh commands that modify remote state — even with the
chat permission level set to Autopilot (Preview). The unattended loop is not
unattended.

The fix must be isolated to the session window (no user-settings edits, no effect on
other VS Code windows, nothing tracked in the product repository) and 100 % automated
(no per-session manual step). The companion (docs) repository may change.

## Evidence

GitHub issue: #58

Verified 2026-09-20 in this planning worktree (VS Code 1.132.0, HEAD `0b82a87` =
`origin/main`). All captures are under [evidence/](evidence/).

**Observed:** a session window's terminal approvals fall through to VS Code's
built-in rules; there is no Agento-supplied auto-approval anywhere the window reads.

**Expected:** a managed session window carries a per-workspace allow-all
configuration for the commands the agent is required to run itself, written
automatically when the session is created or resumed.

Reproduction steps and their proof:

1. The generated pair workspace file has an empty `settings` object —
   [evidence/repro-no-auto-approve-config.txt](evidence/repro-no-auto-approve-config.txt) §1 (`cat
   /home/david/DP/agento-worktrees/plan-20260920-162232.code-workspace`):
   `"settings": {}`. It is hand-written by prose in
   `.github/prompts/start-session.prompt.md:60` and
   `.github/prompts/start-freehand.prompt.md:79` (mirrored in `commands/`), §2.
2. Nothing else the window reads configures approval — §3: user `settings.json` has
   0 matches for `autoApprove|permissions.default`; the primary checkout's
   `.vscode/settings.json` contains only `chat.pluginLocations`; the checkout tracks
   0 `.vscode/settings.json` / `.code-workspace` files; `templates/` (what
   `/agento agento-init` scaffolds) ships no settings; 0 `autoApprove` mentions across
   `*.md`, `*.mjs`, `*.json`, `*.ts` in the repository.
3. The delivery guard is not what prompts: replaying the Builder's routine
   remote-mutating commands (`git push -u origin issue/x`, `git -C <companion> push
   -u …`, `gh pr create --draft …`, `gh pr edit …`, `gh issue create …`, `git fetch
   origin && git merge origin/main`, `node scripts/agento.mjs session`, `npm run
   build`, `scripts/wait-for-checks.sh pr 12`) through
   `scripts/hooks/replay-guard.sh` yields `allow` for all nine —
   [evidence/repro-guard-allows-remote-commands.txt](evidence/repro-guard-allows-remote-commands.txt).
4. The CLI cannot emit or write workspace settings today:
   `node scripts/agento.mjs workspace plan 20260920-162232` →
   `{"status":"usage-error","message":"unknown command workspace"}`, exit 1 —
   [evidence/repro-cli-no-workspace-command.txt](evidence/repro-cli-no-workspace-command.txt).
   This is the surface the exposing regression test targets.
5. VS Code's default rule set (source: `terminalChatAgentToolsConfiguration.ts`
   `AutoApprove.default`, and the docs' approvals page) auto-approves read-only
   commands (`ls`, `cat`, `git status/log/show/diff`, …) and marks `rm`, `curl`,
   `wget`, `chmod`, `chown`, `jq`, `xargs`, `eval` as `false`; `git push`, `gh`,
   `node`, `npm`, `shellcheck` are absent, so under Manual permissions each falls
   through to a confirmation. A `false` rule always wins over a `true` rule.

Not reproducible here: the exact prompts from the user's Autopilot run (the user
has no record; no Copilot debug log on this machine mentions `autoApprove` or
`permissionDecision`). VS Code documents Autopilot as auto-approving all tools
(`isSessionAutoApproveLevel`), so the observed prompts under Autopilot are either
PreToolUse-hook `ask` decisions (the guard's roadmap nudge, `--amend`, `rebase`,
`reset --hard`, `-D`, `gh pr merge --squash|--rebase`) or a permission level that
did not stick for the request. The deterministic fix below removes the whole class
regardless of permission level; the guard's deliberate `ask`s stay (see Risks).

## Decisions

Asked 2026-09-20 (ask-questions tool unavailable → numbered questions in chat).

1. **Reproduction detail** — which commands prompted, guard reason text vs plain
   VS Code prompt, which window, VS Code autopilot vs `/agento ap`?
   > I dont have them. They were almost all git commands that modified remote state.
   > not sure. Not sure. I was using agento ap with the vscode chat in Autopilot
   > (Preview) mode
2. **Where should the fix live?** (a) scaffolded `.vscode/settings.json`, (b) the
   generated `.code-workspace` `settings`, (c) extension `configurationDefaults`,
   (d) docs only.
   > I want to keep it isolated and not affect other vscode instances, not affect the
   > main repo, its ok to change the docs repo. HAS TO BE 100% automated
   → Option (b): the per-session `.code-workspace` file, written by the CLI.
3. **Allowlist scope** — which command families; `gh pr merge`; anything kept manual?
   > auto approve all
4. **Safety boundary** — rely on the delivery guard + GitHub rulesets, or also mirror
   deny patterns as VS Code `false` rules?
   > Yes comfortable
   → Guard + rulesets are the safety layer; no VS Code `false` rules (they would
   only re-introduce prompts, never block).
5. **Acceptance** — a full `/agento ap` run in a fresh session window with zero
   approval prompts?
   > Yes

## Research

Skills consulted: none — no matching domain (the target repository has no
`.agents/skills/` directory and its AGENTS.md has no skills table).

**Where the workspace file comes from.** Only prose writes it:
`.github/prompts/start-session.prompt.md` shared precondition 4 (line 60) and
`.github/prompts/start-freehand.prompt.md` (line 79), each mirrored byte-for-byte in
`commands/start-session.md` / `commands/start-freehand.md`. The CLI only *reports*
the path: `scripts/agento.mjs` `paths` (`workspace:` field, ~line 1165) and
`describeWorkspace()` (~line 286, `{ path, exists }` on the session record). The
extension never writes it (`extension/src/` has no workspace write; the only
`writeFile` is `filePendingDispatchStore.ts`). `scripts/agento.test.mjs:517` builds a
fixture file with `settings: {}` but asserts nothing about settings.

**Which VS Code settings, and at which scope** (microsoft/vscode `main`,
`terminalChatAgentToolsConfiguration.ts`, `commandLineAutoApprover.ts`,
`chatTerminalToolConfirmationSubPart.ts`, `chat.shared.contribution.ts`; docs
"Manage approvals and permissions", "Review and revert agent changes"):

- `chat.tools.terminal.autoApprove` — `restricted: true`, no explicit scope (window
  scope → workspace values honoured). `CommandLineAutoApprover._mapAutoApproveConfigToRules`
  attributes rules to `WORKSPACE_FOLDER` / `WORKSPACE` / `USER_REMOTE` /
  `USER_LOCAL` targets and the confirmation widget's *Allow … in this Workspace*
  action writes to `ConfigurationTarget.WORKSPACE` — i.e. into a `.code-workspace`
  `settings` block. Object form `{ "approve": true, "matchCommandLine": true }`
  matches the whole command line instead of per sub-command; a regex key is
  `"/pattern/flags"`.
- `chat.tools.terminal.ignoreDefaultAutoApproveRules` — `restricted: true`; when
  `true` the default set (including its `false` rules for `rm`, `curl`, `chmod`,
  `jq`, `xargs`, `eval`, …) is ignored while user/remote/workspace rules still apply.
  Required, because a default `false` rule beats any `true` rule.
- `chat.tools.terminal.blockDetectedFileWrites` — `restricted: true`, default
  `outsideWorkspace`; `never` stops detected writes (e.g. `git -C <companion clone>
  worktree add …`, `/tmp` captures) from forcing approval.
- `chat.tools.edits.autoApprove` — glob → boolean; `{ "**/*": true }` auto-approves
  edits to every file including `.vscode/*.json` and `.env`-style sensitive files.
- `chat.tools.global.autoApprove` — `ConfigurationScope.APPLICATION_MACHINE`; cannot
  be set per workspace, so it is ruled out by Decision 2.
- `chat.tools.terminal.enableAutoApprove` (default `true`, policy-managed) and the
  one-time application-scoped acceptance
  `chat.tools.terminal.autoApprove.warningAccepted` gate all rule-based approval
  (`isTerminalAutoApproveAllowed`). Both are user/machine state, not per workspace —
  a one-time "Enable terminal auto approve?" dialog may appear the first time any
  rule would fire; accepting it once is global.
- Restricted settings apply only in trusted workspaces; agent mode itself already
  requires trust, so a session window that can run the agent honours them.
- Autopilot: on the extension host it is a permission level (`isAutoApproveLevel` →
  `isSessionAutoApproveLevel` short-circuits the terminal analyzer); on the Agent Host
  it is a mode. Either way it is per session, not per workspace, and cannot be
  pre-selected by a workspace file (`chat.permissions.default` is a user setting).

**Where the CLI resolves the pair.** `paths <kind> <id>` computes
`worktree`, `companion.worktree`, and `workspace` from `worktreesDir` (product) and
`layout.companionWorktreesDir`; `describeWorkspace()` builds the same file name from
`worktree.dirPrefix`/`id`. A `workspace` command reuses those two computations.
`usage()` prints `agento.mjs` lines 1–22 of the header comment; adding a usage line
means widening that slice.

**Doctor.** `DOCTOR_CHECKS` (`scripts/agento.mjs` ~495–612) are keyed by id and
grouped by capability in `CAPABILITY_CHECKS`; the extension renders whatever ids come
back (no hard-coded list in `extension/src/`). `doctor` never repairs.

**Config.** `scripts/agento-config.mjs` `defaultConfig()` merges
`.github/agento.json` over defaults with `null` = keep default; `worktrees` currently
has only `dir`. The hooks' Python copy of the defaults covers `artifacts` and
`branches` only, so a new `worktrees.*` key needs no hook edit.

**Mirrors and bundles.** `commands/<name>.md` must equal
`.github/prompts/<name>.prompt.md` (checked by `tests/customizations.test.mjs`);
`extension/cli/` must be a byte copy of `scripts/` (`tests/extension-bundle.test.mjs`,
regenerated by `cd extension && npm run copy-cli`).

**Electron harness.** `extension/test/electron/runTest.ts` runs two scenarios
(`in-repo`, `companion`) with `launchArgs: [scenario.workspace, "--disable-extensions"]`
against VS Code 1.125.0; `suite.ts` keys on `AGENTO_ELECTRON_SCENARIO`. A third
scenario can launch a generated `.code-workspace` (with `--disable-workspace-trust`)
and read `vscode.workspace.getConfiguration().inspect(...)?.workspaceValue`.

**Lint baseline (policy §5).** Run 2026-09-20 at `0b82a87` in this checkout:

- `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` → exit 0, no findings.
- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → exit 0, `# tests
  214`, `# pass 214`, `# fail 0`.
- Baseline is green: no overlap, no cleanup prerequisite; the full gate re-runs both
  commands plus the two guard smokes and the extension unit/electron tests in the
  final phase and must stay at 0 findings / 0 failures.

**Concurrent deliveries.** `gh pr list --state open --json number,headRefName` → `[]`.
No overlap risk today.

**Incidental guard finding (not in scope).** While running the baseline, the guard
denied `{ shellcheck scripts/hooks/*.sh …; echo "…"; } 2>&1 | tail -5` with the
hook-write reason: the `{` brace-group opener is taken as the command word for a
segment naming `scripts/hooks/`. Recorded as a Follow-up in roadmap.md.

## Approach

Make the CLI the single author of the pair's `.code-workspace`, with a fixed
allow-all `settings` block, and have the two session-creating prompts call it.

1. **Canonical settings block** — `scripts/session-state.mjs` exports
   `SESSION_WORKSPACE_SETTINGS` (frozen) and
   `sessionWorkspaceDocument({ product, companion, autoApprove })` returning
   `{ folders: [{ path: product }, { path: companion }], settings }`:

   ```json
   {
     "chat.tools.terminal.autoApprove": {
       "/[\\s\\S]*/": { "approve": true, "matchCommandLine": true },
       "/.*/": true
     },
     "chat.tools.terminal.ignoreDefaultAutoApproveRules": true,
     "chat.tools.terminal.blockDetectedFileWrites": "never",
     "chat.tools.edits.autoApprove": { "**/*": true }
   }
   ```

   `autoApprove: false` yields `settings: {}` (today's content). The whole-line
   regex uses `[\s\S]` so heredocs and multi-line commands match; the per-sub-command
   `/.*/` rule covers analyzers that split first.

2. **Config knob** — `worktrees.autoApprove` (default `true`) in
   `scripts/agento-config.mjs` `defaultConfig()`, `templates/agento.json`
   (`"autoApprove": null`), `docs/project-profile.md`, README config table, and the
   scaffold snippet in `.github/prompts/agento-init.prompt.md` (+ `commands/` mirror).
   Adopters who want VS Code's stock prompts set it to `false`.

3. **CLI `workspace` command** — `node scripts/agento.mjs workspace
   <feature|issue|plan|freehand> <id> [--write]`:
   - companion mode: `{ status: "ok", path, exists, current, autoApprove, folders:
     [{ path, exists }, { path, exists }], settings, written }` where `folders` are
     the product half and companion half exactly as `paths` reports them, `current`
     is whether the on-disk file already parses to the canonical document, and
     `--write` writes `JSON.stringify(doc, null, 2) + "\n"` only when `current` is
     false (idempotent; `written: true|false`), creating `worktreesDir` if absent.
   - in-repo layout: `{ status: "not-applicable", message }`, exit 0, never writes.
   - `--write` is a new `parseArgs` option; the usage header gains one line and
     `usage()`'s slice widens accordingly.
   - `describeWorkspace()` on the session record gains `current: boolean|null`
     (`null` when the file is absent) so `session` shows a stale file.

4. **Doctor** — new check `session-workspace` in `CAPABILITY_CHECKS.terminal`: `ok`
   when the cwd is not a managed pair, or when the pair's file is `current`; `warn`
   with `detail: "<path> lacks the session auto-approve settings"` and
   `fallback: "run node <agento-root>/scripts/agento.mjs workspace <kind> <id>
   --write, then Developer: Reload Window"` otherwise. Existing sessions (this one
   included) surface a `Preflight:` line until fixed; `doctor` still never repairs.

5. **Prompts** — `.github/prompts/start-session.prompt.md` shared precondition 4 and
   `.github/prompts/start-freehand.prompt.md` step that writes the file: replace the
   hand-written JSON with `node <agento-root>/scripts/agento.mjs workspace <kind>
   <id> --write` after both halves exist, "on resume the same call refreshes a stale
   file", and state that the window opens with the session auto-approve block
   (`worktrees.autoApprove`). Mirror to `commands/`. No other prompt changes.

6. **Docs** — `docs/concurrency.md` (workspace file now carries settings),
   `docs/commands.md` (CLI list: `workspace`), `docs/install.md` (one-time
   *Enable terminal auto approve?* dialog; trusting `<worktrees.dir>` and
   `<companion>-worktrees` as parent folders removes the per-worktree trust
   prompt), `docs/hooks.md` (the guard's `ask` rules remain the only expected
   prompts inside a session), `docs/project-profile.md` + README (`worktrees.autoApprove`),
   `CHANGELOG.md` `## Unreleased` **Fixed** bullet naming #58.

7. **Bundle** — `cd extension && npm run copy-cli` so `extension/cli/` matches.

Affected files: `scripts/session-state.mjs`, `scripts/agento.mjs`,
`scripts/agento-config.mjs`, `scripts/agento.test.mjs`, `scripts/session-state.test.mjs`,
`scripts/agento-config.test.mjs`, `tests/customizations.test.mjs`,
`extension/cli/*` (generated), `extension/test/electron/runTest.ts`,
`extension/test/electron/suite.ts`, `.github/prompts/start-session.prompt.md`,
`.github/prompts/start-freehand.prompt.md`, `.github/prompts/agento-init.prompt.md`,
`commands/{start-session,start-freehand,agento-init}.md`, `templates/agento.json`,
`docs/{concurrency,commands,install,hooks,project-profile}.md`, `README.md`,
`CHANGELOG.md`. No `scripts/hooks/` or `.github/hooks/` change.

## Risks

- **VS Code state the workspace file cannot set.** Rule-based approval is gated by
  `chat.tools.terminal.enableAutoApprove` (default `true`, may be policy-disabled)
  and the one-time application-scoped acceptance of the *Enable terminal auto
  approve?* dialog. Mitigation: documented in `docs/install.md`; the dialog is
  answered once per machine, never per session. If an organisation policy disables
  auto-approval, the block is inert and prompts return — out of Agento's control.
- **The guard's own `ask` decisions still prompt, by design.** `git commit --amend`,
  `git rebase`, `git reset --hard`, `git branch -D`, `gh pr merge --squash|--rebase`,
  hook-file edits, `git worktree remove` with occupants, and the roadmap nudge
  (companion index/HEAD without `roadmap.md`) return `permissionDecision: "ask"`,
  which VS Code surfaces regardless of auto-approve rules. These are rare in a
  policy-conforming build; the user accepted the guard as the safety layer
  (Decision 4). The Reviewer should treat any such prompt in the acceptance run as
  a policy slip in the Builder's commands, not a defect in this fix.
- **Allow-all is a deliberate security posture.** With `ignoreDefaultAutoApproveRules`
  the stock `false` rules (`rm`, `curl`, `chmod`, `eval`, …) no longer prompt inside
  a session window. Mitigation: it applies only to managed session workspaces, the
  delivery guard denies force-push, `--no-verify`, default-branch commits/pushes,
  `--admin`, watchers, and hook-file writes, GitHub rulesets enforce the default
  branch, and `worktrees.autoApprove: false` restores stock behaviour per project.
  `chat.tools.urls.autoApprove` is intentionally *not* set: fetch-tool prompts are
  not terminal prompts and were not reported.
- **Workspace trust prompts per new worktree.** Restricted settings only apply in a
  trusted workspace; every new `<kind>-<id>` folder is untrusted until the user
  answers the trust dialog (a one-click, once-per-session interruption that predates
  this issue). Mitigation: `docs/install.md` recommends trusting the two parent
  directories once; no code change.
- **Multi-line / unusual shells.** VS Code parses zsh/fish with the bash grammar; the
  `[\s\S]` whole-line rule plus the sub-command rule covers heredocs, `&&` chains,
  and pipes; if a future VS Code changes the object-rule semantics the electron
  assertion (step 3.1) catches a schema change, not a behaviour change.
- **In-repo layout is unchanged.** Product-only sessions open a bare folder, which
  has no workspace-scoped settings file outside the repository; adding one would
  mean tracking `.vscode/settings.json` or generating a single-folder
  `.code-workspace`, both out of scope here (Follow-up).
- **Existing sessions.** Files written before this ship keep `settings: {}` until
  `workspace --write` is re-run; the new `doctor` warning names the exact command.
- **Concurrent deliveries.** None open at planning time; integrate `origin/main` by
  merge before every push regardless (policy §7).

## Out of scope

- Any change under `scripts/hooks/` or `.github/hooks/` (including the brace-group
  false positive found during the baseline — Follow-up).
- Pre-selecting the chat permission level (Autopilot / Allow all) for a session; it
  is user-scoped (`chat.permissions.default`) and per session.
- `chat.tools.global.autoApprove` or any edit to the user's `settings.json`.
- Auto-approval for in-repo (product-only) session folders.
- URL/fetch-tool approvals (`chat.tools.urls.autoApprove`).
- Extension UI for toggling the block (the extension only renders `doctor` output).

## Acceptance checklist

- [ ] The exposing regression test `workspace command writes the session pair's
      .code-workspace with the auto-approve settings block (#58 session-auto-approve)`
      in `scripts/agento.test.mjs` fails on `origin/main` (`unknown command
      workspace`) and passes after the fix — verify: `node --test
      scripts/agento.test.mjs` TAP output, before (step 1.1) and after (step 2.3).
- [ ] The prompt-contract test `start-session and start-freehand write the workspace
      file through agento.mjs workspace (#58 session-auto-approve)` in
      `tests/customizations.test.mjs` fails before step 2.6 and passes after —
      verify: `node --test tests/customizations.test.mjs`.
- [ ] `node scripts/agento.mjs workspace plan <id> --write` in a companion-mode
      fixture produces a file whose `folders` equal the product half and companion
      half from `paths plan <id>` (product first) and whose `settings` deep-equals
      `SESSION_WORKSPACE_SETTINGS`; a second `--write` reports `written: false` and
      leaves the bytes unchanged; `worktrees.autoApprove: false` yields
      `settings: {}`; the in-repo layout returns `status: "not-applicable"` and
      writes nothing — verify: the `scripts/agento.test.mjs` cases of steps 1.1/2.3.
- [ ] `agento.mjs session` reports `workspace.current` (`true`/`false`/`null`) and
      `agento.mjs doctor` reports `session-workspace` as `warn` with the `--write`
      fallback for a stale pair file and `ok` for a current one or a non-pair cwd —
      verify: `scripts/agento.test.mjs` doctor/session cases (steps 2.4, 2.5).
- [ ] VS Code loads the block at workspace scope: the new electron scenario opens a
      CLI-written `.code-workspace` and
      `getConfiguration().inspect("chat.tools.terminal.autoApprove").workspaceValue`
      deep-equals the block's rule object (likewise for the other three keys) —
      verify: `cd extension && npm run test:electron` passes with the `workspace`
      scenario.
- [ ] `.github/prompts/start-session.prompt.md`, `.github/prompts/start-freehand.prompt.md`
      contain no `settings: {}` hand-written JSON and instruct `agento.mjs workspace
      <kind> <id> --write`; `commands/` mirrors are byte-identical; `extension/cli/`
      matches `scripts/` — verify: `grep -c 'settings: {}' .github/prompts/*.md
      commands/*.md` is 0 for every file; `node --test tests/customizations.test.mjs
      tests/extension-bundle.test.mjs` passes.
- [ ] `worktrees.autoApprove` is documented (`docs/project-profile.md`, README config
      table, `templates/agento.json`, agento-init scaffold) and the `workspace` CLI
      command appears in `docs/commands.md`; `docs/install.md` names the one-time
      *Enable terminal auto approve?* dialog and the parent-folder trust tip;
      `CHANGELOG.md` `## Unreleased` has a **Fixed** bullet citing #58 — verify:
      `grep -n 'autoApprove' docs/project-profile.md README.md templates/agento.json
      .github/prompts/agento-init.prompt.md` hits each; `grep -n 'workspace <'
      docs/commands.md`; `grep -n '#58' CHANGELOG.md`.
- [ ] Full gate equals the recorded baseline: shellcheck exit 0 / 0 findings;
      `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` `# fail 0` with
      `# pass` ≥ 214 + the new tests; both guard smokes exit 0; `cd extension && npm
      run build && npm run test:unit && npm run test:electron` pass — verify: the
      recorded results on roadmap step 4.1.
- [ ] (manual evidence) In this session window, after step 2.8 rewrote
      `plan-20260920-162232.code-workspace` and the window was reloaded, a chat turn
      in **Manual permissions** that runs `git fetch origin && gh pr view --json
      number` (and one `node scripts/agento.mjs session`) completes with **zero**
      approval prompts — verify: roadmap step 3.2 screenshot
      `evidence/step-3-2-no-prompts.png`.
- [ ] No files under `scripts/hooks/` or `.github/hooks/`, no `.vscode/` or
      `.code-workspace` file, and no user-settings edit are part of the change —
      verify: `git diff --name-only origin/main...HEAD | grep -E
      'hooks/|\.vscode/|\.code-workspace$'` prints nothing.
