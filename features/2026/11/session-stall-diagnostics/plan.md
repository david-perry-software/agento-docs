# Session stall diagnostics: doctor MCP check, stalled-turn metrics on every dashboard, Autopilot `browser` drop

## Problem

This is member `### session-stall-diagnostics` of the
[agento-speed](../../../../initiatives/2026/11/agento-speed/breakdown.md) initiative
(wave 1, size M), brief "Remove Railway MCP (user, 1 min) and make this class of
failure visible (Agento)".

A global MCP server whose `tools/list` times out (Railway: `~/.copilot/mcp-config.json`,
`"tools": ["*"]`, 72 tools) stalls the agent loop ~60 s per turn, pushes sessions past
the 128-tool cap, and makes the first BYOK subagent start take 400–575 s. Nothing in
Agento shows it: `doctor` is green and `/agento delivery-status`, Mission Control, and
the Session & Doctor view look healthy while a night build spends 7.4 h of 35 h waiting.

After this feature `agento.mjs doctor` warns on wildcard/remote MCP servers and recent
MCP timeouts per server; the three dashboards show "N stalled turns (~M min) — check
`agento.mjs doctor`" for the current Copilot session; the harness doc names the stall
source; the Autopilot stops costing ~10 browser tools; and a post-removal verification
proves the stalls are gone.

## Decisions

The questions were asked with the ask-questions tool on 2026-11-03. Answers verbatim
(the recommended option was listed first and pre-selected for each):

1. "Railway removal & the verify step" → `manual-step` — "A (manual) roadmap step near
   the end: you remove the entry, then the Builder verifies a fresh session (doctor
   shows no timeouts, no 60 s gaps) — the new doctor check is proven against the real
   failure first" (recommended).
2. "Which session do the stall metrics cover?" → `recent-window` — "Sessions whose cwd
   is this checkout/worktree, newest one shown, plus a 24 h total across all sessions
   for this repo" (recommended).
3. "Doctor severity" → `warn-only` — "warn at most (wildcard tools, remote proxy, or
   timeouts in the newest log); never fail; missing files = ok" (recommended).
4. "Display surfaces in scope" → all four: "doctor (CLI JSON + text)",
   "delivery-status", "Session & Doctor view (extension)", "Mission Control canvas"
   (recommended default), with the note "do all".
5. "Autopilot `browser` drop" → `drop` — "Drop `browser` from tools and from its
   Needs/COMMAND_NEEDS for `ap`; subagents keep it" (recommended).

Planner decisions derived from these answers (not asked separately):

- The new checks run in full `doctor` and in `dashboard`, but join no `--for`
  capability group, so `preflight` output and latency for every command are unchanged.
- "Timeouts in the newest log" (answer 3) is read as follows. Scan every
  `process-*.log` modified in the last 24 h; the long-lived agent-host log is not the
  newest file by name. Warn on timeouts from a server that is still configured, or on
  any timeout in the last 60 min. Older timeouts from a removed server are reported in
  `detail` at `ok`, so the post-removal verification can turn green the same day.

## Research

Skills consulted: none — no matching domain (this repository's AGENTS.md has no
`## Agento` skills table; no installed skill covers Node CLI diagnostics, VS Code tree
views, or the canvas).

### Copilot runtime data (verified 2026-11-03 on this machine)

- `~/.copilot/session-state/<id>/workspace.yaml`: flat `key: value` lines (`id`,
  `cwd`, `git_root`, `repository`, `branch`, `created_at`, `updated_at`); this
  session's `cwd` is this planning worktree, `10097e97…`'s a Soshiki worktree.
- `events.jsonl`: one `{type, data, id, timestamp, parentId}` object per line
  (`agentId` on subagent events). Used types: `tool.execution_complete`,
  `assistant.turn_end`, `subagent.started`, `subagent.configured`, `session.start`
  (`data.sessionId`, `data.copilotVersion`). `session.warning` carries only
  remote-session notices — the 128-tool warning is VS Code UI only.
- Stall pair `tool.execution_complete → next assistant.turn_end`: in `10097e97`, 485
  gaps, 10 ≥ 40 s, max 60.1 s (the brief's "10 stalls ≈ 10 min").
  `subagent.configured` has no `toolCallId`; pairing by `agentId` gives 402.3 s for
  the first subagent, 0.2–0.3 s for the rest.
- `~/.copilot/mcp-config.json`: `{ mcpServers: { <name>: { type, command, args?,
  url?, tools } } }`; today `railway type=local cmd=railway tools=["*"]` (shape only
  inspected; no values printed).
- `~/.copilot/logs/process-<ms>-<pid>.log`: the long-lived host log
  `process-1793628432642-1249106.log` holds 1,180 `"server":"railway"` entries. Both
  timeout shapes must count — `… tool_catalog] Failed to refresh persisted MCP tools
  for railway; continuing with cached tools: MCP request timed out after 60000 ms` and
  `… Failed to list MCP tools; … {"server":"railway","error":"MCP request timed out
  after 59999 ms", …}`; lines start with an ISO timestamp.
- No Copilot CLI is installed, so the Builder cannot open a fresh Copilot session;
  the post-removal check runs in the session the user opens.

### Codebase (Explore subagent, file references)

- **Doctor.** `scripts/lib/doctor.mjs`: `DOCTOR_CHECKS` (39–243) return `{ status,
  detail, fallback }`; `runDoctor()` adds `id` and ranks (282–348); `COMMAND_NEEDS` /
  `CAPABILITY_CHECKS` / `checksFor()` select `--for` checks (286–328), `ap` is
  `["terminal", "browser", "gh", "network"]` (299); `LOCAL_DOCTOR_CHECKS` (350). No
  injectable home: tests use temp dirs, `AGENTO_CONFIG_HOME`, and `PATH` stubs
  (`scripts/commands/doctor.test.mjs:1-20,100-180`; id list asserted at 100).
  `canvas/agento-mission-control/store.mjs` already resolves `$COPILOT_HOME` or
  `~/.copilot` — the precedent. `scripts/commands/doctor.mjs` emits JSON only; warn
  exits 0, `fail` exits 3 (184–190).
- **Metrics.** `scripts/delivery-metrics.mjs` is pure over supplied text (1–4), with
  `parseArtifactLog`, `parseMergeLog`, `deriveMetrics`, and `aggregateMetrics`. Its
  tests are in `scripts/delivery-metrics.test.mjs`.
- **Documents.** In `scripts/lib/documents.mjs`, `metricsDocument()` (≈300) and
  `dashboardDocument()` (≈318–385) build `{ status, session, doctor, deliveries,
  initiatives, metrics, timings, root, configSource }` with a per-section `section()`
  wrapper and timings. `scripts/agento.mjs` `COMMAND_MODULES` routes `status`,
  `initiative`, `metrics`, and `dashboard` to `commands/status.mjs`.
- **delivery-status.** `.github/prompts/delivery-status.prompt.md` and its
  byte-identical mirror `skills/agento/commands/delivery-status.md` run `session --pr`,
  `status`, `gh pr list`, and `initiative`, but never `doctor`, so a stall summary
  needs one added step. Byte identity is enforced by `tests/customizations.test.mjs:479`.
- **Extension.** `extension/src/extension.ts:391-401` runs the copied CLI's
  `dashboard --pr` and splits the sections. `extension/src/sessionDoctorModel.ts` has
  `DoctorCheck {id,status,detail,fallback}` (15–20), `parseChecks` (91–107), and
  `session.warnings` validation (177). `sessionDoctorProvider.ts:90-111` renders the
  checks. Its tests are in `extension/test/unit/sessionDoctorModel.test.ts`, and new
  doctor checks appear in the Doctor group with no code change.
- **Canvas.** `canvas/agento-mission-control/snapshot.mjs` is the pure view model
  (`normalize()` 199–218, `buildTimeline` 113–137). The window banner is
  `public/panels/window.js` (uses `windowSummary`) and the feed is `public/panels/feed.js`.
  `dev.mjs` serves `fixtures/dashboard.json` on `--port`, so it can be verified locally
  in a browser. Its tests are `snapshot.test.mjs`, `window.test.mjs`, and
  `fixtures.test.mjs`.
- **Autopilot.** `.github/agents/delivery-autopilot.agent.md` has `tools: [execute,
  read, agent, search, browser]` (6) and `Needs: terminal, browser, gh, network` (12).
  `.github/prompts/ap.prompt.md` and its mirror `skills/agento/commands/ap.md:8` carry
  the same `Needs:`. `tests/customizations.test.mjs:798-806` requires `--for` output to
  equal each `Needs:` line.
- **Docs.** `docs/copilot-harness.md` has no stall section; `docs/commands.md`
  documents `dashboard` keys (≈442–452) and `metrics` (≈384); `docs/extension.md` has
  `## Session & Doctor` (141) and `## Mission Control` (309); `CHANGELOG.md` tops out at
  `## 0.15.0`. `extension/scripts/copy-cli.mjs` copies all of `lib/` and `commands/`
  (a new `lib/` module needs no list edit; a new flat module would).

### Lint baseline (2026-11-03, `065ae87`)

- Full-repository lint (AGENTS.md "Shell lint"): `shellcheck scripts/hooks/*.sh
  scripts/wait-for-checks.sh` gave **exit 0, no findings**. shellcheck is not
  installed on this machine; the run used the official static v0.10.0 release binary
  unpacked to `/tmp`. Builders do the same if `command -v shellcheck` fails, and
  record it.
- There is no JS/TS linter in the repository. The extension type gate is `tsc` via
  `cd extension && npm run build` (`npm ci` first; `extension/node_modules` is absent
  in this worktree).
- Test baseline: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'
  'canvas/**/*.test.mjs'` gave **843 tests, 843 pass, 0 fail** (173 s).
- Decision: the baseline is green, so the **full gate applies**, with no overlap or
  cleanup needed. The final step reruns shellcheck, the full node suite, the
  extension build, and the unit tests against these numbers.

### Open deliveries

`gh pr list --state open` returned no open PRs on 2026-11-03, so there is no
concurrent-delivery overlap.

## Approach

### 1. Pure parsers (no filesystem)

- In `scripts/delivery-metrics.mjs` (keeping the pure split), add
  `parseCopilotEvents(text)`. It returns `{ sessionId, turnGaps: [{ at, seconds }],
  subagentStartups: [{ at, seconds, agentName }] }`:
  - A turn gap runs from each `tool.execution_complete` to the next
    `assistant.turn_end`.
  - A start-up runs from `subagent.started` to `subagent.configured`, paired by
    `agentId`.
  - Unparseable lines and unknown types are ignored, and a truncated first line is
    tolerated.
- Also add `deriveStalls(sessions, { thresholdSeconds = 40, slowStartupSeconds = 60,
  now, windowHours = 24 })`, returning `{ current, window, summary }`. `summary` is
  `"<N> stalled turns (~<M> min) — check \`agento.mjs doctor\`"` when the current
  session has N > 0, otherwise `null`.
- New `scripts/lib/copilot-runtime.mjs` holds the pure halves:
  - `parseMcpConfig(json, source)` returns `[{ name, source, wildcard, remote }]`.
    `wildcard` is `tools` containing `"*"`. `remote` is a `url`, `type` `http`/`sse`,
    or an `mcp-remote` arg.
  - `countMcpTimeouts(text, { since })` returns `Map<server, { count, lastAt }>`,
    covering both line shapes.
  - Fixtures reproduce the exact lines quoted in Research, sanitized: no tokens,
    paths reduced to fixture dirs.

### 2. Bounded readers and doctor checks

- `copilot-runtime.mjs` also gets the readers. `copilotHome()` returns
  `$COPILOT_HOME` or `~/.copilot`.
  - `readSessions({ roots, hours = 24 })` reads `session-state/*/` whose
    `events.jsonl` mtime is within the window: at most 50 newest, last 16 MB of each
    file. A session belongs to this repository when its `workspace.yaml` `cwd` or
    `git_root` is inside a product worktree or companion half of this clone
    (`productWorktrees()`, `managedHalves()`). "Current" is the newest one whose
    `cwd` equals this CLI's `root`.
  - `readMcpConfigs({ root })` reads `~/.copilot/mcp-config.json` and
    `<root>/.vscode/mcp.json` (`servers` key).
  - `readMcpTimeouts({ hours = 24 })` reads `logs/process-*.log` modified in the
    window, last 16 MB each.
  - Missing files and directories return empty results, never throw.
- In `scripts/lib/doctor.mjs`, add two checks to `DOCTOR_CHECKS` and
  `LOCAL_DOCTOR_CHECKS`, and to no `CAPABILITY_CHECKS` group:
  - `mcp-servers` warns on any wildcard or remote server ("railway (user
    mcp-config.json): tools [\"*\"] exposes every tool — counts against the 128-tool
    cap"). It also warns on timeouts per the Decisions rule ("railway timed out 590×
    in 24 h (last 14:15Z) — each timeout stalls a turn ~60 s"). Its `fallback` names
    the config file to edit. Otherwise it is `ok`, with "no MCP servers configured" or
    the server list.
  - `turn-stalls` warns when the current session has stalled turns or slow subagent
    start-ups ("N stalled turns (~M min) in session <id8>; 24 h: X across Y
    sessions"). It is `ok` "no Copilot session data" when nothing is found.
  - Both catch every error and return `warn` with the message, never `fail`.

### 3. Surfaces

- **CLI.** Add a new `stalls` subcommand (in `COMMAND_MODULES` → `commands/status.mjs`,
  usage line) printing `stallsDocument()`: `{ status, generatedAt, thresholdSeconds,
  current, window, summary, root, configSource }`. `dashboardDocument()` gains a
  `stalls` section through `section()` (so timings include it), and `docs/commands.md`
  documents it.
- **delivery-status.** Add one step to `.github/prompts/delivery-status.prompt.md`
  (and its byte-identical mirror): run `agento.mjs stalls` and, when `summary` is not
  `null`, print it as a **Stalls** line under the Session section.
- **Session & Doctor view.** `sessionDoctorModel.ts` parses an optional `stalls`
  section: absent, errored, or malformed shows nothing. `sessionDoctorProvider.ts`
  shows a warning-icon "Stalls" row in the Session group with the summary. The two
  new checks appear in the Doctor group unchanged. `extension.ts` passes
  `dashboard.stalls` through.
- **Mission Control.** `snapshot.mjs` `normalize()` exposes `stalls` (`{ summary,
  stalledTurns, stalledMinutes } | null`). `public/panels/window.js` renders it as a
  warning tag in the window banner. `fixtures/dashboard.json` gains a `stalls`
  section for the dev server and the tests.
- **Copy.** Run `cd extension && npm run copy-cli` after the CLI changes.

### 4. Autopilot `browser` drop

Remove `browser` from `delivery-autopilot.agent.md` `tools:` and `Needs:`, from
`COMMAND_NEEDS.ap`, and from `.github/prompts/ap.prompt.md` `Needs:` plus its mirror.
Keep `Fallback:` lines consistent: drop the browser fallback clause where it was the
only reason. The Builder and Reviewer agents keep `browser`.

### 5. Docs and verification

- `docs/copilot-harness.md` gains `## Known stall sources`: the MCP `tools/list`
  timeout mechanism, the 60 s and 40–54 s signatures, the 128-tool cap, how to read
  `doctor` and `stalls`, and the fix (remove or narrow the server's `tools`).
- `docs/extension.md` (Session & Doctor, Mission Control) and `CHANGELOG.md` are
  updated.
- The `(manual)` step: the user removes the `railway` entry and reloads VS Code.
- The Builder's verification after it: `doctor` `mcp-servers` turns `ok` (no
  configured wildcard server, no timeout in the last 60 min); `stalls` reports 0
  stalled turns for the session that ran the step; and no new
  `railway`/`MCP request timed out` lines appear in any process log after the removal
  timestamp.

## Risks

- **Undocumented Copilot internals** may change shape. Mitigation: tolerant parsers
  (unknown types and bad lines skipped), fixtures of the observed lines, `warn` at
  most, missing data `ok`; the harness doc names the observed `copilotVersion`.
- **Refresh cost** (a 35 h `events.jsonl` is many MB). Mitigation: 24 h mtime filter,
  ≤ 50 sessions, 16 MB tail reads, `dashboard.timings.stalls`; no `--for` group, so
  `preflight` is unaffected.
- **Secrets in MCP config.** Mitigation: the parser keeps only name, type, tools,
  url-presence, and the `mcp-remote` flag; tests assert no `env`/`headers` value
  appears in output.
- **Post-removal false warning** from old Railway timeouts. Mitigation: the 60 min /
  still-configured rule (Decisions).
- **Mirror drift** (`{ap,delivery-status}.prompt.md` ↔ `skills/agento/commands/`,
  `scripts/` ↔ `extension/cli/`). Mitigation: `tests/customizations.test.mjs` and
  `npm run copy-cli` gate the steps.
- **Autopilot without `browser`.** Mitigation: it only orchestrates; step 4.1 greps
  its body and the `--for ap` test keeps `Needs:` and the CLI consistent.
- **Concurrent overlap:** none (no open PRs at planning); integrate `origin/main` by
  merge before every push regardless.

## Out of scope

- Removing or fixing the Railway MCP server itself (the user's environment; done in
  the `(manual)` step).
- Probing MCP servers live (`tools/list`) to count their tools; the config shape is
  enough to warn.
- Adding the new checks to `preflight` / `doctor --for` groups (possible Follow-up).
- Detecting the 128-tool warning automatically: it appears only in VS Code UI, not in
  session data.
- The `brief` command, policy split, context trim, and plugin snapshot (other
  initiative members).
- Hook latency, model inference speed, and window-throttling flags.

## Acceptance checklist

- [ ] `parseCopilotEvents` / `deriveStalls` reproduce the observed signatures from
  fixtures: 10 gaps ≥ 40 s and one 402 s subagent start-up from a `10097e97`-shaped
  fixture, with bad lines and unknown types ignored — verify: `node --test
  scripts/delivery-metrics.test.mjs`.
- [ ] `parseMcpConfig` flags wildcard and remote servers and never outputs
  `env`/`headers` values, and `countMcpTimeouts` counts both log-line shapes per
  server with `lastAt` — verify: the `copilot-runtime` test file passes.
- [ ] `agento.mjs doctor` reports `mcp-servers` and `turn-stalls`. Against fixture
  `COPILOT_HOME` dirs they give `warn` for the Railway-shaped config, recent timeouts,
  and stalled sessions; `ok` for empty or missing data; never `fail`; and an exit code
  that stays 0 on warn — verify: `node --test scripts/commands/doctor.test.mjs`.
- [ ] `doctor --for <command>` and `preflight` output are unchanged for every command
  except `ap` (browser removed) — verify: `node --test tests/customizations.test.mjs
  scripts/commands/doctor.test.mjs`.
- [ ] `agento.mjs stalls` prints the documented shape and `dashboard` carries a
  `stalls` section with a timing entry; both are documented in `docs/commands.md` —
  verify: the stalls/dashboard tests in `scripts/commands/` pass, plus a live `node
  scripts/agento.mjs stalls` exits 0.
- [ ] `/agento delivery-status` prints a **Stalls** line when `summary` is non-null,
  and the prompt and its mirror are byte-identical — verify: `node --test
  tests/customizations.test.mjs`.
- [ ] The Session & Doctor view shows a "Stalls" row from `dashboard.stalls` and
  tolerates its absence or error — verify: `cd extension && npm run test:unit`.
- [ ] The Mission Control window banner shows the stall tag from the fixture —
  verify: `node --test 'canvas/**/*.test.mjs'`, plus a browser screenshot of `node
  canvas/agento-mission-control/dev.mjs --port 3168` (local:3168) showing the tag,
  in `evidence/`.
- [ ] The Autopilot agent, `ap.prompt.md`, its mirror, and `COMMAND_NEEDS.ap` no
  longer list `browser`; Builder and Reviewer still do — verify: `node --test
  tests/customizations.test.mjs`, plus a grep.
- [ ] `docs/copilot-harness.md` has `## Known stall sources`, and `docs/extension.md`
  and `CHANGELOG.md` describe the new surfaces — verify: read the sections.
- [ ] After the user's Railway removal, `doctor` `mcp-servers` is `ok`, `stalls`
  reports 0 stalled turns for the verifying session, and no Railway timeout lines
  appear after the removal timestamp — verify: CLI output and a log grep recorded in
  the step, plus the manual step's screenshot.
- [ ] The full gate is green against the baseline: shellcheck exit 0 with no findings,
  the node suite has ≥ 843 tests and 0 fail, the extension build (`tsc`) passes, and
  the unit tests pass — verify: the final step's recorded comparison.
