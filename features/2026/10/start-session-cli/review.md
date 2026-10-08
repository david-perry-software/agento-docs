# Review: start-session-cli

Verdict: approve

Reviewed on 2026-10-07 at product `3d49a94` (feature/start-session-cli, PR #94) and
companion `d29cadf` (feature/start-session-cli, PR #30). Both halves match their
remotes (`ahead 0`, `behind 0`) and contain their `origin/main`. The roadmap is
`status: in-review` with 20 of 20 steps ticked. I re-ran every check below myself;
none of the results are copied from the Builder's notes.

Skills consulted: none — no matching domain (this repository has no `.agents/skills/`
directory and its AGENTS.md has no `## Agento` skills table).

Preflight: `agento.mjs doctor --for review-feature` → all checks `ok`. Browser: not
applicable. The changed behavior is a CLI subcommand, a prompt, and VS Code
extension code paths, so there is no URL to drive. The Electron suite covers the
user-visible extension flow instead.

## Independent verification

| Check | Result | Baseline (plan/1.1) |
| --- | --- | --- |
| `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | exit 0, 301/301 | 289/289 |
| `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` | exit 0 | exit 0 |
| `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` | exit 0 | exit 0 |
| `git ls-files '*.sh' \| xargs pnpm dlx shellcheck` (no `shellcheck` on PATH; the plan's documented equivalent) | exit 0, 0 findings | exit 0, none |
| `cd extension && npm run build` | exit 0 | — |
| `cd extension && npm run test:unit` | exit 0, 119/119 | 114/114 |
| `cd extension && npm run test:electron` | exit 0; in-repo, companion, and workspace scenarios passed (only GPU/vaapi noise on stderr) | exit 0 |
| `node --test tests/extension-bundle.test.mjs` | exit 0, 4/4 | — |
| `cmp commands/start-session.md .github/prompts/start-session.prompt.md` | exit 0 | — |
| `node --test --test-name-pattern "start-session" scripts/agento.test.mjs` | exit 0, 11/11, 8 025 ms total; companion plan mode 924 ms, companion build mode 954 ms, in-repo build mode 1 524 ms (run while the Electron suite was running) | — |

The lint gate (policy §5) is the full gate, and it is still green: shellcheck has no
findings, the same as the baseline. All 12 new node tests come from this delivery: 2
session-state tests, 9 start-session CLI tests, and 1 customizations test.

## Acceptance checklist results

1. **`agento.mjs start-session` with `--resume`/`--no-open`, usage line, and JSON
   contract — pass.** The usage line is at `scripts/agento.mjs` line 16, and
   `parseArgs` handles `--resume` and `--no-open` (lines 79–80). The output shape is
   assembled in `startSession()` (lines 1244–1406). The test "start-session validates
   its arguments and is listed in the usage header" passes, and so do the
   output-shape assertions in the plan-mode tests.
2. **Plan mode: creates a detached pair, resumes untouched, collision-free ids — pass.**
   The in-repo and companion plan-mode tests pass. They check HEAD at `origin/main`,
   that a marker file and HEAD survive a resume, and the promoted resume. The
   `nextSessionId` cases in `scripts/session-state.test.mjs` pass. `takenPlanIds`
   collects ids from both clones and from workspace files.
3. **Build mode branch variants in both layouts — pass.** Two tests cover it, one per
   layout (origin-only branch tracks, local branch used, managed owner resumes,
   missing/complete/mismatch reject; mirrored companion branch tracks, absent branch
   `--no-track` plus warning, promoted pair resumes). The "primary-owned branch"
   case is reached through the window check: a primary on the delivery branch is off
   `main`. The rejection-test case `primary checkout not on main (…, branch
   feature/widget)` covers it, as roadmap 2.6 documents.
4. **Wrong window, off-default primary, and dirty primary are rejected and nothing is
   written — pass.** The rejection test asserts `allowed`/`elsewhere` equal to the
   session record, an unchanged worktree directory and registration count, and that
   `code` is never called.
5. **Wrong-clone half fails the post-add check — pass.** The #86 test asserts
   `fix: git -C <repo> worktree remove <stray>`, `workspace: null`, `opened: false`,
   no workspace file, and byte-identical `worktree list` output in both clones.
6. **Workspace write and refresh, `--no-open`, a stubbed `code`, a missing `code` —
   pass.** Covered by the companion plan-mode test (written, unchanged, stale file
   refreshed) and by the open test (stub argv `--new-window <file>`, reopened on
   resume, `--no-open` makes no call, missing `code` gives a `preflight` warn plus
   `openCommand`).
7. **Fetch auth failure stops with a re-login command; an unreachable origin warns —
   pass.** The `classifyFetchFailure` unit cases pass. The CLI test's `Permission
   denied (publickey)` case gives `reason: "fetch-auth"` with `reauth` naming the
   remote, and the missing-path origin case warns and continues.
8. **`extension/cli/` is a fresh copy — pass.** `tests/extension-bundle.test.mjs`
   passes 4/4.
9. **The prompt and its mirror are byte-identical, use one CLI call, and have no
   fallback procedure — pass.** `cmp` exits 0. The prompt is 93 lines (it was 160)
   and keeps `Needs:`/`Fallback:`, the §10 pointer, and the window-check line. It
   cites `agento.mjs doctor --for start-session` and maps the JSON to §9/§10/§12.
   The new customizations test "start-session is one agento.mjs start-session call
   with no hand-run fallback procedure" passes.
10. **`CliClient.run` per-call timeout — pass.** In `extension/src/cliClient.ts`,
    `runOptions.timeoutMs ?? this.timeoutMs` keeps the 30 s default, and
    `START_SESSION_TIMEOUT_MS = 120_000`. The `cliClient.test.ts` case passes.
11. **New Plan runs the CLI, hands off, never submits on success, has no poll, and
    offers Open in chat on failure — pass.** `extension/src/newPlanFlow.ts`
    `runNewPlanFlow` calls `startSession([], primary.path)` and then `handoff`. On
    failure it calls `offerOpenInChat` and then submits `/agento start-session`. A
    grep finds `NEW_PLAN_FLOW_DEFAULTS`/`isCancellationRequested` in `src/` only as a
    negative assertion in `extensionIntegration.test.ts`. The Electron suite
    (`extension/test/electron/suite.ts` lines 168–245) drives the real CLI against a
    throwaway bare-origin fixture in both layouts. It asserts `submitted` is empty and
    the pending command is queued for the returned target.
12. **Play buttons and `/agento continue` routes run the CLI — pass.** The
    `dispatchRouting.ts` `start-session` route and the `commandDispatcher.ts` handler
    queue `route.then` for the target or open it, and failures go to Open in chat.
    Four dispatcher tests and one routing test pass. A status click still submits to
    chat.
13. **Docs and CHANGELOG — pass.** A grep finds `agento.mjs start-session` in
    `docs/commands.md` (lines 7, 102–105), `docs/extension.md` (lines 102–116), and
    `CHANGELOG.md` (lines 5–15). The fast-model recommendation is at
    `docs/model-profiles.md` lines 66–70.
14. **Full gate green against the baseline — pass.** See the table above.
15. **Speed — pass.** The companion fixture tests ran under 1 s each in my rerun.
    For the real run (6.3), I confirmed no `plan-20261008-004829` remains: no product
    half, no companion half, and no `.code-workspace` under
    `/home/david/DP/agento-worktrees` or `/home/david/DP/agento-docs-worktrees`, and
    the session record's `worktrees[]` lists only `plan-20261008-000113` and the
    unrelated `plan-20261008-001956`. I did not repeat the real run in the user's
    primary checkout because the fixture rerun covers the timing claim.

## Plan vs implementation

- **Deviation in one edge case (see Finding 1).** Approach step 6 says that without
  an owner, the half is created "on the exact branch". The CLI instead treats *any*
  registered worktree at the managed build path as `resumed` before it looks at the
  branch.
- The CLI also sets `GIT_SSH_COMMAND=ssh -o BatchMode=yes` (when the caller has not
  set one) alongside `GIT_TERMINAL_PROMPT=0`. That goes beyond the plan, but it is in
  the spirit of "fetch never prompts" and is tested by the auth case.
- Added during the build (documented on roadmap 4.4): only start-session and continue
  actions follow a refreshed `start-session` next, and malformed `next.args` are
  rejected. Both are sensible narrowings with tests.
- The new `extension/src/startSessionCli.ts` (a shared parser and runner) is not
  named in the plan. It is recorded on roadmap 4.2 and avoids duplicating the
  parsing in New Plan and the dispatcher.

## Roadmap audit

I spot-checked every ticked box against the code. Nothing is falsely ticked, and I
made no repairs.

- 1.1: `extension/node_modules` exists, and the baseline is recorded on the line.
- 1.2: `nextSessionId` / `classifyFetchFailure` are at `scripts/session-state.mjs`
  lines 31 and 55, with tests.
- 1.3: `writeSessionWorkspace` (line 360) and `sessionRecord` (line 620) are used by
  the `workspace`/`session` cases and by `startSession`.
- 2.1–2.6: the 9 CLI tests named above exist and pass.
- 2.7: the bundle test passes.
- 3.1–3.2: `cmp` passes, the prompt is 93 lines, and the customizations test exists.
- 4.1–4.4: verified as described under acceptance items 10–12.
- 5.1: verified by grep.
- 6.1–6.3: re-run or audited above.

The delivery has no `(manual)` or `(manual, post-ship)` steps.

## Findings

1. **Minor: build mode reports `ok`/`resumed` for a managed build path that is
   registered but not on the delivery branch.** In `scripts/agento.mjs`
   `startSession()`, `registeredAt(productList, resolved.worktree)` sets
   `outcome = "resumed"` without comparing the registered branch to `productBranch`
   (line 1337). `halfState` checks only the clone and origin. Reproduced in a
   throwaway fixture (bare origin with `feature/xy` and its roadmap, local branch
   deleted, then `git worktree add --detach <repo>-worktrees/feature-xy
   origin/main`): `agento.mjs start-session feature/xy --no-open` exited 0 with
   `status: "ok"`, `outcome: "resumed"`, `product.branch: null`,
   `product.detached: true`, and `state.ok: true`, and it pointed the user at
   `/agento build-feature xy` in a window that is not on the branch.
   - With the old prompt, `git worktree add` failed on the existing path.
   - Impact is limited: the state is reachable only by hand-editing a managed
     worktree, and the Builder's §11 window check rejects the resulting window
     (`delivery` is null). So the error is misleading but does not corrupt anything.
   - Suggested fix: when no owner was found and the build-mode path is registered,
     return `failed` with `reason: "post-add-check"` (or a dedicated reason) naming
     the registered branch. Do the same for a companion half on a different branch if
     strictness is wanted there; the old prompt reused it untouched.
2. **Nit: `FETCH_AUTH_PATTERNS` may over-match.** In `scripts/session-state.mjs`
   lines 43–52, `\b(401|403)\b` and `/forbidden/i` would classify a non-auth fetch
   error whose stderr contains a path or host with `401`, `403`, or "forbidden" as
   `fetch-auth`. The failure is safe, because the command stops with a re-login hint
   instead of continuing, but anchoring on `HTTP 401|403` or `returned error: 40[13]`
   would be tighter.

No security issues were found. Every subprocess uses `execFile`/`execFileSync` with
argv arrays (no shell). Slugs pass `requireSlug` and session ids pass
`SESSION_ID`. Fetches are bounded (30 s) and non-interactive, and `code` is bounded
(15 s). No secrets are logged.

## Follow-ups

- Make `agento.mjs start-session` build mode reject a registered managed path that
  is not on the delivery branch (Finding 1), with an agento.test.mjs case.
- Tighten `classifyFetchFailure`'s HTTP status patterns (Finding 2).
- Move `/agento start-freehand` and `/agento close-session` onto CLI subcommands, as
  already noted out of scope in plan.md.
