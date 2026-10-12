# Review: policy-on-demand

Verdict: approve

Reviewed 2026-10-11 at product `96c647c` (code PR #109) and companion `59c2e50`
(PR #46), both on `feature/policy-on-demand`, in the build window
(`role=build`, `delivery.slug=policy-on-demand`). `origin/main` is an ancestor of
both halves; both branches equal their `origin/` refs; both trees were clean before
the review.

Skills consulted: agent-customization (built-in): `applyTo: "**"` is loaded into
every interaction; a file instruction otherwise applies by glob or on demand by its
`description`, which should use the "Use when…" pattern and be quoted when it
contains colons. The change follows all three. The repository has no
`.agents/skills/` and no skills table, so no other domain skill applies.

## Acceptance checklist results

1. **Exactly two `**` instruction files, core ≤ 40 lines: pass.**
   `grep -l '^applyTo: "\*\*"' .github/instructions/*.md` lists
   `agento-core.instructions.md` and `ai-skills.instructions.md`;
   `wc -l .github/instructions/agento-core.instructions.md` = 38; test (a) "only the
   core and ai-skills are always-on" passes. In a copy of `HEAD` (`git archive`),
   setting the policy's `applyTo` back to `"**"` fails test (a) naming
   `delivery-policy.instructions.md`.
2. **Payload recorded before and after, ≤ 4 096 bytes: pass.**
   `evidence/step-1-1-baseline.md` (517 lines / 32 063 bytes) and
   `evidence/step-5-1-after.md` exist. Fresh `wc -l -c` of the two `**` files:
   56 lines / 3 090 bytes.
3. **Policy keeps its path and 12 sections; only frontmatter changed: pass.**
   `git diff -U0 origin/main -- .github/instructions/delivery-policy.instructions.md`
   has one hunk, `@@ -2,2 +2,2 @@`; `grep -c '^## [0-9]*\. '` = 12; the §N test
   passes in the full suite.
4. **`command-invocation` gone; redirect rule in the core: pass.** The file is
   absent from `.github/instructions/`; `git grep -n command-invocation --
   ':!CHANGELOG.md'` prints nothing (exit 1); test (b) "the core states the
   canonical form and the six redirected forms" passes. The core's body states the
   canonical form, the six forms, and "do not ask for confirmation".
5. **Six agents and 11 built-in-agent prompts carry the `Policy: read` line, mirrors
   byte-identical: pass.** `grep -c` prints 1 for each of the six agents;
   `grep -l '^Policy: read `<agento-root>' .github/prompts/*.prompt.md | wc -l` = 11,
   the same count as `grep -l '^agent: "agent"'`; the `cmp` loop prints nothing;
   test (d) passes. In a copy of `HEAD`, deleting the line from
   `.github/prompts/doctor.prompt.md` fails test (d) naming that file.
6. **Plugin-mode SessionStart silent beside the workspace wiring, unchanged
   otherwise: pass.** The three new `tests/session-context.test.mjs` cases pass
   (22 tests in the file); `./scripts/hooks/replay-guard.sh <
   tests/guard-fixtures.txt` exit 0; `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh
   < tests/guard-fixtures-companion.txt` exit 0. Code read in Findings.
7. **`hook-wiring` doctor check: pass.** The new `scripts/agento.test.mjs` case
   passes (no wiring → ok; registered `true` with JSONC → warn, also from a linked
   worktree; `false` / unrelated / `{}` → ok; ENOENT → ok, `fallback: null`).
   `node scripts/agento.mjs doctor` here: `hook-wiring` `warn`, detail
   "/home/david/DP/agento (this repository) is registered in chat.pluginLocations
   (/home/david/.config/Code/User/settings.json): …". `doctor --for ship` lists
   `node,git-remote,gh,worktrees-dir,session-workspace,artifact-repo`, no
   `hook-wiring`.
8. **A fresh chat references the core and `ai-skills`, not the policy or
   `command-invocation`: pass** (amended verification, plan.md `## Decisions` Q7).
   `evidence/step-5-5-instruction-list.md` shows VS Code 1.136.0's injected listing
   with `applyTo: **` only for `agento-core` and `ai-skills` among this repository's
   files (plus the user-profile `screenshots-location`), `delivery-policy` with
   `.github/agents/**,.github/prompts/**,.github/instructions/**,commands/**`, and no
   `command-invocation`. Independent re-drive: this review session's own injected
   listing in the same window has the same eight `<file>`/`<applyTo>` pairs, and
   only `agento-core` and `ai-skills` arrived as full attachments — the Reviewer had
   to read `delivery-policy.instructions.md` explicitly through its `Policy: read`
   line. No screenshot is possible: this build shows no References list (the reason
   5.2 is obsolete).
9. **Docs and changelog describe the new loading model: pass.** `grep -c
   'agento-core'` = 1 in each of `docs/architecture.md`, `docs/commands.md`,
   `AGENTS.md`; `docs/hooks.md` L45 "In plugin mode the hook stays silent …";
   `CHANGELOG.md` `## Unreleased` names both 32 063 and 3 090 bytes.
10. **Full gate green and matching the baseline: pass.**
    - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`: exit 0, 447 tests,
      447 pass, 0 fail (baseline 441/441; it includes `tests/extension-bundle.test.mjs`).
    - Both guard replays: exit 0 (baseline 0).
    - `git ls-files '*.sh' | xargs pnpm dlx shellcheck`: exit 0, no output (baseline
      none). The local `shellcheck` binary is absent; this is the documented substitute.
    - `cd extension && npm run copy-cli && npm run typecheck && npm run test:unit`:
      exit 0 / 0 / 167 pass, 0 fail; `git status --porcelain` empty afterwards, so
      `extension/cli/` is byte-identical to `scripts/`.
    - `node scripts/agento.mjs initiative spend-reduction`: `errors: []`.
    - CI on PR #109: `test` pass.

## Plan vs implementation

- **Wiring probe location (documented deviation).** Approach 6 asked for a pure
  helper in `session-context.mjs`. The probe is `hasAgentoWorkspaceWiring(root)` in
  `scripts/agento-config.mjs`, shared by the hook and the 4.2 doctor check, because
  `extension/cli/` copies `scripts/agento-config.mjs` but not `scripts/hooks/`. The
  roadmap's 4.1 line records this. `hook-lib.mjs` already imports from
  `agento-config.mjs`, so the hook gains no new dependency direction. Accepted.
- **Step 5.2 obsolete, replaced by 5.5.** The change follows the user's Q7 decision,
  and the roadmap uses the format contract's obsolete syntax
  (`- [x] 5.2 ~…~ (obsolete: …)`). Step 5.5 is marked `(added 2026-10-11)`.
- No other gaps. All 45 changed files match the plan's affected-file list, plus
  `scripts/agento-config.mjs` and its `extension/cli/` copy (the deviation above).

## Roadmap audit

Every ticked box was checked against the code at `96c647c`:

- 1.1, 5.1: evidence files exist with the stated totals.
- 2.1–2.4: confirmed by acceptance items 1, 3, 4, and 9 above. The 2.3 mutation was
  re-run in a throwaway copy.
- 3.1–3.3: confirmed by item 5. The 3.3 mutation was re-run in a throwaway copy.
- 4.1: 22 tests in `tests/session-context.test.mjs`; both replays exit 0.
- 4.2: live doctor output as recorded.
- 4.3: the `grep` checks hold.
- 5.2: obsolete per Q7, in the contract's format.
- 5.3: re-run in full above, same results as recorded.
- 5.4: PR #109 and PR #46 are `OPEN`, draft, `MERGEABLE`/`CLEAN`; the session record
  shows `companion.dirty: false`, `ahead: 0`.
- 5.5: evidence file present and consistent with this window's listing.

No falsely ticked boxes and no missing work. No repairs were made.

## Findings

Hook review (`scripts/hooks/session-context.mjs`, security-sensitive):

- Suppression requires **both** `CLAUDE_PLUGIN_ROOT`/`PLUGIN_ROOT` in the
  environment **and** `hasAgentoWorkspaceWiring(<repo root>)`. The probe returns
  `true` only when `.github/hooks/session-start.json` parses, has a `SessionStart`
  entry whose `command` is exactly `./scripts/hooks/session-context.sh`, and that
  script exists as a file; it returns `false` on any exception. Without the wiring,
  context is therefore never suppressed. This holds for target repositories: a repo
  that copied the JSON but not the script still gets plugin-mode context. The test
  "plugin mode emits the context when the session repo has no workspace-mode
  wiring" covers it.
- `isDuplicatePluginRun` runs inside `main()`'s existing `try`, and `runGit` returns
  `""` on failure. A probe error cannot crash session start.
- The delivery guard is unaffected. `delivery-guard.mjs`, `hook-lib.mjs`, both `.sh`
  wrappers, `hooks/hooks.json`, and `.github/hooks/*.json` are unchanged
  (`git diff --stat origin/main...HEAD`); `agento-config.mjs` gains only a new
  export; both guard replays exit 0.

Findings by severity (none above minor):

1. **Minor — the plugin-mode signal is presence-only**
   ([session-context.mjs](https://github.com/david-perry-software/agento/blob/feature/policy-on-demand/scripts/hooks/session-context.mjs#L139-L145)).
   `isDuplicatePluginRun` treats any inherited `CLAUDE_PLUGIN_ROOT`/`PLUGIN_ROOT` as
   plugin mode. If one of these variables leaks into the workspace-mode hook's
   environment (for example, VS Code launched from a shell that exports it), both
   runs go silent in Agento's own clone and worktrees. That is the only path to lost
   context, and it requires the wiring to be present. A cheap hardening would also
   require `realpath(env.CLAUDE_PLUGIN_ROOT || env.PLUGIN_ROOT) ===
   realpath(AGENTO_ROOT)`, meaning the running script is the plugin's own copy. That
   rules out the leak in every worktree window, where the workspace-mode script lives
   in the worktree and not in the plugin clone. The plan accepted the env signal
   (Risks), so this does not block.
2. **Minor — the CLI reference omits the new check**
   ([docs/commands.md](https://github.com/david-perry-software/agento/blob/feature/policy-on-demand/docs/commands.md#L323-L330)).
   The `doctor` entry enumerates the checks as `node` … `model-profile` and describes
   only `model-profile` as informational. `hook-wiring` (now the ninth id in `doctor`
   output) is missing there, though `docs/install.md` and `docs/hooks.md` describe
   it.

## Follow-ups

- Harden the plugin-mode dedupe signal: require the plugin-root env var to resolve
  to the running hook's own Agento root (Finding 1).
- Add `hook-wiring` to the `doctor` check list and informational note in
  `docs/commands.md` (Finding 2).
