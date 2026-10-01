# Review: model-profiles

Verdict: request-changes

Re-review on 2026-10-01 at product `330c7bb` (feature/model-profiles, PR #71), with the
companion artifacts at `85c8e58` on feature/model-profiles (PR #18). Both halves contain
`origin/main` and match their remotes. The roadmap is `status: paused` at 4.7 (manual),
with 25 of 27 steps ticked. Earlier reviews were at `483c207` and `330c7bb`, before the
4.5 and 4.6 ticks.

The product code is unchanged since the last review, and every automated check still
passes. Steps 4.5 and 4.6 are now done and verified. The verdict is still
request-changes for one reason only: the runtime check in VS Code (4.7) has not run,
and the cleanup (4.8) has not either. Those are pre-review steps, not a policy §4
post-ship exception. No code changes are required. Once you finish 4.7 and the Builder
clears the profile in 4.8, the delivery can be reviewed again for approval.

## Acceptance checklist results

1. **pass**: `scripts/model-profiles.test.mjs` covers schema errors, the resolution
   table, byte-exact insert/replace/remove (including the `description:` and closing
   `---` fallbacks, CRLF, and collapsing duplicate or block-list keys), array values,
   and active detection (17 tests, lines 9–191). They pass inside the full run: 259/259.
2. **pass**: `agento.test.mjs` covers apply/clear against a temp fixture: files,
   mirrors, `S` bits, `changed: []` on repeat, `git diff --quiet` after clear, dirty
   refusal, non-git roots, `init` creating the file once, and (new in 1.10) the
   linked-worktree refusal (tests at lines 2508–2707). The first review's independent
   end-to-end run on a temp clone (`/tmp/rv-e2e.sh`, temp `AGENTO_CONFIG_HOME`)
   matched:
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
   enforced by the full suite (259/259).
6. **pass**:
   - `docs/model-profiles.md` covers schema, resolution, apply/clear, updating, and
     the Agento-development caveat, now including the worktree refusal.
   - `templates/model-profiles.json` has one `mixed` profile with placeholders,
     rejected by the agento.test.mjs line 2665 case.
   - docs/install.md has the `## Updating` paragraph.
   - The Mechanic agent has its file-list and Known-pitfalls lines.
7. **pass**: CHANGELOG has `## 0.7.0 (unreleased)` with an **Added** entry.
   `package.json`, `.claude-plugin/plugin.json`, and `extension/package.json`
   (plus the lockfile's root entries) read 0.7.0, and the customizations version test
   passes.
8. **pass**: `cd extension`, then (rerun at `330c7bb`):
   - `npm run copy-cli` leaves `cli/` unchanged.
   - `npm run typecheck` exit 0.
   - `npm run test:unit` exit 0 (85/85, including the new `missingPluginRootMessage`
     case).
   - `npm run test:electron` exit 0 (3 scenarios passed).
   - `npm run package` exit 0 (agento-dashboard-0.7.0.vsix, 33 files, VSIX assertion
     passed).

   The doctor call appends `--plugin-root` when a root resolves
   (`extension/src/extension.ts`).
9. **pass**: the Builder's transcript in roadmap 4.2 matches the reviewer's independent
   run (item 2).
10. **pass**: full gate rerun by the reviewer at `330c7bb`:
    - `git ls-files '*.sh' | xargs pnpm dlx shellcheck` exit 0 with no findings, the
      same as the baseline.
    - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exit 0, 259/259
      (baseline 229, first review 258; the one new test belongs to 1.10).
    - `replay-guard.sh` exit 0, and with `REPLAY_COMPANION=1` exit 0.
    - Extension typecheck exit 0.
11. **fail** (partly done): the runtime check is incomplete.
    - Done: 4.5 and 4.6 are ticked and hold. `models show mixed` exits 0 with
      `errors: []`. `/home/david/DP/agento` has 54 skip-worktree bits, 6 of 6 agents
      carry `model:`, `git status --porcelain` is empty, `models list` reports
      `active: mixed`, and `doctor --plugin-root /home/david/DP/agento` reports
      `model-profile ok "mixed applied"`, which is the doctor check working against a
      real clone.
    - Outstanding: 4.7 (manual) is unticked, and there is no
      `evidence/step-4-7-model-picker.png`. The newest file in `~/Pictures/Screenshots`
      is from 11:45, before this run. 4.8 (clear) is also unticked.
    - Still unproven: that VS Code honors `model:` on plugin-mode `commands/*.md` and
      through a handoff.

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
- The fix round added steps 1.10, 2.4, 3.4, and 3.5, each marked `(added 2026-10-01)`
  and tied to a review finding. Its diff (`483c207..330c7bb`, 9 files, +85/−11) touches
  only those concerns, plus the generated `extension/cli/agento.mjs` copy.
- The worktree refusal does not block step 4.6: that step applies to
  `/home/david/DP/agento`, which is the main checkout.

## Roadmap audit

- Spot-checked the fix-round steps:
  - 1.10: `primaryCheckoutOf` in `scripts/agento.mjs` and its agento.test.mjs case.
    Also checked against this real worktree with a throwaway `AGENTO_CONFIG_HOME`:
    exit 3, `status: "worktree"`, `primaryCheckout: /home/david/DP/agento`, no files
    changed, no `S` bits set.
  - 2.4: `cmp commands/models.md .github/prompts/models.prompt.md` reports them equal.
  - 3.4: `missingPluginRootMessage` is used in `extension/src/extension.ts`.
  - 3.5: the recorded gate numbers match my rerun.
- Spot-checked every earlier ticked step (1.1–4.4) against the code and against fresh runs:
  test names, the `usage()` slice, `COMMAND_NEEDS.models`, the doctor ids, the bundle
  lists in `extension/scripts/copy-cli.mjs` and `tests/extension-bundle.test.mjs`,
  the registrations, the versions, the extension contribution and setting, and the
  real `~/.config/agento/model-profiles.json` existing for 4.4. No falsely ticked
  boxes.
- `status: paused` with `next-step: "4.7 (manual) …"` is the correct pause kind under
  policy §3.
- 4.5 (manual) is ticked with linked evidence, `evidence/step-4-5-profiles-filled.png`,
  a capture of the `models show mixed` output. The line records that the user chose
  and confirmed the names in chat and asked the agent to write the file. That meets
  §3 for a configuration step.
- 4.6 is ticked, and its recorded numbers match the live clone: 54 changed and 54 `S`
  bits. `main` does not have the `models` prompt yet, which is why it is not 56.
- The roadmap Follow-ups record the Builder's decisions on findings 3 and 4 (no
  change).
- No falsely ticked boxes; no repairs needed.

## Findings

No open findings above informational.

1. **resolved**: linked-worktree plugin roots. `apply` now refuses with
   `status: "worktree"` and names the clone; `clear` still runs there
   (`scripts/agento.mjs` `primaryCheckoutOf`, `.github/prompts/models.prompt.md`
   step 4).
2. **resolved**: an invalid `agento.pluginRoot` is now named in the error
   (`extension/src/modelProfiles.ts` `missingPluginRootMessage`).
3. **info**: the doctor `model-profile` check warns on the template placeholders
   until the user fills them in. Accepted as planned behavior (roadmap Follow-ups).
4. **info**: `dirty` is computed on every verb, costing about 230 ms on
   `models list`. Accepted for now (roadmap Follow-ups).
5. **info**: until 4.8 runs, the primary clone `/home/david/DP/agento` is pinned (54
   skip-worktree files). A `git pull` there, or the `main` sync in `/agento ship`,
   stops with "would be overwritten" whenever a merged change touches a pinned file.
   That is the documented, safe behavior, but finish 4.8 before any other ship from
   the primary window.

Security: profile values reject control characters and `<`/`>` and are serialized
with JSON escaping. An injected `"x\"\ntools: [execute]"` value was rejected (exit 3).
Prompt keys are matched against discovered files and never joined into paths. `init`
uses `COPYFILE_EXCL`. The new worktree check only reads `git rev-parse` output. No
secrets are involved.

## Follow-ups

- Consider teaching `/agento ship`'s `main` sync to detect pinned skip-worktree files
  and suggest clear → pull → apply (plan Risks).
