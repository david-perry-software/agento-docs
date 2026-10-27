```yaml
status: paused
branch: feature/mission-control-auto-open
last-updated: 2026-10-27
next-step: "7.3"
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

- [ ] 5.1 (runs after Phase 7) In a top-level local Copilot-harness session with the canvas closed,
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

## Phase 6: Live-test fixes (2026-10-27)

- [x] 6.1 Count a foreign canvas link whose target holds `extension.mjs` as
  available in `canvasDocument()` (keep `link` reporting the raw state; `reason`
  distinguishes, e.g. `canvas installed from <target>`); add
  `scripts/agento.test.mjs` matrix cases (foreign-valid → attempt true; foreign
  without `extension.mjs` → attempt false; dangling → false) — verify: `node --test
  scripts/agento.test.mjs` passes and, on this machine, `node scripts/agento.mjs
  canvas delivery-status` returns `attempt: true`

- [x] 6.2 Add the always-on pointer to `.github/instructions/agento-core.instructions.md`
  (when preflight `canvas.attempt` is true, a top-level session performs §11 step 6:
  refresh `mission-control` → `open_canvas` on error → closing `post_note`, silently)
  plus a `tests/customizations.test.mjs` assertion that agento-core names
  `canvas.attempt` and §11 — verify: `node --test tests/customizations.test.mjs`
  passes (40-line budget included)

- [x] 6.3 Update the docs that describe the attempt conditions (`docs/commands.md`
  and any other place listing them, plus `CHANGELOG.md` entry wording) and regenerate
  extension/cli (`cd extension && npm run copy-cli && npm run test:unit`) — verify:
  those pass and `node --test tests/extension-bundle.test.mjs` passes

- [x] 6.4 Re-run the full gate: `node --test 'scripts/**/*.test.mjs'
  'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` (0 fail), the five AGENTS.md
  replay-guard smoke runs exit 0, ShellCheck 0.10.0 on `scripts/hooks/*.sh
  scripts/wait-for-checks.sh` exits 0 (fetch it: `mkdir -p /tmp/sc && curl -fsSL
  https://github.com/koalaman/shellcheck/releases/download/v0.10.0/shellcheck-v0.10.0.linux.x86_64.tar.xz
  | tar -xJ -C /tmp/sc`, binary at `/tmp/sc/shellcheck-v0.10.0/shellcheck`; delete
  `/tmp/sc` afterwards)

## Phase 7: Reliable delivery of the canvas instruction (2026-10-27)

- [x] 7.1 (added 2026-10-27) Append to the shared preflight sentence in every command and agent that has it (the sentence that says to print the preflight `receipt` and then its `preflightLines` verbatim — currently 58 occurrences across `skills/agento/commands/*.md`, `.github/prompts/*.prompt.md`, `.github/agents/*.agent.md`) a short clause: then, when its `canvas.attempt` is `true`, do §11 step 6 (top-level only; silent). Keep each `.github/prompts/<name>.prompt.md` and `skills/agento/commands/<name>.md` mirror in sync per existing tests; `mission-control` keeps the same clause (its own open replaces the step, and its `canvas.attempt` is false anyway). Add a `tests/customizations.test.mjs` assertion that every command/agent carrying the preflight sentence also names `canvas.attempt` and §11 step 6 — verify: `node --test tests/customizations.test.mjs` passes, and removing the clause from one file makes it fail (restore afterwards).

- [x] 7.2 (added 2026-10-27) Reorder `preflightDocument()` output so `canvas` comes directly after `preflightLines` (before `session`), and keep it compact; add a `scripts/agento.test.mjs` assertion that `canvas` is the key right after `preflightLines` and that `JSON.stringify(doc, null, 2)` places the `"attempt"` key within its first 600 characters for a typical document — verify: `node --test scripts/agento.test.mjs` passes and `node scripts/agento.mjs preflight delivery-status > /tmp/pf.json; head -c 600 /tmp/pf.json; rm /tmp/pf.json` shows `"attempt": true`.

- [ ] 7.3 (added 2026-10-27) Document in plan.md (dated addendum under `## Risks`, 2026-10-27 second live test) that the always-on core pointer and the router changes take effect only after merge + plugin-clone update, and that the command-file clause is the branch-testable carrier; update `docs/commands.md` `## Preflight` (field order + the clause) and `CHANGELOG.md` Unreleased wording; regenerate extension/cli (`cd extension && npm run copy-cli && npm run test:unit`) — verify: those pass and `node --test tests/extension-bundle.test.mjs` passes.

- [ ] 7.4 (added 2026-10-27) Full gate: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` (0 fail), the five AGENTS.md replay-guard smoke runs exit 0, ShellCheck 0.10.0 on `scripts/hooks/*.sh scripts/wait-for-checks.sh` exits 0 (fetch: `mkdir -p /tmp/sc && curl -fsSL https://github.com/koalaman/shellcheck/releases/download/v0.10.0/shellcheck-v0.10.0.linux.x86_64.tar.xz | tar -xJ -C /tmp/sc`; binary `/tmp/sc/shellcheck-v0.10.0/shellcheck`; delete `/tmp/sc` after).
