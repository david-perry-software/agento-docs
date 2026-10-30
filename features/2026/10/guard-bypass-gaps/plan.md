# Close the delivery guard's ruleset, merge, and hook-bypass gaps

## Problem

The PreToolUse delivery guard (`scripts/hooks/delivery-guard.mjs`) is Agento's slip
guard: it denies the mistakes an LLM operator actually makes before they reach git or
GitHub. A manual probe of it found six commands that it **allows** today and that
defeat exactly what it exists to protect:

| Command | Why it matters |
| --- | --- |
| `gh api -X DELETE repos/o/r/rulesets/1` | Deletes the ruleset, which is the real enforcement layer the guard relies on (README "Guard + ruleset"; `docs/hooks.md` "What it is not"). The most important gap. |
| `gh api -X PUT …/pulls/1/merge` | Merges outside the `/agento ship` audit gate, even though `gh pr merge --admin` is blocked. |
| `git -c core.hooksPath=/dev/null commit` | Bypasses hooks the same way `--no-verify` does. |
| `git config core.hooksPath /dev/null` | The same bypass, but it persists. |
| `HUSKY=0 git commit` | Skips the project's hooks. |
| `git push --mirror origin` | Can overwrite or delete `main` on the remote. |

The user's direction: a general rule covers most of these — route any `gh api` call
with a write method (`-X PUT/POST/PATCH/DELETE` or `--method`) against `rulesets`,
`branches/*/protection`, or `pulls/*/merge` to deny — and every case is added to
`tests/guard-fixtures.txt`.

User-visible effect after the change: an agent that tries any of these spellings gets
an immediate `deny` (or an `ask` card for the two legitimate-tooling cases decided
below) with a reason that names the safe alternative, in both the Copilot and Local
harnesses.

## Decisions

Asked 2026-10-28 with the ask-questions tool; every answer below took the option
marked recommended.

1. **`gh api` coverage.** Options: (a, recommended) REST writes to rulesets,
   `branches/*/protection`, and `pulls/*/merge` **plus** the matching GraphQL
   mutations (mergePullRequest, delete/update ruleset, branch-protection mutations),
   since otherwise a graphql call reopens the same hole; (b) REST only; (c) REST +
   GraphQL but ask instead of deny for the merge path.
   **Answer: `rest+graphql`** — option (a).
2. **Implicit write method.** `gh api` switches to POST when it sees
   `-f`/`-F`/`--field`/`--raw-field`/`--input` without `-X`. Options: (a,
   recommended) treat that as a write (POST), matching gh's real behaviour; (b) only
   an explicit `-X`/`--method` counts. **Answer: `treat-as-write`** — option (a).
3. **`core.hooksPath`.** Options: (a, recommended) deny the inline `git -c
   core.hooksPath=…` override; ask on `git config [--local|--global|--unset]
   core.hooksPath` so legitimate tooling (husky install runs `git config
   core.hooksPath .husky/_`) can still set it; (b) deny both forms for every value;
   (c) deny only empty or `/dev/null`-style values. **Answer:
   `deny-inline-ask-config`** — option (a).
4. **`HUSKY=0` and similar.** Options: (a, recommended) deny `HUSKY=0` /
   `HUSKY_SKIP_HOOKS=1` as a prefix of `git commit`/`push`/`merge`, and deny `export
   HUSKY=0` (and the same for `HUSKY_SKIP_HOOKS`); (b) deny only the inline prefix
   form; (c) ask instead of deny. **Answer: `deny-env-prefix`** — option (a).
5. **Quoted-pipe false positive.** `SEGMENT_SPLIT` splits on `|` inside quotes, so
   `grep -E 'a|b' scripts/hooks/x` is denied as a hook-file write (hit during this
   planning session). Options: (a, recommended) record it as a Follow-up — it is a
   false positive, not a gap, so this feature stays focused on closing holes; (b) fix
   it in this feature with quote-aware segment splitting. **Answer: `followup`** —
   option (a).
6. **Ruleset creation** (asked after research found that `/agento agento-init`
   itself runs `gh api -X POST repos/{owner}/{repo}/rulesets`). Options: (a,
   recommended) POST to the rulesets collection (create) → ask, so agento-init still
   works behind one approval card; PUT/PATCH/DELETE on `rulesets/<id>` and every
   write to `branches/*/protection` → deny; (b) POST create → allow, edits and
   deletes → deny; (c) deny every write including create and change agento-init to
   hand ruleset creation to the user. **Answer: `ask-create`** — option (a).
7. **Auto-merge.** `gh pr merge --auto` and GraphQL `enablePullRequestAutoMerge` arm
   a merge outside the ship gate. Options: (a, recommended) record as a Follow-up —
   not in the original list and narrower, since required checks still gate it; (b)
   add it to this feature as deny; (c) add it as ask. **Answer: `followup`** —
   option (a).

Not asked (decided from the brief): `git push --mirror` is denied unconditionally —
it implies force and can delete or overwrite the default branch, the same class as
the existing force-push deny.

## Research

Skills consulted: none — no matching domain (this repository has no `.agents/skills/`
directory and its AGENTS.md has no `## Agento` skills table).

- **One guard implementation.** All verdict logic lives in
  `scripts/hooks/delivery-guard.mjs` (`decide()`); `scripts/hooks/delivery-guard.sh`
  is the shell wrapper the harnesses call. A repository-wide search for the existing
  deny reasons (`Merging with --admin`, `Bypassing commit hooks`) finds only that
  file. `extension/cli/` (the byte copy produced by `npm run copy-cli`) contains no
  `hooks/` directory, so no copy needs regenerating.
- **Evaluation order in `decide()`** (`delivery-guard.mjs` lines ~250–300): occupant
  check → hook-file edit/shell-write protection → watchers → the `gh pr merge`
  block (`--admin` deny, `--squash`/`--rebase` ask) → **early `return
  verdict("allow")` when the command contains no `git` word** → git policy per
  segment. Any `gh api` rule and the `export HUSKY=0` rule must therefore sit
  *before* that early return, next to the `gh pr merge` block, or they never run.
- **Segmenting.** `SEGMENT_SPLIT = /\|\||&&|[;|&\n]|\bthen\b|\bdo\b|\belse\b/` is not
  quote-aware. Consequences for this feature: a `--jq '.a | .b'` filter or a
  multi-line GraphQL `-f query='…'` is split into several segments. GraphQL mutation
  names must therefore be matched against the **whole command text** whenever any
  segment invokes `gh api graphql`, not against that segment alone.
- **`git -c` handling.** The `GIT` regex (`\bgit\b(?:\s+-[Cc]\s+\S+)*`) already
  skips `-c <key=value>` and `-C <path>` before the subcommand, so `git -c
  core.hooksPath=/dev/null commit` is classified as a commit today — it simply has no
  rule. Git config keys are case-insensitive (`core.hookspath` works), and git also
  accepts `--config-env=core.hooksPath=<ENVVAR>`.
- **Env-prefix handling.** `commandWord()` already skips `NAME=value` assignments and
  the `PREFIXES` set (`env`, `timeout`, …), so `HUSKY=0 git commit` and `env HUSKY=0
  git commit` are both seen as git commits with no rule for the assignment.
- **`--mirror`.** `pushRefspecs()` already folds `--mirror` into `push.all`, but
  `push.all` only denies when the current branch *is* the default branch
  (`pushFromDefault`). From `feature/*` a mirror push is allowed today; the existing
  fixtures only cover `git switch main && git push --mirror origin`
  (`tests/guard-fixtures.txt` line 140, `tests/guard-fixtures-companion.txt` line 65).
- **Legitimate `gh api` writes Agento itself issues** (must stay allowed or
  ask-only):
  - `.github/prompts/agento-init.prompt.md` lines 109 and 216: `gh api -X POST
    repos/<owner>/<name>/rulesets` (create the default-branch ruleset) → becomes
    **ask** per Decision 6.
  - `.github/prompts/agento-init.prompt.md` lines 209–210: GET `…/rulesets --jq …`
    and GET `…/branches/<default>/protection` → stay **allow** (reads).
  - `.github/prompts/agento-init.prompt.md` line 312: `gh api
    repos/<owner>/<name>/pulls/<companion-pr> -X PATCH -f body=…` (PR cross-link) →
    stays **allow** (`pulls/<n>`, not `pulls/<n>/merge`).
  - `scripts/agento.mjs` (and `extension/cli/agento.mjs`) issue comment POST/PATCH
    via `gh api` from inside Node — the guard never sees those subprocesses (it only
    sees the tool call's shell text), and they target `issues/*/comments` anyway.
  - No prompt, command, or script runs `gh api graphql` mutations, `git config
    core.hooksPath`, or `HUSKY=…` (repository search for `graphql`,
    `mergePullRequest`, `RepositoryRuleset`, `BranchProtectionRule`, `hooksPath`,
    `HUSKY`, `husky`).
- **GitHub surfaces to cover.** REST: `repos/{o}/{r}/rulesets` and
  `orgs/{org}/rulesets` (POST = create), `…/rulesets/{id}` (PUT update, DELETE),
  `repos/{o}/{r}/branches/{branch}/protection` and its sub-resources
  (`required_status_checks`, `enforce_admins`, `required_pull_request_reviews`,
  `restrictions`, `required_signatures`, …; branch names may contain `/`),
  `repos/{o}/{r}/pulls/{n}/merge` (PUT merges; GET only reports merged state).
  GraphQL mutations: `mergePullRequest`, `createRepositoryRuleset`,
  `updateRepositoryRuleset`, `deleteRepositoryRuleset`,
  `createBranchProtectionRule`, `updateBranchProtectionRule`,
  `deleteBranchProtectionRule`. `gh api` accepts the endpoint with or without a
  leading `/`, with `{owner}`/`{repo}` placeholders, with a query string, or as a
  full `https://api.github.com/…` URL; the method as `-X VAL`, `-XVAL`, `--method
  VAL`, or `--method=VAL` in any case; and defaults to POST when
  `-f`/`-F`/`--field`/`--raw-field`/`--input` is present without a method (an
  explicit `-X GET` keeps fields as query parameters).
- **Test surfaces.** `tests/guard.test.mjs` (38 tests) spawns
  `scripts/hooks/delivery-guard.sh` with a JSON payload. `tests/guard-fixtures.txt`
  (128 verdict lines) is replayed by `scripts/hooks/replay-guard.sh` in a throwaway
  repo on `feature/replay`, both in Local format and with `REPLAY_FORMAT=copilot`
  (CI `.github/workflows/ci.yml` runs both). Plain `git commit -m x` on
  `feature/replay` replays as `allow` (fixture line 51), so commit-based controls
  are usable.
- **Docs that enumerate guard rules.** `docs/hooks.md` rule table (lines ~108–133),
  the README PreToolUse summary (lines ~505–510), and `docs/architecture.md` lines
  88–91 (a category list: "force-push and hook bypasses, … ruleset-bypassing
  merges" — already generic enough; checked, likely unchanged). `CHANGELOG.md` top
  section `## 0.15.0` is undated (unreleased); package.json version `0.15.0`.
- **Guard self-friction observed while planning** (evidence for the Follow-ups):
  `grep -n -E '…|deny|ask' scripts/hooks/delivery-guard.sh` and `{ shellcheck
  scripts/hooks/*.sh …; } 2>&1 | tail` were both denied with the hook-shell-write
  reason — the first because the quoted `|` split off a segment whose command word
  was `ask'`, the second because `{` is the command word and is not in `READ_ONLY`.
- **Concurrent deliveries.** `gh pr list --state open` returned `[]` on 2026-10-28:
  no open delivery branch, no overlap.
- **Lint baseline (policy §5), 2026-10-28 at product `f6ec226`.**
  - Full-repository shell lint per AGENTS.md (`shellcheck scripts/hooks/*.sh
    scripts/wait-for-checks.sh`): a bare `shellcheck` is not installed on this
    machine (`npm run lint:hooks` → exit 127, `shellcheck: not found`), so the same
    file set was linted with `git ls-files '*.sh' | xargs pnpm dlx shellcheck`
    (ShellCheck v0.11.0; files: `scripts/hooks/delivery-guard.sh`,
    `scripts/hooks/replay-guard.sh`, `scripts/hooks/session-context.sh`,
    `scripts/wait-for-checks.sh`): **exit 0, no findings.**
  - CI corroboration: run 40784866288 on `main` at `f6ec226` — `Shellcheck`,
    `Unit tests`, and all four `Guard fixture replay` steps `success`.
  - Full tests: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'
    'canvas/**/*.test.mjs'` exit 0, **816/816**; `tests/guard.test.mjs` alone 38/38.
  - Replays: Local, Copilot-format, Copilot-format companion all exit 0.
  - Decision: baseline is green, so **no cleanup and no scoped gate** — the full
    lint, full tests, and all five replay commands must stay green with no new
    findings.

## Approach

All behavior changes are in `scripts/hooks/delivery-guard.mjs`; edits there (and any
in `scripts/hooks/`) raise the guard's own per-change approval card — that is
expected, not a blocker.

1. **`gh api` write rule** — a new exported helper (e.g. `ghApiVerdict(segments,
   command)`) called right after the `gh pr merge` block, before the "no git word →
   allow" return.
   - Recognise a segment invoking `gh api` (after `commandWord()` prefixes such as
     `env` and `timeout`; `cd … &&` chains are already separate segments).
   - **Method:** the value of `-X`/`-XVAL`/`--method`/`--method=` uppercased; if
     absent, `POST` when any of `-f`, `-F`, `--field`, `--raw-field`, `--input` is
     present, else `GET`. Writes are `POST`/`PUT`/`PATCH`/`DELETE`.
   - **Endpoint:** the first positional argument after `api` (skipping option
     values), normalised by stripping a leading `https://api.github.com`, a leading
     `/`, and any `?query`.
   - **REST verdicts for writes:**
     - `(repos/[^/]+/[^/]+|orgs/[^/]+)/rulesets` exactly, method `POST` → **ask**
       ("Creating a ruleset adds protection; approve this ruleset creation?").
     - `…/rulesets/<id>` (any sub-path), any write → **deny** ("Changing or
       deleting a ruleset removes the enforcement layer the guard relies on; edit
       rulesets in the GitHub UI yourself.").
     - `repos/…/branches/<anything>/protection` and any sub-path, any write →
       **deny** (same reason, branch protection).
     - `repos/…/pulls/<n>/merge`, any write → **deny** ("Merging through the API
       bypasses the `/agento ship` audit gate; run `/agento ship <slug>` from the
       primary window.").
     - Everything else (including `pulls/<n>` PATCH, `issues/*/comments` POST, and
       every GET) → no verdict from this rule.
   - **GraphQL:** when any segment's endpoint is `graphql`, search the **whole
     command text** (multi-line queries are split across segments) for whole-word
     mutation names: `mergePullRequest`, `updateRepositoryRuleset`,
     `deleteRepositoryRuleset`, `createBranchProtectionRule`,
     `updateBranchProtectionRule`, `deleteBranchProtectionRule` → **deny**;
     `createRepositoryRuleset` → **ask**. A query with no listed mutation → no
     verdict. (A query loaded from a file, `-F query=@file`, cannot be inspected —
     documented limitation; the ruleset remains the boundary.)
2. **`git push --mirror`** — in the per-segment push checks next to force-push:
   `--mirror` on any `git push` → **deny** ("`git push --mirror` force-updates and
   deletes remote refs, including `<default>`; push the work branch by name."),
   regardless of the current branch.
3. **Inline hooks-path override** — any git segment whose global options contain
   `-c core.hooksPath=…` (key matched case-insensitively, value anything including
   empty) or `--config-env=core.hooksPath=…` → **deny** ("Overriding core.hooksPath
   bypasses hooks like `--no-verify`.").
4. **Persistent hooks-path change** — `git [-c …] config …` naming `core.hooksPath`
   (case-insensitive) as a write → **ask** ("Changing core.hooksPath changes which
   hooks run; is this a tool install such as husky?"). A write is: a value
   positional after the key, or `--unset`/`--unset-all`/`--replace-all`/`--add`, or
   the git ≥ 2.46 subcommands `set`/`unset`. Reads (`--get`, `--get-all`, `get`,
   `--list`, the key alone) → no verdict. Scope flags (`--local`, `--global`,
   `--worktree`, `--file <f>`) do not change the verdict.
5. **Hook-skipping environment** —
   - a `git commit`/`git push`/`git merge` segment whose leading assignments
     (including after `env`) set `HUSKY=0` or `HUSKY_SKIP_HOOKS` to a non-empty value
     → **deny** ("HUSKY=0 / HUSKY_SKIP_HOOKS skip the project's hooks, like
     `--no-verify`.").
   - `export HUSKY=0` or `export HUSKY_SKIP_HOOKS=<non-empty>` in any segment →
     **deny** (same reason). This check sits before the "no git word" early return.
   - `HUSKY=1` (or any other value) is not a bypass → no verdict.
6. **Tests.**
   - `tests/guard-fixtures.txt`: a new `# Ruleset, merge, and hook-path bypasses
     (guard-bypass-gaps)` section holding each of the six reported commands verbatim
     with its verdict, plus the spelling variants and the allow/ask controls listed
     in the acceptance checklist. It replays in Local and Copilot format unchanged.
   - `tests/guard.test.mjs`: focused `node:test` cases per rule asserting decision
     **and** that the reason names the safe alternative (`/agento ship`, the GitHub
     UI, the `--no-verify` analogy), including the multi-line GraphQL case that the
     one-line fixture format cannot express.
7. **Docs.**
   - `docs/hooks.md` rule table: new rows for the `gh api` REST and GraphQL rules
     (deny / ask-on-create), `git push --mirror` (deny), `-c core.hooksPath` /
     `--config-env` (deny), `git config core.hooksPath` writes (ask), and `HUSKY=0`
     / `HUSKY_SKIP_HOOKS` (deny), plus one sentence on the known limits (`-F
     query=@file`, quoted pipes).
   - README PreToolUse summary: extend the deny and ask lists.
   - `CHANGELOG.md` `## 0.15.0`: one **Fixed.** entry.

## Risks

- **Breaking `/agento agento-init`.** It POSTs to `…/rulesets`. Mitigation: create
  is `ask`, not `deny` (Decision 6); an explicit fixture `ask gh api -X POST
  repos/o/r/rulesets --input ruleset.json` and the GET reads at agento-init lines
  209–210 as `allow` fixtures lock this in. In Copilot under **Allow all** an `ask`
  runs without a card (docs/hooks.md), so creation stays frictionless there.
- **False positives on unrelated `gh api` writes.** Mitigation: the rule only fires
  for the three endpoint families and the listed mutations; controls for `pulls/<n>`
  PATCH (agento-init cross-link) and `issues/<n>/comments` POST stay `allow`.
- **Segment splitting.** Multi-line GraphQL and `--jq` filters with `|` split the
  command. Mitigation: GraphQL names are matched on the whole command; REST method
  and endpoint are normally adjacent to `gh api`. A `-X` placed after a piped `--jq`
  can still escape — documented in docs/hooks.md as a slip-guard limit (Follow-up
  for quote-aware splitting).
- **The guard is a slip guard, not a boundary.** Further spellings remain
  (`GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_0` env, `curl` to the REST API, `-F
  query=@file`). Mitigation: unchanged — the GitHub ruleset is the boundary; these
  are listed in docs/hooks.md, not chased here.
- **Editing the guard trips the guard.** Every edit to
  `scripts/hooks/delivery-guard.mjs` raises a per-change approval card, and shell
  commands naming `scripts/hooks/` with a non-read-only command word are denied.
  Mitigation: the Builder edits with the edit tool and lints via `git ls-files '*.sh'
  | xargs pnpm dlx shellcheck` (no hook path in the command text).
- **`shellcheck` not installed locally.** Mitigation: `pnpm dlx shellcheck` (as
  recorded in the baseline) plus the CI `Shellcheck` step on the PR.
- **Concurrent deliveries.** None open on 2026-10-28; integrate `origin/main` by
  merge before every push regardless.

## Out of scope

- Quote-aware segment splitting and the `{ … }` command-word false positive (Decision
  5) — recorded as Follow-ups in roadmap.md.
- `gh pr merge --auto` and GraphQL `enablePullRequestAutoMerge` (Decision 7) —
  recorded as a Follow-up.
- `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_n`/`GIT_CONFIG_PARAMETERS` env injection, raw
  `curl` to the GitHub API, other hook managers' skip variables (lefthook,
  pre-commit `SKIP=`), and inspecting `-F query=@file` contents.
- Any change to `agento-init`'s ruleset flow, the extension, the canvas, or the
  plugin hook wiring (`hooks/hooks.json`, `.github/hooks/`).

## Acceptance checklist

- [ ] All six reported commands get their decided verdict in both replay formats:
  `deny` for `gh api -X DELETE repos/o/r/rulesets/1`, `gh api -X PUT
  repos/o/r/pulls/1/merge`, `git -c core.hooksPath=/dev/null commit -m x`, `HUSKY=0
  git commit -m x`, `git push --mirror origin`; `ask` for `git config core.hooksPath
  /dev/null` — verify: the lines exist verbatim in `tests/guard-fixtures.txt` and
  `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` and
  `REPLAY_FORMAT=copilot ./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt`
  both exit 0.
- [ ] `gh api` REST writes are covered across spellings: `-X`, `-XVAL`, `--method`,
  `--method=`, lower-case methods, a leading `/`, `{owner}/{repo}` placeholders, a
  full `https://api.github.com/` URL, and the implicit POST from
  `-f`/`-F`/`--field`/`--raw-field`/`--input`; writes to `rulesets/<id>`,
  `branches/<b>/protection[/…]` (including a branch name with `/`), and
  `pulls/<n>/merge` deny — verify: fixture lines for each spelling replay green.
- [ ] Ruleset creation asks and reads stay allowed: `gh api -X POST
  repos/o/r/rulesets --input r.json` and `gh api orgs/o/rulesets -f name=x` → `ask`;
  `gh api repos/o/r/rulesets --jq '.[] | .name'`, `gh api
  repos/o/r/branches/main/protection`, `gh api repos/o/r/pulls/1/merge` (GET), and
  `gh api -X GET repos/o/r/rulesets -f includes_parents=true` → `allow` — verify:
  fixtures replay green.
- [ ] Unrelated `gh api` writes stay allowed: `gh api repos/o/r/pulls/1 -X PATCH -f
  body=x` and `gh api repos/o/r/issues/1/comments -X POST -f body=x` → `allow` —
  verify: fixtures replay green.
- [ ] GraphQL: `mergePullRequest`, `updateRepositoryRuleset`,
  `deleteRepositoryRuleset`, `createBranchProtectionRule`,
  `updateBranchProtectionRule`, `deleteBranchProtectionRule` → `deny`;
  `createRepositoryRuleset` → `ask`; a plain `query { viewer { login } }` → `allow`;
  a mutation spread over several lines is still caught — verify: one-line fixtures
  replay green and a multi-line `tests/guard.test.mjs` case passes.
- [ ] Hook-path and hook-skip variants: `git -c core.hookspath=/dev/null push origin
  feature/widget` and `git --config-env=core.hooksPath=X commit -m x` → `deny`; `git
  config --local core.hooksPath .husky/_`, `git config --unset core.hooksPath`, and
  `git config set core.hooksPath x` → `ask`; `git config --get core.hooksPath` and
  `git config core.hooksPath` → `allow`; `env HUSKY=0 git push origin
  feature/widget`, `HUSKY_SKIP_HOOKS=1 git commit -m x`, `export HUSKY=0`, and
  `export HUSKY_SKIP_HOOKS=1` → `deny`; `HUSKY=1 git commit -m x` → `allow`; `git
  push --mirror` (no remote) → `deny` — verify: fixtures replay green.
- [ ] Every new deny/ask reason names the safe alternative or the bypass it
  resembles — verify: `tests/guard.test.mjs` asserts the reason text per rule and
  `node --test tests/guard.test.mjs` passes.
- [ ] No regression: full `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'
  'canvas/**/*.test.mjs'` exit 0 with ≥ 816 passing and 0 failing; all five replay
  commands from AGENTS.md exit 0 — verify: rerun and record counts.
- [ ] Lint gate (green baseline): `git ls-files '*.sh' | xargs pnpm dlx shellcheck`
  exit 0 with no findings, and the PR's CI `Shellcheck` step passes — verify: rerun
  locally and `scripts/wait-for-checks.sh pr <n>` exit 0.
- [ ] Docs match behavior: `docs/hooks.md` has a table row for each new rule and the
  known-limits sentence, the README PreToolUse summary lists the new denies/asks,
  and `CHANGELOG.md` `## 0.15.0` has a **Fixed.** entry — verify: read the diff;
  `node --test tests/customizations.test.mjs` passes.
- [ ] Follow-ups kept in roadmap.md `## Follow-ups`: quote-aware segment splitting
  (quoted `|`), the `{ … }` command-word false positive, and `gh pr merge --auto` /
  `enablePullRequestAutoMerge`, none fixed in this delivery — verify: the three lines
  are present and the diff does not touch `SEGMENT_SPLIT` or the `--auto` handling.
