# Review: copilot-hook-compat

Verdict: approve

Reviewed 2026-10-16 in the build window (companion mode: product worktree
`/home/david/DP/agento-worktrees/plan-20261016-022958` at `257dcea`, artifacts in
`/home/david/DP/agento-docs-worktrees/plan-20261016-022958` at `72fc6cd`), code PR
david-perry-software/agento#115, artifact PR #53. `origin/main` is an ancestor of both
halves' HEADs; both trees clean before and after review. Skills consulted: none — the
repository has no `.agents/skills/` and AGENTS.md has no skills table (the plan's
`agent-customization` consultation covered the hook file formats).

## Acceptance checklist results

1. **Guard dual-shape output — pass.** `scripts/hooks/delivery-guard.mjs` `main()`
   emits top-level `permissionDecision`/`permissionDecisionReason` plus
   `hookSpecificOutput.*`; `tests/guard.test.mjs` `runGuard()` asserts both slots equal
   on every non-allow verdict and allow stays silent. Re-driven: `git push origin main`
   → `top=deny nested=deny equal=true`; `echo hi` → no output, exit 0.
2. **Session-context dual-shape — pass.** `session-context.mjs` `main()` emits
   `additionalContext` + `hookSpecificOutput.additionalContext`;
   `tests/session-context.test.mjs` `runWithPayload()` asserts equality and the new
   Copilot-fixture case matches `^Agento CLI: node `. Re-driven with
   `fixtures/copilot/workspace-SessionStart-1.json` → `slotsEqual=true cliLine=true
   branchLine=true`.
3. **`decide()` normalization — pass.** `readToolInput()` + `TOOL_CLASS`/`isWriteTool()`
   (delivery-guard.mjs L47–L80); tests "Copilot tool names map…", "toolArgs and string
   tool_input…", "malformed toolArgs…" all pass. Re-driven: `Write`/`Edit` with
   `tool_input.path` on `.github/hooks/x.json` → `ask`/`ask`; `Read` → allow.
4. **Captured payloads pass through — pass.** Test "every captured local and Copilot
   PreToolUse payload runs through the guard with allow" passes; I re-drove all 13
   Copilot PreToolUse captures (`fixtures/copilot/*` and `fixtures/copilot-plugin/*`,
   incl. the plugin-source one) through `delivery-guard.sh`: exit 0, allow, no stderr.
5. **Replays — pass.** Run by me: default `guard-fixtures.txt` exit 0 / 0 MISMATCH;
   `REPLAY_COMPANION=1` companion exit 0 / 0 MISMATCH; `REPLAY_FORMAT=copilot` on
   `guard-fixtures.txt` exit 0 / 0; `REPLAY_FORMAT=copilot REPLAY_COMPANION=1` exit 0 /
   0; `REPLAY_FORMAT=copilot` on `guard-fixtures-copilot.txt` exit 0 (15 lines, all as
   expected). `.github/workflows/ci.yml` runs the three Copilot replays
   (`grep -c REPLAY_FORMAT=copilot` → 3) and PR #115 CI is green
   (`wait-for-checks.sh pr 115` → `RESULT: success`).
6. **Plugin-hook cause proven — pass (obsolete branch).**
   `fixtures/copilot-plugin/plugin-SessionStart-1.json` and `plugin-PreToolUse-1.json`
   carry `source: plugin` and a `diagnostic` with `CLAUDE_PLUGIN_ROOT`/`PLUGIN_ROOT`/
   `COPILOT_PLUGIN_ROOT` all equal to the staged copy
   `~/.config/Code/agentPlugins/<name>/<hash>` and `nodeCommandV` found. The token
   expands; the old failure was the probe's `../log-payload.mjs` escaping the staged
   root. `docs/copilot-harness.md` row names that cause and links both captures. The
   "or" branch of the item (fix steps obsolete with cause, no wiring change) is met;
   the `harness-install` Follow-up is correctly omitted because nothing is left to hand
   over. Independently verified: the real plugin's staged copies on this machine
   (`~/.config/Code/agentPlugins/file-home-david-DP-agento-plugin/*/`) keep
   `scripts/hooks/delivery-guard.sh` and `session-context.sh` executable (`hooks.json`
   execs them directly, no `bash` prefix) and carry the full `scripts/` tree; the
   branch's hooks run from a `git archive` copy with that env against an **unwired**
   target repo deny `git push origin main --dry-run`, deny force-push, deny
   `echo '{}' > .github/hooks/x.json`, ask on `Write`/`Edit` of `.github/hooks/x.json`,
   allow `echo hi`/`Read`, and SessionStart emits the `Agento CLI:` line pointing into
   the copy; in the wired Agento worktree the plugin-mode SessionStart dedupes
   (silent).
7. **Live Local check (4.1) — pass.** Recorded on the step with both outcomes and the
   date; `.github/hooks/` holds only `delivery-guard.json` and `session-start.json`.
8. **Live Copilot check in the Agento worktree (4.2) — pass, with a caveat.**
   Evidence `step-6-2-copilot-capture-{1,2,3}.png` shows the `Agento CLI:` line, the
   Copilot-harness deny string ("Denied by preToolUse hook: Direct commits/pushes to
   main are forbidden…"), and the model's report of the hook-file approval prompt being
   denied with no file created; `git status --porcelain` empty. The first run
   (`step-4-2-copilot-clone-{1,2}.png`) failed and is recorded as such on the step. See
   Findings F1 for the judgement on sufficiency.
9. **Live target-repo check (4.3) — pass (condition not met).** The item is gated on
   "only if the plugin wiring fix landed"; no fix landed, the step is obsolete with the
   required reason. Target-repo guarding is evidenced headlessly (item 6) rather than
   live; see Follow-ups.
10. **Full gate — pass.** Run by me on `257dcea`: `shellcheck scripts/hooks/*.sh
    scripts/wait-for-checks.sh` (ShellCheck 0.11.0, npx-cached) exit 0, no findings
    (matches the green baseline); `node --test 'scripts/**/*.test.mjs'
    'tests/**/*.test.mjs'` → exit 0, 543 tests, 543 pass, 0 fail (baseline 535 + 8
    new); all five replays exit 0 (item 5).
11. **Docs — pass.** `docs/hooks.md` (dual-shape output, normalization, Copilot `ask`
    semantics, `REPLAY_FORMAT=copilot`, the opt-in diagnostic); `docs/copilot-harness.md`
    (proven-cause row, "Ask caveat", "Live checks in the Agento clone"); AGENTS.md
    `## Commands` lists the three Copilot replays; ci.yml runs them.

## Plan vs implementation

- Approach 1–4 and 6 implemented as planned. Approach 5 (plugin wiring) resolved by
  evidence that no change is needed; `hooks/hooks.json`, `tests/customizations.test.mjs`,
  and `isDuplicatePluginRun()` are untouched, which is the plan's documented "no fix"
  branch. `extension/cli/` needs no `copy-cli` (no `scripts/*.mjs` change).
- Undocumented-in-plan addition, documented in the roadmap (Phase 6, added
  2026-10-16): the opt-in guard diagnostic (`debugEnabled()`/`debugWrite()` in
  `delivery-guard.mjs`, two tests, `docs/hooks.md` paragraph). Verified off by default
  (no marker, no env → no log file), unable to affect verdicts (with
  `AGENTO_GUARD_DEBUG_LOG=/proc/nonexistent/x.log` the deny is still emitted, exit 0),
  and documented. It logs raw payloads by design — see F2.
- Deviation: 4.2 is ticked on 6.2's evidence instead of its own passing run, and 6.4
  (a dedicated re-check) was marked obsolete as superseded by 6.2. The roadmap says so
  explicitly; see F1.
- The user's mid-build edits to `delivery-guard.mjs` and `tests/guard.test.mjs` are
  consolidated in `fd9cd7f` (6.1): exports, call sites, and tests are coherent, the
  38 guard tests pass, and no `.github/hooks/x.json` debris remains.
- `tests/harness-probe/log-payload.mjs` moved into `plugin/` and gained the diagnostic
  as planned; its `main().catch()` wrapper was dropped (F4).

## Roadmap audit

Spot-checked every ticked box against the code and evidence: 1.1–1.4, 2.1–2.3, 3.1,
3.3, 5.1, 5.2, 6.1, 6.5 match the diff and the commands above. Manual steps 3.2, 4.2,
6.2 each link existing evidence files (`step-3-2-copilot-plugin.png`,
`step-4-2-copilot-clone-{1,2}.png`, `step-6-2-copilot-capture-{1,2,3}.png`). Obsolete
steps 3.4, 4.3, 6.3, 6.4 carry their reasons. No falsely ticked boxes; no repairs made.
Note on 6.4: marking it obsolete is logically sound (no code changed between 6.2 and
HEAD apart from docs), but it means the Copilot live check passed exactly once after
failing once — recorded as F1 rather than as a roadmap repair.

## Findings

- **F1 (minor) — the Copilot live check is 1 pass / 1 fail with an unproven cause.**
  Step 4.2 failed (push ran, hook file created with no card; `step-4-2-copilot-clone-
  {1,2}.png`), 6.2 passed with identical prompts and settings after a window reload.
  The Builder's "stale hook state" explanation is labelled as inference and the failure
  is recorded on the step and in `docs/copilot-harness.md` — that is honest. It is
  sufficient for approval because the guarded behaviour is deterministic code proven
  headlessly on the captured Copilot payloads (items 1–6), the 6.2 debug log showed one
  workspace-hook firing per call with the expected shapes, and the guard is a slip guard
  behind GitHub rulesets. Residual risk: a session state in which Copilot does not run
  PreToolUse at all cannot be excluded. The 6.2 screenshots show the model's narration
  of the approval card, not the card UI itself; the Copilot deny string in capture 2 is
  the direct harness evidence.
- **F2 (minor) — diagnostic log permissions and contents.**
  `scripts/hooks/delivery-guard.mjs` `debugWrite()` appends raw payloads (`command`,
  `file_text`, `old_str`/`new_str`) to a predictable `/tmp/agento-guard-debug.log`
  with `fs.appendFileSync` default mode — created `-rw-rw-r--` under this machine's
  umask 0002, i.e. group-writable and world-readable. Opt-in only, so acceptable, but
  pass `{ mode: 0o600 }` (and consider `os.tmpdir()`/a per-user dir) so a diagnosis
  never leaves secrets readable by other local users.
- **F3 (minor) — test deletes live diagnostic state.** `tests/guard.test.mjs` "debug
  logging stays off without the marker or env" runs `fs.rmSync("/tmp/agento-guard-
  debug")` and removes the log: running the suite silently ends a diagnosis in
  progress (which is likely why the 6.2 log no longer exists). Assert instead of
  removing, or point the guard at a scratch path via `AGENTO_GUARD_DEBUG_LOG` and
  make the marker path overridable.
- **F4 (minor) — evidence not preserved.** The 6.2 `/tmp/agento-guard-debug.log` was
  the deciding artifact for 6.3 ("workspace hook fired once, `COPILOT_CLI=1`, no
  `*PLUGIN_ROOT*`") but was not saved (sanitized) under `evidence/`; the roadmap and
  docs paraphrase it and it is now gone from `/tmp`.
- **F5 (minor) — probe logger error handling.** `tests/harness-probe/plugin/log-
  payload.mjs` ends with a bare `main();` while its header still promises "Any internal
  error is caught: it exits 0 with no output" — an unhandled rejection would now exit 1
  (probe-only code; nothing in `main()` can currently throw outside a `try`).
- **F6 (nit) — `TOOL_CLASS` "shell"/"neither" classes are documentation only.**
  `decide()` still derives shell text by key regardless of tool name, so a `Read`/`Agent`
  payload carrying a `command` key would be evaluated as shell; `docs/hooks.md` states
  the map as if enforced. Harmless for every captured shape.
- **F7 (nit) — `main()` now swallows `readPayload()` errors silently** (previously the
  stack reached stderr); verdict unchanged (allow).
- **F8 (nit) — `tests/guard-fixtures-copilot.txt` has no `allow @Read` on a protected
  path** (only ordinary files); `tests/guard.test.mjs` covers it.

## Follow-ups

- Harden the opt-in guard diagnostic: `{ mode: 0o600 }` on the log, overridable marker
  path, and a test that does not delete the live marker (F2, F3).
- Preserve the Copilot live-check diagnostic log as sanitized evidence next time it is
  the deciding artifact (F4).
- `harness-install` (or the next Copilot live step): one live Copilot check in a target
  repository (soshiki) through the plugin wiring, and a second Agento-worktree Copilot
  run, to close F1's residual risk with a 2-of-2 live pass.
- Restore the `main().catch()` guard in `tests/harness-probe/plugin/log-payload.mjs`
  or update its header comment (F5).
