# close-session-cli: one resumable `agento.mjs close-session` call behind a formatter prompt

## Problem

`/agento close-session` is a 133-line prose procedure
([.github/prompts/close-session.prompt.md](https://github.com/david-perry-software/agento/blob/main/.github/prompts/close-session.prompt.md),
mirrored byte-for-byte in `commands/close-session.md`). The model dispatches on the
argument, resolves paths with `agento.mjs paths`, reads `agento.mjs close-decision`,
inspects both halves' status and upstream, runs `git worktree remove` / `prune` /
`branch -d` in the right order in two repositories, deletes the `.code-workspace`
file, and answers the delivery guard's occupant ask — every step a place to slip
(the breakdown lists #47 and #88 as incidents of this kind). `start-session-cli`
(2026-10) showed the remedy: one deterministic CLI call whose JSON the prompt only
formats.

This feature is the `close-session-cli` member of the **agento-hardening**
initiative — see its block in
[initiatives/2026/10/agento-hardening/breakdown.md](../../../../initiatives/2026/10/agento-hardening/breakdown.md)
(`### close-session-cli`). Brief: "`agento.mjs close-session` likewise." Like the
ship state machine, it is an idempotent, resumable close that reuses
`close-decision` and leaves the prompt a formatter the way `start-session` was.
Its independence note requires the CLI to ship **its own Node occupant check** (VS
Code window and process cwd), because a `git worktree remove` run from inside
`agento.mjs` is invisible to the guard's regex, which only sees `node … agento.mjs
close-session …`.

User-visible effect: `/agento close-session <arg>` becomes one CLI call plus a
JSON-to-chat mapping; it is safe to re-send at any point (already-removed halves are
skipped, merged local branches still cleaned up), it never removes a half with an open
VS Code window or a process inside it unless told to, and `--dry-run` previews the
whole decision. `ship-cli` (wave 3) will reuse the same teardown.

## Decisions

Clarifying questions were asked with the ask-questions tool on 2026-10-09. Every
answer was the option marked recommended.

- **Q: When the CLI's own occupant check finds a VS Code window or process inside a
  half to be removed, what should `agento.mjs close-session` do?**
  A (recommended): **Stop with `status: blocked`, `reason: occupied`, list occupants;
  `--ignore-occupants` overrides.** Mirrors the guard's ask: nothing removed, the
  prompt shows the list and asks; the user re-sends with the flag after closing (or
  deciding to proceed). Not chosen: block with no override; warn and proceed.
- **Q: Should the subcommand support a non-destructive `--dry-run` that reports the
  full decision without removing anything?**
  A (recommended): **Yes — `--dry-run` reports the same JSON with `applied: false`.**
  Lets the prompt (and later ship-cli / the extension) preview and gives tests a
  cheap path. Not chosen: one call that always applies.
- **Q: Should `/agento ship`'s post-merge teardown switch to calling
  `agento.mjs close-session` in this member, or stay prose until `ship-cli`?**
  A (recommended): **Stay prose; ship-cli adopts it later.** Matches the breakdown's
  independence note and keeps this member M-sized.
- **Q: Should the VS Code extension gain a close-session action (CLI call + confirm)
  in this member?**
  A (recommended): **No — CLI, prompt formatter, docs, tests only (plus the
  `copy-cli` byte copy).** Extension UI for closing is a separate follow-up if wanted.

## Research

Skills consulted: none — no matching domain. The repository has no `.agents/skills/`
directory and no skills table (`## Agento` section) in AGENTS.md (verified 2026-10-09
in the planning worktree).

### Today's close procedure (what the CLI must absorb)

Source: `.github/prompts/close-session.prompt.md` (133 lines; `commands/close-session.md`
is its byte mirror).

- **Dispatch**: `feature/<slug>` | `issue/<slug>` → build close; `changes/<slug>` →
  freehand close; bare id `[a-z0-9][a-z0-9-]{1,63}` → `plan-<id>`: detached → plan
  close, on a `feature/`/`issue/` branch → build close using that (promoted) worktree.
- **Shared rules**: role `primary` (§11), `git fetch origin`, path resolution through
  `agento.mjs paths <kind> <id>` (product worktree, `companion.worktree`,
  `workspace`), refuse any other path and never the primary or the companion clone;
  both halves clean (`git status --short`); removal order companion half → `worktree
  prune` → product half → `prune` → workspace file; never `--force`; never kill
  processes or close windows; already-removed halves are skipped but merged local
  branches are still deleted (remote gone **and** ancestor of that repo's
  `origin/<default>`) and `prune` still runs.
- **Plan close**: not registered → "no such planning session", success; must be
  detached with HEAD an ancestor of `origin/main` (both halves).
- **Build close**: `agento.mjs close-decision <type> <slug>` → `status: error`
  (`multiple-roadmaps`, `branch-mismatch`, `no-resolvable-roadmap`,
  `companion-unpushed`) stops with `message` verbatim; `reason`
  `managed-worktree-present` → target `owner.path`; `primary-owns-branch` → stop
  ("return the primary to main first"); `remote-roadmap-only` → already closed,
  success. Then require an upstream and zero commits ahead; remove the pair; delete
  merged local branches under the rule above; report whether `/agento ship <slug>`
  is next.
- **Freehand close**: `freehand-<slug>` on `changes/<slug>`; no roadmap; unpushed
  commits stop with `/agento finish-freehand`; when work still needs publishing,
  offer `/agento start-freehand <slug> --resume`.

### Existing CLI building blocks (all in `scripts/agento.mjs`, 2 486 lines)

- `case "close-decision"` (L1996–2029): `productWorktreeText()` + `decideWithLayout`
  → `closeBuildSessionDecision()` (`scripts/delivery-roadmap-resolver.mjs` L205+;
  reasons `primary-owns-branch`, `managed-worktree-present`, `remote-roadmap-only`),
  then `companionOfOwner()` (L412) and `companionGaps()` (L417) producing the
  `companion-unpushed` error. The new subcommand calls these functions directly
  rather than re-spawning the CLI.
- `startSession()` (L1391–1544) is the precedent for the shape: `out` record with
  `status | reason | message | fix | reauth | allowed | elsewhere | preflight |
  warnings | root | configSource`; `finish()` emits exit 0 for `ok`, 3 otherwise;
  `reject()` writes nothing; `fail()` for mid-flight errors; the §11 check from
  `sessionRecord()` (L708); bounded `gitRun(dir, ["fetch","origin"])` (L1352, 30 s,
  `GIT_TERMINAL_PROMPT=0`) with `classifyFetchFailure` → `fetch-auth` + `reauthFor()`;
  `resolveSessionPaths(kind, id, layout)` (L357) yields `worktree`, `companion
  { worktree, … }`, `workspace`, `layout.artifactsRoot`; `registeredAt(list, path)`
  (L1389); `productWorktrees({ fresh })`, `parseWorktreeList`, `primaryWorktreesDir`.
- `startSessionArgs()` (L1338) + `SESSION_ID` give the argument grammar to reuse,
  extended with `changes/<slug>`.
- `COMMAND_NEEDS["close-session"]` is `["terminal"]` (L971), so unlike
  `start-session` there are no `doctor` checks to run inside the CLI
  (`scripts/agento.test.mjs` L1614–1616 pins `needs: ["terminal"]`).
- Usage header: `scripts/agento.test.mjs` L3332–3341 shows how a subcommand's usage
  line and `usage-error` (exit 1) are tested.

### The guard's occupant check to port

`scripts/hooks/delivery-guard.sh` L55–118 (Python): `worktree_remove_target()` regex on
the shell text; then, for the target, (a) a `/proc/<pid>/cwd` scan collecting
`PID <n> (<comm>)` for cwd `== target` or under `target/` (Linux only, errors
skipped), (b) `code --status` with a 5 s timeout, parsing
`^\|\s+Folder \((name)\):`, `^\|\s+Workspace \((name)\)`, and
`^\|\s+Window \(.*?(\S+) \(Workspace\)`, matching `basename(target)`; the ask lists
at most three PIDs plus "and N more processes", "a matching VS Code folder", "a
matching VS Code workspace window". The `hooks-node-port` member (recommended after
this one) wants to reuse the Node port, so it lives in its own module with injectable
`procDir` / `codeStatus` seams.

### Prompt, mirror, and test contracts the rewrite must keep

- `tests/customizations.test.mjs`: §9/§11/§12 citations in every prompt (L172–203);
  `Needs:`/`Fallback:` declaration contract; "only worktree-mutating commands inspect
  `git worktree list --porcelain`" allowlist already contains `close-session` (L302);
  "guidance never sequences close-session before ship" (L571–589); the
  `start-session` precedent test (L290–297) asserts the byte mirror and that the
  prompt contains no `git worktree add` — the same test shape is added for
  `close-session` with `git worktree remove` / `git branch -d`.
- `docs/commands.md` lists every subcommand in one paragraph (L55+; the
  `start-session` entry is the model) and has the `/agento close-session` table row
  (L22); `docs/architecture.md` names the guard's "worktree-occupant detection" and
  the `CLOSE[remove worktree]` node; `CHANGELOG.md` gets an entry.
- `extension/cli/` is a generated byte copy of `scripts/` (AGENTS.md); `cd extension
  && npm run copy-cli` refreshes it, and `tests/extension-bundle.test.mjs` L41–49
  checks that `copy-cli.mjs` is the only writer. No extension source changes
  (decision 4), but the copy must be regenerated and committed.
- `/agento ship`'s teardown (`ship.prompt.md` L266–281) stays prose (decision 3) and
  keeps answering the guard's ask through `git worktree remove` in shell text.

### Lint baseline (policy §5)

- Command (AGENTS.md "Shell lint"): `shellcheck scripts/hooks/*.sh
  scripts/wait-for-checks.sh` — **exit 127 locally** (`shellcheck: command not
  found`); the planning machine has no shellcheck. CI runs the identical command on
  every PR (`.github/workflows/ci.yml` L20–21, `apt-get install -y shellcheck`).
- Command (AGENTS.md "Test"): `node --test 'scripts/**/*.test.mjs'
  'tests/**/*.test.mjs'` — exit 0, **357 pass / 0 fail**, 95.3 s (log kept at
  `/tmp/agento-test-baseline.log` during planning).
- Overlap: this delivery changes no `.sh` file (the guard is reused, not edited;
  `hooks-node-port` owns the port), so the shellcheck baseline has no overlap. The
  test baseline is green.
- Decision: **scoped gate** — the Builder (a) runs the full `node --test` suite after
  every phase and at the end, compared against 357/0; (b) runs `cd extension && npm
  run build` (typecheck + `copy-cli`) and `npm run test:unit` because
  `extension/cli/` changes; (c) treats the PR's CI `shellcheck` job as the
  full-repository shell lint rerun (`scripts/wait-for-checks.sh pr <n>` must report
  it green) and records the local 127 as "tool absent locally, covered by CI" in the
  roadmap tick; if shellcheck becomes available locally, run it and record the
  output instead. Changed-files-only lint is never the whole gate.

### Concurrent deliveries

`gh pr list --state open --json number,headRefName` → `[]` on 2026-10-09: no open
delivery branches, no file overlap. The two unplanned wave-2 siblings touch
different files (`hooks-node-port`: `scripts/hooks/*`; `delivery-metrics`:
dashboard/status). `hooks-node-port` is "recommended after" this member precisely to
reuse the occupant module; its boundary is fixed here (see Approach).

## Approach

### New module `scripts/worktree-occupants.mjs`

```js
export function findOccupants(target, { procDir = "/proc", platform = process.platform, codeStatus = defaultCodeStatus } = {})
// → { processes: ["PID 123 (bash)", …], folderWindow: boolean, workspaceWindow: boolean, details: [ …≤3 PIDs, "and N more processes", "a matching VS Code folder", "a matching VS Code workspace window" ] }
```

A faithful port of guard L55–118: the `/proc` scan only when `platform === "linux"`
(or `procDir` is injected), identical name sanitising, identical three `code
--status` regexes, 5 s timeout, `code` missing → no window match. `details` is
exactly the guard's wording so the prompt and the future hook print the same text.
Unit tests (`scripts/worktree-occupants.test.mjs`) use a fake `procDir` (symlinked
`cwd`, `comm` files) and canned `code --status` text covering the `Folder`,
`Workspace`, and `Window (… (Workspace))` forms.

### New subcommand in `scripts/agento.mjs`

`close-session <feature|issue>/<slug> | changes/<slug> | <session-id> [--dry-run]
[--ignore-occupants]`, implemented as `closeSession()` beside `startSession()`, in the
usage header, with `COMMAND_NEEDS["close-session"]` unchanged (`["terminal"]`).

Procedure (every check before the first write; `--dry-run` runs all of it with
`applied: false`):

1. **Arguments** (`closeSessionArgs()`): the grammar above; anything else is a
   `usage-error`, exit 1.
2. **Window check (§11)**: `sessionRecord()` must have `role: "primary"`; else
   `status: rejected`, `reason: "wrong window: role=<role> (<path>, branch <b>)"`,
   `allowed`/`elsewhere` copied from the record. No default-branch or cleanliness
   requirement on the primary (unchanged from today's prompt).
3. **Fetch**: bounded `gitRun(primary, ["fetch","origin"])` and, in companion mode,
   the companion clone; `fetch-auth` → `status: failed`, `reason: "fetch-auth"`,
   `reauth`; unreachable → `warnings[]` and continue from local refs.
4. **Resolve the target** per mode:
   - *plan* (`<id>`): `resolveSessionPaths("plan", id)`; the product half's
     registration decides: not registered and not on disk → `outcome:
     "nothing-to-close"`, exit 0; registered on a `feature/`/`issue/` branch →
     promoted, continue as *build* with that worktree as owner; registered detached →
     require HEAD an ancestor of `origin/<default>` (both halves, each in its own
     clone) else `rejected`, `reason: "unpushed"` listing the half and commits.
   - *build* (`<type>/<slug>`): `closeBuildSessionDecision()` + `companionOfOwner()`
     + `companionGaps()` exactly as `case "close-decision"`; `status: error` passes
     through as `rejected` with the resolver's `reason` and `message`;
     `primary-owns-branch` → `rejected` with the `git switch <default>` fix;
     `remote-roadmap-only` → `outcome: "already-closed"` (still evaluates branch
     deletion), exit 0; `managed-worktree-present` → target `owner.path`. Then the
     product half must be clean (`status --porcelain --untracked-files=all` empty;
     else `rejected`, `reason: "dirty"`, files listed) and have an upstream with
     `ahead: 0` (else `rejected`, `reason: "unpushed"`).
   - *freehand* (`changes/<slug>`): `resolveSessionPaths("freehand", slug)`; the
     registered product half must be on `changes/<slug>` (else `rejected`,
     `reason: "branch-mismatch"`); not registered → `nothing-to-close`; clean and,
     when an upstream exists in either repo, `ahead: 0`, else `rejected` with
     `/agento finish-freehand` in `next`.
   Paths are only ever the ones `resolveSessionPaths` produced, each verified
   registered in its own clone (`registeredAt`); the primary and the companion clone
   root are never candidates.
5. **Occupant gate**: `findOccupants()` on each half that is registered and on disk.
   Any occupant → `status: "blocked"`, `reason: "occupied"`, `occupants: { product:
   details[], companion: details[] }`, exit 3, nothing removed — unless
   `--ignore-occupants`, which proceeds and copies the details into `warnings[]`.
6. **Apply** (skipped under `--dry-run`): companion half `git -C <clone> worktree
   remove <path>` (never `--force`) → `worktree prune`; product half likewise from
   the primary; workspace file `fs.rmSync` when it exists; then per repository
   `git branch -d <branch>` only when `refs/remotes/origin/<branch>` is absent after
   the fetch **and** the local branch is an ancestor of `origin/<default>` — report
   `action: deleted | retained | absent` with a `reason` string. A half already gone
   is reported `removed: false, registered: false` and skipped (idempotency row).
   Any git failure mid-apply → `status: "failed"`, `reason: "worktree-remove" |
   "branch-delete"`, `message` with stderr; what was removed stays reported.
7. **Output**:

```
{ status: ok | rejected | failed | blocked, mode: plan | build | freehand, subject,
  outcome: closed | already-closed | nothing-to-close | null, applied,
  product: { path, branch, detached, registered, onDisk, removed } | null,
  companion: { …same… } | null, workspace: { path, existed, removed } | null,
  branches: { product: { name, upstream, remoteExists, mergedIntoDefault, action, reason } | null,
              companion: { … } | null },
  occupants: { product: [], companion: [] }, dirty: { product: [], companion: [] },
  next: [ "/agento ship <slug>" | "/agento start-freehand <slug> --resume" | "/agento finish-freehand" … ],
  reason, message, fix, reauth, allowed, elsewhere, warnings, root, configSource }
```

Exit 0 for `ok`, 3 for `rejected | failed | blocked`, 1 for usage.

### Prompt as formatter

`.github/prompts/close-session.prompt.md` is rewritten on the `start-session` model:
unchanged frontmatter semantics, `Needs: terminal`, the §9/§11/§12 citations, "One
call" (pass the argument and flags through; `--dry-run` and `--ignore-occupants`
only when the user asked), then "Map the JSON to the response": usage-error →
rejected receipt; `rejected` → §9 rejected receipt with `reason` and the record's
alternatives in §12 blocks; `blocked` → accepted receipt, the occupant list, the
instruction to close the window/terminal, and the re-send command (`/agento
close-session <arg>`; plus `/agento close-session <arg> --ignore-occupants` as the
explicit override) in §12 blocks; `failed` → §9 failed result naming the resume;
`ok` → the report (halves removed or already gone, workspace file, branch
outcomes, warnings) and each `next[]` entry as a §12 block. No `git`, `paths`, or
`close-decision` commands remain in the prose. `commands/close-session.md` is the
byte mirror. The ship prompt is untouched (decision 3).

### Files touched

- `scripts/worktree-occupants.mjs` (new), `scripts/worktree-occupants.test.mjs` (new)
- `scripts/agento.mjs` (new subcommand + usage line), `scripts/agento.test.mjs`
  (new `// --- close-session` section)
- `.github/prompts/close-session.prompt.md`, `commands/close-session.md`
- `tests/customizations.test.mjs` (close-session formatter test)
- `docs/commands.md`, `docs/architecture.md`, `CHANGELOG.md`
- `extension/cli/**` (regenerated by `npm run copy-cli`; no `extension/src` edits)

## Risks

- **A CLI-side removal bypasses the guard.** Mitigation: the occupant gate is the
  first write-blocking check, defaults to `blocked`, and its tests spawn a real
  process with its cwd inside the half plus a stubbed `code --status`, so the port is
  exercised end to end rather than by unit tests alone.
- **`/proc` is Linux-only.** On other platforms the process scan is skipped exactly as
  the guard skips it; `code --status` still runs. Documented in `docs/commands.md`.
- **Deleting the wrong branch / path.** Mitigation: paths come only from
  `resolveSessionPaths` and must be `registeredAt` their own clone; branch deletion
  requires remote absence after a fresh fetch *and* ancestry of `origin/<default>`;
  `--force` is never passed; the dry-run test asserts `git worktree list` and
  `git branch` are unchanged.
- **Prompt drift breaks existing tests.** The §9/§11/§12 citation tests, the
  worktree-list allowlist, and the "never close-session before ship" test all run
  in `tests/customizations.test.mjs`; the new formatter test pins the byte mirror.
- **Concurrent delivery.** No open PRs today; `hooks-node-port` will import
  `scripts/worktree-occupants.mjs` later, so its export signature is treated as
  stable from this delivery on. Integrate `origin/main` (both repositories) before
  every push.
- **Lint tool absent locally.** shellcheck exit 127 on the planning machine; no `.sh`
  file changes here, and CI runs the identical command on the PR — the Builder
  records the CI result as the full-repository rerun (§5 scoped gate).

## Out of scope

- Switching `/agento ship`'s teardown to the CLI (decision 3; `ship-cli`).
- Any extension UI or `extension/src` change (decision 4); only the generated
  `extension/cli/` copy is refreshed.
- Porting the guard itself to Node or changing `delivery-guard.sh` (`hooks-node-port`).
- Killing processes or closing VS Code windows from the CLI.
- New lifecycle rules, exit codes, or `COMMAND_NEEDS` changes.

## Acceptance checklist

- [ ] `node scripts/agento.mjs close-session` accepts `<feature|issue>/<slug>`,
  `changes/<slug>`, and a bare session id, plus `--dry-run` and
  `--ignore-occupants`; any other argument is `status: usage-error`, exit 1; the
  usage header lists the subcommand — verified by `scripts/agento.test.mjs`.
- [ ] From a non-primary window the call is `status: rejected` with `reason` starting
  `wrong window: role=` and `allowed`/`elsewhere` equal to `agento.mjs session`'s,
  and nothing is removed — verified by test.
- [ ] Plan close (in-repo and companion pair): a detached, pushed session is removed
  (both halves, `worktree prune`, workspace file); an unregistered id is
  `outcome: "nothing-to-close"`, exit 0; a half with unpushed commits is
  `rejected`, `reason: "unpushed"`; a promoted `plan-<id>` runs the build close —
  verified by tests asserting `git worktree list --porcelain` in both clones.
- [ ] Build close reuses `closeBuildSessionDecision`/`companionGaps`: every
  `close-decision` error reason passes through as `rejected`; `primary-owns-branch`
  rejects with the fix; `remote-roadmap-only` is `already-closed`, exit 0, with
  merged local branches still deleted; a dirty or ahead product half rejects with
  the files/commits listed; a clean pushed pair is removed and the merged local
  branch deleted in each repository only when the remote branch is gone and it is an
  ancestor of that repository's `origin/<default>` (otherwise `retained` with a
  reason) — verified by tests in both layouts.
- [ ] Freehand close: `freehand-<slug>` on `changes/<slug>` is required; unpushed
  commits reject with `/agento finish-freehand` in `next`; unpublished-but-merged
  state names `/agento start-freehand <slug> --resume`; branch deletion follows the
  same rule — verified by test.
- [ ] Occupant gate: with a live process whose cwd is inside a half, or a stubbed
  `code --status` naming the half as a `Folder`, `Workspace`, or `Window (…
  (Workspace))`, the call is `status: blocked`, `reason: "occupied"`, exit 3, with
  the guard's wording in `occupants`, and both worktree lists are unchanged;
  `--ignore-occupants` proceeds and copies the details into `warnings[]` — verified
  by tests; `scripts/worktree-occupants.test.mjs` covers the parser with a fake
  `procDir` and canned status text.
- [ ] `--dry-run` returns the full decision with `applied: false` and changes nothing
  (worktree lists, branches, workspace file identical before and after) — verified
  by test.
- [ ] Idempotency: re-sending after a successful close is `outcome: "already-closed"`
  (or `nothing-to-close`), exit 0; a pair with one half already removed removes only
  the other and reports the first `removed: false` — verified by test.
- [ ] A bounded fetch failure adds a `fetch:` warning and continues; an auth failure is
  `status: failed`, `reason: "fetch-auth"` with `reauth`, before any write —
  verified by test (SSH stub as in the start-session tests).
- [ ] `.github/prompts/close-session.prompt.md` is a formatter: it contains `node
  <agento-root>/scripts/agento.mjs close-session `, no `git worktree remove`, `git
  branch -d`, `agento.mjs paths`, or `agento.mjs close-decision`; keeps `Needs:
  terminal`, the §9/§11/§12 citations, and the §12 blocks for every offered
  command; `commands/close-session.md` is byte-identical — verified by a new
  `tests/customizations.test.mjs` test and the existing suite.
- [ ] `ship.prompt.md` and `extension/src/**` are unchanged (`git diff --stat
  origin/main -- .github/prompts/ship.prompt.md extension/src` empty);
  `extension/cli/` equals `scripts/` byte for byte after `npm run copy-cli`
  (`diff -r` clean apart from files the copier intentionally omits).
- [ ] Docs: `docs/commands.md` describes the subcommand (grammar, statuses, exit codes,
  occupant gate, Linux-only process scan, dry-run) and updates the `/agento
  close-session` table row; `docs/architecture.md` names the CLI close;
  `CHANGELOG.md` has an entry.
- [ ] Scoped lint gate (§5) recorded on the roadmap: full `node --test` green with no
  new failures against the 357/0 baseline; `cd extension && npm run build` and
  `npm run test:unit` pass; the PR's CI `shellcheck` step is green (local tool
  absent, exit 127, documented).
- [ ] Real-run evidence: from this build worktree with `--root <primary path>`,
  `close-session 20261009-182342 --dry-run` reports `mode: "build"`, `subject:
  "feature/close-session-cli"`, `applied: false`, `status: "blocked"` with this
  window among `occupants` (dry-run reports the verdict the real run would give),
  and both clones' `git worktree list --porcelain` are unchanged; the JSON is saved
  under `evidence/` and linked from the roadmap.
