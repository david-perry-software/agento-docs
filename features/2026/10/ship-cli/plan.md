# ship-cli: `agento.mjs ship <type> <slug>` as a resumable state machine, with the ship prompt reduced to a formatter

## Problem

`/agento ship` is the last and most consequential command of a delivery, and it is
still a 326-line prose procedure (`.github/prompts/ship.prompt.md`, mirrored
byte-for-byte in `commands/ship.md`): ownership, dual audit, two pinned gap lists,
the changelog stamp, ready/merge of up to two PRs, the release wait, two default-branch
syncs, teardown of two worktree halves plus a workspace file, and the post-ship
epilogue. Every step is executed by a model turn, so a ship takes minutes, costs a
large model, and has produced the incidents the initiative lists (the branch-delete
guard on `main`, the untracked-byproduct cleanup, superseded release runs, the
`gh pr edit --body` failure on gh 2.45).

The deterministic inputs already live in the CLI (`ship-preflight --pr`,
`close-decision`, `release`, `scripts/wait-for-checks.sh`), and the two sibling
members `start-session-cli` and `close-session-cli` showed the shape: one
`agento.mjs <command>` call that prints one JSON document, and a prompt that only
formats it.

This feature implements the `ship-cli` member of the `agento-hardening` initiative
([breakdown](../../../../initiatives/2026/10/agento-hardening/breakdown.md), block
`### ship-cli`): `agento.mjs ship <type> <slug>` runs the audit → ready → code merge →
companion merge → release wait → sync → teardown → epilogue state machine, resuming
from git and GitHub state alone, and `.github/prompts/ship.prompt.md` becomes a
formatter over it. User-visible effect: `/agento ship <slug>` finishes in a handful
of bounded CLI calls, every merge decision is code, and re-sending the command after
any stop resumes exactly where git says it is.

## Decisions

Clarifying questions were asked with the ask-questions tool on 2026-10-10. Every
answer was the option marked recommended.

- **Q: How should the user's confirmation of the confirmation-path gaps (untracked
  byproducts, unstamped changelog, PR nits) reach the CLI's merge phase?**
  A: `--confirm <token>` echoed from the audit (recommended). The audit result
  carries a token hashed from the gap list + PR numbers; merging requires it, so a
  changed gap set is rejected and nothing merges without the prompt relaying the
  user's yes. (Alternatives offered: per-gap flags; no confirmation in the CLI.)
- **Q: How should the CLI handle the CI and release waits inside one
  `agento.mjs ship` call?** A: Each call ≤ 60 s, returns `pending` (recommended),
  like `release --wait N`: the CLI advances as far as it can, polls bounded, and
  returns `status: pending` with the current `phase`; the prompt re-sends the identical
  command (policy §6). (Alternatives: run to completion; explicit `--phase` argument.)
- **Q: Today's audit includes model-judgment checks (spot-check ticked steps against
  code, "undocumented unrelated drift"). Where do these live after ship-cli?**
  A: The prompt keeps them, pre-confirm, read-only (recommended). The CLI does every
  mechanical check; the prompt may still read the diff summary from the audit JSON
  and withhold `--confirm` or name a gap; no extra CLI input. (Alternatives: drop
  them; CLI accepts `--extra-gap`.)
- **Q: How far should the CLI go for `(manual, post-ship)` steps after the merge?**
  A: CLI reports, prompt drives evidence, CLI opens the post-ship PR (recommended).
  `complete` + unticked post-ship steps → `outcome: post-ship-pending` listing them;
  the prompt collects evidence per §3 (only the user can act), then re-sends `ship`,
  which detects evidence files + ticks and lands them via the
  `<post-ship-prefix><slug>` PR. (Alternatives: CLI reports only; out of scope.)
- **Q: Should the dashboard's Ship action call `agento.mjs ship` directly (like New
  Plan calls `start-session`), or stay a chat route?** A: Stay a chat route; bundle
  copy only (recommended). Ship needs the user's confirmation mid-flow, which chat
  already provides; the extension only refreshes `extension/cli/` via `copy-cli`.
  (Alternatives: direct CLI for the audit; full direct CLI with a VS Code dialog.)

## Research

Skills consulted: none — no matching domain. The repository has no `.agents/skills/`
directory and no skills table (`## Agento` section) in AGENTS.md (verified
2026-10-10 in the planning worktree at `dd86680`).

### Initiative context

`node scripts/agento.mjs initiative agento-hardening` (2026-10-10): `ship-cli` is
`unplanned`, `ready: true`, `requires: [close-session-cli]` (complete, PR #40),
`recommendedAfter: [hooks-node-port]` (complete, merged as #104 = `origin/main`
`dd86680`). Both prerequisites are on `main`, so the teardown and occupant check this
member reuses, and the Node guard it must stay consistent with, are final.

### Today's ship procedure (what the CLI must absorb)

Source: `.github/prompts/ship.prompt.md` (326 lines; `commands/ship.md` is its byte
mirror). Phases and the facts each one reads:

- **Resolution and mode** (L11–41): `find <slug>` → type; `ship-preflight <type>
  <slug> --pr`; companion mode when `companionPr !== null` or `layout: "branch"` (or
  `artifactsRoot ≠ root` with a `companionPr:` warning); artifacts read from the
  companion's `origin/<branch>`, code from the product.
- **Idempotency** (L42–56): `complete` + unticked `(manual, post-ship)` → epilogue
  only; `complete` on `main`, PR merged, owner still present → teardown; merged with
  no owner → sync `main` and report; `pr.state === "MERGED"` while `companionPr.state
  === "OPEN"` → resume at the companion merge. Window check: role `primary`.
- **Ownership** (L58–111): `owner` / `ownerTree` / `companion` / `companionGaps` /
  `companionTree` from `ship-preflight`; writes go through `git -C <owner.path>`
  (artifacts through `git -C <companion.path>`), or the primary / companion clone on
  the mirrored branch when `owner === null`; a conflicting integration merge is
  `merge --abort` + reject to the build window.
- **Audit** (L113–150): PR `mergeStateStatus` (`BEHIND` → merge `origin/main`,
  `CONFLICTING` → hard reject); roadmap unticked steps and post-ship exceptions;
  review.md present / `Verdict: approve` / stale (older than the last code commit);
  issues: regression test, `## Resolution`, `Fixes #<n>` in the PR body; PR checks;
  release entry (`"version"` changed in `.claude-plugin/plugin.json` or `package.json`
  ⇒ `CHANGELOG.md` needs `## <version> (unreleased)` to stamp; an `(unreleased)`
  heading without a version change is a gap).
- **Gap lists** (L151–197): hard-reject (unticked non-post-ship steps, falsely ticked
  steps, review missing/stale/request-changes, failing regression test, dirty tracked
  or ahead owner tree, unreadable owner tree, any `companionGaps[]`, `CONFLICTING`)
  with the reject-back command (`review-<type>` when the review is the only gap, else
  `build-<type>`, or `start-session <type>/<slug> --resume` when `owner === null`);
  confirmation path (unstamped changelog, PR nits, undocumented drift, untracked
  byproducts listed verbatim) recorded under `## Follow-ups (accepted at ship)`;
  a missing `Fixes #<n>` is fixed via the idempotent REST PATCH, not asked.
- **Writes** (L198–244): `git --literal-pathspecs clean -f -- <paths>` for accepted
  byproducts then a re-preflight requiring `{ tracked: [], untracked: [], ahead: 0 }`;
  roadmap `status: complete` + follow-ups commit; changelog `(unreleased)` →
  `(<date -u +%Y-%m-%d>)` in the same commit (product half); `gh pr ready`;
  `scripts/wait-for-checks.sh pr <n>` (exit 2 = rerun); stamp refresh on a later
  UTC date; `gh pr merge` with a normal merge commit, no admin; `git push origin
  --delete <branch>` from the primary on `main`; primary `fetch --prune` +
  fast-forward; companion `gh pr ready` / wait `--repo <nameWithOwner>` / merge /
  remote delete / `switch <default>` + `merge --ff-only`.
- **Release** (L245–265): `agento.mjs release <merge-sha> --wait 50`; exit 2
  `pending` → rerun; exit 2 `dispatch-required` → `gh run list --workflow … --event
  workflow_dispatch` after `mergeDate`, else `gh workflow run <workflow> --ref
  <default>` once, then `wait-for-checks.sh run <id>`; exit 4 → resumable hard stop;
  exit 3 → `gh auth login`.
- **Teardown** (L266–288): companion half `worktree remove` + `prune`, product half
  `worktree remove` + `prune`, `branch -d` in each repo, the `.code-workspace` file;
  an occupant → the exact result line `paused at teardown (worktree <path> still
  open); next: close that VS Code window, then /agento ship <slug>`.
- **Report and epilogue** (L289–316): merge result, PR numbers, release verdict and
  run URLs, removed paths; `(manual, post-ship)` steps per §3, landed from fresh
  default on `post-ship/<slug>` (companion repository in companion mode) with one
  evidence + tick commit, PR, merge, sync, local branch delete; "cannot verify yet"
  → re-send resumes here.

### Existing CLI building blocks (`scripts/agento.mjs`, 2 765 lines at `dd86680`)

- `case "ship-preflight"` (L2303–2327): `decideWithLayout` → `evaluateShipPreflight`
  (`scripts/delivery-roadmap-resolver.mjs`), `companionOfOwner` (L416),
  `companionGaps` (L421), `ownerTreeOf` (L451), `companionTreeOf` (L456),
  `lookupPullRequest` (L621, `gh pr view <branch> --json
  number,state,isDraft,mergeStateStatus,url`, 15 s timeout, failures → `warnings[]`),
  `lookupCompanionPullRequest` (L701). `ship` calls these functions directly instead
  of re-spawning the CLI.
- `closeSession()` (L1592–1832): the §11 primary check from `sessionRecord()` (L721),
  bounded `gitRun(dir, ["fetch", "--prune", "origin"])` with `classifyFetchFailure` →
  `fetch-auth` + `reauthFor()`, the halves table, the occupant gate (L1789–1802,
  `findOccupants` from `scripts/worktree-occupants.mjs` with `once(defaultCodeStatus)`),
  and the apply block (L1807–1831: companion half → `prune` → product half → `prune`
  → workspace file → `branch -d` per repository). The gate and the apply block are
  written inline against `closeSession`'s `out`/`finish`/`fail` closures, so the
  ship teardown needs them extracted into a function that returns a result instead
  of emitting (Phase 1).
- `case "release"` (L2731–2762): `releaseContext(workflow, sha)`,
  `releaseSnapshot(ctx)`, `runSummary`, `RELEASE_EXIT`, `RELEASE_STATUS`,
  `GRACE_SECONDS`, `GhFailure`, bounded by `Atomics.wait` on a `SharedArrayBuffer`;
  `dispatch-required` never loops. The ship release phase calls the same functions in
  process and adds the dispatch-once rule the prompt spells out today.
- `startSession()` (L1397–1560) is the precedent for the output record (`status |
  reason | message | fix | reauth | allowed | elsewhere | preflight | warnings | root |
  configSource`), `runDoctor(checksFor(COMMAND_NEEDS["start-session"]))` (L1439),
  `finish()` exit 0 for `ok` else 3, `reject()` writes nothing.
- `COMMAND_NEEDS.ship = ["terminal", "gh", "network"]` (L994) and
  `scripts/agento.test.mjs` L1617–1620 pin `doctor --for ship` to checks `node,
  git-remote, gh, worktrees-dir, session-workspace, artifact-repo`. Unchanged.
- `header(content, key)` (L472) reads roadmap headers; `scripts/session-state.mjs`
  derives `lifecycle` (`approved`, `shipped`, `post-ship-pending`) and
  `postShipBranch` (`agento.test.mjs` L1346 asserts `post-ship/widget`), so the
  post-ship step detection has an existing parser to reuse.
- `scripts/wait-for-checks.sh` (130 lines): `pr <n> | run <id> [--max-seconds N]
  [--interval N] [--repo OWNER/NAME]`, exit 0 success / 1 failed / 2 pending / 3 gh or
  auth; it calls `gh pr view --json statusCheckRollup,mergeStateStatus` and `gh run
  view`. The CLI spawns it (reuse, per the brief) rather than porting it.
- `extension/src/dispatchRouting.ts` L41–49 only checks that ship actions run in the
  primary window and routes them to chat; `extension/src/statusStyle.ts` colours
  `shipped` / `post-ship-pending`. No extension source changes (decision 5);
  `extension/cli/` is a byte copy refreshed by `cd extension && npm run copy-cli`.

### The guard rules the CLI must enforce itself

`scripts/hooks/delivery-guard.mjs` only sees `node agento.mjs ship …`, so every rule it
applies to shell commands must hold inside the CLI:

- `gh pr merge --admin` is denied, `--squash` / `--rebase` ask (L231–241) → the CLI
  merges with `gh pr merge <n> --merge` only, never `--admin`, never
  `--delete-branch` (it would delete the local branch the owner worktree has checked
  out — `ship.prompt.md` L219–223).
- `git worktree remove` triggers the occupant ask (L198–212) → the CLI runs
  `findOccupants` on each half before removal, exactly as `closeSession` does.
- Never push to, delete, or commit on the default branch of either repository
  (replay fixtures `tests/guard-fixtures*.txt`) → the CLI's only default-branch
  operations are `fetch --prune` and `merge --ff-only origin/<default>`.
- Open-ended watchers are denied → the CLI's waits are `wait-for-checks.sh` with
  `--max-seconds` and the `release` poll loop, both bounded.

### Test and documentation contracts the rewrite touches

- `tests/customizations.test.mjs`:
  - L231–249 — `ship.prompt.md` must still contain an `/agento ap <slug>` block (the
    reject-back handoff keeps it).
  - L298–309 — the `close-session` formatter test is the template for a `ship`
    formatter test (byte mirror, one CLI call, no hand-run git/gh steps).
  - L310–325 — `ship` is on the `git worktree list --porcelain` allowlist; the
    comment is stale (`ship-audit-first` shipped) and is corrected in passing.
  - L429–441 — counts `clean -f` lines across prompts/agents/mirrors and requires
    `cleans >= 2` from the ship prompt and its mirror. Once the CLI performs the
    clean, the prompt stops naming it, so the test is retargeted to assert the CLI
    source spells `--literal-pathspecs` + `clean -f --` and that no prompt runs
    `git clean` by hand.
  - L443–457 — exactly 9 REST PATCH examples; two are the ship prompt's `Fixes #<n>`
    patch and its mirror. When the CLI performs that patch the count becomes 7 and the
    CLI gets its own test that the body contains a real blank line.
  - L459–471 — every prompt that needs `gh`/`network` cites `doctor --for <name>`;
    the formatter prompt keeps the citation (the CLI runs the checks, as
    `start-session.prompt.md` does).
  - L520–528 — `paused at teardown` must appear in `ship.prompt.md` and nowhere else.
  - L584–602 — guidance never sequences close-session before ship.
- `.github/instructions/delivery-policy.instructions.md` §6 names
  `scripts/wait-for-checks.sh` and `agento.mjs release` as the only wait mechanisms;
  one sentence is added saying `agento.mjs ship` runs both internally under the same
  bound. §7 ("only the user's /agento ship marks a PR ready or merges it") and the §9
  ship idempotency row are unchanged and are what the CLI implements.
- `docs/commands.md` (table row L15, the CLI paragraph L56–80, L291–298 companion
  ship), `docs/architecture.md` (`SHIP` node L16–22, Scripts bullet L83),
  `CHANGELOG.md` `## Unreleased`.

### Open delivery branches

`gh pr list --state open --json number,headRefName,title` on 2026-10-10 returned `[]`:
no concurrent delivery touches `scripts/agento.mjs`, the ship prompt, or the tests.

### Lint baseline (policy §5), run 2026-10-10 in the planning worktree at `dd86680`

- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → exit 0, **393 pass /
  0 fail / 0 skipped** (97.9 s).
- `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` → exit 0, every
  fixture verdict matches.
- `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt`
  → exit 0, every fixture verdict matches.
- `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` → `command -v shellcheck`
  exit 1 (not installed locally); CI runs it (the `Shellcheck` step recorded green by
  `close-session-cli` 4.3 on run 37978171890). This delivery changes no `.sh` file.
- Extension: `extension/node_modules` is absent in the planning worktree; the
  extension build / unit baseline is recorded by roadmap step 6.2 after `npm ci`.

Overlap decision: the baseline is green, so the **full gate** applies — full node
test suite (count ≥ 393, no failures), both replay runs, shellcheck via CI, and the
extension build + unit tests after the bundle copy; results compared against these
numbers on the final roadmap step.

## Approach

### Phase A — Extract reusable seams from `close-session` and `release`

In `scripts/agento.mjs`, with behaviour unchanged and the existing tests as the
regression net:

- `removeSessionPair({ halves, workspace, branches, ignoreOccupants, dryRun })` —
  the occupant gate (L1789–1802) and the apply block (L1807–1831) of `closeSession()`
  as a function returning `{ status: "ok" | "blocked" | "failed", reason, message,
  half, occupants, product, companion, workspace, branches, warnings }` instead of
  emitting. `closeSession()` calls it and maps the result onto its `out`.
- `releaseVerdict(sha, { wait, interval })` — the body of `case "release"` returning
  the report object and exit code; the case emits it. Adds no behaviour.
- `ghRun(cwd, args, timeout)` — a `gitRun`-shaped bounded `gh` runner (stdin closed,
  stderr captured), used by every `gh` write below; `prViewArgs` / `lookupPullRequest`
  stay as they are.

### Phase B — `agento.mjs ship <type> <slug> [--confirm <token>] [--wait N]`

Usage header line; `parseArgs` gains `--confirm <token>` (string) and reuses
`--wait N` (≤ 60, default 50); `COMMAND_NEEDS.ship` unchanged. Implemented as
`shipArgs()` + `ship()` beside `closeSession()`. One call does, in order:

1. **Window check (§11)**: `sessionRecord()` must have `role: "primary"`; otherwise
   `status: "rejected"`, `reason: "wrong window: role=<role> (<path>, branch <b>)"`,
   with the record's `allowed` / `elsewhere`. Nothing written.
2. **Doctor**: `runDoctor(checksFor(COMMAND_NEEDS.ship))`; `fail` → `rejected`
   naming the failing check's `detail` and `fallback`; `warn` → `preflight[]`.
3. **Fetch** (`--prune`) the product clone and, in companion mode, the companion
   clone; `fetch-auth` → `status: "failed"`, `reason: "fetch-auth"`, `reauth`;
   unreachable → `warnings[]`, continue from local refs.
4. **Preflight**: the `ship-preflight --pr` computation in process (`decideWithLayout`
   → `evaluateShipPreflight`, `companionOfOwner`, `companionGaps`, `ownerTreeOf`,
   `companionTreeOf`, `lookupPullRequest`, `lookupCompanionPullRequest`); resolver
   `conflict` / `branch-mismatch` / `missing` → `rejected` with the resolver message;
   `source: remote` is valid. `owner.role === "primary"` → `rejected`, `fix: "git
   switch <default>"`. Companion mode = `layout.artifacts.external`.
5. **Derive the phase** from git + GitHub state, never from a journal:

   | State | Phase |
   | --- | --- |
   | `pr.state === "OPEN"` | `audit` |
   | `pr.state === "MERGED"`, companion PR `OPEN` | `merge-companion` |
   | both merged (or in-repo merged), default(s) behind `origin/<default>` | `sync` |
   | merged + synced, `checks.releaseWorkflow` set, verdict not yet terminal | `release` |
   | merged + synced + released, `owner !== null` | `teardown` |
   | merged + synced + released, no owner, unticked `(manual, post-ship)` steps on the artifact default | `epilogue` |
   | none of the above | `done` (`outcome: "already-shipped"`, sync-only report) |

6. **Audit phase** (read-only; always runs when the PR is open). Reads roadmap.md,
   review.md, plan.md from the artifact `origin/<branch>` (`git -C <artifactsRoot>
   show`); the diff file list from `git diff --name-only origin/<default>...origin/<branch>`
   on the product; `gh pr view <n> --json body,title,mergeStateStatus,mergeable` and
   the companion PR likewise from inside the companion clone. Produces:
   - `audit.roadmap { status, unticked[], postShip[] }`, `audit.review { present,
     verdict, stale, reviewedAt, lastCodeCommit }`, `audit.issue { githubIssue,
     fixesLine, resolutionWritten } | null`, `audit.changelog { versionChanged, from,
     to, unreleasedHeading, needsStamp, headingWithoutVersionChange }`, `audit.pr`,
     `audit.companionPr`, `audit.diffFiles[]`, plus the preflight fields (`owner`,
     `ownerTree`, `companion`, `companionGaps`, `companionTree`, `layout`,
     `artifactsRoot`).
   - `gaps.hard[]` — `{ code, detail }` for every hard-reject code of today's list:
     `unticked-steps`, `review-missing`, `review-stale`, `review-request-changes`,
     `owner-tree-dirty`, `owner-ahead`, `owner-tree-unreadable`, `companion-<gap>`
     (one per `companionGaps[]` entry, each with its fix text), `pr-conflicting`,
     `companion-pr-conflicting`, `changelog-heading-without-version`,
     `post-ship-unjustified` (a `(manual, post-ship)` step with no `## Risks`
     mention of post-ship in plan.md). Falsely ticked steps and a failing regression
     test stay the prompt's and Reviewer's judgment (decision 3) — the CLI cannot
     run arbitrary project tests safely from the primary.
   - `gaps.confirm[]` — `{ code, detail, paths? }`: `untracked-byproducts` (with
     `ownerTree.untracked` verbatim), `changelog-unstamped`, `pr-behind` (will merge
     `origin/<default>` into the branch), `companion-pr-behind`.
   - `confirmToken` — first 12 hex chars of SHA-256 over the canonical JSON of
     `{ slug, pr: pr.number, companionPr: companionPr?.number ?? null, confirm:
     gaps.confirm }`. Stable across the CLI's own later writes (it hashes the gap
     set the user accepted, not commit SHAs); any change to the gap set invalidates it.
   - `rejectTo` — `/agento review-<type> <slug>` when the review is the only hard
     gap, else `/agento build-<type> <slug>` (owner present) or `/agento start-session
     <type>/<slug> --resume` (no owner), with `window`.
   - A missing `Fixes #<n>` on an issue PR is not a gap: the CLI appends it through
     `gh api repos/<owner>/<repo>/pulls/<n> -X PATCH -f body=…` with a real blank
     line only when absent, and records `actions[]: fixes-line-added`.

   With `gaps.hard` non-empty → `status: "rejected"`, `reason: "audit-gaps"`, nothing
   written (the only permitted cleanup remains the `merge --abort` of a conflicting
   integration, which happens in the write phase, never here). With `gaps.hard`
   empty and no `--confirm` → `status: "ok"`, `phase: "audit"`, `outcome:
   "awaiting-confirm"`, `confirmToken`, `next: ["/agento ship <slug>"]`: the prompt
   presents `gaps.confirm` (or "clean audit"), obtains the user's yes when the list is
   non-empty, performs its read-only judgment checks, and re-sends with
   `--confirm <token>`. The audit call itself never writes.
7. **Write phase** (requires `--confirm <token>`; `token` must equal the freshly
   recomputed `confirmToken`, else `status: "rejected"`, `reason: "confirm-stale"`,
   both tokens and the current `gaps.confirm` in the result):
   - accepted `untracked-byproducts` → `git -C <owner.path> --literal-pathspecs
     clean -f -- <paths>` with exactly the listed paths (never `-d`, `-x`, or a
     directory), then recompute `ownerTree` and require `{ tracked: [], untracked: [],
     ahead: 0 }` (else `rejected`, `reason: "owner-tree-changed"`);
   - `pr-behind` → `git -C <owner.path|primary-on-branch> merge origin/<default>`;
     a conflict → `merge --abort`, verify `status --porcelain` empty, `rejected`,
     `reason: "integration-conflict"`, `rejectTo` the build window (companion half
     likewise for `companion-pr-behind`);
   - roadmap `status: complete`, `last-updated`, `next-step: ""`, the
     `## Follow-ups (accepted at ship)` section listing each accepted confirm gap,
     committed in the artifact checkout (`docs(<type>): ship <slug>`); the changelog
     stamp `(unreleased)` → `(<UTC date>)` committed in the product half when
     `needsStamp`; push each half;
   - `gh pr ready <n>`; in companion mode `gh pr ready <m>` from inside the clone;
   - `scripts/wait-for-checks.sh pr <n> --max-seconds <remaining budget>`: exit 2 →
     `status: "pending"`, `phase: "checks"`, exit 2 from the CLI, `next` the same
     `--confirm` command; exit 1 → `status: "failed"`, `reason: "checks-failed"`,
     resumable; exit 3 → `failed`, `reason: "gh-auth"`, `reauth`;
   - a stamp older than today's UTC date on resume → one refresh commit before merge;
   - `gh pr merge <n> --merge` (no `--admin`, `--squash`, `--rebase`,
     `--delete-branch`), then `git push origin --delete <branch>` from the primary,
     `git fetch --prune`, `git merge --ff-only origin/<default>` on the primary (which
     is on `<default>` by the §11 check), verifying a clean tree with zero ahead/behind;
   - the `on-no-owner` path (`owner === null`): the write targets are the primary on
     `<branch>` and the companion clone on the mirrored branch, switched back to the
     defaults after the push, exactly as the prompt does today.
8. **`merge-companion` phase**: `gh pr ready <m>` (no-op when ready),
   `wait-for-checks.sh pr <m> --repo <nameWithOwner>` (bounded → `pending`),
   `gh pr merge <m> --merge`, `git -C <artifactsRoot> push origin --delete <branch>`,
   companion default sync (`switch <default>`, `fetch --prune`, `merge --ff-only`). A
   failure here → `status: "failed"`, `reason: "companion-merge"`, `message` reading
   exactly `code PR #<n> merged, companion PR #<m> open at <url>; re-send /agento ship
   <slug> to resume at the companion merge`.
9. **`release` phase** (only with `checks.releaseWorkflow`): `releaseVerdict(mergeSha,
   { wait: remaining budget })`; `pending` → `status: "pending"`; `dispatch-required`
   → `gh run list --workflow <w> --event workflow_dispatch --json
   databaseId,createdAt,url`; a run created after `mergeDate` is followed, otherwise
   `gh workflow run <w> --ref <default>` exactly once (the re-send finds the run);
   `failed` / `no-run` → `status: "failed"`, `reason: "release-<verdict>"`, `run.url`;
   `success` / `superseded-success` / `not-triggered` / `not-configured` → recorded in
   `release` and the phase advances.
10. **`teardown` phase** (`owner !== null`): `removeSessionPair` over the owner's
    halves and workspace file; `blocked` → `status: "blocked"`, `reason: "occupied"`,
    `outcome: "paused-teardown"`, `occupants`, `pausedPath` (the half the gate
    flagged), `next: ["/agento ship <slug>"]`, nothing removed; `ok` → `teardown`
    reports removed halves, workspace file, and branch deletions.
11. **`epilogue` phase** (unticked `(manual, post-ship)` steps on the artifact
    default): in the artifact checkout (companion clone in companion mode, primary
    in-repo) ensure `post-ship/<slug>` exists from fresh `origin/<default>` and is
    checked out (`switch -c` or `switch`); report `postShip { branch, path, steps:
    [{ id, text, ticked, evidence, evidencePresent }] }`. When every step is ticked
    and links an existing evidence file: commit evidence + roadmap (`docs(post-ship):
    <slug> evidence`), push, `gh pr create` (or reuse the open PR for the branch),
    `wait-for-checks.sh pr <k>` (bounded → `pending`), `gh pr merge --merge`, delete
    the remote branch, sync the default, `branch -d`; `outcome: "shipped"`.
    Otherwise `outcome: "post-ship-pending"` with the remaining steps, exit 0: the
    prompt walks the user through §3 and re-sends. Steps with `(manual, post-ship)`
    are never ticked by the CLI.
12. **Output**: one JSON document

```
{ status: ok | pending | rejected | blocked | failed | usage-error,
  type, slug, branch, mode: "in-repo" | "companion",
  phase: audit | confirm | checks | merge-code | merge-companion | sync | release | teardown | epilogue | done,
  outcome: awaiting-confirm | shipped | already-shipped | paused-teardown | post-ship-pending | null,
  audit: { … }, gaps: { hard: [], confirm: [] }, confirmToken, rejectTo: { command, window } | null,
  actions: [ { step, detail } ],   # what this call wrote, in order
  pr, companionPr, mergeSha, release: { verdict, run, supersededBy, reason } | null,
  teardown: { product, companion, workspace, branches, occupants, pausedPath } | null,
  postShip: { branch, path, steps: [] , pr } | null,
  next: [ "/agento ship <slug>" | "/agento ship <slug> --confirm <token>" | <rejectTo.command> ],
  preflight: [], reason, message, fix, reauth, allowed, elsewhere, warnings: [], root, configSource }
```

Exit 0 for `ok`, 2 for `pending`, 3 for `rejected | blocked | failed`, 1 for usage.
Every call is bounded: the wait budget is `--wait` (default 50, max 60) seconds
shared by the checks and release polls in one call.

### Phase C — Prompt as formatter

`.github/prompts/ship.prompt.md` is rewritten on the `close-session.prompt.md` model
(same frontmatter semantics, `Needs: terminal, gh, network`, the §9/§11/§12 citations,
the `doctor --for ship` citation, the §9 idempotency row, window check `primary`):

- **Calls**: `node <agento-root>/scripts/agento.mjs find <slug>` for the type, then
  `node <agento-root>/scripts/agento.mjs ship <type> <slug>`; after the user's yes (or a
  clean audit), `… ship <type> <slug> --confirm <confirmToken>`; on `pending`, re-send
  the identical command; never run `git`, `gh`, `wait-for-checks.sh`, or `release`
  yourself.
- **Judgment before confirm** (decision 3): with `gaps.hard` empty, read
  `audit.diffFiles`, `audit.roadmap`, and the review summary; spot-check ticked
  steps against the code and look for undocumented unrelated drift; a finding is
  reported as a gap with the build-window handoff and `--confirm` is withheld.
- **Map the JSON**: `rejected` (`wrong window`, `audit-gaps` with `gaps.hard` and the
  `rejectTo` block + `/agento ap <slug>`, `confirm-stale`, `integration-conflict`,
  resolver messages) → §9 rejected receipt or failed result as today; `ok/audit` →
  present `gaps.confirm` verbatim (untracked paths "will be deleted") and ask, default
  no; `pending` → report `phase` and re-send; `blocked/occupied` → the exact `paused
  at teardown (worktree <path> still open); next: close that VS Code window, then
  /agento ship <slug>` result line with the resume block; `failed` → §9 failed result
  quoting `message` (`companion-merge` uses the CLI's exact sentence) and that
  re-sending resumes; `ok/shipped` → the report (PR numbers, release verdict and URLs,
  removed halves, accepted gaps carried into Follow-ups); `ok/post-ship-pending` →
  §3 walkthrough of `postShip.steps`, then re-send.
- `commands/ship.md` is the byte mirror. The prompt keeps `/agento ap <slug>` after
  the build/review reject-back block and the `paused at teardown` wording.

### Phase D — Tests, docs, bundle

- `scripts/agento.test.mjs`: a `// --- ship` section using `makeWorktreeRepo`,
  `makePairRepo`, `writeRoadmap`, `restrictedPath`, and a scriptable `gh` stub
  (`shipStub`) that answers `pr view` (including `body`, `statusCheckRollup`),
  `pr ready`, `pr merge` (simulated by merging into the bare origin's default so
  later fetches see `MERGED`), `api … PATCH`, `pr create`, `run list`, `workflow run`,
  `repo view`, logging every invocation to a marker file; `wait-for-checks.sh` runs
  against the same stub.
- `tests/customizations.test.mjs`: the ship formatter test; the exclusivity test
  that only `ship.prompt.md` and `commands/ship.md` reference `agento.mjs ship` (regex
  `agento\.mjs ship\b(?!-preflight)`); the `clean -f` and REST PATCH tests retargeted
  as described in Research.
- Docs: `docs/commands.md`, `docs/architecture.md`, `CHANGELOG.md`; policy §6
  sentence; `cd extension && npm run copy-cli` and the bundle test.

### Files touched

- `scripts/agento.mjs` (new `ship` subcommand, extracted `removeSessionPair`,
  `releaseVerdict`, `ghRun`; usage line), `scripts/agento.test.mjs`
- `.github/prompts/ship.prompt.md`, `commands/ship.md`
- `.github/instructions/delivery-policy.instructions.md` (§6, one sentence)
- `tests/customizations.test.mjs`
- `docs/commands.md`, `docs/architecture.md`, `CHANGELOG.md`
- `extension/cli/*` (generated copy; no `extension/src` edits)

## Risks

- **Any agent could call `agento.mjs ship` and merge.** Mitigations: merges happen only
  in the `--confirm <token>` call, the token comes from the audit the prompt relays to
  the user, the §11 check requires the primary window, policy §7 keeps "only the
  user's /agento ship marks ready or merges", and a customizations test fails if any
  prompt or agent other than the ship prompt and its mirror references
  `agento.mjs ship`.
- **The CLI bypasses the delivery guard.** The guard sees `node agento.mjs ship`, not
  the `gh pr merge`, `git push --delete`, or `git worktree remove` inside it.
  Mitigation: the CLI hard-codes the guard's rules (Research, "guard rules"): normal
  merge commit only, no admin/bypass, `findOccupants` before every removal, no
  default-branch writes beyond `fetch`/`merge --ff-only`, bounded waits only. Tests
  assert the exact `gh` argument vectors via the stub's log.
- **Token staleness vs. the CLI's own writes.** The token hashes the confirm gap
  set and PR numbers, not commit SHAs, so the roadmap/stamp commits do not invalidate
  it; a new untracked file between audit and confirm changes the gap set and is
  rejected (`confirm-stale`), and the post-clean recheck catches tracked changes.
- **Half-done writes.** The state machine derives the phase from git and GitHub on
  every call (table in Approach step 5): a re-send after a dropped terminal lands on
  the first unfinished phase; nothing is journaled. Tests re-run the command after
  each simulated interruption and assert no second merge, push, or PR.
- **Real `gh` behaviour differs from the stub** (`gh pr merge` timing, `mergeCommit`
  lag). Mitigation: a real-run evidence step (6.4) exercises the audit path against
  this delivery's own PRs read-only, and the first real merge with the new CLI is
  this feature's own ship, whose fallback is `/agento ship` re-sent after inspection.
- **Judgment checks move to an optional pre-confirm read.** The Reviewer's
  `Verdict: approve` and the CLI's mechanical audit are the gate; the prompt's
  spot-check can only add a gap, never skip one (decision 3).
- **Companion half of this plan.** The product branch carries code; the companion
  branch carries these artifacts (two-commit rule, policy §7).

## Out of scope

- Extension UI for ship (decision 5): `dispatchRouting.ts` keeps routing ship to chat.
- Porting `scripts/wait-for-checks.sh` to Node (the brief says reuse).
- Running the project's tests from the primary during the audit (regression tests
  remain the Reviewer's and the build window's job).
- Changing any existing subcommand's output, exit code, or lifecycle rule;
  `ship-preflight`, `close-decision`, `close-session`, `release` keep their contracts.
- The `delivery-metrics` member and anything in the hooks.

## Acceptance checklist

- [ ] `node scripts/agento.mjs ship` is listed in the usage header; `ship` with a bad
      type, missing slug, extra positionals, `--wait` > 60, or `--confirm` without a
      value is a `usage-error` (exit 1) — verified by `scripts/agento.test.mjs`.
- [ ] From a non-primary window the command is `rejected` with `wrong window: role=…`
      and the record's `allowed`/`elsewhere`, writing nothing — verified by
      `agento.test.mjs` from a managed worktree fixture.
- [ ] The audit call on an open PR never writes (worktree lists, branches, refs, and
      PR state byte-identical before and after) and reports `gaps.hard`,
      `gaps.confirm`, `confirmToken`, `rejectTo`, and `audit.*` for: unticked steps,
      review missing / stale / request-changes, dirty or ahead owner tree, each
      `companionGaps` entry, conflicting PRs, changelog heading without a version
      change, unjustified post-ship step, untracked byproducts, unstamped changelog,
      behind PRs — verified by `agento.test.mjs` cases in both layouts.
- [ ] `--confirm` with a token that does not match the recomputed one is `rejected`
      with `confirm-stale` and writes nothing; a matching token after a new untracked
      file is likewise stale — verified by `agento.test.mjs`.
- [ ] The confirm call on a clean in-repo delivery: cleans exactly the listed
      untracked paths with `--literal-pathspecs clean -f --`, commits roadmap
      `status: complete` + `## Follow-ups (accepted at ship)`, stamps the changelog
      when the version changed, marks the PR ready, waits via `wait-for-checks.sh`,
      merges with `gh pr merge <n> --merge` (no `--admin`, `--squash`, `--rebase`,
      `--delete-branch`), deletes the remote branch, fast-forwards the primary, and
      tears the owner worktree down — verified by the stub log and git state in
      `agento.test.mjs`.
- [ ] Companion mode: the roadmap commit lands in the companion half, both PRs are
      readied, the code PR merges first, the companion PR second, both defaults are
      synced, both halves and the `.code-workspace` file are removed, and both local
      branches deleted — verified by `agento.test.mjs` with `makePairRepo`.
- [ ] A pending check returns `status: pending` (exit 2) within the `--wait` budget
      and the identical re-send continues; a failed check is `failed` /
      `checks-failed` with nothing merged — verified by `agento.test.mjs` with a stub
      whose `statusCheckRollup` is scripted per call.
- [ ] Resume from every interruption derives the right phase: code merged + companion
      open → `merge-companion`; merged + owner present → `teardown`; merged + no owner
      → sync-only `already-shipped`; `complete` + unticked post-ship → `epilogue`;
      occupied half → `blocked` / `occupied` with `pausedPath` and nothing removed —
      verified by `agento.test.mjs` re-sends after each simulated state.
- [ ] Release: with `checks.releaseWorkflow` the phase reports `pending`, follows or
      dispatches exactly once on `dispatch-required`, records `success` /
      `superseded-success` / `not-triggered`, and stops on `failed` / `no-run` —
      verified by `agento.test.mjs` with the `release` stub patterns from
      `release-state.test.mjs`.
- [ ] Epilogue: `post-ship/<slug>` is created from fresh default in the artifact
      checkout and `postShip.steps` lists each `(manual, post-ship)` step with
      `evidencePresent`; once all are ticked with existing evidence the CLI commits,
      pushes, opens/reuses the PR, merges, syncs, and deletes the branch; partial
      evidence stays `post-ship-pending` — verified by `agento.test.mjs` in both
      layouts.
- [ ] A missing `Fixes #<n>` on an issue PR is appended via the REST PATCH with a
      real blank line, only when absent — verified by the stub's recorded body.
- [ ] `closeSession()` and `case "release"` behave exactly as before the extraction —
      verified by the existing close-session and release tests passing unchanged.
- [ ] `.github/prompts/ship.prompt.md` and `commands/ship.md` are byte-identical, call
      `agento.mjs ship` and `agento.mjs find` only, keep `Needs: terminal, gh,
      network`, the `doctor --for ship` citation, the §9/§11/§12 citations, the
      `/agento ap <slug>` block, and the `paused at teardown` line, and contain no
      `gh pr merge`, `gh pr ready`, `git push origin --delete`, `git worktree remove`,
      `wait-for-checks.sh`, or `agento.mjs release` instruction — verified by
      `node --test tests/customizations.test.mjs`.
- [ ] Only `ship.prompt.md` and `commands/ship.md` reference `agento.mjs ship` —
      verified by the new exclusivity test in `tests/customizations.test.mjs`.
- [ ] The `clean -f` and REST PATCH customizations tests are retargeted (CLI source
      spells `--literal-pathspecs`, 7 prompt examples) and pass — verified by
      `node --test tests/customizations.test.mjs`.
- [ ] Policy §6 names `agento.mjs ship` as running the two bounded waits internally;
      `docs/commands.md`, `docs/architecture.md`, and `CHANGELOG.md` describe the
      subcommand, its statuses and exit codes, the token, and the phase table —
      verified by grep.
- [ ] `extension/cli/` is a fresh byte copy of `scripts/` with no `extension/src`
      change — verified by `node --test tests/extension-bundle.test.mjs` and
      `git diff --stat origin/main -- extension/src` empty.
- [ ] Full gate green against the baseline: `node --test 'scripts/**/*.test.mjs'
      'tests/**/*.test.mjs'` exit 0 with ≥ 393 pass and 0 fail; both replay-guard
      runs exit 0; CI `Shellcheck` step green on the PR; `cd extension && npm ci &&
      npm run build && npm run test:unit` exit 0 — recorded on roadmap step 6.3.
- [ ] Real-run evidence: `agento.mjs ship feature ship-cli` (audit only, `--root` the
      primary) against this delivery's own open PRs exits 3 with `reason: audit-gaps`
      naming the unticked steps and writes nothing (worktree lists and refs identical
      before and after) — JSON saved under `evidence/` and linked from roadmap 6.4.
