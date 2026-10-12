# Builder step CLI: `agento.mjs sync` and `agento.mjs step-commit` replace the Builder's hand-run git choreography

## Problem

This is member `### builder-step-cli` of the
[spend-reduction](../../../../initiatives/2026/10/spend-reduction/breakdown.md)
initiative (wave 2, size L, requires `preflight-call` — complete). Brief:
"`agento.mjs sync <type> <slug>` (fetch + merge-integrate both halves, never rebase,
conflict → abort with files) and `agento.mjs step-commit <type> <slug> --step N.M
--message-file <f>` (two-commit rule, integrate, push product then companion, draft
PRs if missing, clean/ahead-0). Security: the guard can't see in-process git, so the
CLI enforces the same rules (no default-branch commit, roadmap in the commit).
Largest payoff — runs every step."

Today every Builder roadmap step ends in a hand-run sequence
(`.github/agents/delivery-builder.agent.md` "Work loop" step 4 and step 5): commit
the code; commit the roadmap tick and evidence in the companion (`git -C`);
`git fetch`; `merge-base --is-ancestor` for both defaults and merge when behind;
push product, then companion; confirm `companion.dirty: false` / `ahead: 0` via
`agento.mjs session`; open draft PRs when missing. The breakdown measured about
8–12 tool calls per step. The resume protocol step 1 runs a second hand-run
sequence (fetch and merge `origin/<branch>` and `origin/<default>` in both halves),
and the pause protocol and completion repeat the commit/integrate/push sequence.
Each tool call re-sends the full context.

After this feature a Builder step is one `agento.mjs step-commit` call, and the
resume and completion integration is one `agento.mjs sync` call. The delivery rules
do not change: the two-commit rule, merge-never-rebase, product-before-companion
push order, re-verify after integrating the default, roadmap-in-the-commit, and the
clean handoff all stay — they move from prose into code.

## Decisions

The questions were asked with the ask-questions tool. The user picked the
recommended option for every question:

- **Q1 (Staging): What should `step-commit` put into the code and artifact
  commits?** A: "Stage all, companion scoped to slug dir (recommended)" — `git add
  -A` in the product half; in companion mode only the slug's artifact directory;
  reject untracked files outside it so byproducts surface instead of being
  committed. Not chosen: "Commit only what the agent staged"; "Explicit --paths
  list".
- **Q2 (Roadmap rule): How strictly should `step-commit` enforce the
  roadmap-in-commit rule?** A: "--step requires N.M ticked; without --step require
  roadmap.md changed (recommended)" — hard reject otherwise; `--step` omitted covers
  pauses, session breaks, audit repairs, and completion. Not chosen: "Always require
  --step and the tick"; "Warn only".
- **Q3 (Builder coverage): Which Builder paths switch to the new CLI calls?**
  A: "All: resume, work loop, pause, completion (recommended)" — `sync` for resume
  step 1 and completion's integration check; `step-commit` for every step, the
  roadmap repair, pause/session break, and in-review commits; the Autopilot inherits
  through the Builder. Not chosen: "Work loop only".
- **Q4 (Conflicts): When `sync` or `step-commit` hits a merge conflict integrating a
  default branch, what happens?** A: "Abort, report files, nothing pushed
  (recommended)" — same as ship's `integration-conflict`: `merge --abort`, list
  conflicted files; the Builder resolves by hand per the hotspot recipes, then
  re-sends. Not chosen: "Leave merge in progress; re-send concludes".
- **Q5 (Measurement): How should the before/after tool-call count be measured?**
  A: "Debug-log counts within this delivery (recommended)" — baseline: tool calls
  per roadmap step from a past build's chat debug log (e.g. preflight-call); after:
  the same count for this delivery's own steps built after the Builder rewiring
  lands; recorded in plan.md — no post-ship step. Not chosen: "Analytical only";
  "Post-ship measurement".

Follow-up decision (2026-10-12), after step 5.2 paused because the after median (9)
was not lower than the before median (9). The user's decision, verbatim:

- "Option 1 — accept the measured result: amend 5.2's verify to 'measurement
  recorded'; the delivery's value is safety/correctness of step commits rather than
  a per-step call reduction."

## Research

Skills consulted: agent-customization (built-in) — agents are `*.agent.md` in
`.github/agents/` with YAML frontmatter; the body's first two lines are the
`Needs:` / `Fallback:` declarations, which this feature leaves untouched (the
Builder's needs — `terminal, browser, gh, network` — already cover `gh` for PR
creation). The repository has no `.agents/skills/` and no skills table in
AGENTS.md (matching the breakdown's note).

### The hand-run choreography being replaced

- `.github/agents/delivery-builder.agent.md`:
  - "Resume protocol" step 1: `git fetch origin`, merge `origin/<branch>` when
    ahead, merge `origin/main` when advanced; companion mode repeats it with
    `git -C <companion.path>`. Step 4: commit and push the repaired roadmap.
  - "Work loop" step 4: commit with the roadmap update; `git fetch origin`; merge
    `origin/main` when it is not an ancestor of `HEAD`, rerun `verify:`, push;
    companion mode is the two-commit rule (code commit, then companion commit; push
    product first, companion second); a no-code step is one companion commit.
    Step 5: open the draft PR (and in companion mode the companion PR and the
    `artifact-pr:` header) on the first push when the Planner left them out.
  - "Pause protocol": commit, push both halves, `agento.mjs session` must show
    `companion.dirty: false` and `companion.ahead: 0`.
  - "Completion": fetch, confirm both defaults are ancestors (merge and re-verify
    if not), set `status: in-review`, commit, push, confirm both trees clean.
- `.github/instructions/concurrent-delivery.instructions.md` L66–L74 ("Before every
  push") spells out the same fetch / `merge-base --is-ancestor` / merge sequence
  for both halves.
- `.github/instructions/delivery-policy.instructions.md` §7 holds the rules (merge
  never rebase, two-commit rule, product-first push order, clean handoff); they stay
  unchanged.

### CLI building blocks (all in `scripts/agento.mjs` unless noted)

- Dispatch is the `switch (command)` at L3304 (`case "ship"` L3483, `case
  "preflight"` L3497). Usage header is the first 30 comment lines (L7–L28), which
  `usage()` echoes and the usage test asserts.
- `gitRun(dir, args, timeout)` (L1435) — bounded, prompt-free git with stderr;
  `ghRun(cwd, args, timeout)` (L1448); `reauthFor(url)` (L1461);
  `classifyFetchFailure` (`scripts/session-state.mjs`); `isAncestor(dir, a, b)`
  (L1666); `treeState(dir)` (L449, tracked/untracked/ahead); `describeCompanion`
  (L336); `companionGaps` (L433); `header(content, key)` (L484);
  `requireType`/`requireSlug` (L474 and following); `deliveryBranch(type, slug)`.
- `ship()` (L2001) already has closures for exactly this work — `integrate(dir,
  defaultRef, label)` (L2274: `merge --no-edit`, on failure `merge --abort` and
  `integration-conflict`) and `push(dir, label, refspec)` (L2285: `push-auth` with
  `reauth`, `push-failed`) — plus the fetch closure with `fetch-auth`. They are
  scoped inside `ship()`, so `sync`/`step-commit` should lift them to module level
  and `ship()` should call the shared versions. The breakdown notes `publish-cli`
  will reuse these helpers.
- The JSON contract to follow is `ship`'s: `{ status, phase, actions: [{ step,
  detail }], reason, message, fix, reauth, next[], warnings[] }`, `SHIP_EXIT = { ok:
  0, pending: 2, rejected: 3, blocked: 3, failed: 3 }` (L1971).
- The window check is in process: `preflightDocument` (L3120) uses
  `sessionRecord()` and `windowVerdict(...)` with `WINDOW_ROLES`
  (`scripts/session-state.mjs` L449; `"build-feature"`/`"build-issue"`/`ap` are
  `BUILD_SLUG`). The new subcommands reuse `windowVerdict` with
  `command: build-<type>` and the slug, so a call from the primary or a plan window
  is rejected exactly like `/agento build-<type>` would be.
- `COMMAND_NEEDS` (L1049) lists slash commands only; `sync` and `step-commit` are
  CLI subcommands the Builder calls, not slash commands, so the needs table and the
  `Needs:` agreement test are unaffected.

### The guard rules the CLI must enforce in process

`scripts/hooks/delivery-guard.mjs` sees only shell text, so `node agento.mjs
step-commit` is invisible to it (it has no `agento.mjs` rule at all). The rules
to mirror:

- L383–L384: deny commits/merges on the default branch and pushes to it.
- L338: deny force pushes (`--force`, `-f`, `+refspec`); L348–L353: deny
  `--no-verify`, ask on `--amend`; L356–L357: ask on `rebase`.
- L387–L409: ask on a delivery-branch commit without a `roadmap.md` change; in
  companion mode it inspects the companion half's index and last commit.

`close-session` and `ship` already enforce their guard-equivalent rules in process
(the occupant gate in `removeSessionPair`, "never `--admin`/`--squash`/`--rebase`"
in ship); `step-commit` and `sync` do the same: plain `git commit` (hooks run, never
`--no-verify`, never `--amend`), plain `git merge --no-edit` (never rebase), plain
`git push origin <branch>` (never forced, never to the default), and a hard reject
instead of the guard's `ask` for the roadmap rule (Q2).

### Tests that constrain the change

- `tests/customizations.test.mjs`:
  - L290–L330: "…is one agento.mjs … call with no hand-run fallback procedure" for
    `start-session`, `close-session`, `ship` — the model for a Builder test
    asserting `agento.mjs sync` / `agento.mjs step-commit` and no hand-run
    `git push`, `git -C <companion.path> commit`, or `merge-base --is-ancestor`.
  - L332+: "only the ship prompt and its mirror reference agento.mjs ship" — the
    model for "only the Builder agent calls `agento.mjs step-commit` / `sync`".
  - L254–L268: the Builder's pause protocol must keep "**Session break**…`status:
    in-progress`" and "**Pause**…`status: paused`…(manual)…blocked:" — the rewrite
    must keep those phrases.
  - The canary list (policy-only spellings) — the Builder prose must not restate
    §9 receipt spellings.
- `scripts/agento.test.mjs`: `makeRepo({ companion: true })`, `cloneWithOrigin`,
  `companionOf`, `writeRoadmap`, `run`, `runWith`, and `restrictedPath({ gh:
  <script> })` (L1–L110) give real repos with bare origins and a fake `gh`; the
  usage test asserts header lines.

### Lint baseline (2026-10-12, `3dcf8a0`)

| Command | Exit | Findings |
| --- | --- | --- |
| `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | 0 | 453 tests, 453 pass, 0 fail |
| `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` | 0 | none |
| `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` | 0 | none |
| `git ls-files '*.sh' \| xargs pnpm dlx shellcheck` | 0 | none |

The baseline is green, so no findings overlap this delivery and the **full gate**
applies: every command above must stay at exit 0 with no new findings, plus `cd
extension && npm run test:unit` after `npm run copy-cli`. (`shellcheck` is not
installed locally; `pnpm dlx shellcheck` is the documented substitute, as in
`preflight-call`.)

### Measurement baseline (Q5)

The initiative's Definition of done requires "a reference `/agento ap` run takes
measurably fewer tool calls than the baseline recorded by `builder-step-cli`".
The chat debug logs live under
`~/.config/Code/User/workspaceStorage/<id>/GitHub.copilot-chat/debug-logs/<session>/main.jsonl`.
The Builder records, in a `## Measurement` section of this plan:

- **Before:** tool calls per ticked roadmap step from a past build's debug log
  (the `preflight-call` build, or the first build log found) and from this
  delivery's own steps built before the Builder rewiring lands (steps 1.1–3.4).
- **After:** the same count for this delivery's steps built after the rewiring
  (steps 5.1–5.3), which run in a fresh Builder invocation after the 4.4 session
  break so the rewired agent file is loaded.
- The method: count tool-call records between consecutive step commits; report
  min / median / max per step and the per-step reduction. When no past debug log is
  readable, the in-delivery before/after pair alone is the record.

### Open deliveries

`gh pr list --state open` returned `[]` in both repositories, so there is no
concurrent file overlap today. The wave-2 sibling `publish-cli` (unplanned,
recommended after this member) will touch the same `scripts/agento.mjs`,
`docs/commands.md`, `CHANGELOG.md`, `extension/cli/`, and agent files.

## Approach

1. **Lift ship's helpers to module level.** Move the fetch (`fetch-auth` with
   `reauth`), `integrate` (merge `--no-edit`, conflict → collect `git diff
   --name-only --diff-filter=U`, `merge --abort`, `integration-conflict` with
   `conflicts[]`), and `push` (`-u` when no upstream; `push-auth` / `push-failed`)
   closures out of `ship()` into result-returning helpers (no `emit` inside), and
   make `ship()` call them. Behaviour of `ship` is unchanged; its tests are the
   regression net.
2. **Shared delivery-window check.** A `buildWindow(type, slug)` helper:
   `sessionRecord()` + `windowVerdict({ command: "build-<type>", slug })`; requires
   `worktree.branch` equal to the roadmap's `branch:` (never the default branch,
   never detached) and, in companion mode, `companion.branch` equal to it too. It
   rejects with the §11 `wrong window` reason and the record's
   `allowed`/`elsewhere`.
3. **`agento.mjs sync <type> <slug>`.** Window check; reject when either half has
   tracked uncommitted changes (`dirty`, with files); fetch both clones; per half,
   merge `origin/<branch>` when it exists and is not an ancestor of `HEAD`, then
   `origin/<default>` when not an ancestor (never rebase); a conflict aborts and
   rejects `integration-conflict` with `half`, `ref`, and `conflicts[]`, nothing
   pushed; push each half that is now ahead of its upstream (product first). Output
   `{ status, phase, type, slug, branch, mode, halves: { product, companion: {
   path, head, merged: [refs], pushed } | null }, merged: bool, conflicts, actions,
   reason, message, reauth, next, warnings }`; `merged: true` tells the Builder to
   re-verify. Exit 0 ok, 3 rejected/failed.
4. **`agento.mjs step-commit <type> <slug> [--step N.M] --message-file <f|->`.**
   - Window check as above. The message comes from a file outside both halves or
     `-` (stdin); its first line must be a Conventional Commit
     (`^[a-z]+(\([^)]+\))?!?: \S`); with `--step`, it must name `N.M`. The same
     message is used for both commits of the two-commit rule.
   - Staging (Q1): product half `git add -A`; companion mode `git -C <half> add -A
     -- <slug artifact dir>`; any change in the companion half outside that
     directory → reject `companion-outside-slug` with the paths, nothing committed.
   - Roadmap rule (Q2): with `--step N.M`, the artifact checkout's roadmap.md must
     carry `- [x] N.M` and differ from `HEAD` on that line (ticked in this commit);
     without `--step`, roadmap.md must differ from `HEAD`. Else reject
     `step-not-ticked` / `roadmap-not-updated`. In-repo, the roadmap is staged in
     the one commit; companion mode, a product change with no roadmap change is
     rejected the same way.
   - Commits: product commit (when the product has changes), then the companion
     commit (companion mode); a no-code step is one companion commit. Plain `git
     commit -F` — hooks run, never `--no-verify`, never `--amend`; on the default
     branch or detached → reject before anything is written.
   - Integrate: fetch; merge `origin/<branch>` when not an ancestor; merge
     `origin/<default>` when not an ancestor. If a default merge brought commits in,
     stop with `status: "reverify"` (exit 2), nothing pushed: the Builder reruns the
     step's `verify:` and re-sends; the re-send finds nothing to commit, the
     defaults already integrated, and pushes. A conflict aborts, rejects
     `integration-conflict` with `conflicts[]`, nothing pushed (Q4).
   - Push: product first, then companion (`-u origin <branch>` when no upstream).
   - Draft PRs when missing: `gh pr view <branch>`; none → `gh pr create --draft
     --base <default>` titled after the slug (issues: body starts `Fixes #<n>` from
     the roadmap header); companion mode also the draft `docs(<type>): <slug>`
     companion PR from inside the half, the idempotent cross-link PATCH, and — when
     the roadmap header has no `artifact-pr:` — the header commit `docs(<type>):
     record artifact PR for <slug>` and its push.
   - Final check: both halves `git status --porcelain --untracked-files=all` empty
     and `ahead: 0`, else `failed` / `not-clean` with the paths.
   - Idempotent re-send: nothing to stage and nothing ahead → `outcome:
     "already-pushed"`, exit 0; nothing to stage but ahead → resumes at integrate.
   - Output `{ status: ok | reverify | rejected | failed | usage-error, phase,
     outcome, type, slug, branch, mode, step, commits: { product, companion },
     integrated[], pushed[], pr, companionPr, conflicts[], actions[], reason,
     message, fix, reauth, next[], warnings[] }`; exit 0 ok, 2 reverify, 3
     rejected/failed, 1 usage.
5. **Rewire the Builder** (`.github/agents/delivery-builder.agent.md`, Q3): resume
   step 1 → one `sync` call (merged → re-verify ticked steps' spot checks as part of
   the audit); resume step 4, work-loop steps 4–5, both pause kinds, and
   completion's commit/push → one `step-commit` call each (with `--step N.M` for a
   ticked step, without it otherwise); completion's integration check → `sync`
   then re-verify when `merged: true`. Commit messages go through `--message-file
   -` (stdin) so no message file lands in a worktree. Conflicts: re-send after
   resolving per the hotspot recipes — the one sanctioned hand-run git, named
   explicitly. Keep the session-break / pause phrases the customizations test
   asserts. Update the "Before every push" bullet in
   `concurrent-delivery.instructions.md` to name the CLI calls; policy §7 rules
   stay word for word.
6. **Tests.**
   - `scripts/agento.test.mjs`: a `sync` group and a `step-commit` group over
     `makeRepo({ companion: true })` and in-repo repos with a fake `gh` (see the
     roadmap for the cases), including guard-equivalence cases mirroring
     `tests/guard-fixtures*.txt` (default-branch commit, missing roadmap update),
     and the usage header lines.
   - `tests/customizations.test.mjs`: "the Builder commits through one
     `agento.mjs step-commit` call and integrates through `agento.mjs sync`, with no
     hand-run fallback" (no `git push`, `git -C <companion.path> commit`,
     `merge-base --is-ancestor`, or `gh pr create` in the Builder body); "only the
     Builder agent references `agento.mjs step-commit` and `agento.mjs sync`" among
     prompts, agents, and commands.
7. **Docs and copy.** Usage header lines, `docs/commands.md` CLI listing,
   `docs/architecture.md` scripts bullet, AGENTS.md `scripts/` subcommand list,
   `CHANGELOG.md` entry; regenerate `extension/cli/` with `cd extension && npm run
   copy-cli`.

The full gate (§5) applies: the baseline is recorded above and every command must
end at the same or better result.

## Risks

- **CLI-side commits and pushes bypass the delivery guard.** *Mitigation:* the CLI
  enforces the guard's rules in process (no default-branch or detached commit, no
  force, no rebase, no `--no-verify`/`--amend`, roadmap in the commit as a hard
  reject), with tests mirroring the guard fixtures, and a customizations test
  restricts callers to the Builder.
- **`git add -A` could commit byproducts** (stray test output, screenshots outside
  `evidence/`). *Mitigation:* policy §7's clean handoff still requires deleting
  byproducts before the commit; the companion half is scoped to the slug directory
  and rejects anything else; the step-commit result lists every committed path in
  `actions[]` so the Builder and Reviewer see them.
- **Fewer, larger tool calls hide intermediate failures.** *Mitigation:* the
  ship-style JSON contract — `status`, `phase`, `actions[]`, `conflicts[]`,
  `reason`/`message`, `reauth` on auth failures, exit 2 for `reverify`, exit 3 for
  rejected/failed — and every re-send resumes from git and GitHub state, never a
  journal.
- **Pushing before re-verification after main advanced.** *Mitigation:* the
  `reverify` stop (exit 2) keeps the policy order — merge, re-verify, push.
- **Measurement needs a fresh Builder invocation.** The rewired agent file is only
  loaded by a new chat or subagent. *Mitigation:* phase 5 starts with a session
  break (`status: in-progress`, next-step 5.1), which `/agento build-feature` or
  `/agento ap` resumes with the new agent body; no manual or post-ship step.
- **Refactoring ship's closures could regress ship.** *Mitigation:* step 1.1 lifts
  them with no behaviour change, gated by the existing ship tests before any new
  subcommand lands.
- **Concurrent delivery.** No PRs are open today; `publish-cli` (wave 2) will
  touch the same files. Integrate `origin/main` by merge before every push (§7);
  regenerate `extension/cli/` after any merge that touched `scripts/`.

## Out of scope

- `plan-publish`, `review-publish`, and `publish-pr` (the `publish-cli` member);
  the Planner, Reviewer, and freehand/quick-fix flows keep their hand-run steps.
- Any change to the delivery rules themselves (§7 wording, guard verdicts, the
  §9 receipt spellings, window roles).
- Guard changes: the guard keeps judging shell text; it gains no `agento.mjs` rule.
- Extension changes beyond regenerating `extension/cli/`.
- Trimming prompt or agent prose beyond what the moved choreography requires.

## Measurement

Recorded 2026-10-12 by the rewired Builder (step 5.2).

**Source.** The named chat debug logs (`debug-logs/<session>/main.jsonl`) carry no
tool-call records: all ~400 on this machine hold only `session_start` lines (every
file ≤ 1.9 KB, this session's is 264 bytes). The counts below come from the
per-session transcript `GitHub.copilot-chat/transcripts/<session>.jsonl`, whose
`tool.execution_start` records include subagent calls. Method: tool calls between
consecutive step commits (the commit call ends its segment); a commit that ticks
several steps splits its segment evenly. "Choreography" counts calls whose command
is `git commit|fetch|merge|push`, `gh pr`, or `agento.mjs sync|step-commit|session`.

**Before (hand-run git).**

| Run | Per-step tool calls | min / median / max | mean |
| --- | --- | --- | --- |
| `policy-on-demand` build (transcript `15becd30…`, steps 1.1–4.3, 5.1) | 14, 14, 13, 8, 7, 9, 9, 8, 33, 53, 5, 5 | 5 / 9 / 53 | 14.8 |
| This delivery, steps 1.1–4.4 (transcript `1b796133…` calls 112–231) | 1.1: 49; 1.2–3.4: 63 calls over 7 steps (one batched commit) = 9.0 each; 4.1–4.2: 2 calls over 2 steps = 1.0 each; 4.3: 2; 4.4: 4 | 1 / 9 / 49 | 10.0 |

Resume protocol: 8 calls. Choreography: 1 call per step commit in
`policy-on-demand` (one chained shell line), 8 calls over 5 commits (1.6) here.

**After (`agento.mjs sync` + `step-commit`, calls 234 onward).**

| Step | Tool calls | Notes |
| --- | --- | --- |
| 5.1 | 3 | roadmap edit, `step-commit`, read its output |
| 5.3 | 9 | 4 gate runs, 3 terminal polls, 1 call denied by the guard (redirect next to `scripts/hooks/`), 1 `step-commit` |
| 5.2 | 34 | 27 discovering that the debug logs are empty and finding the transcripts, 7 to segment, write, and commit (one a read retry; through this step's commit call) |

min / median / max: 3 / 9 / 34; mean 15.3. Resume protocol: 8 calls (one `sync`),
plus 6 for the audit test run. Choreography: 1 call per step commit (1.0).

**Per-step reduction.** Median 9 → 9: **no reduction**. The after median is not
lower than the before median, so step 5.2's `verify:` is not met and the step
stays unticked. Choreography per commit fell from 1.6 to 1.0 against this
delivery's own before, and is level (1.0 → 1.0) against `policy-on-demand`: both
hand-run Builders already chained commit, fetch, merge, and push into one
terminal call per step, so the breakdown's 8–12 calls per step did not occur in
practice. Per-step totals are dominated by implementation and research and by
terminal-capture retries (sync terminals returning no output), which this feature
does not touch. What `step-commit` adds is the guard-equivalent checks, the
`reverify` stop, draft-PR creation, and the clean-handoff check inside the one call.
The after sample is three steps with no code changes, so it is not like-for-like.

**Initiative claim unproven (2026-10-12).** The spend-reduction initiative's
claim that this member reduces tool calls per step is **unproven at the median**:
this measurement shows no median reduction (9 → 9). Per the user's follow-up
decision in `## Decisions`, step 5.2's `verify:` was amended to "measurement
recorded" and the delivery is accepted for the safety and correctness of step
commits, not for a per-step call reduction. The initiative's Definition of done
("a reference `/agento ap` run takes measurably fewer tool calls than the baseline
recorded by `builder-step-cli`") stays open and needs its own evidence.

## Acceptance checklist

- [ ] `node scripts/agento.mjs sync <type> <slug>` fetches both halves, merges
  `origin/<branch>` and `origin/<default>` when they are not ancestors (never
  rebase), pushes halves left ahead (product first), aborts a conflicting merge
  with `integration-conflict` and the conflicted files (nothing pushed), and rejects
  outside the slug's build window — covered by `scripts/agento.test.mjs`.
- [ ] `node scripts/agento.mjs step-commit <type> <slug> [--step N.M]
  --message-file <f|->` performs the two-commit rule (product code commit, then the
  companion commit scoped to the slug directory; a no-code step is one companion
  commit), integrates both defaults, stops with `reverify` (exit 2) when a default
  merge brought commits in, pushes product before companion, opens missing draft
  PRs (and the companion PR, cross-link, and `artifact-pr:` header), and ends with
  both halves clean and `ahead: 0` — covered by `scripts/agento.test.mjs` in both
  layouts.
- [ ] `step-commit` rejects, writing nothing: the default branch or a detached
  HEAD, a window other than the slug's build window, a non-Conventional message,
  `--step N.M` not ticked in roadmap.md, no roadmap.md change without `--step`,
  companion changes outside the slug directory, and a message file inside a
  half; it never uses `--no-verify`, `--amend`, `--force`, or rebase — covered by
  guard-equivalence tests.
- [ ] A re-send of `sync` or `step-commit` resumes from git state (nothing to do →
  `already-pushed`; unpushed commits → integrate and push) — covered by tests.
- [ ] `ship` behaviour is unchanged after its fetch/integrate/push helpers are
  shared — the existing ship tests pass unmodified.
- [ ] The Builder agent integrates through one `agento.mjs sync` call and commits
  every step, roadmap repair, pause, session break, and completion through one
  `agento.mjs step-commit` call, with no hand-run push/commit/merge-base fallback;
  only the Builder references the two subcommands — enforced by
  `tests/customizations.test.mjs`.
- [ ] `## Measurement` in this plan records before/after tool calls per roadmap
  step (amended 2026-10-12 per the follow-up decision in `## Decisions`: the
  measurement is recorded; a reduction is no longer required — it was not shown at
  the median).
- [ ] Docs (`docs/commands.md`, `docs/architecture.md`, AGENTS.md, the usage
  header, `concurrent-delivery.instructions.md`) and `CHANGELOG.md` describe the
  subcommands; `extension/cli/` is regenerated and `cd extension && npm run
  test:unit` passes.
- [ ] Full gate against the recorded baseline: `node --test
  'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`, both replay-guard runs, and
  `git ls-files '*.sh' | xargs pnpm dlx shellcheck` end at the baseline result or
  better with no new findings.
