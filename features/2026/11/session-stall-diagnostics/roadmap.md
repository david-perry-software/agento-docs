```yaml
status: in-progress
branch: feature/session-stall-diagnostics
last-updated: 2026-11-03
next-step: "4.1 Drop browser from the Autopilot agent, COMMAND_NEEDS.ap, and ap.prompt.md"
initiative: "agento-speed"
artifact-pr: "#74"
```

## Phase 1: Pure parsers

- [x] 1.1 Add `parseCopilotEvents(text)` and `deriveStalls(sessions, opts)` to
  `scripts/delivery-metrics.mjs` per plan.md Approach §1 (turn gap =
  `tool.execution_complete` → next `assistant.turn_end`; start-up =
  `subagent.started` → `subagent.configured` paired by `agentId`; threshold 40 s,
  slow start-up 60 s, `summary` string or `null`), with fixtures of the observed event
  shapes in `scripts/delivery-metrics.test.mjs` (10 gaps ≥ 40 s, one 402 s start-up,
  bad lines and unknown types ignored, truncated first line tolerated) — verify:
  `node --test scripts/delivery-metrics.test.mjs` passes

- [x] 1.2 Create `scripts/lib/copilot-runtime.mjs` with the pure
  `parseMcpConfig(json, source)` (wildcard/remote flags; keeps only name, type, tools,
  url-presence, mcp-remote flag) and `countMcpTimeouts(text, { since })` (both log-line
  shapes, per-server `{ count, lastAt }`), tested in
  `scripts/lib/copilot-runtime.test.mjs` with sanitized fixtures of the exact lines in
  plan.md Research, including an assertion that `env`/`headers` values never reach the
  output — verify: `node --test scripts/lib/copilot-runtime.test.mjs` passes

## Phase 2: Readers and doctor checks

- [x] 2.1 Add the bounded readers to `scripts/lib/copilot-runtime.mjs`
  (`copilotHome()` honouring `$COPILOT_HOME`; `readSessions` with 24 h mtime filter,
  ≤ 50 sessions, 16 MB tail reads, repo membership via `workspace.yaml` `cwd`/`git_root`
  inside `productWorktrees()`/`managedHalves()`, current = newest with `cwd === root`;
  `readMcpConfigs` for `~/.copilot/mcp-config.json` and `<root>/.vscode/mcp.json`;
  `readMcpTimeouts` over `logs/process-*.log` modified in 24 h), each returning empty
  results on missing data — verify: reader tests over a fixture `COPILOT_HOME` tree in
  `scripts/lib/copilot-runtime.test.mjs` pass (missing home, foreign-repo session
  excluded, current-session selection, oversize file tail-read)

- [x] 2.2 Add the `mcp-servers` and `turn-stalls` checks to `DOCTOR_CHECKS` and
  `LOCAL_DOCTOR_CHECKS` in `scripts/lib/doctor.mjs` (no `CAPABILITY_CHECKS` group;
  warn rules per plan.md Approach §2 and the 60 min / still-configured timeout rule
  in Decisions; never `fail`; every error caught to `warn`), updating the id list at
  `scripts/commands/doctor.test.mjs:100` and adding warn/ok cases with fixture
  `COPILOT_HOME` dirs — verify: `node --test scripts/commands/doctor.test.mjs
  tests/customizations.test.mjs` passes and `node scripts/agento.mjs doctor` (live)
  lists both checks, with `mcp-servers` warning on the current `railway` wildcard entry

## Phase 3: CLI surfaces

- [x] 3.1 Add `stallsDocument()` and the `stalls` subcommand (`COMMAND_MODULES` →
  `commands/status.mjs`, usage line) and a `stalls` section in `dashboardDocument()`
  through `section()` so `timings.stalls` exists; document both in `docs/commands.md`
  — verify: new tests in `scripts/commands/status.test.mjs` (or the existing status
  test file) pass for the shape and the dashboard section, `node scripts/agento.mjs
  stalls` exits 0 with `current`/`window`/`summary`, and `node scripts/agento.mjs
  dashboard | node -e 'const d=JSON.parse(require("fs").readFileSync(0));process.exit(d.stalls&&d.timings.stalls>=0?0:1)'`
  exits 0

- [x] 3.2 Add the Stalls step to `.github/prompts/delivery-status.prompt.md` (run
  `agento.mjs stalls`; print `summary` as a **Stalls** line under the Session section
  when non-null) and copy it byte-for-byte to `skills/agento/commands/delivery-status.md`
  — verify: `node --test tests/customizations.test.mjs` passes

## Phase 4: Autopilot tool budget

- [ ] 4.1 Drop `browser` from `.github/agents/delivery-autopilot.agent.md` (`tools:` and
  `Needs:`, plus any `Fallback:` clause that only covered browser), from
  `COMMAND_NEEDS.ap` in `scripts/lib/doctor.mjs`, and from `.github/prompts/ap.prompt.md`
  `Needs:` with its byte-identical mirror `skills/agento/commands/ap.md`; Builder and
  Reviewer agents keep `browser` — verify: `node --test tests/customizations.test.mjs
  scripts/commands/doctor.test.mjs` passes, `node scripts/agento.mjs doctor --for ap`
  lists no browser capability, and `grep -n browser
  .github/agents/delivery-autopilot.agent.md` shows no tool or need entry (only
  descriptive mentions of the subagents' browser use, if any)

## Phase 5: Dashboards

- [ ] 5.1 Regenerate the extension CLI copy and surface stalls in the Session & Doctor
  view: `extension.ts` passes `dashboard.stalls`, `sessionDoctorModel.ts` parses it
  tolerantly (absent/error/malformed → no row), `sessionDoctorProvider.ts` renders a
  warning-icon "Stalls" row in the Session group; tests in
  `extension/test/unit/sessionDoctorModel.test.ts` — verify: `cd extension && npm ci
  && npm run copy-cli && npm run build && npm run test:unit` passes

- [ ] 5.2 Surface stalls in Mission Control: `snapshot.mjs` `normalize()` exposes
  `stalls` (`{ summary, stalledTurns, stalledMinutes } | null`), `public/panels/window.js`
  renders a warning tag in the window banner, `fixtures/dashboard.json` gains a
  `stalls` section, tests in `snapshot.test.mjs`/`window.test.mjs` — verify: `node
  --test 'canvas/**/*.test.mjs'` passes, and on local:3168 (`node
  canvas/agento-mission-control/dev.mjs --port 3168`) the browser shows the stall tag
  in the banner, captured as `evidence/step-5-2-canvas-stalls.png`

## Phase 6: Docs

- [ ] 6.1 Add `## Known stall sources` to `docs/copilot-harness.md` (MCP `tools/list`
  timeout mechanism, 60 s and 40–54 s signatures, subagent start-up stalls, 128-tool
  cap, observed `copilotVersion`, reading `doctor`/`stalls`, the fix), update
  `docs/extension.md` (Session & Doctor, Mission Control) and add a `CHANGELOG.md`
  entry under the next version heading per the file's convention — verify: `node
  --test tests/customizations.test.mjs` passes (canonical-command spelling) and the
  three sections read correctly

## Phase 7: Railway removal and live verification

- [ ] 7.1 (manual) Remove the `railway` entry from `~/.copilot/mcp-config.json`, run
  **Developer: Reload Window** in VS Code, open a new chat in this worktree, send any
  short prompt, and screenshot the chat showing no "128 tools … not provided" warning
  — verify: screenshot at `evidence/step-7-1-railway-removed.png`; note the removal
  time (UTC) on the step line

- [ ] 7.2 Verify the live state after removal in the session that runs this step —
  verify: `node scripts/agento.mjs doctor` reports `mcp-servers` `ok` (no configured
  wildcard server, no timeout in the last 60 min) and `turn-stalls` `ok` or 0 stalled
  turns for the current session; `node scripts/agento.mjs stalls` shows `current.stalledTurns`
  0 after ≥ 10 turns; `grep -h "MCP request timed out\|Railway MCP proxy error"
  ~/.copilot/logs/process-*.log` finds no line timestamped after the 7.1 removal time;
  outputs recorded on this step line

## Phase 8: Full gate

- [ ] 8.1 Integrate `origin/main` (both halves), then run the full gate and compare
  against the plan.md baseline — verify: `shellcheck scripts/hooks/*.sh
  scripts/wait-for-checks.sh` exits 0 with no findings (static v0.10.0 binary if not
  installed); `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'
  'canvas/**/*.test.mjs'` ≥ 843 tests, 0 fail; every guard replay smoke listed in
  AGENTS.md exits 0; `cd extension && npm run copy-cli && npm run build && npm run
  test:unit` passes; `git status --porcelain --untracked-files=all` empty in both
  halves; results recorded on this step line

## Follow-ups
