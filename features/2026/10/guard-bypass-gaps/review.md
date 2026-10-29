# Review: guard-bypass-gaps

Verdict: request-changes

Reviewed 2026-10-29 at product `c3f04ab` (PR david-perry-software/agento#136, branch
`feature/guard-bypass-gaps`, `origin/main` is an ancestor) against plan.md and
roadmap.md on the companion branch (PR agento-docs#70). Review round 1.

Everything the plan lists is implemented, tested, documented, and green: the six
reported commands get their decided verdicts, the agento-init flows stay `ask`/`allow`,
every reason names the safe alternative, full tests 824/824, all five replays exit 0,
shellcheck matches the baseline, CI green. The verdict is request-changes because the
new `gh api` rule — the feature's primary deliverable — is escaped by the GitHub REST
docs' canonical `gh api` spelling (headers before the endpoint) and by chaining a
harmless `gh api graphql` query in front of a REST write (findings F1–F3). Those are
parser-robustness defects in `ghApiVerdict`, not scope changes; the plan's own user
direction is "route **any** `gh api` call with a write method against rulesets,
`branches/*/protection`, or `pulls/*/merge` to deny".

## Verification run by the reviewer

| Check | Command | Result |
|---|---|---|
| Full tests | `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` | exit 0, **824 pass / 0 fail** (≥ 816) |
| Guard tests | `node --test tests/guard.test.mjs` | exit 0, 46 pass (38 baseline + 8 new) |
| Customizations | `node --test tests/customizations.test.mjs` | exit 0, 56 pass |
| Replay Local | `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` | exit 0 |
| Replay Copilot | `REPLAY_FORMAT=copilot ./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` | exit 0 |
| Replay companion | `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` | exit 0 |
| Replay Copilot companion | `REPLAY_FORMAT=copilot REPLAY_COMPANION=1 … < tests/guard-fixtures-companion.txt` | exit 0 |
| Replay Copilot fixtures | `REPLAY_FORMAT=copilot … < tests/guard-fixtures-copilot.txt` | exit 0 |
| Lint (policy §5, green baseline) | `git ls-files '*.sh' \| xargs pnpm dlx shellcheck` | exit 0, **no findings — identical to the planning baseline** (`f6ec226`: exit 0, no findings) |
| Fixture count | `grep -c -E '^(allow\|ask\|deny) ' tests/guard-fixtures.txt` | 180 (> 128) |
| CI | `gh run view 40927431118` at `c3f04ab` | `success`; steps Unit tests, Shellcheck, and all four Guard fixture replay steps `success` |
| Independent probe | `/tmp/guard-probe.mjs`, `/tmp/guard-probe2.mjs` calling `decide()` directly on ~85 spellings (not committed) | Results cited per item below |

## Acceptance checklist results

1. **All six reported commands get their decided verdict in both replay formats — pass.**
   Verbatim fixture lines `tests/guard-fixtures.txt` 150 (`git push --mirror origin`),
   152 (`git -c core.hooksPath=/dev/null commit -m x`), 156 (`git config core.hooksPath
   /dev/null` → ask), 164 (`HUSKY=0 git commit -m x`), 171 (`gh api -X DELETE
   repos/o/r/rulesets/1`), 172 (`gh api -X PUT repos/o/r/pulls/1/merge`); Local and
   Copilot-format replays both exit 0 (`/tmp/replay1.log`, `/tmp/replay2.log`).
2. **`gh api` REST writes covered across spellings — pass as written, with a gap (F1).**
   Fixture lines 171–179 and 190–192 cover `-X`, `-XVAL`, `--method`, `--method=`,
   lower-case, leading `/`, `{owner}/{repo}`, full URL, implicit POST, `rulesets/<id>`,
   `branches/release/v1/protection/required_status_checks`, `pulls/<n>/merge`; all
   replay `deny`. Probe additionally confirmed `-X put`, `-Xput`, `--paginate -X
   DELETE`, `--input - -X PUT`, `?query`, quoted endpoint, trailing `--jq`/`--silent`
   → deny. **But** the listed spellings are not the ones GitHub's docs emit — see F1:
   any value-taking option other than the five field flags placed before the endpoint
   (`-H`, `--header`, `--hostname`, `-q`/`--jq`, `-t`, `-p`, `--cache`) makes the
   rule read the option's value as the endpoint and allow the write.
3. **Ruleset creation asks and reads stay allowed — pass.** Fixtures 180–181 (`ask`),
   184–186 and 195 (`allow`) replay green; probe: `gh api -X POST
   repos/david-perry-software/agento/rulesets --input ruleset.json` → ask with
   "approve this ruleset creation?", `gh api repos/o/r/rulesets --jq '.[] |
   select(.name=="x") | .id'` → allow, `gh api repos/o/r/pulls/1/merge --jq .merged`
   → allow, `gh api repos/o/r/rulesets/1` → allow. The agento-init flow
   (`.github/prompts/agento-init.prompt.md` lines 109/216 POST, 209–210 GETs) is
   intact.
4. **Unrelated `gh api` writes stay allowed — pass.** Fixtures 187–188 replay `allow`;
   probe also confirmed `pulls/70 -X PATCH -f body='see #136'` (the agento-init
   cross-link at prompt line 312), `pulls/1/reviews -X POST`, and
   `pulls/1/requested_reviewers -X POST` → allow.
5. **GraphQL mutations — pass as written, with gaps (F2, F3).** Fixtures 197–204
   replay green (six deny, `createRepositoryRuleset` ask, plain query allow); the
   multi-line `mergePullRequest` case in `tests/guard.test.mjs` ("denies a multi-line
   gh api graphql merge mutation") passes. **But** `gh api -X POST graphql …`, `gh api
   /graphql …`, `gh api https://api.github.com/graphql …`, and `gh api -H 'X: y'
   graphql …` carrying `mergePullRequest` all → allow (F3), and a harmless graphql
   segment chained before a REST write disables the REST rule (F2).
6. **Hook-path and hook-skip variants — pass.** Fixtures 150–170 replay green; probe
   additionally confirmed `git push origin --mirror`, `git -c core.hooksPath= commit`
   (empty value), `HUSKY=0 git merge feature/x`, `FOO=1 HUSKY=0 git commit`, `export
   FOO=1 HUSKY=0` → deny; `git config --worktree|--file … core.hooksPath x`, `git
   config --global --unset-all core.hooksPath` → ask; `git config get core.hooksPath`,
   `git config --list`, `HUSKY_SKIP_HOOKS= git commit`, `HUSKY=0 git status`, `git
   commit -m 'HUSKY=0 fix'` → allow.
7. **Every new deny/ask reason names the safe alternative — pass.** `tests/guard.test.mjs`
   asserts `/push the work branch by name/`, `/--no-verify/` (hooks-path and HUSKY),
   `/husky/` (config ask), `/GitHub UI/` (ruleset and protection), `/\/agento ship/`
   (REST merge and `mergePullRequest`), `/approve this ruleset creation/`; the probe
   output shows each reason text as asserted.
8. **No regression — pass.** 824/824, five replays exit 0 (table above).
9. **Lint gate — pass.** Fresh `shellcheck` run exit 0 with no findings, identical to
   the recorded baseline; CI `Shellcheck` step `success` on run 40927431118.
10. **Docs match behavior — pass.** `docs/hooks.md` diff adds six rule rows (`--mirror`,
    `-c core.hooksPath`/`--config-env`, `git config` writes, HUSKY, `gh api` REST, `gh
    api graphql`), drops `--mirror` from the conditional default-branch row, and adds
    the known-limits paragraph (`-F query=@file`, method after piped `--jq`,
    `GIT_CONFIG_*`, raw `curl`); README lines 505–514 list the new denies and asks;
    `CHANGELOG.md` `## 0.15.0` gains one **Fixed.** entry and `git diff origin/main --
    CHANGELOG.md` shows nothing else; `tests/customizations.test.mjs` 56/56. (Once F1–F3
    are fixed, the `docs/hooks.md` limits sentence still holds — nothing to retract.)
11. **Follow-ups kept — pass.** roadmap.md `## Follow-ups` holds the three planned
    lines plus one added 2026-10-29; the diff does not touch `SEGMENT_SPLIT` or the `gh
    pr merge` `--auto` handling (`git diff origin/main...HEAD --
    scripts/hooks/delivery-guard.mjs` read in full).

## Plan vs implementation

- Approach items 1–7 are all present in `scripts/hooks/delivery-guard.mjs`: exported
  `ghApiVerdict(segments, command)` called after the `gh pr merge` block and before
  the "no git word → allow" return (lines 476–479); the `export HUSKY` loop sits
  before that return (lines 483–487); `--mirror`, inline hooks-path, `git config`
  ask, and HUSKY-prefix checks sit in the per-segment git loop (lines 577–596).
- Deviation (undocumented, see F1): the plan's Approach item 1 says "the first
  positional argument after `api` (skipping option values)". The implementation
  skips only the values of `-X`/`--method` and the five field flags; every other
  value-taking `gh api` option is not skipped, so its value is taken as the endpoint.
- Deviation (undocumented, see F2/F3): the plan says GraphQL applies "when any
  segment's endpoint is `graphql`"; the implementation requires the literal token
  `graphql` immediately after `api` and, when found, returns the GraphQL verdict —
  including `null` — without scanning the remaining segments for REST writes.
- Ruleset/protection/merge reason texts, the `ask` on create, and the agento-init
  carve-out match Decisions 1, 2, 6 exactly. Decisions 3, 4, 5, 7 are honoured.
- No undocumented changes outside the six files in `git diff --stat`.

## Roadmap audit

- Steps 1.1–5.3 spot-checked against the code, fixtures, tests, docs, and CI; every
  tick is backed by the artifact it names (fixture lines, test names, doc rows,
  recorded counts match my reruns: 824/824, 180 fixture lines, replays 0, shellcheck
  0). **No falsely ticked boxes.** No `(manual)` steps exist.
- Repairs made (added 2026-10-29, unticked): **3.4** harden the `gh api`
  method/endpoint parser with a value-taking option table (F1); **3.5** detect
  `graphql` by normalised endpoint and stop the GraphQL branch from short-circuiting
  the REST scan (F2, F3); plus a Follow-ups line for the pre-existing
  backslash-newline continuation gap. `next-step` set to `3.4`; `status` left for the
  Builder's resume protocol.

## Findings

1. **Major — F1: value-taking options before the endpoint defeat the `gh api` REST
   rule** (`scripts/hooks/delivery-guard.mjs` `ghApiMethodAndEndpoint`, lines
   ~300–332). The endpoint is "the first token not starting with `-`", but only
   `-X`/`--method` and `-f`/`-F`/`--field`/`--raw-field`/`--input` have their values
   skipped. `-H`/`--header`, `--hostname`, `-q`/`--jq`, `-t`/`--template`,
   `-p`/`--preview`, and `--cache` are not, so their value becomes the "endpoint".
   Probe (all **allow**):
   - `gh api --method PUT -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" /repos/o/r/pulls/1/merge` — this is GitHub's REST docs' GitHub CLI sample shape for every write endpoint, i.e. the spelling an LLM is most likely to copy.
   - `gh api -H "Accept: application/vnd.github+json" -X DELETE repos/o/r/rulesets/1`
   - `gh api --hostname github.com -X DELETE repos/o/r/rulesets/1`
   - `gh api -X DELETE --jq .id repos/o/r/rulesets/1`, `-q .id`, `-t '{{.id}}'`, `-p corsair`, `--cache 1h` variants likewise.
   Fix: a `GH_API_VALUE_OPTIONS` set (`-H --header --hostname -q --jq -t --template -p --preview --cache -X --method -f -F --field --raw-field --input`) skipped as pairs, plus `--opt=value` forms; add deny fixtures for the docs-shape merge and ruleset-delete commands and an `allow` control such as `gh api -H "Accept: application/vnd.github+json" repos/o/r/rulesets`.
2. **Major — F2: a `gh api graphql` segment short-circuits the REST scan**
   (`ghApiVerdict`, line ~384: `if (segments.some(isGhApiGraphql)) return
   graphqlMutationVerdict(command);`). When the GraphQL verdict is `null` the function
   returns before the REST loop. Probe: `gh api graphql -f query='query { viewer {
   login } }' && gh api -X DELETE repos/o/r/rulesets/1` → **allow**. Fix: `const g =
   …; if (g) return g;` and fall through to the per-segment REST loop; add a fixture.
3. **Moderate — F3: GraphQL detection is positional** (`isGhApiGraphql`, lines
   ~340–356: `toks[i+2] === "graphql"`). Any option before the endpoint, a leading
   `/`, or the full URL hides the mutation scan, and the REST branch then sees a POST
   to `graphql` and ignores it. Probe (all **allow** with `mergePullRequest` in the
   query): `gh api -X POST graphql …`, `gh api /graphql …`, `gh api
   https://api.github.com/graphql …`, `gh api -H 'X: y' graphql …`. Fix: reuse the
   hardened parser from F1 and treat a normalised endpoint of `graphql` as GraphQL;
   add fixtures for `-X POST graphql` and `/graphql`.
4. **Minor — F4: `hookSkipExport` matches `export` anywhere in a segment**
   (`hookSkipExport`, `toks.indexOf("export")`). `echo export HUSKY=0` → deny. Harmless
   false positive; restricting to the segment's command word (after `commandWord()`
   prefixes) would fix it. Not blocking.
5. **Minor — F5: trailing slash escapes the merge pattern** (`/pulls\/[^/]+\/merge$/`).
   `gh api -X PUT repos/o/r/pulls/1/merge/` → allow. Strip a trailing `/` in
   `normalizeGhEndpoint`. Not blocking.

Positive notes: the git-side rules (2.1–2.4) held up against every variant probed,
including scope flags, empty values, `env`/multiple assignments, and the `HUSKY=1` /
empty `HUSKY_SKIP_HOOKS` controls; the `git config` write/read classification is
exactly per Approach item 4; reasons are specific and actionable; the fixtures and
unit tests are well organised and the docs rows are precise.

## Follow-ups

- Backslash-newline continuations split segments: `SEGMENT_SPLIT` includes `\n`, so
  `gh api \` + newline + `--method PUT \` + newline + `/repos/o/r/pulls/1/merge` is
  allowed — and so are `git push \`⏎`--force origin feature/x` and `gh pr merge 1
  \`⏎`--admin` (probe 2026-10-29). Pre-existing, affects every rule, out of this
  feature's scope; joining `\\\n` before segmenting would close it for the whole
  guard. Recorded in roadmap.md `## Follow-ups`.
- `hookSkipExport` command-word restriction (F4) and trailing-slash normalisation
  (F5) if the Builder does not fold them into 3.4.
