# Auto-open Mission Control on every top-level /agento command

## Problem

The Mission Control canvas (`canvas/agento-mission-control/`) shows the delivery
kanban, initiative wave graph, timeline, worktree map, and activity feed, but it only
appears when the user explicitly runs `/agento mission-control`. Every other command
changes delivery state without the board being visible or refreshed, and the activity
feed never records what commands concluded. Users have to remember to open the canvas
in each VS Code window and to refresh it after each transition.

The CLI and hooks cannot open a canvas — only the chat agent can, through its
`open_canvas` tool — and there is no tool that lists which canvases are open. So the
behavior has to be an instruction the agent follows, guarded by a cheap CLI fact
document that says when to even try:

1. `invoke_canvas_action` on `instanceId: "mission-control"` with `refresh`. If the
   canvas is open this succeeds and refreshes the board for the command about to run.
2. If that call errors, the canvas is not open: `open_canvas` with canvas id
   `agento-mission-control` and the same `instanceId`.
3. Before the final result line, `post_note` the command's §9 result line to the
   activity feed.

Refreshing first avoids pulling focus to the panel on every command (re-opening the
same `instanceId` reuses the live canvas but focuses it).

## Decisions

Clarifying questions asked 2026-10-26 (recommended option listed first in each; the
user's answer recorded verbatim as the selected option id):

1. **Which commands run the check?** Options: `all-top-level` — every /agento
   command, top-level session only (recommended); `stateful-only`; `explicit-only`.
   Answer: `scope=all-top-level` (the recommended option).
2. **Where is the instruction declared?** Options: `policy-11-plus-preflight` —
   delivery-policy §11 step + a preflight `canvas` field (recommended);
   `router-skill-plus-preflight`; `policy-11-only`. Answer:
   `placement=policy-11-plus-preflight` (the recommended option).
3. **Default for `missionControl.autoOpen`?** Options: `on` — `true`, opt out per
   repository (recommended); `off`. Answer: `default=on` (the recommended option).
4. **Activity-feed notes (`post_note`)?** Options: `result-note` — refresh at start +
   one `post_note` carrying the §9 result line at the end, level `success`, or `warn`
   on failed/rejected, plus the slug (recommended); `start-and-end`; `none`. Answer:
   `notes=result-note` (the recommended option).
5. **Refresh PR state (`refresh {pr:true}`)?** Options: `ship-status-only` — only for
   `ship` and `delivery-status` (recommended); `never`; `always`. Answer:
   `pr=ship-status-only` (the recommended option).
6. Follow-up asked after research showed that the router dispatches
   `build-*`/`review-*` as subagents, which skip the step: **Canvas check for
   router-dispatched subagent commands?** Options: `router-canvas-subcommand` — the
   router's Subagent mode runs a new read-only `agento.mjs canvas <command>`
   subcommand and does refresh/open before the subagent and the result note after
   relaying (recommended); `router-preflight` — the router runs the full preflight;
   `skip`. Answer: `subagentDispatch=router-canvas-subcommand` (the recommended
   option).

Design constraints carried from the intake (user-authored):

- Canvases load only in local Copilot-harness sessions with `chat.canvases.enabled`
  on; elsewhere the step skips **silently** — no warning on every command.
- Subagents may not have `open_canvas`; only the top-level session does the step.
- Do not add a `canvas` token to the §10 `Needs:` vocabulary (it would force edits to
  every prompt, agent, and the `doctor` table checked by
  `tests/customizations.test.mjs`); one §11 step is the declaration.
- A repository can turn it off with `.github/agento.json` `missionControl.autoOpen`.
- Cost: one to two extra tool calls per command (plus the closing note). Each window
  gets its own panel; all share one feed history.

## Research

Skills consulted: none — no matching domain (this repository's AGENTS.md has no
`## Agento` skills table and there is no `.agents/skills/` directory; the built-in
`agent-customization` skill does not apply because no `.agent.md`/`.prompt.md`
frontmatter or tool lists change — only instruction prose).

### Canvas behavior (probed 2026-10-26)

- `list_canvas_capabilities agento-mission-control` → actions `refresh` (`{ pr?:
  boolean }`, returns lane counts), `get_snapshot`, `focus`, `post_note` (`{ text
  ≤ 500 chars, slug?, level?: info|success|warn }`).
- `invoke_canvas_action refresh` on a never-opened `instanceId` fails with: `Canvas
  instance "mc-autoopen-probe-never-opened" is not open. No canvases are currently
  open — call open_canvas first`. The refresh-then-open-on-error design is therefore
  sound: the error is the "not open" signal.
- `/agento mission-control` already opens with `instanceId: "mission-control"`
  (`skills/agento/commands/mission-control.md` step 1, mirrored in
  `.github/prompts/mission-control.prompt.md`), so the auto-open reuses that same
  panel handle.
- The feed is persisted per repository in
  `<copilot-home>/extension-data/agento-mission-control/<repo-key>.json`
  (`canvas/agento-mission-control/store.mjs`, `appendNote()`), hence shared across
  windows.

### CLI touchpoints

- `preflightDocument()` in `scripts/agento.mjs` (≈ lines 4592–4619) assembles
  `status, command, opId, subject, receipt, preflightLines, session, window, doctor,
  resolve, config, root, configSource`; dispatched by `case "preflight":`. Tests:
  `scripts/agento.test.mjs` "preflight turns doctor warn into preflight lines…"
  (≈ 2163) and "preflight usage errors exit 1" (≈ 2183).
- Canvas install facts already exist: `harnessFacts()` (≈ 1107–1126) returns
  `canvasLink` (`copilotExtensionsDir()`/`agento-mission-control`, honoring
  `AGENTO_COPILOT_EXTENSIONS_DIR` and `COPILOT_HOME`), `canvasExpected`, and
  `hasCanvas`; `linkState()` in `scripts/harness.mjs` classifies `installed | absent
  | foreign | dangling | not-a-link` with filesystem reads only (no spawn, no
  network). The `doctor` check `canvas` (≈ 1073) uses the same pair and is
  informational (not in `CAPABILITY_CHECKS`).
- `chat.canvases.enabled` is not read anywhere today. The `hook-wiring` doctor check
  (≈ 1039) already reads VS Code user settings with `vscodeSettingsPath()`
  (`AGENTO_VSCODE_SETTINGS` test override) and `parseJsonc()` — reuse both.
- Hosted sessions are already flagged by `session.hosted`.
- Config: `defaultConfig()` in `scripts/agento-config.mjs` declares nested defaults
  (`artifacts`, `worktrees`, `branches`, `checks`); `mergeConfig()` merges nested
  objects and treats `null` as "keep the default" (the template ships nulls).
  `configDocument()` spreads `...config`, so a new top-level key flows into
  `preflight.config` automatically. Tests: `scripts/agento-config.test.mjs` ("the
  shipped templates/agento.json loads without clobbering defaults", ≈ 96) and
  `scripts/agento.test.mjs` (template loads ≈ 113, 3153).
- Router: `skills/agento/SKILL.md` step 5 dispatches `🔨 Agento Builder` and
  `🔍 Agento Reviewer` commands as subagents and relays their final message; it does
  not call preflight itself. The Autopilot (`.github/agents/delivery-autopilot.agent.md`)
  runs Builder/Reviewer as subagents with no explicit "subagent" marker — subagent
  status is the agent's own knowledge of how it was invoked.
- `extension/cli/` is a byte copy of `scripts/`; `tests/extension-bundle.test.mjs`
  ("extension CLI bundle contains exactly the source modules") enforces it — run
  `cd extension && npm run copy-cli` after editing `scripts/`.
- `tests/customizations.test.mjs`: `§N` references must name an existing `## N.`
  heading (≥ 12 sections); every command/agent keeps its `Needs:` first line, its
  `Window check per §11` line, and one `agento.mjs preflight` call. Nothing pins §11's
  step count or the delivery policy's length (the 40-line budget applies to
  `agento-core.instructions.md` only), so adding §11 step 6 needs no test changes.
- Docs naming preflight/config/harness: `docs/commands.md` (`## Preflight` ≈ 648,
  subcommand list ≈ 429), `docs/project-profile.md` (`.github/agento.json` block and
  key table), `README.md` (`## Configuration` ≈ 515), `docs/install.md` (≈ 103,
  canvas prerequisites), `docs/copilot-harness.md` (≈ 430), `docs/extension.md`
  (≈ 375), `AGENTS.md` (`scripts/` subcommand list), `CHANGELOG.md`.

### Lint baseline (2026-10-26, `f6d911f`)

- Full-repository lint (AGENTS.md "Shell lint"): `shellcheck scripts/hooks/*.sh
  scripts/wait-for-checks.sh` with ShellCheck 0.10.0 (not on this machine's PATH; run
  from the release tarball) — **exit 0, no findings**. There is no JavaScript lint
  command in AGENTS.md.
- Tests: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'
  'canvas/**/*.test.mjs'` — **816 tests, 816 pass, 0 fail**.
- Guard smoke: `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` — exit 0.
- Overlap decision: baseline is green; this delivery changes no `.sh` files. No
  cleanup is required and no scoped gate is needed — the **full** gate applies: the
  full shell lint stays at zero findings and the full test command passes.
- Concurrent deliveries: `gh pr list --state open` returned none on 2026-10-26 — no
  overlapping branches.

## Approach

**1. Config — `missionControl.autoOpen`.** Add `missionControl: { autoOpen: true }`
to `defaultConfig()` in `scripts/agento-config.mjs`, and `"missionControl": {
"autoOpen": null }` to `templates/agento.json` (null keeps the default, like the
other template keys). Document it in `docs/project-profile.md` (json block + key
table) and `README.md` `## Configuration`.

**2. CLI — the `canvas` fact document.** Add `canvasDocument({ command, session })`
in `scripts/agento.mjs`, built only from local reads (`harnessFacts()` +
`linkState()`, `vscodeSettingsPath()` + `parseJsonc()`, the loaded config, and
`session.hosted`):

```json
{
  "attempt": true,
  "reason": "canvas installed, chat.canvases.enabled true",
  "canvasId": "agento-mission-control",
  "instanceId": "mission-control",
  "autoOpen": true,
  "link": "installed",
  "setting": true,
  "refresh": { "pr": false }
}
```

- `attempt` is `true` only when `autoOpen` is `true`, the clone ships the canvas
  (`hasCanvas`), the link state is `installed`, `setting !== false`, the session is
  not `hosted`, and the command is not `mission-control` (which opens the canvas
  itself). `reason` names the first failing condition (for example
  `missionControl.autoOpen is false in .github/agento.json`, `canvas link absent`,
  `chat.canvases.enabled is false`, `hosted session`, `mission-control opens the
  canvas itself`).
- `setting` is the user-settings value of `chat.canvases.enabled`: `true`, `false`,
  or `null` when unset or unreadable (unknown never blocks the attempt; the agent's
  missing canvas tools are the final silent skip).
- `refresh.pr` is `true` only for `ship` and `delivery-status`.
- Embed it as a `canvas` field of `preflightDocument()` (it never changes `status`,
  `receipt`, or `preflightLines` — no warning line, ever) and expose it standalone as
  a new read-only subcommand `agento.mjs canvas <command>` (exit 0; unknown or
  missing command → usage error exit 1, like `preflight`), with a usage header line.
  The `canvas` subcommand runs no doctor checks, no git network, and no `gh`.

**3. Policy — delivery-policy §11 step 6 "Mission Control".** Append to the §11
procedure (wording to be finalised by the Builder, keeping every `## N.` anchor):

> 6. **Mission Control.** A top-level session — never a subagent — reads the
> preflight `canvas` field. When `canvas.attempt` is `true` and the session has the
> canvas tools: right after printing the receipt and preflight lines, call
> `invoke_canvas_action` with `instanceId: "mission-control"`, action `refresh`, and
> input `{ "pr": canvas.refresh.pr }`; if it errors, call `open_canvas` with
> `agento-mission-control` and the same `instanceId` and input `{}`. Directly before
> the final line, call `post_note` with the result line (or, for a rejection, the
> receipt line) truncated to 500 characters, the slug when the command has one, and
> level `success` — `warn` for `Result: failed` or a rejection. Any canvas error or
> missing tool is skipped silently; nothing about the canvas is printed, and it never
> changes the receipt, the result, or the command's outcome. `attempt: false` skips
> the step entirely.

**4. Router — subagent dispatch.** In `skills/agento/SKILL.md` step 5 *Subagent*
mode: before invoking the subagent, run `node <agento-root>/scripts/agento.mjs canvas
<name>` and perform §11 step 6's refresh/open on its document; after relaying the
subagent's final message verbatim, post its result line as the note per §11 step 6.
Inline modes need no router change — the dispatched command's own preflight call
carries `canvas`. Add one sentence to `.github/agents/delivery-autopilot.agent.md`:
the Autopilot (top-level) performs §11 step 6 once for its run; its Builder and
Reviewer subagents skip it.

**5. Tests.** `scripts/agento-config.test.mjs`: default `true`, explicit `false`
honored, `null` keeps default, template still loads. `scripts/agento.test.mjs`: the
`canvas` field on preflight (present on accepted and rejected documents; never adds
a `preflightLines` entry) and the `canvas <command>` subcommand attempt matrix using
`AGENTO_COPILOT_EXTENSIONS_DIR` and `AGENTO_VSCODE_SETTINGS` fixtures (installed +
setting true → attempt; autoOpen false; link absent / foreign; setting false;
settings unreadable → `setting: null`, attempt true; `hosted`; `mission-control`;
`refresh.pr` for `ship`/`delivery-status` only; usage errors).
`tests/customizations.test.mjs`: §11 contains the Mission Control step naming
`refresh`, `open_canvas`, `post_note`, and `instanceId: "mission-control"`, and the
router's Subagent mode names `agento.mjs canvas`.

**6. Docs and copy.** `docs/commands.md` (`## Preflight` + subcommand list),
`docs/install.md` / `docs/copilot-harness.md` (auto-open note beside the canvas
prerequisites), `AGENTS.md` `scripts/` subcommand list (`canvas`), `CHANGELOG.md`
(new `Unreleased` entry), then `cd extension && npm run copy-cli`.

Affected files: `scripts/agento-config.mjs`, `scripts/agento.mjs`,
`templates/agento.json`, `scripts/agento-config.test.mjs`, `scripts/agento.test.mjs`,
`tests/customizations.test.mjs`, `.github/instructions/delivery-policy.instructions.md`,
`skills/agento/SKILL.md`, `.github/agents/delivery-autopilot.agent.md`,
`extension/cli/**` (generated), `docs/commands.md`, `docs/project-profile.md`,
`docs/install.md`, `docs/copilot-harness.md`, `README.md`, `AGENTS.md`,
`CHANGELOG.md`.

## Risks

- **Agents skip the step** (the policy is loaded on demand). Mitigation: the
  preflight document every command already prints from carries the self-describing
  `canvas` field; the customizations test pins the §11 step and the router wording.
- **Focus stealing / noise.** `open_canvas` runs only after `refresh` fails, so focus
  moves once per window; failures are silent by rule.
- **Setting detection is partial.** Only VS Code *user* `settings.json` is read
  (profile/workspace settings and Insiders paths are not); `null` never blocks, and an
  absent canvas tool is the final silent skip.
- **Subagent self-identification.** There is no marker; the step says "never a
  subagent" and the router does the work on the subagent's behalf. Worst case a
  subagent that does have the tools refreshes once more — harmless.
- **Shared feed across windows.** Notes interleave; each carries the slug.
- **Extra cost.** Two to three tool calls per command, accepted in the intake.
- **Concurrent delivery.** No open PRs touch these files today; integrate
  `origin/main` by merge before every push (`scripts/agento.mjs` changes often).
- **Live verification needs a local Copilot-harness session with canvases on.** If
  the Builder's session lacks the canvas tools, step 5.1 pauses as `blocked` per §3
  rather than being skipped.

## Out of scope

- A `canvas` token in the §10 `Needs:` vocabulary or the `doctor --for` table.
- Changing the canvas extension itself (`canvas/agento-mission-control/**`), its
  actions, or its feed storage.
- `focus`ing the delivery card automatically, or posting a "started" note.
- Reading workspace/profile VS Code settings or detecting the session type beyond
  `hosted`.
- Auto-opening from the VS Code extension sidebar or the hooks.

## Acceptance checklist

- [ ] `defaultConfig()` has `missionControl.autoOpen: true`; `templates/agento.json`
  ships `"missionControl": { "autoOpen": null }`; an explicit `false` is honored —
  verify: `node --test scripts/agento-config.test.mjs` passes with the new cases.
- [ ] `agento.mjs preflight <command>` includes a `canvas` field with `attempt`,
  `reason`, `canvasId`, `instanceId`, `autoOpen`, `link`, `setting`, `refresh.pr`,
  and never adds a `preflightLines` entry or changes `status`/`receipt` — verify:
  `node --test scripts/agento.test.mjs` preflight cases.
- [ ] `agento.mjs canvas <command>` returns the same document read-only (no doctor,
  no `gh`), honors every attempt condition (autoOpen, link state, setting, hosted,
  `mission-control`), sets `refresh.pr` only for `ship` and `delivery-status`, and
  exits 1 on usage errors — verify: `node --test scripts/agento.test.mjs` canvas
  matrix.
- [ ] delivery-policy §11 has step 6 Mission Control (refresh → open on error →
  closing `post_note`, top-level only, silent on failure, gated by `canvas.attempt`)
  and every `§N` reference still resolves — verify: `node --test
  tests/customizations.test.mjs`.
- [ ] The router's Subagent mode runs `agento.mjs canvas <name>`, does refresh/open
  before the subagent and the note after relaying; the Autopilot states its
  subagents skip the step — verify: `node --test tests/customizations.test.mjs` new
  assertions.
- [ ] Docs (`docs/commands.md`, `docs/project-profile.md`, `docs/install.md`,
  `docs/copilot-harness.md`, `README.md`, `AGENTS.md`, `CHANGELOG.md`) describe the
  setting, the `canvas` field/subcommand, and the auto-open behavior — verify:
  review of the diff plus `grep -n "missionControl" docs/project-profile.md README.md`.
- [ ] `extension/cli/` is regenerated — verify: `cd extension && npm run copy-cli &&
  npm run test:unit` passes and `tests/extension-bundle.test.mjs` passes.
- [ ] In a live local Copilot-harness session with the canvas closed, following §11
  step 6 for `/agento delivery-status` opens the canvas (refresh fails → open), a
  second command refreshes without reopening, and the result note appears in the
  feed — verify: `local:<port of the open_canvas url>` — `get_snapshot` succeeds after the open, and a
  screenshot of the feed showing the note is committed under `evidence/`.
- [ ] Full gate equals the green baseline — verify: full test command (≥ 816 tests,
  0 fail), all five replay-guard smoke runs exit 0, and `shellcheck
  scripts/hooks/*.sh scripts/wait-for-checks.sh` exits 0 with no findings.
