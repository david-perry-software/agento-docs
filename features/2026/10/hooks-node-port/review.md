# Review: hooks-node-port

Verdict: request-changes

Round 1 of 3, 2026-10-09. Reviewed product `feature/hooks-node-port` at `25f288e` (code
PR #104) and companion `feature/hooks-node-port` (PR #41). `origin/main` is an ancestor
of both halves; both halves were clean and level with their upstreams.

Skills consulted: none — no matching domain (no `.agents/skills/` directory and no
skills table in AGENTS.md, as recorded in plan.md).

One finding above minor severity blocks approval: the new refspec rule lets
`git push origin @` (and the common idiom `git push -u origin @`) through from the
default branch. `@` is git's shorthand for `HEAD`. It pushes the default branch, and
`origin/main`'s guard denied it. Everything else passes.

## Acceptance checklist results

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Wrappers contain no `python3`/heredoc, `exec node …/<name>.mjs`, and exit 0 silently without node | pass | `grep -c -e python3 -e '<<' scripts/hooks/delivery-guard.sh scripts/hooks/session-context.sh scripts/hooks/replay-guard.sh` → `0`/`0`/`0`. Both wrappers are `set -u` + `command -v node … \|\| exit 0` + `exec node "$(dirname "${BASH_SOURCE[0]}")/<name>.mjs"`. Each hook has a no-node test with a `bash git cat dirname`-only PATH: `tests/guard.test.mjs` "without node on PATH the hook exits 0 and prints nothing" and the test of the same name in `tests/session-context.test.mjs`. Both pass in the full run. |
| 2 | `hooks/hooks.json` and `.github/hooks/*.json` byte-identical; customizations test passes | pass | `git diff --stat origin/main -- hooks/ .github/hooks/` prints nothing. `tests/customizations.test.mjs` is in the full run (393/393). |
| 3 | Pre-existing fixtures keep their verdicts except line 116 | pass | `git diff origin/main...HEAD -- tests/guard-fixtures.txt tests/guard-fixtures-companion.txt`: the only removed line is `deny  git switch main && git push origin HEAD:feature/x`, re-added as `allow`. Every other change is an added line. Product replay: exit 0, `grep -c MISMATCH` 0. Companion replay: exit 0, 0 MISMATCH, 55 verdict lines. |
| 4 | Parity step executed and recorded | pass | `evidence/step-2-1-parity.md` exists and is linked from step 2.1. It lists 101 + 30 + 60 guard payloads and 15 SessionStart payloads, each with 0 differences. The parity test and the `AGENTO_HOOK_IMPL` switch were removed afterwards: a workspace search for `AGENTO_HOOK_IMPL\|hook-parity` finds nothing. |
| 5 | `doctor` has no `python3` check; `CAPABILITY_CHECKS` has no `python3` key; the `node` fallback names the hooks | pass | `node scripts/agento.mjs doctor \| grep -c python3` → `0`. The `scripts/agento.mjs` diff removes `DOCTOR_CHECKS.python3`, the probe, and both `CAPABILITY_CHECKS` entries. The `node` fallback now reads "…the Agento CLI, both hooks (delivery guard and SessionStart context), and the tests need it". `scripts/agento.test.mjs` passes in the full run. |
| 6 | `python3` grep reports hits only in `CHANGELOG.md` | pass, documented deviation | The grep reports `CHANGELOG.md` lines 11–13 (this entry) and 528 (the released `doctor` entry). It also reports `scripts/hooks/delivery-guard.mjs:35`: `"python3"` in `READ_ONLY`, the set of command words treated as only reading a hook file. That entry is a verdict input, not a runtime requirement. Removing it would turn `python3 <hook path>` from allow into deny, which item 3 forbids. Roadmap step 3.3 records the deviation and its reason. The item's intent, that nothing requires python3, is met. |
| 7 | `extension/cli/agento.mjs` equals `scripts/agento.mjs` | pass | `diff scripts/agento.mjs extension/cli/agento.mjs` is empty. `tests/extension-bundle.test.mjs` passes in the full run. Extension `npm run build` exits 0 and `npm run test:unit` reports 160/160. |
| 8 | `PROTECTED` gates `hooks/hooks.json` and `.claude-plugin/`, observed failing first | pass | Step 4.1 records the failing first run: 5 MISMATCH plus the failing edit-tool test. My own probe of `decide()` gives **ask** for edit-tool paths `hooks/hooks.json`, `./hooks/hooks.json`, the absolute path, the `file://` URI, `.claude-plugin/plugin.json` (relative and absolute), and `.claude-plugin/marketplace.json`. Shell `rm ./hooks/hooks.json`, `rm "<abs>/hooks/hooks.json"`, `echo {} >hooks/hooks.json`, `echo x >> <abs>/.claude-plugin/plugin.json`, `mv .claude-plugin /tmp/x`, `cp /tmp/x hooks/hooks.json`, `git checkout origin/main -- hooks/hooks.json`, `git restore hooks/hooks.json`, and `truncate -s0 .claude-plugin/plugin.json` are all **deny**, and `touch .claude-plugin/plugin.json` is **ask**. Reads (`cat`, `ls`, `cp hooks/hooks.json /tmp/x`, `git diff`, `cat … > /tmp/copy.json`) are **allow**. Look-alike paths (`myhooks/hooks.json`, `pre-hooks/hooks.json`, `.hooks/hooks.json`, `hooks/other.json`, `docs/hooks.md`, `.claude-plugins/…`, `claude-plugin/…`) are **allow**. The over-matches are minor and fail safe; see Findings m1. |
| 9 | Default-branch pushes judged per refspec destination; whole-token match including `refs/heads/` | **fail** | The fixtures pass and step 4.2 records the failing first run. The rule still has a hole: on the default branch, `git push origin @` and `git push -u origin @` are **allow** on this branch but **deny** on `origin/main` (Finding M1). The plan's Risks section promises that the new rule "still denies the bare `git push`, `HEAD`, `--all`, and `--mirror` cases from the default branch", and `@` is `HEAD`. |
| 10 | Companion-half nudge covered by a test seeding the half's and the clone's `HEAD` in opposite ways | pass | `tests/guard.test.mjs` "companion pair: the nudge reads the half's HEAD, not the clone's". In (a) the half's `HEAD` commits `roadmap.md`, the clone's `HEAD` is asserted empty, and the verdict is `allow`. In (b) the clone's `HEAD` commits `roadmap.md`, the half's `HEAD` commits `notes.md`, and the verdict is `ask` naming `project-docs-worktrees/plan-1 (branch feature/widget)`. Step 4.3 records "passed first run — no code change". Closing the follow-up on that evidence is sound: the re-target at `delivery-guard.mjs` (`paired = <companionWorktreesDir>/<basename>`) was ported unchanged and is exactly what this test exercises. |
| 11 | Docs, prompt + mirror, Mechanic agent, policy §10, and CHANGELOG describe the Node hooks without `python3` | pass | Read in the diff: `docs/hooks.md` (implementation paragraph, push rows, plugin-wiring row, Testing list), `docs/install.md`, `README.md`, `docs/commands.md` (3 sites), `docs/architecture.md`, `.github/agents/copilot-mechanic.agent.md`, policy §10 (token, soft list, and fallback removed, plus a Node paragraph), and `CHANGELOG.md` `## Unreleased`. `diff .github/prompts/doctor.prompt.md commands/doctor.md` is empty. |
| 12 | Full gate equals or beats the baseline | pass | `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`: exit 0, `# tests 393`, `# pass 393`, `# fail 0`, `# cancelled 0` (baseline 382). Both replays exit 0 with 0 MISMATCH. shellcheck 0.11.0 (the npx-cached binary, run by path) on the three wrappers and `wait-for-checks.sh`: exit 0, no output. `scripts/wait-for-checks.sh pr 104`: `RESULT: success`, exit 0, merge state CLEAN on `25f288e`. |

## Plan vs implementation

- **`PROTECTED` regex.** Implemented as `\.github/hooks/|scripts/hooks/|(?<![\w.-])hooks/hooks\.json|\.claude-plugin(?![\w.-])`, held once in `PROTECTED_PATHS` and reused by `PROTECTED` and `PROTECTED_REDIRECT`. The plan's literal pattern `(?:^|/)hooks/hooks\.json|\.claude-plugin/` is tested against whole shell segments, so it would miss `rm hooks/hooks.json`, where a space precedes the path, and `rm -rf .claude-plugin`, which has no trailing slash. The deviation is necessary, recorded on step 4.1, and verified above. Accepted.
- **`python3` in `READ_ONLY`.** This deviates from acceptance item 6 as written. It is recorded on step 3.3 and justified because it preserves verdicts (item 3). Accepted. plan.md was not amended, but the roadmap line is the durable record.
- **`tests/customizations.test.mjs` §10 vocabulary floor lowered from 7 to 6.** This follows directly from removing the `python3` token: the vocabulary is now exactly `terminal, ask-questions, browser, gh, code, network`. The floor only guards against a parse failure. Membership is still enforced per `Needs:` token (L349–L358), and the CLI-vs-`Needs:` agreement test (L471+) still runs. Accepted, and recorded on step 3.3.
- **`loadHookConfig` builds on `parseConfigText`/`defaultConfig` rather than `loadAgentoConfig`,** because the latter throws on invalid JSON instead of falling through to the next candidate. `hook-lib.mjs` also exports `realpath()` and `toJson()` for byte parity. All of this is recorded on step 1.1. Accepted.
- **`pushRefspecs()` expands whitespace-bearing tokens when no literal `push` token exists,** for `bash -c 'git push …'`. This keeps the existing `deny bash -c 'git push origin main'` fixture verdict. Recorded on step 4.2. Accepted.
- **Behaviour change without node.** The SessionStart hook now prints nothing, where it used to print the full output minus `Session:`. This is planned (step 3.1) and is called out in CHANGELOG and `docs/hooks.md`.

## Roadmap audit

I spot-checked every ticked step against the code:

- 1.1–1.3: the modules and tests exist.
- 2.1: the evidence file is linked, and the switch and parity test are gone.
- 3.1: wrapper grep 0/0/0, no-node tests present.
- 3.2: doctor grep 0, CLI copy identical.
- 3.3: docs as described.
- 4.1–4.3: the fixtures, tests, and first-failure records are present.
- 5.1/5.2: gate counts and CI reproduced above.

No ticked box is false.

Repair: added **4.4 (added 2026-10-09)** for Finding M1. `status` is set back to `in-progress` and `next-step` to `"4.4"`.

## Findings

### Major

- **M1 — `@` (git's shorthand for `HEAD`) bypasses the default-branch push rule.** A regression against `origin/main`.
  - **Code:** `scripts/hooks/delivery-guard.mjs`. `pushFromDefault` denies a `HEAD` destination via `push.refspecs.some((r) => r.dst === "HEAD")`, and `pushRefspecs()` passes `@` through literally.
  - **Reproduction:** a throwaway repo on `main`, with the same payload fed to the `origin/main` wrapper and this branch's wrapper:

    ```
    on main: git push origin @                    origin/main=deny  branch=allow
    on main: git push -u origin @                 origin/main=deny  branch=allow
    on main: git push origin HEAD                 origin/main=deny  branch=deny
    on main: git push origin HEAD:feature/x       origin/main=deny  branch=allow
    ```

  - **Git's behaviour:** checked against a local bare remote. `git push origin @` from `main` exits 0 and creates `refs/heads/main` on the remote, so the guard now allows a direct push of the default branch from the default branch.
  - **Why this blocks:** `git push -u origin @` is a common idiom. The plan's Risks section explicitly promises to keep denying `HEAD` from the default branch.
  - **Fix:** treat `@` as `HEAD` for both `src` and `dst`. For example, normalise `@` to `HEAD` in `pushRefspecs()`'s `branchOf`, then add fixtures:
    - `deny git switch main && git push origin @`
    - `deny git switch main && git push -u origin @`
    - `allow git switch main && git push origin @:feature/x`
    - the `trunk` equivalents in `tests/guard-fixtures-companion.txt`
    - a matching assertion in the "pushes are judged by refspec destination…" test

    Update the `docs/hooks.md` push row and the CHANGELOG entry ("`HEAD`/`@`").
  - **Not a problem:** `@:main` from a work branch is already denied (destination `main`).

### Minor

- **m1 — `PROTECTED` over-matches a few look-alike paths, failing safe.** `hooks/hooks.json` has no trailing boundary, so `hooks/hooks.json5`, `hooks/hooks.json.bak`, and any nested `…/hooks/hooks.json` (for example `templates/hooks/hooks.json`, which does not exist today) are gated. `.claude-plugin` has no leading boundary, so `x.claude-plugin/y` is gated. In each case the verdict is ask/deny, never a missed write, and `.github/hooks/` already gates its whole subtree. Not blocking.
- **m2 — Mentioning a protected path anywhere in a non-read-only command is denied.** For example, `gh pr comment 1 --body 'protects hooks/hooks.json'` is denied. This is the existing `scripts/hooks/` behaviour, now extended to two more paths. Workaround: `--body-file`. Not blocking; already inherent to the command-word design.

### Probed and correct

All probes ran on `main` unless a work branch is named.

**Denied, as intended:**

- bare `git push`, `git push origin`, `git push origin HEAD`, `git push -u origin HEAD`
- `--all`, `--branches`, and `--mirror` pushes
- `--follow-tags` with no refspec
- `git push --repo=origin`
- `git push -o ci.skip origin main` and `git push --push-option=ci.skip origin main`
- `git push --push-option ci.skip origin` (no refspec)
- `refs/heads/main`, `'refs/heads/main'`, `"HEAD:main"`
- `git push origin HEAD:refs/heads/main`, `:refs/heads/main`, `--delete refs/heads/main`
- mixed lists `feature/x :main`, `--delete feature/y main`, and `feature/x HEAD`
- `-n` (dry-run) to main, `+HEAD:feature/x` (force)
- from a work branch: `git push origin main`, `refs/heads/main`, `feature/w:main`, `@:main`, `:main`, `-d origin main`, `git switch main && git push`

**Allowed, as intended:**

- `main-thing`, `HEAD:main-thing`, `--delete main-thing`
- `feature/x :feature/y`, `--delete feature/y`, `feature/x -d`
- `-o ci.skip origin feature/x`, `--push-option ci.skip origin feature/x`
- `--tags` alone
- `main:feature/x`
- tags `v1.0` and `refs/tags/v1.0`
- redirections and pipes after the refspec (`2>&1 | tail -n 1`, `> /tmp/log`)

**Allowed on both branches, and correct:** `HEAD:heads/main`. git creates `refs/heads/heads/main` for it, not `main`, as verified against a bare remote. Companion `trunk` forms are covered by the 25 new companion fixtures, which pass.

## Follow-ups

- Tighten `PROTECTED_PATHS` boundaries: add `(?![\w.-])` after `hooks\.json` and a `(?<![\w-])` lookbehind before `\.claude-plugin`, so look-alike names are no longer gated (m1). Low priority, fail-safe today.
- Consider pinning the §10 vocabulary in `tests/customizations.test.mjs` to the CLI's `CAPABILITY_CHECKS` keys, not a numeric floor, so a future token change is caught on both sides at once.
