```yaml
status: in-progress
branch: feature/guard-bypass-gaps
last-updated: 2026-10-29
next-step: "2.3 Ask on persistent core.hooksPath writes"
artifact-pr: "#70"
```

## Phase 1: Baseline

- [x] 1.1 Re-run the baseline on the branch before any change and record it on this line: `node --test tests/guard.test.mjs` (count), the full `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` (count), the five replay commands from AGENTS.md (exit codes), and `git ls-files '*.sh' | xargs pnpm dlx shellcheck` (exit, findings). Planning baseline at `f6ec226`: guard 38/38, full 816/816, all replays exit 0, shellcheck v0.11.0 exit 0 with no findings. A red result triggers the policy §5 overlap reassessment before continuing — verify: results recorded on this line and `git status --porcelain --untracked-files=all` is empty. **Baseline at `30812a8` (2026-10-29): guard 38/38, full 816/816, all five replays exit 0, shellcheck exit 0 with no findings — green, matches planning baseline.**

## Phase 2: Git-side bypasses

Every rule edit is in `scripts/hooks/delivery-guard.mjs` (made with the edit tool, which raises the guard's per-change approval card). Every new fixture goes into one new section of `tests/guard-fixtures.txt` headed `# Ruleset, merge, and hook-path bypasses (guard-bypass-gaps)`.

- [x] 2.1 Deny `git push --mirror` from any branch (plan.md `## Approach` item 2), with a reason telling the agent to push the work branch by name. Add fixtures `deny git push --mirror origin` and `deny git push --mirror`, plus a `tests/guard.test.mjs` case asserting the decision and reason. Existing lines 140 (`git switch main && git push --mirror origin`) and companion line 65 stay `deny` — verify: `node --test tests/guard.test.mjs` exit 0; `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` and `REPLAY_FORMAT=copilot REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` both exit 0
- [x] 2.2 Deny the inline hooks-path override (`## Approach` item 3): `-c core.hooksPath=…`, with the key case-insensitive and any value, and `--config-env=core.hooksPath=…` on any git segment. Fixtures: `deny git -c core.hooksPath=/dev/null commit -m x` (reported verbatim form), `deny git -c core.hookspath=/dev/null push origin feature/widget`, `deny git --config-env=core.hooksPath=X commit -m x`, and the control `allow git -c user.name=x commit -m x`. Add a unit test for the reason — verify: `node --test tests/guard.test.mjs` exit 0; Local and Copilot-format replays of `tests/guard-fixtures.txt` exit 0
- [ ] 2.3 Ask on persistent `core.hooksPath` writes (`## Approach` item 4). Fixtures: `ask git config core.hooksPath /dev/null` (reported form), `ask git config --local core.hooksPath .husky/_`, `ask git config --global core.hooksPath /tmp/h`, `ask git config --unset core.hooksPath`, `ask git config set core.hooksPath x`; controls `allow git config --get core.hooksPath`, `allow git config core.hooksPath`, `allow git config user.name x`. Add a unit test for the reason — verify: `node --test tests/guard.test.mjs` exit 0; Local and Copilot-format replays exit 0
- [ ] 2.4 Deny hook-skipping environment (`## Approach` item 5). This covers `HUSKY=0` and `HUSKY_SKIP_HOOKS=<non-empty>` as leading assignments, including after `env`, on `git commit`/`push`/`merge`, and `export HUSKY=0` / `export HUSKY_SKIP_HOOKS=<non-empty>` in any segment. The export check sits before the "no git word" early return. Fixtures: `deny HUSKY=0 git commit -m x` (reported form), `deny env HUSKY=0 git push origin feature/widget`, `deny HUSKY_SKIP_HOOKS=1 git commit -m x`, `deny export HUSKY=0`, `deny export HUSKY_SKIP_HOOKS=1`; controls `allow HUSKY=1 git commit -m x`, `allow export FOO=0`. Add a unit test for the reason — verify: `node --test tests/guard.test.mjs` exit 0; Local and Copilot-format replays exit 0

## Phase 3: GitHub API bypasses

- [ ] 3.1 Add the `gh api` REST write rule (`## Approach` item 1). Put it in a new exported helper called right after the `gh pr merge` block and before the "no git word → allow" return. It parses the method (`-X`, `-XVAL`, `--method`, `--method=`, any case; no method means GET) and normalises the endpoint (leading `/`, `https://api.github.com/` prefix, `?query`). Writes to `rulesets/<id>[/…]`, `branches/<b>/protection[/…]`, and `pulls/<n>/merge` deny. POST to the `repos/*/*/rulesets` or `orgs/*/rulesets` collection asks. Each reason names the safe alternative: the GitHub UI for rulesets and protection, `/agento ship <slug>` for merges. Fixtures, including the reported forms verbatim:
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
- [ ] 3.2 Treat `-f`/`-F`/`--field`/`--raw-field`/`--input` without a method as POST, while an explicit `-X GET` stays a read (Decision 2). Fixtures:
  - deny:
    - `gh api repos/o/r/rulesets/1 -f enforcement=disabled`
    - `gh api repos/o/r/pulls/1/merge -F merge_method=merge`
    - `gh api repos/o/r/branches/main/protection --input p.json`
  - ask:
    - `gh api orgs/o/rulesets -f name=x`
    - `gh api repos/o/r/rulesets --raw-field name=x`
  - allow control: `gh api -X GET repos/o/r/rulesets -f includes_parents=true`

  — verify: `node --test tests/guard.test.mjs` exit 0; Local and Copilot-format replays exit 0
- [ ] 3.3 Add the GraphQL mutation rule. When any segment calls `gh api graphql`, scan the whole command text for whole-word mutation names. `mergePullRequest`, `updateRepositoryRuleset`, `deleteRepositoryRuleset`, `createBranchProtectionRule`, `updateBranchProtectionRule`, and `deleteBranchProtectionRule` deny; `createRepositoryRuleset` asks. Fixtures:
  - deny, one line each for: `gh api graphql -f query='mutation { mergePullRequest(input: {pullRequestId: "x"}) { clientMutationId } }'`, then the same shape for `deleteRepositoryRuleset`, `updateRepositoryRuleset`, `createBranchProtectionRule`, `updateBranchProtectionRule`, and `deleteBranchProtectionRule`
  - ask: `gh api graphql -f query='mutation { createRepositoryRuleset(input: {}) { clientMutationId } }'`
  - allow: `gh api graphql -f query='query { viewer { login } }'`

  Add a `tests/guard.test.mjs` case with a **multi-line** `mergePullRequest` query (newlines inside the quoted `-f query=`) that still denies — verify: `node --test tests/guard.test.mjs` exit 0; Local and Copilot-format replays exit 0

## Phase 4: Documentation

- [ ] 4.1 Update `docs/hooks.md`:
  - Add rule-table rows for: the `gh api` REST write rule (deny; ask on ruleset create), the GraphQL mutations (deny; ask on `createRepositoryRuleset`), `git push --mirror` (deny from any branch), `-c core.hooksPath` and `--config-env=core.hooksPath` (deny), `git config` writes of `core.hooksPath` (ask), and `HUSKY=0` / `HUSKY_SKIP_HOOKS` as a prefix or `export` (deny).
  - Adjust the existing default-branch push row so `--mirror` is no longer listed as conditional.
  - Add one known-limits sentence covering `-F query=@file`, a method placed after a piped `--jq`, `GIT_CONFIG_*` env, and raw `curl`.

  Then extend the README PreToolUse summary's deny and ask lists to match — verify: the diff shows each rule once in each file; `node --test tests/customizations.test.mjs` exit 0
- [ ] 4.2 Add one `- **Fixed.**` entry at the top of `CHANGELOG.md` `## 0.15.0` naming the closed bypasses and the ask-on-create carve-out for `/agento agento-init` — verify: `git diff origin/main -- CHANGELOG.md` shows only the new entry

## Phase 5: Verification and hand-off

- [ ] 5.1 Run the full gate and record the results on this line:
  - full `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` (≥ 816 passing, 0 failing);
  - all five replay commands from AGENTS.md (each exit 0);
  - `git ls-files '*.sh' | xargs pnpm dlx shellcheck` (exit 0, no findings, the same as the baseline);
  - `grep -c -E '^(allow|ask|deny) ' tests/guard-fixtures.txt` (more than 128).

  — verify: every result is recorded and matches the expectation; `git status --porcelain --untracked-files=all` is empty
- [ ] 5.2 Re-check the three planned Follow-ups below against the final code, and add any new unrelated problem found during the build as another Follow-up with an `(added <date>)` suffix. Do not fix any of them in this delivery — verify: `## Follow-ups` holds at least the three planned lines, each still accurate
- [ ] 5.3 Merge `origin/main` into the product branch and the companion's `origin/main` into the companion branch, then push product first. Wait on CI with `scripts/wait-for-checks.sh pr <code-pr>`, rerunning while it exits 2. When it passes, set `status: in-review` — verify: `wait-for-checks.sh` exits 0 with Shellcheck, Unit tests, and all four replay steps green; both halves report `dirty: false` and `ahead: 0` in `node scripts/agento.mjs session`

## Follow-ups

- Quote-aware segment splitting: `SEGMENT_SPLIT` splits on `|` inside quotes, so `grep -n -E '…|deny|ask' scripts/hooks/delivery-guard.sh` is denied as a hook-file shell write. The fragment `ask' scripts/hooks/…` becomes its own segment with a non-read-only command word. This also lets a `-X` placed after a piped `--jq` escape the `gh api` rule. Observed while planning on 2026-10-28.
- Brace-group command word: `{ shellcheck scripts/hooks/*.sh …; } 2>&1 | tail` is denied because `{` is the command word and is not in `READ_ONLY`. Treat `{`/`(` grouping as transparent. Observed while planning on 2026-10-28.
- `gh pr merge --auto` and GraphQL `enablePullRequestAutoMerge` arm a merge outside the `/agento ship` gate. Policy says ship never uses `--auto`, but the guard allows it (Decision 7).
