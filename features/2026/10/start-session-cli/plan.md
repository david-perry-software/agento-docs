# Deterministic start-session: `agento.mjs start-session`, a thin prompt, and a CLI-driven extension

## Problem

`/agento start-session` is pure LLM coordination over steps the Agento CLI already
implements. One run makes 10–14 sequential tool calls — `session`, `doctor`, `git
fetch`, `paths`, `date`, two `git worktree add`s, a companion fetch, a `paths`
re-check, `workspace --write`, `code --new-window` — and every call is a full model
turn that resends a large context: the delivery policy (applies to `**`, ~12k tokens),
three AGENTS.md files (three workspace folders), the skills list, the 160-line prompt
(`.github/prompts/start-session.prompt.md`, mirrored byte-for-byte in
`commands/start-session.md`), and the large `session` JSON. When a model profile pins
the prompt to a slow reasoning model (DeepSeek V4 Pro on the user's machine) a run
takes about 2 minutes: `extension/src/newPlanFlow.ts` lines 25–31 record it (issue
#77) and the extension's New Plan flow polls the session record for up to 5 minutes
(`NEW_PLAN_FLOW_DEFAULTS.timeoutMs: 300000`).

User-visible effect: *New Plan*, the Deliveries/Initiatives play buttons, and
`/agento start-session` in chat take minutes to open a window that the CLI could open
in seconds.

Fix: one CLI subcommand, `agento.mjs start-session`, performs the whole start
deterministically; the prompt makes that one call and formats the result; the
extension calls the CLI directly and never round-trips through chat.

## Decisions

Clarifying questions (asked with the ask-questions tool; the recommended option is
marked) and the user's answers, verbatim:

1. **Which slug should this feature use?** Options: `start-session-cli`
   (recommended — short, names the new CLI subcommand), `deterministic-start-session`,
   `fast-start-session`. → **`start-session-cli`** (the recommended option).
2. **Ship all four phases (CLI, prompt, extension, docs) in one delivery, or split?**
   Options: "One delivery, all phases A-D" (recommended — matches the plan; phases are
   ordered roadmap phases), "CLI + prompt + docs only; extension as follow-up",
   "Split into an initiative with separate features". → **One delivery, all phases
   A-D** (the recommended option).
3. **When the CLI returns rejected/failed to the extension (New Plan, play buttons,
   continue), what should happen?** Options: "Error notification with the CLI reason,
   plus an 'Open in chat' action that runs /agento start-session" (recommended —
   deterministic by default, keeps an escape hatch), "Error notification only, no chat
   fallback", "Automatically fall back to the old chat submission". → **Error
   notification with the CLI reason, plus an 'Open in chat' action that runs
   /agento start-session** (the recommended option).
4. **If the CLI subcommand itself fails unexpectedly, should the thin prompt keep the
   old step-by-step procedure as a fallback?** Options: "No: report Result: failed
   with the CLI's reason; re-send is safe" (recommended — keeps the prompt thin,
   single source of logic in the CLI), "Yes: keep a condensed manual procedure as
   fallback". → **No: report Result: failed with the CLI's reason; re-send is safe**
   (the recommended option).
5. **Verification step 3 times a real run in the soshiki primary checkout. How should
   the Builder verify speed?** Options: "Fixture timing in this repo's test harness
   (companion fixture) plus a real run in the agento primary checkout, closed
   afterwards" (recommended — no writes into another product repo), "Real run in
   soshiki as written, cleaned up with /agento close-session", "Fixture timing only".
   → **Fixture timing in this repo's test harness (companion fixture) plus a real run
   in the agento primary checkout, closed afterwards** (the recommended option).

Decisions carried over from the feature description:

- Only start-session is in scope; start-freehand and close-session have the same
  shape and are follow-ups.
- The extension calls the CLI directly. The CLI opens the window itself unless
  `--no-open` is given; the extension always passes `--no-open` and uses its own
  `openTarget` (so it can queue the follow-up command first).
- Model pins stay with model profiles; this delivery only documents a fast-model
  recommendation for start-session.
- Safety rules are unchanged: same window check, ownership and post-add checks, and
  the CLI never removes or repairs a worktree.

## Research

Skills consulted: none — no matching domain (this repository has no
`.agents/skills/` directory and its AGENTS.md has no `## Agento` skills table).

**Current prompt** — `.github/prompts/start-session.prompt.md` (160 lines,
byte-identical to `commands/start-session.md`, no `model:` line committed; pins come
from `agento.mjs models apply`). It declares `Needs: terminal, code`, the code
fallback, the window check "role `primary` on the default branch, clean", runs
`doctor --for start-session`, `git fetch origin`, `paths`, the post-add check
(`worktreeState.ok` / `companion.state.ok`, fix `git -C <clone> worktree remove
<path>`), `workspace <kind> <id> --write`, then `code --new-window <workspace|path>`.
Plan mode: `date -u +%Y%m%d-%H%M%S` with `-2`, `-3` suffixes; registered path →
resume untouched; new → `git -C <primary> worktree add --detach <path> origin/main`
plus the companion half `git -C <artifactsRoot> worktree add --detach
<companion.worktree> origin/<default>`. Build mode: `resolve <type> <slug>`
(`conflict`/`branch-mismatch`/`missing` hard stops, `complete` stops); owner from
`worktrees[]` (primary → stop; managed → resume); else worktree on the exact branch
(origin-only → local tracking branch; nowhere → stop); companion half on the same
branch name (tracking `origin/<branch>` when present, else `--no-track -b <branch>
… origin/<default>` with a note); existing companion half reused untouched.

**CLI building blocks** — `scripts/agento.mjs`:

- Dispatch `switch (command)` (line ~1157); `parseArgs` supports `--root`, `--pr`,
  `--write`, `--apply`, `--plugin-root`, `--for`; any other `--flag` is a usage
  error. `usage()` prints header lines `slice(1, 24)`; exit codes 0 usable / 1 usage /
  3 resolution failure (`withExit`, `emit`).
- `resolveSessionPaths(kind, id)` (line ~320) gives `worktree`, `branch`,
  `companion { worktreesDir, worktree, branch }`, `workspace`, `layout`,
  `productWorktrees`; the `paths` case computes `worktreeState` / `companion.state`
  via `halfState` (session-state.mjs) and `originOf`.
- The `workspace` case (line ~1380) builds `sessionWorkspaceDocument(...)`
  (session-state.mjs) and writes it when `!workspaceDocumentCurrent(...)` — inline
  code to be extracted into a shared function.
- `resolveWithLayout(type, slug)` (line ~256) for the roadmap; `findOwner`,
  `classifyWorktrees`, `deriveRole`, `deriveDelivery`, `deriveLifecycle`,
  `deriveAllowed` (session-state.mjs) for the window check and rejections; the
  `session` case (line ~1415) assembles the record inline.
- `checksFor(COMMAND_NEEDS["start-session"])` + `runDoctor(ids)` (lines ~840–870);
  `COMMAND_NEEDS["start-session"] = ["terminal", "code"]`; the `code` check is `warn`
  with fallback "keep the worktree and print `code --new-window <worktree-path>`".
- `probe()` already runs bounded child processes with `GIT_TERMINAL_PROMPT=0` and a
  10 s timeout; no code path runs `git worktree add`, `git fetch`, or `code` today.
- `deriveNext` (session-state.mjs ~line 465–485) emits `start-session` transitions
  with `window: "here"`, `args: ["<type>/<slug>"(, "--resume")]` or `[]` (initiative
  member), and `then: "/agento continue <slug>"`.

**Tests** — `scripts/agento.test.mjs`: `makeRepo({ config, companion })` (line 21)
creates a product repo with a bare origin (and `project-docs` companion with its own
bare origin), `makePairRepo()` (line ~420), `run(cwd, ...args)`, `runWith({ cwd, env
})`, `restrictedPath({ ... })` for stub binaries (used with `prStub` for `gh`); the
#86 test (wrong-clone half) and #58 workspace test are the templates for the new
cases. `scripts/session-state.test.mjs` holds pure-helper tests.
`tests/customizations.test.mjs`: the #58 test (line 274) requires `agento.mjs
workspace` in the start-session and start-freehand prompts and mirrors; the doctor
test (line 417) requires every prompt that needs gh/code/network to cite `doctor
--for <name>`; the needs-table test requires the CLI table to match `Needs:`; the
`git worktree list --porcelain` allowlist includes start-session.

**Extension** — `extension/src/cliClient.ts`: `CliClient.run(args, root)` with one
constructor-level `timeoutMs` (default 30 000), exit codes 0/1/3 accepted.
`extension/src/newPlanFlow.ts`: `runNewPlanFlow` submits `/agento start-session` to
chat in the primary (`submitCommand`), then polls `readSession` for a new `plan-*`
worktree up to `NEW_PLAN_FLOW_DEFAULTS` (1 s / 300 s) and calls `handoff()` (saves
the pending command, opens the target). `extension/src/commandDispatcher.ts`:
`dispatchCommandAction` → `routeCommandAction` (`extension/src/dispatchRouting.ts`):
a refreshed `next` with `window: "here"` submits the action (or `/agento continue
<slug>`) to chat — so start-session play buttons go through chat today.
`extension/src/extension.ts` lines 279–350 wire `openTarget` (`vscode.openFolder`,
`forceNewWindow`), `dispatchAction`, `productionNewPlanDependencies`, `startNewPlan`.
Tests: `extension/test/unit/{newPlanFlow,planPlayButtonHandoff,commandDispatcher,
dispatchRouting,cliClient,extensionIntegration}.test.ts`;
`extension/test/electron/suite.ts` lines ~180–220 assert New Plan submits
`/agento start-session` to the primary.

**Docs** — `docs/commands.md` (command table line 7, CLI paragraph, flow diagrams),
`docs/extension.md` (New Plan, dispatch), `docs/model-profiles.md`, `CHANGELOG.md`
`## Unreleased`.

**Lint baseline (policy §5).** Full-repository lint for this repo is shellcheck over
the shell scripts. `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` exits
127 here (shellcheck is not installed on this machine); the equivalent used by
earlier deliveries, `git ls-files '*.sh' | xargs pnpm dlx shellcheck`, exits **0 with
no findings**. Test baseline: `node --test 'scripts/**/*.test.mjs'
'tests/**/*.test.mjs'` exits 0, **289/289 pass**. Extension dependencies are not
installed in the planning worktree (`extension/node_modules` absent), so the
extension typecheck / unit / electron baseline is recorded by roadmap step 1.1 after
`npm ci`. Overlap decision: the shell baseline is green, so the **full gate** applies
(no scoped gate); if step 1.1 finds a red extension baseline, the Builder reassesses
overlap per §5 before continuing.

**Concurrent deliveries.** `gh pr list --state open` returned no open PRs in this
repository at planning time: no file overlap.

## Approach

### Phase A — CLI: `agento.mjs start-session [<feature|issue>/<slug> | <session-id>] [--resume] [--no-open]`

Pure helpers in `scripts/session-state.mjs` (unit-tested in
`scripts/session-state.test.mjs`):

- `nextSessionId({ now, taken })` — UTC `YYYYMMDD-HHMMSS` from `now`, then `-2`,
  `-3`, … until the id is not in `taken`.
- `classifyFetchFailure(stderr)` — `"auth"` for authentication/authorization
  failures (`Authentication failed`, `could not read Username`, `Permission denied
  (publickey)`, HTTP 401/403, `terminal prompts disabled`), else `"other"`.

Refactors in `scripts/agento.mjs`, no behavior change: extract the `workspace` case's
document build + conditional write into `writeSessionWorkspace(resolved)`; extract
the `session` case's record assembly into `sessionRecord()` so both the `session`
case and `start-session` use it.

The `start-session` case, in order:

1. **Arguments.** At most one positional: `feature/<slug>` | `issue/<slug>` → build
   mode; blank or a session id matching `[a-z0-9][a-z0-9-]{1,63}` → plan mode;
   anything else, extra positionals, or `--resume` in plan mode without an id → usage
   error (exit 1). `parseArgs` gains `--resume` and `--no-open`; the usage header
   gains one `start-session` line and `usage()`'s slice widens by one.
2. **Window check** (from `sessionRecord()`): `role: "primary"`, `worktree.branch`
   equal to `branches.default`, and `git status --porcelain` empty in the primary;
   otherwise `status: "rejected"`, `reason: "wrong window: role=<role> (<path>,
   branch <branch|detached>)"` (or `primary checkout not on <default>` / `primary
   checkout is dirty`), with the record's `allowed` / `elsewhere`. Nothing written.
3. **Doctor**: `runDoctor(checksFor(COMMAND_NEEDS["start-session"]))`; `fail` →
   `rejected` naming the failing check's `detail` and `fallback`; each `warn` →
   `preflight[]` entry `{ id, status, detail, fallback }` and continue.
4. **Fetch** `git -C <primary> fetch origin` with `GIT_TERMINAL_PROMPT=0` and a 30 s
   timeout (companion: `git -C <companion clone> fetch origin` the same way, when
   companion mode applies). `auth` failure → `status: "failed"`, `reason:
   "fetch-auth"`, `reauth` naming `gh auth login` for an https GitHub origin, else
   the remote URL to re-authenticate; any other failure or timeout → a `warnings[]`
   entry and continue from local refs.
5. **Plan mode**: id = argument or `nextSessionId({ now: new Date(), taken })` where
   `taken` = ids whose managed path exists or is registered in either clone.
   Registered product half → `outcome: "resumed"`, untouched. New → `git -C <primary>
   worktree add --detach <path> origin/<default>` (verify detached at
   `origin/<default>`). Companion half: registered → reused untouched; else `git -C
   <companion clone> worktree add --detach <companion.worktree> origin/<default>`.
6. **Build mode**: `resolveWithLayout(type, slug)`; `conflict` / `branch-mismatch` /
   `missing` → `rejected` with the resolver `message`; `status: complete` →
   `rejected` ("no build session is needed"). Owner via `findOwner`: primary →
   `rejected` (return the primary to `<default>` first); managed → `outcome:
   "resumed"`, that path reused untouched (promoted `plan-*` included). Else create
   the half on the exact branch: local branch exists → `worktree add <path>
   <branch>`; only `origin/<branch>` → `worktree add --track -b <branch> <path>
   origin/<branch>`; nowhere → `rejected` ("the delivery planner must publish it").
   Companion half: registered → reused untouched; `origin/<branch>` in the companion
   → tracking add; else `worktree add --no-track -b <branch> <companion.worktree>
   origin/<default>` with a `warnings[]` note to `git -C <companion.worktree> push -u
   origin <branch>`.
7. **Post-add check** for both halves (created or reused) with `halfState`: any
   `ok: false` → `status: "failed"`, `reason: "post-add-check"`, `half`,
   `registeredIn`, `origin`, `expectedOrigin`, and `fix: "git -C <clone> worktree
   remove <path>"` (`<clone>` = primary when `registeredIn: "product"`, companion
   clone when `"companion"`; `registeredIn: null` reports the add's stderr). Nothing
   is removed or repaired; the workspace file is not written and no window opens.
   A failing `git worktree add` is likewise `failed` with its stderr.
8. **Workspace file** (companion mode, both halves present): `writeSessionWorkspace`
   — written when missing or stale, so a resume refreshes it.
9. **Open**: `target` = `{ kind: "workspace", path }` with a pair, else `{ kind:
   "folder", path }`. Without `--no-open`, run `code --new-window <target.path>`
   (bounded 15 s); success → `opened: true`; missing `code` or failure → `opened:
   false` and `openCommand: "code --new-window <target.path>"` (the §10 code
   fallback). The window opens on resume too: VS Code focuses an already-open
   folder or workspace instead of duplicating it, matching the §9 row "the window
   reopened". `--no-open` → `opened: false`, `openCommand` still reported.

Output — one JSON document: `status` (`ok` | `rejected` | `failed`), `mode` (`plan` |
`build`), `subject` (session id or `<type>/<slug>`), `outcome` (`created` |
`resumed` | null), `product { path, branch, detached, state }`, `companion { path,
branch, detached, state } | null`, `workspace { path, written } | null`, `target`,
`opened`, `openCommand`, `next` (commands for the new window: `["/agento new-feature
<description>", "/agento new-issue <description>"]` in plan mode,
`["/agento build-<type> <slug>"]` in build mode), `preflight[]`, `reason`, `fix`,
`reauth`, `allowed`, `elsewhere`, `warnings[]`, `root`, `configSource`. Exit 0 for
`ok`, 3 for `rejected`/`failed`, 1 for usage errors. Then `cd extension && npm run
copy-cli`.

### Phase B — Prompt

Rewrite `.github/prompts/start-session.prompt.md` and the byte-identical
`commands/start-session.md` to: keep the frontmatter, `Needs: terminal, code`,
`Fallback:` line, §10 pointer, and the window-check line; run
`node <agento-root>/scripts/agento.mjs start-session <args>` once (the CLI performs
the window check, the `doctor --for start-session` checks, fetch, worktree adds,
post-add check, workspace write, and open); then map its JSON to the §9 receipt
(`accepted` | `rejected — <reason>; allowed: …` copied from `allowed`/`elsewhere` |
capability rejection), one `Preflight:` line per `preflight[]` entry (§10), the
report (paths, outcome, branch, workspace, `opened` or the `openCommand` fallback,
dependency-install note), §12 command blocks for `next`, and the §9 result line. No
fallback procedure: an unexpected CLI failure is `Result: failed — <CLI reason>;
re-sending resumes`. `tests/customizations.test.mjs` #58 test: start-session's
prompt and mirror satisfy it with `agento.mjs start-session` (start-freehand still
needs `agento.mjs workspace`).

### Phase C — Extension

- `extension/src/cliClient.ts`: `run(args, root, options?: { timeoutMs?: number })`
  overrides the per-call timeout; the default stays 30 s. Start-session calls use
  `START_SESSION_TIMEOUT_MS = 120_000` (two bounded 30 s fetches plus checkout).
- `extension/src/newPlanFlow.ts`: replace `submitCommand` + the poll loop with a
  `startSession(args)` dependency that runs the CLI with `--no-open` against the
  primary and returns the parsed result; `status: "ok"` → `handoff(request, target)`
  (unchanged: save pending command, open target); `rejected`/`failed` → result
  `kind: "failed"` with the CLI `reason` and an **Open in chat** recovery that submits
  `/agento start-session` to chat in the primary. Remove `NEW_PLAN_FLOW_DEFAULTS`, the
  poll options, and the `timeout`/`ambiguous` result kinds. The attached-plan-window
  shortcut (`role: plan`, detached) stays.
- `extension/src/commandDispatcher.ts` (+ `dispatchRouting.ts` as needed): a
  start-session action — an action whose command is `/agento start-session …`, or a
  refreshed `next` whose `command` is `start-session` — runs the CLI (`next.args`, or
  the action's arguments) with `--no-open`, then saves `next.then` as the pending
  command for the returned `target` when present and calls `openTarget`. Rejected or
  failed → error notification with the CLI `reason` and an **Open in chat** action
  (submits the original command to chat). Applies to the Deliveries and Initiatives
  play buttons and `/agento continue` routes.
- `extension/src/extension.ts`: wire the `startSession` dependency for both paths.
- Tests: `newPlanFlow.test.ts`, `planPlayButtonHandoff.test.ts` (no more 5-minute
  poll; the #77 scenario becomes "the CLI result is handed off directly"),
  `commandDispatcher.test.ts`, `dispatchRouting.test.ts`, `cliClient.test.ts`,
  `extensionIntegration.test.ts` source-shape assertions, and
  `extension/test/electron/suite.ts` (New Plan runs the production `startSession`
  against a temporary git fixture with a bare origin — in-repo and companion — with
  `openTarget` stubbed, asserting the pending command is queued for the returned
  target and nothing is submitted to chat).

### Phase D — Docs

`docs/commands.md` (start-session row and CLI paragraph: the subcommand, flags,
output, exit codes), `docs/extension.md` (New Plan and play buttons call the CLI; the
Open in chat fallback; no poll), `docs/model-profiles.md` (start-session is now a
thin formatter: pin it to a fast model, e.g. via `prompts.start-session`),
`CHANGELOG.md` `## Unreleased` entry.

## Risks

- **Behavior drift between the old prompt and the CLI.** The CLI becomes the only
  implementation of the start-session rules. Mitigation: one agento.test.mjs case per
  rule listed in Research (plan new/resumed/collision, build branch variants, owner
  variants, companion branch variants, wrong-clone half, workspace refresh,
  `--no-open`, window/dirty rejections), in both layouts.
- **Fetch hangs or prompts for credentials.** Mitigation: `GIT_TERMINAL_PROMPT=0`,
  30 s timeout per fetch, auth failures stop with a named re-login command, other
  failures warn and continue from local refs.
- **`code --new-window` blocks or is missing.** Mitigation: bounded 15 s call;
  failure keeps the worktree and reports `openCommand` (§10 code fallback); the
  extension never asks the CLI to open.
- **Opening on build-mode resume.** The old prompt said "do not open a second
  window" for a managed owner; the CLI opens the target anyway because VS Code
  focuses an already-open folder/workspace, and the §9 idempotency row and
  `deriveNext` ("reopen its worktree window") expect the window reopened. The prompt
  text is updated to say so.
- **Extension timeouts.** A slow network could exceed 120 s. Mitigation: the CLI's
  own fetch bounds (2 × 30 s) keep the total under the extension timeout; a timeout
  surfaces as an error with the Open in chat action.
- **Model-profile pins mark prompt files skip-worktree**; the dirty check uses `git
  status --porcelain`, which already ignores them (docs/model-profiles.md), so the
  clean-primary rule behaves as today.
- **Real-run verification touches the user's agento primary checkout.** Step 6.3 runs
  only when `/home/david/DP/agento` is on `main` and clean, with `--no-open`, and
  removes the session it created (its product half, companion half, and
  `.code-workspace` file — a clean, detached, unpublished pair, exactly what
  `/agento close-session <session-id>` removes for a plan session). If the primary
  is not on a clean `main`, the step is blocked and the roadmap pauses for the user.
- **Concurrent deliveries.** None open at planning time; integrate `origin/main`
  before every push regardless.

## Out of scope

- Moving `/agento start-freehand` and `/agento close-session` onto CLI subcommands
  (follow-ups).
- Changing any model pin or shipping a default profile.
- Changing the session record, `deriveAllowed`, or `deriveNext` tables.
- Any automatic repair or removal of a mis-registered worktree.
- The `paths` output reporting the companion clone (not the half) as
  `artifactsRoot` in a managed pair.

## Acceptance checklist

- [ ] `node scripts/agento.mjs start-session` exists with `--resume` / `--no-open`, a
      usage header line, and the JSON contract in Approach — verified by agento.test.mjs
      usage and output-shape cases.
- [ ] Plan mode creates a detached pair at `origin/<default>` (in-repo: product only),
      resumes a registered session untouched, and generates collision-free ids
      (`nextSessionId` unit tests) — verified by agento.test.mjs and
      session-state.test.mjs.
- [ ] Build mode covers: local branch, origin-only branch (tracking), missing branch
      (rejected), complete roadmap (rejected), primary-owned branch (rejected),
      managed owner (resumed untouched), companion branch on origin (tracking) and
      absent (`--no-track -b` + warning) — verified by agento.test.mjs cases in both
      layouts.
- [ ] Wrong window, non-default primary branch, and dirty primary are rejected with
      the session record's `allowed`/`elsewhere` and write nothing — verified by
      agento.test.mjs.
- [ ] A half registered in the wrong clone fails the post-add check with `fix: git
      -C <clone> worktree remove <path>`, writes no workspace file, opens nothing, and
      removes nothing — verified by agento.test.mjs.
- [ ] Companion mode writes (and on resume refreshes) the `.code-workspace` file;
      `--no-open` never runs `code`; without it a stubbed `code` receives
      `--new-window <target>`; a missing `code` yields `opened: false` and
      `openCommand` — verified by agento.test.mjs with `restrictedPath` stubs.
- [ ] An authentication fetch failure stops with `reason: "fetch-auth"` and a
      re-login command; an unreachable origin warns and continues — verified by
      session-state.test.mjs (`classifyFetchFailure`) and an agento.test.mjs case.
- [ ] `extension/cli/` is a fresh copy of `scripts/` — verified by `node --test
      tests/extension-bundle.test.mjs`.
- [ ] The start-session prompt and `commands/start-session.md` are byte-identical,
      call `agento.mjs start-session` once, keep `Needs:`/`Fallback:`/window-check
      lines, cite the `doctor --for start-session` checks, map the JSON to §9/§10/§12
      output, and keep no step-by-step fallback — verified by `cmp` and
      `node --test tests/customizations.test.mjs`.
- [ ] `CliClient.run` accepts a per-call timeout (default 30 s unchanged) — verified
      by `cliClient.test.ts`.
- [ ] New Plan runs the CLI with `--no-open`, hands off to the returned target with
      the pending command, never submits to chat on success, has no poll defaults,
      and on rejected/failed shows the CLI reason with an Open in chat action —
      verified by `newPlanFlow.test.ts`, `planPlayButtonHandoff.test.ts`, and the
      Electron suite.
- [ ] Start-session play buttons and `/agento continue` routes run the CLI, queue
      `next.then` in the target, and open it; failures show the reason with Open in
      chat — verified by `commandDispatcher.test.ts` / `dispatchRouting.test.ts`.
- [ ] Docs and CHANGELOG describe the subcommand, the extension behavior, and the
      fast-model recommendation — verified by grep of `docs/commands.md`,
      `docs/extension.md`, `docs/model-profiles.md`, `CHANGELOG.md`.
- [ ] Full gate green and compared with the baseline: `git ls-files '*.sh' | xargs
      pnpm dlx shellcheck` (exit 0, no findings), `node --test 'scripts/**/*.test.mjs'
      'tests/**/*.test.mjs'` (exit 0, ≥ 289 pass), both replay-guard runs, `cd
      extension && npm run build && npm run test:unit && npm run test:electron` (exit
      0) — recorded on roadmap step 6.1.
- [ ] Speed: the companion-fixture start-session test case completes in seconds
      (recorded `duration_ms`), and a real `start-session --no-open` against the agento
      primary checkout completes in seconds (recorded `time`), after which that session
      is removed and the primary's `session` record lists no leftover `plan-<id>`
      entry — recorded on roadmap steps 6.2–6.3.
