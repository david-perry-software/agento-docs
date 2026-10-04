# Ship treats untracked-only owner dirt as a confirmable cleanup, and agents hand off clean trees (ship-untracked-byproducts)

## Problem

`/agento ship` audits the worktree that owns the delivery branch before it writes
anything. Today the clean check is a single boolean in the ship prompt:
`git -C <owner.path> status --porcelain` must print nothing, or ship hard-rejects with
"the owner worktree dirty or unpushed" and sends the user to
`/agento build-<type> <slug>` ([ship.prompt.md](https://github.com/david-perry-software/agento/blob/main/.github/prompts/ship.prompt.md)
lines 78–81 and 135–147, mirrored byte for byte in `commands/ship.md`). A worktree
that is dirty **only with untracked byproducts** — screenshots and test output an e2e
run left behind — isn't Builder work, but it still costs a Builder round-trip.
`git worktree remove` at ship's teardown would also refuse those files.

The byproducts exist because no delivery role is required to leave a clean tree.
The Builder's Completion and Pause protocol and the Reviewer's step 8 check the
companion half's `dirty`/`ahead` but never require
`git status --porcelain --untracked-files=all` to be empty in the product half.

The companion half has the opposite problem. `companionGaps: ["dirty"]` is a correct
hard reject (untracked files there may be uncommitted evidence), but the gap names no
files and offers no choice.

## Evidence

GitHub issue: #88

**Reported (2026-10-04, Soshiki, shipping `feature/web-shared-modules`):**
`/agento continue web-shared-modules` → `/agento ship` hard-rejected with "owner
worktree dirty". `git -C /home/david/DP/soshiki-worktrees/plan-20261004-152122 status
--porcelain --untracked-files=all` listed 40 untracked PNGs under
`features/2026/0{8,9}/<other-slug>/evidence/` plus a top-level `evidence` file. None of
them belonged to the slug being shipped. The review was `approve`, both PRs were
`CLEAN`/`MERGEABLE`, the companion half was clean, and `companionGaps: []`. The stray
files were the only gap. The Reviewer had deleted `test-results/` but not these. That
worktree has since been torn down: none of the five remaining Soshiki worktrees match
it, and none carry stray files (checked 2026-10-04).

**Reproduced 2026-10-04** from this planning worktree (HEAD `f8529c9` = `origin/main`)
with [evidence/repro.sh](evidence/repro.sh), run as
`CLI=<product half>/scripts/agento.mjs bash evidence/repro.sh` (exit 0). It builds a
throwaway `/tmp` product repo (default branch `trunk`, so the delivery guard allows its
fixture commits) with an owner worktree `feature-widget`. That worktree has a pushed
branch, nothing ahead of its remote, no tracked changes, and two untracked files: one
inside an untracked directory and one at the top level. Full output:
[evidence/repro-output.txt](evidence/repro-output.txt).

Observed:

- `status --porcelain --untracked-files=all` → `?? evidence` and
  `?? features/2026/09/other-slug/evidence/step-1-1-x.png`;
  `--untracked-files=no` → empty; ahead `0`. The tree is untracked-only.
- `agento.mjs ship-preflight feature widget` → `status: ok`, `owner: { path, role:
  "build", dirPrefix: "feature", id: "widget" }`, `companionGaps: []`. Nothing about the
  owner tree, so the prompt's boolean check turns this into the hard reject.
- `git clean -n` (no `-d`) lists only `evidence`; it **misses the file inside the
  untracked directory**, which is the reported layout. `git clean -n -d` lists
  `features/2026/09/` (a whole directory, not the files). Neither is a faithful file
  list. `status --porcelain --untracked-files=all` is.
- Explicit-path deletion works: in the same fixture,
  `git clean -f -- evidence features/2026/09/other-slug/evidence/step-1-1-x.png` removed
  exactly those two files (exit 0). Status was then empty, and `git worktree remove`
  succeeded (exit 0) even though the now-empty directories were still on disk.

Expected: `ship-preflight` reports the owner tree as tracked vs untracked plus the
ahead count. Ship offers an untracked-only owner as a confirmation-path cleanup of
exactly the listed paths. A dirty companion half stays a hard reject, but the gap
lists the files and names the commit-or-discard choice. Builder and Reviewer hand off
only clean trees.

## Decisions

Clarifying answers, 2026-10-04 (verbatim):

1. **Two issues.** The ship handling + clean-exit rule are one concern (worktree-dirt
   semantics, all in the Agento repo). The `gh`/wait-script repo-resolution hardening
   is a different root cause and touches a different repo (the script lives in
   Soshiki, the call forms in Agento prompts), so it should be its own issue. Split:
   - **Issue A (Agento):** ship's untracked-only owner handling + the clean-exit rule.
   - **Issue B (Soshiki `scripts` + Agento prompts):** `--repo` everywhere +
     `wait-for-checks.sh run --repo` + the zero-check silence.
2. **(a), and yes — ignored files out of scope.** `git clean -n` (no `-x`/`-X`) lists
   only untracked, non-ignored files, which is exactly what makes `status --porcelain`
   dirty; ignored files never block ship and shouldn't enter the logic. Ship listing
   `clean -n` and deleting on your explicit yes through the existing confirmation path
   is the right shape — it keeps cleanup where the worktree is owned and kills the
   Builder round-trip for a non-builder concern.
3. **Distinguish in the report for both, but keep the companion half stricter.**
   Product-half untracked-only → confirmation-path deletion (they're byproducts).
   Companion-half untracked → still a hard reject, because it may be uncommitted
   evidence; the improvement is that the gap lists the files (`git -C
   <companion.path> clean -n`) and names the commit-or-discard choice rather than just
   saying "dirty". Deleting a Reviewer's just-captured evidence on ship's say-so would
   be data loss.
4. **One rule in delivery-policy, cited by both agents** — that's the whole point of
   it being the single source. Place it in §7 (Git rules), since the invariant is git
   state ("empty `status --porcelain --untracked-files=all` at handoff"), with the
   remedy being "delete byproducts, never commit them". Recurring byproducts: fix the
   producer first (route output to the correct sink, as the Soshiki issue already
   does), and record a follow-up rather than reaching for `.gitignore`; reserve
   `.gitignore` for genuinely generated artifacts.
5. **Yes — `--repo <nameWithOwner>` everywhere**, resolved inside the clone via `gh
   repo view --json nameWithOwner`, and drop the `cd <artifactsRoot> && gh …` form
   entirely. Code-PR calls should pass `--repo` too — the terminal cwd proved
   unreliable in this very ship, and being cwd-independent is cheap. `wait-for-checks.sh
   run` needs a `--repo` flag (only `pr` has one today), and it should print a
   `RESULT:` line even when a PR has zero required checks. The script change is a
   Soshiki patch: bump `package.json` version and add a `CHANGELOG.md` entry; the
   Agento prompt text changes follow Agento's own release/versioning.

Planner notes on the answers:

- Answer 5 belongs to Issue B and is out of scope here (see `## Out of scope`). Facts
  found during research, handed to Issue B's planning session: Soshiki's
  `scripts/wait-for-checks.sh` is byte-identical to Agento's (`diff` exit 0), which
  `/agento agento-init` scaffolds from the Agento clone
  (`.github/prompts/agento-init.prompt.md` line 194). `run` mode already parses
  `--repo` (the parser is shared; the usage text lists it). Zero checks already print
  `RESULT: success (no checks reported …)` once the PR is `CLEAN` or after the 30s
  grace. What actually fails silently is the 404, auth, and usage exits: they exit 3
  with stderr only and no `RESULT:` line on stdout, and the 404 is exactly what a
  wrong-cwd `run <id>` without `--repo` produces.
- Answer 2's `git clean -n` doesn't list files inside untracked directories (see
  `## Evidence`). To keep the intent (untracked, non-ignored files only), the list comes
  from `status --porcelain --untracked-files=all` (also non-ignored only) through the
  CLI, and deletion is `git clean -f -- <listed paths>`. With explicit paths `-d`
  doesn't matter, and nothing that appears after the listing is touched.

## Research

Skills consulted: none — no matching domain (this repository's AGENTS.md has no
`## Agento` skills table, and no `.agents/skills/` covers git CLI or prompt work).

Where the behavior lives:

- `scripts/agento.mjs` `case "ship-preflight"` (≈L1335–1357) calls
  `evaluateShipPreflight()` (`scripts/delivery-roadmap-resolver.mjs` L268–311), whose
  `owner` comes from `branchOwner()` and is `{ path, role, dirPrefix, id }`. It then
  adds `companion` (`companionOfOwner`) and `companionGaps` (`companionGaps()`, L371:
  `dirty`/`unpushed`/`behind`), and with `--pr` adds `pr`, `companionPr`, and the PR gaps.
  Nothing describes the owner's own tree.
- `describeCompanion()` (L290–299) sets `dirty = git status --porcelain !== ""`, which
  includes untracked files. The `companion` shape `{ path, branch, detached, dirty,
  ahead, behind, registered }` is asserted with `deepEqual` across
  `scripts/agento.test.mjs` (≈L279, 555, 615, 626, 636, 660, 862, 869, 899, 906, 1082)
  and quoted in `docs/commands.md`, policy §11, and the session record. **It must not
  change shape**: new data goes in new sibling fields.
- `scripts/session-state.mjs` holds the pure helpers (`halfState`, `companionWarning`,
  …) with unit tests in `scripts/session-state.test.mjs`. A porcelain parser belongs
  there.
- Ship prompt (`.github/prompts/ship.prompt.md`, byte copy `commands/ship.md`,
  enforced by `scripts/agento.test.mjs` ≈L2742):
  - Ownership bullet, L76–81: the `status --porcelain` + `rev-list --count` clean check.
  - Step 1, L104: "run the clean and zero-ahead checks".
  - Step 2, L133–147: the hard-reject list ("the owner worktree dirty or unpushed";
    `companionGaps` `dirty` names `companion.path`) and the `next:` rule naming
    `/agento build-<type> <slug>`.
  - Step 2, L148–155: the confirmation path, a single summary question with "default
    is do not proceed".
- Builder: `.github/agents/delivery-builder.agent.md` Pause protocol (L108–128) and
  Completion (L130–144). Reviewer: `.github/agents/delivery-reviewer.agent.md`
  step 8 (≈L100–118). Neither requires an empty untracked status. Policy §7
  (`.github/instructions/delivery-policy.instructions.md` L147–169) has no
  clean-handoff rule.
- `tests/customizations.test.mjs` L399–424: canary phrases that may appear only in
  the policy file. The new rule's wording gets a canary, so agents cite §7 instead of
  restating it.
- `extension/cli/` is a generated byte copy of `scripts/`
  (`cd extension && npm run copy-cli`; `tests/extension-bundle.test.mjs` enforces it).
- `docs/commands.md` L60–77 documents the `ship-preflight` fields.
- Git facts verified in the fixture (see `## Evidence`): `--untracked-files=all` lists
  individual files and excludes ignored ones. `git clean -f -- <paths>` removes
  exactly the named untracked files. Empty directories left behind block neither
  `status` nor `git worktree remove`. In `--porcelain=v1 -z` output, rename and copy
  entries (`R`/`C`) carry a second NUL-terminated origin path, which the parser must
  skip.

Concurrent deliveries: `gh pr list --state open` returns `[]` in both
`david-perry-software/agento` and `david-perry-software/agento-docs` (2026-10-04), so
there is no file overlap.

**Lint baseline (policy §5), 2026-10-04 at `f8529c9`:**

- Full-repository lint `npm run lint:hooks` (`shellcheck scripts/hooks/*.sh
  scripts/wait-for-checks.sh`): exit 127, `shellcheck: command not found`. Not
  installed on this machine; CI (`.github/workflows/ci.yml`) runs it.
- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`: exit 0, `# tests 277`,
  `# pass 277`, `# fail 0`.
- `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt`: exit 0.
  `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh <
  tests/guard-fixtures-companion.txt`: exit 0.
- Overlap: this delivery changes no shell file (`scripts/hooks/`,
  `scripts/wait-for-checks.sh`). The unavailable shellcheck is a local tooling gap,
  not a finding. **Gate decision: scoped gate.** Run the full node suite (must
  exceed 277, `# fail 0`), both guard replays (exit 0), `cd extension && npm run
  test:unit`, and `npm run lint:hooks`, which passes when shellcheck reports no
  findings, or when it exits 127 and `git diff --name-only origin/main...HEAD` names
  no shell file. CI's shellcheck job is the authoritative run.

## Approach

1. **Pure parser** in `scripts/session-state.mjs`: export
   `splitPorcelain(zOutput)` → `{ tracked: string[], untracked: string[] }` from
   `git status --porcelain=v1 -z --untracked-files=all`. `??` entries go to
   `untracked`; every other entry goes to `tracked` under its current path, and the
   extra origin token of `R`/`C` entries is skipped. Both arrays are sorted. Ignored
   files never appear (no `--ignored`).
2. **CLI** (`scripts/agento.mjs`): add a `treeState(dir)` helper that returns
   `splitPorcelain(...)` plus `ahead` (the same upstream /
   `HEAD --not --remotes` count `describeCompanion` uses), or `null` when `dir` is
   missing. `ship-preflight` emits two new sibling fields, leaving `owner` and
   `companion` unchanged:
   - `ownerTree: { tracked, untracked, ahead } | null`: `null` when `owner === null`
     or when `owner.role === "primary"` (ship stops on that anyway).
   - `companionTree: { tracked, untracked } | null`: the companion half's lists when
     `companion?.registered`, else `null` (always `null` in the in-repo layout).
   
   `companionGaps` stays exactly as it is. Extend the usage text, then
   `cd extension && npm run copy-cli`.
3. **Ship prompt** (`.github/prompts/ship.prompt.md`, then copy to
   `commands/ship.md`):
   - Ownership bullet and step 1: the owner clean and zero-ahead checks read
     `ownerTree` instead of running `status`/`rev-list`.
   - Step 2 hard-reject: "owner worktree dirty or unpushed" becomes "`ownerTree.tracked`
     non-empty or `ownerTree.ahead > 0`" (still the Builder handoff). The companion
     `dirty` gap now quotes `companionTree.tracked` and `companionTree.untracked`
     verbatim and names the choice: commit them in the companion half (they may be
     evidence) or discard them. Ship itself never deletes or restores anything in the
     companion.
   - Step 2 confirmation path: a new item "untracked byproducts in the owner worktree"
     applies when `ownerTree.untracked` is non-empty, `tracked` is empty, and `ahead`
     is 0. The summary lists every path verbatim. On the user's explicit yes, the
     first write of step 3 is `git -C <owner.path> clean -f -- <each listed path>`.
     Ship then re-runs `ship-preflight` and requires `ownerTree` to be fully empty
     before any other write; anything new is a hard reject. On no (the default),
     nothing is written.
4. **Policy** §7 gains one bullet, the clean-handoff rule: at every handoff (Builder
   completion, Builder pause or session break, Reviewer verdict),
   `git status --porcelain --untracked-files=all` prints nothing in the product
   worktree and, in companion mode, in the companion half. Byproducts written outside
   their sink are deleted, never committed. Evidence is committed under the slug's
   `evidence/`. A recurring byproduct means fixing its producer (route output to its
   sink) and recording a Follow-up; `.gitignore` is reserved for genuinely generated
   artifacts. The Builder (Pause protocol and Completion) and the Reviewer (step 8)
   each cite "policy §7 clean handoff" in one clause and don't restate it. A
   `tests/customizations.test.mjs` canary keeps the wording policy-only.
5. **Docs and changelog:** `docs/commands.md` `ship-preflight` lists `ownerTree` and
   `companionTree`; `CHANGELOG.md` `## Unreleased` gains a **Fixed.** bullet ending
   `(#88)`. No version bump here; Agento's release process stamps versions at ship.

Affected files: `scripts/session-state.mjs`, `scripts/session-state.test.mjs`,
`scripts/agento.mjs`, `scripts/agento.test.mjs`, `extension/cli/*` (generated),
`.github/prompts/ship.prompt.md`, `commands/ship.md`,
`.github/instructions/delivery-policy.instructions.md`,
`.github/agents/delivery-builder.agent.md`, `.github/agents/delivery-reviewer.agent.md`,
`tests/customizations.test.mjs`, `docs/commands.md`, `CHANGELOG.md`.

## Risks

- **Deleting real work.** Mitigations: deletion is limited to the product owner;
  only paths `ownerTree.untracked` listed and the user explicitly confirmed are
  deleted; only when `tracked` is empty and `ahead` is 0; explicit paths, no
  `-d`/`-x`; then a re-check before any further write. The companion half is never
  cleaned by ship.
- **Shape drift.** Changing `owner` or `companion` would break many `deepEqual`
  assertions, the session record, and policy §11 text. Mitigation: new sibling fields
  only, plus a test asserting `owner` keeps exactly its four keys.
- **Policy-restatement test.** Agents that paraphrase the rule could trip the
  customizations canaries. Mitigation: agents cite §7 by name in one clause; the
  canary is a phrase only the policy uses.
- **Byte-copy drift** (`commands/ship.md`, `extension/cli/`). Mitigation: every step
  that edits a source also copies it, and the verifications use `cmp` and the bundle
  test.
- **Concurrent deliveries:** none open (2026-10-04). Integrate `origin/main` by
  merge before every push regardless.

## Out of scope

- Issue B: `--repo <nameWithOwner>` for every `gh` and `wait-for-checks.sh` call,
  dropping `cd <artifactsRoot> && gh …`, and `RESULT:` lines on the poller's
  404/auth/usage exits. Planned separately (see `## Decisions` notes for the facts
  found).
- Ignored files (`git clean -x`/`-X`), and `close-decision` / `/agento close-session`
  handling of a dirty owner (abandon flow).
- Fixing Soshiki's byproduct producer (the e2e screenshot sink). That's a Soshiki
  issue the user says is already tracked.
- Changing `describeCompanion()`'s `dirty` semantics or the `companion` shape.

## Acceptance checklist

- [ ] The exposing regression test `ship-preflight reports the owner tree split into
  tracked and untracked files (#88 ship-untracked-byproducts)` in
  `scripts/agento.test.mjs` fails before the fix (step 1.1 records the run) and
  passes after it. Verify: `node --test scripts/agento.test.mjs` exit 0 with that
  test `ok`.
- [ ] `splitPorcelain()` unit tests in `scripts/session-state.test.mjs` cover
  untracked-only, tracked-only, mixed, a rename entry, and empty input. Verify:
  `node --test scripts/session-state.test.mjs` exit 0.
- [ ] `ship-preflight` emits `ownerTree` (`null` with no owner) and `companionTree`
  (`null` in the in-repo layout), with `owner`, `companion`, and `companionGaps`
  unchanged. Verify: the regression test plus the existing ship-preflight tests pass
  unchanged.
- [ ] Re-running [evidence/repro.sh](evidence/repro.sh) against the branch shows
  `ownerTree: { tracked: [], untracked: ["evidence",
  "features/2026/09/other-slug/evidence/step-1-1-x.png"], ahead: 0 }`. Verify:
  `evidence/repro-output-fixed.txt` committed.
- [ ] The ship prompt sends an untracked-only owner tree through the confirmation path
  (exact paths listed, deleted with `git -C <owner.path> clean -f --` only on an
  explicit yes, then a `ship-preflight` re-check). Tracked changes or `ahead > 0`
  stay a hard reject with the Builder handoff. A companion `dirty` gap lists
  `companionTree` files and names commit-or-discard, with no deletion by ship.
  Verify: the greps in roadmap step 3.1 and `cmp .github/prompts/ship.prompt.md
  commands/ship.md` silent.
- [ ] Policy §7 carries the clean-handoff rule; the Builder (Pause protocol and
  Completion) and Reviewer (step 8) cite it without restating it; a customizations
  canary enforces that. Verify: `node --test tests/customizations.test.mjs` exit 0
  and the greps in step 4.1.
- [ ] `docs/commands.md` documents `ownerTree`/`companionTree`; `CHANGELOG.md`
  `## Unreleased` has one **Fixed.** bullet ending `(#88)`. Verify: greps in step 5.1.
- [ ] Scoped lint gate (see `## Research`): full node suite exit 0 with `# tests` >
  277 and `# fail 0`; both guard replays exit 0; `cd extension && npm run test:unit`
  exit 0; `npm run lint:hooks` exits 0, or exits 127 with no shell file in
  `git diff --name-only origin/main...HEAD`. Verify: counts recorded on step 6.1.
- [ ] The code PR body starts with `Fixes #88`.

## Resolution

_Written by the Builder at completion._
