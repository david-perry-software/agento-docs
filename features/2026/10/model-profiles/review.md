# Review: model-profiles

Verdict: request-changes

Reviewed 2026-10-01 at product `483c207` (feature/model-profiles, PR #71) and companion
artifacts on feature/model-profiles (PR #18). Both halves contain `origin/main` and match
their remotes. The roadmap is `status: paused` at 4.5 (manual), with 19 of 23 steps ticked.

All of the automated work passes and the code is in good shape. The verdict is
request-changes for one reason only: the plan's last acceptance item, the VS Code
runtime check (roadmap steps 4.5–4.8), has not been done. Those steps are
pre-review `(manual)` steps, not a policy §4 post-ship exception, so the item counts as
a failure rather than `deferred to post-ship`. No code changes are required.

## Acceptance checklist results

1. **pass**: `scripts/model-profiles.test.mjs` covers schema errors, the resolution
   table, byte-exact insert/replace/remove (including the `description:` and closing
   `---` fallbacks, CRLF, and collapsing duplicate or block-list keys), array values,
   and active detection (17 tests, lines 9–191). They pass inside the full run: 258/258.
2. **pass**: `agento.test.mjs` covers apply/clear against a temp fixture: files,
   mirrors, `S` bits, `changed: []` on repeat, `git diff --quiet` after clear, dirty
   refusal, non-git roots, and `init` creating the file once (tests at lines 2508–2688).
   An independent end-to-end run on a temp clone (`/tmp/rv-e2e.sh`, temp
   `AGENTO_CONFIG_HOME`) matched:
   - `init` gave `created=true`, then `created=false`.
   - Applying the unfilled template exits 3.
   - `apply mixed` changed 56 files and set 56 skip-worktree bits, `active=mixed`,
     `git status --porcelain` stayed empty, and 6 of 6 agents were pinned.
   - Every `commands/<n>.md` is `cmp`-equal to its prompt.
   - Re-apply gave `changed=[]`. An edit beyond the `model:` line gave
     `status=dirty`, exit 3.
   - `clear` changed 56 files, `active=null`, `git diff --quiet` returned 0, and no
     `S` bits remained.
3. **pass**: `doctor` lists `model-profile`:
   - `ok` "mixed applied".
   - `warn` "match no profile" after a hand edit.
   - `warn` for an invalid file.

   `doctor --for models` prints `{"command":"models","needs":["terminal"]}` and the
   unchanged terminal check set `node,python3,worktrees-dir,session-workspace,artifact-repo`.
4. **pass**: usage header test (agento.test.mjs line 2579). `usage()` now uses
   `.slice(1, 24)`, so the `// Options:` paragraph stays whole.
5. **pass**: the no-pin test (`tests/customizations.test.mjs`, last test) reads
   `git show HEAD:<file>`. The Builder's probe commit failed it with the
   `models clear` message (roadmap 1.9). `/agento models` is registered in
   command-invocation, the §9 idempotency table, README.md, and docs/commands.md, all
   enforced by the full suite (258/258).
6. **pass**:
   - `docs/model-profiles.md` covers schema, resolution, apply/clear, updating, and
     the Agento-development caveat.
   - `templates/model-profiles.json` has one `mixed` profile with placeholders,
     rejected by the agento.test.mjs line 2665 case.
   - docs/install.md has the `## Updating` paragraph.
   - The Mechanic agent has its file-list and Known-pitfalls lines.
7. **pass**: CHANGELOG has `## 0.7.0 (unreleased)` with an **Added** entry.
   `package.json`, `.claude-plugin/plugin.json`, and `extension/package.json`
   (plus the lockfile's root entries) read 0.7.0, and the customizations version test
   passes.
8. **pass**: `cd extension`, then:
   - `npm run typecheck` exit 0.
   - `npm run test:unit` exit 0 (84/84, including 6 `modelProfiles.test.ts` cases).
   - `npm run test:electron` exit 0 (3 scenarios passed).
   - `npm run package` exit 0 (agento-dashboard-0.7.0.vsix, 33 files, VSIX assertion
     passed).

   The doctor call appends `--plugin-root` when a root resolves
   (`extension/src/extension.ts`).
9. **pass**: the Builder's transcript in roadmap 4.2 matches the reviewer's independent
   run (item 2).
10. **pass**: full gate rerun by the reviewer:
    - `git ls-files '*.sh' | xargs pnpm dlx shellcheck` exit 0 with no findings, the
      same as the baseline.
    - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exit 0, 258/258
      (baseline 229/229; the 29 new tests belong to this delivery).
    - `replay-guard.sh` exit 0, and with `REPLAY_COMPANION=1` exit 0.
    - Extension typecheck exit 0.
11. **fail**: the runtime check in VS Code has not run. Steps 4.5 (manual), 4.6, 4.7
    (manual), and 4.8 are unticked; there is no `evidence/step-4-7-model-picker.png`.
    `node scripts/agento.mjs models show mixed` still exits 3 with four placeholder
    errors. Until it runs, it is unproven that VS Code honors `model:` on plugin-mode
    `commands/*.md` and through a handoff.

## Plan vs implementation

- `templates/model-profiles.json` landed in 1.5 instead of 2.2, because `init` and
  its tests need it. Recorded on both roadmap lines; harmless.
- The CLI has an extra `summarizeModelsResult` helper and an updated
  `extensionIntegration.test.ts` source-shape assertion. Both are recorded in 3.1/3.2
  and within scope.
- The planned decision to fold "stale" into `custom` is implemented and documented
  (the doctor detail says "hand-edited, or the profile changed after it was applied").
- No undocumented changes: the 31 changed files match the plan's affected-files list,
  plus the generated `extension/cli/*` copies and the expected test files.

## Roadmap audit

- Spot-checked every ticked step (1.1–4.4) against the code and against fresh runs:
  test names, the `usage()` slice, `COMMAND_NEEDS.models`, the doctor ids, the bundle
  lists in `extension/scripts/copy-cli.mjs` and `tests/extension-bundle.test.mjs`,
  the registrations, the versions, the extension contribution and setting, and the
  real `~/.config/agento/model-profiles.json` existing for 4.4. No falsely ticked
  boxes.
- `status: paused` with `next-step: "4.5 (manual) …"` is the correct pause kind under
  policy §3.
- No steps added; no repairs made.

## Findings

All are minor or informational; none blocks the verdict on its own.

1. **minor**: running `/agento models apply` from an Agento development worktree
   pins that worktree's own files. The prompt's step 2 uses "the clone that CLI lives
   in", and the session context announces the worktree's own `Agento CLI:`. Edits to
   a pinned agent or prompt in that worktree then vanish from `git status`
   (skip-worktree). docs/model-profiles.md "Developing Agento" assumes worktrees stay
   unpinned. The guard against committing a `model:` line catches commits but not
   hidden, uncommitted edits. Suggest the prompt (or CLI) refuse or warn when the
   plugin root is a managed worktree rather than the registered clone
   (`.github/prompts/models.prompt.md` step 2).
2. **minor**: in `extension/src/modelProfiles.ts` `resolvePluginRoot`, a set but
   invalid `agento.pluginRoot` returns `null`. The command then reports "set
   agento.pluginRoot or register the clone…", which is misleading when the setting is
   already set. Name the configured path in that message.
3. **info**: the doctor `model-profile` check warns on an error in any profile. Right
   after `models init`, the shipped placeholders already make the Session & Doctor
   view show `warn`, which is the case on this machine now ("4 error(s)"). This
   matches the plan ("warn when the profiles file is invalid"); noted for user
   expectations.
4. **info**: `modelsState` runs one `git show HEAD:<file>` per target (56) for
   `dirty` on every verb and on every doctor call, although only `apply` needs
   `dirty`. Measured `models list` at about 230 ms, so this is not a problem today.

Security: profile values reject control characters and `<`/`>` and are serialized
with JSON escaping. An injected `"x\"\ntools: [execute]"` value was rejected (exit 3).
Prompt keys are matched against discovered files and never joined into paths. `init`
uses `COPYFILE_EXCL`. No secrets are involved.

## Follow-ups

- Make `/agento models` refuse or warn when its plugin root is an Agento managed
  worktree instead of the registered clone (finding 1).
- Name the configured path when `agento.pluginRoot` is set but invalid (finding 2).
- Consider teaching `/agento ship`'s `main` sync to detect pinned skip-worktree files
  and suggest clear → pull → apply (plan Risks).
