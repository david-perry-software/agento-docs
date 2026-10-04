# Review: companion-half-registration

Verdict: approve

Review round 1. Reviewed 2026-10-04 at product `2bb2a72` (code PR #87, draft,
`mergeStateStatus: CLEAN`, CI `test` pass, body starts `Fixes #86`) and companion
`7621494` (agento-docs PR #26, draft, `CLEAN`). `origin/main` is an ancestor of HEAD
in both halves; the session record shows the companion half on
`issue/companion-half-registration`, `dirty: false`, `ahead: 0`, `behind: 0`.

Skills consulted: none — no matching domain (no `.agents/skills/`, no `## Agento`
skills table in AGENTS.md; the change is the Agento CLI, prompts, and docs).

All verification below was re-run independently by the Reviewer:

| Check | Command | Result |
| --- | --- | --- |
| Preflight | `agento.mjs doctor --for review-issue` | exit 0, every check `ok` |
| Node suite | `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | exit 0, `# tests 277`, `# pass 277`, `# fail 0` (baseline 274) |
| New tests | same run | `ok 22` (#86 regression), `ok 161` (`halfState`), `ok 162` (`companionWarning`) |
| Exposing test pre-fix | `git archive f517452` into `/tmp/rv-pre`, `node --test scripts/agento.test.mjs` | exit 1, 86 tests, 85 pass, the only `not ok` is test 9 — the #86 test |
| Guard smoke | `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` | exit 0 |
| Guard smoke (companion) | `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` | exit 0 |
| Shell lint | `npm run lint:hooks` | exit 127 (`shellcheck` not on PATH); `git diff --name-only origin/main...HEAD` names 0 paths under `scripts/hooks/` or `scripts/wait-for-checks.sh` — the plan's accepted gate |
| Extension unit | `cd extension && npm run test:unit` | exit 0, 114/114 |
| CLI bundle | `cmp scripts/{agento,session-state}.mjs extension/cli/…` | silent (byte-equal) |
| Prompt mirrors | `cmp .github/prompts/start-{session,freehand}.prompt.md commands/start-{session,freehand}.md` | silent |
| Prompt greps | `grep -c` `worktreeState.ok` / `companion.state.ok` / `git -C <primary> worktree add` | start-session 3/3/3, start-freehand 1/1/1 |
| Docs greps | `grep -c` in `docs/commands.md`: `companion-unregistered` / `worktreeState` / `registeredIn`; `(#86)` in `CHANGELOG.md` | 1 / 1 / 2; 1 |
| Repro on this branch | `CLI=<product half>/scripts/agento.mjs bash evidence/repro.sh` | exit 0; `paths` `companion.state` `registeredIn: "product"`, `ok: false`; `session` carries one `companion-unregistered:` warning naming `git -C …/proj worktree remove …/proj-docs-worktrees/plan-20261004-1` |
| Edge probe | in that repro, `git -C proj worktree remove wt/plan-20261004-1`, then `paths plan 20261004-1` | see Finding 1 |

No browser verification applies: every acceptance item is CLI, prompt text, or docs.

## Acceptance checklist results

1. **Exposing regression test** — pass. The named test fails before the fix (pre-fix
   archive: exit 1, only test 9 `not ok`, on the warning count) and passes after
   (`ok 22` in the full run; roadmap 1.1 records the same failing run).
2. **`paths` reports `worktreeState` / `companion.state`** — pass.
   `scripts/agento.mjs` `case "paths"` emits both via `halfState()`
   (`scripts/session-state.mjs`); the extended companion-mode test in
   `scripts/agento.test.mjs` asserts `ok: true` with `registeredIn`
   `"product"`/`"companion"` for a correctly created pair, `ok: false` with
   `registeredIn: null` when absent, and `companion: null` + `worktreeState` in-repo;
   the #86 test asserts `registeredIn: "product"` and the product origin for the
   stray half; `halfState` unit test covers ok pair, wrong clone, wrong origin, not
   on disk.
3. **`session` adds exactly one `companion-unregistered:` warning** — pass. The #86
   test asserts exactly one entry naming `repo` and `git -C ${repo} worktree remove`;
   `companionWarning` unit test covers absent pair, not on disk, registered, base
   message, and product-clone suffix; `session.companion` shape unchanged (existing
   `deepEqual` assertions pass unmodified; repro output shows the same seven keys).
4. **Prompts verify both halves after `git worktree add`** — pass. Shared
   precondition 3 of `.github/prompts/start-session.prompt.md` defines the post-add
   check (hard stop before the workspace file or window, `registeredIn`, `origin` vs
   `expectedOrigin`, the `git -C <clone> worktree remove <path>` fix, never removing
   anything); plan and build mode step 3 add the product half with `git -C <primary>`
   and cite it; `.github/prompts/start-freehand.prompt.md` step 3 does the same
   inline. Mirrors byte-equal; `tests/customizations.test.mjs` passes in the suite.
5. **Repro against this branch** — pass.
   [evidence/repro-output-fixed.txt](evidence/repro-output-fixed.txt) and the
   Reviewer's own rerun both show `companion.state.ok: false`,
   `registeredIn: "product"`, and the warning.
6. **Docs and changelog** — pass. Counts above; `docs/concurrency.md` `## Worktrees`
   gains the post-creation verification sentence.
7. **Gate equal to the baseline** — pass. 277 > 274 with `# fail 0`; both replays
   exit 0; `lint:hooks` exit 127 with no shell file in the diff; extension unit
   114/114; `extension/cli/` byte-equal.

## Plan vs implementation

- Matches the plan's Approach items 1–4. `resolveSessionPaths()` additionally
  returns `productWorktrees` so `paths` reuses the list it already parsed — an
  internal detail, no output change.
- Documented deviations, both acceptable: the two `paths` tests that `deepEqual` the
  `paths` `companion` block now strip `state` and assert it separately (roadmap 2.2
  repair — the plan's "unchanged" list was about `session.companion`, which is
  indeed unchanged); start-session's post-add check lives once in shared
  precondition 3 and both modes cite it (roadmap 3.1).
- No undocumented changes: the 13 files in the product diff are exactly the plan's
  CLI, bundle, tests, prompts, mirrors, docs, and changelog.

## Roadmap audit

Every ticked box (1.1, 2.1, 2.2, 2.3, 3.1, 3.2, 4.1, 5.1, 5.2) was spot-checked
against the code and the commands above and holds; each step has its own product
commit (`f517452` … `2bb2a72`) and companion tick commit. No `(manual)` or
`(manual, post-ship)` steps. No repairs made.

## Findings

1. **Minor — `worktreeState` can bless a stray half as the product half.**
   `resolveSessionPaths()` resolves the product half with `managedWorktreePath()`,
   whose basename fallback (`scripts/agento.mjs`, `managedWorktreePath`) accepts any
   product-clone entry named `<kind>-<id>`, including one under the companion
   worktrees dir. Reproduced: with the stray companion half registered in the
   product clone and the real product half absent, `paths plan 20261004-1` returns
   `worktree: …/proj-docs-worktrees/plan-20261004-1` and
   `worktreeState: { registeredIn: "product", origin: …/proj.git, ok: true }`. The
   pair is still stopped — `companion.state.ok` is `false` and the fix it names
   (`git -C <primary> worktree remove <stray>`) is correct — and the prompts add the
   product half first, so this needs a failed or skipped product add to reach. The
   fallback predates this delivery. Suggested follow-up: have `halfState` (or the
   fallback) also require the half to sit in its own worktrees directory.
2. **Nit — `registeredIn` for a prunable entry.** `halfState()` reports
   `registeredIn` from the worktree lists even when `onDisk` is false, so a
   registered-but-deleted half yields `onDisk: false, registeredIn: "product"`; the
   prompts' "`registeredIn: null` means the add never landed" reading does not cover
   it. `ok` is `false` either way, so the command still stops; wording only.

No security concerns: new `git` calls use argument arrays via the existing `git()`
helper, no shell interpolation, no secrets.

## Follow-ups

- `paths`: stop the `managedWorktreePath()` basename fallback (or `halfState`) from
  accepting a product-clone entry that lives in the companion worktrees directory as
  the product half (Finding 1).
- From the roadmap: `doctor`, `close-session`, and `ship` acting on an
  unregistered-but-present companion half (plan.md Decision 5).
