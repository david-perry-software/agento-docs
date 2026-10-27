```yaml
status: paused
branch: feature/mission-control-auto-open
last-updated: 2026-10-26
next-step: "5.1 blocked: no canvas tools in this subagent session — run the live check from a top-level local Copilot-harness session"
artifact-pr: "#69"
```

## Phase 1: Config

- [x] 1.1 Add `missionControl: { autoOpen: true }` to `defaultConfig()` in
  `scripts/agento-config.mjs` and `"missionControl": { "autoOpen": null }` to
  `templates/agento.json`; add `scripts/agento-config.test.mjs` cases (default
  `true`, explicit `false` honored, `null` keeps the default, the template still
  loads) — verify: `node --test scripts/agento-config.test.mjs` passes and `node
  scripts/agento.mjs config` shows `config.missionControl.autoOpen: true`

## Phase 2: CLI canvas facts

- [x] 2.1 Add `canvasDocument({ command, session })` to `scripts/agento.mjs` (local
  reads only: `harnessFacts()` + `linkState()`, `vscodeSettingsPath()` +
  `parseJsonc()` for `chat.canvases.enabled`, config `missionControl.autoOpen`,
  `session.hosted`; `attempt`, `reason`, `canvasId`, `instanceId`, `autoOpen`,
  `link`, `setting`, `refresh.pr` per plan.md `## Approach` 2) and embed it as
  `preflightDocument().canvas`; add `scripts/agento.test.mjs` preflight cases (field
  present on accepted and rejected documents, no extra `preflightLines`, `status` and
  `receipt` unchanged) — verify: `node --test scripts/agento.test.mjs` passes

- [x] 2.2 Add the read-only `agento.mjs canvas <command>` subcommand (same document,
  no doctor/`gh`; exit 0; unknown or missing command → usage error exit 1) with its
  usage header line, plus the attempt-matrix tests using
  `AGENTO_COPILOT_EXTENSIONS_DIR` and `AGENTO_VSCODE_SETTINGS` fixtures (installed +
  setting true; autoOpen false; link absent and foreign; setting false; unreadable
  settings → `setting: null` with attempt true; hosted; `mission-control`;
  `refresh.pr` true only for `ship` and `delivery-status`) — verify: `node --test
  scripts/agento.test.mjs` passes and `node scripts/agento.mjs canvas
  delivery-status` prints the document and exits 0

## Phase 3: Instructions

- [x] 3.1 Append step 6 **Mission Control** to the §11 procedure in
  `.github/instructions/delivery-policy.instructions.md` (top-level only; gated by
  preflight `canvas.attempt`; `refresh` with `canvas.refresh.pr` → `open_canvas` on
  error; closing `post_note` with the result or rejection receipt line ≤ 500 chars,
  slug, level `success`/`warn`; silent on any canvas failure; never alters receipt,
  result, or outcome), keeping every `## N.` anchor — verify: `node --test
  tests/customizations.test.mjs` passes

- [x] 3.2 Update `skills/agento/SKILL.md` step 5 *Subagent* mode to run `node
  <agento-root>/scripts/agento.mjs canvas <name>` and perform §11 step 6's
  refresh/open before invoking the subagent and its note after relaying; add the
  one-sentence Autopilot rule to `.github/agents/delivery-autopilot.agent.md` (the
  Autopilot does §11 step 6 once per run; its Builder/Reviewer subagents skip it) —
  verify: `node --test tests/customizations.test.mjs` passes

- [x] 3.3 Add `tests/customizations.test.mjs` assertions: §11 contains the Mission
  Control step naming `refresh`, `open_canvas`, `post_note`, and
  `instanceId: "mission-control"`; the router's Subagent mode names
  `agento.mjs canvas` — verify: `node --test tests/customizations.test.mjs` passes,
  and temporarily removing the §11 step makes the new assertion fail (restored
  afterwards)

## Phase 4: Docs and extension copy

- [x] 4.1 Document the setting, the `canvas` field and subcommand, and the
  auto-open behavior in `docs/project-profile.md` (json block + key table),
  `README.md` `## Configuration`, `docs/commands.md` (`## Preflight` and the
  subcommand list), `docs/install.md` and `docs/copilot-harness.md` (beside the
  canvas prerequisites), the `AGENTS.md` `scripts/` subcommand list, and a new
  `CHANGELOG.md` `Unreleased` entry — verify: `grep -n "missionControl"
  docs/project-profile.md README.md` and `grep -n "agento.mjs canvas"
  docs/commands.md` each match, and `node --test tests/customizations.test.mjs`
  passes

- [x] 4.2 Regenerate the extension CLI copy — verify: `cd extension && npm run
  copy-cli && npm run test:unit` passes and `node --test
  tests/extension-bundle.test.mjs` passes

## Phase 5: Live check and full gate

- [ ] 5.1 In a top-level local Copilot-harness session with the canvas closed,
  follow §11 step 6 for `/agento delivery-status`: `refresh` on `mission-control`
  fails → `open_canvas` opens it; a second command's `refresh` succeeds without
  reopening; the closing `post_note` appears in the feed — verify: `local:<port of the open_canvas url>` —
  `get_snapshot` succeeds after the open, and a screenshot of the canvas feed (via
  the `open_canvas` result `url` in the browser) showing the note is saved as
  `evidence/step-5-1-canvas-feed.png`; if this session has no canvas tools, pause as
  `5.1 blocked: no canvas tools in this session`

- [x] 5.2 Run the full gate and compare with the plan.md baseline — verify: `node
  --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'`
  (≥ 816 tests, 0 fail); the five AGENTS.md replay-guard smoke runs exit 0;
  `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` (ShellCheck 0.10.0)
  exits 0 with no findings
