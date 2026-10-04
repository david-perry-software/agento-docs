# Verify both session halves after `git worktree add` and warn on an unregistered companion half (companion-half-registration)

## Problem

In companion mode a managed session is a pair: the product half
`<worktrees.dir>/<kind>-<id>` (a worktree of the product clone) and the companion
half `<artifacts.repo.dir>-worktrees/<kind>-<id>` (a worktree of the companion
clone). `/agento start-session` and `/agento start-freehand` create both halves with
`git worktree add`, but nothing checks afterwards that each half landed in the right
repository. When a shell tool drops a leading `cd <dir> &&` — observed on this
machine, recorded in the user's notes — the companion `worktree add` runs in the
product clone: the "artifact" half is a product checkout with the product's
`origin`, registered in the wrong clone. Planner and Builder then write artifacts
into a checkout that cannot carry them, and the companion branch, commits, and PR
never materialize where `/agento ship` looks for them.

Nothing reports the state after the fact either: `agento.mjs session` knows the
companion half is not registered (`companion.registered: false`) but emits no
warning, so the Session & Doctor panel and every prompt that reads the record stay
silent.

## Evidence

GitHub issue: #86

Verified 2026-10-04 from this planning worktree (`plan-20261004-045414`, HEAD
`f52ab90` = `origin/main`) with
[evidence/repro.sh](evidence/repro.sh), run as
`CLI=<product half>/scripts/agento.mjs bash evidence/repro.sh` (exit 0). It builds a
throwaway `/tmp` product + companion pair with bare origins, adds the product half
normally, then adds the companion half from the **product** clone — the dropped-`cd`
failure. Full output: [evidence/repro-output.txt](evidence/repro-output.txt).

Observed:

- `git -C <companion half> remote get-url origin` → `…/proj.git`; expected
  `…/proj-docs.git`.
- The companion clone's `git worktree list --porcelain` lists only its primary; the
  product clone lists the stray half next to the product half.
- `agento.mjs paths plan 20261004-1` reports only derived paths —
  `companion: { worktreesDir, worktree, branch: null }` — nothing a prompt could
  check after the add.
- `agento.mjs session` from the product half:

  ```json
  "companion": { "path": "…/proj-docs-worktrees/plan-20261004-1", "branch": null,
                 "detached": false, "registered": false, "dirty": false, "ahead": 0, "behind": 0 },
  "worktrees": [ …, { "path": "…/proj-docs-worktrees/plan-20261004-1", "detached": true,
                 "role": "unmanaged", "repo": "product", … }, … ],
  "warnings": []
  ```

Expected:

- `paths <kind> <id>` reports, for each half, whether it is on disk, which clone
  registers it, its `origin`, the `origin` it should have, and an overall `ok`.
- `start-session` (plan and build mode) and `start-freehand` check those facts right
  after each `git worktree add` and stop on a mismatch, naming the repository the
  half landed in and the exact `git -C <wrong-repo> worktree remove <path>` fix.
- `session` carries a `companion-unregistered` warning when the companion half exists
  on disk but the companion clone does not register it, naming the product clone
  when that is where it is registered.

## Decisions

Asked with the ask-questions tool on 2026-10-04; answers verbatim:

1. **How should start-session / start-freehand verify a freshly added companion half
   (origin + registration)?** — "CLI-backed: `paths` companion block gains
   `registered` + `origin` facts; prompts check them after `worktree add`".
2. **When the post-add check fails (half registered in the wrong repo / wrong
   origin), what should the command do?** — "Stop and report: name the repo it landed
   in and the exact `git -C <wrong-repo> worktree remove <path>` fix; never
   auto-remove".
3. **What should the session record's warning cover?** — "On disk but unregistered
   in the companion clone, and name the repo it IS registered in when the product
   clone lists it (the dropped-`cd` case)".
4. **Apply the same post-add origin/registration check to the product half too?** —
   "Yes — same check for both halves (and use `git -C <primary>` for the product
   add)".
5. **Should doctor, close-session, or ship also act on the
   unregistered-but-present state?** — "No — session warning + creation-time check
   only; record close/ship handling as a follow-up".

Slug derived from the description: `companion-half-registration`.

## Research

Skills consulted: none — no matching domain (this repository has no `.agents/skills/`
and no skills table; the work is the Agento CLI, prompts, and docs).

Root cause, with file evidence:

- `scripts/agento.mjs` `describeCompanion()` (≈L290-298): when
  `pairFor()` reports `registered: false` it returns
  `{ ...pair, dirty: false, ahead: 0, behind: 0 }` and nothing else — no on-disk
  check, no warning.
- `scripts/agento.mjs` `case "session"` (≈L1468-1500): `warnings[]` is assembled
  from the hosted reason, `anchor.warnings`, PR lookups, and lifecycle only; the
  companion record is never consulted.
- `scripts/agento.mjs` `case "paths"` (≈L1367-1386) emits `resolveSessionPaths()`
  as is; `resolveSessionPaths()` (≈L329-350) derives `worktree` and
  `companion.worktree` from the worktree lists but reports neither registration nor
  `origin`.
- `scripts/session-state.mjs` `pairFor()` (≈L161-173) matches the companion clone's
  list only — correct for `registered`, but it cannot see a half registered in the
  product clone; `classifyWorktrees()` then lists that half as
  `repo: "product", role: "unmanaged"` (repro output).
- `.github/prompts/start-session.prompt.md` plan mode step 3 runs a bare
  `git worktree add --detach <path> origin/main` (cwd-dependent) and
  `git -C <artifactsRoot> worktree add --detach <companion.worktree>
  origin/<default>` with no post-add verification for the companion half; build mode
  step 3 likewise. `.github/prompts/start-freehand.prompt.md` step 3 the same. Each
  prompt is mirrored byte for byte in `commands/<name>.md`.

Consumers of the new facts:

- The extension's Session & Doctor panel renders every `session.warnings[]` string
  as a Warning row (`extension/src/sessionDoctorProvider.ts` ≈L78-107,
  `sessionDoctorModel.ts` ≈L161-183), so the new warning surfaces with no extension
  change.
- `session.companion` is deep-equalled in many tests (`scripts/agento.test.mjs`
  ≈L279, 555, 615, 626, 636, 660, 862, 869, 1082) and parsed by the extension; its
  shape stays unchanged — the fix adds a warning, not fields.
- `extension/cli/` is a tracked byte copy of `scripts/`; `tests/extension-bundle.test.mjs`
  fails unless `cd extension && npm run copy-cli` follows every `scripts/` edit.
- `paths` is read by `start-session`, `start-freehand`, `close-session`, and `ship`;
  adding keys is additive. `tests/customizations.test.mjs` checks the prompt ↔
  `commands/` mirrors and the canonical command spelling.

Lint baseline (policy §5), run 2026-10-04 in this worktree at `f52ab90`:

- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` — exit 0,
  `# tests 274`, `# pass 274`, `# fail 0`.
- `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` — exit 0.
- `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt`
  — exit 0.
- `npm run lint:hooks` (`shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`)
  — `shellcheck` is not on PATH (exit 127). `pnpm dlx shellcheck` (0.11.0) exists,
  but the delivery guard denies any shell command naming the hook files outside an
  approved edit, so it could not be run against them here. Same state the #75
  delivery recorded.

Overlap decision: the baseline is green (no findings); this delivery touches no
shell file (`scripts/hooks/`, `scripts/wait-for-checks.sh`), so the shellcheck gap
cannot hide a regression introduced here. Gate = the full node suite + both guard
replays + `npm run lint:hooks` (exit 0, or exit 127 with the diff naming no shell
file), plus `cd extension && npm run test:unit` because the CLI bundle is shipped
with the extension.

Concurrent deliveries: `gh pr list --state open` on the product repository returned
no open PRs on 2026-10-04 — no overlap.

## Approach

1. **Pure helpers** in `scripts/session-state.mjs`:
   - `halfState({ path, own, worktrees, companionWorktrees, origin, expectedOrigin, onDisk })`
     → `{ onDisk, registeredIn: "product" | "companion" | null, origin,
     expectedOrigin, ok }`, where `registeredIn` is the clone whose list contains the
     path (realpath compare, own repo first) and
     `ok = onDisk && registeredIn === own && origin === expectedOrigin`.
   - `companionWarning({ pair, onDisk, productWorktrees, companionClone, productRoot })`
     → `null` unless the half is on disk and `pair.registered` is false; then
     `companion-unregistered: <path> exists but is not a registered worktree of <companionClone>`,
     with `; it is registered in <productRoot> instead — git -C <productRoot> worktree remove <path>`
     appended when the product list contains the path.
2. **CLI** in `scripts/agento.mjs`:
   - `paths <kind> <id>` gains `worktreeState` (product half, `own: "product"`,
     expected origin = `git -C <root> remote get-url origin`) and, in companion mode,
     `companion.state` (`own: "companion"`, expected origin =
     `git -C <artifactsRoot> remote get-url origin`); `origin` is read with
     `git -C <half> remote get-url origin` only when the half is on disk, else
     `null`. In-repo: `companion` stays `null`. Usage header names the new fields.
   - `session` appends `companionWarning(...)` to `warnings[]` (product list from the
     `worktrees` it already parsed, companion clone `artifacts.dir`).
   - Resync `extension/cli/` with `npm run copy-cli`.
3. **Prompts** (`.github/prompts/` and the `commands/` mirrors):
   - `start-session` plan mode step 3 and build mode step 3, `start-freehand`
     step 3: add the product half with `git -C <primary> worktree add …`; after the
     add(s), run `agento.mjs paths <kind> <id>` and require `worktreeState.ok` and,
     with a pair, `companion.state.ok`. A failing half stops the command with a §9
     failed result naming `registeredIn`, `origin` vs `expectedOrigin`, and the exact
     `git -C <registeredIn clone> worktree remove <path>` fix; never remove it
     automatically and never write the workspace file or open a window for a failed
     pair. A reused (already registered) half runs the same check.
4. **Docs**: `docs/commands.md` (`paths` fields; `session` warning),
   `docs/concurrency.md` `## Worktrees` (one sentence: both halves are verified after
   creation), `CHANGELOG.md` `## Unreleased` **Fixed.** bullet `(#86)`.

## Risks

- **Origin comparison false negatives** (an `insteadOf` rewrite, a trailing `.git`
  difference, or SSH vs HTTPS between a clone and its worktree): worktrees share
  the clone's `.git/config`, so `remote get-url origin` returns the identical string
  for a correctly registered half. Mitigation: compare raw strings from the same
  command on both sides; test both pass and fail cases.
- **Over-warning**: a companion half that is merely absent (never created, or
  closed) must stay silent — existing tests at `scripts/agento.test.mjs` ≈L279,
  L636, L862 assert that shape. Mitigation: warn only when the path exists on disk;
  keep those tests green unchanged.
- **Cost of `paths`**: two to four extra `git` calls per invocation; `paths` runs
  only from the session-mutating prompts. Acceptable.
- **Prompt drift** between `.github/prompts/` and `commands/`: mitigated by
  `cmp` checks in each prompt step and `tests/customizations.test.mjs`.
- **CLI bundle drift**: mitigated by `npm run copy-cli` in the same step and
  `tests/extension-bundle.test.mjs`.

## Out of scope

- `doctor`, `close-session`, and `ship` acting on an unregistered-but-present
  companion half (Decision 5) — recorded as a roadmap follow-up.
- Automatic repair or removal of a misregistered half (Decision 2).
- New fields on `session.companion` (shape kept for the extension parser and tests).
- The SessionStart hook's `Session:` line (it does not print `warnings[]`).
- Any change to hook scripts.

## Acceptance checklist

- [ ] The exposing regression test in `scripts/agento.test.mjs`, named
  `session warns and paths reports ok: false when the companion half is registered in the product clone (#86 companion-half-registration)`,
  fails before the fix and passes after it — verify: roadmap step 1.1 records the
  failing run; `node --test scripts/agento.test.mjs` exit 0 with that test `ok`.
- [ ] `agento.mjs paths <kind> <id>` reports `worktreeState` and, in companion mode,
  `companion.state`, each `{ onDisk, registeredIn, origin, expectedOrigin, ok }`;
  `ok` is `true` for a correctly created pair and `false` (with `registeredIn:
  "product"` and the product origin) for the misregistered half; in-repo mode keeps
  `companion: null` — verify: the #86 test plus a correctly-created-pair case in
  `scripts/agento.test.mjs`; `session-state.test.mjs` unit tests for `halfState`.
- [ ] `agento.mjs session` adds exactly one `companion-unregistered:` warning when
  the companion half exists on disk but is not registered in the companion clone,
  naming the product clone and the `git -C <product> worktree remove <path>` fix when
  the product registers it; no warning when the half is absent or correctly
  registered; `session.companion` shape unchanged — verify: the #86 test; existing
  companion `deepEqual` tests pass unchanged; a `session-state.test.mjs` unit test for
  `companionWarning`.
- [ ] `start-session` (plan mode step 3, build mode step 3) and `start-freehand`
  (step 3) add the product half with `git -C <primary>`, run `paths` after the add(s),
  require `worktreeState.ok` and `companion.state.ok`, and on failure stop naming
  `registeredIn` and the `git -C <…> worktree remove <path>` fix without removing
  anything or writing the workspace file; each prompt equals its `commands/` mirror —
  verify: `grep` hits in both prompts; `cmp` silent; `node --test
  tests/customizations.test.mjs` exit 0.
- [ ] Running [evidence/repro.sh](evidence/repro.sh) against this branch's CLI shows
  `companion.state.ok: false` with `registeredIn: "product"` from `paths` and the
  `companion-unregistered` warning from `session` — verify: output saved as
  `evidence/repro-output-fixed.txt`.
- [ ] `docs/commands.md` documents the `paths` state fields and the session warning;
  `docs/concurrency.md` mentions post-creation verification; `CHANGELOG.md`
  `## Unreleased` has a **Fixed.** bullet ending `(#86)` — verify: `grep -c`
  ≥ 1 for each.
- [ ] Gate equal to the baseline: `node --test 'scripts/**/*.test.mjs'
  'tests/**/*.test.mjs'` exit 0 with `# fail 0` and more tests than 274; both
  `replay-guard.sh` runs exit 0; `npm run lint:hooks` exit 0, or exit 127 with
  `git diff --name-only origin/main...HEAD` naming no shell file; `cd extension &&
  npm run test:unit` exit 0; `extension/cli/` byte-equal to `scripts/`.

## Resolution

_(written by the Builder at completion)_
