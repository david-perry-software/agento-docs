Source: chat request "Our system is very slow… What are some of the highest reward changes we could make?" with the approved session plan (session 90b6faff, plan.md) — 2026-11-03

# Plan: Agento speed — highest-reward changes

## Problem

Agento sessions feel slow and frequently hit "The model only supports 128 tools, 17 tools were not
provided". Measured from the Copilot CLI session events (`~/.copilot/session-state/*/events.jsonl`)
and the CLI process log (`~/.copilot/logs/process-1793628432642-1249106.log`) of recent Soshiki
delivery sessions:

| Where the wall-clock went | Build session `10097e97` (64 min) | Night build `532d960c` (35 h) |
| --- | --- | --- |
| **60 s stalls between a tool result and the next model turn** | 10 stalls ≈ 10 min | **458 stalls ≈ 7.4 h** (~60 % of turns 01:00–14:00) |
| First BYOK subagent start (`subagent.started` → `configured`) | 402 s | 575 s (456 s, 513 s in two other sessions) |
| Model inference (DeepSeek Builder avg 3.5 s/call, Opus Autopilot 5.9 s/call) | ≈ 12 min | — |
| Permission prompt that only appears when the user is back (out-of-workspace `view`) | 20 min | — |
| Agento "ritual" before touching product code (agent file 3×, policy 5×, plan 5×, roadmap 5×, wrong-path probing) | ≈ 25 tool calls / 10 turns | same pattern |
| `bash` hitting the 30 s default `initial_wait` | 8 × 30 s | 30 s gaps throughout |
| Hooks (delivery-guard pre/post) | 8 s total — **not a factor** | — |

### Root cause of the stalls and the tool warning: the global Railway MCP server
`~/.copilot/mcp-config.json` registers `railway mcp` with `"tools": ["*"]`:
- It exposes **72 tools** in every session on this machine (≈77 built-ins + 72 ≈ 149 > 128 cap).
  Nothing disabled inside Soshiki can fix that.
- Its remote SSE stream keeps breaking (`Railway MCP proxy error: error reading SSE stream from
  remote MCP server` — 934×). After each break the runtime refreshes the tool catalog and the
  `tools/list` request **times out after 59,999 ms** (`rmcp::service cancelled … request timeout` —
  590×). The agent loop waits for that catalog projection before the next turn → one ~60 s stall
  per turn while the stream is broken. Gap distribution: 349 stalls at 60.04 ± 0.05 s, a hump at
  40–54 s, nothing above 60 — a fixed client timeout, not window throttling.
- The 400–575 s subagent start-up stalls are 6–9 consecutive Railway timeouts during subagent
  creation (19:34:47 … 19:39:49 in `10097e97`).
- Experiment (this session): 50-turn loops with the VS Code window visible and unmapped (other i3
  workspace) both showed median tool→turn gap 0.01–0.02 s, max 0.08 s → hidden-window throttling
  ruled out.

### Secondary costs
Autopilot system prompt 63 k chars (31 skills listed, 7 Python/Pylance from synced VS Code plugins);
Builder subagent starts at 44–58 k tokens and grows to 209 k. `delivery-policy.instructions.md`
(20,109 B) and `agento-init.prompt.md` (20,296 B) sit just over the 20 KB `view` truncation, so every
read is two reads; plan.md (28 KB) and roadmap.md (20 KB) were read in 5 chunks each. Plugin snapshots
under `~/.config/Code/agentPlugins/` are 182 MB each (`extension/node_modules` + `.git` copied; 8 × = 934 MB).

## Approach — ranked by payoff

### 1. Remove Railway MCP (user, 1 min) and make this class of failure visible (Agento)
- User: delete the `railway` entry from `~/.copilot/mcp-config.json` (the `use-railway` skill drives
  the CLI). Verify in a fresh session: no `request timeout` / `Railway MCP proxy error` lines in the
  newest `~/.copilot/logs/process-*.log`, no 128-tool warning, no 60 s gaps.
- Agento `doctor`: new check that reads `~/.copilot/mcp-config.json` (and the workspace
  `.vscode/mcp.json` if present) and warns on servers with `"tools": ["*"]` / remote-proxy servers,
  and scans the newest CLI process log for `MCP request timed out` with the server name — "MCP
  server X timed out N times today: each timeout stalls a turn 60 s".
- Agento `delivery-metrics`: stall detector — count tool→next-turn gaps ≥ 40 s per session and
  subagent start-up gaps; surface in Mission Control / `delivery-status` as "N stalled turns
  (~M min) — check `doctor`". Document in `docs/copilot-harness.md` ("Known stall sources").
- Agento: drop `browser` from the Autopilot agent (it only orchestrates) to shave ~10 tools from the
  parent's budget.

### 2. One-call briefing instead of the ~25-call startup ritual
- New `agento.mjs brief <command> <slug>` (or extend `preflight`): one bash call (host-policy
  approved → no permission prompt) printing receipt + preflight lines, the dispatched command body,
  the agent body when inline, the `Policy:` sections, the roadmap header + the *current* unticked
  step with its `verify:` (not the whole plan), and companion paths.
- Router (`skills/agento/SKILL.md`), command files, agents: replace "read the agent file / load
  policy / read roadmap" with the single `brief` call; add the rule "never `view` files under
  `<agento-root>` — use CLI output" (out-of-workspace `view` triggers a permission prompt that blocks
  unattended runs until the user returns).
- Keep every agent-read file under 20 KB: split `delivery-policy.instructions.md` into per-section
  files that `policy N` reads; shorten `agento-init.prompt.md`.
- Builder guidance: `initial_wait ≥ 120` for build/test/db commands.

### 3. Trim per-call context
- Builder `Policy:` lists 11 of 12 sections — the whole file. Cut to the sections the Builder acts
  on; rest on demand.
- Autopilot on a cheaper/faster profile (≈8 short turns; Opus hit "Credit limit reached").
- User: disable the Python/Pylance synced customizations for non-Python workspaces (7 skills in
  every prompt).

### 4. Slim plugin snapshots
- Publish `/home/david/DP/agento-plugin` without `extension/node_modules` and `.git` (archive-style
  export or loader ignore file if supported); drop the stale `/tmp/agento-scratch-plugin` entry.

## Todos
- railway-remove-verify — (user removes) then verify fresh session: no MCP timeouts, no tool warning, no 60 s gaps
- doctor-mcp-check — doctor: wildcard/remote MCP servers + recent `MCP request timed out` counts per server
- stall-metrics — stall + subagent-start detector in delivery-metrics; Mission Control/delivery-status surface; docs
- tools-autopilot-browser — drop `browser` from Autopilot agent
- brief-command — `agento.mjs brief` one-call startup bundle (+ tests)
- brief-router — route SKILL.md/commands/agents through `brief`; no `view` under agento-root
- policy-split — per-section policy files < 20 KB; trim Builder `Policy:` list; agento-init < 20 KB
- initial-wait-guidance — Builder guidance for long commands
- context-trim — cheaper Autopilot profile; note Python-skill disable for user
- plugin-slim — slim plugin snapshot export; purge stale plugin entry

Done: stall-experiment (hidden-window ruled out; root cause = Railway MCP tool-catalog refresh timeouts).
Dropped: stall-flags, subagent-start-investigate (explained by the same cause; re-check after removal).

## Notes
- Packaging: one initiative (`/agento new-initiative`) decomposed into features: (a) doctor MCP
  check + stall metrics + Autopilot browser drop, (b) `brief` command + router rewiring + policy
  split + initial_wait guidance, (c) context trim, (d) plugin slim.
- Items marked "User" are environment changes the agent cannot make from the repo.
- Hook overhead is 8 s per hour — do not spend effort there.
- Source sessions: `~/.copilot/session-state/{10097e97…,532d960c…,6e6fbbb2…,a967ed16…}/events.jsonl`;
  process log `~/.copilot/logs/process-1793628432642-1249106.log`.
