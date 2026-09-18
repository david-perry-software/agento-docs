# Delivery guard denies deleting a non-default remote branch from `main`

## Problem

`scripts/hooks/delivery-guard.sh` denies `git push <remote> --delete <work-branch>` (and
the `git push <remote> :<work-branch>` spelling) whenever the checkout is on the
configured default branch, with the reason `Direct commits/pushes to main are forbidden;
use a work branch and a pull request.` — although the command deletes a *non-default*
remote branch and pushes nothing to `main`. `/agento ship` issues exactly that command
from the primary checkout (on `main`) after the merge, so the supported teardown path
is blocked and the user had to fall back to running the delete from the owner worktree.
The guard is the plugin's safety net; a false denial on the documented happy path
trains users to route around it.

## Evidence

GitHub issue: #47

Verified reproduction on 2026-09-18 at product HEAD `d291438` — full transcript in
[evidence/repro-2026-09-18.md](evidence/repro-2026-09-18.md):

1. Replay harness (`./scripts/hooks/replay-guard.sh` on stdin; the throwaway repo is on
   `feature/replay`, so `git switch main &&` is chained to make the tracked branch
   `main`):
   - `git switch main && git push origin --delete feature/copyable-command-blocks` →
     **deny** (expected allow) MISMATCH
   - `git switch main && git push origin :feature/x` → **deny** (expected allow)
     MISMATCH
   - `git switch main && git push origin --delete main` → deny (correct)
   - `git switch main && git push origin :main` → deny (correct)
   - `git push origin :feature/x` (on `feature/replay`) → allow (correct — this is the
     existing fixture, which only passes because the harness is not on `main`)
2. Direct invocation against a throwaway repo checked out on `main` with
   `git push origin --delete feature/copyable-command-blocks` →
   `{"permissionDecision": "deny", "permissionDecisionReason": "Direct commits/pushes to main are forbidden; use a work branch and a pull request."}`
3. Incidental: the guard also denied the planner's own reproduction command line (a
   `printf` containing the literal text) with the same reason — the rule keys on the
   segment text plus the tracked branch.

Observed: the delete of a merged `feature/` branch is denied from `main`.
Expected: deleting any non-default remote branch is allowed regardless of the current
branch; deleting the default branch itself stays denied.

## Decisions

**Q1 — Reproduction context.** Was the rejected command exactly `git push origin --delete <branch>` run from the primary on `main` during `/agento ship`'s post-merge teardown? Exact denial message? Branch prefix?

> Yes, it was /agento ship copyable-command-blocks, post-merge, from the primary checkout agento on main, after gh pr merge 46 --merge --delete-branch=false and the main fast-forward had completed.
> Two denials occurred:
> A compound line ending in ; git push origin --delete feature/copyable-command-blocks (also contained git switch -q main && git fetch --prune -q && git merge --ff-only origin/main -q) — denied. Ambiguous trigger, so ignore it as evidence.
> The isolated command git push origin --delete feature/copyable-command-blocks — denied with exactly: Direct commits/pushes to main are forbidden; use a work branch and a pull request.
> Branch: feature/copyable-command-blocks (feature prefix). It was already merged into origin/main (merge commit d291438) at the time.
> Workaround used: the identical delete issued as git -C /home/david/DP/agento-worktrees/plan-20260918-212304 push origin --delete feature/copyable-command-blocks from the owner worktree (whose branch --show-current was the feature branch) — allowed, succeeded. Same for the companion half.
> Root cause is visible in delivery-guard.sh:406-409: branch == default_branch and is_push denies any git push while the checkout is on main, regardless of refspec; the dedicated delete check at delivery-guard.sh:381 only handles deleting main itself. The delete of a non-default branch never reaches an allow before the blanket rule.

**Q2 — Expected behavior.** Allow a remote-branch delete from `main` outright for any non-default ref, or narrower (prefix match, merged-into-`origin/main` check)?

> Allow git push <remote> --delete <ref> / git push <remote> :<ref> from main when <ref> is not the default branch, i.e. carve the delete form out of the blanket "on main → deny push" rule; keep delivery-guard.sh:381 denying deletion of main. I would not require a prefix match or a merged-into-origin/main check in the guard: /agento ship already guarantees merged state, /agento close-session and /agento quick-fix also legitimately delete changes/, post-ship/, and abandoned branches, and a merged check adds a network-dependent git call to a hook. If you want a belt, ask (not deny) when the ref is not an ancestor of origin/<default> — but default to the simple allow.

**Q3 — Scope.** Delete-from-`main` only, or also the sibling false positives (explicit-refspec push of a non-main branch while on `main`, `fetch --prune`)?

> Narrow fix as you proposed: deletes of non-default refs from main. Record the siblings — explicit-refspec push of a non-main branch while on main (git push origin some-branch), and git push origin HEAD:refs/heads/x — as a Follow-up; they are rarer and pushing content is where the blanket rule earns its keep. git fetch --prune is not affected (the rule only keys on push/commit/merge), so no change there.

**Q4 — Surfaces.** Guard + fixtures only, or also the ship prompt/docs?

> Guard: delivery-guard.sh:406-409 plus a fixture for git push origin --delete feature/x on main → allow, git push origin :feature/x → allow, git push origin --delete main → still deny, in guard-fixtures.txt and the companion fixtures (the companion clone's delete is the same shape).
> Ship prompt: yes, one sentence. /agento ship already says "delete the remote work branch" from the primary; make explicit that it is git push origin --delete <branch> from the primary (and git -C <artifactsRoot> push origin --delete <branch> for the companion), so the supported path is the one the guard now allows. Mirror to ship.md. Also worth noting: gh pr merge --delete-branch is not a clean alternative here — it also tries to delete the local branch, which is checked out in the owner worktree and would fail/noise before teardown.
> hooks.md if it enumerates the git rules — one clause.

**Q5 — Verification.** Replay fixtures + shellcheck + node suite sufficient, or also an end-to-end `/agento ship`?

> The replay-guard fixture run (both variants), shellcheck, and the node suite are sufficient as the machine gate; the fixture is the exposing regression test (add it first, confirm it fails on the current guard). An end-to-end /agento ship on a real merged branch is not needed as a roadmap step — it requires a whole delivery to exist — but the next real ship after this issue merges will exercise it; note that under ## Risks rather than planning a synthetic delivery.

## Research

Skills consulted: none — no matching domain (this repository has no `.agents/skills/`
directory and its AGENTS.md carries no `## Agento` skills table).

**Root cause (confirmed by reproduction).** In
`scripts/hooks/delivery-guard.sh`, inside the per-segment loop:

- Line 381 (inside `if is_push:`) denies only `--delete <default>` / `:<default>`:
  `re.search(r"\s(?:--delete\s+" + DEFAULT + r"|:" + DEFAULT + r")\b", segment)`.
- Lines 405–409 apply the blanket rule:
  `push_to_default = re.search(r"\spush\b.*(?:\s|:)" + DEFAULT + r"\b", segment)` and
  `if (branch == default_branch and (is_commit or is_push or is_merge)) or (is_push and push_to_default): decide("deny", "Direct commits/pushes to … forbidden …")`.
  `branch` is `git branch --show-current` (line 359), updated by chained
  `switch`/`checkout` (lines 396–403). Any `git push` with `branch == main` is denied
  before the refspec is inspected; there is no allow path for a delete of another ref.
- `decide()` exits on the first verdict, so ordering inside the loop matters: the
  line-381 default-branch delete denial fires before the blanket rule, which is what
  keeps `--delete main` denied once the blanket rule is narrowed.

**Regression harness.** `scripts/hooks/replay-guard.sh` runs each fixture line against
a throwaway repo on `feature/replay`; `git switch main && …` chains are how the
"on `main`" state is expressed in fixtures (existing examples:
`allow git switch main && git fetch origin && git merge --ff-only origin/main`,
`deny git switch main; git commit -m x` in `tests/guard-fixtures.txt` lines 26–31).
Fixture files accept `#` comment lines, which is where the issue reference for the
exposing test goes. The companion variant (`REPLAY_COMPANION=1`,
`tests/guard-fixtures-companion.txt`) uses `trunk` as the product-configured default
and `{companion}` as the companion path token; `git -C {companion} switch trunk && …`
chains already exist there (line 15).

**Ship path.** `.github/prompts/ship.prompt.md` line 185–188 says "Merge … and delete
the remote work branch. In the primary: switch to `main` …"; the companion bullet
(lines 189–196) says "merge the companion PR from inside the clone … and delete its
remote branch". Neither names the command. `commands/ship.md` is a byte-identical copy
(`cmp` exit 0 today) and must stay one. `docs/hooks.md` lines 50–52 enumerate the git
rules as a table, including the row `git push --delete <default>` / `:<default>` →
deny and the blanket "Commit, push, or non-fast-forward merge while on the configured
default branch … or a push whose refspec targets it" row.

**Release convention.** `CHANGELOG.md` heads with `## 0.5.1 (2026-09-18)`;
`package.json` and `.claude-plugin/plugin.json` are both `0.5.1`. `/agento ship`
stamps a `## <version> (unreleased)` heading when the version changed (ship prompt
lines 129–130, 165), so this fix bumps to `0.5.2` with an `(unreleased)` entry.

**Hook-edit gating.** Edits to `scripts/hooks/*` are `ask` per change by the guard
itself (AGENTS.md "Hooks are security-sensitive"; docs/hooks.md "Editing a hook file
with an edit tool — ask"). The Builder should expect one approval prompt per edit to
`delivery-guard.sh`.

**Lint baseline (policy §5)** — run 2026-09-18 in the product checkout at `d291438`:

- `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` → exit 0, no findings.
- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → exit 0, `# tests 206`,
  `# pass 206`, `# fail 0`.
- `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` → exit 0, 0 MISMATCH
  (104 fixture lines).
- `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt`
  → exit 0, 0 MISMATCH (45 fixture lines).

Baseline is green, so no overlap and no cleanup prerequisite; the full gate reruns all
four commands and requires them to stay green (the node count may only grow).

**Concurrent deliveries.** `gh pr list --state open` returned no open PRs on
2026-09-18, so no file overlap exists at planning time.

## Approach

Narrow guard change plus fixtures, ship-prompt wording, docs, and a patch release.

1. **Guard** (`scripts/hooks/delivery-guard.sh`, blanket rule at lines 405–409):
   compute, for a push segment, whether it is a *delete-only* push — the refspec is
   `--delete <ref>` / `-d <ref>` or a whitespace-preceded `:<ref>` (the leading
   whitespace excludes `HEAD:<ref>` and `src:dst` content pushes). Exempt that form
   from the `branch == default_branch and is_push` clause only; keep `is_commit`,
   `is_merge`, and `push_to_default` unchanged. The line-381 rule (deny
   `--delete <default>` / `:<default>`) is untouched and still fires first, and
   `push_to_default` still denies anything whose refspec names the default. No
   prefix or ancestry check (Decision Q2).
2. **Fixtures** (exposing regression test — added first, confirmed failing):
   - `tests/guard-fixtures.txt`, new commented block referencing
     `#47 guard-branch-delete-on-main`:
     `allow git switch main && git push origin --delete feature/x`,
     `allow git switch main && git push origin :feature/x`,
     `allow git switch main && git push origin -d feature/x`,
     `deny  git switch main && git push origin --delete main`,
     `deny  git switch main && git push origin :main`,
     `deny  git switch main && git push origin HEAD:feature/x` (content push stays
     denied on `main`).
   - `tests/guard-fixtures-companion.txt`, same block with `{companion}`/`trunk`:
     `allow git -C {companion} switch trunk && git -C {companion} push origin --delete feature/x`,
     `allow git -C {companion} switch trunk && git -C {companion} push origin :feature/x`,
     `deny  git -C {companion} switch trunk && git -C {companion} push origin --delete trunk`.
3. **Ship prompt** (`.github/prompts/ship.prompt.md`, mirrored byte-identically to
   `commands/ship.md`): in the merge bullet, name the command — from the primary,
   `git push origin --delete <branch>` — and in the companion bullet,
   `git -C <artifactsRoot> push origin --delete <branch>`; one clause noting
   `gh pr merge --delete-branch` is not an alternative because it also deletes the
   local branch the owner worktree has checked out.
4. **Docs** (`docs/hooks.md` rules table): one clause on the default-branch row or the
   delete row stating that deleting a non-default remote branch is allowed even while
   on the default branch.
5. **Release**: `0.5.2` in `package.json` and `.claude-plugin/plugin.json`;
   `## 0.5.2 (unreleased)` at the top of `CHANGELOG.md` with a **Fixed** bullet
   naming `#47`.

Affected files: `scripts/hooks/delivery-guard.sh`, `tests/guard-fixtures.txt`,
`tests/guard-fixtures-companion.txt`, `.github/prompts/ship.prompt.md`,
`commands/ship.md`, `docs/hooks.md`, `CHANGELOG.md`, `package.json`,
`.claude-plugin/plugin.json`. Artifacts live in the companion repository under
`issues/2026/09/guard-branch-delete-on-main/`.

## Risks

- **Hook edits are approval-gated.** Every edit to `scripts/hooks/delivery-guard.sh`
  triggers the guard's own `ask`; the Builder must wait for the user's approval in the
  edit dialog rather than routing around it (never via shell redirection or `sed -i`,
  which the guard denies). Mitigation: make the guard change in one focused edit.
- **Over-widening the exemption.** A regex that also matches `HEAD:<ref>` or
  `src:dst` would let content pushes through from `main`. Mitigation: the exemption
  requires `--delete`/`-d` or a whitespace-preceded `:<ref>`, and the fixture
  `deny git switch main && git push origin HEAD:feature/x` pins it.
- **Regex `\b` edge on refs containing `main`.** `push_to_default` uses `main\b`, so
  `--delete feature/main-thing` would still be denied (pre-existing behaviour, `-` is
  a word boundary). Out of scope; recorded as a Follow-up.
- **No end-to-end ship in this delivery.** Per Decision Q5, an end-to-end
  `/agento ship` from the primary is not planned (it needs a whole delivery); the
  fixtures and the direct on-`main` probe are the machine gate. The next real
  `/agento ship` after this issue merges — plausibly this issue's own ship — exercises
  the allowed path for real.
- **Prompt/command parity.** `commands/ship.md` must remain byte-identical to
  `.github/prompts/ship.prompt.md`; the roadmap verifies with `cmp`.
- **Concurrent deliveries.** None open at planning time; the Builder still merges
  `origin/main` before every push (policy §7).

## Out of scope

- The sibling false positives from the same blanket rule: explicit-refspec content
  pushes of a non-default branch while on `main` (`git push origin some-branch`,
  `git push origin HEAD:refs/heads/x`). Recorded as a Follow-up in roadmap.md.
- A merged-into-`origin/<default>` ancestry check or prefix allow-list for deletes.
- `git fetch --prune` (not affected by the rule).
- `gh pr merge --delete-branch` behaviour.
- Any GitHub ruleset change (the enforcement layer already blocks deleting `main`).

## Acceptance checklist

- [ ] The exposing regression fixtures in `tests/guard-fixtures.txt` (block commented
      `#47 guard-branch-delete-on-main`) fail before the fix — `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt`
      reports the `git switch main && git push origin --delete feature/x`, `:feature/x`,
      and `-d feature/x` lines as `MISMATCH` with exit 1 — and pass after it (exit 0,
      0 MISMATCH). Verified by running the harness before and after the guard change and
      recording both outputs on the roadmap steps.
- [ ] `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt`
      exits 0 with the new companion block (`--delete feature/x` and `:feature/x` from
      `trunk` allowed; `--delete trunk` denied).
- [ ] Deleting the default branch stays denied: fixtures `deny git switch main && git push origin --delete main`,
      `deny git switch main && git push origin :main`, and the existing
      `deny git push origin --delete main` / `deny git push origin :main` all pass; a
      content push on `main` (`HEAD:feature/x`) stays denied.
- [ ] A direct probe against a throwaway repo checked out on `main` (the
      `evidence/repro-2026-09-18.md` §2 script) returns `allow` (empty/absent
      `permissionDecision`) for `git push origin --delete feature/copyable-command-blocks`.
- [ ] `.github/prompts/ship.prompt.md` names `git push origin --delete <branch>` from the
      primary and `git -C <artifactsRoot> push origin --delete <branch>` for the
      companion, notes that `gh pr merge --delete-branch` is not an alternative, and
      `cmp .github/prompts/ship.prompt.md commands/ship.md` exits 0.
- [ ] `docs/hooks.md` rules table states that deleting a non-default remote branch is
      allowed while on the default branch (`grep -n 'non-default' docs/hooks.md` hits
      the table).
- [ ] `package.json` and `.claude-plugin/plugin.json` are `0.5.2`; `CHANGELOG.md` line 3
      is `## 0.5.2 (unreleased)` and its entry names `#47`.
- [ ] Full gate against the recorded baseline: `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`
      exit 0 with no findings; `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`
      reports `# fail 0` and `# pass` ≥ 206; both guard smoke variants exit 0.
- [ ] `git diff --name-only origin/main...HEAD` in the product checkout lists only the
      nine files named in `## Approach`; the draft PR body starts with `Fixes #47`.

## Resolution

**Root cause.** In `scripts/hooks/delivery-guard.sh` the blanket rule
`branch == default_branch and (is_commit or is_push or is_merge)` denied every
`git push` while the tracked branch was the default, before the refspec was inspected.
The only delete-specific rule (line 381) handles deleting the default branch itself,
so `git push origin --delete <work-branch>` from the primary on `main` — the command
`/agento ship` issues at teardown — never reached an allow.

**What changed.** The blanket rule now computes `is_delete_push` for a push segment
(`--delete <ref>`, `-d <ref>`, or a whitespace-preceded `:<ref>`) and exempts that
form from the on-default clause only: `(branch == default_branch and (is_commit or
(is_push and not is_delete_push) or is_merge)) or (is_push and push_to_default)`.
Deleting the default branch stays denied by the untouched line-381 rule and by
`push_to_default`; content pushes from the default (`HEAD:<ref>`, `src:dst`) stay
denied because the `:<ref>` form requires leading whitespace. `/agento ship` now
names the delete commands (`git push origin --delete <branch>` from the primary;
`git -C <artifactsRoot> push origin --delete <branch>` for the companion) and notes
`gh pr merge --delete-branch` is not an alternative; `docs/hooks.md` gained the
clause; version bumped to `0.5.2` with an `(unreleased)` CHANGELOG entry.

**Proof.** The exposing fixtures in `tests/guard-fixtures.txt` (block
`#47 guard-branch-delete-on-main`) failed before the fix at product `e8f4da6`
(`./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` → exit 1, 3 MISMATCH:
`--delete feature/x`, `:feature/x`, `-d feature/x` denied) and pass after it at
`38fb601` and at final HEAD `dbd9ddf` (exit 0, 0 MISMATCH over 110 fixture lines,
with `--delete main`, `:main`, `HEAD:feature/x` still denied). Companion variant:
exit 1 / 2 MISMATCH before, exit 0 / 0 MISMATCH after (48 lines). Direct on-`main`
probe: [evidence/probe-after-fix.md](evidence/probe-after-fix.md). Full gate:
shellcheck 0 findings, node 206/206, both smokes 0 MISMATCH — unchanged from the
recorded baseline.
