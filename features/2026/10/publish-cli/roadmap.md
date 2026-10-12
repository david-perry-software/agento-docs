```yaml
status: paused
branch: feature/publish-cli
last-updated: 2026-10-12
next-step: "6.2 (manual) Before reference run: reconcile the plugin clone's custom model pins, then run /agento quick-fix in another repository and share the debug log path and a screenshot"
artifact-pr: "#49"
initiative: "spend-reduction"
```

## Phase 1: Shared helpers (no behaviour change)

- [x] 1.1 Lift `ship`'s `waitForChecks` closure in `scripts/agento.mjs` into a
  module-level helper `waitForChecks(kind, target, cwd, { repo, maxSeconds })`
  (bounded by the caller's budget, `GH_PROMPT_DISABLED=1`, returns `{ code, last }`),
  and make `ship()` call it — verify: `node --test scripts/agento.test.mjs` passes
  with no ship test modified (`git diff origin/main -- scripts/agento.test.mjs` is
  empty)

- [x] 1.2 Extract `stepCommit`'s PR phase (draft code PR with `Fixes #<n>`, companion
  draft PR, idempotent REST PATCH cross-link, `artifact-pr:` header commit + push)
  into `ensureDeliveryPrs(run, win, { type, slug, commit, messageDir })` and call
  it from `stepCommit` — verify: `node --test scripts/agento.test.mjs` passes with
  no step-commit test modified

- [x] 1.3 Give `integrateHalves` an option restricting the `origin/<default>` merge to
  named halves (default: all, as today) — verify: `node --test
  scripts/agento.test.mjs` passes with no sync/step-commit test modified

## Phase 2: `agento.mjs plan-publish`

- [x] 2.1 Add `plan-publish <type> <slug>` per plan.md Approach 2:
  - window check via `windowVerdict({ command: "new-<type>", slug })`, with both
    halves on the roadmap branch, never default and never detached;
  - plan.md and roadmap.md present; reject `outside-slug` changes;
  - slug-dir commit (`docs(delivery): plan <slug>` in-repo,
    `docs(<type>): plan <slug>` companion, `docs(<type>): revise plan <slug>` on
    later edits);
  - companion empty `chore(<type>): open <slug>` product commit only when the
    product branch has none;
  - `integrateHalves` + `pushHalves`, then `ensureDeliveryPrs`, then the
    clean-handoff check; never ready or merge;
  - a usage header line and dispatch.

  — verify: `node scripts/agento.mjs plan-publish feature nope` from the primary
  checkout exits 3 with the §11 wrong-window reason; `node scripts/agento.mjs
  plan-publish` exits 1 (usage)

- [x] 2.2 Add the `plan-publish` test group to `scripts/agento.test.mjs` (in-repo and
  companion via `makePairRepo` / `planPair`, `shipStub` as gh). It covers:
  - a fresh publish: commits, both draft PRs, cross-link, `artifact-pr:` header;
  - an issue body that starts with `Fixes #<n>`;
  - a re-send that creates no second commit, PR, or cross-link;
  - a revise commit after an artifact edit;
  - rejections for wrong window, detached, default branch, outside-slug changes,
    and missing plan.md;
  - the stub failing on any `pr ready` or `pr merge` call.

  — verify: `node --test scripts/agento.test.mjs` passes, including the new group

- [x] 2.3 Rewire the Planner publish:
  - replace `.github/agents/delivery-planner.agent.md` step 8,
    `.github/prompts/new-feature.prompt.md` step 5, and the matching
    `new-issue.prompt.md` step with one
    `node <agento-root>/scripts/agento.mjs plan-publish <type> <slug>` call and a
    thin formatter over its JSON;
  - re-copy `commands/new-feature.md` and `commands/new-issue.md`;
  - add a "Planner publishes through one `agento.mjs plan-publish` call" test and an
    "only the Planner files reference `agento.mjs plan-publish`" test to
    `tests/customizations.test.mjs`.

  — verify: `node --test tests/customizations.test.mjs` passes, and `cmp
  commands/new-feature.md .github/prompts/new-feature.prompt.md` exits 0 (same for
  new-issue)

## Phase 3: `agento.mjs review-publish`

- [x] 3.1 Add `review-publish <type> <slug> [--body-file <file|->]` per plan.md
  Approach 3:
  - `buildWindow`; review.md with `# Review: <slug>` and exactly one `Verdict:` line;
    slug-dir-only changes (product half clean in companion mode);
  - commit `docs(<type>): review <slug> — <verdict>`;
  - integrate `origin/<branch>` everywhere and `origin/<default>` in the companion
    half only;
  - push; reject `pr-missing`;
  - upsert one marked verdict comment on the code PR through REST list + PATCH/POST,
    carrying the review.md blob link;
  - clean-handoff check; a usage line and dispatch.

  — verify: `node scripts/agento.mjs review-publish feature nope` from the primary
  checkout exits 3 with the wrong-window reason

- [x] 3.2 Add the `review-publish` test group (in-repo and companion). It covers:
  - a first publish posting one comment, and a re-review PATCHing that same comment
    (the stub's comment list holds exactly one marked comment after two sends);
  - a companion default merged while the in-repo product half is not merged with
    `main`;
  - a missing or duplicated `Verdict:` line, outside-slug changes, and `pr-missing`.

  — verify: `node --test scripts/agento.test.mjs` passes, including the new group

- [x] 3.3 Rewire the Reviewer publish:
  - replace `.github/agents/delivery-reviewer.agent.md` step 8 and the publish steps
    of `review-feature.prompt.md` / `review-issue.prompt.md` with one
    `node <agento-root>/scripts/agento.mjs review-publish <type> <slug>` call;
  - re-copy the `commands/` mirrors;
  - add the "one call" and "only the Reviewer files reference `agento.mjs
    review-publish`" tests.

  — verify: `node --test tests/customizations.test.mjs` passes; `cmp` of both
  mirrors exits 0

## Phase 4: `agento.mjs publish-pr`

- [x] 4.1 Add `publish-pr [--dir <path>] [--branch <name>] [--title <text>]
  [--body-file <file|->] [--merge] [--wait N]`, covering the push and pr phases per
  plan.md Approach 4:
  - `--dir` must be a checkout of the product or companion repository (`unknown-repo`
    otherwise);
  - refuse the default branch, a detached HEAD, and the configured feature, issue,
    and post-ship prefixes;
  - reject `dirty`, `nothing-to-publish`, and a `--body-file` inside the checkout;
  - fetch, full-refspec push (`-u` first time, never forced);
  - reuse or create a non-draft PR; without `--merge`, stop with `outcome: opened`;
  - a usage line and dispatch.

  — verify: `node scripts/agento.mjs publish-pr` on `main` in the primary checkout
  exits 3 with reason `default-branch`, and in this worktree on `feature/publish-cli`
  exits 3 with the delivery-prefix refusal

- [x] 4.2 Add the checks, merge, delete-branch, and sync phases:
  - a `BEHIND` PR merges `origin/<default>` (conflict → abort, reject
    `integration-conflict` with the files), pushes, and keeps waiting;
  - wait with `waitForChecks` bounded by `--wait` (≤ 60, default 50; `--repo` for a
    companion checkout); exit 2 `pending` with the identical re-send in `next[]`;
    `blocked` / `checks-failed` on a failing check;
  - `gh pr merge <n> --merge`, then `git push origin --delete`;
  - sync: switch, fast-forward, and `branch -d` in a primary checkout or companion
    clone; a linked worktree is left on its branch with the close-session handoff;
  - resume from a merged PR via the current branch or `--branch`; `reauth` on auth
    failures.

  — verify: `node --test scripts/agento.test.mjs` passes, including 4.3's group

- [x] 4.3 Add the `publish-pr` test group (product checkout, companion clone via
  `--dir`, and a linked worktree). It covers:
  - each refusal and rejection, writing nothing;
  - opened-only without `--merge`;
  - pending (exit 2), then a re-send that merges;
  - a failing check that is blocked with nothing merged;
  - a `BEHIND` integration, and an integration conflict;
  - the merge argument list never containing `--admin`, `--squash`, `--rebase`, or
    `--auto` (the stub rejects them);
  - a deleted remote branch, a synced default, and a deleted local branch;
  - linked-worktree sync skipped with the close-session handoff;
  - a `--branch` resume after the merge;
  - `push-auth` / `gh-auth` carrying `reauth`.

  — verify: `node --test scripts/agento.test.mjs` passes

- [x] 4.4 Rewire `commit-current-changes.prompt.md` (steps 8–10),
  `quick-fix.prompt.md` (steps 7–9), and `finish-freehand.prompt.md` (steps 7–9):
  - after the prompt's own commit, one `node <agento-root>/scripts/agento.mjs
    publish-pr --title … --body-file - --merge` call, re-sent on exit 2, stopping on
    exit 3 with `message` / `reauth`;
  - finish-freehand reports the returned close-session handoff;
  - re-copy the `commands/` mirrors;
  - add "one call, no hand-run fallback" tests (no `gh pr create`, `gh pr merge`,
    `wait-for-checks.sh`, or `git push` in the bodies).

  — verify: `node --test tests/customizations.test.mjs` passes; `cmp` of the three
  mirrors exits 0

- [x] 4.5 Rewire `initiative-architect.agent.md` step 8 + `new-initiative.prompt.md`
  and `triage-followups.prompt.md` step 5:
  - one `publish-pr --merge` call, with `--dir <artifactsRoot>` in companion mode,
    replacing the `git -C` / `--repo` prose;
  - re-copy the mirrors;
  - add the "one call" tests and an "only the five flows' prompts, their mirrors, and
    the Architect reference `agento.mjs publish-pr`" restriction test.

  — verify: `node --test tests/customizations.test.mjs` passes; `cmp` of the
  mirrors exits 0

## Phase 5: Docs, generated copy, full gate

- [x] 5.1 Document the three subcommands:
  - `docs/commands.md`: the CLI reference next to `step-commit`, plus the rewired
    commands' descriptions;
  - `docs/architecture.md`, next to the `step-commit` paragraph;
  - `CHANGELOG.md` `## Unreleased`: **Added**, including the two behaviour notes
    from plan.md Risks;
  - the delivery-policy §6 bounded-wait bullet names `publish-pr`.

  — verify: `node --test tests/customizations.test.mjs` passes, and `grep -c
  'publish-pr\|plan-publish\|review-publish' docs/commands.md docs/architecture.md
  CHANGELOG.md` is non-zero for each file

- [x] 5.2 Regenerate the extension copy: `cd extension && npm ci && npm run copy-cli
  && npm run test:unit` — verify: exit 0, and `diff -q scripts/agento.mjs
  extension/cli/agento.mjs` reports no difference

- [x] 5.3 Run the full gate and compare it with the plan.md baseline — verify, all
  exit 0:
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`;
  - `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` (the v0.10.0 release
    binary if it is not installed), with no findings;
  - `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` and the companion
    replay.

  The test count is ≥ 465 plus the new tests; record the results in this step's
  commit message.

## Phase 6: Measurement

- [x] 6.1 Add the "after" static table to plan.md `## Research` → Measurement: hand-run
  git/gh calls per publish for every flow, both layouts, read from the rewired files
  — verify: the table exists, and every row reads 1 call per send (+ re-sends on
  exit 2)

- [ ] 6.2 (manual) Before reference run.
  - **Builder first:** fast-forward the plugin clone with `git -C
    /home/david/DP/agento-plugin merge --ff-only origin/main` after a fetch, and
    confirm it is clean.
  - **User:** in a VS Code window on a repository other than agento that loads the
    plugin, run `/agento quick-fix <a small real change you want anyway>` to
    completion. Then share the chat debug log path (`…/GitHub.copilot-chat/debug-logs/<id>/main.jsonl`)
    and a screenshot of the final result line.

  — verify: `evidence/step-6-2-quick-fix-before.png` is linked; the Builder counts
  the tool calls (publish phase from push to report, and total) from the log and
  records them with the log path in plan.md Measurement

  - Note (2026-10-12): the Builder-first fast-forward is blocked. `/home/david/DP/agento-plugin`
    is 17 commits behind `origin/main`, and `git merge --ff-only origin/main` aborts
    because 56 prompt, agent, and command files carry model pins under
    skip-worktree (`agento.mjs models list` reports `active: "custom"`, not a named
    profile). Clearing them would discard the user's pins, so the Builder left the
    clone untouched; the user decides how to reconcile them before the run.

- [ ] 6.3 (manual) After reference run.
  - **Builder first:** `git -C /home/david/DP/agento-plugin switch --detach
    origin/feature/publish-cli` after a fetch.
  - **User:** in the same kind of window, run `/agento quick-fix <another small real
    change>` to completion, then share the debug log path and a screenshot of the
    result line.
  - **Builder after:** restore the clone with `git -C /home/david/DP/agento-plugin
    switch main` and record the counts next to 6.2's.

  — verify: `evidence/step-6-3-quick-fix-after.png` is linked;
  `git -C /home/david/DP/agento-plugin status -sb` shows `main` with no changes; the
  publish-phase count is lower than 6.2's

- [ ] 6.4 Final integration: `agento.mjs sync feature publish-cli`, re-run 5.3's gate
  if anything merged, and set `status: in-review` — verify: `sync` reports
  `up-to-date` or `pushed`, `git status --porcelain --untracked-files=all` is empty
  in both halves, and `agento.mjs session` shows `companion.dirty: false` and
  `ahead: 0`
