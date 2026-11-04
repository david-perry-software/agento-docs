# Review: session-stall-diagnostics

Verdict: request-changes

Reviewed 2026-11-04 (round 1/3, Autopilot) against product branch
`feature/session-stall-diagnostics` at `445902e` (code PR #139) and companion branch
head `baac978` (artifact PR agento-docs#74); `origin/main` (`065ae87`) is an ancestor
of both halves' HEADs. Skills consulted: none — AGENTS.md has no `## Agento` skills
table and the only installed skills (`agento` router, `use-railway`) cover no touched
domain, matching plan.md `## Research`.

The implementation is complete, well-tested, and secret-safe; the full gate is green
above baseline. One user-visible defect blocks approval: the Mission Control banner's
new **Stalls** tag renders with ≈1.1:1 text contrast and its label is unreadable
(finding 1). The remaining findings are minor and were added to the roadmap as step
2.3 alongside the tag fix (step 5.3).

## Acceptance checklist results

1. **`parseCopilotEvents` / `deriveStalls` reproduce the observed signatures** —
   **pass.** `scripts/delivery-metrics.test.mjs` holds the `10097e97`-shaped fixture
   (10 gaps ≥ 40 s, one 402 s start-up, bad lines/unknown types ignored, truncated
   first line); runs inside the full suite (`node --test 'scripts/**/*.test.mjs'
   'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` → 860 tests, 860 pass, 0 fail,
   166 s).
2. **`parseMcpConfig` / `countMcpTimeouts`** — **pass.** `scripts/lib/
   copilot-runtime.test.mjs` pins the exact output shape with `deepEqual` (name,
   source, wildcard, remote only) and asserts no `env`/`headers` key or token value
   is serialized; both log-line shapes are counted per server with `lastAt`. Live
   probe: a fixture `AGENTO_COPILOT_HOME` with `env.RAILWAY_TOKEN: zzz-probe-secret`
   produced a `doctor` document containing no `zzz-probe-secret` (grep → false).
   Minor nit: one assertion checks a value absent from the fixture (finding 4).
3. **`doctor` reports `mcp-servers` and `turn-stalls`; warn/ok/never fail; exit 0 on
   warn** — **pass.** `scripts/commands/doctor.test.mjs` id list now has 13 checks and
   the warn/ok cases pass. Live: both checks present; fixture home with a wildcard
   `railway` and a fresh timeout line → `mcp-servers` `warn` with the documented
   detail and fallback; empty home → `ok`/`ok`. Both check bodies return only
   `ok`/`warn` and wrap everything in `try … catch → warn`
   (`scripts/lib/doctor.mjs` `"mcp-servers"`, `"turn-stalls"`);
   `scripts/commands/doctor.mjs:144` exits 3 only on `status: fail`. (The live
   `doctor` on this machine exits 3 because of the pre-existing `harness` fail —
   the router link points at the `agento-plugin` clone — identical on
   `/home/david/DP/agento` at `origin/main`; unrelated to this change.)
4. **`doctor --for` / `preflight` unchanged except `ap`** — **pass.**
   `tests/customizations.test.mjs` (Needs ↔ `--for` equality) passes in the suite;
   live `doctor --for ap` → `needs: ["terminal","gh","network"]`, `--for
   build-feature` → still includes `browser`; both run the same six capability
   checks and neither runs `mcp-servers`/`turn-stalls` (not in any
   `CAPABILITY_CHECKS` group; `preflight review-feature` output carried no new
   lines).
5. **`agento.mjs stalls` shape and `dashboard.stalls` + timing** — **pass.** Live
   `stalls` exits 0 with keys `status, generatedAt, thresholdSeconds, current,
   window, summary, root, configSource`; `dashboard` probe from roadmap 3.1 exits 0
   (`stalls.status: ok`, `timings.stalls: 56`); `scripts/commands/status.test.mjs`
   and `agento-fixtures.mjs` `assertDashboardMatches` assert the section and
   timing; `docs/commands.md` documents `stalls` and the `dashboard` key.
6. **`/agento delivery-status` Stalls line; prompt ↔ mirror byte-identical** —
   **pass.** `.github/prompts/delivery-status.prompt.md` step 1 runs `agento.mjs
   stalls` and prints `summary` as a **Stalls** line when non-null; `cmp` against
   `skills/agento/commands/delivery-status.md` → identical; `tests/
   customizations.test.mjs` passes.
7. **Session & Doctor view Stalls row, tolerant of absence/error** — **pass.**
   `extension/src/sessionDoctorModel.ts` `parseStalls` returns `null` for absent,
   `Error`, null-summary, and malformed sections; `sessionDoctorProvider.ts` adds the
   warn-styled row only when present; `extension/test/unit/sessionDoctorModel.test.ts`
   covers all five cases. `cd extension && npm run build` (copy-cli + tsc) exit 0,
   `npm run test:unit` → 252 pass, 0 fail.
8. **Mission Control banner shows the stall tag (tests + local:3168 screenshot)** —
   **fail.** Tests pass (`snapshot.test.mjs` stalls case) and the tag element is
   rendered — re-driven on local:3168 with Playwright: `#window-banner
   .mc-window-tag-warn` visible, text `Stalls`, `title` = the fixture summary;
   screenshots `evidence/review-5-2-canvas-stalls.png` and
   `evidence/review-5-2-banner-zoom.png` (3× zoom). But the label is unreadable: the
   computed style is `color: rgb(138,109,0)` on `rgba(255,193,7,0.18)` over the build
   banner `rgb(30,123,52)` — blended ≈ `#478844`, contrast ≈ 1.1:1 (WCAG AA needs
   4.5:1). The Builder's `evidence/step-5-2-canvas-stalls.png` shows the same
   illegible pill. A tag whose text cannot be read does not "show the stall tag" on
   the one visual surface this feature adds to the canvas (finding 1; roadmap 5.3).
9. **Autopilot, `ap.prompt.md`, mirror, `COMMAND_NEEDS.ap` drop `browser`; Builder and
   Reviewer keep it** — **pass.** `grep -n browser .github/agents/
   delivery-autopilot.agent.md` → no matches; `tools: [execute, read, agent,
   search]`, `Needs: terminal, gh, network`, `Fallback: none — every need is hard`;
   `cmp ap.prompt.md skills/agento/commands/ap.md` → identical;
   `delivery-builder.agent.md:18` and `delivery-reviewer.agent.md:18` still list
   `browser`; `COMMAND_NEEDS.ap = ["terminal","gh","network"]`.
10. **Docs** — **pass.** `docs/copilot-harness.md:440 ## Known stall sources`
    covers mechanism, both log signatures, the 40–54 s / 60 s gaps, subagent start-up
    pairing, the 128-tool cap, observed `copilotVersion`, reading `doctor`/`stalls`,
    and the fix; `docs/extension.md:146-148` (Session & Doctor) and `:326` (Mission
    Control tag); `CHANGELOG.md` `## 0.16.0` entry.
11. **Post-removal live state** — **pass.** Independently re-checked: `~/.copilot/
    mcp-config.json` has 0 servers; `grep -h "MCP request timed out\|Railway MCP proxy
    error" ~/.copilot/logs/process-*.log` → 0 lines after `2026-11-04T05:05:06Z`, max
    timestamp `2026-11-03T22:09:41.829Z`; live `doctor` → `mcp-servers` `ok` ("no MCP
    servers configured; railway timed out 590× in 24 h (last 22:09Z)"), `turn-stalls`
    `ok` ("0 stalled turns in session 135f7c19"); `stalls` → `current.stalledTurns 0`,
    `window.sessions 3`, `summary null`. 7.1 evidence screenshot present and linked.
    The "590× in 24 h" label itself is inaccurate (finding 2) but does not affect
    this item's outcome.
12. **Full gate green against baseline** — **pass.** Fresh run by the Reviewer:
    shellcheck v0.10.0 (static binary in `/tmp`, deleted afterwards) `scripts/hooks/
    *.sh scripts/wait-for-checks.sh` → exit 0, no findings (baseline: exit 0, none);
    node suite 860/860 pass (baseline 843); all five AGENTS.md guard replay smokes
    exit 0; `cd extension && npm run copy-cli` leaves `git status --porcelain
    --untracked-files=all` empty (byte-identical `extension/cli/`); `npm run build`
    (tsc) exit 0; `npm run test:unit` 252/252. No new or undocumented findings.

Score: 11 pass, 1 fail, 0 deferred to post-ship.

## Plan vs implementation

- Delivered as planned: pure parsers in `scripts/delivery-metrics.mjs` and
  `scripts/lib/copilot-runtime.mjs`; bounded readers (24 h mtime filter, ≤ 50
  sessions, 16 MB `tailText`, membership via `productWorktrees()` +
  `managedHalves()`, current = newest `cwd === root`); two informational doctor
  checks outside every `--for` group; `stalls` subcommand and `dashboard.stalls`
  through `section()`; the four surfaces; the Autopilot `browser` drop; docs and
  CHANGELOG; manual Railway removal and live verification.
- Deviation (documented in code, acceptable): `copilotHome()` honours
  `$AGENTO_COPILOT_HOME` before `$COPILOT_HOME` as a test override, and
  `scripts/test-helpers/agento-fixtures.mjs` points it at a temp dir so the suite
  never reads the real `~/.copilot`.
- Deviation (undocumented, finding 2): plan.md Approach §2 and Decisions describe the
  timeout count as a 24 h figure and `countMcpTimeouts` takes `since`, but
  `readMcpTimeouts` never passes it, so the count is "every timeout in the tail of
  any log modified in 24 h". On this machine 167 of the 598 lines in those files are
  from 2026-11-02 (> 24 h old); the true 24 h count was ≈ 250, not 590.
- Roadmap 5.2 named tests in `snapshot.test.mjs`/`window.test.mjs`; only
  `snapshot.test.mjs` gained a case, and the banner markup (`window.js` `render`) has
  no test — which is how the illegible tag passed every check (finding 1).
- The Autopilot's and `ap.prompt.md`'s `Fallback:` line became `none — every need is
  hard` once the browser clause was its only content, consistent with
  `COMMAND_NEEDS.ap`.

## Roadmap audit

Every ticked step (1.1–8.1, 13 boxes) was spot-checked against the codebase and the
commands above; no box is falsely ticked. 7.1 `(manual)` links
`evidence/step-7-1-railway-removed.png` (present, 437 KB, VS Code chat after reload
with no 128-tool warning, no secrets visible). 8.1's recorded gate numbers match my
fresh run exactly.

Repairs made:

- Added `2.3 (added 2026-11-04, review)` — pass `since` from `readMcpTimeouts` to
  `countMcpTimeouts`, drop the unused `copilotHome` import, fix the vacuous test
  assertion, re-copy the CLI (findings 2–4).
- Added `5.3 (added 2026-11-04, review)` — legible `.mc-window-tag-warn` on every
  role banner, a render assertion in `window.test.mjs`, and a fresh local:3168
  screenshot replacing `evidence/step-5-2-canvas-stalls.png` (finding 1).
- `next-step` set to `2.3`; `status` stays `in-review` for the Builder fix handoff.
- Reviewer evidence added: `evidence/review-5-2-canvas-stalls.png`,
  `evidence/review-5-2-banner-zoom.png`.

## Findings

1. **Major — Mission Control stall tag is illegible.**
   `canvas/agento-mission-control/public/styles.css:98-102` `.mc-window-tag-warn {
   background: rgba(255,193,7,.18); border-color: #e6a700; color: #8a6d00 }` sits on
   the role-coloured banner (`public/roles.js` `ROLE_COLORS`, e.g. build `#1E7B34`,
   primary `#0063B1`). Computed on local:3168: text `rgb(138,109,0)` over blended
   ≈ `#478844` → contrast ≈ 1.1:1; the word "Stalls" is a yellowish blob in both the
   Builder's and the Reviewer's screenshots. The summary survives only as a hover
   `title`. The feature's purpose is to make stalls visible; this surface does not.
   Fix in roadmap 5.3 (solid amber fill with dark text, or inherit the banner
   foreground like the `hosted` tag), plus a render test.
2. **Minor — "timed out N× in 24 h" overcounts.**
   `scripts/lib/copilot-runtime.mjs` `readMcpTimeouts` filters files by mtime but
   calls `countMcpTimeouts(tailText(file, TAIL_BYTES))` without `since`, so the
   detail in `scripts/lib/doctor.mjs` `"mcp-servers"` labels an all-time tail count
   as a 24 h figure (590 vs ≈ 250 here). The warn/ok decision (still-configured or
   last-60-min rule) is unaffected. Fix in roadmap 2.3.
3. **Minor — unused import.** `scripts/lib/doctor.mjs:14` imports `copilotHome`
   and never uses it (mirrored into `extension/cli/lib/doctor.mjs`). Roadmap 2.3.
4. **Minor — vacuous assertion.** `scripts/lib/copilot-runtime.test.mjs:42` asserts
   `secret-header-value` is absent, but the fixture's header value is `"******"`
   (line 19); the `deepEqual` on line 34 already proves the property, so coverage is
   not reduced. Roadmap 2.3.
5. **Note (no action) — pre-existing `harness`/`canvas` doctor state.** On this
   machine `doctor` fails on `harness` and warns on `canvas` and `model-profile`
   because `~/.copilot/skills/agento` and the canvas link resolve to the
   `agento-plugin` clone; identical on `origin/main`, outside this delivery.

## Follow-ups

- The banner tag colours are hard-coded for a light theme while the banner itself
  is role-coloured; a token in `styles.css` for warning tags (used by any future
  banner tag) would keep contrast correct across roles and themes.
- `readSessions` treats a `workspace.yaml` without `cwd`/`git_root` inside a known
  root as foreign; a hosted session whose `cwd` is a `.code-workspace` parent could be
  missed. Worth a fixture once such a session is observed.
