# Deterministic release wait: stateless GitHub REST state machine (`agento.mjs release`)

## Problem

`/agento ship` waits for the configured release workflow (`checks.releaseWorkflow`) after
the merge, and that wait fails in practice:

- `scripts/wait-for-checks.sh` blocks for up to 300 s (`max_seconds=300`,
  `scripts/wait-for-checks.sh` line 25 in the product repository) and prints
  one line per poll, so a call can outlast the terminal tool's window and the output
  is lost.
- Its timers count from script start (`SECONDS`), so every rerun resets the
  no-checks grace period.
- Finding the release run by `headSha` is written only as prose in
  `.github/prompts/ship.prompt.md` (release-workflow bullet, lines 237–244), so the
  agent makes up the lookup each time.
- Soshiki's `staging-release.yml` (`/home/david/DP/soshiki/.github/workflows/staging-release.yml`)
  adds two more failures:
  - **Concurrency group.** `concurrency: staging-release`: a newer merge can cancel
    the merge's own run while it is still pending.
  - **`paths-ignore`.** `paths-ignore: docs/**, ROADMAP.md`: a docs-only merge never
    gets a run, so the wait never ends.

The fix makes the wait stateless. Every call derives the verdict from GitHub again,
returns within 60 s, and prints one JSON document. If the output is lost, a rerun gives
the same answer and loses nothing.

## Decisions

The intake already chose the overall design: REST only, no webhooks, no background
processes, no state files, and GitHub as the only source of truth. Superseded runs
count only for descendant `push` runs. Out of scope: hook or guard changes, `doctor`
checks, and dispatch inputs. The clarifying questions and the user's answers
(recommended option marked):

1. **How should Phase E (copying `wait-for-checks.sh` into Soshiki and updating its
   AGENTS.md) appear in this delivery?** Options: *Follow-up only (recommended)* /
   `(manual, post-ship)` step / drop it. **Answer: Follow-up only.** It is recorded
   under roadmap `## Follow-ups` and done later in a separate Soshiki PR.
2. **How should the live, read-only checks against Soshiki run (a recent merge SHA,
   a docs-only SHA, and run 37025633788)?** Options: *the Builder runs them from a local
   Soshiki checkout (recommended)* / fixtures only / live against agento itself.
   **Answer: the Builder runs them from a local Soshiki checkout.** The checkout is
   `/home/david/DP/soshiki`, and it sets `checks.releaseWorkflow: "staging-release.yml"`.
3. **Should the CLI enforce the 60-seconds-or-less rule for `release --wait N`?**
   Options: *reject N > 60 as a usage error (recommended)* / clamp silently to 60 / no
   cap. **Answer: reject N > 60 as a usage error** (exit 1).
4. **Does the new 60 s `--max-seconds` default apply to both `pr` and `run` modes?**
   Options: *both modes (recommended)* / `pr` mode only. **Answer: both modes.** The
   `run` mode keeps its interface and exit codes. Only the default and the change-only
   poll lines change.

## Research

Skills consulted: none — no matching domain (this repository has no `.agents/skills/`
and no AGENTS.md skills table; the work is Node CLI, Bash, and prompt prose).

Codebase facts:

- **CLI conventions** (`scripts/agento.mjs`)
  - The header comment (lines 1–24) is the usage text.
  - `usage()` prints `split("\n").slice(1, 24)`, so a new header line means widening
    the slice to `(1, 25)`.
  - `scripts/agento.test.mjs` asserts subcommands appear in `usage`, for example
    `initiative [<slug>]`.
  - `emit(result, code)` writes one JSON document synchronously.
  - Exit codes: 0 = usable, 1 = usage error, 3 = resolution failure.
  - `parseArgs` rejects unknown `--options`, so `--wait` and `--interval` must be added
    there.
  - Subcommands are `case` arms of the final `switch (command)`.
  - `lookupPullRequest()` (around line 565) is the `gh` pattern: `execFileSync("gh", …,
    { cwd, encoding: "utf8", stdio: ["ignore","pipe","pipe"], timeout: 15000 })`, with a
    `gh --version` probe first.
  - `config.checks.releaseWorkflow` is defaulted in `scripts/agento-config.mjs`
    line 18. The `release` subcommand is its first CLI reader.
- **Test harness** (`scripts/agento.test.mjs`): `restrictedPath(stubs)` writes stub
  executables (`gh`, `code`, `python3`) onto a private `PATH`, and `runWith({ cwd, env },
  …args)` runs the CLI. `tests/wait-for-checks.test.mjs` has `fakeGh(responses)`, a
  sequenced stub keyed on its call count.
- **wait-for-checks tests that change**
  - "pr: zero checks succeeds once the no-checks grace period elapses" asserts
    `poll 2`. With change-only lines, the unchanged snapshot no longer prints a second
    poll line, so that assertion moves to the `RESULT:` line.
  - "pending then passing" still prints `poll 2`, because the snapshot changed.
- **Extension copy**
  - `extension/scripts/copy-cli.mjs` copies a fixed `cliFiles` list and deletes
    anything else in `extension/cli/`, so `release-state.mjs` must be added to that list
    and to `tests/extension-bundle.test.mjs`. The model-profiles delivery did the same
    in its step 1.8.
  - The extension never calls `release`.
- **Prompt mirror**: `tests/customizations.test.mjs` (the "plugin manifest uses
  suffix-less command names …" test) requires `commands/<name>.md` to equal
  `.github/prompts/<name>.prompt.md` byte for byte.
- **Mentions to update**
  - `.github/prompts/ship.prompt.md` and `commands/ship.md` lines 237–244
    (release-workflow bullet) and step 4 (report).
  - `.github/instructions/delivery-policy.instructions.md` §6, the third bullet.
  - `AGENTS.md` lines 22 (scripts list) and 66 ("Bounded waits only").
  - `README.md` line 514 (`checks.releaseWorkflow` paragraph).
  - `docs/project-profile.md` line 41 (`checks.releaseWorkflow` row).
  - `docs/commands.md`, the CLI subcommand paragraph after the table.
  - `CHANGELOG.md` `## Unreleased`, which already exists; the version is 0.7.0 and is
    not bumped here.
- **Guard**: `scripts/hooks/delivery-guard.sh` (`WATCHER`, around line 202) denies only
  `gh pr checks --watch`, `gh run watch`, and `vercel … --wait`. A segment like
  `node …/agento.mjs release <sha> --wait 50` does not match, so no hook change is
  needed. A guard fixture asserting it is allowed protects this.
- **Target projects**
  - `/agento agento-init` copies `scripts/wait-for-checks.sh` into each target project
    (`agento-init.prompt.md` line 196). That file's improvements only reach Soshiki by
    the Phase E follow-up.
  - `agento.mjs` always runs from the plugin root (`node <agento-root>/scripts/agento.mjs`),
    so `release` needs no copy into target projects.
- **Soshiki** `staging-release.yml`
  - `on.push.branches: [main]`, `paths-ignore: ["docs/**", "ROADMAP.md"]`.
  - `workflow_dispatch` with `operation: release | smoke | rollback`; the default is
    `release`.
  - `concurrency: { group: staging-release, cancel-in-progress: false }`. With this
    setting, GitHub still cancels a *pending* run when a newer one queues in the group.

GitHub REST endpoints, all via `gh api` with `{owner}/{repo}` resolved from the cwd's
`origin`:

- `GET repos/{owner}/{repo}/commits/{sha}`: the full SHA, `commit.committer.date`
  (grace anchor), and `parents[]`.
- `GET repos/{owner}/{repo}/actions/workflows/{workflow}/runs?head_sha={sha}&per_page=100`:
  the exact-SHA runs.
- `GET repos/{owner}/{repo}/actions/workflows/{workflow}/runs?branch={default}&event=push&created=>={mergeDate}&per_page=100`:
  candidate superseding runs.
- `GET repos/{owner}/{repo}/compare/{merge}...{candidate}`: `status` ∈ `ahead | identical
  | behind | diverged`, the descendant test.
- `GET repos/{owner}/{repo}/compare/{parent1}...{merge}`: the changed `files[]`. GitHub
  caps this list at 300 files.
- `GET repos/{owner}/{repo}/contents/.github/workflows/{workflow}?ref={sha}`: the
  workflow file as of the merge (base64).

Lint baseline (policy §5), recorded on detached `origin/main` at `993d919`:

- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → exit 0, 289 tests,
  289 pass, 0 fail.
- `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` → **exit 127 locally:
  shellcheck is not installed on this machine**. CI installs it, and the `Shellcheck`
  step of CI run 37576233346 on `993d919` (main) concluded `success`. The
  full-repository shell-lint baseline is therefore clean, with zero findings.
- Overlap decision: the baseline is green, so there is nothing to clean up and no
  scoped gate. The **full gate** applies: full test suite, shellcheck over every
  script, both guard replays, and the extension build and unit tests. Locally,
  shellcheck runs when `command -v shellcheck` finds it. Otherwise the PR's CI
  `Shellcheck` step is the shellcheck evidence, awaited with
  `scripts/wait-for-checks.sh pr <n>`.

Concurrent deliveries: `gh pr list --state open` → #94 `feature/start-session-cli`,
which changes `scripts/agento.mjs`, `scripts/session-state.mjs`, and
`scripts/session-state.test.mjs`. It overlaps this plan on `scripts/agento.mjs`, and
on `extension/cli/agento.mjs` once either side runs `copy-cli` (see Risks).

## Approach

**Phase A: `scripts/release-state.mjs` (new, pure, no I/O)** and
`scripts/release-state.test.mjs`. Exported functions:

- `globToRegExp(pattern)` follows GitHub filter rules:
  - `*` matches any run of characters except `/`.
  - `**` matches anything, including `/`; `**/` also matches zero directories.
  - `?` matches one character except `/`.
  - `[…]` character classes pass through.
  - A leading `!` negates the pattern.
- `parseWorkflowTriggers(yamlText)` is a small line-based reader for `on:`. It accepts
  these forms:
  - `on: push`
  - `on: [push, workflow_dispatch]`
  - an `on:` block map with `push:` (empty or a map), `branches`, `branches-ignore`,
    `paths`, and `paths-ignore`, each as a block list (`- "x"`) or a flow list.
  - `workflow_dispatch:` (presence only).

  It returns `{ push: null | { branches, branchesIgnore, paths, pathsIgnore },
  dispatch: boolean, unparsed: boolean }`. Anything it cannot read sets `unparsed:
  true`, and the caller then assumes the workflow is triggered (the conservative
  choice).
- `pushTriggered({ triggers, branch, files, filesTruncated })`. It decides whether a
  push of `files` to `branch` starts the workflow:
  - The branch must pass the branch filters. Negated patterns (`!pattern`) re-include
    or exclude paths, following GitHub's rule that the last match wins.
  - `paths`: at least one file must match.
  - `paths-ignore`: at least one file must not be ignored.
  - With `filesTruncated` or `unparsed`, it returns `true`.
- `pickExactRun(runs)`. Among runs whose `head_sha` equals the merge SHA, prefer the
  newest `event: push` run. Fall back to the newest `workflow_dispatch` run only when
  there is no push run. This keeps a later Soshiki `smoke` dispatch on the same SHA from
  shadowing the real release run.
- `classifyRun(run)` maps the run to `success`, `pending`, `cancelled`, or `failed`:
  - `status` ∈ `queued | in_progress | waiting | requested | pending` → `pending`.
  - `completed` + `success` → `success`.
  - `completed` + `cancelled` → `cancelled`.
  - Any other conclusion → `failed`.
- `withinGrace({ mergeDate, now, graceSeconds = 180 })`. The grace window is anchored to
  the merge commit's GitHub committer date, never to process start.
- `releaseVerdict(facts)` is the single decision function over pre-fetched facts:
  `{ exactRuns, triggers, files, filesTruncated, mergeDate, now, laterRuns,
  descendantOf, defaultBranch }`. Its order:
  1. An exact run exists:
     - `success` → `success`.
     - `pending` → `pending`.
     - `failed` → `failed`.
     - `cancelled` → the superseded check. Look through `laterRuns` (push, default
       branch, created after the exact run, oldest first) whose `descendantOf` is
       `ahead | identical`:
       - The first `success` among them → `superseded-success`, with `supersededBy`.
       - Any of them still `pending` → `pending`.
       - Otherwise → `failed`.
  2. No exact run and no push trigger for the default branch → `dispatch-required`.
  3. No exact run, and `pushTriggered` is false → `not-triggered`.
  4. No exact run, still within grace → `pending`.
  5. Otherwise → `no-run`.

  It returns `{ verdict, run, supersededBy, reason }`.

**Phase B: `release` subcommand in `scripts/agento.mjs`.**

- `release <merge-sha> [--wait N] [--interval N]`.
  - `<merge-sha>` must match `^[0-9a-f]{7,40}$`.
  - `--wait` is an integer 0–60 and defaults to 0 (one snapshot). N > 60, a
    non-integer, or a negative value is a usage error, exit 1.
  - `--interval` is an integer 1–60 and defaults to 10.
  - `parseArgs` gains both options. The header comment gains a line:
    `node scripts/agento.mjs release <merge-sha> [--wait N] [--interval N]` (deploy-wait
    verdict for checks.releaseWorkflow; exit 0 done, 2 pending/dispatch-required,
    3 gh/auth, 4 failed/no-run).
  - `usage()` widens its slice to `(1, 25)`.
- `checks.releaseWorkflow` unset → `{ status: "ok", verdict: "not-configured" }`, exit 0,
  and no `gh` call.
- A `ghApi(pathAndQuery)` helper calls `execFileSync("gh", ["api", "-H",
  "Accept: application/vnd.github+json", path], { cwd: root, encoding: "utf8",
  stdio: ["ignore","pipe","pipe"], timeout: 15000 })` and parses the JSON. Error
  handling:
  - A `gh --version` probe failure → exit 3, `status: "error"`, `reason: "gh-missing"`.
  - Stderr matching `HTTP 401|HTTP 403|not logged in|authentication|gh auth login` →
    exit 3, `reason: "auth"`. The message names `gh auth login` for the user to run
    (policy §1).
  - `HTTP 404` on the commit → exit 3, `reason: "unknown-sha"`.
  - Other errors → exit 3, `reason: "gh-error"`, with the first stderr line.
- The fact gathering fetches the merge commit first. Then:
  - It fetches exact runs only when needed (always).
  - It fetches the workflow file, the parent-diff file list, and the later runs and
    compare calls only on the branches of `releaseVerdict` that need them. A
    `success` costs two API calls.
- The `--wait` loop is synchronous: `Atomics.wait` on a `SharedArrayBuffer` sleeps
  between snapshots.
  - It repeats while the verdict is `pending` and `waitedSeconds + interval ≤ wait`.
  - It never loops on `dispatch-required`.
- The output is one `emit()` with:
  - `status` (`ok | pending | error | failed`), `verdict`, `sha` (full), `workflow`.
  - `run` (`{ id, event, status, conclusion, url, headSha }` or `null`).
  - `supersededBy` (the same shape, or `null`).
  - `reason`, `mergeDate`, `graceSeconds`, `polls`, `waitedSeconds`.
- Exit codes:

  | Exit | Verdict or condition |
  |---|---|
  | 0 | `success`, `superseded-success`, `not-triggered`, `not-configured` |
  | 1 | usage error |
  | 2 | `pending`, `dispatch-required` |
  | 3 | `gh` missing, authentication failure, unknown SHA, or another `gh` error |
  | 4 | `failed`, or `no-run` after the grace window |

- CLI tests in `scripts/agento.test.mjs` use a `gh` stub (Node script on the
  restricted `PATH`) that answers `api <path>` from a fixture map keyed on the path
  prefix, with an optional sequence for the polling test.
- Update the extension copy: add `release-state.mjs` to `extension/scripts/copy-cli.mjs`
  `cliFiles` and to `tests/extension-bundle.test.mjs`, then run `cd extension && npm run
  copy-cli`.

**Phase C: `scripts/wait-for-checks.sh`.**

- The default `max_seconds` becomes 60 in both modes. The header comment documents it.
- A poll line prints only when the snapshot text differs from the previous poll's
  (the first poll always prints).
- The final `RESULT:` line is always printed.
- Arguments, exit codes, and `--no-checks-grace` semantics are unchanged.
- Update `tests/wait-for-checks.test.mjs`: the grace test drops its `poll 2`
  assertion. A new test proves an unchanged pending snapshot prints exactly one poll
  line plus `RESULT:`.

**Phase D: prompts, policy, docs.**

- **Ship prompt.** Rewrite the release-workflow bullet of `.github/prompts/ship.prompt.md`
  and copy the identical bytes into `commands/ship.md`:
  - When `checks.releaseWorkflow` is set, run `node <agento-root>/scripts/agento.mjs
    release <merge-sha> --wait 50` in the foreground, and rerun it while it exits 2 with
    `verdict: pending`.
  - On `dispatch-required`, run `gh workflow run <workflow> --ref <default>` exactly
    once, then resolve again. Before dispatching on a re-sent `/agento ship`, if `gh run
    list --workflow <workflow> --event workflow_dispatch` shows a run created after the
    merge commit date, do not dispatch again; resolve and report it.
  - Exit 0 is recorded with its verdict. `superseded-success` names both run URLs.
    `not-triggered` and `not-configured` name their reason.
  - Exit 4 is a resumable hard stop: re-sending `/agento ship <slug>` re-derives the
    verdict.
  - Exit 3 follows policy §1 (reauth).
  - Step 4 (Report) names the verdict.
- **Policy.** `delivery-policy.instructions.md` §6, third bullet: CI waits use
  `scripts/wait-for-checks.sh pr <n>` or `run <id>`. Deploy waits use
  `agento.mjs release <merge-sha> --wait N`. Every wait call stays at 60 s or less, and
  exit 2 means rerun.
- **AGENTS.md.** Line 22 lists `release-state.mjs`. Line 66 names both bounded waits.
- **Guard fixture.** Add a line to `tests/guard-fixtures.txt` asserting `node
  scripts/agento.mjs release abc1234 --wait 50` is allowed. This is test data only; no
  hook file changes.
- **Docs.**
  - `docs/project-profile.md`, the `checks.releaseWorkflow` row: what the verdicts mean,
    the push/`paths-ignore` handling, and dispatch for dispatch-only workflows.
  - `docs/commands.md`, the CLI subcommand paragraph: `release`.
  - `README.md` line 514.
  - `CHANGELOG.md` `## Unreleased`: one entry covering `agento.mjs release` and the
    `wait-for-checks.sh` changes.

**Phase E (Soshiki)** is out of this branch and recorded as a roadmap Follow-up
(Decision 1).

Files touched (product half):

- New: `scripts/release-state.mjs`, `scripts/release-state.test.mjs`.
- `scripts/agento.mjs`, `scripts/agento.test.mjs`.
- `scripts/wait-for-checks.sh`, `tests/wait-for-checks.test.mjs`.
- `extension/scripts/copy-cli.mjs`, `extension/cli/*` (generated), and
  `tests/extension-bundle.test.mjs`.
- `.github/prompts/ship.prompt.md`, `commands/ship.md`.
- `.github/instructions/delivery-policy.instructions.md`, `AGENTS.md`.
- `tests/guard-fixtures.txt`.
- `docs/project-profile.md`, `docs/commands.md`, `README.md`, `CHANGELOG.md`.

## Risks

- **Concurrent delivery #94 (`feature/start-session-cli`) also edits
  `scripts/agento.mjs`.** If either side runs `copy-cli`, it also changes
  `extension/cli/agento.mjs`. Mitigations:
  - Integrate `origin/main` by merge before every push (policy §7).
  - Keep the `release` code in its own `case` arm and helper block at the end of the
    switch.
  - After any merge that touches `scripts/agento.mjs`, rerun `npm run copy-cli`
    instead of hand-resolving `extension/cli/`.
- **Stateless "dispatch once."** If `main` moves before the dispatched run registers,
  the dispatched run's `head_sha` is not the merge SHA. A naive re-resolve would then
  report `dispatch-required` again. Mitigation: the ship bullet's pre-dispatch check
  for any `workflow_dispatch` run created after the merge date (Approach, Phase D).
  The ship prompt never dispatches twice.
- **Same-SHA `smoke`/`rollback` dispatch shadowing the release run.** Mitigation:
  `pickExactRun` prefers `push` runs, and the decision forbids dispatch runs as
  superseded proof.
- **More than 300 changed files.** The compare API truncates `files[]`. Mitigation:
  `filesTruncated` makes `pushTriggered` return `true`, so the verdict errs toward
  waiting, not toward `not-triggered`.
- **Workflow YAML beyond the line reader** (anchors, multi-document files, inline maps
  inside lists). Mitigation: `unparsed: true` is treated as triggered and as having a
  push trigger. The worst case is today's behavior: wait for a run, then `no-run`
  after the grace window.
- **API rate limits during `--wait 50` loops.** Each snapshot makes 2–6 calls. With the
  default `--interval 10`, a call uses at most about 30 requests, well under the
  5000/h authenticated limit.
- **shellcheck is not installed locally.** Mitigation: the Builder runs it when
  `command -v shellcheck` succeeds. Otherwise the PR's CI `Shellcheck` step (green on
  main at `993d919`) is the evidence, awaited with `scripts/wait-for-checks.sh pr <n>`.
- **Live checks depend on Soshiki history and the user's `gh` auth for that
  repository.** They are read-only `GET`s. If auth fails, the step pauses per policy §1
  with `gh auth login` named for the user.

## Out of scope

- Webhooks, `gh webhook forward`, background processes, and state or journal files.
- Hook or guard *code* changes (`scripts/hooks/`, `.github/hooks/`). Only a guard
  fixture line is added.
- New `doctor` checks or `COMMAND_NEEDS` changes (`ship` already needs `gh`).
- Dispatch inputs for dispatch-only workflows (`--field operation=…`).
- Phase E, the Soshiki PR (a Follow-up).
- Making the `pr`-mode no-checks grace stateless (anchored to a GitHub timestamp). It
  stays relative to script start. With the 60 s default and the 30 s grace, it still
  resolves within one call.

## Acceptance checklist

- [ ] `scripts/release-state.test.mjs` covers every verdict with one test each:
  - exact run `success`, `failed`, `pending`
  - a cancelled exact run plus a passing descendant → `superseded-success`
  - a cancelled exact run plus a later non-descendant → `failed`
  - a cancelled exact run plus a pending descendant → `pending`
  - a docs-only diff against `paths-ignore` → `not-triggered`
  - no run within grace → `pending`; no run after grace → `no-run`
  - no push trigger → `dispatch-required`
  - a same-SHA `workflow_dispatch` run newer than the push run → the push run is
    picked

  It also has `globToRegExp` cases (`*` does not cross `/`, `**` does, `**/` matches
  zero directories). Verify: `node --test scripts/release-state.test.mjs` exits 0.
- [ ] `agento.mjs release` exit codes and JSON fields match the table in Approach,
  checked against a stubbed `gh`:
  - `not-configured` → exit 0, with no `gh` invocation.
  - `success` → exit 0.
  - `pending` → exit 2.
  - `dispatch-required` → exit 2.
  - `failed` → exit 4.
  - `no-run` → exit 4.
  - `gh` missing → exit 3.
  - HTTP 401 → exit 3, naming `gh auth login`.
  - `--wait 61` → exit 1.
  - A pending→success sequence under `--wait 3 --interval 1` → exit 0 with `polls ≥ 2`.

  `usage` lists `release <merge-sha>`. Verify: `node --test scripts/agento.test.mjs`
  exits 0.
- [ ] `wait-for-checks.sh` defaults to 60 s in both modes and prints a poll line only on
  snapshot change, plus the `RESULT:` line. Verify: `node --test
  tests/wait-for-checks.test.mjs` exits 0, including the new unchanged-snapshot test.
- [ ] `.github/prompts/ship.prompt.md` and `commands/ship.md` are byte-identical and
  their release bullet does all of the following:
  - drives `agento.mjs release <merge-sha> --wait 50`, rerunning while it exits 2 with
    `verdict: pending`
  - dispatches at most once on `dispatch-required`, with the pre-dispatch
    existing-run check
  - reports `superseded-success` with both run URLs
  - treats exit 4 as a resumable hard stop

  Verify: `cmp` of the two files, and a read of the bullet.
- [ ] Delivery-policy §6 names `agento.mjs release` for deploy waits and the
  60-seconds-or-less per-call rule. AGENTS.md lines 22 and 66 are updated. Verify: a
  read, plus `node --test tests/customizations.test.mjs` exits 0.
- [ ] `docs/project-profile.md`, `docs/commands.md`, `README.md`, and `CHANGELOG.md`
  (`## Unreleased`) describe `agento.mjs release` and the new `wait-for-checks.sh`
  defaults. Verify: a read.
- [ ] `extension/cli/` contains a byte-identical `release-state.mjs` and `agento.mjs`.
  Verify: `node --test tests/extension-bundle.test.mjs` exits 0, and `cd extension &&
  npm run build && npm run test:unit` exits 0.
- [ ] The guard allows `node scripts/agento.mjs release <sha> --wait 50`. Verify:
  `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` and
  `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh <
  tests/guard-fixtures-companion.txt` both exit 0.
- [ ] Live, read-only checks from `/home/david/DP/soshiki`:
  - a recent push-triggered merge SHA → `success` in under 5 s
  - a docs-only merge SHA → `not-triggered`
  - the `headSha` of run 37025633788 → `run.id` 37025633788 (or `supersededBy` naming a
    descendant when that run was cancelled)

  JSON outputs are saved under `evidence/`. Verify: the evidence files plus `time`
  output.
- [ ] Full gate, compared with the baseline:
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exits 0 with zero
    failures, against a baseline of 289/289.
  - shellcheck over `scripts/hooks/*.sh scripts/wait-for-checks.sh` reports zero
    findings, either locally or from the PR's CI `Shellcheck` step.
  - Both guard replays exit 0.
  - `git status --porcelain --untracked-files=all` is empty in both halves.
