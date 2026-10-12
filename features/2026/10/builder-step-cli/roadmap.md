```yaml
status: in-review
branch: feature/builder-step-cli
last-updated: 2026-10-12
next-step: "re-review after 5.5–5.6 (ship checks-failed fix): /agento review-feature builder-step-cli"
artifact-pr: "#48"
initiative: "spend-reduction"
```

## Phase 1: Shared helpers

- [x] 1.1 Lift ship's fetch (`fetch-auth` + `reauth`), `integrate` (merge
  `--no-edit`; conflict → collect `git diff --name-only --diff-filter=U`, `merge
  --abort`, `integration-conflict` with `conflicts[]`), and `push` (`-u` when no
  upstream; `push-auth` / `push-failed`) closures out of `ship()` in
  `scripts/agento.mjs` into result-returning module-level helpers, and make `ship()`
  call them with no behaviour change — verify: `node --test scripts/agento.test.mjs`
  passes with the ship tests unmodified (`git diff --stat origin/main --
  scripts/agento.test.mjs` shows no change)

- [x] 1.2 Add a `buildWindow(type, slug)` helper: `sessionRecord()` +
  `windowVerdict({ command: "build-<type>", slug })`, requiring `worktree.branch`
  equal to the roadmap `branch:` (never the default branch, never detached) and, in
  companion mode, `companion.branch` equal to it — verify: covered by the 2.2 and
  3.3 rejection tests; `node --test scripts/agento.test.mjs` passes

## Phase 2: `agento.mjs sync`

- [x] 2.1 Add `sync <type> <slug>`: window check; reject `dirty` when either half
  has tracked uncommitted changes; fetch both clones; per half merge
  `origin/<branch>` then `origin/<default>` when not ancestors (never rebase);
  conflict → abort, reject `integration-conflict` with `half`, `ref`,
  `conflicts[]`, nothing pushed; push halves left ahead, product first; output per
  plan.md Approach 3 (`merged` flag); usage header line — verify: `node
  scripts/agento.mjs sync feature nope` from the primary checkout exits 3 with the
  §11 wrong-window reason, and `node scripts/agento.mjs sync` is a usage error
  (exit 1)

- [x] 2.2 Add the `sync` test group to `scripts/agento.test.mjs` (in-repo and
  companion): merges an advanced `origin/main` into both halves and pushes;
  merges a remote-ahead `origin/<branch>`; already-integrated re-send is a no-op
  `ok`; a conflicting default aborts with the conflicted files and a clean tree,
  nothing pushed; rejects from the primary, from a plan window, and with a dirty
  half; never rebases (history shows a merge commit) — verify: `node --test
  scripts/agento.test.mjs` passes

## Phase 3: `agento.mjs step-commit`

- [x] 3.1 Add `step-commit <type> <slug> [--step N.M] --message-file <f|->`:
  argument parsing (`--step`, `--message-file`, stdin `-`), message validation
  (Conventional Commit first line; names `N.M` with `--step`; file outside both
  halves), staging (product `add -A`; companion `add -A -- <slug dir>`, reject
  `companion-outside-slug`), the roadmap rule (`step-not-ticked` /
  `roadmap-not-updated`), and the commits (product then companion; no-code step →
  one companion commit; plain `git commit -F`, never `--no-verify`/`--amend`;
  default branch or detached → reject before any write); usage header line —
  verify: `node scripts/agento.mjs step-commit feature nope --message-file -
  </dev/null` from the primary checkout exits 3 with the wrong-window reason, and a
  missing `--message-file` is a usage error (exit 1)

- [x] 3.2 Add integration and push to `step-commit`: fetch; merge
  `origin/<branch>` and `origin/<default>` when not ancestors; a default merge that
  brought commits → `status: "reverify"`, exit 2, nothing pushed; conflict → abort,
  `integration-conflict`, nothing pushed; push product then companion (`-u` on the
  first push); final check both halves clean and `ahead: 0` (`not-clean` otherwise);
  idempotent re-send (`already-pushed`, or resume at integrate when ahead) —
  verify: `node --test scripts/agento.test.mjs` passes the 3.4 cases for this
  step

- [x] 3.3 Add draft-PR creation to `step-commit`: `gh pr view <branch>`; none →
  `gh pr create --draft --base <default>` titled after the slug (issues: body starts
  `Fixes #<n>`); companion mode the draft `docs(<type>): <slug>` companion PR from
  inside the half, the idempotent cross-link PATCH, and the `artifact-pr:` header
  commit + push when the header lacks it; `gh` auth failure → `failed` / `gh-auth`
  with `reauth: "gh auth login"` — verify: `node --test scripts/agento.test.mjs`
  passes the fake-`gh` PR cases of 3.4

- [x] 3.4 Add the `step-commit` test group to `scripts/agento.test.mjs` (in-repo
  and companion, fake `gh` via `restrictedPath`): two-commit order (product commit
  and push precede the companion's); no-code step is one companion commit; in-repo
  single commit includes roadmap.md; `reverify` exit 2 then re-send pushes;
  conflict aborts with files; `already-pushed` re-send; missing PRs created once
  (second call creates none); `artifact-pr:` header written once; and the
  guard-equivalence rejections mirroring `tests/guard-fixtures*.txt` — default
  branch, detached HEAD, wrong window, unticked `--step`, no roadmap change,
  companion change outside the slug dir, non-Conventional message, message file
  inside a half — each leaving both halves unchanged — verify: `node --test
  scripts/agento.test.mjs` passes

- [x] 3.5 Close the staged-rename escape in `step-commit`'s companion scope check
  (review Finding 1): reject when any rename/copy origin or staged path in the
  companion half lies outside the slug directory, and assert the index holds only
  slug-dir paths (`git diff --cached --name-only --no-renames`) right before the
  companion commit (added 2026-10-12) — verify: a new guard-equivalence case (a
  staged `git mv <outside> <slugDir>/x` in the half) rejects
  `companion-outside-slug` listing the origin path and leaves both halves
  unchanged; `node --test scripts/agento.test.mjs` passes — done 2026-10-12: the
  pre-check adds `git diff --cached --name-only --no-renames -z`, the companion
  commit re-asserts the staged set right before committing and commits with a
  `-- <pathspec>`; the new case rejects listing `features/2026/10/other/plan.md`
  and the accepted commit leaves it untouched; step-commit tests 6/6 pass

- [x] 3.6 Push with an explicit `refs/heads/<branch>:refs/heads/<branch>` refspec
  in `sync`/`step-commit` so a `+`-prefixed branch can never force-push, and test
  the `default-branch` and `branch-mismatch` rejections directly (companion half
  switched to `main` / another branch) (review Findings 2, 3; added 2026-10-12) —
  verify: `node --test scripts/agento.test.mjs` passes with the new cases; ship's
  tests unmodified — done 2026-10-12 (committed with 3.5, same files):
  `pushHalves` pushes `refs/heads/<b>:refs/heads/<b>` (asserted through a
  git-logging PATH in the gh-auth test); `default-branch` (companion half on
  `main` holding the roadmap) and `branch-mismatch` (half on `feature/elsewhere`)
  rejections tested; ship's `pushRef` callers and tests unchanged

## Phase 4: Builder rewiring, docs, copy

- [x] 4.1 Rewrite `.github/agents/delivery-builder.agent.md`: resume step 1 → one
  `agento.mjs sync <type> <slug>` call; resume step 4, work-loop steps 4–5, both
  pause kinds, and completion's commit → one `agento.mjs step-commit` call each
  (`--step N.M` for a ticked step, `--message-file -` via stdin); completion's
  integration → `sync`, re-verify on `merged: true`; `reverify` and
  `integration-conflict` handling named (hand-run merge only to resolve a reported
  conflict, then re-send); keep the session-break / pause phrases and the §12
  blocks; update the "Before every push" bullet in
  `.github/instructions/concurrent-delivery.instructions.md` to name the CLI
  calls — verify: `node --test tests/customizations.test.mjs` passes

- [x] 4.2 Add customizations tests: "the Builder integrates through one
  `agento.mjs sync` call and commits through one `agento.mjs step-commit` call
  with no hand-run fallback" (Builder body has no `git push`, `git -C
  <companion.path> commit`, `merge-base --is-ancestor`, or `gh pr create`); "only
  the Builder agent references `agento.mjs step-commit` and `agento.mjs sync`"
  among prompts, agents, and commands — verify: `node --test
  tests/customizations.test.mjs` passes, and fails when a `git push` line is
  temporarily added to the Builder body (revert after checking)

- [x] 4.3 Update `docs/commands.md` (CLI listing), `docs/architecture.md` (scripts
  bullet), AGENTS.md (`scripts/` subcommand list), and `CHANGELOG.md`; regenerate
  `extension/cli/` — verify: `cd extension && npm run copy-cli && npm run
  test:unit` passes, `git diff --quiet -- extension/cli` after a second `npm run
  copy-cli`, and the usage test in `scripts/agento.test.mjs` passes

- [x] 4.4 Session break so the rewired Builder is loaded: leave `status:
  in-progress`, `next-step` 5.1, commit and push (policy §3 session break) — verify:
  `node scripts/agento.mjs session` shows `delivery.status: in-progress`,
  `delivery.nextStep` naming 5.1, `companion.dirty: false`, `companion.ahead: 0`;
  phase 5 runs in a fresh `/agento build-feature builder-step-cli` or `/agento ap
  builder-step-cli` invocation

- [x] 4.5 Correct the CHANGELOG entry (review Finding 4): drop the "instead of 8–12
  git and gh calls per step" claim in line with plan.md `## Measurement`, and note
  ship's additive `conflicts[]` field on `integration-conflict` (added 2026-10-12)
  — verify: `grep -n '8–12' CHANGELOG.md` finds nothing in the builder-step-cli
  entry and the entry names `conflicts[]`; regenerate `extension/cli/` if
  `scripts/` changed — done 2026-10-12: `grep -n '8–12' CHANGELOG.md` exit 1, the
  entry names ship's additive `conflicts[]` and the 3.5/3.6 hardening; no
  `scripts/` change in this step

## Phase 5: Measurement and full gate (run by the rewired Builder)

- [x] 5.1 Dogfood: commit this step and 5.2 through `agento.mjs step-commit` and
  begin with `agento.mjs sync` — verify: the step commits carry the step
  reference and `git log` shows they were pushed by the CLI call (the call's
  `actions[]` lists `commit` and `push` for each half that changed; amended
  2026-10-12: 5.1–5.3 change no code, so per the §7 two-commit rule each is one
  companion commit — the product half has nothing to commit or push). Resume
  began with one `sync` call (`outcome: up-to-date`, exit 0). 5.3 runs before
  5.2 so the measurement can include it.

- [x] 5.2 Record `## Measurement` in plan.md: tool calls per roadmap step from the
  chat debug logs (`~/.config/Code/User/workspaceStorage/*/GitHub.copilot-chat/debug-logs/*/main.jsonl`)
  — before: a past build log (preflight-call, if readable) and this delivery's
  steps 1.1–3.4; after: steps 5.1–5.3 — with min / median / max and the per-step
  reduction — verify: measurement recorded — the section exists with both sets of
  numbers (amended 2026-10-12 per the user's follow-up decision in plan.md
  `## Decisions`; was: "and the after median is lower than the before median") —
  2026-10-12: `## Measurement` recorded (source: session transcripts, the debug
  logs hold no tool calls); before median 9, after median 9 (5.2 itself took 34
  calls); the tool-call reduction is unproven at the median and is noted there;
  amended verify passed 2026-10-12 (section present with before 5 / 9 / 53 and
  1 / 9 / 49, after 3 / 9 / 34)

- [x] 5.3 Run the full repository gate and compare against the recorded baseline —
  verify: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` (453+ tests, 0
  fail), both replay-guard runs exit 0, `git ls-files '*.sh' | xargs pnpm dlx
  shellcheck` exits 0 with no new findings, `cd extension && npm run test:unit`
  passes — done 2026-10-12 at product `cf20e51`: node --test 465/465 pass (baseline
  453), replay-guard exit 0 in both modes, shellcheck exit 0 with no output,
  extension test:unit 167/167 pass; no new findings against the baseline

- [x] 5.4 Rerun the full gate after 3.5–4.5 (added 2026-10-12) — verify: the same
  commands as 5.3 exit 0 with no new findings against the baseline, `cd extension
  && npm run copy-cli && npm run test:unit` passes, and `git diff --quiet --
  extension/cli` after a second `copy-cli` — done 2026-10-12 at product `42bf27b`:
  node --test 465/465 pass, replay-guard exit 0 in both modes, shellcheck exit 0
  with no output, copy-cli + test:unit 167/167 pass, `git diff --quiet --
  extension/cli` exit 0 after a second copy-cli; final `sync` up-to-date

- [x] 5.5 Make the `ship --confirm (in-repo, owner)` fixture deterministic (ship
  reopened, checks-failed: PR #111 CI run 38267310550 failed this one test with
  `review-stale` because the fixture's post-review "tracked shot" code commit
  landed one second after the review commit): pin that commit's
  `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE` to the review commit's second; no
  assertion or product change — a fixture-determinism exception to "ship tests
  unmodified", not user-visible, so no CHANGELOG entry (added 2026-10-12) —
  verify: the test passes 10 times in a loop (`node --test --test-name-pattern
  'ship --confirm \(in-repo, owner\)' scripts/agento.test.mjs`), the full gate
  `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` passes, and `cd
  extension && npm run copy-cli` leaves `git diff --quiet -- extension/cli` —
  done 2026-10-12: root cause confirmed — `shippable()` commits review.md and the
  code together, then the test adds the code commit "tracked shot"; the audit's
  `review-stale` compares whole-second `%ct` (`reviewTs < codeTs`), so the gap
  only fired when the two commits straddled a second boundary. Not caused by this
  delivery: its test changes are appended after line 6311 and touch no ship
  fixture or helper, and its `ship()` change (fetch/integrate/push lifted into
  helpers) does not touch the audit's staleness logic. Loop 10/10 pass; full gate
  465/465 pass; copy-cli exit 0, `git diff --quiet -- extension/cli` exit 0

- [x] 5.6 Confirm CI on the new head (added 2026-10-12) — verify:
  `scripts/wait-for-checks.sh pr 111` exits 0 with the `test` check passing on
  the head pushed by 5.5 — done 2026-10-12: head `aef0074`, run 38289495094
  `conclusion=success` (`wait-for-checks.sh run` exit 0), `wait-for-checks.sh pr
  111` exit 0 (`pass=1 fail=0`, merge CLEAN); final `sync` up-to-date

## Follow-ups
