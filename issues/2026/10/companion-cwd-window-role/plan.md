# Window check reports `unmanaged` when the cwd is the companion clone

## Problem

`agento.mjs session` is the delivery-policy §11 window check. It derives the window
`role` from the shell's working directory. In a companion-mode primary window
(a multi-root workspace: product `soshiki` + companion `soshiki-docs`, or this repo's
`agento` + `agento-docs`), an agent terminal can start in the companion folder. From
there `session` reports `role: "unmanaged"` and `allowed: []`, so every `/agento …`
command is rejected as `wrong window: role=unmanaged`. The Agento sidebar (which runs
the CLI with `--root <first workspace folder>`) and the `SessionStart` hook both
report `primary` for the same window. `next` (behind `/agento continue`) fails the
same way: it returns `status: "unsupported"` with exit 3. The user saw this on
2026-10-07 when `/agento start-session` was rejected in the soshiki primary window.

## Evidence

GitHub issue: #92

Reproduced on 2026-10-07 on this repository's own pair: product
`/home/david/DP/agento` on `main` and companion clone `/home/david/DP/agento-docs`.
The CLI ran from this planning worktree at `origin/main` `7b4a3c6`. The run was
read-only.

Steps:

1. `cd /home/david/DP/agento && node <cli> session`. Gives the primary baseline.
2. `cd /home/david/DP/agento-docs && node <cli> session`.
3. `cd /home/david/DP/agento-docs/features && node <cli> session`.
4. `cd /home/david/DP/agento-docs && node <cli> next`.

Observed and expected:

| cwd | command | observed | expected |
| --- | --- | --- | --- |
| `agento` | `session` | `role: primary`, `worktree.path: /home/david/DP/agento`, `allowed` = 6 commands, exit 0 | (baseline) |
| `agento-docs` | `session` | `role: unmanaged`, `worktree.path: /home/david/DP/agento-docs`, `branch: null`, `allowed: []`, exit 0 | the primary record plus the `anchored-from-companion` warning |
| `agento-docs/features` | `session` | `role: unmanaged`, `worktree.path: …/agento-docs/features`, `allowed: []` | same as the row above |
| `agento-docs` | `next` | `status: "unsupported"`, `role: unmanaged`, `next: null`, exit 3 | the same `next` as from the primary |

In all three companion-clone runs, `root` is already `/home/david/DP/agento`.
`warnings[]` already says `anchored-from-companion: /home/david/DP/agento-docs is a
companion checkout of /home/david/DP/agento; the record describes
/home/david/DP/agento`. The record does not describe it. `docs/commands.md` (L116-117)
already documents the expected behavior: "a cwd inside a companion half or the
companion clone is anchored on its product checkout and yields the same record".

Captured logs (full JSON output, with the command and exit status):

- [evidence/session-from-product-primary.txt](evidence/session-from-product-primary.txt)
- [evidence/session-from-companion-clone.txt](evidence/session-from-companion-clone.txt)
- [evidence/session-from-companion-subdir.txt](evidence/session-from-companion-subdir.txt)
- [evidence/next-from-companion-clone.txt](evidence/next-from-companion-clone.txt)

The logs were captured right after this planning worktree was promoted onto
`issue/companion-cwd-window-role`. Because of that, `worktrees[]` lists this worktree
as `build`. That does not affect the defect.

## Decisions

Questions were asked on 2026-10-07 with the ask-questions tool. The user picked the
recommended option every time.

1. **Where should the fix live?** Options: CLI fix (recommended), policy-only
   `--root`, or both. Answer: *"CLI: companion-clone cwd classifies as the anchored
   product primary"*.
2. **Which `deriveRole` callers get the anchored cwd?** Options: all three
   (recommended), or `session` only. Answer: *"All three: session, next, doctor
   session-workspace check"*.
3. **How should a cwd in the companion clone behave when the clone is on a
   non-default branch, or when the cwd is a subdirectory of the clone?** Options: the
   same rule everywhere (recommended), or only the clone root on its default branch.
   Answer: *"Same: record describes the product primary (branch/role from the
   product); subdirs included"*.
4. **Keep the `anchored-from-companion` warning in the record when the cwd is the
   companion clone?** Options: keep it (recommended), or drop it. Answer: *"Keep it
   (informational, unchanged text)"*.
5. **Where should I reproduce for `## Evidence`?** Options: this repo's own pair plus
   a failing fixture test (recommended), or also soshiki. Answer: *"This repo's own
   pair (agento + agento-docs) plus a failing fixture test"*.

## Research

Skills consulted: none — no matching domain (this repository has no
`.agents/skills/` directory, and AGENTS.md has no `## Agento` skills table).

Root cause:

- `scripts/agento.mjs` L93 sets `startDir = path.resolve(options.root ??
  process.cwd())`. L94 takes `toplevel` from it.
- `anchorRoot(toplevel)` (`scripts/agento.mjs` L121-155) finds that the toplevel has
  no `artifacts.repo` of its own. It then finds the one sibling product whose config
  resolves `artifacts.repo.dir` to that clone, and re-anchors `root` on it. It also
  emits the `anchored-from-companion` warning. If the cwd is a half
  (`<clone>-worktrees/<kind>-<id>`), it anchors on the product half with the same
  name. Otherwise it anchors on the product primary.
- Three callers still pass the raw `startDir` to `deriveRole`, not the anchored
  `root`:
  - `session`: `scripts/agento.mjs` L1511. The comment at L1508 says this is so that
    "a subdirectory inside a worktree resolves to that worktree's entry".
  - `next`: L1557.
  - The doctor `session-workspace` check: L663.
- `scripts/session-state.mjs` `classifyByPath()` (L107-157) handles three cases:
  - a cwd under a product worktree, which gives `primary` or a managed role;
  - a cwd under `worktreesDir/<kind>-<id>`;
  - a cwd under `companionWorktreesDir/<kind>-<id>`, which already maps to the
    product half's role. This is why halves work today.

  It has no case for the companion clone itself, so that cwd falls through to
  `{ role: "unmanaged", worktree: { path: cwd } }`.
- `scripts/agento.test.mjs` L639-643 codifies the defect inside the test "session
  from a companion half anchors on the product primary and matches the product half":
  `assert.equal(clone.role, "unmanaged")`.
- `scripts/hooks/session-context.sh` L115 runs `agento.mjs session --root <cwd>`.
  `extension/src/extension.ts` L193 runs `client.run(["session", "--pr"],
  folder.uri.fsPath)`, and `extension/src/cliClient.ts` L29 appends `--root <root>`.
  Both go through the same `startDir` path, so a CLI fix fixes them too. No hook edit
  is needed.
- `extension/cli/` is a generated byte copy of `scripts/`.
  `tests/extension-bundle.test.mjs` L24 fails when the copy differs, so the fix must
  run `cd extension && npm run copy-cli`.
- Docs: `docs/commands.md` L116-117 already promises the same record.
  `docs/architecture.md` L143-155 ("Companion-cwd anchoring") describes the
  re-anchor. It needs one sentence saying that, from the clone itself, the role and
  worktree are the product primary's.

Lint baseline (policy §5), run on 2026-10-07 in the product checkout at `7b4a3c6`:

- Shell lint: `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` gave exit
  127 (`bash: shellcheck: command not found`). shellcheck is absent on this machine,
  so there are no findings to compare. This delivery changes no shell file.
- Repo tests: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` gave exit 0
  with `# tests 288`, `# pass 288`, `# fail 0`.
- Guard smoke: `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` gave
  exit 0.
- AGENTS.md declares no JS/TS linter for `scripts/`.

Overlap decision: there are no lint findings, and the only full-repository linter is
unavailable and covers files this delivery does not touch. A **scoped gate** is used:

- `node --check` on every changed `.mjs` file;
- the full repo test suite (this includes the extension-bundle sync test);
- the guard smoke;
- a final `shellcheck` rerun, which must give either exit 0 or the same exit 127,
  with the diff touching no shell file.

Concurrent deliveries: `gh pr list --state open` returned `[]` on 2026-10-07. No open
delivery branch overlaps these files.

## Approach

1. **Exposing test first.** Add the test described in roadmap step 1.1 to
   `scripts/agento.test.mjs`. Its name references `#92 companion-cwd-window-role`.
   The test builds a pair with `makePairRepo()` and asserts the following:
   - From `docs` and from `docs/features`, `session` gives `role: "primary"`, and
     `strip(record)` deep-equals `strip(run(repo, "session").json)`. This covers
     `worktree`, `allowed`, `elsewhere`, `delivery`, `lifecycle`, and `root`.
   - `warnings[0]` matches `/^anchored-from-companion: /`.
   - From `docs`, `next` exits 0 with `role: "primary"`, and its `status` and `next`
     equal the values `next` gives from `repo`.
   - From `docs`, `doctor` reports the `session-workspace` check as `ok` with `not a
     managed pair`, the same as from `repo`. The test uses
     `runWith({ cwd, env }, "doctor")` with `restrictedPath(okStubs)`, as the existing
     session-workspace test (L1388) does. This parity assertion already holds today
     (an unmanaged cwd is also "not a managed pair"); it pins the switch of the L663
     caller to the anchored cwd.
   - With the clone switched to a non-default branch (`git -C docs switch -c tmp`),
     `session` from `docs` still gives `role: "primary"` and `worktree.branch` equal
     to the product's `main`.
2. **Fix in `scripts/agento.mjs` only.**
   - `anchorRoot()` gains a boolean `fromClone` in its return value. It is true only
     when exactly one product matched, `samePath(clone, dir)` is true (the toplevel
     is the companion clone's primary checkout), and the cwd is not a half. Every
     other branch returns `fromClone: false`.
   - Add `const roleCwd = anchor.fromClone ? root : startDir;` once, next to
     `const root = anchor.root`.
   - The three `deriveRole({ cwd: startDir, … })` calls (L663, L1511, L1557) switch
     to `cwd: roleCwd`. Update the L1508 comment so it says: subdirectories of a
     worktree resolve to that worktree, and the companion clone resolves to the
     anchored product primary.
   - `session-state.mjs` stays pure and unchanged. Halves keep their existing
     `classifyByPath` companion branch.
   - The `anchored-from-companion` warning text is unchanged.
3. **Update the codified assertion.** In the existing test at
   `scripts/agento.test.mjs` L639-643, change `clone.role` from `"unmanaged"` to
   `"primary"` and update the comment on L639. `list[2].role` (the clone's
   `worktrees[]` entry) stays `"unmanaged"`; see Out of scope.
4. **Bundle.** Run `cd extension && npm run copy-cli` so `extension/cli/agento.mjs`
   matches.
5. **Docs and changelog.**
   - `docs/architecture.md` "Companion-cwd anchoring": one sentence. From the
     companion clone itself (root or any subdirectory, any branch), `role` and
     `worktree` are the product primary's. From a half, they are the product half's.
   - `CHANGELOG.md` `## Unreleased`: one **Fixed** bullet citing `#92`.

Affected files: `scripts/agento.mjs`, `scripts/agento.test.mjs`,
`extension/cli/agento.mjs` (generated), `docs/architecture.md`, `CHANGELOG.md`.

## Risks

- **Ownership and teardown logic reading the clone as primary.** `findOwner`,
  `close-decision`, and `ship-preflight` work from `worktrees[]` and branches, not
  from the current role. Mitigations:
  - `classifyWorktrees` is left unchanged, so the clone's `worktrees[]` entry stays
    `unmanaged` and can never be an owner.
  - The full repo suite (288 tests) must stay green.
- **A human shell in the companion clone now passes the primary-window check.** This
  is intended (decisions 1 and 3). The record still carries the
  `anchored-from-companion` warning, so the anchoring stays visible.
- **The clone is on a feature branch while the product primary is on `main`.** The
  record reports the product's branch and lifecycle (decision 3). The step 1.1 test
  covers this case explicitly.
- **Unmanaged extra worktrees of the companion clone** (neither the clone nor a
  half). `fromClone` stays false, so they keep today's behavior.
- **Bundle drift.** If `extension/cli/agento.mjs` is not recopied,
  `tests/extension-bundle.test.mjs` fails. The step 2.2 gate catches this.
- **Concurrent deliveries.** There are no open PRs today. Integrate `origin/main`
  (merge, never rebase) into both halves before every push.

## Out of scope

- Changing the role of the companion clone's own entry in `worktrees[]`
  (`classifyWorktrees`). It stays `unmanaged`.
- Unmanaged extra worktrees of the companion clone outside
  `<clone>-worktrees/<kind>-<id>`.
- Rewording delivery-policy §11, or any prompt or agent text. The CLI fix makes the
  existing "run `agento.mjs session`" instruction correct.
- Hook (`scripts/hooks/`, `.github/hooks/`) and extension source (`extension/src/`)
  changes.
- In-repo-layout behavior. Nothing is anchored there, so `fromClone` is always false.

## Acceptance checklist

- [ ] The exposing regression test in `scripts/agento.test.mjs` is named `session,
  next, and doctor from the companion clone describe the product primary (#92
  companion-cwd-window-role)`. It fails on `origin/main` before the fix and passes
  after. Verify: the roadmap 1.1 failure output, then `node --test
  scripts/agento.test.mjs` shows it `ok`.
- [ ] From the companion clone root and from a subdirectory of it, `agento.mjs
  session` returns `role: "primary"` and the same record as from the product primary,
  apart from `warnings` (and the generated `worktrees`/`companion`/`workspace`
  fields), and `warnings[]` keeps `anchored-from-companion`. Verify: the step 1.1
  test, plus a rerun of the evidence commands against `/home/david/DP/agento-docs` and
  `/home/david/DP/agento-docs/features` using this branch's CLI.
- [ ] `agento.mjs next` from the companion clone exits 0 with the same `next` as from
  the product primary. Verify: the step 1.1 test, plus a rerun of
  `evidence/next-from-companion-clone.txt`'s command.
- [ ] The doctor `session-workspace` check gives the same result from the clone as
  from the primary, and its caller uses the anchored cwd. Verify: the step 1.1 test,
  plus `grep -n 'cwd: startDir' scripts/agento.mjs` returning no `deriveRole` call.
- [ ] Companion halves are unchanged: the existing pair tests ("session from a
  companion half …", "session: plan pair …") pass unmodified, apart from the one
  `clone.role` assertion that the defect corrected. Verify: `git diff` of
  `scripts/agento.test.mjs` shows only that line, its comment, and the new test.
- [ ] `extension/cli/agento.mjs` is byte-identical to `scripts/agento.mjs`. Verify:
  `tests/extension-bundle.test.mjs` passes.
- [ ] `docs/architecture.md` states the clone → product-primary rule, and
  `CHANGELOG.md` `## Unreleased` has a **Fixed** bullet citing `#92`. Verify: `grep`.
- [ ] Scoped lint gate (policy §5):
  - `node --check` passes on every changed `.mjs` file;
  - the full repo suite gives `# fail 0` with 289 or more tests;
  - the guard smoke exits 0;
  - a `shellcheck` rerun gives exit 0 or the baseline's exit 127, and the diff
    contains no shell file.

  Verify: the roadmap 3.1 output.

## Resolution

(written by the Builder at completion)
