# Review: mission-control-canvas

Verdict: request-changes

Round 1, 2026-10-24. Reviewed product `feature/mission-control-canvas` at `47ed100`
(PR #130, `origin/main` `97b2889` is an ancestor; 22 commits, 48 files, +7083/−54) and
the companion half at `6fe5783` (agento-docs PR #67). Both halves were clean and in
sync with `origin` at the start of the review. Skill consulted: VS Code's built-in
`create-canvas` (`/usr/share/code/resources/app/extensions/copilot/assets/prompts/skills/create-canvas/SKILL.md`);
the repository has no `.agents/skills/` and no `## Agento` skills table.

The feature is substantially complete and well built: every acceptance item passes on
evidence, the dispatch safety design holds under live probing, the UI renders
faithfully, and the 9.1 live canvas check is genuine. The verdict is
`request-changes` because of two moderate robustness findings with one root cause —
no error boundary around async paths in the extension process — each reproduced
below, each a small fix (roadmap steps 10.1–10.2), plus the missing persistence test
(10.3).

## Verification run by the Reviewer

| Check | Command | Result |
| --- | --- | --- |
| Full test suite | `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` | exit 0 — **729/729 pass** |
| Syntax | `node --check` on every `canvas/agento-mission-control/*.mjs`, `public/*.js`, `public/panels/*.js` | exit 0 |
| Extension | `cd extension && npm run typecheck && npm run test:unit` | exit 0 — 0 findings, **250/250 pass** |
| Extension electron | `cd extension && npm run test:electron` | exit 0 — in-repo, companion, workspace, and no-markdown scenarios pass; `agento.openMissionControl` registration asserted (`suite.ts:1309`) |
| Guard replays (×5) | plain, companion, Copilot format, Copilot format + companion, Copilot fixtures | all exit 0 |
| Command preflight | `node scripts/agento.mjs preflight mission-control` | `status: ok`, receipt `mission-control:plan-20261023-204459:47ed100` |
| CI | `scripts/wait-for-checks.sh pr 130` | `RESULT: success` (pass=1 fail=0 pending=0, merge=CLEAN) at head `47ed100` — the `test` job carries the `Shellcheck` step, 0 findings vs. the baseline of 0 |
| Shellcheck locally | `shellcheck …` | exit 127 (not installed, same as the recorded baseline); CI is the authority |
| Dispatch safety, live | `dev.mjs --port 3103` + curl | `OPTIONS /dispatch` → 405; foreign `Origin` → 403 `["origin"]`; non-allowed command → 403 `["command"]`; allowed command → 204 and `dev.mjs` printed `dispatch: /agento delivery-status` exactly once; `GET /..%2f..%2fetc/passwd` → 403 |
| Persistence across a real close | ad-hoc script: `open` → `post_note "live check"` → `onClose` → `open` (same `instanceId`) with real `store.mjs` under a temp `COPILOT_HOME` | PASS — second open is `status: live`, a second server started, one close, and its `setState` feed contains `live check` |
| UI re-drive (`local:3103`) | headless Chrome (`google-chrome --headless=new --screenshot`; this session has no browser tool, §10 fallback) | [evidence/review-4-7-light-headless.png](evidence/review-4-7-light-headless.png): four lanes, progress rings, verdict chips, owner badge in build-role green, enabled `Run` buttons, disabled "runs in primary window" buttons, initiative wave graphs with a glowing blocked edge, highlighted `next` node and `Plan` button. The dark scheme could not be emulated headlessly (`--force-dark-mode` does not flip `prefers-color-scheme`); the Builder's [step-4-7-dark.png](evidence/step-4-7-dark.png) was inspected and is a genuine dark render, and `styles.css:22` carries the `@media (prefers-color-scheme: dark)` block |
| Dev link removed | `test -e ~/.copilot/extensions/agento-mission-control` | fails (removed) |
| Docs / versions | `grep -l mission-control` on the six files → 6; `0.15.0` in `package.json`, `.claude-plugin/plugin.json`, `extension/package.json`, `extension/package-lock.json` (×2); `## 0.15.0` in CHANGELOG; `canvas/**/*.test.mjs` in `package.json`, `ci.yml`, AGENTS.md | all present |

## Acceptance checklist results

1. **Spike results recorded with the chosen install mode — pass.** plan.md `## Research`
   has the "Spike results (2026-10-24, step 1.3 …)" block with answers (a)–(d) and the
   resulting choices (link mode, "Run" label, own theme, no manifest);
   `evidence/step-1-2-spike-canvas.png` exists (234 KB).
2. **`snapshot.mjs` lanes/waves/bands/groups and the six diff event kinds — pass.**
   `snapshot.test.mjs` is in the 729/729 run; the fixture renders Planned/Building
   (including the paused fixture)/In Review/Shipped lanes in the headless capture.
3. **`store.mjs` atomic, versioned, refuses corrupt/unknown — pass.** `store.test.mjs`
   (10 tests: round-trip, atomic with no temp files, corrupt/unknown-version/invalid
   shape refused, caps, repo-key isolation) passes; `store.mjs:99-123` writes
   `.<file>.<pid>.<rand>.tmp` then `renameSync`, and `save` re-loads an existing file
   and refuses when it is not readable.
4. **`POST /dispatch` exactly-once and every rejection path — pass.**
   `server.test.mjs` covers wrong Host, foreign/missing Origin, non-JSON type and
   malformed body, non-allowed command, OPTIONS, traversal; the Reviewer's live curl
   run above reproduced each rejection and a single `send`.
5. **Canvas definition: four actions, idempotent `open`, `CanvasError`s, `onClose` —
   pass.** `canvas.mjs:116-243`; `canvas.test.mjs` asserts the four names and schemas,
   reopen reuses server and watcher, `not-found`, `invalid-note` (empty and 501 chars),
   `cli`, and `storage` errors; `node --check` is clean on every file.
6. **All five panels on `local:3103`, light and dark, dispatch/elsewhere/reduced
   motion — pass.** Builder evidence `step-4-2` … `step-4-7-{light,dark}.png` inspected;
   Reviewer headless capture confirms the board and graph panels; dispatch verified via
   curl (dev.mjs printed exactly the command); `elsewhere` buttons render disabled with
   the window named; `styles.css:135-143` disables all animation under
   `prefers-reduced-motion: reduce`.
7. **Role colors equal the extension's defaults — pass.** `roles.test.mjs` passes in
   the full run.
8. **Harness manages the canvas link, `--force`, never-delete-real-dir, doctor
   `canvas` — pass.** `scripts/agento.mjs:1061-1072` (doctor check), `1084-1113`
   (`copilotExtensionsDir` honoring `AGENTO_COPILOT_EXTENSIONS_DIR` → `COPILOT_HOME` →
   `~/.copilot/extensions`), `5014-5090` (install/status/uninstall);
   `scripts/agento.test.mjs` passes in the full run.
9. **`/agento mission-control` prompt + mirror, allowed everywhere, preflight ok —
   pass.** `WINDOW_ROLES["mission-control"] = ANY` (`session-state.mjs:463`),
   `COMMAND_NEEDS` has `terminal`; prompt and `skills/agento/commands/mission-control.md`
   bodies are byte-identical (diff); preflight `status: ok`.
10. **"Open Mission Control" title action dispatches `/agento mission-control` — pass.**
    `extension/src/extension.ts:705-706`, `extension/package.json:81,228`; unit
    (`extensionIntegration.test.ts`) and electron assertions pass.
11. **Live canvas: open, refresh, focus, post_note, dispatch, reopen with preserved
    feed — pass.** `step-9-1-live-canvas.png` shows the canvas as an editor tab beside
    the chat with the three actions completed; `step-9-1-reopen.png` shows the
    worktree map with "This window" on this build worktree and Activity "10:55:57 AM
    live check" after the `reopened` open. The item's wording ("a reopen with the
    same `instanceId` shows the preserved feed") is exactly what was exercised and
    matches the `create-canvas` skill's own validation step 4. The stronger
    close-then-open path in step 9.1's text was not exercised live; the Reviewer's
    headless script passed it (table above). See Findings 3 for the missing test.
12. **Docs and CHANGELOG 0.15.0, version in four files — pass.** Greps above.
13. **Full gate — pass.** 729/729, five guard replays, extension typecheck/unit/electron,
    CI green at the reviewed SHA with 0 Shellcheck findings vs. baseline 0, dev link
    removed, both halves clean (`git status --porcelain --untracked-files=all` empty
    at review start).

No item is deferred to post-ship; the plan has no `(manual, post-ship)` steps.

## Plan vs implementation

- **Matches the plan:** module layout (`extension.mjs` wiring only; `canvas.mjs`,
  `cli.mjs`, `snapshot.mjs`, `watch.mjs`, `store.mjs`, `server.mjs`, `dev.mjs`,
  `public/`, `fixtures/`), the four actions and schemas, the four dispatch checks,
  storage under `$COPILOT_HOME/extension-data/agento-mission-control/<repo-key>.json`
  keyed by the hashed primary clone path, `remoteSession: "off"`, link-mode install
  with 6.2 marked obsolete on the spike's evidence, `ANY` window role, version 0.15.0.
- **Deviation (documented, acceptable):** the plan's "`--pr` on open" is not what
  `open()` does — `canvas.mjs:197` runs the first dashboard with `pr: false` and the
  `--pr` refresh comes from the watcher's 5-minute interval (`watch.mjs:61-66`); the
  manual `POST /refresh` is also `pr: false` (`canvas.mjs:211-213`). The plan's cost
  mitigation is honored; PR chips may lag up to five minutes after opening. Recorded
  as a follow-up, not a defect.
- **Deviation (acceptable):** the plan listed `commandAgent.ts`, `commandActions.ts`,
  and `dispatchRouting.ts` as command lists to extend. Those lists enumerate delivery
  lifecycle actions and do not contain `/agento delivery-status` either, so the
  command's absence there is consistent; `tests/customizations.test.mjs` passes.
- **Undocumented changes:** none found; every changed file in `git diff --stat
  origin/main...HEAD` is in the plan's affected-files list.
- **Step 9.1 wording vs. execution:** the step says "Close the canvas, re-run
  `/agento mission-control`, and confirm the feed still shows the note"; the Builder
  re-ran it with the tab still open, received `status: reopened` at the same URL, and
  recorded this accurately on the line. The code path for a fresh open
  (`canvas.mjs:199-203`: `load` → `feedFor(stored)` → `setState`) is correct and the
  Reviewer exercised it headlessly. Treated as a coverage gap (Finding 3), not a
  false tick.

## Roadmap audit

Every ticked box was spot-checked against the codebase; none is falsely ticked. Both
`(manual)` steps (1.2, 9.1) carry linked evidence files that exist and were inspected.

Repairs made:

- **4.7** — the step's verify asked for "a recorded check that animations are off under
  `prefers-reduced-motion: reduce`" and the keyboard-reachability check; the line was
  ticked with the two screenshots but no record of either check (the companion commit
  `d33382d` adds only the screenshots and the tick). The Reviewer verified both from
  the code and recorded the result on the line, linking
  `evidence/review-4-7-light-headless.png`.
- **Phase 10 (added 2026-10-24)** — steps 10.1, 10.2, 10.3 for Findings 1–3.
- Header `next-step` now names the Builder fix handoff; `status` stays `in-review`
  (the CLI derives the fix handoff from this review's verdict).

## Findings

1. **Moderate — a malformed URL crashes the canvas server process.**
   `canvas/agento-mission-control/server.mjs:67` calls `decodeURIComponent` on the
   request path inside the `async` request listener with no try/catch. `GET /%`
   throws `URIError: URI malformed`; the listener's promise rejects unhandled and
   Node exits. Reproduced: with `dev.mjs --port 3103` running,
   `curl 'http://127.0.0.1:3103/%'` returned no response (curl exit 52) and the dev
   log ended with the `URIError` stack and `Node.js v22.23.2`; the process was gone.
   In production this is the extension process hosting every canvas instance, and a
   cross-site `<img src="http://127.0.0.1:<port>/%">` from any page the user visits
   reaches it (GET needs no CORS; the ephemeral port is the only secret). No data is
   exposed, but the canvas disappears until the session is reloaded. Fix: one
   error boundary around the whole handler (respond 400/500, `log`, never throw) and
   a test for the malformed-percent path (step 10.1).
2. **Moderate — a single failed background refresh exits the extension process.**
   `watch.mjs:47` and `:63` fire `void refresh({ pr })`, and `refresh` only
   `await onChange(options)` inside try/finally — no catch. `canvas.mjs:218-220`'s
   `onChange` awaits `refresh(instance, …)`, which throws `CanvasError("cli", …)` on
   any CLI spawn error, non-zero exit, bad JSON, or the 30 s timeout
   (`cli.mjs:44-60`), and `CanvasError("storage", …)` when the store becomes unreadable
   (`canvas.mjs:96-103`). Reproduced: a script calling `startWatcher` with a throwing
   `onChange` and `schedule()` exits node with code 1 and the error's stack. A
   realistic trigger exists: the 5-minute `--pr` interval runs `gh pr view` lookups
   at 15 s each through a 4-wide pool (`scripts/agento.mjs:710,717-729`); offline,
   five or more lookups (this repo has more) exceed the canvas's 30 s timeout →
   `CliError("timeout")` → crash. Fix: catch in `watch.mjs`'s `refresh` (or in
   `canvas.mjs`'s `onChange`), route the message to `session.log`, keep going; tests
   for a throwing `onChange` (step 10.2).
3. **Minor — no automated test for persistence across a real close.**
   `canvas.test.mjs` proves reopen-while-open (`:72-122`) and that `post_note`
   broadcasts (`:158-194`), but nothing asserts that after `onClose` a fresh `open`
   pushes the stored notes into the server state. The live 9.1 check exercised only
   the reopen of the still-open instance (recorded honestly on the line). The
   Reviewer's ad-hoc script passed this path, so the behavior is correct; the gap is
   coverage (step 10.3).
4. **Minor — `GET /state`, `GET /events`, and `POST /refresh` skip the Host/Origin
   checks `POST /dispatch` enforces** (`server.mjs:117-150` vs. `:152-160`).
   Reproduced: `GET /state` with `Host: evil.example:3103` → 200; `POST /refresh`
   with `Origin: http://evil.example` → 200 (a dashboard run). The state carries no
   secrets (paths, slugs, allowed commands), so this is a DNS-rebinding read of
   low-sensitivity data and a cross-site CPU trigger, not a dispatch bypass. Applying
   the same Host check to every route is a one-line change; recorded as a follow-up.
5. **Minor — initiative graph scaling.** `graph.js:77` sizes the SVG by `viewBox` alone,
   so an initiative with few waves stretches to the full panel width (visible in
   `review-4-7-light-headless.png`: `agento-hardening` nodes render several times
   larger than `agento-extension`'s). Cosmetic; a `max-width: <width>px` or an explicit
   `width` attribute fixes it. Follow-up.
6. **Minor — manual refresh never fetches PRs.** See Plan vs implementation; the
   "refresh" button and the `refresh` action default to `pr: false`, so a user who
   just opened a PR sees its chip only after the 5-minute interval or an explicit
   `refresh {pr: true}` action call. Follow-up.
7. **Nit — `app.js:124` sets `status.textContent = escapeHtml(err.message)`**;
   `textContent` does not interpret HTML, so an error containing `&` or `<` renders
   as `&amp;`/`&lt;`. Harmless.

Positive notes: the dispatch allowlist is enforced server-side against the live
snapshot, every client interpolation of CLI-sourced strings goes through
`escapeHtml` (audited `panels/*.js`; the unescaped interpolations are numbers and
nested markup), the store's atomic write and refuse-to-overwrite logic is exactly
the skill's contract, `extension.mjs` is wiring only and writes nothing to stdout,
and the harness install/uninstall keeps the never-delete-a-real-directory rule for
both links.

## Follow-ups

- Apply the `/dispatch` Host (and, for POST, Origin) check to `/state`, `/events`, and
  `/refresh` in `server.mjs` so DNS rebinding cannot read state or trigger dashboard
  runs (Finding 4).
- Cap the initiative graph SVG's rendered width to its layout width (Finding 5).
- Let the manual refresh (button and `refresh` action default) include `--pr`, or
  trigger one `--pr` refresh right after `open()` as the plan described (Finding 6).
- Add `fs.watch` `error` listeners in `watch.mjs` (an unlistened `error` event on a
  watcher — e.g. EPERM when a watched worktree directory is removed on Windows — is
  an uncaught exception).
- Make the router-skill link honor `COPILOT_HOME` like the new canvas link does
  (already in plan.md `## Out of scope`; recorded here so triage sees it).
