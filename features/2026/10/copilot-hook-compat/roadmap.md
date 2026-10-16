```yaml
status: planned
branch: feature/copilot-hook-compat
last-updated: 2026-10-15
next-step: "1.1 Emit dual-shape output from delivery-guard.mjs main()"
initiative: "copilot-harness"
```

# Roadmap: copilot-hook-compat

## Phase 1: Hook scripts speak both harnesses

- [ ] 1.1 Emit dual-shape output from `scripts/hooks/delivery-guard.mjs` `main()` (top-level `permissionDecision` + `permissionDecisionReason` alongside `hookSpecificOutput`) and update the `tests/guard.test.mjs` `decide()` helper to assert both slots are present and equal — verify: `node --test tests/guard.test.mjs` exits 0
- [ ] 1.2 Emit dual-shape output from `scripts/hooks/session-context.mjs` `main()` (top-level `additionalContext` alongside `hookSpecificOutput`); assert both slots equal in `tests/session-context.test.mjs` and add a case feeding the Copilot SessionStart fixture payload (`tests/harness-probe/fixtures/copilot/workspace-SessionStart-1.json` `parsedStdin`, cwd replaced) that yields an `Agento CLI:` line — verify: `node --test tests/session-context.test.mjs` exits 0
- [ ] 1.3 Normalize tool input in `decide()`: explicit Copilot↔Local tool map (`Bash`/`run_in_terminal` shell; `Write`/`Edit`/`create_file`/`replace_string_in_file` write; `Read`/`Agent`/`tool_search_tool` neither) and tool input from `tool_input`/`toolInput`/`toolArgs` as object or JSON-string object, `{}` otherwise; add Copilot-shaped cases (Bash push to main → deny; Write and Edit `path` on `.github/hooks/x.json` → ask; Read → allow; `toolArgs` string → same verdict as object; malformed `toolArgs` and array `tool_input` → allow, exit 0) — verify: `node --test tests/guard.test.mjs` exits 0
- [ ] 1.4 Add a fixture-driven test that pipes every `tests/harness-probe/fixtures/{local,copilot}/*PreToolUse*.json` `parsedStdin` (placeholders replaced with a temp repo) through `delivery-guard.sh` and asserts exit 0 and allow — verify: `node --test tests/guard.test.mjs` exits 0

## Phase 2: Copilot replay

- [ ] 2.1 Add `REPLAY_FORMAT=copilot` to `scripts/hooks/replay-guard.sh` (approval-gated edit): Bash payloads, read the top-level decision, report a MISMATCH when the nested slot disagrees; add the `<verdict> @<Tool> <path>` line form for file-tool payloads — verify: `REPLAY_FORMAT=copilot ./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` and `REPLAY_FORMAT=copilot REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` exit 0; both default-format replays still exit 0
- [ ] 2.2 Add `tests/guard-fixtures-copilot.txt` (Write/Edit on `.github/hooks/x.json`, `scripts/hooks/x.sh`, `hooks/hooks.json` → ask; Write/Read on ordinary files → allow; Bash push/force-push → deny) — verify: `REPLAY_FORMAT=copilot ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-copilot.txt` exits 0
- [ ] 2.3 Run the Copilot replays in `.github/workflows/ci.yml` and list them in AGENTS.md `## Commands` — verify: `grep -c REPLAY_FORMAT=copilot .github/workflows/ci.yml AGENTS.md` shows each ≥ 1; full shellcheck (npx-cached binary on `PATH`) exits 0 with no findings

## Phase 3: Plugin hooks in Copilot (re-probe, then fix)

- [ ] 3.1 Make the probe plugin self-contained: `tests/harness-probe/plugin/hooks/hooks.json` (approval-gated) runs a logger inside the plugin root (no `..`) and adds a token-free diagnostic entry recording cwd, `command -v node`, and the names/values of `*PLUGIN_ROOT*` env vars only into the probe log dir; extend `probe.mjs collect` sanitization and `PROMPTS.md` accordingly — verify: `node --test tests/harness-probe/probe.test.mjs` exits 0; running both hook commands locally with and without `CLAUDE_PLUGIN_ROOT` set writes the expected log entries
- [ ] 3.2 (manual) Run `node tests/harness-probe/probe.mjs setup`, add the printed plugin path to user `chat.pluginLocations`, reload the probe window, start one **Copilot** chat and send `PROMPTS.md` prompts 1–2, then remove the entry and reload; attach one screenshot of the Copilot chat — verify: `evidence/step-3-2-copilot-plugin.png` saved; the probe log dir holds plugin-source or diagnostic files (their absence is itself the finding)
- [ ] 3.3 Collect with `probe.mjs collect --harness copilot-plugin`, commit the sanitized captures, and replace the hedged row in `docs/copilot-harness.md` with the proven cause — verify: new files under `tests/harness-probe/fixtures/copilot-plugin/`; `node --test tests/harness-probe/probe.test.mjs` exits 0; the doc row names one cause and links the capture
- [ ] 3.4 Fix `hooks/hooks.json` per 3.3 (approval-gated) so the guard and session context resolve in Copilot while `${CLAUDE_PLUGIN_ROOT}` keeps working in Local; update `tests/customizations.test.mjs` L905–L950 and `isDuplicatePluginRun()` (with a test) to the proven detection; if `scripts/agento.mjs` changes, run `cd extension && npm run copy-cli`. If 3.3 shows no in-plugin wiring can work, mark this step obsolete with the cause and add a `harness-install` Follow-up — verify: `node --test tests/customizations.test.mjs tests/session-context.test.mjs` exits 0; the hook commands run from a copy of the plugin root with the proven env exit 0 and produce output

## Phase 4: Live checks in both harnesses

- [ ] 4.1 Local live check from the build window (workspace wiring of this worktree): run `git push origin main --dry-run` and attempt to create `.github/hooks/x.json` with an edit tool (decline the approval) — verify: the push is denied with the "Direct commits/pushes to main" reason and the edit shows the approval prompt; both outcomes and the date recorded on this line; no `.github/hooks/x.json` left behind
- [ ] 4.2 (manual) In this worktree's window, start a chat with Session Target **Copilot** and "Manual permissions"; ask "Which `Agento CLI:` line is in your context?", then "Run `git push origin main --dry-run`", then "Create `.github/hooks/x.json` containing `{}`" and reject the approval card; attach one screenshot — verify: `evidence/step-4-2-copilot-clone.png` saved showing the context line, the deny, and the approval card; `git status --porcelain` is empty
- [ ] 4.3 (manual) Only if 3.4 landed a fix: in user `chat.pluginLocations` temporarily replace `/home/david/DP/agento-plugin` with this worktree's path, reload a soshiki window, repeat 4.2's three prompts in a **Copilot** chat and in a **Local** chat, then restore the original entry and reload; attach one screenshot per harness — verify: `evidence/step-4-3-soshiki-copilot.png` and `evidence/step-4-3-soshiki-local.png` saved, each showing the context line, the deny, and the approval prompt/card; else mark obsolete with "no plugin wiring fix (3.4 obsolete)"

## Phase 5: Docs and gate

- [ ] 5.1 Update `docs/hooks.md` (dual-shape output, tool normalization, `REPLAY_FORMAT=copilot`, Copilot `ask` semantics) and `docs/copilot-harness.md` (`copilot-hook-compat` outcome; `ask` caveat) — verify: `grep -n "REPLAY_FORMAT=copilot\|additionalContext" docs/hooks.md` and `grep -n "ask" docs/copilot-harness.md` show the new text; `node --test tests/customizations.test.mjs` exits 0
- [ ] 5.2 Full gate: shellcheck (npx-cached binary; compare with the green 2026-10-15 baseline), `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`, both default replays, the three Copilot replays — verify: every command exits 0 and shellcheck reports no findings; results recorded on this line

## Follow-ups

- The delivery guard treats `./scripts/hooks/replay-guard.sh < fixtures > /tmp/x.log 2>&1` as a hook-file write and denies it (redirect pattern in `PROTECTED_REDIRECT`, `scripts/hooks/delivery-guard.mjs` L22), observed while planning on 2026-10-15.
