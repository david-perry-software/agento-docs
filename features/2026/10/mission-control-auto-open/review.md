# Review: mission-control-auto-open

Verdict: approve

Reviewed 2026-10-27 at product `bf41697` (`feature/mission-control-auto-open`, PR
#134 draft) against companion `92baf60` (agento-docs PR #69 draft). `origin/main` is
an ancestor of both HEADs; both halves were clean and in sync with their remotes at
the start of the review. Reviewer runs as an Autopilot subagent without canvas
tools, so step 5.1 was judged from independently re-read evidence (feed store,
session logs, screenshots) rather than re-driven; everything CLI-executable was
re-run.

Skills consulted: none — no matching domain (the repository has no `## Agento`
skills table and no `.agents/skills/`; the plan records the same).

## Acceptance checklist results

1. **`defaultConfig()` has `missionControl.autoOpen: true`; template ships `null`;
   explicit `false` honored** — **pass.** `scripts/agento-config.mjs` adds
   `missionControl: { autoOpen: true }`; `templates/agento.json` adds
   `"missionControl": { "autoOpen": null }`; `scripts/agento-config.test.mjs`
   "missionControl.autoOpen defaults to true and an explicit false is honored"
   covers default/false/null and the template test asserts `autoOpen === true`.
   `node scripts/agento.mjs config` → `.config.missionControl = {"autoOpen":true}`.
   Part of the full gate run below (821 pass).
2. **`preflight <command>` carries a `canvas` field with all eight keys and never
   changes `preflightLines`/`status`/`receipt`** — **pass.** `canvasDocument()` is
   embedded in `preflightDocument()` after `preflightLines`
   (`scripts/agento.mjs`); "preflight returns the named sections…" asserts the key
   order and the eight canvas keys, and the window-mismatch test asserts the canvas
   is present and unchanged on a rejected document. Live: `preflight
   delivery-status` here → `status: ok`, `preflightLines: []`, `canvas.attempt:
   true`.
3. **`canvas <command>` is the same document, read-only, honors every attempt
   condition, `refresh.pr` only for `ship`/`delivery-status`, exit 1 on usage
   errors** — **pass.** `case "canvas"` validates against `COMMAND_NEEDS`, runs no
   doctor/gh/network; the matrix test "canvas <command> reports the attempt matrix
   from local reads only" covers installed, autoOpen false, absent, foreign-invalid,
   foreign-valid, dangling, setting false, unreadable settings → `null`+attempt,
   hosted, `mission-control`, `refresh.pr`, and three usage errors. Live here:
   `canvas delivery-status` → `attempt: true, link: "foreign", reason: "canvas
   installed from /home/david/DP/agento-plugin/canvas/agento-mission-control",
   refresh.pr: true`, exit 0; `canvas mission-control` → `attempt: false`; `canvas
   ship` → `refresh.pr: true`; `canvas` and `canvas nope` → exit 1 `usage-error`.
4. **§11 step 6 Mission Control present; every `§N` reference resolves** —
   **pass.** `delivery-policy.instructions.md` §11 step 6 added with refresh →
   `open_canvas` on error → closing `post_note`, top-level only, silent, gated by
   `canvas.attempt`; `tests/customizations.test.mjs` "§11 names the Mission Control
   step…" pins the four tokens, and the existing §N-reference test passes in the
   gate.
5. **Router Subagent mode runs `agento.mjs canvas <name>` + refresh/open before and
   note after; Autopilot states its subagents skip the step** — **pass.**
   `skills/agento/SKILL.md` step 5 Subagent mode wording added;
   `.github/agents/delivery-autopilot.agent.md` "Mission Control once per run"
   bullet added; the customizations test pins the router wording. Note: the
   Autopilot sentence itself is not pinned by a test (see Findings, minor).
6. **Docs describe the setting, field/subcommand, and behavior** — **pass.** Diff
   read in full: `docs/project-profile.md` (json block + table row), `README.md`
   `## Configuration`, `docs/commands.md` (subcommand list + `## Preflight`),
   `docs/install.md`, `docs/copilot-harness.md`, `AGENTS.md` subcommand list,
   `CHANGELOG.md` Unreleased. `grep -n missionControl docs/project-profile.md
   README.md` matches in both.
7. **`extension/cli/` regenerated** — **pass.** Byte-compared every non-test
   `scripts/*.mjs` against `extension/cli/*.mjs`: identical. `cd extension && npm
   run test:unit` → 251 pass, 0 fail; `tests/extension-bundle.test.mjs` passes in
   the gate.
8. **Live: canvas closed → `/agento delivery-status` opens it (refresh fails →
   open); second command refreshes without reopening; result note in the feed** —
   **pass** (evidence re-read independently, not re-driven — this subagent has no
   canvas tools):
   - Session `448f1287…/events.jsonl`: 19:38:13Z `invoke_canvas_action refresh
     {pr:true}` on `mission-control` → completion carries `Canvas instance … is not
     open. No canvases are currently open — call open_canvas first`; 19:38:16Z
     `open_canvas agento-mission-control / mission-control` → `status: "live"`;
     19:45:06Z second run's `refresh {pr:true}` → `result.lanes` (planned 0,
     building 1, …) with no further `open_canvas` in that session.
   - Session `ddb8cdca…/events.jsonl` (same window, later session): refresh "not
     open" at 19:50/19:54 → one `open_canvas` → `post_note` 19:57:13Z; refresh →
     lanes at 20:10:43Z → `post_note` 20:11:20Z; refresh → lanes 20:38:50Z →
     `post_note` 20:39:23Z (no reopen on either).
   - Feed store `~/.copilot/extension-data/agento-mission-control/c0107b40b85b9cc7.json`
     `.notes`: three `level: "success"` entries at 19:57:13Z, 20:11:20Z, 20:39:23Z
     whose `text` is the delivery-status §9 result line (`slug: null`, correct for a
     slug-less command).
   - `evidence/step-5-1-canvas-open.png` (1229×768) shows the live canvas beside the
     chat's `refresh {pr:true}` call at 15:45 local (19:45Z);
     `evidence/step-5-1-canvas-feed.png` shows the canvas with the Activity badge at
     3 beside the completed result line at 16:43 local. No secrets visible.
   - `get_snapshot` substitution: accepted. The acceptance item's purpose is proof
     the canvas is live after the open; a successful `refresh` returning live lane
     counts from the same instance proves that at least as well as `get_snapshot`
     would. The roadmap records the substitution on the 5.1 line.
9. **Full gate equals the green baseline** — **pass.** Re-run by the Reviewer in
   the product checkout: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'
   'canvas/**/*.test.mjs'` → 821 tests, 821 pass, 0 fail (baseline 816; +5 new).
   All five AGENTS.md replay-guard smoke runs exit 0. ShellCheck 0.10.0 (fetched to
   `/tmp/sc`, removed afterwards) on `scripts/hooks/*.sh scripts/wait-for-checks.sh`
   → exit 0, no findings — equal to the plan's baseline (no `.sh` changed).
   `git status --porcelain --untracked-files=all` empty afterwards.

## Plan vs implementation

- **Documented deviations (accepted).** The plan's original `attempt` rule
  (`link === "installed"`) was loosened in Phase 6 to also accept a `foreign` link
  whose resolved target holds `extension.mjs`; the instruction carrier moved in
  Phase 7 from "policy §11 + always-on core pointer" to "the clause in every
  command/agent preflight sentence" with the preflight document reordered. Both are
  recorded as dated addenda under plan.md `## Risks`, as Phases 6 and 7 in the
  roadmap, in `docs/commands.md`, and in the CHANGELOG entry. The final design
  matches the code.
- **`## Approach` and `## Acceptance checklist` not re-synced.** `## Approach` item
  2 still shows the original `installed`-only rule and the original key order, and
  acceptance item 8 still names `get_snapshot`; the addenda override them but a
  reader of `## Approach` alone gets the pre-fix design. Minor — the addenda are
  dated and explicit.
- **Autopilot sentence unpinned.** Acceptance item 5 says the Autopilot statement is
  verified by "new assertions" in `tests/customizations.test.mjs`; the test pins §11
  tokens and the router's `agento.mjs canvas` but not the Autopilot bullet. The
  bullet is present (verified by reading the diff). Minor.
- **Wording "keep it compact" (7.2).** The reorder was done; "compact" is
  satisfied by the position (`"attempt"` lands at ~230 of 600 chars here), not by
  trimming — fine.
- No undocumented source changes: the 76 changed files are exactly the plan's
  affected-files list plus the 58 command/prompt/agent files added by 7.1.

## Roadmap audit

Spot-checked all 18 ticked boxes against the codebase and the re-run gate: 1.1,
2.1, 2.2 (CLI + tests), 3.1–3.3 (policy, router, autopilot, tests), 4.1 (docs),
4.2 (byte-identical `extension/cli`, 251 unit tests), 5.1 (evidence above, both
linked files present), 5.2/6.4/7.4 (gate re-run green), 6.1 (foreign link →
`attempt: true` here), 6.2 (core line + test, core at 39 lines ≤ 40), 6.3/7.3
(docs + CHANGELOG + bundle), 7.1 (58 of 58 files with `preflightLines` carry
exactly one copy of the identical clause), 7.2 (key order + `head -c 600` shows
`"attempt": true`). **No falsely ticked boxes; no missing-work steps; no repairs
made.** 5.1 is not a `(manual)` step, yet it links its evidence files and records
the substitution — good practice. No `(manual, post-ship)` steps exist.

## Findings

Nothing above minor severity.

- **Minor — first live session skipped the closing note.** In session `448f1287…`
  (the 19:38Z/19:45Z runs) the agent performed refresh/open but issued no
  `post_note`; the notes come from the later session `ddb8cdca…`. The design is
  sound and the later session shows the full loop three times, but it illustrates
  the plan's own "agents skip the step" risk for the closing half. Consider a
  follow-up that pins the result-note half as firmly as the opening half (e.g. the
  command-file result-line sentence naming `post_note`, as 7.1 did for refresh).
- **Minor — `canvasDocument()` reason for a non-boolean `autoOpen`.**
  `scripts/agento.mjs`: `attempt` requires `autoOpen === true`, but `reason` tests
  `!autoOpen`; a truthy non-boolean (`"yes"`, `1`) in `.github/agento.json` yields
  `attempt: false` with a "canvas installed…" reason that does not name the cause.
  Config validation elsewhere is lenient too, so this is consistent; a one-line
  `autoOpen !== true` in the reason chain would make it self-describing.
- **Minor — shadowed `command` in `case "canvas"`.** `const command = rest[0]`
  shadows the switch discriminant inside the block (`scripts/agento.mjs`). Legal
  and correct, but every other case uses a distinct local name; rename for
  consistency when next touched.
- **Minor — screenshot does not show the Activity tab contents.**
  `step-5-1-canvas-feed.png` shows the Activity badge at 3, not the note text the
  plan asked for; the feed store supplies the text. Acceptable evidence, noted for
  completeness.
- **Minor — Autopilot bullet not pinned by a test** (see Plan vs implementation).
- **Minor — long single-line edits.** The 7.1 clause was spliced into one existing
  line in every file, producing lines well over the surrounding wrap width (e.g.
  `delivery-reviewer.agent.md`, `delivery-status.md`). Cosmetic.

## Follow-ups

- Pin the closing `post_note` half of §11 step 6 in the per-command result-line
  sentence (mirroring 7.1) and add a customizations assertion, so the note is
  carried as reliably as the refresh/open.
- Add a `tests/customizations.test.mjs` assertion that
  `.github/agents/delivery-autopilot.agent.md` states its Builder/Reviewer
  subagents skip §11 step 6.
- Make `canvasDocument().reason` name a non-boolean `missionControl.autoOpen`
  (`autoOpen !== true` in the reason chain).
- Re-sync plan.md `## Approach` item 2 and acceptance item 8 to the final design on
  the next plan edit (or leave the dated addenda as the record — either is fine;
  do not rewrite history solely for this).
- Re-wrap the 58 clause-bearing lines on the next sweep of the command/prompt/agent
  files.
