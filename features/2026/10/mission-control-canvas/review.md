# Review: mission-control-canvas

Verdict: approve

Round 2, 2026-10-24. Reviewed product `feature/mission-control-canvas` at `6895aed`
(PR #130; `origin/main` `97b2889` is an ancestor; 25 commits, 48 files, +7261/−54) and
the companion half at `b832957` (agento-docs PR #67). Both halves were clean and in
sync with `origin` at the start of the review (`git status --porcelain
--untracked-files=all` empty, `0 0` against `origin/<branch>` in each). Skill
consulted: VS Code's built-in `create-canvas`
(`/usr/share/code/resources/app/extensions/copilot/assets/prompts/skills/create-canvas/SKILL.md`);
the repository has no `.agents/skills/` and no `## Agento` skills table, and the
round-2 changes are generic Node robustness with no further domain skill to apply.

Round 1 (`47ed100`) requested changes for two moderate robustness findings with one
root cause — no error boundary around async paths in the extension process — plus a
missing persistence test, as roadmap steps 10.1–10.3. The Builder's three commits
(`2e33202`, `eae2b32`, `6895aed`) touch only
`canvas/agento-mission-control/{server,watch,canvas}.mjs` and their three test files
(+180/−2). Each fix was reproduced independently below against the original failure
paths. No other source file changed since round 1 (`git diff --stat 47ed100..HEAD`
lists exactly those six files; `public/` and `extension/` are byte-identical to the
round-1 reviewed state), so the round-1 pass results for the unchanged acceptance
items carry forward and were re-run where a CLI check exists.

## Verification run by the Reviewer

| Check | Command | Result |
| --- | --- | --- |
| Full test suite | `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` | exit 0 — **734/734 pass** (729 at round 1 + the 5 new tests, all present by name in the TAP log) |
| Syntax | `node --check` on every `canvas/agento-mission-control/*.mjs`, `public/*.js`, `public/panels/*.js` | exit 0 |
| Extension | `cd extension && npm run typecheck && npm run test:unit` | exit 0 — 0 findings, **250/250 pass** |
| Extension electron | `cd extension && npm run test:electron` | **First run exit 1** while the 734-test suite was running concurrently on this machine: `Timed out waiting for Model Profiles to reach the no-file state; state: no-plugin-root` (a 20 s `onDidChangeTreeData` wait in `suite.ts:647-650`, Model Profiles scenario, not a canvas path; `extension/` is unchanged since round 1 where the same run passed). **Second run on the idle machine exit 0** — in-repo, companion, workspace, and no-markdown scenarios all passed. Recorded as an environmental timeout, not a defect; see Findings 4 |
| Guard replays (×5) | plain, companion, Copilot format, Copilot format + companion, Copilot fixtures | all exit 0 |
| Command preflight | `node scripts/agento.mjs preflight mission-control` | `status: ok`, receipt `mission-control:plan-20261023-204459:6895aed` |
| CI | `scripts/wait-for-checks.sh pr 130` | `RESULT: success` (pass=1 fail=0 pending=0, merge=CLEAN) at head `6895aed`; the `test` job carries the `Shellcheck` step — 0 findings vs. the baseline of 0 |
| Shellcheck locally | `command -v shellcheck` | not installed (exit 127, same as the recorded baseline); CI is the authority |
| **10.1 re-probe: `GET /%`** | `dev.mjs --port 3103` + curl | `GET /%` → **400** (round 1: no response, curl exit 52, process gone); then `GET /state` → 200; `GET /%E0%A4%A` → 400; `GET /app.js%zz` → 400; `GET /` → 200; the dev process survived all three malformed paths and logged `URIError: URI malformed` three times |
| 10.1 regression | same server | `GET /..%2f..%2fetc/passwd` → 403; `OPTIONS /dispatch` → 405; `POST /dispatch` allowed → 204 and `dev.mjs` printed `dispatch: /agento continue` exactly once; foreign `Origin` → 403 `["origin"]`; non-allowed command → 403 `["command"]`; dev-only `POST /_dev/note` with a non-JSON body → 400 `["json"]` and `/state` still 200 |
| **10.2 re-probe: failing background refresh** | ad-hoc script (`unhandledRejection` → exit 97) | (A) real `startWatcher` with a throwing `onChange`, `pr: true`, short debounce/interval: 4 `onChange` calls (debounce **and** interval path), 4 `onError` reports, `stop()` clean. (A2) same with no `onError` supplied: survived. (B) full `defineMissionControl` with real `watch.mjs`, real `server.mjs`, real `store.mjs` under a temp `COPILOT_HOME`, dashboard throwing `{code:"exit"}` on its 2nd call: one log line `Mission Control background refresh failed: agento.mjs dashboard exited 1`, the 3rd (later) refresh ran, `GET /state` on the live server → 200. **Script exit 0** (round 1: exit 1 with the error's stack) |
| **10.3: persistence across a real close** | `canvas.test.mjs` "post_note persists across a real close and a fresh open" | present in the 734 run and passing; it uses the real `store.mjs` under a temp `COPILOT_HOME` (`copilotHome: () => home`, default `load`/`save`), asserts the second `open` is `status: live`, a second server started, and its first `setState` feed contains `live check` — exactly the path the round-1 ad-hoc script exercised |
| UI re-drive (`local:3103`) | headless Chrome (`google-chrome --headless=new --timeout=8000 --screenshot`; this session has no browser tool, §10 fallback) | [evidence/review-r2-board-headless.png](evidence/review-r2-board-headless.png): the page still renders behind the new error boundary — header counts, five panel tabs, four lanes, progress rings, `request-changes`/`approve` chips, owner badge in build-role green, enabled `Run` buttons, disabled "runs in primary window" entries. `public/` is unchanged since round 1, whose [review-4-7-light-headless.png](evidence/review-4-7-light-headless.png) and the Builder's [step-4-7-dark.png](evidence/step-4-7-dark.png) remain valid |
| Dev link removed | `test -e ~/.copilot/extensions/agento-mission-control` | fails (absent) |
| Docs / versions | `grep -l mission-control` on the six docs → 6; `"version": "0.15.0"` in `package.json`, `.claude-plugin/plugin.json`, `extension/package.json`, `extension/package-lock.json` (×2); `## 0.15.0` in CHANGELOG; `canvas/**/*.test.mjs` in `package.json`, `ci.yml`, AGENTS.md | all present |
| Clean handoff | `git status --porcelain --untracked-files=all` in both halves after the dev server was stopped | empty (before this review's own artifact commit) |

Lint gate (policy §5, full gate — no scoped gate): the fresh final run above (734/734,
five replays, extension typecheck 0 findings, CI `Shellcheck` 0 findings) matches the
baseline recorded in plan.md `## Research` (0 findings) with no new or undocumented
findings. The plan's "Final lint comparison" block still cites `47ed100` / 729 tests;
that is historical and accurate for its date — not rewritten (policy §5).

## Acceptance checklist results

1. **Spike results recorded with the chosen install mode — pass.** plan.md `## Research`
   "Spike results (2026-10-24, step 1.3 …)" with answers (a)–(d) and the resulting
   choices; `evidence/step-1-2-spike-canvas.png` exists (234 KB). Unchanged since
   round 1.
2. **`snapshot.mjs` lanes/waves/bands/groups and the six diff event kinds — pass.**
   `snapshot.test.mjs` in the 734/734 run; fixture lanes render in the round-2 capture.
3. **`store.mjs` atomic, versioned, refuses corrupt/unknown — pass.** `store.test.mjs`
   passes; the new 10.3 test additionally proves a round-trip through the real store
   across a close.
4. **`POST /dispatch` exactly-once and every rejection path — pass.** `server.test.mjs`
   (now also the 400 malformed-percent and 500 throwing-handler cases) passes; the
   live curl run above reproduced each rejection and a single `send`.
5. **Canvas definition: four actions, idempotent `open`, `CanvasError`s, `onClose` —
   pass.** `canvas.test.mjs` passes (reopen reuses the instance; `not-found`,
   `invalid-note`, `cli`, `storage`; and now close → fresh open and a tolerated
   background failure); `node --check` clean on every file.
6. **All five panels on `local:3103`, light and dark, dispatch/elsewhere/reduced
   motion — pass.** Round-1 evidence (Builder `step-4-2`…`step-4-7-{light,dark}.png`,
   Reviewer `review-4-7-light-headless.png`) plus the round-2 capture; `public/` is
   byte-identical to round 1; `styles.css:135-143` disables animation under
   `prefers-reduced-motion: reduce`; dispatch verified via curl.
7. **Role colors equal the extension's defaults — pass.** `roles.test.mjs` in the run.
8. **Harness manages the canvas link, `--force`, never-delete-real-dir, doctor
   `canvas` — pass.** `scripts/agento.test.mjs` in the run; code unchanged since round 1
   (`scripts/agento.mjs:1061-1072`, `1084-1113`, `5014-5090`).
9. **`/agento mission-control` prompt + mirror, allowed everywhere, preflight ok —
   pass.** `tests/customizations.test.mjs` and `scripts/session-state.test.mjs` in the
   run; preflight `status: ok` at `6895aed`.
10. **"Open Mission Control" title action dispatches `/agento mission-control` — pass.**
    unit 250/250; electron in-repo scenario passed on the idle re-run.
11. **Live canvas: open, refresh, focus, post_note, dispatch, reopen with preserved
    feed — pass.** Round-1 evidence (`step-9-1-*.png`) stands; the close-then-open
    path that the live check did not exercise is now covered by the committed 10.3
    test and was re-exercised by this review's script (B) against the real server and
    store.
12. **Docs and CHANGELOG 0.15.0, version in four files — pass.** Greps above.
13. **Full gate — pass.** 734/734, five guard replays, extension typecheck/unit/electron
    (electron on the idle re-run), CI green at the reviewed SHA with 0 Shellcheck
    findings vs. baseline 0, dev link removed, both halves clean.

No item is deferred to post-ship; the plan has no `(manual, post-ship)` steps.

## Plan vs implementation

- **Round-1 findings 1–3 → steps 10.1–10.3: implemented as specified.**
  - 10.1 `server.mjs:221-240`: the listener is now a thin sync wrapper that calls the
    `async handle` and `.catch`es it — a sync throw inside an async function becomes a
    rejection, so one boundary covers both; `URIError` → 400, anything else → 500,
    `res.headersSent` → `res.destroy()`, every path calls `log`. Both `onRefresh` and
    `onExtra` run inside `handle`, so they are covered too.
  - 10.2 `watch.mjs:19,33-43`: `refresh` catches, reports through a new `onError`
    (default no-op, itself wrapped so a throwing reporter cannot crash the watcher),
    and the `finally` still drains `pending`; `canvas.mjs:262-264` wires `onError` to
    `D.log(...)` → `session.log`. The `open()` first refresh stays awaited and throwing
    (correct: the host should see an open failure), and `POST /refresh` was already
    try/caught inside the handler.
  - 10.3 `canvas.test.mjs:249-293`: real store under temp `COPILOT_HOME`, fake server
    capturing `setState`; plus `:295-334` a canvas-level failing-refresh test driving
    the real `watch.mjs`.
- **Still matching the plan:** everything recorded in round 1 (module layout, four
  actions, four dispatch checks, store path and format, `remoteSession: "off"`, link
  install mode with 6.2 obsolete, `ANY` window role, version 0.15.0).
- **Documented deviations (unchanged, acceptable):** `--pr` on the 5-minute interval
  rather than on open; the extension's lifecycle action lists do not carry
  `/agento mission-control` (consistent with `/agento delivery-status`).
- **Undocumented changes:** none; every file in `git diff --stat origin/main...HEAD` is
  in the plan's affected-files list or is a Phase 10 test/source file.

## Roadmap audit

Every ticked box was spot-checked against the codebase; none is falsely ticked.

- **10.1, 10.2, 10.3** — ticked by the Builder (companion `2bb60e1`, `7b1eba7`,
  `f011b5a`); each `verify:` was re-run by the Reviewer (table above) and passes, and
  each has the described test committed.
- Both `(manual)` steps (1.2, 9.1) carry linked evidence files that exist; the 4.7
  Reviewer repair from round 1 stands.
- Step 9.2's line reads "729/729" — accurate for its date (`47ed100`); the current
  count is 734/734 and is recorded here, not rewritten there.
- **Repairs made this round:** header `next-step` now names the ship handoff; `status`
  stays `in-review` (ship reads the verdict from this file). No step unticked, none
  added.

## Findings

No finding above minor severity remains.

1. **Resolved (was Moderate) — malformed URL crashed the server process.** Fixed by
   10.1; re-probed `GET /%` → 400 with the process alive and serving (table above).
2. **Resolved (was Moderate) — one failed background refresh exited the extension
   process.** Fixed by 10.2; re-probed through the debounce path, the `--pr` interval
   path, the default no-`onError` path, and the full canvas wiring with a real CLI-style
   failure — script exit 0, failure logged once, later refresh ran.
3. **Resolved (was Minor) — no test for persistence across a real close.** Fixed by
   10.3; committed and passing.
4. **Minor — electron suite is timing-sensitive under load.** The first
   `npm run test:electron` of this review failed on a 20 s `onDidChangeTreeData` wait
   in the Model Profiles scenario (`extension/test/electron/suite.ts:647-650`) while
   the 734-test suite ran in parallel; the idle re-run passed. The extension is
   unchanged by this delivery's round 2 and CI does not run electron. Not a defect of
   this feature; recorded as a follow-up to raise the wait or avoid the race.
5. **Nit — the boundary logs the raw `Error`.** `server.mjs:231` calls `log(err)`;
   through `canvas.mjs:252` that becomes `session.log(<Error object>)`. `dev.mjs`
   stringifies it (visible in the dev log as `URIError: URI malformed`), but the SDK
   `session.log` is a string channel and may serialize an `Error` as `{}`. Pass
   `err?.stack ?? String(err)` for a readable host log. Cosmetic; follow-up.
6. **Nit — `D.log(...)` is fire-and-forget in two new places** (`server.mjs:231` via
   `canvas.mjs:252`, and `canvas.mjs:263`). If `session.log` ever returned a rejecting
   promise the rejection would be unhandled. Very unlikely for a log call; a
   `Promise.resolve(D.log(...)).catch(() => {})` wrapper would close it. Follow-up.
7. **Carried from round 1 (all minor, unchanged):** `/state`, `/events`, `/refresh`
   skip the Host/Origin checks (`server.mjs:121-150`); initiative graph SVG scales to
   the panel width (`graph.js:77`); manual refresh never fetches PRs; `app.js:124`
   double-escapes into `textContent`; no `error` listener on `fs.watch` handles
   (`watch.mjs:63`).

Positive notes: the fix is minimal and placed at the right layer — one boundary around
the whole request handler rather than per-route try/catch, and one catch at the single
place background work is scheduled — with the reporter itself guarded; the new tests
assert "stays alive afterwards" (a second request / a later refresh) rather than just
the error status, which is the property that mattered; and the persistence test uses
the real store rather than a fake.

## Follow-ups

- Apply the `/dispatch` Host (and, for POST, Origin) check to `/state`, `/events`, and
  `/refresh` in `server.mjs` so DNS rebinding cannot read state or trigger dashboard
  runs (round-1 Finding 4).
- Cap the initiative graph SVG's rendered width to its layout width (round-1 Finding 5).
- Let the manual refresh (button and `refresh` action default) include `--pr`, or
  trigger one `--pr` refresh right after `open()` as the plan described (round-1
  Finding 6).
- Add `fs.watch` `error` listeners in `watch.mjs` (an unlistened `error` event on a
  watcher — e.g. EPERM when a watched worktree directory is removed on Windows — is an
  uncaught exception).
- Log `err?.stack ?? String(err)` from the server boundary and guard the two
  fire-and-forget `D.log` calls (Findings 5–6).
- Make the electron Model Profiles wait (`suite.ts:647-650`) robust under load, or run
  electron in CI (Finding 4).
- Make the router-skill link honor `COPILOT_HOME` like the new canvas link does
  (already in plan.md `## Out of scope`; recorded here so triage sees it).
