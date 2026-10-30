# Review: guard-bypass-gaps

Verdict: approve

Reviewed 2026-10-29 at product `7556501` (PR david-perry-software/agento#136, branch
`feature/guard-bypass-gaps`, `origin/main` is an ancestor, CI run 40956358614 green)
against plan.md and roadmap.md on the companion branch (PR agento-docs#70, clean,
`ahead: 0`). Review round 2 — re-review after the round-1 `request-changes`
(findings F1–F5), which the Builder closed in roadmap steps 3.4 (`e44933c`) and 3.5
(`7556501`).

Every round-1 finding is fixed and locked in by fixtures and unit tests; the fix is
confined to `ghApiMethodAndEndpoint` / `normalizeGhEndpoint` / `isGhApiGraphql` /
`ghApiVerdict` / `hookSkipExport` in `scripts/hooks/delivery-guard.mjs` (+34/−6
against `c3f04ab`), introduces no new false positive on any legitimate Agento flow
probed, and the full gate is green: 827/827 tests, all five replays exit 0, shellcheck
identical to the baseline, 192 fixture verdict lines. All eleven acceptance items pass.

## Verification run by the reviewer

| Check | Command | Result |
|---|---|---|
| Full tests | `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` | exit 0, **827 pass / 0 fail** (≥ 816; +3 over round 1) |
| Guard tests | `node --test tests/guard.test.mjs` | exit 0, 49 pass (38 baseline + 8 round 1 + 3 round 2) |
| Customizations | `node --test tests/customizations.test.mjs` | exit 0, 56 pass |
| Replay Local | `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` | exit 0 |
| Replay Copilot | `REPLAY_FORMAT=copilot ./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` | exit 0 |
| Replay companion | `REPLAY_COMPANION=1 … < tests/guard-fixtures-companion.txt` | exit 0 |
| Replay Copilot companion | `REPLAY_FORMAT=copilot REPLAY_COMPANION=1 … < tests/guard-fixtures-companion.txt` | exit 0 |
| Replay Copilot fixtures | `REPLAY_FORMAT=copilot … < tests/guard-fixtures-copilot.txt` | exit 0 |
| Lint (policy §5, green baseline) | `git ls-files '*.sh' \| xargs pnpm dlx shellcheck` | exit 0, **no findings — identical to the planning baseline** (`f6ec226`) |
| Fixture count | `grep -c -E '^(allow\|ask\|deny) ' tests/guard-fixtures.txt` | 192 (> 128; matches the step 5.1 record) |
| CI at HEAD | `gh run view 40956358614` (`7556501`) | `success`: Unit tests, Shellcheck, and all four Guard fixture replay steps `success`; PR `mergeStateStatus: CLEAN`, still draft |
| Independent probe | `/tmp/guard-probe-r2.mjs` calling `decide()` directly on **100 spellings** (not committed) | **100/100 as expected**, cited per item and per finding below |

## Round-1 findings re-checked

| # | Round-1 gap | Fix in diff | Reviewer re-probe (all as expected) |
|---|---|---|---|
| F1 (major) | value-taking options before the endpoint were read as the endpoint | `GH_API_VALUE_OPTIONS` set (`-X -x --method -f -F --field --raw-field --input -H --header --hostname -q --jq -t --template -p --preview --cache`) consumed as pairs, plus `--opt=value` forms via `/^--[^=\s]+=/`; `GH_API_FIELD_FLAGS` still sets the implicit-POST flag | deny: the GitHub-docs shape `gh api --method PUT -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" /repos/o/r/pulls/1/merge`; `-H … -X DELETE repos/o/r/rulesets/1`; `--hostname github.com -X DELETE …`; `-X DELETE` followed by `--jq .id` / `-q .id` / `-t '{{.id}}'` / `-p corsair` / `--cache 1h`; `--header=… --method=PUT …/merge`; `--jq=.id -X DELETE …`; `--template='{{.id}}' -X DELETE …`; `--input=p.json …/protection`; `--field=… rulesets/1`; `--raw-field=… /merge`; `--silent`, `--verbose --include`, `-i`, `--paginate` placements; `-X put`, `-Xput`, `--METHOD=PUT`; `env`/`GH_TOKEN=x`/`cd … &&` prefixes; quoted endpoint and full URL with `?query`. allow: `-H "Accept: …" repos/o/r/rulesets`; `--jq .name repos/o/r/rulesets/1`; the docs-shape headers **without** a method on `/pulls/1/merge` (GET). |
| F2 (major) | a harmless `gh api graphql` segment short-circuited the REST scan | `ghApiVerdict` keeps the GraphQL verdict only when non-null and falls through to the REST loop | deny: `gh api graphql -f query='query { viewer { login } }' && gh api -X DELETE repos/o/r/rulesets/1`, the `;`-chained merge variant, and the reverse order; ask: the same chain ending in `-X POST repos/o/r/rulesets --input r.json`. |
| F3 (moderate) | GraphQL detection was positional (`toks[i+2] === "graphql"`) | `isGhApiGraphql` reuses `ghApiMethodAndEndpoint` and compares the normalised endpoint to `graphql` | deny with `mergePullRequest`: `-X POST graphql`, `/graphql`, `https://api.github.com/graphql`, `--method POST /graphql` (`updateBranchProtectionRule`), `-H 'X: y' graphql` (`deleteRepositoryRuleset`), `graphql/`, `graphql -F pr=x -f query='mutation($pr: ID!) …'`, `graphql --jq .data -f query=…`, and the multi-line query; ask: `-X POST /graphql … createRepositoryRuleset`; allow: `-X POST graphql` with a plain query, a `repository { pullRequest { mergeable } }` query, and a query followed by `--jq '.data.viewer.login'`. |
| F4 (minor) | `hookSkipExport` matched `export` anywhere | restricted to the segment's `commandWord()` | allow: `echo export HUSKY=0`, `printf '%s\n' 'export HUSKY=0'`, `grep -n 'export HUSKY=0' README.md`, `export HUSKY=1`, `export FOO=0`, `export HUSKY_SKIP_HOOKS=`; deny: `export HUSKY=0`, `export HUSKY_SKIP_HOOKS=1`, `env export HUSKY=0`, `FOO=1 export HUSKY=0`, `export FOO=1 HUSKY=0`, `cd /tmp && export HUSKY=0 && git commit -m x`. |
| F5 (minor) | trailing `/` escaped the `merge$` pattern | `normalizeGhEndpoint` strips `/+$` | deny: `…/pulls/1/merge/`, `…/pulls/1/merge//`, `…/rulesets/1/`, `…/branches/main/protection/`; ask: `-X POST repos/o/r/rulesets/ --input r.json`. |

Fixtures `tests/guard-fixtures.txt` lines 202–213 and the three new `tests/guard.test.mjs`
cases ("harden gh api endpoint parsing: value options before the endpoint", "detects
graphql by normalised endpoint and falls through to the REST scan", "only an export
command word triggers the hook-skip export deny") pin each of these.

## Acceptance checklist results

1. **All six reported commands get their decided verdict in both replay formats — pass.**
   Verbatim fixture lines `tests/guard-fixtures.txt` 150 (`git push --mirror origin`),
   152 (`git -c core.hooksPath=/dev/null commit -m x`), 156 (`git config core.hooksPath
   /dev/null` → ask), 164 (`HUSKY=0 git commit -m x`), 171 (`gh api -X DELETE
   repos/o/r/rulesets/1`), 172 (`gh api -X PUT repos/o/r/pulls/1/merge`); Local and
   Copilot-format replays both exit 0 (`/tmp/r2-replay1.log`, `/tmp/r2-replay2.log`);
   probe confirms all six directly.
2. **`gh api` REST writes covered across spellings — pass.** Fixture lines 171–179,
   190–192 and the new 202–205 replay `deny` across `-X`, `-XVAL`, `--method`,
   `--method=`, lower-case, leading `/`, `{owner}/{repo}`, full URL, implicit POST,
   headers before the endpoint, `--jq` before the endpoint, trailing slash;
   `rulesets/<id>`, `branches/release/v1/protection/required_status_checks`,
   `pulls/<n>/merge` all deny. Round-1 gap F1 closed (table above).
3. **Ruleset creation asks and reads stay allowed — pass.** Fixtures 180–181 (`ask`),
   184–186, 195, 206–207 (`allow`) replay green; probe: `gh api -X POST
   repos/david-perry-software/agento/rulesets --input ruleset.json` → ask, `gh api
   --method POST -H "Accept: …" repos/o/r/rulesets --input r.json` → ask, `gh api
   repos/o/r/rulesets --jq '.[] | select(.name=="x") | .id'`, `gh api
   repos/o/r/branches/main/protection`, `gh api repos/o/r/pulls/1/merge --jq .merged`,
   `gh api -X GET repos/o/r/rulesets -f includes_parents=true` → allow. The
   agento-init flow (`.github/prompts/agento-init.prompt.md` lines 109/216 POST,
   209–210 GETs) is intact.
4. **Unrelated `gh api` writes stay allowed — pass.** Fixtures 187–188 replay `allow`;
   probe also confirmed `pulls/70 -X PATCH -f body='see #136'` (agento-init cross-link),
   `pulls/1 --method PATCH -H … -f body=x`, `issues/1/comments -X POST -F
   body=@/tmp/body.md`, `issues/comments/5 -X PATCH -F body=@…` (the review-publish
   comment edit path), `pulls/1/reviews -X POST`, `-X DELETE issues/comments/5`, `-X
   PUT pulls/1/update-branch`, `-X POST repos/o/r/merges`, and the near-miss endpoints
   `rulesets-archive/1`, `branches/main/protection-notes`, `pulls/1/merge-queue` →
   allow.
5. **GraphQL — pass.** Fixtures 197–204 and the new 209–213 replay green (six deny,
   `createRepositoryRuleset` ask, plain query allow, option/slash/full-URL endpoint
   spellings deny, graphql-then-REST chain deny, `-X POST graphql` plain query allow);
   the multi-line `mergePullRequest` case in `tests/guard.test.mjs` passes. Round-1
   gaps F2 and F3 closed (table above).
6. **Hook-path and hook-skip variants — pass.** Fixtures 150–170 and 208 replay
   green; probe re-confirmed `git -c user.name=x commit -m x`, `git config
   core.hooksPath`, `git config --get core.hooksPath`, `HUSKY=1 git commit -m x`, `git
   push origin feature/guard-bypass-gaps` → allow and the F4 cases above.
7. **Every new deny/ask reason names the safe alternative — pass.** `tests/guard.test.mjs`
   asserts `/push the work branch by name/`, `/--no-verify/`, `/husky/`, `/GitHub UI/`,
   `/\/agento ship/`, `/approve this ruleset creation/`; 49/49 pass; the probe output
   shows the same reason texts for every F1–F5 spelling.
8. **No regression — pass.** 827/827 (≥ 816), five replays exit 0 (table above).
9. **Lint gate — pass.** Fresh `shellcheck` run exit 0 with no findings, identical to
   the recorded baseline; CI `Shellcheck` step `success` on run 40956358614 at HEAD.
10. **Docs match behavior — pass.** Unchanged since round 1 and still accurate:
    `docs/hooks.md` rule rows for all six rule groups plus the known-limits sentence
    (lines 136–139: `-F query=@file`, a method after a piped `--jq`, `GIT_CONFIG_*`,
    raw `curl`) — each limit re-probed and still a genuine limit (`gh api
    repos/o/r/rulesets/1 --jq '.a | .b' -X DELETE` is split at the quoted `|`, the
    quote-aware-splitting Follow-up); README PreToolUse summary lists the new
    denies/asks; `CHANGELOG.md` `## 0.15.0` has the one **Fixed.** entry;
    `tests/customizations.test.mjs` 56/56.
11. **Follow-ups kept — pass.** roadmap.md `## Follow-ups` holds the three planned
    lines plus the two added 2026-10-29 (quoted-command-text, backslash-newline);
    `git diff origin/main...HEAD -- scripts/hooks/delivery-guard.mjs` does not touch
    `SEGMENT_SPLIT` (line 84 unchanged) or the `gh pr merge` `--auto` handling.

## Plan vs implementation

- Approach items 1–7 are all present. The round-2 changes bring the implementation in
  line with the plan's own wording that round 1 flagged as deviations: "the first
  positional argument after `api` (skipping option values)" is now literally what
  `ghApiMethodAndEndpoint` does (every value-taking `gh api` option skipped as a pair
  or `--opt=value`), and "when any segment's **endpoint** is `graphql`" is now the
  normalised-endpoint check rather than a positional token.
- `GH_API_VALUE_OPTIONS` matches gh's `api` flag set for value-taking options (`-H`,
  `--hostname`, `-q`/`--jq`, `-t`/`--template`, `-p`/`--preview`, `--cache`, `-X`,
  the five field flags); the valueless flags (`-i`, `--include`, `--silent`,
  `--verbose`, `--paginate`, `--slurp`) are skipped by the generic `-` test. No
  option is wrongly consumed as a pair in the probe.
- No undocumented changes: the round-2 diff touches only `delivery-guard.mjs`,
  `tests/guard-fixtures.txt`, and `tests/guard.test.mjs`; docs needed no change
  because the round-1 docs already described the intended (now actual) behavior.
- Decisions 1–7 are honoured unchanged.

## Roadmap audit

- Steps 1.1–5.3 (15/15 ticked) spot-checked against the code, fixtures, tests, docs,
  CI, and my reruns. Steps 3.4 and 3.5 (added 2026-10-29): every fixture named on the
  step line exists verbatim (lines 202–213), the named `tests/guard.test.mjs` cases
  exist and pass, and the step 5.1 line was updated as 3.5 required (827/827, 192
  fixture lines — both match my counts). **No falsely ticked boxes.** No `(manual)` or
  `(manual, post-ship)` steps exist.
- Repair made: step 5.3's recorded CI evidence cited only run 40927431118 at `c3f04ab`
  (pre-3.4/3.5); appended the HEAD run 40956358614 at `7556501` so the tick's evidence
  matches the reviewed code. No steps added, none unticked.

## Findings

No finding above minor severity.

1. **Minor (informational) — `-x` in `GH_API_VALUE_OPTIONS` is unreachable**
   (`scripts/hooks/delivery-guard.mjs` line ~123): `-X`/`-x`/`--method` are already
   handled by the explicit branch at the top of the loop, so the set entries for them
   never fire. Harmless; keeping them makes the table self-describing. No action
   required.
2. **Minor (informational) — mutation-name scan is command-wide by design**: a
   listed mutation name anywhere in the command text (e.g. a trailing `# mergePullRequest`
   comment) denies when a graphql endpoint is present. This is the documented
   whole-command matching from Approach item 1 and errs on the deny side; `\b`
   boundaries keep `mergePullRequestAllowed`-style field names from matching. No
   action required.

Positive notes: the fix is minimal and local; the option table is a single source of
truth shared by the REST and GraphQL paths; fixtures mirror the exact round-1 probe
spellings including the GitHub-docs sample shape; the fall-through in `ghApiVerdict`
is commented with the reason.

## Follow-ups

- (carried, already in roadmap.md `## Follow-ups`) Quote-aware segment splitting —
  also what still lets a write method placed after a piped `--jq` filter escape the
  `gh api` rule, as docs/hooks.md states.
- (carried, already in roadmap.md) Backslash-newline continuations split segments
  guard-wide (`gh api \`⏎`--method PUT \`⏎`/repos/o/r/pulls/1/merge` allows).
- (carried, already in roadmap.md) `gh pr merge --auto` / `enablePullRequestAutoMerge`
  (Decision 7).
- (carried, already in roadmap.md) Brace-group `{ … }` command word and
  quoted-command-text (`printf '%s\n' "git push --mirror"`) false positives.
