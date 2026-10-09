# Review: close-session-cli

Verdict: approve

Reviewed 2026-10-09 against product `5b51fdc` (code PR #103, draft) and companion
`f490e86` (artifact PR #40), both on `feature/close-session-cli`. After `git fetch`
in both halves, `origin/main` is an ancestor of each HEAD and each HEAD equals its
`origin/feature/close-session-cli`; both trees were clean before review and stayed
clean after every rerun (`git status --porcelain --untracked-files=all` empty in
both). Window check: `agento.mjs session` → `role: build`, `delivery.slug:
close-session-cli`, `companion.dirty: false`, `companion.ahead: 0`;
`agento.mjs doctor --for review-feature` → every check `ok`.

Skills consulted: none — no matching domain (no `.agents/skills/` in the product
repository; AGENTS.md has no `## Agento` skills table).

Gate rerun by the Reviewer (product worktree at `5b51fdc`):

| Check | Result | Baseline / Builder claim |
| --- | --- | --- |
| `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | exit 0, 382 pass / 0 fail / 0 skipped, 102.7 s | 357/0 baseline; Builder 382/0 |
| `node --test scripts/worktree-occupants.test.mjs` | exit 0, 9/0/0 | Builder 9/0 |
| `cd extension && npm ci && npm run build && npm run test:unit` | exit 0 / 0 / 0, unit 160/160; tree unchanged after `copy-cli` | Builder 160/0 |
| `diff -rq scripts extension/cli` | only `*.test.mjs`, `hooks/`, `wait-for-checks.sh` absent from the bundle (intentional omissions) | — |
| `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` | exit 0 | — |
| `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` | exit 0 | — |
| `shellcheck …` | not run: `command -v shellcheck` exit 1 (absent locally, as in the plan baseline) | plan: exit 127 locally |
| CI on PR #103 head `5b51fdc` (`gh run view 37978171890`) | `Unit tests`, `Shellcheck`, `Guard fixture replay` all `success`; rollup `test: SUCCESS` | Builder: green |
| `git diff --name-only origin/main...HEAD -- '*.sh'` | empty | — |
| `node extension/cli/agento.mjs close-session` | `status: usage-error` (bundled CLI loads `worktree-occupants.mjs`) | — |

Lint gate (§5): the plan chose a scoped gate (shellcheck absent locally, covered by
CI). Every component is satisfied: full `node --test` green with +25 tests and no
new failures, extension build and unit tests green, CI `Shellcheck` step green on the
head commit, and no `.sh` file changed.

## Acceptance checklist results

1. **Argument grammar, flags, usage-error exit 1, usage header** — pass. Test
   "close-session validates its arguments and is listed in the usage header" covers
   `[]`, two args, `Bad_Id`, `feature/Bad_Slug`, `changes/`, `changes/Bad_Slug`,
   `chore/x`, and `--bogus` → exit 1, `usage-error`; usage header matches
   `close-session <feature|issue>/<slug> | changes/<slug> | <session-id> [--dry-run]
   [--ignore-occupants]` (`scripts/agento.mjs` L17, `closeSessionArgs()` L1571).
2. **Non-primary window → `rejected`, `wrong window: role=…`, record's
   `allowed`/`elsewhere`, nothing removed** — pass. Test at
   `scripts/agento.test.mjs` L3707 compares `allowed`/`elsewhere` with
   `agento.mjs session` from the plan worktree and asserts `cloneState` unchanged. The
   rejection happens before the fetch (`closeSession()` window check precedes
   `fetch(primary, …)`).
3. **Plan close, both layouts; nothing-to-close; unpushed; promoted `plan-<id>`** —
   pass. Tests L3759 (in-repo), L3799 (pair: companion half, product half, workspace
   file; unpushed companion half rejects with `commits.companion`), L3833 (promoted
   `plan-<id>` on `feature/promo` closes as `mode: build`, `subject: feature/promo`).
4. **Build close reuses `closeBuildSessionDecision`/`companionGaps`; every error
   passes through; `primary-owns-branch` fix; `remote-roadmap-only` already-closed;
   dirty/ahead reject; branch rule in both layouts** — pass. `closeSession()` calls
   `closeBuildSessionDecision`, `companionOfOwner`, `companionGaps` directly. Tests
   L3862 (`multiple-roadmaps`, `branch-mismatch`, `no-resolvable-roadmap`,
   `companion-unpushed`, `primary-owns-branch` with `fix: "git switch main"`), L3901
   (dirty with files, unpushed with commits, clean pushed half removed, branch
   retained while on origin), L3936 (already-closed deletes a merged branch; retains
   unmerged and stale-default with reasons), L3980 (pair: both halves + workspace
   file; landed branch deleted in each clone).
5. **Freehand close** — pass. Tests L4019 and L4085: branch-mismatch, nothing-to-close,
   unpushed (tracked `origin/main` and own upstream) → `next: ["/agento
   finish-freehand"]`, retained unmerged work → `/agento start-freehand <slug>
   --resume`, merged branch deleted in each clone.
6. **Occupant gate** — pass. Test L4131 spawns a live `sleep` in the companion half:
   `blocked`, `occupied`, exit 3, `PID <n> (sleep)`, guard wording in `message`,
   worktree lists/branches/workspace file unchanged (also under `--dry-run`);
   `--ignore-occupants` removes the pair and records an `occupants:` warning. Test
   L4162 stubs `code --status` with the `Folder`, `Workspace`, and `Window (…
   (Workspace))` forms. `scripts/worktree-occupants.mjs` matches the guard
   (`scripts/hooks/delivery-guard.sh` L71–117) line for line: same cwd/prefix test,
   same `comm` sanitising regex, same three `code --status` regexes, 5 s timeout, the
   same `details` wording and ≤3 PID cap.
7. **`--dry-run` full decision, `applied: false`, nothing changed** — pass. Test
   L4162 (clean dry run: `outcome: closed`, `removed: true` as preview, state
   identical before and after) and the Reviewer's real run (item 14).
8. **Idempotency** — pass. Test L4201: re-sent plan close → `nothing-to-close`; pair
   with companion half already removed → only product half removed, companion
   `registered: false, removed: false`; re-send → `already-closed`; merged branch left
   behind deleted in both clones.
9. **Fetch unreachable → warning; auth → `failed`/`fetch-auth`/`reauth` before any
   write** — pass. Test L3726 (missing remote → `fetch: product … continuing from
   local refs`; SSH stub → `fetch-auth`, `reauth` naming the URL, `cloneState`
   unchanged).
10. **Prompt is a formatter; byte mirror** — pass. `cmp
    .github/prompts/close-session.prompt.md commands/close-session.md` identical;
    `grep -nE "git worktree remove|git branch -d|agento.mjs paths|agento.mjs
    close-decision"` on the prompt prints nothing (exit 1); it keeps `Needs:
    terminal`, the §9/§11/§12 citations, the one-call line, and §12 blocks for the
    re-send, `--ignore-occupants` override, `next[]`, and rejected alternatives. New
    test in `tests/customizations.test.mjs` passes within the 382/0 run.
11. **`ship.prompt.md` and `extension/src/**` unchanged; `extension/cli/` equals
    `scripts/`** — pass. `git diff --stat origin/main...HEAD --
    .github/prompts/ship.prompt.md extension/src` is empty; `diff -rq` shows only the
    copier's intentional omissions; `npm run build` regenerated the copy with no
    tree change.
12. **Docs** — pass. `docs/commands.md` describes grammar, statuses, exit codes,
    outcomes, occupant gate with the Linux-only `/proc` scan, `--dry-run`,
    `--ignore-occupants`, and the branch rule, and updates the table row;
    `docs/architecture.md` has the `CLOSE[agento.mjs close-session: …]` node and the
    Scripts bullet; `CHANGELOG.md` has a **Changed** entry.
13. **Scoped lint gate recorded** — pass. See the gate table: 382/0 vs 357/0,
    extension build and unit tests green, CI `Shellcheck: success` on `5b51fdc`, local
    tool absent and recorded on step 4.3.
14. **Real-run evidence** — pass, re-driven independently. From this worktree,
    `node scripts/agento.mjs --root /home/david/DP/agento close-session 20261009-182342
    --dry-run` → exit 3, `status: blocked`, `reason: occupied`, `mode: build`,
    `subject: feature/close-session-cli`, `applied: false`; both halves list this
    window's processes plus "a matching VS Code folder" and "a matching VS Code
    workspace window"; both branches `retained` (`origin/… still exists`);
    `next: ["/agento ship close-session-cli"]`. Before/after `git worktree list
    --porcelain` of both clones, `git branch --list` of both clones, and `ls -la` of
    the workspace file were byte-identical (`cmp` exit 0 for each). Saved as
    [evidence/review-4-4-dry-run.json](evidence/review-4-4-dry-run.json). It matches
    the Builder's [evidence/step-4-4-dry-run.json](evidence/step-4-4-dry-run.json) in
    every field except the live PID lists and counts in `occupants`/`message`.

## Plan vs implementation

Builder-reported deviations, each checked:

- **`git fetch --prune origin` instead of `git fetch origin`** — accepted. Without
  `--prune` a remote branch deleted at merge stays as `refs/remotes/origin/<branch>`
  and the "gone from origin" branch rule could never fire. `/agento ship` already
  uses `fetch --prune` (`.github/prompts/ship.prompt.md` L219, L233, L312). Pruning
  only drops stale remote-tracking refs. It also runs under `--dry-run`, which
  follows the plan's step 3 (fetch before resolving). The plan's dry-run contract
  covers worktree lists, branches, and the workspace file, and all three are
  unchanged.
- **`extension/scripts/copy-cli.mjs` and `tests/extension-bundle.test.mjs` gained
  `worktree-occupants.mjs`** — accepted, necessary. `scripts/agento.mjs` now imports
  the module statically, so a bundle without it would fail to load. The
  bundled-CLI smoke run proves the module loads. `extension/src` is untouched,
  which is the substance of decision 4. Recorded on step 4.2 as discovered work.
- **Merged branch retained when the clone's local default is behind** — accepted as
  a conservative refinement. When the upstream ref is pruned, `git branch -d`
  compares the branch with `HEAD`, so a stale local default would make the plan's
  rule produce a `branch-delete` failure. Retaining the branch with a `pull --ff-only`
  hint avoids that failure and never forces a deletion. Documented in
  `docs/commands.md` and tested (L3936 `stale` case).
- **All `closeSession()` code landed in step 2.1's commit; 2.2–2.6 add only
  tests** — accepted with a note. `git show --stat` confirms `b5015a8` holds the
  300-line `scripts/agento.mjs` change and later commits touch only
  `scripts/agento.test.mjs`. No later commit changed `scripts/agento.mjs`, so every
  test pins the code as committed. The roadmap tick on 2.1 records the deviation.
  Only commit granularity differs from the plan. The behaviour is unaffected.
- **Not reported by the Builder**: the build/freehand "unpushed" rule is slightly
  broader than the plan's "must have an upstream with `ahead: 0`". With no upstream,
  the code accepts a half whose commits are all on some remote ref
  (`unpushedCommits()`: `HEAD --not --remotes`). A freehand branch that never had an
  upstream keeps its commits on the retained local branch. Both behaviours are
  documented in `docs/commands.md` and are data-safe. Informational.
- **Not reported by the Builder**: CI runs on intermediate commits `0a9f46b` (3.2)
  and `f8cb63d` (4.1) failed `extension CLI bundle contains exactly the source
  modules`, because the plan sequenced the bundle refresh last (4.2). The head commit
  is green. Informational.

No undocumented scope beyond the above. `COMMAND_NEEDS["close-session"]` is
unchanged (`["terminal"]`).

## Roadmap audit

All 15 ticked steps were spot-checked against the code, tests, CI, and evidence
above. Each holds and none is falsely ticked. There are no `(manual)` or
`(manual, post-ship)` steps. Step 4.4's evidence files exist and are linked, and the
Reviewer's re-run reproduces them. Step 4.5's integration claim holds:
`merge-base --is-ancestor origin/main HEAD` is true in both halves. No repairs made.

## Findings

1. **Minor — a `blocked` result reports `outcome: "closed"`.**
   `scripts/agento.mjs` `closeSession()` sets `out.outcome` before the occupant
   gate, so a blocked run (nothing removed, `removed: false` on both halves) carries
   `outcome: "closed"`. The Reviewer's real run shows it
   ([evidence/review-4-4-dry-run.json](evidence/review-4-4-dry-run.json)). `rejected`
   runs instead leave `outcome: null`, and the tests assert that for `unpushed`. The
   prompt maps by `status` first, so nothing user-visible is wrong today. A consumer
   reading `outcome` alone, such as the planned `ship-cli` reuse or the extension,
   could misreport. Suggest `outcome: null` for `blocked`, or documenting that
   `outcome` is the would-be outcome whenever `status ≠ ok`.
2. **Nit — the stale-default retention hint assumes the clone is on its default
   branch.** The reason text `merged into origin/<default> but not into <HEAD> …;
   run git -C <clone> pull --ff-only` is computed against the clone's current `HEAD`.
   If the primary sits on a non-default branch, `pull --ff-only` is the wrong advice.
   The branch is still safely retained.
3. **Nit — self-occupancy when run from inside a half.** `findOccupants()` does not
   exclude the CLI's own process. A run whose cwd is inside a half would count
   itself, as in the 4.4 `--root` real run. The guard behaves the same way, and the
   supported path (role `primary`, cwd in the primary) is unaffected.

Security: arguments are validated (`SESSION_ID`, `requireSlug`) before use; all git
calls use `execFileSync`/`gitRun` without a shell; removal paths come only from
`resolveSessionPaths` or the resolver's `owner.path`, must be registered in their own
clone, and the primary and the companion clone root are rejected (`protected-path`).
`--force` is never passed to `worktree remove` or `branch`. No secrets are logged.

## Follow-ups

- Make `outcome` unambiguous for non-`ok` statuses in `agento.mjs close-session`
  (`null` for `blocked`, or document the would-be semantics) before `ship-cli` reuses
  the teardown (finding 1).
- Word the stale-default branch hint by the clone's actual state, for example "switch
  to `<default>` and pull" when `HEAD` is not the default branch (finding 2).
- Consider sequencing a bundle refresh in the same step that adds a new
  `scripts/*.mjs` import, so intermediate commits keep CI green.
