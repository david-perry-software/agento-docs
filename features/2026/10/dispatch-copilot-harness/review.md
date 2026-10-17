# Review: dispatch-copilot-harness

Verdict: approve

Reviewed 2026-10-17 against product `feature/dispatch-copilot-harness` at `bf98a60`
(code PR #119, draft, `MERGEABLE`; `origin/main` is an ancestor; 0/0 ahead/behind
`origin/feature/dispatch-copilot-harness`) and companion
`feature/dispatch-copilot-harness` at `25b31bc` (companion PR #57, draft;
`origin/main` ancestor; `dirty: false`, `ahead: 0`). Both halves
`git status --porcelain --untracked-files=all` empty at the start and at the end of
the review.

Skills consulted: agent-customization (built-in VS Code skill — the dispatch
surfaces are chat, skills, and agent modes); none project-specific — the repository
has no `.agents/skills/` and AGENTS.md has no skills table.

Shape of the delivery: the Phase 1 probe found that V1 — the payload
`chatOpenOptions` already builds (`{ query, mode, attachFiles }`,
`extension/src/commandDispatcher.ts` L38–L61) — submits in both Copilot and Local,
so the shipped product diff is a committed probe extension plus its node:test, and a
`docs/copilot-harness.md` update. **No extension source changed**; `main`'s
`chatOpenOptions` is what ships.

## Acceptance checklist results

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Dispatch probe at `tests/harness-probe/dispatch-probe/` with the V1–V8 table; `dispatch-probe.test.mjs` exits 0 and asserts unique ids, canonical query, V1 = pre-change payload | pass | `tests/harness-probe/dispatch-probe/{package.json,extension.js,variants.js}` present; `variants.js` `buildVariants` returns the exact eight rows of plan.md `## Approach` §1 (checked row by row against the plan table). `dispatch-probe.test.mjs` has the three required tests plus V5/V6 shape tests. My run `node --test tests/harness-probe/dispatch-probe.test.mjs tests/harness-probe/probe.test.mjs tests/customizations.test.mjs` → exit 0, 83 pass / 0 fail |
| 2 | Copilot and Local result for every variant recorded in `evidence/step-1-2-dispatch-matrix.md` with linked screenshots, and in `docs/copilot-harness.md` "Dispatch" with the chosen variant | pass (deviation noted) | Matrix has a row per variant per harness: V1 Copilot and V1 Local fully recorded (filled / submitted / receipt / agent / attachment) with probe output-channel logs and linked `step-1-2-copilot-v1.png`, `step-1-2-local-v1.png`; V2–V8 are recorded as `not run (V1 selected by the rule)`. I viewed both screenshots: Copilot shows the "Chat with Copilot" / Interactive footer, `delivery-status.md` attached, `/agento delivery-status` as a sent request, `Receipt: accepted delivery-status:main:2a39ba1`, and the probe channel `[V1] settled undefined in 25 ms`; Local shows the "Local" footer and the same receipt. `docs/copilot-harness.md:314` names **V1** and L38 marks the earlier finding superseded. The not-run variants are the deviation discussed under Plan vs implementation (minor) |
| 3 | `chatOpenOptions` builds the selected variant, plus fallback only if nothing submitted in Copilot; updated unit tests failed first | pass (vacuous) | Selected variant V1 ≡ current `chatOpenOptions` (`commandDispatcher.ts` L46–L60 builds `{ query, mode?, attachFiles? }`); no fallback applies because V1 submitted in Copilot. No code or test change was required, so the "failed against old code first" clause has no subject; the pins remain `commandDispatcher.test.ts` L138–L173 and `planPlayButtonHandoff.test.ts` L92–L129 |
| 4 | `cd extension && npm run typecheck` exits 0; `npm run test:unit` exits 0 with ≥ 167 passing | pass | my run: typecheck exit 0; unit 167 tests / 167 pass / 0 fail, exit 0 (equal to the baseline — no extension test changed) |
| 5 | `cd extension && npm run test:electron` exits 0 | pass | my run on `DISPLAY=:0`: in-repo, companion, workspace, and no-markdown scenarios each `passed`, `Exit code: 0` ×4, overall exit 0 |
| 6 | Copilot chat: Session & Doctor **delivery-status** dispatch from the (branch-built) extension submits and prints the receipt, no retyping — `evidence/step-3-2-copilot-dispatch.png` | pass | Viewed: build-window Agento sidebar (Session & Doctor visible), chat footer "Interactive" / "Chat with Copilot" with Claude Opus 5.5, request `/agento delivery-status` with `delivery-status.md` attached, response `Receipt: accepted delivery-status:plan-20261017-154856:bf98a60` (16 steps, 12m 3s). The "branch-built" clause is satisfied by the installed `david-perry-software.agento-dashboard@0.7.0` because the branch changes no extension source (confirmed by `git diff --stat origin/main...HEAD`: nothing under `extension/`); `code --list-extensions --show-versions` confirms 0.7.0 is installed. The router link `~/.copilot/skills/agento → /home/david/DP/agento-plugin/skills/agento` is in place (`ls -la`). Window deviation (build window instead of primary) is discussed under Plan vs implementation |
| 7 | Same dispatch in a Local chat — `evidence/step-3-2-local-dispatch.png` | pass | Viewed: footer "Local" with DeepSeek V4 Pro, same request and attachment, `Receipt: accepted delivery-status:plan-20261017-154856:bf98a60` (27 steps, 2m 45s) |
| 8 | `docs/extension.md` "Command routing" describes the shipped payload; `node --test tests/harness-probe/probe.test.mjs tests/customizations.test.mjs` exits 0 | pass | `docs/extension.md` L216–L231 describes `mode` = command `agent:` frontmatter, the attached command file, and both `dispatch: no …` fallbacks — exactly what `chatOpenOptions` does; `grep -n "workbench.action.chat.open" docs/extension.md` → L223. Both suites pass in my 83/83 run above (the "every relative link in docs/copilot-harness.md resolves" test included) |
| 9 | Gates: full node suite exit 0; five guard replays exit 0; PR CI green with Shellcheck at zero findings vs `2a39ba1` | pass | Full suite: see "Gate run" below. Guard replays g1–g5 (in-repo, companion, copilot-format, copilot-format companion, copilot fixtures) each exit 0, no `mismatch` lines beyond the fixture header comment. `gh pr checks 119` → `ci/test` successful (4m48s), 0 failing/pending; `gh run list --branch … --workflow ci` → run `39050031503` on head `bf98a60` `success`; its Shellcheck step runs `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` under `bash -e` with no finding lines in the log, i.e. zero findings — identical to the `2a39ba1` baseline. `shellcheck` is not installed locally (`command -v shellcheck` empty), as the plan recorded; no shell script is in the diff |
| 10 | Clean handoff: both halves clean | pass | `git status --porcelain --untracked-files=all` empty in product and companion, before and after my electron/unit/node runs (`extension/out`, `extension/.vscode-test` are gitignored) |

**Gate run (Reviewer, 2026-10-17):** `node --test 'scripts/**/*.test.mjs'
'tests/**/*.test.mjs'` → exit 0, 565 tests, 565 pass, 0 fail (plan baseline 560 on
`main` `2a39ba1`; +5 = `dispatch-probe.test.mjs`).

**Lint gate (§5):** scoped gate as planned — no shell file changed; full-repository
Shellcheck in CI on the PR head is green with zero findings, matching the recorded
baseline; extension typecheck, unit, and electron, the full node suite, and the
guard replays all pass. No new or undocumented findings.

## Plan vs implementation

- **Variants V2–V8 were not run.** Step 1.2 and acceptance item 2 ask for a
  Copilot and Local result for every variant; the user ran V1 in both harnesses,
  it submitted, and the plan's selection rule (`## Approach` §2: "pick the first
  variant that submits in both", preference order starting at V1) was therefore
  satisfied at the first row. The matrix records the remaining rows explicitly as
  not run and gives the reason; plan.md `## Decisions` carries a dated `(added
  2026-10-17)` entry with the consequence. The shipped decision would be the same
  with the other seven results, and each Copilot variant costs a 4–12 min turn, so
  I accept this as a documented minor deviation rather than a gap. The cost is
  informational: V7 (a custom-agent `mode`) — the shape the dashboard uses for
  Builder/Reviewer/Planner commands — has no recorded Copilot result; see
  Follow-ups.
- **Phase 2 and step 3.1 struck as obsolete.** Correct consequence of V1 being the
  current payload: there is nothing to change in `chatOpenOptions`, the tests, the
  electron suite, or `docs/extension.md` (I checked the latter describes the shipped
  behavior accurately). The Builder struck the steps with `~…~` and a reason on each
  line instead of deleting them, which keeps the plan's intent auditable. Acceptable.
- **Step 3.2 ran in the build window, not the primary window.** The step text names
  the primary window; the user reported the Agento UI does not work there, so the
  action was run from this build window's Session & Doctor panel. The dispatch path
  is `dispatchCommandToTarget` → `chatOpenOptions` for the current window regardless
  of role, so the check is equivalent for what this delivery claims. Recorded on
  the step line with the user's words; the primary-window problem is a Follow-up.
- **The "branch-built extension" is the installed 0.7.0.** Since `extension/` is
  untouched on the branch, 0.7.0 is byte-for-byte the shipped dispatch code; the
  step line records this and the restore command is moot. Acceptable.
- **Scope discipline.** Product diff is exactly `docs/copilot-harness.md`,
  `tests/harness-probe/dispatch-probe.test.mjs`, and
  `tests/harness-probe/dispatch-probe/{extension.js,package.json,variants.js}` —
  a subset of the plan's file list; no hook, prompt, agent, command, CLI, or
  extension change, so `copy-cli` was not needed.
- **Explanation of the superseded observation is a hypothesis.** `docs/copilot-
  harness.md` "Dispatch" attributes the earlier non-submission to the pre-router,
  probe-skill window. That is plausible (the harness-probe observation was taken in
  the probe window with its own plugin) but was not isolated experimentally. The
  text is clear that the old finding is superseded by measurement, which is what
  matters; minor wording point only.

## Roadmap audit

Every ticked box was checked against the trees and my own runs:

- 1.1 — files and test present; verify command passes (my run).
- 1.2 `(manual)` — linked evidence files exist and were viewed; the verify text
  ("every row links an `evidence/step-1-2-*.png`") is met for the rows that ran
  and the not-run rows say so; left ticked with the deviation recorded above.
- 1.3 — `docs/copilot-harness.md:314` names V1; plan.md has the dated decision;
  verify suites pass (my run).
- 2.1–2.4, 3.1 — struck as obsolete with reasons; I confirmed each premise (V1 ≡
  current payload; tests already pin it; `docs/extension.md` accurate; 0.7.0 ≡
  branch extension code).
- 3.2 `(manual)` — both evidence files linked, exist, and show the sent request
  plus receipt per harness; deviation recorded on the line.
- 4.1 — reproduced: node suite, five guard replays, extension typecheck/unit/
  electron all exit 0; counts match the line.
- 4.2 — CI run `39050031503` on `bf98a60` success; both halves at origin.
- 4.3 — both halves clean.

No falsely ticked boxes; no missing-work steps added; no repairs made.

## Findings

Ordered by severity. Nothing above minor.

1. **Minor — V2–V8 not measured** (`evidence/step-1-2-dispatch-matrix.md`). The
   probe and its variant table are committed, so the matrix can be completed on a
   later VS Code build, but today the only measured payload is V1. The practical
   residual risk is a custom-agent `mode` (V7 shape) in Copilot, which the
   dashboard uses for `new-feature`, `build-*`, and `review-*` dispatches; the
   end-to-end 3.2 check used `delivery-status` (`mode: "agent"`). Tracked as a
   Follow-up; not blocking because the shipped code is unchanged from `main`.
2. **Minor — probe `resolveCommandFile` assumes the router link layout**
   (`tests/harness-probe/dispatch-probe/extension.js` L24–L32: `realpath` of
   `~/.copilot/skills/agento`, two levels up). Fine for the documented harness
   setup and it surfaces a clear error message when the file is missing; not
   production code.
3. **Nit — `CANONICAL_QUERY_TRAILING` exported but unused outside `variants.js`**
   (`variants.js` L13, L33). Harmless; the test derives the V8 string itself.

Security: no new network, shell, secret, or file-write paths; the probe only reads
a command file and calls a VS Code command. Nothing to report.

## Follow-ups

- Primary-window Agento UI: the user reports "The agento UI doesnt work in the
  primary" window (`/home/david/DP/agento`) — the Agento sidebar/dashboard does
  not function there, so step 3.2 was run from the build window instead. Out of
  this delivery's scope; needs its own issue (reproduce in the primary window with
  the extension output channel and `agento.mjs session` output).
- Complete the dispatch matrix for V2–V8 — at least V7 (custom-agent `mode`) in
  Copilot — using the committed probe
  (`code --new-window --extensionDevelopmentPath=<clone>/tests/harness-probe/dispatch-probe /home/david/DP/agento`),
  and append the rows to `evidence/step-1-2-dispatch-matrix.md` and
  `docs/copilot-harness.md` "Dispatch". Candidate for the `harness-docs` member.
- `docs/copilot-harness.md` "Dispatch": soften "predates the router install and
  used the probe skill" to a stated hypothesis, or isolate it (run V1 once with the
  router link removed) when the matrix is completed.
