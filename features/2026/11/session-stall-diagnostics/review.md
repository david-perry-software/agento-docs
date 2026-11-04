# Review: session-stall-diagnostics

Verdict: approve

Reviewed 2026-11-04 (round 2/3, Autopilot re-review after roadmap steps 2.3 and 5.3)
against product branch `feature/session-stall-diagnostics` at `cf06b41` (code PR #139)
and companion branch head `0adb41b` (artifact PR agento-docs#74); `origin/main`
(`065ae87`) is an ancestor of both halves' HEADs, both halves were in sync with
`origin` and `git status --porcelain --untracked-files=all` was empty at the start.
Skills consulted: none — AGENTS.md has no `## Agento` skills table and no installed
skill covers the touched domains (Node CLI diagnostics, VS Code tree views, the
canvas), matching plan.md `## Research` and the round-1 review.

Every round-1 finding is resolved in code and verified live: the Mission Control
**Stalls** tag is legible (8.17:1, finding 1 → step 5.3), the `mcp-servers` 24 h
timeout count honours the window (590× → 225× on this machine, finding 2 → step 2.3),
the unused `copilotHome` import is gone (finding 3), and the `secret-header-value`
assertion now tests a real fixture value (finding 4). The full gate is green above
baseline on a fresh Reviewer run. No finding above minor remains.

## Round-1 findings: resolution check

| # | Finding (round 1) | Fix commit | Evidence |
|---|---|---|---|
| 1 | Major — banner stall tag illegible (≈1.1:1) | `cf06b41` (5.3) | `canvas/agento-mission-control/public/styles.css` `.mc-window-tag-warn { background: #ffc107; border-color: #ffc107; color: #3b2e00 }`; re-driven on local:3168 with headless Chrome: `#window-banner .mc-window-tag-warn` visible, text `Stalls`, `title` = fixture summary, computed `rgb(59,46,0)` on opaque `rgb(255,193,7)` → **8.17:1**; the opaque fill's edge against all six `ROLE_COLORS` banners is 3.26–4.36:1 (≥ 3:1 non-text). Screenshots `evidence/review-5-3-canvas-stalls.png`, `evidence/review-5-3-banner.png`; the Builder's refreshed `evidence/step-5-2-canvas-stalls.png` (00:57) shows the same readable label. New `stallsTag()` in `public/window.js` (re-exported from `public/panels/window.js`) with a render assertion in `window.test.mjs` (warn span + summary title; `""` for null/undefined/null-summary/empty-summary). |
| 2 | Minor — "timed out N× in 24 h" overcounts | `62223a7` (2.3) | `scripts/lib/copilot-runtime.mjs:220` `countMcpTimeouts(tailText(file, TAIL_BYTES), { since: cutoff })`; new test "counts only lines timestamped within 24 h even in a freshly modified log" (one line 26 h old + one inside → `count: 1`); live `doctor` detail now "railway timed out 225× in 24 h (last 22:09Z)" vs 590× in round 1; independent `grep` over logs modified in 24 h filtered by timestamp → 230 (cutoff a few minutes earlier than the doctor run). `doctor.test.mjs` fixture line updated to a fresh timestamp so the warn case stays inside the window. |
| 3 | Minor — unused `copilotHome` import | `62223a7` (2.3) | `scripts/lib/doctor.mjs:14` imports `readMcpConfigs, readMcpTimeouts, readSessions` only; `extension/cli/lib/doctor.mjs` byte-identical (`diff -rq scripts/lib extension/cli/lib` → only the test file differs, as designed). |
| 4 | Minor — vacuous `secret-header-value` assertion | `62223a7` (2.3) | `scripts/lib/copilot-runtime.test.mjs:19` fixture `headers.Authorization` is now `"secret-header-value"`, so line 42 asserts a value that is really present in the input. |

## Acceptance checklist results

1. **`parseCopilotEvents` / `deriveStalls` reproduce the observed signatures** —
   **pass.** `scripts/delivery-metrics.test.mjs` holds the `10097e97`-shaped fixture
   (10 gaps ≥ 40 s, one 402 s start-up, bad lines/unknown types ignored, truncated
   first line); passes inside the full suite (`node --test 'scripts/**/*.test.mjs'
   'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` → **862 tests, 862 pass, 0 fail**,
   170 s).
2. **`parseMcpConfig` / `countMcpTimeouts`** — **pass.** `scripts/lib/
   copilot-runtime.test.mjs` pins the output shape with `deepEqual` (name, source,
   wildcard, remote only) and asserts none of `secret-token-value`,
   `secret-header-value`, `gh-secret-token`, `env`, `headers` is serialized — all
   three secret strings are now real fixture values. Both log-line shapes counted per
   server with `lastAt`; `since` honoured (round-1 finding 2 fixed and tested).
3. **`doctor` reports `mcp-servers` and `turn-stalls`; warn/ok/never fail; exit 0 on
   warn** — **pass.** `scripts/commands/doctor.test.mjs` 13-id list and warn/ok
   cases pass. Live `doctor` lists both ids
   (`…,hook-wiring,harness,canvas,mcp-servers,turn-stalls`); `mcp-servers` `ok` ("no
   MCP servers configured; railway timed out 225× in 24 h (last 22:09Z)"),
   `turn-stalls` `ok` ("0 stalled turns in session 135f7c19"). Both check bodies
   return only `ok`/`warn` inside `try … catch → warn`. (Live `doctor` exits 3 only
   because of the pre-existing `harness` fail — the router link resolves to the
   `agento-plugin` clone — unchanged from round 1 and from `origin/main`.)
4. **`doctor --for` / `preflight` unchanged except `ap`** — **pass.** Live `doctor
   --for ap` → `needs: ["terminal","gh","network"]` running
   `node,git-remote,gh,worktrees-dir,session-workspace,artifact-repo`; `--for
   build-feature` → `["terminal","browser","gh","network"]`; neither runs
   `mcp-servers`/`turn-stalls`; `preflight review-feature` emitted no
   `preflightLines`. `tests/customizations.test.mjs` (Needs ↔ `--for` equality)
   passes in the suite.
5. **`agento.mjs stalls` shape and `dashboard.stalls` + timing** — **pass.** Live
   `stalls` exit 0, keys `status, generatedAt, thresholdSeconds, current, window,
   summary, root, configSource`, `current.stalledTurns 0`, `window.sessions 3`,
   `summary null`; roadmap 3.1 dashboard probe exit 0 (`stalls.status: ok`,
   `timings.stalls: 86`); `docs/commands.md:416,462` document both.
6. **`/agento delivery-status` Stalls line; prompt ↔ mirror byte-identical** —
   **pass.** `.github/prompts/delivery-status.prompt.md:35` prints `summary` as a
   **Stalls** line; `cmp` with `skills/agento/commands/delivery-status.md` →
   identical.
7. **Session & Doctor view Stalls row, tolerant of absence/error** — **pass.**
   `extension/src/sessionDoctorModel.ts` `parseStalls` + `sessionDoctorProvider.ts`
   warn-styled row; `cd extension && npm run copy-cli` leaves `git status` empty,
   `npm run build` (tsc) exit 0, `npm run test:unit` → **252 pass, 0 fail**.
8. **Mission Control banner shows the stall tag (tests + local:3168 screenshot)** —
   **pass** (was fail in round 1). `canvas/**/*.test.mjs` pass in the suite including
   the new `stallsTag` render test; re-driven on local:3168 by the Reviewer
   (`node canvas/agento-mission-control/dev.mjs --port 3168`, headless Chrome via
   `playwright-core`): tag visible, text `Stalls`, `title` "10 stalled turns (~10
   min) — check `agento.mjs doctor`", text/fill contrast **8.17:1**. Evidence:
   `evidence/review-5-3-canvas-stalls.png` (full page),
   `evidence/review-5-3-banner.png` (banner crop). The round-1 captures
   (`review-5-2-*.png`) remain as the record of the defect.
9. **Autopilot, `ap.prompt.md`, mirror, `COMMAND_NEEDS.ap` drop `browser`; Builder and
   Reviewer keep it** — **pass.** `grep -n browser
   .github/agents/delivery-autopilot.agent.md` → no matches; `tools: [execute, read,
   agent, search]`, `Needs: terminal, gh, network`, `Fallback: none — every need is
   hard`; `cmp ap.prompt.md skills/agento/commands/ap.md` → identical;
   `delivery-builder.agent.md:6,18` and `delivery-reviewer.agent.md:6,18` keep
   `browser`; `scripts/lib/doctor.mjs:357` `ap: ["terminal", "gh", "network"]`.
10. **Docs** — **pass.** `docs/copilot-harness.md:440 ## Known stall sources`;
    `docs/extension.md:146-148` (Session & Doctor row) and `:326` (Mission Control
    tag); `CHANGELOG.md:3 ## 0.16.0` with the stall-diagnostics entry.
11. **Post-removal live state** — **pass.** Live `doctor` `mcp-servers` `ok` and
    `turn-stalls` `ok` (above); `stalls` `current.stalledTurns 0` for session
    `135f7c19`, `window.stalledTurns 0` across 3 sessions, `summary null`. 7.1
    `(manual)` links `evidence/step-7-1-railway-removed.png` (present, 437 KB). The
    24 h label that was inaccurate in round 1 is now correct (225×).
12. **Full gate green against baseline** — **pass.** Fresh Reviewer run:
    shellcheck v0.10.0 (static binary unpacked to `/tmp`, deleted afterwards)
    `scripts/hooks/*.sh scripts/wait-for-checks.sh` → exit 0, no findings (baseline
    exit 0, none); node suite 862/862 (baseline 843); 5/5 AGENTS.md guard replay
    smokes exit 0; extension `copy-cli` idempotent + `tsc` exit 0 + 252/252 unit
    tests; product `git status --porcelain --untracked-files=all` empty after all
    runs. Matches the Builder's 8.1 "Re-gate after 2.3/5.3" record exactly.

Score: 12 pass, 0 fail, 0 deferred to post-ship.

## Plan vs implementation

- Delivered as planned: pure parsers in `scripts/delivery-metrics.mjs` and
  `scripts/lib/copilot-runtime.mjs`; bounded readers (24 h mtime filter, ≤ 50
  sessions, 16 MB `tailText`, membership via `productWorktrees()` +
  `managedHalves()`, current = newest `cwd === root`); two informational doctor
  checks outside every `--for` group; `stalls` subcommand and `dashboard.stalls`
  through `section()`; the four surfaces; the Autopilot `browser` drop; docs and
  CHANGELOG; the `(manual)` Railway removal with evidence and the live 7.2 check.
- Deviation (documented in code, acceptable): `copilotHome()` honours
  `$AGENTO_COPILOT_HOME` before `$COPILOT_HOME` as a test override so the suite never
  reads the real `~/.copilot`.
- Round-1 deviation closed: `readMcpTimeouts` now passes `since: cutoff`, so the
  "N× in 24 h" label matches plan.md Approach §2 / Decisions.
- Round-1 test gap closed: `window.test.mjs` now asserts the banner tag markup via
  `stallsTag()`; the helper lives in the DOM-free `public/window.js` with a local
  five-character escaper (a deliberate, commented duplicate of `app.js` `escapeHtml`
  so the module stays importable from `node:test`).

## Roadmap audit

All 15 ticked steps (1.1–8.1 including the review-added 2.3 and 5.3) were
spot-checked against the codebase and the commands above; no box is falsely ticked.
7.1 `(manual)` links its evidence file (present). 5.3's recorded result (131 canvas
tests, 8.17:1 contrast, refreshed `step-5-2-canvas-stalls.png`) and 8.1's "Re-gate
after 2.3/5.3" numbers (shellcheck 0, 862 tests, 5/5 smokes, tsc clean, 252 unit
tests) match my fresh run exactly. `status: in-review`, `next-step: ""`.

Repairs made: none required. Reviewer evidence added:
`evidence/review-5-3-canvas-stalls.png`, `evidence/review-5-3-banner.png`.

## Findings

1. **Note (no action) — pre-existing `harness`/`canvas`/`model-profile` doctor
   state.** On this machine `doctor` fails on `harness` and warns on `canvas` and
   `model-profile` because `~/.copilot/skills/agento` and the canvas link resolve to
   the `agento-plugin` clone and the git-filter copy is stale; identical on
   `origin/main`, outside this delivery.
2. **Note (no action) — duplicated HTML escaper.** `public/window.js`
   `escapeHtmlValue` duplicates `app.js` `escapeHtml` to keep the module DOM-free
   for `node:test`; the comment explains the choice. A shared pure module would
   remove the duplication (Follow-up).

## Follow-ups

- Extract the five-character HTML escaper into a DOM-free shared module imported by
  both `public/app.js` and `public/window.js`.
- A `styles.css` token for warning tags (the amber fill/dark text pair) so any future
  banner tag inherits the verified contrast across roles and themes.
- `readSessions` treats a `workspace.yaml` without `cwd`/`git_root` inside a known
  root as foreign; a hosted session whose `cwd` is a `.code-workspace` parent could be
  missed. Worth a fixture once such a session is observed.
