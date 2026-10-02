# Session & Doctor renders a detached companion instead of failing (session-doctor-detached-companion)

## Problem

In a companion-mode planning window — the managed `plan-<id>` pair that
`/agento start-session` opens with both halves detached at their `origin/main` —
the extension's **Session & Doctor** view collapses into the error state:

```
Invalid Session & Doctor response: branch must be a non-empty string
```

and the status bar reads `Agento: unavailable`. The CLI is healthy; the view's
parser rejects a legitimate shape. `parseCompanion()` in
`extension/src/sessionDoctorModel.ts` requires `companion.branch` to be a non-empty
string, but `agento.mjs session` reports `companion.branch: null` (with
`companion.detached: true`) whenever the companion half is detached — which is the
normal state of every planning session until the Planner reserves a branch. Because
one thrown error anywhere inside `createSessionDoctorModel()` turns the whole model
into `{ kind: "error" }`, the session rows, warnings, doctor checks, and command
actions all disappear from the panel for exactly the window in which a user is about
to run `/agento new-feature` or `/agento new-issue`.

The session worktree in the same file already handles a detached HEAD
(`nullableString(worktree, "branch")` and `branch ?? "detached"`); the companion
parser never received the same treatment.

## Evidence

GitHub issue: #75

Verified 2026-10-02 in this planning worktree (`plan-20261002-155631`, HEAD
`a90fc9a` = `origin/main`, extension built from the same commit). Captures are under
[evidence/](evidence/).

**Observed:** `createSessionDoctorModel()` returns
`{ kind: "error", message: "Invalid Session & Doctor response: branch must be a non-empty string", statusBarText: "Agento: unavailable" }`
for a session record whose companion is detached.

**Expected:** `{ kind: "ready", … }` with `companion.branch === "detached"`, the
companion `State` row reading `registered, detached, clean`, and the session rows,
doctor checks, and actions intact — mirroring how the session worktree row already
renders `detached`.

Reproduction:

1. `node scripts/agento.mjs session` in this worktree, while still detached at
   `origin/main`, reported `companion.branch: null`, `companion.detached: true`
   (excerpt saved as
   [evidence/session-plan-window-excerpt.json](evidence/session-plan-window-excerpt.json);
   the same record also carries `worktree.branch: null`, which the view handles).
2. `cd extension && npm run build` (exit 0), then
   `node evidence/repro-detached-companion.mjs`
   ([evidence/repro-detached-companion.mjs](evidence/repro-detached-companion.mjs))
   feeds that shape to the compiled `out/sessionDoctorModel.js`. Output
   ([evidence/repro-output.json](evidence/repro-output.json)):

   ```json
   {
     "kind": "error",
     "message": "Invalid Session & Doctor response: branch must be a non-empty string",
     "statusBarText": "Agento: unavailable"
   }
   ```

The reproduction is deterministic and needs no VS Code: the defect is in the pure
model function, and the view (`sessionDoctorProvider.ts`) renders whatever model it
receives.

## Decisions

Asked with the ask-questions tool on 2026-10-02:

1. **How should a detached companion branch render in the Session & Doctor panel?**
   — `"detached"` (mirror the session worktree exactly, `branch ?? "detached"`).
2. **Should the fix also cover other renderers that read `companion.branch` (e.g.
   the webview HTML or status bar), or only `parseCompanion()`?** —
   `parseCompanion()` + any consumer that breaks (fix the parser; adjust consumers
   only if the model change requires it).
3. **Slug for the branch/artifacts?** — `session-doctor-detached-companion`.
4. **Is the unit test plus the extension build/test:unit enough, or do you also want
   the Electron activation test run in the roadmap?** — Also run `test:electron`.

## Research

Skills consulted: none — no matching domain (the repository has no `.agents/skills/`
directory and its AGENTS.md has no `## Agento` skills table).

- **Defect site.** `extension/src/sessionDoctorModel.ts` `parseCompanion()` builds
  `CompanionSummary.branch` with `requiredString(companion, "branch")`, which throws
  `branch must be a non-empty string` on `null`. The session worktree in
  `createSessionDoctorModel()` uses `nullableString(worktree, "branch")` and
  `branch ?? "detached"` for the identical situation. `createSessionDoctorModel()`
  wraps everything in one `try` and converts any throw into the `error` model via
  `createSessionDoctorError(error, "Invalid Session & Doctor response")`, which is why
  the single field hides the entire view.
- **CLI contract.** `scripts/agento.mjs session` emits `companion.branch: null` with
  `companion.detached: true` whenever the companion half has a detached HEAD — the
  default for a fresh planning pair (evidence above). The CLI is correct; the model
  type `CompanionSummary.branch: string` is a display string, so the fix lands in the
  parser, not the type.
- **Consumers of `companion.branch`.** `extension/src/sessionDoctorProvider.ts`
  renders `this.row("Branch", this.model.companion.branch)` — a plain string row that
  needs no change once the parser yields `"detached"`.
  `extension/src/deliveryTreeModel.ts` already tolerates a null companion branch
  independently (`companion.branch ?? "unknown"`), and `newPlanFlow.ts` only tests
  `session.companion !== null`. No other consumer breaks (decision 2 → parser only).
- **Existing tests.** `extension/test/unit/sessionDoctorModel.test.ts` covers an
  attached companion, a `companion: null` case with a detached *worktree*, malformed
  fields, and the transport error — but never a detached *companion*, so the defect
  was never exposed. The electron suite (`extension/test/electron/suite.ts`,
  `sessionResponse()`) also uses an attached companion only.
- **Open delivery overlap.** `gh pr list --state open` → PR #74
  (`issue/dashboard-dispatch-agent-mode`) touches `CHANGELOG.md`, `docs/extension.md`,
  `docs/model-profiles.md`, `extension/src/{commandAgent,commandDispatcher,extension}.ts`,
  `extension/test/electron/suite.ts`, and three unit tests. Overlap with this plan:
  `CHANGELOG.md` only (see Risks).
- **Lint baseline (policy §5)**, run 2026-10-02 at `a90fc9a` in the product
  checkout:
  - `npm run lint:hooks` (`shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`)
    → exit 127, `shellcheck: not found`. shellcheck is not installed on this machine
    (`command -v shellcheck` empty); this is a missing prerequisite, not a finding.
    No file under `scripts/hooks/` or `scripts/wait-for-checks.sh` is touched by this
    delivery, so there is no overlap with the shell lint.
  - `cd extension && npm run typecheck` → exit 0, 0 findings.
  - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → exit 0,
    `# tests 259`, `# pass 259`, `# fail 0`.
  - `cd extension && npm run test:unit` → exit 0, `# tests 85`, `# pass 85`,
    `# fail 0`.
  - **Decision:** every lint signal that could run is green and the one that could
    not (shellcheck) has no overlap with the changed files. A **scoped gate** applies:
    extension typecheck (the lint for every changed `.ts` file), `test:unit` (focused
    tests for the changed behaviour), `test:electron` (decision 4), the repository
    node tests, and a rerun of `npm run lint:hooks` compared against this baseline —
    if shellcheck is present on the Builder's machine it must exit 0 with no findings;
    if it is still absent the Builder records exit 127 again and the comparison is
    "unchanged, hooks untouched" (`git diff --name-only origin/main...HEAD` must not
    list `scripts/hooks/` or `scripts/wait-for-checks.sh`).

## Approach

Affected files (all under `extension/`, product half):

- `extension/src/sessionDoctorModel.ts` — in `parseCompanion()`, replace
  `branch: requiredString(companion, "branch")` with
  `branch: nullableString(companion, "branch") ?? "detached"`. `CompanionSummary`
  and every consumer stay unchanged (decision 2); the `State` row already says
  `detached`/`attached` from `companion.detached`, so the `Branch` row now agrees
  with it.
- `extension/test/unit/sessionDoctorModel.test.ts` — add a regression test named
  `session doctor model renders a detached companion as "detached" (#75 session-doctor-detached-companion)`
  that spreads the shared `session` fixture with
  `companion: { ...session.companion, branch: null, detached: true, ahead: 0, behind: 0 }`
  and asserts `model.kind === "ready"`, `model.companion` deep-equals
  `{ path: "/repo/docs-worktree", branch: "detached", state: "registered, detached, clean", sync: "ahead 0, behind 0" }`,
  and that the session rows, checks, and actions are still populated. Written first
  and verified to FAIL with the current message, then made to pass by the one-line
  fix.
- `CHANGELOG.md` — a **Fixed** bullet under `## Unreleased` (create the heading
  above `## 0.7.0` if it does not exist yet) naming the Session & Doctor view, the
  detached companion, and `#75`.

Verification target for the user-visible behaviour: `local` — the model is a pure
function, so the regression test plus the compiled repro script are the faithful
check; the electron activation suite is run as the integration gate (decision 4),
unchanged. No preview, no `dev-stack`.

Companion-mode delivery: code commits land in the product half
(`issue/session-doctor-detached-companion`), artifact commits (roadmap ticks,
`## Resolution`) in the companion half on the same branch name, per policy §7's
two-commit rule.

## Risks

- **Concurrent delivery — `CHANGELOG.md` collides with PR #74.** Both deliveries add
  a bullet near the top of the file. Mitigation: `git merge origin/main` (never
  rebase) in the product half before every push and before `status: in-review`; if
  #74 ships first, the `## Unreleased` heading will already exist and only the bullet
  is added. The conflict, if any, is a trivially-resolvable adjacent-line merge.
- **Masking a genuinely malformed record.** Treating `null` as `"detached"` must not
  also accept a missing or non-string `branch`. `nullableString()` still throws on
  `undefined` and on non-strings, so the existing "rejects malformed required
  response fields" test continues to guard the contract; the regression test asserts
  the `null` → `"detached"` path only.
- **Electron suite flakiness** is unrelated to this change (fixtures unchanged); a
  failure there is investigated against `origin/main` before being attributed to the
  fix.

## Out of scope

- Adding a detached-companion scenario to the electron suite
  (`extension/test/electron/suite.ts` `sessionResponse()`); the pure-model unit test
  is the exposing test, and the electron run is a regression gate only.
- Hardening every other `requiredString()` call across the extension's parsers
  against nullable CLI fields (decision 2 chose the narrow fix).
- Changes to the CLI's `session` output shape; `companion.branch: null` is the
  intended contract for a detached half.
- The `deliveryTreeModel.ts` `"unknown"` wording for a null companion branch.

## Acceptance checklist

- [ ] The regression test
  `session doctor model renders a detached companion as "detached" (#75 session-doctor-detached-companion)`
  in `extension/test/unit/sessionDoctorModel.test.ts` fails before the fix with
  `Invalid Session & Doctor response: branch must be a non-empty string` and passes
  after it — verify: roadmap steps 1.1 (`not ok`) and 2.2 (`ok`) outputs.
- [ ] `parseCompanion()` in `extension/src/sessionDoctorModel.ts` yields
  `branch: "detached"` for `companion.branch: null` and still throws for a missing or
  non-string `branch` — verify: the regression test and the existing malformed-fields
  test both `ok` in `npm run test:unit`.
- [ ] `node issues/2026/10/session-doctor-detached-companion/evidence/repro-detached-companion.mjs`
  (from the companion half, against the rebuilt `extension/out/`) prints
  `"kind": "ready"` and `"branch": "detached"` under `companion` — verify: command
  output recorded in `## Resolution`.
- [ ] `CHANGELOG.md` carries a Fixed bullet under `## Unreleased` referencing `#75` —
  verify: `grep -n '#75' CHANGELOG.md`.
- [ ] Scoped gate matches the recorded baseline: `cd extension && npm run typecheck`
  exit 0; `npm run test:unit` exit 0 with `# fail 0` and 86 tests; `npm run
  test:electron` exit 0; `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`
  `# pass 259`, `# fail 0`; `npm run lint:hooks` exit 0 with no findings, or exit
  127 with `git diff --name-only origin/main...HEAD` showing no `scripts/hooks/` or
  `scripts/wait-for-checks.sh` change — verify: roadmap step 3.1 output.
- [ ] The diff touches only `extension/src/sessionDoctorModel.ts`,
  `extension/test/unit/sessionDoctorModel.test.ts`, and `CHANGELOG.md` in the product
  half — verify: `git diff --name-only origin/main...HEAD`.
- [ ] Code PR body starts with `Fixes #75`; companion PR is linked from it; both PRs
  carry `origin/main` merged in, with the companion half `dirty: false`, `ahead: 0`
  — verify: `gh pr view --json body`, `node scripts/agento.mjs session --pr`.
