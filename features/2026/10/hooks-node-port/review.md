# Review: hooks-node-port

Verdict: approve

Round 2 of 3, 2026-10-09. Reviewed product `feature/hooks-node-port` at `cc8b246` (code
PR #104) and companion `feature/hooks-node-port` at `99016f0` (PR #41). `origin/main`
(`1d27a66`) is an ancestor of both halves; both halves were clean and level with their
upstreams.

Skills consulted: none — no matching domain (no `.agents/skills/` directory and no
skills table in AGENTS.md, as recorded in plan.md).

Round 1 requested changes for one major finding, M1: `git push origin @` and
`git push -u origin @` were allowed from the default branch. Step 4.4 fixes it.
`pushRefspecs()`'s `branchOf` now maps `@` to `HEAD` on both sides of the colon. I
verified the fix independently against `origin/main`'s guard and against git itself.
The round-2 delta (`25f288e..cc8b246`) touches only `scripts/hooks/delivery-guard.mjs`
(one line), the two fixture files, `tests/guard.test.mjs`, `docs/hooks.md`, and
`CHANGELOG.md`. The full gate is green. The minor findings m1 and m2 are unchanged
and remain non-blocking follow-ups.

## Acceptance checklist results

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Wrappers contain no `python3`/heredoc, `exec node …/<name>.mjs`, and exit 0 silently without node | pass | `grep -c -e python3 -e '<<' scripts/hooks/delivery-guard.sh scripts/hooks/session-context.sh scripts/hooks/replay-guard.sh` → `0`/`0`/`0`. The no-node tests in `tests/guard.test.mjs` and `tests/session-context.test.mjs` pass in the full run. The wrappers are unchanged since round 1. |
| 2 | `hooks/hooks.json` and `.github/hooks/*.json` byte-identical; customizations test passes | pass | `git diff --stat origin/main -- hooks/ .github/hooks/` prints nothing. `tests/customizations.test.mjs` is in the full run (393/393). |
| 3 | Pre-existing fixtures keep their verdicts except line 116 | pass | `git diff origin/main...HEAD -- tests/guard-fixtures.txt tests/guard-fixtures-companion.txt`: the only removed line is `deny  git switch main && git push origin HEAD:feature/x`, re-added as `allow`. All 62 other changes are added lines, including 9 new for 4.4. Product replay: exit 0, 147 lines, 0 MISMATCH. Companion replay: exit 0, 83 lines, 0 MISMATCH. |
| 4 | Parity step executed and recorded | pass | `evidence/step-2-1-parity.md` is unchanged and linked from step 2.1. `git grep -e AGENTO_HOOK_IMPL -e hook-parity` finds nothing. |
| 5 | `doctor` has no `python3` check; `CAPABILITY_CHECKS` has no `python3` key; the `node` fallback names the hooks | pass | `node scripts/agento.mjs doctor \| grep -c python3` → `0`. `scripts/agento.test.mjs` passes in the full run. `scripts/agento.mjs` is unchanged since round 1. |
| 6 | `python3` grep reports hits only in `CHANGELOG.md` | pass, documented deviation | The grep reports `CHANGELOG.md` lines 11–13 and 528, plus `scripts/hooks/delivery-guard.mjs:35`, the `READ_ONLY` command-word entry. That entry is a verdict input, not a requirement. It is recorded on step 3.3 and was accepted in round 1. |
| 7 | `extension/cli/agento.mjs` equals `scripts/agento.mjs` | pass | `diff scripts/agento.mjs extension/cli/agento.mjs` is empty. `tests/extension-bundle.test.mjs` passes in the full run. The round-2 delta touches neither `extension/` nor `scripts/agento.mjs`, so round 1's extension build and 160/160 unit result still stand. |
| 8 | `PROTECTED` gates `hooks/hooks.json` and `.claude-plugin/`, observed failing first | pass | Unchanged since round 1 (step 4.1 records the failing first run, and round 1 probed it). The 4.1 fixtures pass in this round's product replay. |
| 9 | Default-branch pushes judged per refspec destination; whole-token match including `refs/heads/` | pass | M1 is fixed (see "M1 re-verification" below). Step 4.4 records the failing first run: product replay 2 MISMATCH, companion replay 4 MISMATCH, and the guard test failing at `git push origin @`. Both replays now exit 0 with 0 MISMATCH. The test "pushes are judged by refspec destination, the default branch as a whole token" asserts `@` deny, `-u @` deny, and `@:feature/x` allow. |
| 10 | Companion-half nudge covered by a test seeding the half's and the clone's `HEAD` in opposite ways | pass | "companion pair: the nudge reads the half's HEAD, not the clone's" passes in the full run. Unchanged since round 1. |
| 11 | Docs, prompt + mirror, Mechanic agent, policy §10, and CHANGELOG describe the Node hooks without `python3` | pass | `diff .github/prompts/doctor.prompt.md commands/doctor.md` is empty. 4.4 adds "pushes `HEAD` (or its shorthand `@`)" to the `docs/hooks.md` push row and "`HEAD`/`@`" to the CHANGELOG entry. Both match the implemented behaviour. |
| 12 | Full gate equals or beats the baseline | pass | `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`: exit 0, `# tests 393`, `# pass 393`, `# fail 0`, `# cancelled 0` (baseline 382). Both replays exit 0 with 0 MISMATCH. shellcheck 0.11.0 (the npx-cached binary, run by path) on the three wrappers and `wait-for-checks.sh`: exit 0, no output. `scripts/wait-for-checks.sh pr 104`: exit 0, `RESULT: success`, merge state CLEAN on head `cc8b246`. |

### M1 re-verification

I fed the same payload to `origin/main`'s guard (the primary checkout at `1d27a66`,
clean) and to this branch's guard, in a throwaway repo. I ran the same probe twice:
once with the default branch `main`, and once with a `.github/agento.json` that sets
`branches.default: trunk`.

```
on main:   git push origin @                     origin/main=deny  branch=deny
on main:   git push -u origin @                  origin/main=deny  branch=deny
on main:   git push --set-upstream origin @      origin/main=deny  branch=deny
on main:   git push origin '@'  /  "@"           origin/main=deny  branch=deny
on main:   git push origin +@                    origin/main=deny  branch=deny   (force rule)
on main:   git push origin @ feature/x           origin/main=deny  branch=deny
on main:   git push origin feature/x @           origin/main=deny  branch=deny
on main:   git push origin @:HEAD                origin/main=deny  branch=deny
on main:   git push origin @:main                origin/main=deny  branch=deny
on main:   git push origin @:refs/heads/main     origin/main=deny  branch=deny
on main:   git push origin @:feature/x           origin/main=deny  branch=allow  (intended, like HEAD:feature/x)
on main:   git push origin @:refs/heads/feature/x origin/main=deny branch=allow  (intended)
on feature/w: git push origin @:main             origin/main=deny  branch=deny
on feature/w: git push -u origin @:main          origin/main=deny  branch=deny
on feature/w: git push origin @:refs/heads/main  origin/main=allow branch=deny   (gap closed)
on feature/w: git push origin @ / -u origin @    origin/main=allow branch=allow
on trunk:  @, -u @, @:trunk, @:refs/heads/trunk  deny; @:feature/x allow; from feature/w @:trunk deny
```

The companion fixture replay also passes the six new `trunk` lines, in both the
`git -C {companion}` form and the plain product form.

**Residual allows, all rejected by git.** The probe found four inputs that this
branch allows from `main` and `origin/main` denied: `git push origin HEAD:`,
`git push origin @:`, `git push origin @{0}`, and `git push origin HEAD@{0}`. Against a
local bare remote, git rejects all four with `fatal: invalid refspec '<spec>'` (exit
128) and creates no remote ref. The same check confirmed that `git push origin @`
from `main` creates `refs/heads/main` (the M1 hole) and that `@:feature/x` creates
only `refs/heads/feature/x`. Likewise, `git push --repo=origin main` from a work branch
is now allowed, but git reads the positional `main` as the repository and fails with
`'main' does not appear to be a git repository`. None of these can move a ref, so none
is a finding.

## Plan vs implementation

- **4.4 matches the round-1 fix exactly.** `@` is normalised to `HEAD` in `branchOf`
  for both `src` and `dst`, with one short comment. Fixtures and the guard-test
  assertions were added first, and the failing first run is recorded on the step. The
  docs and CHANGELOG mention `@`.
- **Round-1 deviations stand as accepted and are unchanged:**
  - the `PROTECTED_PATHS` regex differs from the plan literal;
  - `python3` remains in `READ_ONLY`;
  - the §10 vocabulary floor in the customizations test drops from 7 to 6;
  - `loadHookConfig` builds on `parseConfigText`;
  - `pushRefspecs()` expands quoted `bash -c` tokens;
  - without node, the SessionStart hook is silent.
- **Companion commit type.** The companion commit `99016f0` is spelled
  `fix(guard): …` although it only ticks the roadmap. It is a valid Conventional
  Commit that names the step, so this is cosmetic and not a finding.

## Roadmap audit

- 4.4 (added in round 1): ticked. Verified above: the code change, the 9 product and
  companion fixtures, the 3 guard-test assertions, the docs and CHANGELOG wording, the
  recorded first failure, the gate counts, and CI on `cc8b246`.
- 1.1–4.3 and 5.1/5.2: the code they describe is unchanged by the round-2 delta.
  Round 1's spot checks hold, and this round's full gate reconfirms them.
- The header reads `status: in-review` and `next-step: ""`, consistent with every
  step ticked (13/13).

No falsely ticked boxes. No repairs needed.

## Findings

### Major

None. M1 from round 1 is resolved (see "M1 re-verification").

### Minor

- **m1 — `PROTECTED` over-matches a few look-alike paths, failing safe.** This is
  unchanged since round 1. `hooks/hooks.json5`, `hooks/hooks.json.bak`, nested
  `…/hooks/hooks.json`, and `x.claude-plugin/y` are gated. The verdict is always ask or
  deny, never a missed write. Not blocking.
- **m2 — Mentioning a protected path anywhere in a non-read-only command is denied.**
  This is unchanged since round 1. For example,
  `gh pr comment 1 --body 'protects hooks/hooks.json'` is denied. This is inherent to
  the command-word design and already true of `scripts/hooks/`. The workaround is
  `--body-file`. Not blocking.

## Follow-ups

- Tighten `PROTECTED_PATHS` boundaries: add `(?![\w.-])` after `hooks\.json` and a
  `(?<![\w-])` lookbehind before `\.claude-plugin`, so look-alike names are no longer
  gated (m1). Low priority, fail-safe today.
- Let protected-path mentions inside quoted message arguments (`--body`, `-m`,
  `--title`) pass the hook-file segment rule, or document the `--body-file` workaround
  in `docs/hooks.md` (m2).
- Consider pinning the §10 vocabulary in `tests/customizations.test.mjs` to the CLI's
  `CAPABILITY_CHECKS` keys, not a numeric floor, so a future token change is caught on
  both sides at once.
