# Dispatch in Copilot sessions: dashboard and cross-window commands that actually submit

## Problem

The Agento extension submits every command — dashboard and Session & Doctor actions,
the pending cross-window `/agento continue <slug>`, the New Plan flow, and the
start-session **Open in chat** fallback — through one function,
`chatOpenOptions` in `extension/src/commandDispatcher.ts` (L38–L61), which calls
`workbench.action.chat.open` with `{ query, mode, attachFiles }`.

In a chat whose Session Target is **Copilot** (the Agent Host harness) the
`harness-probe` member observed that this call fills the input with
`/agento delivery-status`, attaches `delivery-status.md`, and selects Agent mode, but
it does **not** submit. The user could not send it from the input either: "the
Copilot chat input will not let you start (send) a message that begins with a slash
in this dispatch case". `/agento …` messages typed by hand do send
(`docs/copilot-harness.md` "Dispatch"; companion
`features/2026/10/harness-probe/evidence/step-2-4-copilot-observations.md` item 7 and
`step-2-4-copilot-dispatch.png`). As a result, every dashboard click is a dead end in
a Copilot session.

This feature finds out which `workbench.action.chat.open` payload submits in Copilot
and still submits in Local, then changes `chatOpenOptions` and its tests to use that
payload. The evidence is a recorded dashboard dispatch in each harness.

It is the `dispatch-copilot-harness` member of the `copilot-harness` initiative
([breakdown](../../../../initiatives/2026/10/copilot-harness/breakdown.md), block
`### dispatch-copilot-harness`). Its requirement `harness-install` is complete, and
so is its recommended predecessor `agents-copilot-models`.

## Decisions

Clarifying questions were asked with the ask-questions tool on 2026-10-17, with the
recommended option listed first. The user replied to every question: "The user is not
available to respond and will review your work later. Work autonomously and make
good decisions." The Planner therefore took the recommended option for each. Each
answer below is that choice, flagged for the user's review:

- **Q: How should the plan approach the non-submitting Copilot dispatch?** Options:
  diagnose first, then fix (recommended); go straight to a guessed fix; fill and
  notify only. **Taken: diagnose first, then fix.** The first phase records which
  `chat.open` payload variants submit in each harness, using a reproducible probe.
  The fix then implements the minimal variant that submits in both.
- **Q: The extension cannot read which Session Target the chat uses. How should
  dispatch handle both harnesses?** Options: one option set for both (recommended);
  a setting such as `agento.chatHarness`; try, then fall back. **Taken: one option
  set for both.** A single `chat.open` payload, verified to submit in Local and in
  Copilot, with no harness detection.
- **Q: If the working Copilot variant requires dropping `mode` (the agent switch),
  is that acceptable?** Options: drop it only in the Copilot path (recommended); drop
  it everywhere; it must be kept. **Taken: drop it only in the Copilot path.** Under
  the previous decision there is no separate Copilot path, so the two decisions
  combine as follows: `mode` is kept unless the probe shows it blocks submission in
  Copilot. If it does, dropping it everywhere is accepted. The installed router
  skill already selects the agent in both harnesses, because with the link in place
  Local also routes `/agento <name>` through the router (`docs/copilot-harness.md`
  "Router skill", "Local takeover").
- **Q: If no chat.open variant submits in Copilot, what should ship?** Options: fill
  the input and show an info toast (recommended); copy to the clipboard and show a
  toast; stop and replan. **Taken: fill the input and show an info toast, adjusted
  (Planner's judgement).** The probe found the Copilot input would not send the
  filled text even by hand, so "press Enter" alone may not work. The fallback
  therefore keeps the best-filling payload, also writes the command to the
  clipboard, and shows a non-modal info message: "Agento: sent `<command>` to chat.
  If it did not run, paste it into a new chat (copied)." This is recorded as a VS
  Code limitation in `docs/copilot-harness.md`.
- **Q: Copilot and Local chat dispatch can't be driven by the agent's browser. Is it
  OK to make those (manual) steps with your screenshots?** Options: yes, manual steps
  with screenshots (recommended); defer to the `harness-docs` acceptance. **Taken:
  yes, manual steps with screenshots.** The agent's integrated browser cannot drive
  the VS Code chat input or its Session Target picker (policy §1, operating the
  user's own VS Code UI). Unit and electron tests cover the payload.

Carried from the initiative breakdown: every member verifies Local too, and the
extension does not perform the harness install (it only surfaces the doctor result).

## Research

Skills consulted: agent-customization (built-in VS Code skill, for the chat, skill,
and agent-mode surfaces the dispatch targets). The Agento repository has no
`.agents/skills/` directory, and its AGENTS.md has no skills table, so no project
skill applies (verified 2026-10-17 on `main` `2a39ba1`).

**Harness facts** (`docs/copilot-harness.md`, VS Code 1.141.0 / Copilot Chat 0.69.0):

- "Dispatch" says the Copilot input is filled, the file attached, and Agent mode
  set, but nothing is submitted. A slash-leading message cannot be sent in this
  dispatch case. Typed `/agento …` sends.
- "Router skill": `~/.copilot/skills/agento` is installed. It is a symlink to
  `/home/david/DP/agento-plugin/skills/agento`, checked with `ls -la ~/.copilot/skills`
  on 2026-10-17. In both harnesses `/agento <name>` routes through the router,
  which reads `commands/<name>.md` itself.
- "Subagents": the Copilot subagent tool is `task`. Builder and Reviewer pins
  survive through the router. Planner, Architect, Mechanic, and Autopilot run inline.

**VS Code `workbench.action.chat.open`** (upstream
`src/vs/workbench/contrib/chat/browser/actions/chatActions.ts`, `main`, fetched
2026-10-17):

- `IChatViewOpenOptions` has these fields:
  - `query`, `isPartialQuery`, `mode`, `attachFiles` (`URI | {uri, range}`);
  - `modelSelector`, `toolIds`, `blockOnResponse`;
  - `preserveInput`, which submits via `acceptInput(query, { preserveInput: true })`
    without taking over the input box. It is mutually exclusive with `attachFiles`
    and `toolIds`.
- `run()` takes these steps, in order:
  1. Switch the mode with `findModeByName(opts.mode)`.
  2. Add the attachments.
  3. If `!isPartialQuery`, wait for the view model, then for
     `waitForDefaultAgent(…, currentModeKind)` (a 60 s timeout that throws).
  4. Call `setInput(query)`, then `acceptInput()`.

  The fill without a submit therefore happens at or after `acceptInput()`. Either
  the agent-host input rejects the request (for example, a slash-command parse
  failure for a mode-switched, file-attached request), or the default-agent wait
  never resolves for an agent-host session. The upstream source does not settle
  which, so phase 1 measures it.
- Upstream callers submit slash queries this way: `/init` uses
  `{mode: "agent", query, isPartialQuery: false}`. The agent-host `/compact` action
  uses `acceptInput('/compact', { preserveInput: true })` — a slash query that does
  submit in an agent-host session.

**Agento surfaces** (code, `main` `2a39ba1`):

- `extension/src/commandDispatcher.ts` — `chatOpenOptions` (L38–L61) is the only
  `workbench.action.chat.open` call in `extension/src` (checked with `grep`). It is
  reached from:
  - `dispatchCommandToTarget` for the current window (L71);
  - `dispatchCommandAction` for the start-session **Open in chat** action (L109)
    and for plain submits (L121);
  - `consumePendingCommands` for pending cross-window commands (L156).
- `extension/src/commandAgent.ts` — `resolveChatMode` (L44–L58) sets `mode` from
  `commands/<name>.md` `agent:`, and `resolveCommandFile` (L71–L78) sets
  `attachFiles`. `extension/src/extension.ts` L130–L148 wires both through
  `resolvePluginRoot` (`agento.pluginRoot` or `chat.pluginLocations`).
- Tests that pin the current payload shape:
  - `extension/test/unit/commandDispatcher.test.ts` L117, L131, L138–L173
    ("dashboard dispatch submits the command's agent as chat.open mode (issue #73 /
    dashboard-dispatch-agent-mode)"), and L238;
  - `extension/test/unit/planPlayButtonHandoff.test.ts` L92–L129 ("(b) chat.open
    options attach the command file…");
  - `extension/test/unit/newInitiativeFlow.test.ts` L152;
  - `extension/test/electron/suite.ts` L438, L728, and L773.

  `mode` comes from issue #73 (`dashboard-dispatch-agent-mode`). Dropping it is a
  deliberate reversal and must be recorded as one.
- `docs/extension.md` "Command routing" (L216–L231) documents the
  `{ query, mode, attachFiles }` contract and must stay accurate.
- `tests/harness-probe/` already holds:
  - the reproducible probe: `probe.mjs`, `PROMPTS.md`, `plugin/`, `skills/`,
    `workspace/`, and `fixtures/`;
  - `probe.test.mjs`, which includes "every relative link in
    docs/copilot-harness.md resolves" (L393).

  A dispatch probe belongs beside these files.
- The installed extension is `david-perry-software.agento-dashboard@0.7.0`
  (`code --list-extensions --show-versions`). Its plugin root resolves through
  `chat.pluginLocations` to `/home/david/DP/agento-plugin` (harness-install step
  2.1).

**Lint baseline (policy §5).** The full-repository lint is `shellcheck
scripts/hooks/*.sh scripts/wait-for-checks.sh` (AGENTS.md). It cannot run locally
because `shellcheck` is not installed (`command -v shellcheck` finds nothing). The
authoritative baseline is CI's Shellcheck step on `main` `2a39ba1`: `ci` run
`39046556589` concluded `success`, with zero findings.

Other baselines on `main` `2a39ba1`, recorded 2026-10-17:

- `cd extension && npm ci && npm run test:unit`: exit 0, 167 tests, 167 pass,
  0 fail.
- `cd extension && npm run typecheck`: exit 0.
- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`: exit 0, 560 tests,
  560 pass, 0 fail (~269 s), and green in the same CI run.

**Overlap decision:** none. This delivery touches no shell script, so no lint
cleanup is in scope. The gate is:

- the full-repository Shellcheck in the PR's CI, compared against the
  zero-finding baseline;
- the extension typecheck, unit tests, and electron tests;
- the full node suite and the guard replays.

**Concurrent deliveries.** `gh pr list --state open` returned `[]` on 2026-10-17, so
there is no file overlap. `harness-docs` (wave 6) is blocked on this member and will
edit `docs/extension.md` and `docs/copilot-harness.md` after it.

## Approach

Files touched in the product half:

- `tests/harness-probe/dispatch-probe/` (new);
- `tests/harness-probe/dispatch-probe.test.mjs` (new);
- `extension/src/commandDispatcher.ts`;
- the four test files above;
- `docs/copilot-harness.md` ("Dispatch");
- `docs/extension.md` ("Command routing").

There are no hook, prompt, command, agent, or CLI changes, so `copy-cli` is not
needed.

**1. Dispatch probe** (`tests/harness-probe/dispatch-probe/`): a dependency-free
development extension (`package.json` with `engines.vscode`, `main: extension.js`,
plain CommonJS, no build step). It contributes one command, **Agento Probe: Dispatch
variant**, which shows a QuickPick of named variants and calls
`workbench.action.chat.open` with the chosen payload. It logs the payload, the
command's settled value or thrown error, and the elapsed time to an "Agento Dispatch
Probe" output channel.

The probe resolves `commands/delivery-status.md` from the `realpath` of
`~/.copilot/skills/agento`, two levels up. Every query is `/agento delivery-status`,
except V8. The variant table is exported from a pure `variants.js` so node:test can
assert it:

| Id | Payload |
| --- | --- |
| V1 | `{query, mode: "agent", attachFiles: [file]}` — today's shape |
| V2 | `{query}` |
| V3 | `{query, mode: "agent"}` |
| V4 | `{query, attachFiles: [file]}` |
| V5 | `{query, preserveInput: true}` |
| V6 | `{query, mode: "agent", attachFiles: [file], isPartialQuery: true}`, then `workbench.action.chat.submit` |
| V7 | `{query, mode: "🔍 Agento Reviewer"}` — a custom-agent mode |
| V8 | `{query: "/agento delivery-status ", mode: "agent", attachFiles: [file]}` — trailing space |

Launch: `code --new-window --extensionDevelopmentPath=<worktree>/tests/harness-probe/dispatch-probe
/home/david/DP/agento`. The Builder runs this itself; the user only clicks and
reads.

**2. Selection rule** (applied to the recorded matrix, in this order):

- Pick the first variant that **submits in both Copilot and Local**, using this
  preference order: V1, V3, V4, V8, V6, V2, V5. The order keeps as much of `mode`
  and `attachFiles` as possible.
- A variant counts as submitted only if a request appears in the chat and the
  router prints a `Receipt: accepted delivery-status:…` line.
- If no variant submits in Copilot, keep V1 and add the fallback from `## Decisions`
  (a clipboard write plus an info message).
- The chosen variant and the matrix are written to `docs/copilot-harness.md`
  "Dispatch" and to this plan's `## Decisions` as an `(added <date>)` entry.

**3. Fix**: `chatOpenOptions` builds the chosen payload.

- If V6 is chosen: after `chat.open` it executes `workbench.action.chat.submit`.
- In the fallback case: the dispatcher gains a `writeClipboard` and an `info`
  dependency, wired in `extension.ts` to `vscode.env.clipboard.writeText` and
  `vscode.window.showInformationMessage`. The message is not awaited, so the
  dispatch flow never blocks on it.
- If `mode` is dropped, `resolveChatMode` and its `dispatch: no mode …` log lose
  their caller. Remove them only if they become unused (the typecheck shows this);
  otherwise leave them.
- The tests listed in `## Research` are updated first and must fail against the
  old code. The electron suite assertions follow.

**4. Docs:**

- `docs/extension.md` "Command routing" describes the new payload, and the
  fallback if one applies.
- `docs/copilot-harness.md` "Dispatch" records the matrix, the chosen variant, and
  that `dispatch-copilot-harness` closed the gap (or documents the remaining
  limitation).
- The `harness-docs` member owns everything broader: install, commands,
  architecture, CHANGELOG, and the version bump.

**5. Live check:**

1. The Builder runs `cd extension && npm run package` and
   `code --install-extension <vsix> --force`, which replaces the installed 0.7.0
   build with the branch build (agent-run CLI).
2. The user reloads the primary window and dispatches **delivery-status** from the
   Session & Doctor panel twice: once in a Copilot chat and once in a Local chat.

## Risks

- **No variant submits in Copilot.** Mitigation: the fallback decided in
  `## Decisions` (clipboard plus info message). The limitation is recorded in
  `docs/copilot-harness.md`, and the probe stays committed so the matrix can be
  re-run on a later VS Code build.
- **The chosen variant drops `mode`, which reverses issue #73.** In Local, the agent
  picker no longer switches on dispatch.
  - Mitigation: with the router link installed, Local already routes through the
    router, so agent selection and Builder/Reviewer pins live there.
  - Without the link, Local would lose the dispatch agent switch. This is recorded
    as a known gap for `harness-docs`.
  - The issue #73 test is rewritten deliberately, not deleted silently. Its new
    name states the reason.
- **Copilot turns are slow** (~4–12 min per `/agento` turn, from
  `docs/copilot-harness.md`). Mitigation: a variant counts as submitted when the
  request appears and the router's receipt line prints. The user does not have to
  wait for the result line, and may stop the turn after the receipt.
- **The probe window confounds the result.** The user's real plugin
  (`agento-plugin`) and the installed extension stay active, and the dashboard may
  also be visible. Mitigation: the probe command runs only from the Command Palette,
  the user uses a fresh chat per variant, and these confounds are recorded with the
  matrix.
- **The installed extension is replaced by the branch build** (step 3.1).
  Mitigation: the build is the code that ships. If the user rejects the branch,
  `/agento ship` does not run, and they reinstall 0.7.0 with
  `code --install-extension david-perry-software.agento-dashboard@0.7.0` or from
  `main`'s `npm run package`. This step is recorded on the step line.
- **Concurrent delivery.** No open PRs. `harness-docs` follows this member.
  Mitigation: integrate `origin/main` before every push.

## Out of scope

- Detecting the chat's Session Target, and per-harness payloads (decision 2).
- An extension action that installs the router link (initiative decision; the
  doctor check only).
- `docs/install.md`, `docs/commands.md`, `docs/architecture.md`, `hooks.md`,
  README, CHANGELOG, and the plugin version bump (`harness-docs`).
- Restoring Local's prompt-level model switching lost to the router takeover
  (`harness-docs` known gap).
- Changes to the router skill, `commands/*.md`, agents, hooks, or the CLI.

## Acceptance checklist

- [ ] The dispatch probe exists at `tests/harness-probe/dispatch-probe/` with the
      V1–V8 variant table, and `node --test tests/harness-probe/dispatch-probe.test.mjs`
      exits 0. The test asserts unique ids, the canonical `/agento delivery-status`
      query, and V1 equal to the pre-change extension payload shape.
- [ ] The Copilot and Local result for every variant (filled, submitted, receipt
      printed, agent and attachment shown) is recorded in
      `evidence/step-1-2-dispatch-matrix.md` with linked screenshots, and in
      `docs/copilot-harness.md` "Dispatch" along with the chosen variant.
- [ ] `chatOpenOptions` in `extension/src/commandDispatcher.ts` builds the variant
      selected by the plan's selection rule, plus the clipboard and info fallback
      only when no variant submitted in Copilot. The updated unit tests failed
      against the old code first (recorded on step 2.1).
- [ ] `cd extension && npm run typecheck` exits 0, and `npm run test:unit` exits 0
      with at least the 167-test baseline count passing.
- [ ] `cd extension && npm run test:electron` exits 0 with the updated payload
      assertions (under `xvfb-run -a` when no display is available).
- [ ] In a Copilot chat, a Session & Doctor **delivery-status** dispatch from the
      branch-built extension submits and prints the router's
      `Receipt: accepted delivery-status:…` line, with no manual retyping — or, in
      the documented fallback case, the info message appears and pasting the copied
      command runs it. Evidence: `evidence/step-3-2-copilot-dispatch.png`.
- [ ] The same dispatch in a Local chat submits and prints its receipt (Local
      parity). Evidence: `evidence/step-3-2-local-dispatch.png`.
- [ ] `docs/extension.md` "Command routing" describes the shipped payload, and
      `node --test tests/harness-probe/probe.test.mjs tests/customizations.test.mjs`
      exits 0 (doc links resolve).
- [ ] Gates: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exits 0;
      the five AGENTS.md guard replays exit 0; and the PR's CI run is green with
      Shellcheck at zero findings, matching the `2a39ba1` baseline.
- [ ] Clean handoff: `git status --porcelain --untracked-files=all` is empty in
      both halves.
