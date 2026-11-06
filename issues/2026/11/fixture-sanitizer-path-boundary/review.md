# Review: fixture-sanitizer-path-boundary

Verdict: approve

Reviewed 2026-11-06 (round 1) on product `issue/fixture-sanitizer-path-boundary` at
`1154942` (4 commits over `origin/main` `ba7e323`, which is an ancestor of HEAD) and
companion `e747112`. Both halves were `dirty: false`, `ahead: 0`, `behind: 0` at the
start and end of the review. Every command below was run by the Reviewer in the product
worktree unless stated otherwise.

Skills: none loaded — the repository has no `.agents/skills/` and no AGENTS.md skills
table, and the installed user-level skills (`agento`, `use-railway`) do not match a
plain Node.js test-harness change. Consistent with plan.md `## Research`.

## Acceptance checklist results

1. **Exposing regression test fails before / passes after** — **pass.**
   `tests/harness-probe/probe.test.mjs:376` holds
   `test("makeSanitizeCtx replaces repo and HOME paths only at a path boundary (#145 fixture-sanitizer-path-boundary)")`
   (issue number and slug in the name). Independently re-derived the "before"
   state: a `git archive 534274e` copy (seam only, no fix) run with
   `node --test --test-name-pattern='#145' tests/harness-probe/probe.test.mjs`
   → `not ok`, exit 1, actuals `sibling: '<REPO>-worktrees/plan-x'`,
   `bak: '<REPO>.bak/x'`, `other: '<HOME>2/project'`, `home: '<HOME>x'`,
   `ws: '<REPO>/workspace/a'` — exactly the defect in plan.md `## Evidence` and the
   roadmap 1.1 record. On HEAD the same command → `ok 1`, `# pass 1 / fail 0`,
   exit 0.
2. **Reproduction 1 passes on the branch** — **pass.** Fresh `git archive HEAD` copy
   at `<dir>/agento`, `TMPDIR=<dir> node --test --test-name-pattern="collect sanitizes"
   tests/harness-probe/probe.test.mjs` → `ok 1 - collect sanitizes logs into fixtures
   and empties the log dir`, `# pass 1 / fail 0`, exit 0. Matches
   `evidence/after-collect-test.txt`. Temp copy deleted afterwards.
3. **Reproduction 2: siblings not `<REPO>-…`, `/home/u2/project` not `<HOME>2`,
   in-repo paths still `<REPO>/…`** — **pass** (with one wording note, see Plan vs
   implementation). Re-driven with `HOME=/home/u USER=u` against the archive copy:
   `siblingWorktree` → `<dir>/agento-worktrees/plan-x/scripts/agento.mjs`,
   `siblingDocs` → `<dir>/agento-docs/iss<USER>es`, `insideRepo` →
   `<REPO>/scripts/agento.mjs`, `repoThenSpace` → `cd <REPO> && ls`, `homeCache` →
   `<HOME>/.cache/x`, `homeSibling` → `/home/<USER>2/project`. Identical to
   `evidence/after-sanitize-ctx.txt`. The HOME boundary holds (`<HOME>2` is gone);
   the residual `<USER>2` is the one-letter username catch-all the plan keeps under
   Decision 2 — the same mechanism the plan already shows as `iss<USER>es`. The
   deterministic #145 test (username `zq9user`, no overlap) asserts the literal
   `other: "/h/me2/project"` unchanged.
4. **Longest-first ordering and trailing-slash HOME** — **pass.** #145 test contexts
   B (`homeDir: "/h/me/"` → `home: "<HOME>/x"`) and C
   (`repoRoot: "/h/me/.cache/agento-harness-probe"` → `ws: "<PROBE_WS>/a"`) are
   `ok` on HEAD and were the `<HOME>x` / `<REPO>/workspace/a` failures at `534274e`.
   Implementation: `probe.mjs:343-349` (`path.resolve`, `.sort` by length desc,
   lookahead `(?![A-Za-z0-9._-])`).
5. **Username catch-all unchanged** — **pass.** #145 case `encoded` →
   `<HOME>/.config/Code/agentPlugins/file-home-<USER>-DP-agento/1a` is `ok`;
   `probe.mjs:361` still applies `split(ctx.username).join("<USER>")` last and
   unbounded.
6. **Committed fixtures untouched** — **pass.**
   `git diff --name-only origin/main...HEAD -- tests/harness-probe/fixtures` printed
   nothing.
7. **Full lint gate vs. baseline (942/942, shellcheck clean at `ba7e323`)** —
   **pass.** `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'
   'canvas/**/*.test.mjs'` → `# tests 943 / pass 943 / fail 0`, exit 0 (baseline +
   exactly the one new #145 test). `shellcheck` is not on PATH; `git ls-files '*.sh'
   | xargs pnpm dlx shellcheck` → 4 files, exit 0, no findings. No new or
   undocumented findings; no shell file changed.
8. **No change under `scripts/`, `extension/`, `.github/hooks/`** — **pass.**
   `git diff --name-only origin/main...HEAD -- scripts extension .github/hooks`
   printed nothing; `git diff --stat` touches only `CHANGELOG.md`,
   `docs/copilot-harness.md`, `tests/harness-probe/probe.mjs`,
   `tests/harness-probe/probe.test.mjs`.
9. **Docs paragraph and CHANGELOG entry** — **pass.** `grep -n '#145' CHANGELOG.md`
   → line 8 (`**Fixed.**` entry under `## Unreleased`); `grep -n 'path boundary'
   docs/copilot-harness.md` → line 172, paragraph states longest first, boundary
   definition, username last. `node --test tests/harness-probe/probe.test.mjs
   tests/customizations.test.mjs` → `# tests 91 / pass 91 / fail 0`, exit 0 (docs
   link test green).

Exposing-test gate: present at the planned path, named with `#145` and the slug,
demonstrably fails on the pre-fix sanitizer with the issue's actuals, passes on HEAD.
plan.md `## Resolution` is written, names `tests/harness-probe/probe.mjs`, the #145
test name, and both `evidence/after-*.txt` files, and matches the diff (root cause =
unbounded `split/join` in fixed order; fix = `path.resolve` + longest-first +
lookahead + function replacement; username catch-all kept; seam added). All four
`evidence/` links in plan.md resolve.

## Plan vs implementation

- The code matches `## Approach` items 1–5 one for one. The ctx shape became
  `{ counters, paths, username }` with `paths` holding compiled `[RegExp, to]`
  pairs, which the plan explicitly allowed ("the `ctx` shape may change"); nothing
  outside `probe.mjs` reads it (confirmed by the import list in `probe.test.mjs`).
- **Documented deviation (roadmap 2.2 repair):** acceptance item 3 and the plan.md
  `## Evidence` table say `/home/u2/project` maps "unchanged", but with the
  reproduction's own `USER=u` the result is `/home/<USER>2/project`. That is not a
  defect in the fix: a literal "unchanged" is unattainable under the plan's Decision 2
  (unbounded username catch-all, kept deliberately), and the plan already accepts the
  same effect as `iss<USER>es` in the same table. The Builder's repair of the step 2.2
  expectation is consistent with the plan; the parenthetical intent "(not `<HOME>2`)"
  is what the fix had to deliver, and it does. Scored pass; wording noted under
  Findings (minor).
- No undocumented changes. The three commits map to roadmap steps 1.1, 2.1, 3.1;
  steps 2.2, 3.2, 3.3 are artifact-only commits in the companion half, per the
  two-commit rule.

## Roadmap audit

All six boxes ticked; each was spot-checked against the codebase and re-run:

| Step | Claim | Check | Result |
| --- | --- | --- | --- |
| 1.1 | seam + #145 test, `exit=1`, 23/1 at the time | test present; re-ran at `534274e` → `not ok` with the recorded actuals | holds |
| 2.1 | fix, 24/24, fixtures untouched | `node --test tests/harness-probe/probe.test.mjs` → 24/24 exit 0; fixtures diff empty | holds |
| 2.2 | repro 1 `ok`, repro 2 values, evidence files | both re-driven from a fresh archive; outputs identical to `evidence/after-*.txt` | holds |
| 3.1 | docs + changelog, 91/91 | greps at lines 172 / 8; 91/91 exit 0 | holds |
| 3.2 | full gate 943/943, shellcheck clean, protected diff empty | 943/943 exit 0; shellcheck exit 0 (4 files); diff empty | holds |
| 3.3 | Resolution written, links resolve | section present, names required items; 4/4 links resolve | holds |

No falsely ticked boxes, no `(manual)` or `(manual, post-ship)` steps, no missing
work found. No roadmap repairs were needed; the Builder's 2.2 expectation repair is
accepted as-is.

## Findings

No findings above minor.

- **Minor (plan wording, advisory):** plan.md acceptance item 3 and the `## Evidence`
  table describe `/home/u2/project` as "unchanged", which the plan's own `USER=u`
  reproduction and Decision 2 make impossible (`/home/<USER>2/project`). The roadmap
  2.2 line already carries the corrected expectation; no artifact change is required
  for this verdict. Future plans that keep a one-letter catch-all should phrase the
  HOME-boundary expectation as "not `<HOME>…`".
- **Info (`tests/harness-probe/probe.mjs:343-349`):** the regex path entries are
  compiled with the `g` flag and reused across `scrubStrings` calls via
  `String.prototype.replace`, which resets `lastIndex`, so no cross-call state leaks.
  `escapeRegExp` covers every metacharacter that is significant outside a character
  class; `-` is literal there. The function replacer `() => to` correctly prevents
  `$`-pattern interpretation. No security impact: `DENY_PATTERNS` and the `collect`
  refusal path are untouched (protected-path diff empty).

## Follow-ups

- None required for this issue. (Optional, not blocking: an integration test that
  exercises `collect` from a `<dir>/agento` clone with `TMPDIR=<dir>` was explicitly
  declined in Decision 4; reproduction 1 remains a manual-evidence re-run.)
