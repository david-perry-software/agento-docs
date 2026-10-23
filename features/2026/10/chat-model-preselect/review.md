# Review: chat-model-preselect

Verdict: approve

Reviewed 2026-10-23 (round 1) at product `feature/chat-model-preselect` `07d5875`
(code PR david-perry-software/agento#129) and companion `4958273` (artifact PR
david-perry-software/agento-docs#66). `origin/main` is an ancestor of both HEADs;
both halves were clean (`git status --porcelain --untracked-files=all` empty) before
and after the review. Skills consulted: none — the repository has no
`.agents/skills/` directory and no AGENTS.md skills table (matches plan.md
`## Research`).

Every check below was re-run by the Reviewer in the product worktree on
2026-10-23; nothing is taken from the Builder's notes without a fresh run.

## Acceptance checklist results

1. **Probe matrix saved under `evidence/`, `docs/copilot-harness.md` names the
   outcome — PASS.** `evidence/step-1-2-model-matrix.md` has one row per variant ×
   harness with picker / sent / footer columns and links all ten screenshots
   (`step-1-2-{copilot,local}-M{1..5}.png`, all present). I re-read the renderer
   log it cites (`~/.config/Code/logs/20261020T092728/window12/renderer.log`,
   68 `[ChatModelSelection]` lines): the `set-model` events at 18:46 (`copilot/…`),
   19:12 (`copilotcli/…`), 19:13 (`agent-host-copilotcli:gpt-5.6-luna`), 19:16,
   19:46, 19:51, 19:55:23 (`agent-host-copilotcli:…` on `local`), 19:55:46 match the
   matrix's per-variant record. `step-1-2-copilot-M3.png` shows the probe channel
   payload `modelSelector: { id: "gpt-5.6-luna" }` and the Copilot footer
   "GPT-5.6 Luna · 2.9 credits". `grep -n "chat-model-preselect"
   docs/copilot-harness.md` → L393 "Model preselection (`chat-model-preselect`)"
   paragraph naming Copilot = `{ id }` only, Local = `{ vendor, id }` /
   `{ vendor, family }`, `{ id }` breaks Local, plus the harness-detection finding
   and the link to the matrix (L410). The plan's "chosen variant per harness" became
   the Q6 opt-in setting because the harness is undetectable; that is recorded in
   plan.md `## Decisions` (Q6, verbatim option text) and `## Approach`.
2. **`models resolve <command> [--role …]` returns the Resolution-table model —
   PASS.** `scripts/agento.mjs` L5107–L5121: unknown prompt → `not-found` + `known[]`
   + exit 3; role defaults exactly as `pins` (`options.role ?? roleBucket(currentWindowRole())`);
   `role-profile` → `resolved.targets.find(file === prompt.file).value` (the
   `resolveTargets` answer: agent pin for a custom-agent prompt, `prompts.<name>`,
   else `default`); otherwise `parseModelValue(state.texts[prompt.file])` (file
   pins, including `custom`); `qualified` = list's first entry; `splitQualified`
   (`scripts/model-profiles.mjs` L525–L532) splits the vendor suffix;
   `copilotModel = copilotModels[qualified] ?? null`. Tests
   `scripts/agento.test.mjs` L3947–L4080 cover file pins (built-in and a
   custom-agent list pin's first entry), `--role secondary` with `prompts.<name>`
   and the `default` fallback, secondary off → file pins, dangling and invalid
   roles → file pins + warning, unpinned → null fields, unknown → exit 3,
   `copilotModel`, and "writes nothing"; `scripts/model-profiles.test.mjs` covers
   `splitQualified`. Fresh run: `node --test 'scripts/**/*.test.mjs'
   'tests/**/*.test.mjs'` → 657/657 pass, exit 0. Live read-only checks against
   the registered clone: `models resolve delivery-status --role secondary
   --plugin-root /home/david/DP/agento-plugin` → `source: file-pins` (secondary is
   off after the 4.5 restore), `qualified: "DeepSeek V4 Pro (deepseek)"`, `name`,
   `vendor: deepseek`, `copilotModel: deepseek/deepseek-v4-pro`; `models resolve
   nope` → `status: not-found`, 25 `known`, exit 3; `models resolve review-feature
   --role primary` → `agent: "🔍 Agento Reviewer"`, `qualified: "Claude Fable 5.1
   (copilot)"`, `copilotModel: claude-fable-5.1`.
3. **`pins` and `resolve` share one role-lookup helper; existing `pins` tests pass —
   PASS.** `secondaryProfileLookup(loaded, loadedRoles, state, role)`
   (`scripts/agento.mjs` L3900–L3927) is called by both verbs (L5102, L5114); the
   old inline block in `pins` is deleted. The `models pins …` tests (L3878–L3945)
   are in the 657/657 run.
4. **`selectorFor` mapping — PASS.** `extension/src/chatModel.ts` L84–L108: exact
   `vendor`+`name` match → `{ vendor, id }`; unqualified → unique `name` match,
   `>1` → "ambiguous model name … pin a qualified …" reason, `0` → "no installed
   model matches"; entries without an `id` are skipped. Per Q6 the `copilotModels`
   fallback lives in `selectorForCopilot` (L114–L122, `{ id }`, null id → reason
   naming `agento.mjs models alias set <picker> <id>`) and `preselectFor` routes
   `local`/`copilot`/`off`. `extension/test/unit/chatModel.test.ts` (26 tests)
   covers each branch. Fresh `npm run test:unit` → 250/250 pass.
5. **Dispatcher adds `modelSelector`, logs the reason without one, retries once on a
   throw with a selector; existing payload assertions unchanged — PASS.**
   `extension/src/commandDispatcher.ts` L64–L88: a rejecting resolver becomes a
   reason; `selector` → `options.modelSelector`; the `off` shape → `dispatch: model
   for <command>: <qualified> (Copilot id <id|none>) — preselection off; set it in
   the model picker`; else `dispatch: no model for <command>: <reason>`; a
   `chat.open` throw with a selector set logs `dispatch: no model for …: <error>`
   and re-executes with `modelSelector` deleted, a throw without one propagates.
   `extension/test/unit/commandDispatcher.test.ts` adds eight tests (selector
   pass-through, reason, off line with and without a Copilot id, retry-and-log,
   propagate, rejecting resolver, pending dispatch carrying the selector) and the
   pre-existing payload assertions, `planPlayButtonHandoff.test.ts`, and
   `newInitiativeFlow.test.ts` only gained a default fake resolver in their
   dependency objects (diff: +2/+6 lines, no assertion edits).
6. **Real resolver passes `--role` from the session role and falls back on timeout,
   missing root, CLI error — PASS.** `createChatModelResolver` (`chatModel.ts`
   L160–L196) runs `["models", "resolve", name, "--role", resolveChatModelRole(role),
   "--plugin-root", root]` with `{ timeoutMs: 5000 }`; `resolveChatModelRole` buckets
   `plan`/`build`/`freehand` → `secondary`; a null root, a thrown `runCli`, a
   non-canonical command, an unpinned/not-found/unparseable resolve, and a thrown
   `listModels` all return `{ selector: null, reason }`. `extension.ts` L312–L325
   wires it with live getters for `pluginRoot`, the session role
   (`sessionDoctor.current.session.role`), and the setting, and
   `CliClient.run` passes `runOptions.timeoutMs` to `execFile`'s `timeout`
   (`cliClient.ts` L75). Unit tests `chatModel.test.ts` L144–L240 assert the args,
   the role bucketing, `timeoutMs: 5000`, and each fallback; the electron scenario
   exercises the real wiring (item 7).
7. **Electron: a dashboard dispatch with an injected model list calls `chat.open`
   with the expected `modelSelector`; with no match it calls it without one and
   logs the reason — PASS (second half verified at unit level, see Findings #1).**
   Fresh `cd extension && DISPLAY=:0 npm run test:electron` → exit 0, all four
   scenarios pass; the in-repo scenario reports "chat model preselection
   (local/copilot/off)". `extension/test/electron/suite.ts` L974–L1050 pins the temp
   clone through the real CLI, injects two `vscode.lm` entries via
   `setChatModelSource`, and asserts `{ vendor: "copilot", id: "gpt-5.6-luna" }` for
   `local`, `{ id: "gpt-5.6-luna" }` for `copilot`, `modelSelector === undefined`
   for `off`, then that the banner tooltip follows off → local → copilot without a
   reload. The "no matching model → no selector + `dispatch: no model for` line"
   leg is not driven in the electron host (step 3.10, added, scoped the electron
   test to the three settings); it is covered by `commandDispatcher.test.ts` "logs
   the reason and dispatches without a selector when the resolver returns none"
   and `chatModel.test.ts` "selectorFor reports no installed model for a qualified
   value", which exercise the identical code path the electron run proves is wired.
8. **Live dispatch per harness opens on the secondary profile's model; the hint
   shows for the rest — PASS (manual evidence re-checked).** Step 4.5 (added,
   manual) replaced the per-harness step 4.2 under Q6. Evidence:
   `evidence/step-4-5-copilot.png` — Copilot chat, footer "9:22 AM · Claude Opus
   5.5 · 38.4 credits", banner "Models: preselect-live (secondary)";
   `evidence/step-4-5-local.png` — Local chat, footer "9:28 AM · Claude Opus 5.5 ·
   40.4 credits"; `evidence/step-4-5-off-tooltip.jpg` — the banner tooltip reading
   "Model preselection is off — set the model picker by hand (agento.mjs models
   resolve <command> names it; set agento.chatModelPreselect to local or copilot to
   automate)"; `evidence/step-4-5-local-tooltip.jpg` — the `local` hint. I re-read
   the cited logs myself: `window13/renderer.log` has `09:21:47.801 set-model
   sessionKey="agent-host-copilotcli" model="agent-host-copilotcli:claude-opus-5.5"`
   → `09:21:47.818 explicit-selection-applied`, and `09:23:54.599` /
   `09:27:23.516 set-model sessionKey="local" model="copilot/claude-opus-5.5"` →
   applied; `window13/exthost/output_logging_20261022T210903/4-Agento.log` L49,
   L63, L77 show `cli: models resolve delivery-status --role secondary
   --plugin-root /home/david/DP/agento-plugin -> exit 0` with no `dispatch: no
   model` line. The secondary assignment is restored: `models list` → `roles:
   { primary: "mixed", secondary: null }`, no `preselect-live` profile. The hint
   text is unit-tested in `extension/test/unit/windowBanner.test.ts`
   (`modelPreselectHint` for all three values, `affectsPreselectHint`).
9. **Docs describe the shipped behavior — PASS.** `docs/model-profiles.md` (+68:
   `resolve` in "Applying and clearing", "Window roles", the rewritten last
   paragraph of "Subagents and handoffs", "Limits"; `grep -n 'later
   \`chat-model-preselect\`'` prints nothing), `docs/extension.md` "Command
   routing" (payload `{ query, mode, attachFiles, modelSelector? }`, `--role`
   source, 5 s bound, both log lines, the retry) and "Settings"
   (`agento.chatModelPreselect` with the mismatched-value side effects),
   `docs/copilot-harness.md` "Dispatch" (item 1), `extension/README.md`,
   `README.md` command-table row, `.github/prompts/models.prompt.md` with `cmp`
   against `skills/agento/commands/models.md` exit 0, `CHANGELOG.md` `## 0.14.0
   (unreleased)` with a **Fixed** bullet for 4.6. `tests/*.test.mjs` are inside the
   657/657 run (`tests/customizations.test.mjs` includes the mirror-equality and
   declaration checks).
10. **Lint gate (§5, overlap: none) — PASS, matches the baseline.**
    - `/tmp/shellcheck-v0.10.0/shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`
      (ShellCheck 0.10.0) → exit 0, zero findings; baseline exit 0, zero findings.
      No shell file changed on the branch.
    - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → 657 pass / 0
      fail (baseline 641; +16).
    - Guard replays: `replay-guard.sh < tests/guard-fixtures.txt`,
      `REPLAY_COMPANION=1 … < tests/guard-fixtures-companion.txt`,
      `REPLAY_FORMAT=copilot … < tests/guard-fixtures.txt`,
      `REPLAY_FORMAT=copilot REPLAY_COMPANION=1 … < tests/guard-fixtures-companion.txt`,
      `REPLAY_FORMAT=copilot … < tests/guard-fixtures-copilot.txt` → all five exit 0.
    - `cd extension && npm ci && npm run build && npm run typecheck && npm run
      test:unit` → exit 0 / 0 / 0 / 250 pass (baseline 215; +35).
    - `DISPLAY=:0 npm run test:electron` → exit 0, four scenarios (in-repo,
      companion, workspace, no-markdown).
    - `npm run package` → `agento-dashboard-0.14.0.vsix` (`cli/` 10 files), exit 0;
      the vsix is gitignored and both trees stayed clean.
    - Generated copy: every `extension/cli/*.mjs` is byte-identical to its
      `scripts/` source (`cmp` loop); version `0.14.0` in `package.json`,
      `.claude-plugin/plugin.json`, `extension/package.json`,
      `extension/package-lock.json`.

## Plan vs implementation

- The plan's phase-1 "selection rule" (pick a selector shape per harness) was
  superseded during the build: the probe showed the extension cannot detect the
  session type, so the user chose Q6 option `6a` (opt-in
  `agento.chatModelPreselect`, default `off`). The change is recorded in plan.md
  `## Decisions` (Q6, verbatim), `## Approach` (the `(added 2026-10-22)` paragraph),
  and `## Risks` (mismatched-setting / remembered-model entry); steps 1.3, 3.1,
  3.3–3.5, and 4.2 are marked obsolete with that reason and replaced by 1.4, 3.6–3.10,
  and 4.5. The implementation matches the amended plan exactly: `local` →
  `{ vendor, id }` with no alias fallback, `copilot` → `{ id }` with no `vscode.lm`
  lookup, `off` → no selector plus the log line and banner hint.
- Step 4.6 `(added 2026-10-23)` is an in-scope fix the Builder found: the banner hint
  was stale after a setting change because the `onDidChangeConfiguration`
  subscription only watched `agento.pluginRoot` / `chat.pluginLocations`.
  `extension.ts` L1074–L1078 now rebuilds the indicators on
  `affectsPreselectHint(event)`; unit- and electron-tested; CHANGELOG **Fixed**.
- Undocumented-change check: the diff touches only the files listed in plan.md
  "Affected files" plus `extension/test/unit/extensionIntegration.test.ts`
  (manifest assertion for the new setting, named in step 3.6) and the version
  files named in `## Approach` item 7. No unrelated edits.
- The `off` value still spawns `models resolve` on every dispatch so the log line
  can name the model (plan.md `## Approach` Q6 paragraph). Measured cost in the
  live run: ~260 ms per dispatch. By design; see Follow-ups.

## Roadmap audit

Every one of the 24 ticked boxes was spot-checked against the branch:

- 1.1 — `tests/harness-probe/dispatch-probe/{model-variants.js,extension.js,package.json}`
  and `dispatch-probe.test.mjs` (+45) exist; the test is inside the 657/657 run.
- 1.2 `(manual)` — eleven linked evidence files present, completion date on the line.
- 1.3, 3.1, 3.3, 3.4, 3.5, 4.2 — `~…~ (obsolete: …)` per the artifact format, each
  naming the Q6 reason and its replacement step.
- 1.4 — `grep -n "chatModelPreselect" plan.md` names `off`/`local`/`copilot` and
  the `models alias set` reason; `grep -n "Q6" plan.md` prints the decision.
- 2.1–2.3, 3.2, 3.6–3.10, 4.1, 4.3 — code, tests, docs, and version bump present as
  described; the verify commands re-run above.
- 2.3's literal verify "`diff -r scripts extension/cli` prints nothing" is not what
  the command prints — it lists `Only in scripts:` for the `*.test.mjs` files,
  `hooks/`, and `wait-for-checks.sh`, which `copy-cli` excludes by design (same on
  `main`). The intent (no drift in the copied files) holds: every copied file is
  byte-identical. Not a false tick; noted so a future verify line reads
  `cmp` per copied file.
- 4.4 and 4.7 — the recorded counts (zero Shellcheck findings; 657 root; five
  replays; 249 → 250 unit; four electron scenarios; vsix 0.14.0; clean trees)
  reproduce exactly on a fresh run.
- 4.5 `(manual)` — linked evidence present (two `.png`, two `.jpg`), completion
  date on the line, the cited logs re-read (item 8), the secondary assignment
  restored.

No falsely ticked box found; no step added; no repair made. `status: in-review`,
`next-step: "hand off to the Reviewer"`, `initiative`, and `artifact-pr: "#66"`
are consistent with the session record.

## Findings

Ordered by severity. Nothing above minor.

1. **Minor — electron coverage narrower than acceptance item 7's verification
   line.** `extension/test/electron/suite.ts` L974–L1050 drives `local`, `copilot`,
   `off`, and the banner hint but not the "no matching model → no `modelSelector`
   + `dispatch: no model for` line" case the acceptance item assigns to
   `test:electron`. The path is pure (`selectorFor` → `preselectFor` →
   `chatOpenOptions`) and unit-tested in `commandDispatcher.test.ts` and
   `chatModel.test.ts`, and the electron run proves the same wiring with a match,
   so the behavior is verified — only the host-level assertion is missing. One
   more dispatch in the existing scenario with an injected list lacking the pinned
   model would close it.
2. **Minor — evidence file type.** `evidence/step-4-5-off-tooltip.jpg` and
   `evidence/step-4-5-local-tooltip.jpg` are phone photos in `.jpg`; the artifact
   format names `evidence/step-N-M-<short-name>.png`. Both are linked from the step,
   dated, and legible (the tooltip text is readable in full), so the §3 evidence
   requirement is met in substance.
3. **Minor — `off` costs one CLI spawn per dispatch.** `createChatModelResolver`
   (`chatModel.ts` L172–L182) runs `models resolve` before checking the setting so
   the `off` log line can name the model. With the default `off`, every dashboard
   dispatch now pays ~260 ms (live log) and up to 5 s on a slow clone. The plan
   asked for this log line, so it is by design; a cheaper variant (log the model
   only when the Agento channel is visible, or read the pin from the prompt file
   directly) is a follow-up, not a defect.
4. **Minor, pre-existing — timeout reason text.** On an `execFile` timeout
   `error.code` is `null`, so `CliClient.run` (`cliClient.ts` L81–L82) rejects with
   "Unable to run Agento CLI with node; set agento.nodePath: …" rather than a
   timeout message; the resolver still falls back correctly (it treats any throw as
   a reason) and the unit test simulates the thrown error. Not introduced by this
   delivery.
5. **Security review — no issues.** `modelSelector` values originate from the
   user's own prompt/profile files and reach only `workbench.action.chat.open`;
   the CLI is invoked with `execFile` and an argument array (no shell
   interpolation of the command or plugin-root); the retry drops only
   `modelSelector` and re-submits the same `query`/`mode`/`attachFiles`; the test
   hook `setChatModelSource` is reachable only through the exported
   `ExtensionApi`; the probe extension is test-only and not packaged (`cli/` 10
   files in the vsix). No secrets in the diff, the evidence, or the logs quoted
   above.

## Follow-ups

- Add the no-match leg to the electron preselection scenario (Findings #1).
- Consider avoiding the `models resolve` spawn when `agento.chatModelPreselect` is
  `off`, or caching the resolve per command for the window's lifetime (Findings #3).
- Give `CliClient.run` a distinct timeout message (`error.killed && error.signal`)
  so `dispatch: no model for …` names the 5 s bound (Findings #4, pre-existing).
- Reword step 2.3's verify in future plans to `cmp` each copied file instead of
  `diff -r scripts extension/cli` (Roadmap audit).
