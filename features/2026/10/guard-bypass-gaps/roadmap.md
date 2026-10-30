```yaml
status: complete
branch: feature/guard-bypass-gaps
last-updated: 2026-10-30
next-step: ""
artifact-pr: "#70"
```

## Phase 1: Baseline

- [x] 1.1 Re-run the baseline on the branch before any change and record it on this line: `node --test tests/guard.test.mjs` (count), the full `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` (count), the five replay commands from AGENTS.md (exit codes), and `git ls-files '*.sh' | xargs pnpm dlx shellcheck` (exit, findings). Planning baseline at `f6ec226`: guard 38/38, full 816/816, all replays exit 0, shellcheck v0.11.0 exit 0 with no findings. A red result triggers the policy §5 overlap reassessment before continuing — verify: results recorded on this line and `git status --porcelain --untracked-files=all` is empty. **Baseline at `30812a8` (2026-10-29): guard 38/38, full 816/816, all five replays exit 0, shellcheck exit 0 with no findings — green, matches planning baseline.**

## Phase 2: Git-side bypasses

Every rule edit is in `scripts/hooks/delivery-guard.mjs` (made with the edit tool, which raises the guard's per-change approval card). Every new fixture goes into one new section of `tests/guard-fixtures.txt` headed `# Ruleset, merge, and hook-path bypasses (guard-bypass-gaps)`.

- [x] 2.1 Deny `git push --mirror` from any branch (plan.md `## Approach` item 2), with a reason telling the agent to push the work branch by name. Add fixtures `deny git push --mirror origin` and `deny git push --mirror`, plus a `tests/guard.test.mjs` case asserting the decision and reason. Existing lines 140 (`git switch main && git push --mirror origin`) and companion line 65 stay `deny` — verify: `node --test tests/guard.test.mjs` exit 0; `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` and `REPLAY_FORMAT=copilot REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` both exit 0
- [x] 2.2 Deny the inline hooks-path override (`## Approach` item 3): `-c core.hooksPath=…`, with the key case-insensitive and any value, and `--config-env=core.hooksPath=…` on any git segment. Fixtures: `deny git -c core.hooksPath=/dev/null commit -m x` (reported verbatim form), `deny git -c core.hookspath=/dev/null push origin feature/widget`, `deny git --config-env=core.hooksPath=X commit -m x`, and the control `allow git -c user.name=x commit -m x`. Add a unit test for the reason — verify: `node --test tests/guard.test.mjs` exit 0; Local and Copilot-format replays of `tests/guard-fixtures.txt` exit 0
- [x] 2.3 Ask on persistent `core.hooksPath` writes (`## Approach` item 4). Fixtures: `ask git config core.hooksPath /dev/null` (reported form), `ask git config --local core.hooksPath .husky/_`, `ask git config --global core.hooksPath /tmp/h`, `ask git config --unset core.hooksPath`, `ask git config set core.hooksPath x`; controls `allow git config --get core.hooksPath`, `allow git config core.hooksPath`, `allow git config user.name x`. Add a unit test for the reason — verify: `node --test tests/guard.test.mjs` exit 0; Local and Copilot-format replays exit 0
- [x] 2.4 Deny hook-skipping environment (`## Approach` item 5). This covers `HUSKY=0` and `HUSKY_SKIP_HOOKS=<non-empty>` as leading assignments, including after `env`, on `git commit`/`push`/`merge`, and `export HUSKY=0` / `export HUSKY_SKIP_HOOKS=<non-empty>` in any segment. The export check sits before the "no git word" early return. Fixtures: `deny HUSKY=0 git commit -m x` (reported form), `deny env HUSKY=0 git push origin feature/widget`, `deny HUSKY_SKIP_HOOKS=1 git commit -m x`, `deny export HUSKY=0`, `deny export HUSKY_SKIP_HOOKS=1`; controls `allow HUSKY=1 git commit -m x`, `allow export FOO=0`. Add a unit test for the reason — verify: `node --test tests/guard.test.mjs` exit 0; Local and Copilot-format replays exit 0

## Phase 3: GitHub API bypasses

- [x] 3.1 Add the `gh api` REST write rule (`## Approach` item 1). Put it in a new exported helper called right after the `gh pr merge` block and before the "no git word → allow" return. It parses the method (`-X`, `-XVAL`, `--method`, `--method=`, any case; no method means GET) and normalises the endpoint (leading `/`, `https://api.github.com/` prefix, `?query`). Writes to `rulesets/<id>[/…]`, `branches/<b>/protection[/…]`, and `pulls/<n>/merge` deny. POST to the `repos/*/*/rulesets` or `orgs/*/rulesets` collection asks. Each reason names the safe alternative: the GitHub UI for rulesets and protection, `/agento ship <slug>` for merges. Fixtures, including the reported forms verbatim:
  - deny:
    - `gh api -X DELETE repos/o/r/rulesets/1`
    - `gh api -X PUT repos/o/r/pulls/1/merge`
    - `gh api --method PUT repos/o/r/rulesets/1 --input r.json`
    - `gh api --method=delete /repos/o/r/rulesets/1`
    - `gh api -XDELETE repos/o/r/branches/main/protection`
    - `gh api -X PUT repos/{owner}/{repo}/branches/main/protection --input p.json`
    - `gh api -X DELETE repos/o/r/branches/release/v1/protection/required_status_checks`
    - `gh api -X PATCH https://api.github.com/repos/o/r/rulesets/7`
    - `gh api -X DELETE orgs/o/rulesets/3`
  - ask:
    - `gh api -X POST repos/o/r/rulesets --input ruleset.json`
    - `gh api -X POST repos/{owner}/{repo}/rulesets --input ruleset.json`
  - allow controls:
    - `gh api repos/o/r/rulesets --jq '.[] | .name'`
    - `gh api repos/o/r/branches/main/protection`
    - `gh api repos/o/r/pulls/1/merge`
    - `gh api repos/o/r/pulls/1 -X PATCH -f body=x`
    - `gh api repos/o/r/issues/1/comments -X POST -f body=x`
    - `gh api user`

  Add unit tests for the three reasons — verify: `node --test tests/guard.test.mjs` exit 0; Local and Copilot-format replays exit 0
- [x] 3.2 Treat `-f`/`-F`/`--field`/`--raw-field`/`--input` without a method as POST, while an explicit `-X GET` stays a read (Decision 2). Fixtures:
  - deny:
    - `gh api repos/o/r/rulesets/1 -f enforcement=disabled`
    - `gh api repos/o/r/pulls/1/merge -F merge_method=merge`
    - `gh api repos/o/r/branches/main/protection --input p.json`
  - ask:
    - `gh api orgs/o/rulesets -f name=x`
    - `gh api repos/o/r/rulesets --raw-field name=x`
  - allow control: `gh api -X GET repos/o/r/rulesets -f includes_parents=true`

  — verify: `node --test tests/guard.test.mjs` exit 0; Local and Copilot-format replays exit 0
- [x] 3.3 Add the GraphQL mutation rule. When any segment calls `gh api graphql`, scan the whole command text for whole-word mutation names. `mergePullRequest`, `updateRepositoryRuleset`, `deleteRepositoryRuleset`, `createBranchProtectionRule`, `updateBranchProtectionRule`, and `deleteBranchProtectionRule` deny; `createRepositoryRuleset` asks. Fixtures:
  - deny, one line each for: `gh api graphql -f query='mutation { mergePullRequest(input: {pullRequestId: "x"}) { clientMutationId } }'`, then the same shape for `deleteRepositoryRuleset`, `updateRepositoryRuleset`, `createBranchProtectionRule`, `updateBranchProtectionRule`, and `deleteBranchProtectionRule`
  - ask: `gh api graphql -f query='mutation { createRepositoryRuleset(input: {}) { clientMutationId } }'`
  - allow: `gh api graphql -f query='query { viewer { login } }'`

  Add a `tests/guard.test.mjs` case with a **multi-line** `mergePullRequest` query (newlines inside the quoted `-f query=`) that still denies — verify: `node --test tests/guard.test.mjs` exit 0; Local and Copilot-format replays exit 0
- [x] 3.4 Harden `ghApiMethodAndEndpoint` so every value-taking `gh api` option is skipped as a pair before the endpoint is picked (review F1): `-H`/`--header`, `--hostname`, `-q`/`--jq`, `-t`/`--template`, `-p`/`--preview`, `--cache`, in addition to `-X`/`--method` and the five field flags, plus their `--opt=value` forms; strip a trailing `/` in `normalizeGhEndpoint` (F5); restrict `hookSkipExport` to the segment's command word so `echo export HUSKY=0` allows (F4). Fixtures: `deny gh api --method PUT -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" /repos/o/r/pulls/1/merge` (the GitHub REST docs' sample shape), `deny gh api -H "Accept: application/vnd.github+json" -X DELETE repos/o/r/rulesets/1`, `deny gh api -X DELETE --jq .id repos/o/r/rulesets/1`, `deny gh api -X PUT repos/o/r/pulls/1/merge/`; controls `allow gh api -H "Accept: application/vnd.github+json" repos/o/r/rulesets`, `allow gh api --jq .name repos/o/r/rulesets/1`, `allow echo export HUSKY=0` (F4). Add a `tests/guard.test.mjs` case — verify: `node --test tests/guard.test.mjs` exit 0; Local and Copilot-format replays exit 0 (added 2026-10-29)
- [x] 3.5 Detect GraphQL by the normalised endpoint (`graphql` after stripping the host and leading `/`, regardless of options before it) instead of the positional `toks[i+2] === "graphql"` (review F3), and make `ghApiVerdict` fall through to the REST scan when the GraphQL verdict is `null` instead of returning it (review F2). Fixtures: `deny gh api -X POST graphql -f query='mutation { mergePullRequest(input: {}) { clientMutationId } }'`, `deny gh api /graphql -f query='mutation { mergePullRequest(input: {}) { clientMutationId } }'`, `deny gh api -H 'X: y' graphql -f query='mutation { deleteRepositoryRuleset(input: {}) { clientMutationId } }'`, and the chain `deny gh api graphql -f query='query { viewer { login } }' && gh api -X DELETE repos/o/r/rulesets/1`; control `allow gh api -X POST graphql -f query='query { viewer { login } }'`. Then rerun the step 5.1 gate and update its recorded line — verify: `node --test tests/guard.test.mjs` exit 0; all five replays exit 0; full tests ≥ 824 pass, 0 fail; shellcheck exit 0, no findings (added 2026-10-29)

## Phase 4: Documentation

- [x] 4.1 Update `docs/hooks.md`:
  - Add rule-table rows for: the `gh api` REST write rule (deny; ask on ruleset create), the GraphQL mutations (deny; ask on `createRepositoryRuleset`), `git push --mirror` (deny from any branch), `-c core.hooksPath` and `--config-env=core.hooksPath` (deny), `git config` writes of `core.hooksPath` (ask), and `HUSKY=0` / `HUSKY_SKIP_HOOKS` as a prefix or `export` (deny).
  - Adjust the existing default-branch push row so `--mirror` is no longer listed as conditional.
  - Add one known-limits sentence covering `-F query=@file`, a method placed after a piped `--jq`, `GIT_CONFIG_*` env, and raw `curl`.

  Then extend the README PreToolUse summary's deny and ask lists to match — verify: the diff shows each rule once in each file; `node --test tests/customizations.test.mjs` exit 0
- [x] 4.2 Add one `- **Fixed.**` entry at the top of `CHANGELOG.md` `## 0.15.0` naming the closed bypasses and the ask-on-create carve-out for `/agento agento-init` — verify: `git diff origin/main -- CHANGELOG.md` shows only the new entry

## Phase 5: Verification and hand-off

- [x] 5.1 Run the full gate and record the results on this line:
  - full `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` (≥ 816 passing, 0 failing);
  - all five replay commands from AGENTS.md (each exit 0);
  - `git ls-files '*.sh' | xargs pnpm dlx shellcheck` (exit 0, no findings, the same as the baseline);
  - `grep -c -E '^(allow|ask|deny) ' tests/guard-fixtures.txt` (more than 128).

  — verify: every result is recorded and matches the expectation; `git status --porcelain --untracked-files=all` is empty. **Gate rerun after 3.4/3.5 (2026-10-29): full tests 827/827 pass, 0 fail (≥ 816); all five replays exit 0; shellcheck exit 0, no findings; fixture verdict lines 192 (> 128).**
- [x] 5.2 Re-check the three planned Follow-ups below against the final code, and add any new unrelated problem found during the build as another Follow-up with an `(added <date>)` suffix. Do not fix any of them in this delivery — verify: `## Follow-ups` holds at least the three planned lines, each still accurate
- [x] 5.3 Merge `origin/main` into the product branch and the companion's `origin/main` into the companion branch, then push product first. Wait on CI with `scripts/wait-for-checks.sh pr <code-pr>`, rerunning while it exits 2. When it passes, set `status: in-review` — verify: `wait-for-checks.sh` exits 0 with Shellcheck, Unit tests, and all four replay steps green; both halves report `dirty: false` and `ahead: 0` in `node scripts/agento.mjs session`. **CI green on PR #136 (run 40927431118 at `c3f04ab`, job `test` success: Unit tests, Shellcheck, and all four Guard fixture replay steps). Re-confirmed after 3.4/3.5 at `7556501`: run 40956358614 `success`, same six steps green (recorded by the reviewer 2026-10-29).**

## Follow-ups

- Quote-aware segment splitting: `SEGMENT_SPLIT` splits on `|` inside quotes, so `grep -n -E '…|deny|ask' scripts/hooks/delivery-guard.sh` is denied as a hook-file shell write. The fragment `ask' scripts/hooks/…` becomes its own segment with a non-read-only command word. This also lets a `-X` placed after a piped `--jq` escape the `gh api` rule. Observed while planning on 2026-10-28.
- Brace-group command word: `{ shellcheck scripts/hooks/*.sh …; } 2>&1 | tail` is denied because `{` is the command word and is not in `READ_ONLY`. Treat `{`/`(` grouping as transparent. Observed while planning on 2026-10-28.
- `gh pr merge --auto` and GraphQL `enablePullRequestAutoMerge` arm a merge outside the `/agento ship` gate. Policy says ship never uses `--auto`, but the guard allows it (Decision 7).
- Quoted-command-text false positive: the git policy (now including the new `git push --mirror` deny) matches `git <subcommand>` sequences inside quoted strings, so `printf '%s\n' "git push --mirror"` is denied as a mirror push even though the command word is `printf`. The guard reads shell text literally rather than after quote removal. (added 2026-10-29)
- Backslash-newline continuations split segments: `SEGMENT_SPLIT` includes `\n`, so a docs-style multi-line `gh api \` … `--method PUT \` … `/repos/o/r/pulls/1/merge` is allowed, and so are `git push \`⏎`--force origin feature/x` and `gh pr merge 1 \`⏎`--admin`. Pre-existing and guard-wide; joining `\\\n` before segmenting would close it for every rule. Observed during review on 2026-10-29. (added 2026-10-29)
