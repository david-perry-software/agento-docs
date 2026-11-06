# Harness-probe fixture sanitizer replaces repo/HOME paths without a path boundary

## Problem

`collect` in the harness probe (`tests/harness-probe/probe.mjs`) writes sanitized hook
captures into `tests/harness-probe/fixtures/`. Its sanitizer replaces each known path
(repo root → `<REPO>`, probe workspace → `<PROBE_WS>`, HOME → `<HOME>`, then the
username → `<USER>`) with a plain `split/join`, in a fixed order, and never checks
where the match ends. A path that only *starts with* a known path is rewritten as if
it were inside it:

- With the clone at `…/agento`, any `…/agento-worktrees/…` or `…/agento-docs/…` path
  becomes `<REPO>-worktrees/…` / `<REPO>-docs/…`. Those are Agento's own sibling
  conventions, so real captures from contributors are affected, not just tests.
- With HOME `/home/u`, `/home/u2/project` becomes `<HOME>2/project`.
- Once `<REPO>` has taken the prefix of a path under HOME, `<HOME>` can no longer
  match it.

The visible failure is that `tests/harness-probe/probe.test.mjs:282` ("collect
sanitizes logs into fixtures and empties the log dir") fails, but only for some
checkout locations. It fails whenever the temp HOME (`$TMPDIR/agento-probe-home-*`)
starts with the repo root, as when the clone is `<dir>/agento` and `TMPDIR=<dir>`.

## Evidence

GitHub issue: #145

Reproduced on 2026-11-05 at `origin/main` `ba7e323`, node v22.23.2.

**Reproduction 1: the failing test** ([evidence/repro-collect-test.txt](evidence/repro-collect-test.txt))

1. Put a copy of the tracked tree at `<dir>/agento`:
   `git archive HEAD | tar -x -C <dir>/agento`.
2. `cd <dir>/agento && TMPDIR=<dir> node --test --test-name-pattern="collect sanitizes" tests/harness-probe/probe.test.mjs`

Observed: `not ok 1 - collect sanitizes logs into fixtures and empties the log dir`,
`location: '<dir>/agento/tests/harness-probe/probe.test.mjs:282:1'`,
`error: 'home path not replaced with <HOME>'`, exit 1.

Expected: the test passes no matter where the clone and TMPDIR live.

**Reproduction 2: sanitizer output** ([evidence/repro-sanitize-ctx.txt](evidence/repro-sanitize-ctx.txt))

`sanitizeRecord(rec, makeSanitizeCtx())` with the repo at `<dir>/agento`,
`HOME=/home/u`, `USER=u`:

| Input | Observed | Expected |
| --- | --- | --- |
| `<dir>/agento-worktrees/plan-x/scripts/agento.mjs` | `<REPO>-worktrees/plan-x/scripts/agento.mjs` | not `<REPO>…` (sibling of the repo) |
| `<dir>/agento-docs/issues` | `<REPO>-docs/iss<USER>es` | not `<REPO>…` |
| `<dir>/agento/scripts/agento.mjs` | `<REPO>/scripts/agento.mjs` | same (correct) |
| `cd <dir>/agento && ls` | `cd <REPO> && ls` | same (correct) |
| `/home/u/.cache/x` | `<HOME>/.cache/x` | same (correct) |
| `/home/u2/project` | `<HOME>2/project` | unchanged (not under HOME) |

The `iss<USER>es` cell shows the unbounded username catch-all with a one-letter
username. That behavior stays, by decision (see `## Decisions` Q2 and `## Risks`).

**Control:** in this planning worktree (`…/agento-worktrees/plan-20261106-043734`),
the repo root is not a prefix of `/tmp/agento-probe-home-*`. Here
`node --test tests/harness-probe/probe.test.mjs` passes 23/23 and the full suite
942/942. That explains why the bug depends on checkout location.

## Decisions

Asked 2026-11-05 with the ask-questions tool. Each answer is recorded verbatim, and the
recommended option is marked.

1. **What counts as a path boundary after a match?** Options: (recommended) end of
   string, or any character that can't continue a path segment name (anything but
   `[A-Za-z0-9._-]`), which covers `/`, quotes, spaces, `:`, `)`, and so on; exactly
   `/`, a quote, or end of string; only `/` or end of string.
   Answer: `non-name-char` (the recommended option).
2. **What should happen to the username (`<USER>`) replacement?** Options:
   (recommended) keep it as the last, unbounded catch-all, with boundaries applying
   only to the path entries (REPO, PROBE_WS, HOME); apply the same boundary to the
   username too; drop the username replacement.
   Answer: `keep-catchall` (the recommended option).
3. **Should the committed fixtures be regenerated?** Options: (recommended) leave them
   untouched, since the fix changes only future collects; add a step that checks and
   re-sanitizes them.
   Answer: `leave` (the recommended option).
4. **What shape should the regression test take?** Options: (recommended) let
   `makeSanitizeCtx` accept optional `{repoRoot, homeDir, username, probeWs}`
   overrides and add a deterministic unit test (#145, slug in its header) that covers
   a sibling prefix, nested paths, a space or quote after the path, and longest-first
   ordering, keeping the existing collect test; an integration test that copies the
   probe into a temp `<dir>/agento` and runs collect with `TMPDIR=<dir>`; both.
   Answer: `injectable-ctx` (the recommended option).

## Research

- `tests/harness-probe/probe.mjs` `makeSanitizeCtx()` (line 320) returns
  `{ counters, paths }`, where `paths` is `[[repoRoot, "<REPO>"], [probeWs,
  "<PROBE_WS>"], [homeDir, "<HOME>"], [username, "<USER>"]]` in that fixed order.
  `repoRoot = path.resolve(here, "..", "..")`, and `homeDir = process.env.HOME ||
  homedir()`, which is not normalized, so a trailing `/` is possible.
- `scrubStrings()` (line 347) runs `out = out.split(from).join(to)` for each entry. It
  never checks the character after the match, and it never orders entries by
  specificity. This is the root cause.
- Callers: `collect()` (line 257) builds one ctx per run and passes it to
  `sanitizeRecord` (line 266). `sanitizeRecord(record, ctx = makeSanitizeCtx())`
  (line 387) is exported along with `makeSanitizeCtx` (line 423). Nothing outside
  `probe.mjs` reads `ctx.paths`.
- Test: `tests/harness-probe/probe.test.mjs:282` uses `mkHome()` =
  `mkdtempSync(path.join(tmpdir(), "agento-probe-home-"))` (line 164). Whether it
  passes depends on whether `tmpdir()` + `/agento-probe-home-…` starts with the
  repo root.
- The committed fixtures (`tests/harness-probe/fixtures/{copilot,copilot-plugin,local,local-plugin}`)
  contain no `<REPO>-`, `<HOME>-`, or `<PROBE_WS>-` tokens. The only `<X>-` tokens
  are 20 × `<USER>-DP-agento-worktrees-…` inside VS Code's encoded plugin dirs
  (`file-home-<USER>-DP-…`). They are correct, and they show that the username
  catch-all must stay unbounded (`DENY_PATTERNS` catches `/home/` but not an encoded
  `-home-david-`).
- `tests/` is not part of the `extension/cli/` copy, so no `npm run copy-cli` is
  needed. No hook file is involved.
- Docs: `docs/copilot-harness.md` §"Hook input payload fields" (line 168) says that
  fixture files are sanitized captures, but it doesn't state the placeholder rules.
  The CHANGELOG has an `## Unreleased` section with `**Fixed.**` entries.
- Open PRs (`gh pr list --state open`): none, so there's no concurrent-delivery
  overlap.

**Lint baseline (policy §5),** run 2026-11-05 at `ba7e323`:

- Shell lint: `shellcheck` is not on PATH, so it was run as
  `git ls-files '*.sh' | xargs pnpm dlx shellcheck` (shellcheck v0.11.0, 4 files):
  exit 0, no findings.
- Test suite:
  `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'`
  gave exit 0, tests 942, pass 942, fail 0.
- The repository has no JS linter configured. Overlap decision: the baseline is green,
  so the **full gate** applies (the full suite plus the full shellcheck run must
  stay green). This delivery changes no shell file.

Skills consulted: none — no matching domain (the repository has no `.agents/skills/`
and no AGENTS.md skills table; the change is plain Node.js in a test harness).

## Approach

All code changes are in `tests/harness-probe/probe.mjs` and
`tests/harness-probe/probe.test.mjs`.

1. **Test seam (no behavior change).** `makeSanitizeCtx(overrides = {})` accepts
   optional `repoRoot`, `homeDir`, `username`, and `probeWs`. Defaults are exactly
   today's values, and `probeWs` defaults from the resolved `homeDir`. `collect()`
   and `sanitizeRecord`'s default stay `makeSanitizeCtx()`.
2. **Boundary-aware path entries.** In `makeSanitizeCtx`, normalize each path entry
   (REPO, PROBE_WS, HOME) with `path.resolve` so a trailing slash cannot defeat the
   boundary. Drop empty entries, and sort the entries by length, longest first.
   Compile each into
   `new RegExp(escapeRegExp(from) + "(?![A-Za-z0-9._-])", "g")`.
   `scrubStrings` replaces with a function (`() => to`) so `$` in a path or
   placeholder is never interpreted. The boundary is end of string or any character
   outside `[A-Za-z0-9._-]` (Decision 1).
3. **Username stays the catch-all.** It is applied last, after every path entry, as
   an unbounded `split/join` (Decision 2). The `ctx` shape may change (for example
   `{ counters, paths, username }`, with `paths` holding compiled matchers). Nothing
   outside `probe.mjs` reads it.
4. **Regression test.** Add
   `test("makeSanitizeCtx replaces repo and HOME paths only at a path boundary (#145 fixture-sanitizer-path-boundary)")`
   in `probe.test.mjs`. It uses fixed overrides (`repoRoot: "/h/me/DP/agento"`,
   `homeDir: "/h/me"`, `username: "zq9user"`), so it doesn't depend on where the
   clone lives. A second ctx (`repoRoot: "/h/me/.cache/agento-harness-probe"`, default
   `probeWs` under it) checks longest-first ordering. The case table is in roadmap
   step 1.1.
5. **Docs.** `docs/copilot-harness.md` (next to line 168) gains one short paragraph
   on the placeholder rules: path entries are replaced longest first and only at a
   path boundary; the username is replaced last, everywhere. `CHANGELOG.md`
   `## Unreleased` gets a `**Fixed.**` entry citing #145.

## Risks

- **The username catch-all keeps over-matching** (for example
  `david-perry-software` → `<USER>-perry-software`, or a short username inside
  words). Mitigation: this was accepted in Decision 2, because privacy (VS Code's
  encoded `file-home-<user>-…` dirs) outweighs the cosmetic mangling. The regression
  test asserts that the encoded-dir case still scrubs.
- **Under-matching leaks a path.** If a known path is followed by a name character
  (for example `/h/me/DP/agento-worktrees`), `<REPO>` no longer applies, and only
  the shorter HOME entry or the username catch-all protects it. Mitigation: the
  longest-first order guarantees that HOME still applies to any path under HOME.
  `DENY_PATTERNS` (`/home/`, `/Users/`, `C:\Users`) still refuses unscrubbed
  captures. The #145 test (step 1.1) asserts that the sibling path becomes `<HOME>/DP/…`.
- **Trailing-slash HOME** (`HOME=/h/me/`) would stop matching under a strict
  boundary. Mitigation: `path.resolve` normalization, with a test case.
- **Concurrent delivery:** there are no open PRs. Integrate `origin/main` by merge
  before every push.

## Out of scope

- Re-sanitizing or regenerating the committed fixtures (Decision 3).
- A *leading* boundary (a known path appearing mid-path, for example
  `/mnt/h/me/x`). The report and the decisions cover only where a match ends.
- Changing the username catch-all, `DENY_PATTERNS`, or the TS/UUID/HEX scrubbing.
- An integration test that copies the probe into a temp `<dir>/agento`. Reproduction
  1 is re-run manually as evidence in step 2.2 instead (Decision 4).

## Acceptance checklist

- [ ] The exposing regression test
  `tests/harness-probe/probe.test.mjs` →
  "makeSanitizeCtx replaces repo and HOME paths only at a path boundary
  (#145 fixture-sanitizer-path-boundary)" fails before the fix (recorded in roadmap
  step 1.1 with the `<REPO>-worktrees` / `<HOME>2` actuals) and passes after it.
  Verify: `node --test --test-name-pattern='#145' tests/harness-probe/probe.test.mjs`
  exit 0.
- [ ] Reproduction 1 passes on the branch: with a `git archive` copy at
  `<dir>/agento` and `TMPDIR=<dir>`, the "collect sanitizes" test is `ok`. Verify:
  the step 2.2 command exits 0, and the output is saved to
  `evidence/after-collect-test.txt`.
- [ ] Reproduction 2 on the branch maps `<dir>/agento-worktrees/…` and
  `<dir>/agento-docs/…` to something other than `<REPO>-…`. It maps
  `/home/u2/project` unchanged (not `<HOME>2`), and in-repo paths still map to
  `<REPO>/…`. Verify: `evidence/after-sanitize-ctx.txt`.
- [ ] Path entries are replaced longest first, and a `HOME` with a trailing slash
  scrubs the same as one without. Verify: the #145 test cases for both.
- [ ] The username catch-all is unchanged: an encoded `file-home-<username>-DP-…`
  segment still scrubs to `file-home-<USER>-DP-…`. Verify: the #145 test case.
- [ ] Committed fixtures are untouched. Verify:
  `git diff --name-only origin/main...HEAD -- tests/harness-probe/fixtures` prints
  nothing.
- [ ] Full lint gate (§5), compared with the `## Research` baseline:
  `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'`
  exits 0 with no failures, and `git ls-files '*.sh' | xargs pnpm dlx shellcheck`
  exits 0 with no findings.
- [ ] No file under `scripts/`, `extension/`, `scripts/hooks/`, or `.github/hooks/`
  changes. Verify:
  `git diff --name-only origin/main...HEAD -- scripts extension .github/hooks`
  prints nothing.
- [ ] `docs/copilot-harness.md` states the placeholder rules (longest first, path
  boundary, username last), and `CHANGELOG.md` `## Unreleased` has a `**Fixed.**`
  entry citing #145. Verify: `grep -n '#145' CHANGELOG.md` and the docs paragraph;
  the docs link test in `probe.test.mjs` stays green.

## Resolution

_Written by the Builder at completion._
