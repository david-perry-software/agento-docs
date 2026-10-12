# Publish CLI: one call each for plan publish, review publish, and the PR → wait → merge flows

## Problem

This feature implements the `### publish-cli` member block of the
[spend-reduction breakdown](../../../../initiatives/2026/10/spend-reduction/breakdown.md)
(wave 2; requires `preflight-call`, recommended after `builder-step-cli` — both
complete).

- Summary (breakdown): "`agento.mjs plan-publish`, `agento.mjs review-publish`, and one
  shared `agento.mjs publish-pr` replace the Planner and Reviewer publish steps and the
  five hand-run PR → wait → merge → sync flows."
- Brief (breakdown, the description baseline): "`plan-publish`, `review-publish`
  (`--edit-last` comment), and one shared `publish-pr` (PR, bounded wait with exit 2
  pending, `--merge`, sync, delete branch) used by commit-current-changes,
  finish-freehand, quick-fix, new-initiative, triage-followups."

Today the model runs these publish procedures one git or gh call at a time. Every tool
round-trip re-sends the whole context, so each publish costs 3–14 extra round-trips
(see Research → Measurement). The prose also exists in up to three copies (agent,
prompt, `commands/` mirror) per flow, each with its own companion-mode variant. That
is where hand-run mistakes creep in, such as a forgotten cross-link, a second review
comment thread, or a merge with checks pending. After this feature, each of these
flows is one resumable `agento.mjs` call that returns the `ship`-style JSON contract.
Re-sending the call resumes from git and GitHub state.

## Decisions

The clarifying questions were asked as a numbered list in chat because the
ask-questions tool was unavailable (§10 fallback). The user answered **"defaults"**
on 2026-10-12, which selects the recommended option of every question:

1. **Where does `publish-pr` start?** Options: a. start at push (the prompt still
   makes its own commit(s)) **(recommended)**; b. also commit from `--message-file`;
   c. an optional `--message-file`. **Answer: a.** `publish-pr` starts at push and
   runs push → PR → wait → merge → sync → delete branch. Writing the commit message
   stays with the model.
2. **How do flows in the companion repository work** (`new-initiative`,
   `triage-followups`)? Options: a. one call per checkout, via `--dir <path>`
   (default: the current directory) **(recommended)**; b. one call publishes both
   repositories with `--companion`; c. product checkouts only. **Answer: a.**
3. **How does `publish-pr` wait?** Options: a. like `ship`: an internal `--wait N`
   (N ≤ 60, default 50), exit 2 while pending, and a re-send resumes. When `main`
   advances, it merges `origin/main` into the branch, pushes, and waits again
   **(recommended)**. b. No internal wait; the prompts keep calling
   `wait-for-checks.sh`. **Answer: a.**
4. **Where does `review-publish` post the verdict comment in companion mode?**
   Options: a. on the code PR, with `--edit-last` semantics (one comment, updated on
   re-review), after the companion commit, the merge of the companion default, and
   the push **(recommended)**; b. on the companion PR; c. on both. **Answer: a.**
5. **How are the savings measured?** Options: a. count the hand-run git/gh tool calls
   in each rewired block before and after, recorded in plan.md, plus one reference
   `/agento quick-fix` run from the chat debug log, before and after
   **(recommended)**; b. only the `/agento ap` reference run; c. static counts only.
   **Answer: a.**

## Research

Skills consulted: none — no matching domain (the repository has no `.agents/skills/`
and its AGENTS.md has no skills table; the work is Node CLI code, Markdown
prompts/agents, and node:test suites).

### Lint baseline (§5) — taken 2026-10-12 on `main` `4fb355e`

| Gate | Command | Exit | Findings |
| --- | --- | --- | --- |
| Full-repository lint (AGENTS.md "Shell lint") | `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` | 0 | none |
| Tests | `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | 0 | 465 pass, 0 fail (166 s) |
| Guard smoke | `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` | 0 | all verdicts match |
| Guard smoke (companion) | `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` | 0 | all verdicts match |

`shellcheck` is not installed on this machine. CI installs it with `apt-get`
(`.github/workflows/ci.yml:19–21`), so the baseline used the upstream v0.10.0 release
binary, unpacked under `/tmp`. Builders without `shellcheck` do the same. The baseline
is green, so this is a **full gate**: no cleanup is needed, no scoped gate is
permitted, and every component above must still exit 0 at the end. `extension/cli/`
is in sync with `scripts/` (`diff -rq` lists only the non-copied test files and
hooks).

### What gets replaced

- **Planner publish:** `.github/agents/delivery-planner.agent.md` step 8 (L156–176),
  `.github/prompts/new-feature.prompt.md` step 5 (L62–70), and
  `.github/prompts/new-issue.prompt.md` (L76–84), plus their `commands/` mirrors.
  The in-repo variant is commit → `push -u` → draft PR. The companion variant is:
  1. companion commit and push;
  2. one empty product commit, push, and the draft code PR;
  3. the draft companion PR;
  4. an idempotent `gh pr view` + REST PATCH cross-link;
  5. the `artifact-pr:` header commit and push.
- **Reviewer publish:** `.github/agents/delivery-reviewer.agent.md` step 8
  (L97–107), `review-feature.prompt.md` (L38–46), `review-issue.prompt.md` (L43–51),
  plus mirrors. In companion mode the Reviewer makes one companion commit
  `docs(<type>): review <slug> — <verdict>`, merges the companion's
  `origin/<default>`, pushes, checks `agento.mjs session` for `dirty: false` and
  `ahead: 0`, and posts exactly one comment on the **code** PR: `Verdict: …` plus a
  blob link to review.md on the companion branch. A re-review updates that comment
  with `--edit-last`. In the in-repo layout the comment is optional.
- **PR → wait → merge → sync flows:**
  - `commit-current-changes.prompt.md` steps 8–10: `changes/<short-slug>` in the
    primary checkout. The PR is not a draft. The prompt waits with
    `scripts/wait-for-checks.sh pr <n>` and merges `origin/main` when main advances.
    After a normal merge it deletes the branch, switches to `main`, and
    fast-forwards.
  - `finish-freehand.prompt.md` steps 7–9: the same flow, but run inside the freehand
    worktree. It must **not** switch to `main` or delete the local branch there;
    `/agento close-session changes/<slug>` does that later.
  - `quick-fix.prompt.md` steps 7–9: same as commit-current-changes.
  - `initiative-architect.agent.md` step 8 and `new-initiative.prompt.md`:
    `changes/initiative-<slug>`. In companion mode every command runs in the
    companion clone (`git -C <artifactsRoot>`, `gh … --repo <companion-repo>`).
  - `triage-followups.prompt.md` step 5: `chore/followup-triage-<slug|date>`, in the
    product checkout or (companion mode) the companion clone.
- **Reusable code in `scripts/agento.mjs`:**
  - `mergeRef` (L1993): merge, never a rebase; a conflict aborts and is reported
    with its files.
  - `pushRef` (L2002): never forced; classifies auth failures as `push-auth` with
    `reauth`.
  - `buildWindow` (≈L2015) and `deliveryRun` / `openDeliveryRun`: the result
    contract and the build-window check.
  - `integrateHalves` (L2070) and `pushHalves` (L2096).
  - `stepCommit`'s PR phase (L2244–2300): draft code PR with `Fixes #<n>` for issues,
    companion draft PR, the idempotent REST PATCH cross-link, and the `artifact-pr:`
    header commit. This is exactly the Planner's companion step 8.
  - `ship`'s `waitForChecks` closure (L2641), merge (`gh pr merge <n> --merge`,
    L2766), remote-branch delete (`git push origin --delete`), and `syncDefault`
    (L2813).
  - `SHIP_EXIT` (L2320): `{ ok: 0, pending: 2, rejected: 3, blocked: 3, failed: 3 }`.
- **The guard** (`scripts/hooks/delivery-guard.mjs` L234–243) only denies
  `gh pr merge --admin` and asks on `--squash`/`--rebase`. It never restricts *which*
  PR is merged, and it cannot see git or gh run inside `agento.mjs`. The rule that
  delivery PRs merge only through `/agento ship` is therefore prose today.
  `publish-pr` must enforce it in code.
- **Window roles** (`scripts/session-state.mjs` `WINDOW_ROLES` L449–505):
  - `new-feature` / `new-issue`: `plan`, or `build` for a promoted planning worktree.
    A planning worktree on `feature/<slug>` reports `build`.
  - `review-*`: `build`.
  - `commit-current-changes`: `primary` on a non-default branch.
  - `quick-fix` and `new-initiative`: `primary` on the default branch, clean.
  - `finish-freehand`: `freehand`.
  - `triage-followups`: any role.

  The callers' own `preflight` keeps doing these window checks.
- **Customizations tests** (`tests/customizations.test.mjs` L290–383) already have
  "one `agento.mjs` call, no hand-run fallback" tests (start-session, close-session,
  ship, Builder sync/step-commit) and "only X references `agento.mjs <sub>`" tests
  (ship L339; step-commit/sync L367). The `commands/*.md` files mirror their prompts
  byte for byte. `COMMAND_NEEDS` (L1060) needs no change because no slash command is
  added.
- **Test fixtures** (`scripts/agento.test.mjs`): `makePairRepo` (L424), `planPair`
  (L4279), and `shipStub` (L4415). `shipStub` is a fake `gh` with scripted check
  rollups for `wait-for-checks.sh`; real merge commits land in the bare origin, and
  the stub rejects forbidden merge flags (self-test at L4542).
- **Docs** that list the CLI subcommands: `docs/commands.md` (L278, `step-commit`),
  `docs/architecture.md` (L97), and `CHANGELOG.md` `## Unreleased`. Policy §6 names
  `ship`'s internal bounded waits.
- **Concurrency:** `gh pr list --state open` returned no open PRs in either
  repository (2026-10-12), so there is no file overlap with other deliveries. The
  sibling `builder-step-cli` is complete.
- **Reference-run inputs:** none of the 390 `main.jsonl` chat debug logs under
  `~/.config/Code` contains a `/agento quick-fix` run, so the "before" reference run
  must be captured during the build. The plugin clone `/home/david/DP/agento-plugin`
  is on `main`, clean, and 17 commits behind `origin/main`; it has no `preflight`
  subcommand yet.

### Measurement — before (static count of hand-run git/gh tool calls per publish)

| Flow | In-repo | Companion |
| --- | --- | --- |
| Planner publish (new-feature / new-issue) | 3 | 8–9 |
| Reviewer publish (review-feature / review-issue) | 2–3 | 5 |
| commit-current-changes (steps 8–10) | ≈10 | — |
| finish-freehand (steps 7–9) | ≈9 | — |
| quick-fix (steps 7–9) | ≈10 | — |
| new-initiative (Architect step 8) | ≈10 | 12–14 |
| triage-followups (step 5) | ≈10 | 10–12 |

Each count excludes the commit the prompt still writes, and pending check re-polls add
one call each. The target is **1 call per send** (plus one re-send per pending wait),
recorded in the "after" table that roadmap step 6.1 adds here.

### Measurement — after (static count, read from the rewired files on `feature/publish-cli`)

| Flow | In-repo | Companion | The one call |
| --- | --- | --- | --- |
| Planner publish (new-feature / new-issue) | 1 | 1 | `agento.mjs plan-publish <type> <slug>` |
| Reviewer publish (review-feature / review-issue) | 1 | 1 | `agento.mjs review-publish <type> <slug> --body-file -` |
| commit-current-changes (steps 8–10) | 1 (+1 per exit 2) | — | `agento.mjs publish-pr --title … --body-file - --merge` |
| finish-freehand (steps 7–9) | 1 (+1 per exit 2) | — | `agento.mjs publish-pr --title … --body-file - --merge` |
| quick-fix (steps 7–9) | 1 (+1 per exit 2) | — | `agento.mjs publish-pr --title … --body-file - --merge` |
| new-initiative (Architect step 8) | 1 (+1 per exit 2) | 1 (+1 per exit 2) | `agento.mjs publish-pr … --merge` (`--dir <artifactsRoot>` in companion mode) |
| triage-followups (step 5) | 1 (+1 per exit 2) | 1 (+1 per exit 2) | `agento.mjs publish-pr … --merge` (`--dir <artifactsRoot>` in companion mode) |

Every count is 1 call per send, plus one identical re-send per `status: pending`
(exit 2), against 2–14 hand-run git/gh calls before. The commits the prompts still
write (Decision 1) are excluded on both sides. Customizations tests keep each file at
that one call: none of the rewired bodies may contain `gh pr create`, `gh pr merge`,
`gh pr comment`, `wait-for-checks.sh`, `git push`, or a `gh api …/pulls/… -X PATCH`.

## Approach

All new code goes in `scripts/agento.mjs`, reusing the `builder-step-cli` and `ship`
helpers. Every subcommand prints one JSON document in the `deliveryRun` / `ship`
shape: `status`, `phase`, `outcome`, `actions[]`, `reason`, `message`, `reauth`,
`next[]`, `warnings[]`. Exit codes: 0 ok, 2 pending (`publish-pr` only), 3
rejected/blocked/failed. There is no journal: a re-send re-derives its phase from git
and GitHub state.

1. **Shared helpers (no behaviour change).**
   - Lift `ship`'s `waitForChecks` closure into a module-level helper that takes an
     explicit seconds budget.
   - Extract `stepCommit`'s PR phase into
     `ensureDeliveryPrs(run, win, { type, slug, commit, messageDir })`, which handles
     the draft code PR (`Fixes #<n>` for issues), the companion draft PR, the
     cross-link, and the `artifact-pr:` commit and push.
   - Give `integrateHalves` an option that limits the `origin/<default>` merge to
     chosen halves.
   - `ship`, `sync`, and `step-commit` keep their existing tests unmodified.
2. **`agento.mjs plan-publish <type> <slug>`** (Planner step 8, new-feature step 5,
   new-issue).
   - **Window check:** `windowVerdict({ command: "new-<type>", slug })`, so the role
     is `plan`, or `build` for this slug's promoted planning worktree. The product
     half and (companion mode) the companion half must both be on the roadmap's
     branch: never detached, never the default branch.
   - **Validation:**
     - The artifact half has `plan.md` and `roadmap.md` in the slug directory.
     - The roadmap header `branch:` equals the branch.
     - Changes sit only inside the slug directory (in-repo), or the product half is
       fully clean (companion mode). Otherwise reject `outside-slug` with the paths.
   - **Commit:** the slug directory in the artifact half, with the existing messages
     (`docs(delivery): plan <slug>` in-repo, `docs(<type>): plan <slug>` in companion
     mode). A later re-send with new artifact edits commits
     `docs(<type>): revise plan <slug>`.
   - **Companion mode only:** if the product branch has no commit beyond
     `origin/<default>`, add one empty `chore(<type>): open <slug>` commit.
   - **Integrate and push:** `integrateHalves`, then `pushHalves` (product first, full
     `refs/heads/` refspecs, `-u` on first push).
   - **PRs:** `ensureDeliveryPrs`.
   - **Finish:** the clean-handoff check (no changes, `ahead: 0` in every half).
   - **Limits:** it never readies or merges a PR.
   - **Output** adds `pr`, `companionPr`, `commits`, and `pushed[]`.
3. **`agento.mjs review-publish <type> <slug> [--body-file <file|->]`** (Reviewer
   step 8, review-feature, review-issue).
   - **Window check:** `buildWindow`.
   - **Validation:**
     - review.md exists in the slug directory, with `# Review: <slug>` and exactly
       one `Verdict: approve|request-changes` line.
     - Changes sit only inside the slug directory: review.md, roadmap repairs,
       evidence. In companion mode the product half is clean.
   - **Commit:** one artifact-half commit, `docs(<type>): review <slug> — <verdict>`
     (skipped when nothing changed).
   - **Integrate:** `origin/<branch>` in every half, and `origin/<default>` in the
     companion half only. That matches today's prose: the in-repo product half is not
     merged with `main`, so the reviewed code does not change under the verdict.
   - **Push**, then require the code PR to exist (else reject `pr-missing`).
   - **Verdict comment:** upsert exactly one comment on the **code** PR. The body is
     `Verdict: <verdict>`, a blob link to review.md on the artifact repository's
     branch, an optional `--body-file` summary, and a hidden marker
     `<!-- agento:review <type>/<slug> -->`. The comment is found through the REST
     comments list (authored by `gh api user`, carrying the marker), then PATCHed if
     found or POSTed if not.

     This is the `--edit-last` semantics the brief asks for, with one improvement:
     `--edit-last` fails when no earlier comment exists, and would edit an unrelated
     later comment by the same user.

     The comment is now posted in the in-repo layout too, so both layouts behave the
     same.
   - **Finish:** the clean-handoff check.
4. **`agento.mjs publish-pr [--dir <path>] [--branch <name>] [--title <text>]
   [--body-file <file|->] [--merge] [--wait N]`** (the five flows).
   - **Checkout:** `--dir` (default: the current directory) must be a checkout of the
     product repository or of the configured companion repository, compared by
     `origin` URL. Otherwise reject `unknown-repo`.
   - **Branch:** the current branch, or `--branch` when the checkout is back on the
     default branch (resume after merge). It is refused when it is:
     - the default branch;
     - a detached HEAD;
     - under the configured feature, issue, or post-ship prefix. Those PRs merge only
       through `/agento ship`, and the guard cannot see this call.
   - **Preconditions:**
     - No tracked uncommitted changes (reject `dirty`).
     - At least one commit beyond `origin/<default>` (reject `nothing-to-publish`;
       never an empty PR).
     - The `--body-file` path lies outside the checkout.
   - **Phases, derived from state on every send:**
     1. *push:* fetch, then `push -u` with a full refspec, never forced.
     2. *pr:* reuse the open PR for the branch, or `gh pr create --base <default>`
        (not a draft) with `--title` and `--body-file`. Without `--merge` it stops
        here with `outcome: opened`.
     3. *checks:* if GitHub reports the PR `BEHIND`, merge `origin/<default>`
        (conflict → abort, reject `integration-conflict` with the files), push, and
        keep waiting. Run `wait-for-checks.sh pr <n>` bounded by `--wait` (≤ 60,
        default 50; `--repo` is derived with `gh repo view` for a companion
        checkout). Exit 2 is `pending` with the identical re-send in `next[]`. A
        failing check is `blocked` (exit 3, `checks-failed`) and nothing is merged.
     4. *merge:* `gh pr merge <n> --merge`. The code never builds `--admin`,
        `--squash`, `--rebase`, or `--auto`.
     5. *delete-branch:* `git push origin --delete <branch>` (a warning when it is
        already gone).
     6. *sync:* `fetch --prune`. In a primary checkout or the companion clone, switch
        to the default branch, fast-forward, and `branch -d` the merged branch. In a
        linked worktree (finish-freehand), leave the worktree on its branch and return
        the `/agento close-session changes/<slug>` handoff in `next[]`.
     - A re-send after the merge resumes at delete-branch or sync.
     - Auth failures from gh or git carry `reauth` (`gh auth login`).
   - **Output** adds `pr`, `mergeSha`, `sync`, and `checkout`.
5. **Rewire prompts and agents.** Each replaced block becomes one call plus a thin
   formatter over its JSON: print outcome and actions; on `pending` re-send the same
   call; on `rejected`/`blocked`/`failed` stop with `message` and `reauth`.
   - **Planner:** `delivery-planner.agent.md`, `new-feature.prompt.md`,
     `new-issue.prompt.md` → `plan-publish`.
   - **Reviewer:** `delivery-reviewer.agent.md`, `review-feature.prompt.md`,
     `review-issue.prompt.md` → `review-publish`.
   - **PR flows:**
     - `commit-current-changes`, `quick-fix`, `finish-freehand` → `publish-pr
       --merge`, after the prompt's own commit.
     - `initiative-architect.agent.md` + `new-initiative.prompt.md` → `publish-pr
       --merge`, with `--dir <artifactsRoot>` in companion mode.
     - `triage-followups.prompt.md` step 5 → `publish-pr --merge`, likewise.
   - The `commands/*.md` mirrors are re-copied byte for byte.
6. **Tests.**
   - **`scripts/agento.test.mjs`:** a `plan-publish`, a `review-publish`, and a
     `publish-pr` group (in-repo and companion fixtures, `shipStub` as gh). Together
     they cover:
     - every rejection;
     - fresh run, then a re-send that creates nothing a second time;
     - the pending → re-send path and a failing check;
     - a `BEHIND` integration;
     - the delivery-prefix refusal;
     - linked-worktree sync;
     - the companion `--dir` path;
     - the `--branch` resume;
     - the stub's forbidden-flag guard.
   - **`tests/customizations.test.mjs`:**
     - "one call, no hand-run fallback" tests for each rewired file. The body must not
       match `gh pr create`, `gh pr merge`, `gh pr comment`, `wait-for-checks.sh`,
       `git push`, or `gh api …/pulls/… -X PATCH` inside the replaced steps.
     - Restriction tests, siblings of the ship and step-commit tests:
       - only the Planner files reference `plan-publish`;
       - only the Reviewer files reference `review-publish`;
       - only the five flows' files reference `publish-pr`.
7. **Docs and generated copy.**
   - `docs/commands.md` (CLI reference next to `step-commit`, plus each rewired
     command's description).
   - `docs/architecture.md`.
   - `CHANGELOG.md` `## Unreleased` (**Added**).
   - Policy §6: the bounded-wait bullet also names `publish-pr`.
   - `cd extension && npm run copy-cli`.

Affected files: `scripts/agento.mjs`, `scripts/agento.test.mjs`,
`tests/customizations.test.mjs`, `.github/agents/{delivery-planner,delivery-reviewer,initiative-architect}.agent.md`,
`.github/prompts/{new-feature,new-issue,review-feature,review-issue,commit-current-changes,finish-freehand,quick-fix,new-initiative,triage-followups}.prompt.md`
and their `commands/` mirrors, `.github/instructions/delivery-policy.instructions.md`
(§6 line only), `docs/commands.md`, `docs/architecture.md`, `CHANGELOG.md`,
`extension/cli/agento.mjs` (generated).

## Risks

- **`publish-pr` as a back door to merging delivery PRs.** *Mitigations:*
  - the code refuses the configured feature, issue, and post-ship prefixes and the
    default branch;
  - a test covers each refusal;
  - a customizations test limits `publish-pr` callers to the five flows.
- **In-process git and gh bypass the guard.** *Mitigations:* the CLI enforces the
  same rules itself:
  - no commit or push on the default branch;
  - full `refs/heads/` refspecs, never forced;
  - integration by merge only, never a rebase;
  - `gh pr merge --merge` only.

  `shipStub` rejects forbidden merge flags, so a regression fails the tests.
- **Fewer, larger calls hide intermediate failures.** *Mitigation:* the `ship`-style
  contract. Every stop names its `phase`, `reason`, and `actions[]`, and a re-send
  resumes from state.
- **The freehand worktree must not be switched to `main`** (it does not own `main`,
  and close-session removes it). *Mitigation:* linked-worktree detection skips
  switch and delete, with a dedicated test.
- **Verdict comment upsert.** `gh pr comment --edit-last` cannot create a missing
  comment and can hit an unrelated later comment. *Mitigation:* the marker plus REST
  list/PATCH/POST, tested for first post and re-review update (never two comments).
- **Small behaviour changes.**
  - The in-repo Reviewer now always posts the verdict comment (it was optional).
  - In the companion layout, `plan-publish` integrates the defaults before pushing,
    as policy §7 requires; a freshly branched plan is normally a no-op merge.

  Both are recorded in the CHANGELOG.
- **Reference runs need a real chat session.** Only the user can start a
  `/agento quick-fix` chat run, so roadmap steps 6.2 and 6.3 are `(manual)`. Each
  run merges a real small change of the user's choosing, in a repository other than
  agento, so its prompts come from the plugin clone. For the "after" run the Builder
  points the plugin clone `/home/david/DP/agento-plugin` at
  `origin/feature/publish-cli`. That affects every window using the plugin until it
  is restored, so the Builder restores `main` immediately after the run and verifies
  it is clean.
- **Concurrent edits to hotspot files** (`scripts/agento.mjs`, `docs/commands.md`,
  `CHANGELOG.md`, `tests/customizations.test.mjs`, `extension/cli/`). There are no
  open PRs today. *Mitigation:* integrate `origin/main` by merge before every push
  (step-commit does this) and regenerate `extension/cli/` after any merge that
  touches `scripts/`.
- **Size L.** The roadmap is phased so each phase ends green and pushed. A session
  break between phases is expected.

## Out of scope

- Semantics of `ship`, `sync`, and `step-commit` (helper extraction only; their
  tests stay unmodified).
- The commits the five flows make. Message writing stays in the prompts (Decision 1).
- `gh issue create` in `new-issue` and `triage-followups`, triage's stale-code
  comments, and the Architect's validation steps.
- New slash commands, `COMMAND_NEEDS` changes, guard changes, extension changes
  beyond `npm run copy-cli`, and prompt prose trimming beyond the replaced blocks.
- The Autopilot (it drives the Builder and Reviewer, which pick up `review-publish`
  through the Reviewer agent).

## Acceptance checklist

- [ ] `node scripts/agento.mjs plan-publish <type> <slug>` performs the Planner's
  publish in both layouts. In-repo: commit, push, draft PR. Companion: companion
  commit, empty product commit, both draft PRs, the cross-link, and the
  `artifact-pr:` header. A re-send creates no second commit, PR, or cross-link, and
  it never readies or merges — verify: the `plan-publish` group in
  `scripts/agento.test.mjs` passes.
- [ ] `node scripts/agento.mjs review-publish <type> <slug>` commits the review in the
  artifact half, integrates as specified (companion default only), pushes, and
  leaves exactly one verdict comment on the code PR with the review.md link. A
  re-review updates that comment — verify: the `review-publish` group passes, and
  the stub's comment list holds one marked comment after two sends.
- [ ] `node scripts/agento.mjs publish-pr --merge` pushes, opens or reuses a non-draft
  PR, waits within `--wait` (exit 2 pending, then resumes), merges a `BEHIND` PR's
  default by merge, merges with `--merge` only, deletes the remote branch, and syncs
  the default branch. A linked worktree is left on its branch with the close-session
  handoff, and `--dir` works on a companion checkout — verify: the `publish-pr`
  group passes.
- [ ] `publish-pr` refuses the default branch, a detached HEAD, and every configured
  feature, issue, and post-ship prefix with exit 3, writing nothing — verify: the
  refusal test in the `publish-pr` group.
- [ ] Failing checks stop `publish-pr` as `blocked` (exit 3, `checks-failed`) with
  nothing merged, and gh or git auth failures carry `reauth` — verify: the
  corresponding `publish-pr` tests.
- [ ] Every rewired file (Planner, Reviewer, five flows, and the `commands/` mirrors)
  publishes through exactly one `agento.mjs` call with no hand-run fallback —
  verify: the new "one call" tests in `tests/customizations.test.mjs` pass and
  `commands/*.md` mirror their prompts byte for byte.
- [ ] Only the Planner files reference `plan-publish`, only the Reviewer files
  reference `review-publish`, and only the five flows reference `publish-pr` —
  verify: the new restriction tests pass.
- [ ] `ship`, `sync`, and `step-commit` behaviour is unchanged — verify: `git diff
  origin/main -- scripts/agento.test.mjs` shows only additions (no ship, sync, or
  step-commit test modified), and they pass.
- [ ] The usage header lists the three subcommands; `docs/commands.md`,
  `docs/architecture.md`, `CHANGELOG.md` (Unreleased), and policy §6 describe them;
  `extension/cli/` is regenerated — verify: `node scripts/agento.mjs` usage output,
  plus `diff -q scripts/agento.mjs extension/cli/agento.mjs` reporting no difference.
- [ ] Full gate equals the green baseline — verify, all exit 0:
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`;
  - `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` (no findings);
  - both guard replays;
  - `cd extension && npm ci && npm run test:unit`.
- [ ] Savings recorded — verify: plan.md `## Research` holds the "after" static table
  (1 call per send for every flow) and the before/after `/agento quick-fix` reference
  counts (publish phase and total), with the debug-log paths and the linked evidence
  screenshots from steps 6.2 and 6.3.
