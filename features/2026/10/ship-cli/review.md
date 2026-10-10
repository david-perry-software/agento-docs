# Review: ship-cli

Verdict: approve

Reviewed 2026-10-10 against product `263694d` (code PR #105, draft) and companion
`c6567d4` (artifact PR #42), both on `feature/ship-cli`. After `git fetch origin` in
both halves, `origin/main` is an ancestor of each HEAD and each HEAD equals its
`origin/feature/ship-cli` (`rev-list --count HEAD..origin/feature/ship-cli` = 0 in
both); both trees were clean before review and stayed clean after every rerun
(`git status --porcelain --untracked-files=all` empty in both). Window check:
`agento.mjs session` → `role: build`, `delivery.slug: ship-cli`, `companion.branch:
feature/ship-cli`, `companion.dirty: false`, `companion.ahead: 0`; `agento.mjs doctor
--for review-feature` → exit 0, every check `ok`.

Skills consulted: none — no matching domain (no `.agents/skills/` in the product
repository; AGENTS.md has no `## Agento` skills table).

Gate rerun by the Reviewer (product worktree at `263694d`):

| Check | Result | Baseline / Builder claim |
| --- | --- | --- |
| `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | exit 0, **420 pass / 0 fail / 0 skipped**, 143.2 s (the Linux-only live-occupant teardown test ran, not skipped) | 393/0 baseline; Builder 420/0 |
| `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` | exit 0, every verdict matching | Builder exit 0 |
| `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` | exit 0, every verdict matching | Builder exit 0 |
| `shellcheck …` | not run: `command -v shellcheck` absent locally (as in the plan baseline); `git diff --stat origin/main...HEAD -- 'scripts/*.sh' 'scripts/hooks/*.sh'` empty | plan: not installed; no `.sh` changed |
| CI on PR #105 head `263694d` (`gh run view 38067294277`) | `Unit tests`, `Shellcheck`, `Guard fixture replay` all `success`; `scripts/wait-for-checks.sh pr 105 --max-seconds 30` → `RESULT: success`, exit 0, `merge=CLEAN` | Builder: green |
| `cd extension && npm run build && npm run test:unit` (node_modules already present from 6.2) | exit 0 / exit 0, **160 pass / 0 fail**; tree unchanged afterwards | Builder 160/0 |
| `cmp scripts/agento.mjs extension/cli/agento.mjs`; every `scripts/*.mjs` vs `extension/cli/` | byte-identical; no bundled file differs | — |
| `git diff --stat origin/main -- extension/src` | empty | — |
| `diff .github/prompts/ship.prompt.md commands/ship.md` | empty | — |
| `git diff origin/main -- .github/instructions/delivery-policy.instructions.md` | exactly the one §6 sentence (`+1 / -1` line) | — |
| `grep -rnP 'agento\.mjs ship\b(?!-preflight)' .github/prompts .github/agents .github/instructions commands` minus the prompt and mirror | only the descriptive §6 sentence in delivery-policy (not a `node …` invocation) | — |
| Independent real run: `node scripts/agento.mjs --root /home/david/DP/agento ship feature ship-cli` (audit only) | exit 3, `status: rejected`, `reason: audit-gaps`, `phase: audit`, `mode: companion`, `pr: 105 OPEN CLEAN`, `companionPr: 42 OPEN CLEAN`, `gaps.hard` = `review-missing` only, `gaps.confirm: []`, `confirmToken: 7aec0d37b84c`, `rejectTo: /agento review-feature ship-cli` (build), `actions: []`, `audit.roadmap.unticked: []`, `diffFiles` = the 10 changed files; `git worktree list --porcelain` + `for-each-ref` of both clones identical before and after — [JSON](evidence/review-audit.json), [before](evidence/review-audit-before.txt), [after](evidence/review-audit-after.txt) | Builder's 6.4 run at the same HEAD: `unticked-steps`, `review-missing`, `companion-dirty`, same token |

Lint gate (§5): the plan recorded a green baseline and chose the full gate. Every
component is satisfied: full `node --test` green with +27 tests and no new failures
(the 27 are the `// --- ship` section and the two new customizations tests), both
replay runs green, shellcheck green on the CI head commit with no `.sh` change, and
the extension build and unit tests green after the bundle copy.

The real run doubles as the token-stability check the plan asks for: the Reviewer's
`confirmToken` equals the Builder's from a commit earlier (`7aec0d37b84c`) because
the hashed gap set (`slug`, `pr`, `companionPr`, empty `confirm[]`) is unchanged,
while the hard-gap set shrank from three codes to one as the roadmap steps were
ticked and the evidence files committed — and with the review the only remaining hard
gap, `rejectTo` switched from `build-feature` to `review-feature` as the plan
specifies.

## Acceptance checklist results

1. **Usage header lists `ship`; bad type, missing slug, extra positionals, `--wait`
   > 60, `--confirm` without a value are `usage-error` exit 1** — pass. Test "ship
   validates its arguments, is listed in the usage header, and --confirm needs a
   value" (`scripts/agento.test.mjs` L4451) runs all nine shapes; `parseArgs` bounds
   `--wait` to 0–60 (`scripts/agento.mjs` L102–104) and `--confirm` rejects a missing
   or `--`-prefixed value (L91–94); usage line L18.
2. **Non-primary window → `rejected` `wrong window: role=…` with `allowed`/`elsewhere`,
   nothing written** — pass. Test L4464 runs from a managed `feature-widget` worktree,
   asserts the reason regex, deep-equals `allowed`/`elsewhere` against `agento.mjs
   session`, `actions: []`, `refState` identical, and no `pr merge|ready|create` in
   the stub log. Implementation L1978.
3. **Audit on an open PR never writes and reports every gap code in both layouts** —
   pass. Tests L4712 (clean feature, refs + worktrees + stub state byte-identical),
   L4768 (`unticked-steps`, `review-missing`, `review-request-changes`, `review-stale`
   with a future-dated commit, `owner-tree-dirty` with paths, `owner-ahead`, both
   together, `owner-tree-unreadable`, `pr-conflicting`,
   `changelog-heading-without-version`, `post-ship-unjustified`, and the no-owner
   `start-session … --resume` reject-back), L4840 (justified post-ship step clean;
   `changelog-unstamped` + `pr-behind` confirm-path), L4897 (companion:
   `companion-pr-behind` confirm-path; `companion-pr-conflicting`,
   `companion-pr-not-open`, `companion-missing-pr`, `companion-dirty` with paths,
   `companion-unpushed`, `companion-behind` hard; each audit asserts no write in
   either clone). The Reviewer's live run above confirms the no-write property
   against real `gh` and two real clones.
4. **Stale `--confirm` → `confirm-stale`, nothing written; a new untracked file
   invalidates a previously valid token** — pass. Test L4712 second half: the token
   survives an unrelated `main` commit, changes when `scratch.png` appears, and the
   old token is rejected with `providedToken`, the fresh `confirmToken`, the current
   `gaps.confirm`, `actions: []`, and the file still present. Implementation L2178.
5. **Confirm on a clean in-repo delivery: literal clean, roadmap complete +
   Follow-ups, changelog stamp, ready, wait, `pr merge <n> --merge`, remote branch
   delete, primary fast-forward, teardown** — pass. Test L4960 asserts the action
   sequence `clean, roadmap-complete, changelog-stamp, push, pr-ready, merge-code,
   delete-branch, sync, teardown`, that `shot[1].png` (untracked) was removed while
   the tracked `shot1.png` shipped, the roadmap header and `## Follow-ups (accepted
   at ship)` on `origin/main`, the stamped `## 1.1.0 (<today>)`, the exact gh vectors
   `pr ready 15` / `pr merge 15 --merge`, the deleted remote and local branch, the
   primary at `origin/main` and clean, the worktree gone, and an `already-shipped`
   re-send with no further gh writes. The stub refuses `--admin`, `--squash`,
   `--rebase`, `--delete-branch` (self-test L4381). Clean spelled at L2247.
6. **Companion mode: roadmap commit in the companion half, both PRs readied, code
   merges first, then companion, both defaults synced, both halves + workspace file
   removed, both local branches deleted** — pass. Tests L5144 (happy path with
   `makePairRepo`) and L5221 (no-owner: the companion clone is switched onto the
   mirrored branch and back; both local branches deleted). Implementation
   L2235–2321 (confirm → checks → merge-code) and L2324–2348 (merge-companion).
7. **Pending check → `pending` exit 2 with the same `--confirm` command; identical
   re-send continues; failing check → `failed`/`checks-failed`, nothing merged** —
   pass. Test L5034: first call exit 2, `phase: checks`, actions `roadmap-complete,
   push, pr-ready`, PR still `OPEN`, roadmap `complete` on the branch; second call
   `resumedAt: checks`, `merge-code …` only, exactly one `pr merge` and one `pr
   ready` in the log; the `FAILURE` rollup yields `checks-failed` with `rejectTo` to
   the build window and no merge.
8. **Resume derives the right phase from every interruption** — pass. Tests L4574
   (in-repo phases), L4645 (companion phases, half-shipped → `merge-companion`,
   sync of both defaults), L5189 (failed companion merge reports the exact
   `code PR #<n> merged, companion PR #<m> open at <url>; re-send /agento ship <slug>
   to resume at the companion merge` sentence), L5242 (sync-only `already-shipped`,
   re-sends never merge/push/PR again), L5396 (live `sleep` process inside the
   companion half → `blocked`/`occupied`/`paused-teardown`, `pausedPath` the half,
   clones and workspace file unchanged, resume after the process exits), L5438
   (`code --status` Folder / Workspace window; a half removed earlier is skipped).
   Derivation at L2062–2069; sync at L2351–2389.
9. **Release phase: `pending`, dispatch exactly once on `dispatch-required`,
   `success`/`superseded-success`/`not-triggered` recorded, `failed`/`no-run`
   stop** — pass. Tests L5289 and L5348 (dispatch happens once across re-sends;
   the created run is followed; success advances to teardown; gh auth failures name
    `gh auth login`). Implementation L2392–2440 reuses `releaseVerdict`
    (L2825–2848), the extracted body of `case "release"`.
10. **Epilogue: `post-ship/<slug>` from fresh default in the artifact checkout,
    `postShip.steps` with `evidencePresent`, land via PR once all ticked with
    evidence, partial evidence stays `post-ship-pending`** — pass. Tests L5468
    (in-repo; ticked step without the evidence file reported `evidencePresent:
    false` and not landed; the CLI never ticks) and L5524 (companion; pending check
    exit 2; re-send reuses the open PR). Implementation L2474–2533 (teardown
    precedes it at L2443–2471).
11. **Missing `Fixes #<n>` appended via REST PATCH with a real blank line, only when
    absent** — pass. Test L4869 asserts the stored body `Reproduces the bug.\n\nFixes
    #12`, exactly one PATCH, `actions: [fixes-line-added]`, and no PATCH on the
    re-send; a roadmap without `github-issue` reports `githubIssue: null` and
    patches nothing.
12. **`closeSession()` and `case "release"` behave as before** — pass. The diff
    (`scripts/agento.mjs` L1793–1805 and L1840–1899, L2825–2848, L3516–3519) moves
    the occupant gate and apply block into `removeSessionPair` and the release body
    into `releaseVerdict` without changing a branch of logic; every pre-existing
    close-session and release test is among the 420 passing.
13. **Prompt and mirror byte-identical; call `find` and `ship` only; keep `Needs:`,
    `doctor --for ship`, §9/§11/§12, `/agento ap <slug>`, `paused at teardown`; no
    `gh pr merge|ready`, `git push origin --delete`, `git worktree remove`,
    `wait-for-checks.sh`, `agento.mjs release`** — pass. `diff` empty;
    `tests/customizations.test.mjs` "ship is one agento.mjs ship call with no
    hand-run fallback procedure" (L310) asserts each pattern; read of
    `.github/prompts/ship.prompt.md` confirms `Needs: terminal, gh, network` (L7),
    the `doctor --for ship` citation (L25), window check `primary` (L26), and the
    judgment-before-confirm step (L42–48) per decision 3.
14. **Only the ship prompt and mirror reference `agento.mjs ship`** — pass. Test
    "only the ship prompt and its mirror reference agento.mjs ship" (L333) over
    prompts, agents, `commands/`, and (as a `node …`/`scripts/` invocation)
    instructions; the Reviewer's grep found only the descriptive §6 sentence.
15. **`clean -f` and REST PATCH tests retargeted** — pass. L470–481 asserts the CLI
    spells `["--literal-pathspecs", "clean", "-f", "--", ` and never `-d`/`-x`, and
    that no prompt/agent/mirror runs `git clean`; L483–493 sets the PATCH example count
    to 7 with the comment pointing at the CLI-side blank-line test.
16. **Policy §6 sentence; docs describe statuses, exit codes, token, phase table** —
    pass. Policy diff is the single sentence. `docs/commands.md` row L15 and the
    `agento.mjs ship` paragraph (L376 ff.) cover the grammar, phase derivation
    including `checks`, `gaps.hard`/`gaps.confirm` codes, `confirmToken` and
    `--confirm`, `--wait` 0–60 default 50, the occupant pause, the epilogue, the
    output shape, and exit 0/1/2/3; `docs/architecture.md` L16 and L86; `CHANGELOG.md`
    `## Unreleased` L5–24.
17. **`extension/cli/` fresh byte copy, no `extension/src` change** — pass. `cmp`
    and the per-file loop report no difference; `git diff --stat origin/main --
    extension/src` empty; `tests/extension-bundle.test.mjs` is in the 420.
18. **Full gate green against the baseline** — pass. Table above: 420/0 (≥ 393),
    both replays exit 0, CI `Shellcheck` success on `263694d`, extension build and
    unit 160/0.
19. **Real-run evidence under `evidence/` linked from 6.4** — pass. The Builder's
    [audit JSON](evidence/step-6-4-audit.json), [before](evidence/step-6-4-before.txt)
    and [after](evidence/step-6-4-after.txt) are committed (`diff` of the snapshots
    empty, `status: rejected`, `reason: audit-gaps`, `actions: []`, `confirmToken`
    non-null, `gaps.hard` naming `unticked-steps` 6.4 and 6.5 as recorded). The
    Reviewer's own run at the same HEAD is linked in the gate table.

Score: 19 / 19 pass, 0 fail, 0 deferred to post-ship.

## Plan vs implementation

- Every file in the plan's "Files touched" list changed and nothing else did:
  `scripts/agento.mjs`, `scripts/agento.test.mjs`, `.github/prompts/ship.prompt.md`,
  `commands/ship.md`, `.github/instructions/delivery-policy.instructions.md`,
  `tests/customizations.test.mjs`, `docs/commands.md`, `docs/architecture.md`,
  `CHANGELOG.md`, `extension/cli/agento.mjs` (10 files, 3 407 + / 774 −). No hook,
  `.sh`, or `extension/src` change.
- Deviations, all documented in the roadmap or docs:
  - The phase enum gained `checks` (an open PR whose roadmap is already `complete`),
    the resume point between the confirm writes and the merge. The plan's table did
    not list it but its output enum did; `docs/commands.md` documents it.
  - `branchVerdict()` was extracted alongside `removeSessionPair()` (not named in
    the plan) so the ship teardown and the no-owner local-branch deletion compute
    the `branch -d` verdict the same way `close-session` does. Behaviour-preserving.
  - The release phase runs whenever `checks.releaseWorkflow` is set (re-deriving the
    verdict each call) rather than only "while not yet terminal"; since
    `releaseVerdict` is a read and terminal verdicts advance immediately, the effect
    is the plan's. Noted as finding 2.
  - `ship` additionally rejects `pr-missing`, `pr-closed`, `owner-diverged`,
    `primary-dirty`, and `owner-tree-changed`; the prompt maps each.
- Undocumented changes: none found. The audit `diffFiles` list equals the 10 files
  above.

## Roadmap audit

All 21 ticked steps were spot-checked against the code and the test log; none is
falsely ticked, and no missing-work step was needed:

- 1.1 / 1.2 — `removeSessionPair` (L1840), `branchVerdict` (L1811), `releaseVerdict`
  (L2825), `ghRun` (L1377) exist with the stated shapes; `closeSession` maps the
  result at L1793–1805; `case "release"` is three lines (L3516–3519).
- 2.1–2.4 — `shipArgs`/`ship`/`case "ship"` (L1904, L1927, L3202), usage line L18,
  `--confirm` parsing, window check, doctor, bounded fetch, preflight in process,
  phase derivation, audit facts, gap sorting, token, `rejectTo`, Fixes patch — each
  with the tests named in the checklist above.
- 3.1–3.4, 4.1–4.3 — stub self-test, confirm writes, companion merge, sync/done,
  release, teardown, epilogue — tests L4381–L5567 as cited.
- 5.1–5.3 — mirror identical, customizations tests, policy diff of one sentence.
- 6.1 — grep shows the docs text; 6.2 — bundle byte-identical, `extension/src`
  untouched, build/unit rerun 160/0; 6.3 — counts reproduced (420/0, replays 0, CI
  green); 6.4 — evidence committed and linked, snapshots identical; 6.5 —
  `origin/main` ancestor in both halves, `status: in-review`, companion clean and
  not ahead.

Repairs made: none.

## Findings

Ordered by severity; none above minor.

1. **Minor — `checks`-phase resume does not require the token and integrates
   `origin/<default>` unprompted.** `scripts/agento.mjs` L2063 derives `checks`
   when the roadmap on the open branch is `complete`; L2235–2321 then readies,
   waits, and merges without re-checking `--confirm` (test L5034 relies on this),
   and L2263 merges `origin/<default>` into the branch if the PR became `BEHIND`
   since the confirm call, recording it in `actions[]`. This is safe by
   construction — the `complete` commit exists only after a token-validated call,
   and policy §7 requires a merge integration before every push — but a re-send
   without `--confirm` at this phase merges, which `docs/commands.md` states
   ("`checks` once the confirm writes landed") and the prompt relies on (step 6:
   re-send `next[0]`, which carries the token only for `checks`). No change
   requested; recorded so the behaviour is deliberate rather than discovered.
2. **Minor — `resumedAt` reads `release` whenever a release workflow is
   configured.** L2066 picks `release` before `teardown`/`epilogue`/`done` when
   `checks.releaseWorkflow` is set, so a re-send after a successful release
   reports `resumedAt: "release"` and re-derives the (terminal) verdict before
   tearing down. Idempotent and read-only; the plan table's "verdict not yet
   terminal" wording is stricter than the code. Cosmetic.
3. **Minor — bundled CLI cannot find `wait-for-checks.sh`.** L1902 resolves
   `WAIT_FOR_CHECKS` from `PLUGIN_ROOT`, which for `extension/cli/agento.mjs` is
   `extension/`; `extension/scripts/wait-for-checks.sh` does not exist. Harmless
   today (the extension routes Ship to chat, plan decision 5) and already recorded
   as a roadmap Follow-up.
4. **Minor — review staleness at commit-second granularity.** L2108 compares
   `%ct` of the review commit and the last code commit, as `reviewFreshness()`
   already does for `next`; a review and a code commit in the same second compare
   as fresh. Already recorded as a roadmap Follow-up.
5. **Informational — security review.** Every `gh` and `git` call goes through
   `execFileSync`/`spawnSync` argument arrays (`ghRun` L1377, `gitRun`), so the
   PR body (untrusted) passed as `-f body=…` (L2171) and user paths passed to the
   literal clean (L2247) cannot be shell-interpreted; `ghRun` sets
   `GH_PROMPT_DISABLED` with stdin closed; the stub-asserted merge vector never
   carries `--admin`/`--squash`/`--rebase`/`--delete-branch`; the occupant gate
   runs with `ignoreOccupants: false` at L2459 (ship never ignores an occupant);
   no secret is read, printed, or logged; the only default-branch writes are
   `fetch --prune` and `merge --ff-only` (`syncDefault`, L2351–2377). The guard
   rules the plan lists as "must hold inside the CLI" hold.

## Follow-ups

- `extension/cli/` lacks `scripts/wait-for-checks.sh`, so the bundled `ship` would
  fail at its first check wait; include the script in `copy-cli` (or assert the
  resolved path in `tests/extension-bundle.test.mjs`) before any extension surface
  calls `agento.mjs ship` directly. (Already in roadmap Follow-ups; restated here
  for triage.)
- `audit.review.stale` and `reviewFreshness()` could compare content (the review
  commit's parent tree vs the code HEAD) instead of commit timestamps to remove the
  same-second ambiguity. (Already in roadmap Follow-ups.)
- Consider making the phase derivation choose `release` only when the stored
  verdict is not yet terminal (or report `resumedAt` as the first phase that
  actually acts), so `resumedAt` matches the plan's table literally.
