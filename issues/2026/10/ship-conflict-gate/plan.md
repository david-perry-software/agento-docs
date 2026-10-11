# Ship conflict gate never fires; a failed merge strands the roadmap at complete

## Problem

`/agento ship` is supposed to refuse a delivery whose code or companion PR conflicts
with the default branch (hard gaps `pr-conflicting` / `companion-pr-conflicting`, and
`conflicting-pr` in `ship-preflight`). The gate tests `mergeStateStatus ===
"CONFLICTING"`, a value GitHub never emits — a conflicting PR reports
`mergeStateStatus: "DIRTY"` and `mergeable: "CONFLICTING"` — so it never fires.

The second half of the defect is what happens next. The confirm path commits roadmap
`status: complete` before `gh pr merge`, and phase derivation treats "roadmap complete
+ PR open" as phase `checks`, which never re-audits. When the merge then fails (here:
because of the undetected conflict), the delivery is stranded: every re-sent
`/agento ship` skips the audit and fails at the merge again, the build window's
lifecycle reads `shipped` ("the delivery is merged") although nothing merged, and
`/agento continue` points back at ship. The user-visible effect in soshiki:
`email-artifact-attachments` cannot ship, build, or review through the normal
commands.

## Evidence

GitHub issue: #107

Live case — soshiki `feature/email-artifact-attachments`, observed 2026-10-11 with
read-only commands only (`agento.mjs ship` was **not** re-run: at phase `checks` it
would retry `gh pr ready` / `gh pr merge`):

1. `gh pr view feature/email-artifact-attachments --json number,state,isDraft,mergeable,mergeStateStatus,url`
   in `/home/david/DP/soshiki` → [evidence/soshiki-pr520-view.json](evidence/soshiki-pr520-view.json):
   `"number": 520, "state": "OPEN", "isDraft": false, "mergeable": "CONFLICTING", "mergeStateStatus": "DIRTY"`.
2. `node scripts/agento.mjs ship-preflight feature email-artifact-attachments --pr`
   (this branch's CLI, cwd soshiki primary), exit 0 →
   [evidence/soshiki-ship-preflight.json](evidence/soshiki-ship-preflight.json):
   `status: "ok"`, `companionGaps: []`, `pr.mergeStateStatus: "DIRTY"` (no `mergeable`
   field — `prViewArgs` does not request it), companion PR #45 `CLEAN`. No conflict is
   reported.
3. `node scripts/agento.mjs session` in the build window
   `/home/david/DP/soshiki-worktrees/plan-20261010-162041` →
   [evidence/soshiki-build-window-session.json](evidence/soshiki-build-window-session.json):
   `role: "build"`, `delivery.status: "complete"`, `lifecycle: "shipped"`,
   `allowed: ["/agento continue", "/agento delivery-status"]`, `elsewhere[0]`:
   `/agento ship email-artifact-attachments` — "the delivery is merged; re-send ship
   from the primary window to tear this worktree down". `warnings: []`.
4. `node scripts/agento.mjs next` in the same window →
   [evidence/soshiki-build-window-next.json](evidence/soshiki-build-window-next.json):
   `next.invocation: "/agento ship email-artifact-attachments"`, `lifecycle: "shipped"`.

Stubbed reproduction in this repository — [evidence/repro.sh](evidence/repro.sh)
copies `HEAD` to a temp directory, changes only the input of the existing hard-gap
test (`scripts/agento.test.mjs` L4822) from the invalid `{ mergeStateStatus:
"CONFLICTING" }` to the real `{ mergeStateStatus: "DIRTY", mergeable: "CONFLICTING" }`,
and runs that test → [evidence/stub-audit-repro-output.txt](evidence/stub-audit-repro-output.txt):
`not ok 1 - ship audit: every hard gap code in the in-repo layout …`, `expected: 3,
actual: 0`; the audit JSON shows `outcome: "awaiting-confirm"`, `gaps.hard: []` while
`audit.pr` carries `mergeStateStatus: "DIRTY"`, `mergeable: "CONFLICTING"`.

Observed vs expected:

| | Observed | Expected |
| --- | --- | --- |
| Audit, conflicting code PR | `awaiting-confirm`, no gap | `rejected` / `audit-gaps` with `pr-conflicting` |
| Audit, conflicting companion PR | no gap | `companion-pr-conflicting` |
| `ship-preflight --pr`, conflicting companion PR | `companionGaps: []` | `["conflicting-pr"]` |
| Phase `checks`, PR conflicting or merge refused or a required check failing | roadmap stays `complete`; re-send fails again | roadmap reopened to `in-review`, rejected back to the build window; the next ship runs the full audit |

## Decisions

Clarifying questions (2026-10-11), the user's answers verbatim; the recommended option
is marked.

1. **Slug?** Options: `ship-conflict-gate` (recommended), `ship-conflict-self-heal`.
   Answer: `ship-conflict-gate`.
2. **Checks-phase reopen triggers?** Options: "Conflicts + merge 'not mergeable' +
   checks-failed" (recommended), "Conflicts + merge failure only". Answer: "Conflicts
   + merge 'not mergeable' + checks-failed".
3. **How to capture real-run evidence**, given `agento.mjs ship` is not read-only at
   phase `checks`? Options: "Read-only only: gh pr view 520 (mergeable/mergeStateStatus)
   + ship-preflight --pr + a stubbed audit repro in this repo" (recommended), "Stubbed
   repro in this repo only", "Also run `agento.mjs ship` against soshiki". Answer:
   "Read-only only: gh pr view 520 (mergeable/mergeStateStatus) + ship-preflight --pr
   + a stubbed audit repro in this repo".
4. **Part A (unblocking soshiki email-artifact-attachments)?** Options: "Out of scope;
   record it in plan.md as the operational workaround, capture evidence before you run
   it" (recommended), "Out of scope and not mentioned". Answer: "Out of scope; record
   it in plan.md as the operational workaround, capture evidence before you run it".
5. **Where to record the excluded items?** Options: "roadmap.md ## Follow-ups only"
   (recommended), "Follow-ups + file separate GitHub issues now". Answer: "roadmap.md
   ## Follow-ups only".

Decisions carried from the intake text (the user's plan):

- Scope: the enum fix plus the checks-phase self-heal; no Autopilot rule and no
  `deriveLifecycle` "complete-but-open" warning (Follow-ups).
- Soshiki is unblocked independently of this fix (Part A, below).
- The checks-phase re-check covers conflicts, the `not mergeable` merge failure, and
  (answer 2) a failing required check — not `review-stale`: the reopen forces the
  next ship through the full audit anyway, and ship's own changelog-stamp commit would
  false-positive `review-stale` at `checks`.
- `mergeable: "UNKNOWN"` on an open PR is a `warnings[]` entry, not a gap.

**Part A — operational workaround for soshiki (not part of this delivery).** Evidence
above was captured before it runs. In the soshiki build window
(`plan-20261010-162041`): `/agento build-feature email-artifact-attachments` (the
Builder's resume protocol merges `origin/main` into both halves, resolves conflicts,
audits ticked steps, sets `in-progress` → `in-review`, pushes; the Builder's window
check is role-based, so the `shipped` lifecycle does not block it), then
`/agento review-feature email-artifact-attachments`, then
`/agento ship email-artifact-attachments` from the primary window. Use the Builder,
not `/agento ap` (the Autopilot has no `status: complete` branch). Fallback if the
Builder refuses: merge `origin/main` in the product half, set the roadmap header back
to `status: in-review` in the companion half, push (never force-push), review, ship.

## Research

Skills consulted: none — no matching domain (this repository's AGENTS.md has no
`## Agento` skills table and `.agents/skills/` is absent; the work is the Agento CLI's
own Node code, prompts, and docs).

Root cause, with file evidence (line numbers at `origin/main` 3bc80c5):

- `scripts/agento.mjs` L2150: `else if (companionPr.mergeStateStatus === "CONFLICTING") hard.push({ code: "companion-pr-conflicting", … })`.
- `scripts/agento.mjs` L2152: `if (pr.mergeStateStatus === "CONFLICTING") hard.push({ code: "pr-conflicting", … })`.
- `scripts/agento.mjs` L3196 (`ship-preflight`): `else if (companionPr.mergeStateStatus === "CONFLICTING") gaps.push("conflicting-pr")`.
- `.github/instructions/concurrent-delivery.instructions.md` L79 already documents the
  real values: "`BEHIND` means merge main; `DIRTY` means conflicts to resolve".
- `scripts/agento.mjs` L640 `prViewArgs` requests `number,state,isDraft,mergeStateStatus,url`
  (no `mergeable`), used by `lookupPullRequest` / `lookupPullRequestAsync` (L629, L658)
  for `session --pr`, `dashboard`, and `ship-preflight --pr`. `SHIP_PR_FIELDS` (L1903)
  already includes `mergeable`; `prSummary` (L1925) drops it; the audit re-adds it
  only under `audit.pr` / `audit.companionPr` (L2125-L2126).
- Tests mask it: `scripts/agento.test.mjs` L4822 (`{ pr: { mergeStateStatus:
  "CONFLICTING" } }`), L4934 (`{ mergeStateStatus: "CONFLICTING" }` companion),
  `prStub` L1883 (emits `mergeStateStatus` only, from `companionMerge`) with L1940
  `shipWith({ companionMerge: "CONFLICTING" })`. Exact `prViewArgs` field-list
  assertions at L1251, L1283, L1802, L1907. `shipStub` (L4255) already models
  `mergeable` (default `MERGEABLE`).
- Stranding: phase derivation L2065 — `pr.state === "OPEN"` and roadmap
  `status: complete` → `checks`, skipping the audit block (L2101). The confirm writes
  commit `completeRoadmap` (L2270-L2277, function at L2541) and push before
  `gh pr ready` / `wait-for-checks.sh` / `gh pr merge` (L2290-L2323). `checks.code ===
  1` → `fail("checks-failed")` (L2304) and a refused merge → `ghFailure` → `gh-error`
  (L2309); neither touches the roadmap, so the next send is `checks` again.
- `scripts/session-state.mjs` `deriveLifecycle` (L326-L353): `status: complete` →
  `shipped` regardless of the open PR; `TABLE.build.shipped` routes to the teardown
  ship. Reopening to `in-review` returns the lifecycle to `in-review` / `approved`.
- The Builder's window check is role-based (`.github/agents/delivery-builder.agent.md`
  L50), and its resume protocol merges `origin/main` into both halves (L53-L62), so a
  `/agento build-<type> <slug>` handoff after a reopen works in either lifecycle.
- Extension: `extension/src/deliveryTreeModel.ts` L13/L123/L140 only displays
  `mergeStateStatus`; an extra `mergeable` field is ignored. `extension/cli/` is a byte
  copy of `scripts/` (`npm run copy-cli`, guarded by `tests/extension-bundle.test.mjs`).
- `.github/prompts/ship.prompt.md` and its byte mirror `commands/ship.md` map
  `audit-gaps` (L73) and `checks-failed` (L105); `docs/commands.md` L83-L84
  (`ship-preflight`: "`conflicting-pr` (`mergeStateStatus: CONFLICTING`)") and the
  ship paragraph L174-L245; delivery-policy §9 idempotency row for `/agento ship`.
- `CHANGELOG.md` uses a plain `## Unreleased` heading (no version bump; 0.7.0 in
  `package.json`, `.claude-plugin/plugin.json`, `extension/package.json`), so no
  `changelog-unstamped` interplay for this delivery.

Concurrent deliveries: `gh pr list --state open --json number,headRefName` → `[]`. No
overlap. Two other detached planning worktrees exist (`plan-20261011-143125`,
`plan-20261011-143418`) with no published branch.

Lint baseline (policy §5), run 2026-10-11 at 3bc80c5 in the product half:

- `npm run lint:hooks` (`shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`,
  the repository's only lint) → exit 127, `sh: 1: shellcheck: not found` (tool absent
  on this machine; no findings to assess).
- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → exit 0, `# tests 436`,
  `# pass 436`, `# fail 0`.
- `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` and
  `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt`
  → exit 0 and exit 0.

Overlap decision: the lint tool is absent, not red, and this delivery touches no shell
file (`scripts/hooks/`, `scripts/wait-for-checks.sh`). **Scoped gate**: the full node
suite (count must exceed 436 with `# fail 0`), both guard replays exit 0,
`node --test tests/extension-bundle.test.mjs` after `copy-cli`,
`cd extension && npm ci && npm run test:unit`, `npm run lint:hooks` exit 0 — or exit
127 with `git diff --name-only origin/main...HEAD` naming no `scripts/hooks/` or
`scripts/wait-for-checks.sh` path — and a final re-run compared against this baseline.

## Approach

All code changes in the product half; `extension/cli/` refreshed by `copy-cli`.

1. **Conflict predicate** (`scripts/agento.mjs`). Add
   `const isConflicting = (pr) => pr?.mergeable === "CONFLICTING" || pr?.mergeStateStatus === "DIRTY";`
   next to `prSummary`. Use it for `companion-pr-conflicting` (L2150), `pr-conflicting`
   (L2152), and `ship-preflight`'s `conflicting-pr` (L3196). Add `mergeable` to
   `prViewArgs` (`number,state,isDraft,mergeStateStatus,mergeable,url`) and to
   `prSummary` (`mergeable: pr.mergeable ?? null`). In the audit, an `OPEN` code or
   companion PR with `mergeable === "UNKNOWN"` pushes
   `pr-mergeable-unknown: GitHub has not computed mergeability for PR #<n> yet; re-send to re-check`
   (`companion-pr-mergeable-unknown` for the companion) onto `out.warnings`, not a gap.
2. **`reopenRoadmap(content, { date, codes })`** (`scripts/agento.mjs`, beside
   `completeRoadmap`): `status: in-review`, `last-updated: <date>`, `next-step:
   "ship reopened (<codes>): resolve in the build window, then re-review"`, and remove
   the `## Follow-ups (accepted at ship)` section `completeRoadmap` appended (heading to
   the next `## ` or end of file), leaving every other section byte-identical. Pure
   and exported for a unit test.
3. **Self-heal at phase `checks`.** A `reopen(codes, detail)` closure inside `ship()`:
   switch the artifact target onto the branch when there is no owner (reuse
   `switchTo` + `restores`), fast-forward it to `origin/<branch>`, write
   `reopenRoadmap`, commit `docs(<type>): reopen <slug> (<codes joined by ", ">)` in
   the artifact target (companion half in companion mode, product checkout in-repo),
   push it (`push(…, "companion")` or `"product"`), restore, and
   `act("roadmap-reopened", …)`. `rejectTo` is `/agento build-<type> <slug>` (build
   window) with an owner, else `/agento start-session <type>/<slug> --resume`
   (primary). Triggers:
   - **Before any write at `checks`** (right after `out.phase`/`resumedAt` are set
     and before the fast-forward / integrate / stamp block): `isConflicting(pr)` →
     `pr-conflicting`; `external && isConflicting(companionPr)` →
     `companion-pr-conflicting`. On a hit: reopen, then `reject("audit-gaps", …)` with
     `gaps.hard` holding those entries (same `code`/`detail` text as the audit) —
     no `pr ready`, no wait, no merge.
   - **`gh pr merge` refused as not mergeable** (stderr matching
     `/not mergeable|merge conflict/i`): reopen with `pr-conflicting`, then
     `reject("audit-gaps", …)`. Any other merge failure keeps today's `ghFailure`.
   - **`checks.code === 1`**: reopen with `checks-failed`, then keep today's result
     (`status: "failed"`, `reason: "checks-failed"`, `rejectTo`), now with the
     `roadmap-reopened` action. `rejectTo` gains the no-owner `start-session --resume`
     form instead of `null`.
   A re-send after any reopen derives phase `audit` (roadmap no longer `complete`),
   which writes nothing and reports the gaps (including `review-stale` once the
   conflict resolution lands). Pending checks (exit 2) never reopen.
4. **Tests** (`scripts/agento.test.mjs`): replace every `mergeStateStatus:
   "CONFLICTING"` with `{ mergeStateStatus: "DIRTY", mergeable: "CONFLICTING" }`
   (L4822, L4934); `prStub` gains a `mergeable` field per side (`companionMergeable`)
   and L1940 uses `{ companionMerge: "DIRTY", companionMergeable: "CONFLICTING" }`;
   update the exact field-list assertions (L1251, L1283, L1802, L1907) and the
   deep-equal `pr` expectations that now carry `mergeable`. New tests per roadmap
   Phase 1/3/4.
5. **Prompt, docs, policy, changelog.** `.github/prompts/ship.prompt.md` (+ byte
   mirror `commands/ship.md`): under `audit-gaps`, a result with `resumedAt: "checks"`
   reports the `roadmap-reopened` action (it is a write) and the reopened status;
   under `checks-failed`, the same. `docs/commands.md`: `ship-preflight`
   `conflicting-pr` reads `mergeable: CONFLICTING` / `mergeStateStatus: DIRTY`; the
   ship paragraph documents the `checks`-phase reopen and the `UNKNOWN` warning;
   `prViewArgs` field list where documented. `delivery-policy.instructions.md` §9
   `/agento ship` row gains "a conflict, a refused merge, or a failing required check
   found at `checks` reopens the roadmap to `in-review` and rejects back to the build
   window". `CHANGELOG.md` `## Unreleased`: one **Fixed.** bullet ending `(#107)`.
6. **Bundle and gate**: `cd extension && npm run copy-cli`; the scoped gate above.

## Risks

- **Reopen ordering on the no-owner path**: by the time of the merge-failure and
  checks-failed triggers, `restores` have already switched the primary (and companion
  clone) back. Mitigation: the `reopen` closure re-runs `switchTo` and its own restore;
  a test covers the no-owner merge-failure path.
- **`review-stale` after a reopen** when ship already stamped the changelog: expected
  and desired — the conflict resolution is new code that needs re-review. Documented
  in the ship prompt.
- **Lifecycle after reopen with an approving review is `approved`**, so `/agento
  continue` and the build window point at ship first; ship's audit then rejects with
  `pr-conflicting` and names the Builder. One extra round-trip, no stranding. `/agento
  ap` on `in-review` goes straight to review, not conflict resolution — the Builder is
  the reject target. Recorded as a Follow-up (Autopilot rule) per the user's scope.
- **`mergeable` is computed lazily by GitHub** (`UNKNOWN` on a first read): treated as
  a warning; a conflict that appears only after the audit is caught by the
  `checks`-phase re-check or the merge-refusal trigger.
- **Merge-refusal stderr matching** may miss a wording change in `gh`. Mitigation: the
  `checks` pre-merge re-check catches `DIRTY`/`CONFLICTING` first; the stderr match is
  the race backstop only.
- **Concurrent deliveries**: no open PRs at planning time; integrate `origin/main` by
  merge before every push (`scripts/agento.mjs` and `scripts/agento.test.mjs` are
  hotspots).
- No `(manual)` or `(manual, post-ship)` steps: everything is CLI- and test-driven.

## Out of scope

- Unblocking soshiki `email-artifact-attachments` (Part A, operational, above).
- An Autopilot rule for `status: complete` with an open PR.
- A `deriveLifecycle` "complete-but-open" warning (and correcting the build window's
  "the delivery is merged" reason text when the PR is still open).
- Reopening on `review-stale` at `checks`.
- Any change to `wait-for-checks.sh` or the extension UI.

## Acceptance checklist

- [ ] The exposing regression test `ship audit rejects a PR GitHub reports as conflicting (#107 ship-conflict-gate)` in `scripts/agento.test.mjs` fails before the fix (recorded in roadmap step 1.2) and passes after it — `node --test --test-name-pattern='#107' scripts/agento.test.mjs` exit 0.
- [ ] A code PR with `mergeable: CONFLICTING` / `mergeStateStatus: DIRTY` is a hard `pr-conflicting` gap; the same on the companion PR is `companion-pr-conflicting`; `ship-preflight --pr` reports `conflicting-pr` for it — covered by the updated L4822 / L4934 / L1940 tests.
- [ ] No source, test, or doc still treats `CONFLICTING` as a `mergeStateStatus` value — `grep -rnE 'mergeStateStatus[^,]{0,6}CONFLICTING|mergeStateStatus: CONFLICTING' scripts docs .github commands` prints nothing.
- [ ] `prViewArgs` and `prSummary` carry `mergeable`; an open PR with `mergeable: UNKNOWN` yields a `pr-mergeable-unknown` warning and no gap — unit test.
- [ ] `ship --confirm` re-sent at phase `checks` with a conflicting PR (in-repo with owner, companion with owner) returns `rejected` / `audit-gaps` with `pr-conflicting` (or `companion-pr-conflicting`), `actions[]` containing `roadmap-reopened`, `origin/<branch>` roadmap at `status: in-review` with no `## Follow-ups (accepted at ship)` section, and no `pr ready` / `pr merge` in the gh stub log — tests.
- [ ] A `gh pr merge` refused as not mergeable reopens the roadmap the same way (including the no-owner path, with the primary restored to its branch) — test.
- [ ] A failing required check at `checks` keeps `failed` / `checks-failed`, adds `roadmap-reopened`, leaves `origin/<branch>` at `status: in-review`, and the next send runs the audit (`resumedAt: "audit"`) — test.
- [ ] `reopenRoadmap` restores `in-review`, sets `last-updated` and `next-step`, removes only the accepted-at-ship follow-ups section — unit test.
- [ ] `.github/prompts/ship.prompt.md` and `commands/ship.md` are byte-identical and describe `roadmap-reopened`; `docs/commands.md`, delivery-policy §9 ship row, and `CHANGELOG.md` (`(#107)`) are updated — `cmp`, `grep`, `node --test tests/customizations.test.mjs`.
- [ ] `extension/cli/` matches `scripts/` — `node --test tests/extension-bundle.test.mjs` exit 0.
- [ ] Scoped gate (policy §5) green against the baseline: full node suite exit 0 with `# tests` > 436 and `# fail 0`; both guard replays exit 0; `cd extension && npm run test:unit` exit 0; `npm run lint:hooks` exit 0, or 127 with no shell file in `git diff --name-only origin/main...HEAD`.
- [ ] `evidence/repro.sh` against this branch's `HEAD` exits 0 (the hard-gap test passes with the real GitHub values) — output saved as `evidence/repro-output-fixed.txt`.
