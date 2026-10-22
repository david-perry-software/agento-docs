# Review: model-profile-editor

Verdict: request-changes

Reviewed 2026-10-21 at product `dcbe9ee` (branch `feature/model-profile-editor`, code PR
david-perry-software/agento#126) against companion `a73b47b` (artifact PR
david-perry-software/agento-docs#63). `origin/main` is an ancestor of HEAD in both
halves; both halves were clean before and after every check. Skills consulted: none —
the plan's `Skills consulted: none — no matching domain` holds (no `## Agento` skills
table in AGENTS.md, no `.agents/skills/`).

Fresh verification, all run by the Reviewer in the product checkout:

| Check | Result |
| --- | --- |
| `/tmp/shellcheck-v0.10.0/shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` | exit 0, 0 findings (baseline: 0) |
| `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | exit 0, **612/612** (baseline 609) |
| five guard smoke replays from AGENTS.md | 5/5 exit 0 |
| `cd extension && npm ci && npm run build && npm run typecheck` | all exit 0 |
| `npm run test:unit` | exit 0, **201/201** (baseline 183) |
| `node --check media/profileEditor.js` | exit 0 |
| `DISPLAY=:0 npm run test:electron` | exit 0, 4/4 scenarios; in-repo log names `model-profile editor` |
| `npm run package` + `unzip -l agento-dashboard-0.11.0.vsix` | exit 0; lists `extension/media/profileEditor.js` and `.css` |
| `DISPLAY=:0 npm run test:vsix` | exit 0 (`VSIX install smoke passed`); `.vsix` removed afterwards |
| harness on `local:3177` (headless Chrome, `--dump-dom`) | both variants render; no `#csp-violation` marker |
| `git status --porcelain --untracked-files=all` (both halves) | empty after every run |

## Acceptance checklist results

1. **CLI (`pinnable`, `body`, unchanged fields, shared `isPinnablePrompt`)** — **pass.**
   `scripts/model-profiles.mjs:216-218` exports `isPinnablePrompt` and `resolveTargets`
   calls it (`:250`); `scripts/agento.mjs:4858-4862` adds `pinnable` to `list`,
   `:4870` adds `body` to `show`; both emits are additive. Cases in
   `scripts/model-profiles.test.mjs` (`isPinnablePrompt: absent agent…`) and
   `scripts/agento.test.mjs` (+3 tests, 609→612) pass; `tests/extension-bundle.test.mjs`
   passes, so `extension/cli/` matches `scripts/`.
2. **`CliClient.run` stdin + arg builders** — **pass.** `extension/src/cliClient.ts:99-112`
   ends stdin with or without input; `extension/test/unit/cliClient.test.ts` "delivers
   stdin input and closes stdin when none is given" passes. `updateProfileArgs` /
   `aliasSetArgs` (`modelProfiles.ts:132-147`) append `--dry-run`/`--expect` only when
   set; covered in `modelProfiles.test.ts`.
3. **Pure editor model** — **pass.** `extension/test/unit/profileEditorModel.test.ts`
   has 12 tests covering round trip, one-item↔string, empty omission, unknown keys,
   vendor grouping, `suggestAlias`/`aliasStatus` (Copilot, BYOK, qualified, id-less),
   every message type accepted and malformed/unknown rejected, `diffFields`,
   `validateRename`; all pass in the 201/201 run.
4. **`renderEditorHtml` CSP/nonce/no remote/no inline** — **pass.**
   `profileEditorHtml.ts:38` emits exactly `default-src 'none'; style-src ${csp};
   script-src 'nonce-…'; img-src ${csp} data:; font-src ${csp}`; the only `<script>`
   carries the nonce; `profileEditorHtml.test.ts` (4 tests) asserts the CSP string,
   single nonce'd script, no `http(s)://`, no `on*=` handlers, and escaping.
5. **Editor behavior in the in-repo electron scenario (10 checks)** — **pass as
   specified, but see Findings 1–2.** Every listed check is implemented in
   `extension/test/electron/suite.ts` `assertModelProfileEditor` and the suite passes
   (4/4). However checks 4–6 drive `save` without a preceding `change { dirty: true }`,
   so the suite exercises a flow the real webview never produces; the real flow is
   broken (Finding 1). The acceptance text as written is satisfied; the behavior it
   stands for is not.
6. **Temp `AGENTO_CONFIG_HOME` guard + clean tree after electron** — **pass.** The suite
   asserts `profilesFile.path` is under the temp home before any write (pre-existing
   assertion in `assertModelProfilesView`, which the editor checks run inside);
   `git status --porcelain --untracked-files=all` was empty after my electron run.
7. **Visual evidence** — **pass.** Builder's `evidence/step-6-2-editor-form.png` and
   `evidence/step-6-2-editor-conflict.png` exist and are linked from step 6.2. I
   re-served `extension/` on `local:3177` and re-rendered both variants with headless
   Chrome: `evidence/review-step-6-2-editor-form.png` and
   `evidence/review-step-6-2-editor-conflict.png`. Both show the grouped datalist
   (DOM dump lists the three fixture `<option>`s), a two-entry fallback list under
   Default model, the `doctor` command override, the inline error and warning, alias
   suggestions with **Add alias**, and (conflict variant) the banner with only
   **Reload**. The harness's `securitypolicyviolation` listener injected no
   `#csp-violation` marker.
8. **VSIX ships the webview assets** — **pass.** `npm run package` exit 0; `unzip -l`
   lists `extension/media/profileEditor.js` (15828 B) and `profileEditor.css`
   (4002 B); `npm run test:vsix` exit 0; the `.vsix` was removed and the tree is clean.
9. **Docs and release** — **pass.** `docs/model-profiles.md:75-79,114-120`,
   `docs/extension.md:316-329`, `extension/README.md:91-98,130-131` describe the editor
   and the `pinnable`/`body` fields; `CHANGELOG.md:4-15` has `## 0.11.0 (unreleased)`
   **Added**; version `0.11.0` in `package.json`, `extension/package.json`,
   `.claude-plugin/plugin.json`, and both `extension/package-lock.json` fields.
   `tests/customizations.test.mjs` passes inside the 612/612 run.
10. **Lint gate (§5, full rerun)** — **pass.** shellcheck exit 0 / 0 findings equals
    the recorded baseline; root 612 ≥ 609 + new; unit 201 ≥ 183 + new; electron 4/4;
    guard replays 5/5. No new or undocumented findings; no overlap with shell files.

## Plan vs implementation

- Plan `## Approach` item 5 ("On success: post the new state, clear dirty, reload the
  tree view") is not met when the webview has reported a dirty draft — Finding 1.
- Plan item 5 "addAlias … the panel takes the new hash" is implemented host-side, but
  the refresh message it sends crashes the webview renderer — Finding 2.
- `validateRename` (plan item 3) is implemented and tested but never called by the
  panel; a bad new name reaches the CLI, whose usage error is shown verbatim (minor).
- `extension/test/vsix/suite.ts` was changed (adds `agento.editModelProfile` and the
  `agento.modelProfiles` view id) — not in the plan's affected files, but necessary
  for `npm run test:vsix` to pass and in keeping with step 6.3. Acceptable.
- Everything else matches the plan: CLI fields additive, stdin via `execFile` (no
  shell), closed message schema, `localResourceRoots` limited to `media/`,
  `enableScripts: true` with no `retainContextWhenHidden`.

## Roadmap audit

- Spot-checked all 16 ticked boxes against the codebase and re-ran every `verify:`;
  none is falsely ticked (each step's stated verify passes). Step 6.2 is not a
  `(manual)` step but carries its two linked evidence files, which exist.
- Added missing-work steps for the defects found: `4.4 (added 2026-10-21)` post-save
  refresh when dirty, `4.5 (added 2026-10-21)` `addAlias` refresh contract, and
  `5.2 (added 2026-10-21)` electron coverage of the real dirty-then-save flow and the
  alias refresh. `next-step` now points at 4.4; `status` stays `in-review` for the
  Builder fix handoff.

## Findings

1. **Major — a successful Save never refreshes the panel when the draft is dirty; the
   next Save answers a false conflict.** `media/profileEditor.js:94-103` (`markDirty`)
   posts `change { dirty: true }` on every keystroke, so in any real session host
   `state.dirty` is `true` at Save. `profileEditorPanel.ts:298` then calls
   `load(currentName)`, which returns at `:160` (`if (state.loadToken !== token ||
   state.dirty) return;`) before updating `state.hash`, clearing `dirty`, or posting
   `state`. Reproduced against the compiled `out/src/profileEditorPanel.js` with a
   stub `vscode` module and a temp `AGENTO_CONFIG_HOME`: after `change dirty:true →
   save`, the file held the new body but the last posted message was still the
   original `state` with hash `a015949b…` while the file hash was `4ee7995b…`; a
   second `change dirty:true → save` posted `{"type":"conflict","changed":
   ["description","default"]}` (the fields the user themself had just saved) and the
   second edit was not written. The control sequence without a prior `change` (what
   the electron suite does) works. Effect for the user: the `●` marker never clears
   after Save, and every second Save shows a bogus "The profiles file changed" banner
   whose only exit, Reload, discards the new edit. Fix: in `save()` clear
   `state.dirty` (and bump `loadToken`) before the reload, or adopt
   `updateJson.profilesFile.hash` and post state directly. Roadmap 4.4 / 5.2.
2. **Major — a successful Add alias blanks the form.** `profileEditorPanel.ts:329`
   posts `{ type: "state", keepDraft: true, name, copilotModels, hash }`.
   `media/profileEditor.js:410-430` (`receiveState`) assigns that partial object to
   `state` and calls `renderForm()`, which clears `#root` and then reads
   `state.unknownKeys.length` at `:232` → `Uncaught TypeError: Cannot read properties
   of undefined (reading 'length')`. Reproduced by loading the real
   `media/profileEditor.js` in headless Chrome and posting the initial `state`
   followed by exactly that refresh message: the `error` listener captured the
   TypeError and the DOM dump had 0 `<input>` elements and no `.footer` left. Neither
   the electron suite (which does not execute the webview) nor the harness (which never
   posts a `keepDraft` state) covers this. Fix: post the full state with `keepDraft`,
   or merge the partial refresh into the existing `state` in the webview. Roadmap 4.5.
3. **Minor — `validateRename` is dead in production.** `save()` passes `form.name`
   straight to `renameProfileArgs`; the CLI rejects bad names (`[a-z0-9-]+`, argc
   check at `scripts/agento.mjs:4820-4821`), so there is no security exposure (all
   arguments go through `execFile`, no shell), but a name such as `--dry-run` is
   consumed as a flag and surfaces as a raw usage error instead of the friendly
   message `validateRename` produces.
4. **Minor — dead code in the webview/host contract.** `media/profileEditor.js:111`
   `setClean()` is never called (dirty is only cleared by a full `state` message), and
   the webview's `saved` branch (`:450`) handles a message the host never posts.
5. **Security review of the first script-enabled webview — no findings.** CSP is
   `default-src 'none'` with a per-render `crypto.randomBytes` nonce
   (`profileEditorHtml.ts:13,38`), no inline handlers (all listeners via
   `addEventListener`, all text via `textContent`), no remote URLs, `localResourceRoots`
   limited to `media/` (`profileEditorPanel.ts:86-87`). Every inbound message goes through
   `parseWebviewMessage` (exact key sets per type, typed fields; unknown → logged, not
   acted on; `profileEditorPanel.ts:198-201`). The webview has no file or shell
   access: writes are `execFile` arguments plus JSON on stdin (`cliClient.ts:68,110`),
   never a shell; the CLI re-validates names, keys, and values. The harness render
   produced no CSP violation.

## Follow-ups

- Add a DOM-level unit test (e.g. jsdom, or the harness driven by the electron
  runner) that executes `media/profileEditor.js` against each host message type,
  including `keepDraft`, `conflict`, and `deleted`, so the webview script has
  behavioral coverage beyond `node --check`.
- Consider having `save()` adopt `profilesFile.hash` from the `update` result
  directly, so the panel never depends on a `load()` round-trip to learn its own
  write's hash.
