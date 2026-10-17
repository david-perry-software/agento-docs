# Review: harness-install

Verdict: approve

Reviewed 2026-10-17 (round 1 of 3) against product `feature/harness-install` at
`b5cfb30` (code PR #118, `origin/main` is an ancestor, 0/0 ahead/behind
`origin/feature/harness-install`) and companion `feature/harness-install` at
`085c2f0` (companion PR #56, `origin/main` ancestor, `dirty: false`, `ahead: 0`).
Both halves `git status --porcelain --untracked-files=all` empty at the start of the
review.

Skills consulted: none — no matching domain (the repository has no
`.agents/skills/` and AGENTS.md has no skills table; the change is a Node CLI
subcommand, node:test tests, and Markdown docs).

## Acceptance checklist results

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `harness status` reports the five states with `link`, `expected`, `target`, `pluginRoot`, `localTakeover` | pass | `scripts/agento.test.mjs` "harness status reports absent, installed, foreign, dangling, and not-a-link" asserts every field per state; `scripts/harness.mjs` `linkState` + `case "harness"` in `scripts/agento.mjs` (`doc` carries all keys); passes in my full-suite run |
| 2 | `harness install` creates `<clone>/skills/agento`, idempotent, refuses foreign/dangling without `--force`, refuses a real directory always (intact), refuses a linked worktree naming the primary, `missing` without the router | pass | tests "harness install creates an idempotent link…" (readlink = expected, `changed: false` on re-run, exit 3 `refused` then `--force` replaces, real dir refused with `--force` and `SKILL.md` content `mine` preserved) and "harness install refuses a linked worktree…" (`status: worktree`, `primaryCheckout` = plugin, message ends `--plugin-root <plugin>`; `status: missing`); live: `node scripts/agento.mjs harness install` from this worktree → `status: worktree`, `primaryCheckout: /home/david/DP/agento`, exit 3, nothing written (re-run by me) |
| 3 | `harness uninstall` removes only an `installed` link, refuses everything else untouched | pass | test "harness uninstall removes only an installed link…": absent no-op, installed removed (`existsSync` false), foreign refused with readlink unchanged, real dir refused with content intact |
| 4 | `linkType` → `junction` on `win32`, `dir` elsewhere | pass | `scripts/harness.mjs` `linkType`; test "harness usage errors and the pure linkType helper" asserts win32/linux/darwin |
| 5 | `doctor` lists ten checks ending in `harness`; warn for absent/foreign/dangling/not-a-link, ok when installed or no router; not in `doctor --for` / `preflight` | pass | test "doctor reports ten checks…" asserts the exact id list; test "doctor harness check is ok without a router…" covers every state and `byId(...)["harness"] === undefined` for `doctor --for new-feature` and `preflight new-feature`; `DOCTOR_CHECKS.harness` is absent from `CAPABILITY_CHECKS` and present in `LOCAL_DOCTOR_CHECKS`; live `doctor --plugin-root /home/david/DP/agento-plugin` lists `…,hook-wiring,harness` |
| 6 | No test touches the real `~/.copilot` | pass | `baseEnv.AGENTO_COPILOT_SKILLS_DIR = mkdtemp(...)` in `scripts/agento.test.mjs`; `copilotSkillsDir()` honours it; `ls -la ~/.copilot/skills` captured before and after my full-suite run is byte-identical (`agento -> /home/david/DP/agento-plugin/skills/agento`, `use-railway`) |
| 7 | `extension/cli/` is a byte copy of `scripts/` | pass | `cmp scripts/agento.mjs extension/cli/agento.mjs && cmp scripts/harness.mjs extension/cli/harness.mjs` silent; `harness.mjs` added to both `extension/scripts/copy-cli.mjs` and `tests/extension-bundle.test.mjs`; `cd extension && npm run test:unit` exit 0, 167/167 pass |
| 8 | `docs/copilot-harness.md` documents `harness install\|status\|uninstall` instead of `ln -s`; AGENTS.md lists `harness` | pass | `grep -n "ln -s" docs/copilot-harness.md` exit 1 (no match); "Router skill" section now shows `node <clone>/scripts/agento.mjs harness install --plugin-root <clone>` plus `status`/`uninstall`/`--force` and the Local takeover; `AGENTS.md:21` lists `harness`; `tests/harness-probe/probe.test.mjs` and `tests/customizations.test.mjs` pass in the full suite |
| 9 | Live: `harness status` `installed`, `doctor` `harness` `ok` against the real `~/.copilot/skills`; Copilot and Local `/agento delivery-status` print the receipt, with screenshots | pass | my re-run: `readlink -f ~/.copilot/skills/agento` → `/home/david/DP/agento-plugin/skills/agento`; `harness status --plugin-root /home/david/DP/agento-plugin` → `state: installed`, `changed: false`; doctor `harness` → `ok`, detail `/home/david/.copilot/skills/agento → /home/david/DP/agento-plugin; With the link installed…`. Evidence viewed: `evidence/step-2-3-copilot-delivery-status.png` (Copilot target — "Interactive" footer — `Receipt: accepted delivery-status:main:1d6139d`), `-2.png`, `-3.png`, `-result.png` (`Result: completed — 1 paused (harness-install…)`, next-command blocks), `evidence/step-2-3-local-delivery-status.png` (footer "Local", same receipt). The "Read skill · agento" label is absent per the documented deviation (see Plan vs implementation) |
| 10 | Gates: full suite, five guard replays, extension unit tests, Shellcheck zero findings vs baseline | pass | Full suite `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → exit 0, see "Gate run" below; guard replays g1–g5 each exit 0 (run by me); `cd extension && npm run test:unit` → 167 pass / 0 fail; `shellcheck` not installed locally (`command -v` empty) — CI run `39044069911` on head `b5cfb30`: steps "Unit tests", "Shellcheck", and all four "Guard fixture replay" variants `success`; the Shellcheck step runs `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` under `bash -e`, so success = zero findings, matching the `main` `1d6139d` baseline. No shell script is touched by this diff |
| 11 | Clean handoff: both halves clean; real `~/.copilot/skills/agento` in the chosen state | pass | both `git status --porcelain --untracked-files=all` empty; link `installed` → `/home/david/DP/agento-plugin/skills/agento`, matching 2.3's recorded "keep" choice |

**Gate run (Reviewer, 2026-10-17):** `node --test 'scripts/**/*.test.mjs'
'tests/**/*.test.mjs'` → exit 0, 560 tests, 560 pass, 0 fail (plan baseline 554 on
`main` `1d6139d`; +6 = the new harness tests).

## Plan vs implementation

- **Pure helpers in a separate module.** The plan put `linkType` and the link-state
  function in `scripts/agento.mjs`; the Builder placed them in a new
  `scripts/harness.mjs` (imported by the CLI and the tests). Justified: `agento.mjs`
  dispatches on import, so a pure function cannot be unit-tested from it without
  spawning. The module was added to `copy-cli.mjs` and the bundle test, so the
  byte-copy invariant holds. Undocumented in plan.md but recorded here.
- **Step 2.1 deviation (documented on the roadmap line).** The plan's risk said to
  pause `blocked:` if the loaded clone lacked the router; the Builder instead
  fast-forwarded the user's clean `/home/david/DP/agento-plugin` `main`
  `15e67eb..1d6139d`. A fast-forward of a clean primary clone to `origin/main` is
  CLI work within §1, nothing was rewritten, and the user confirmed it; acceptable,
  noted as a minor deviation.
- **Step 2.3 verify text amended (dated).** "Read skill · agento" does not render in
  VS Code 1.141.0 / Copilot Chat 0.69.0; the router read shows as "Reviewed SKILL.md
  and checked delivery-status.md". The receipt and result line — the routing proof —
  are in the screenshots, and the observation is recorded in
  `docs/copilot-harness.md` "Router skill". Accepted.
- **Scope discipline.** Nothing beyond the plan's file list changed:
  `scripts/agento.mjs`, `scripts/harness.mjs` (new), `scripts/agento.test.mjs`,
  `extension/cli/*` (copy), `extension/scripts/copy-cli.mjs`,
  `tests/extension-bundle.test.mjs`, `docs/copilot-harness.md`, `AGENTS.md`. No
  hook, prompt, agent, command, or extension source change.

## Roadmap audit

Every ticked box spot-checked against the codebase and my own runs:

- 1.1–1.3: tests and implementation present and green (full suite); `--force` in
  `parseArgs`; usage header line present; `LOCAL_DOCTOR_CHECKS` gains `harness`;
  `CAPABILITY_CHECKS` unchanged. Confirmed.
- 1.4: bundle byte-identical (`cmp`), extension unit tests 167/167. Confirmed.
- 1.5: `ln -s` gone from the docs; AGENTS.md updated. Confirmed.
- 2.1–2.2: re-ran `harness status`, `harness install` (worktree refusal), `doctor`
  against the real `~/.copilot/skills`; outputs match the recorded ones. Confirmed.
- 2.3 (manual): five linked evidence files exist under `evidence/` and were viewed;
  the user's keep choice is recorded on the line. Confirmed (one minor evidence gap,
  see Findings).
- 2.4, 3.3: link state `installed` matches the keep choice; both halves clean.
  Confirmed.
- 3.1–3.2: pass counts reproduced (560/560, 167/167, g1–g5 = 0); CI run
  `39044069911` on `b5cfb30` green including Shellcheck. Confirmed.

No falsely ticked boxes; no steps added; no repairs made.

## Findings

Ordered by severity; none above minor.

1. **Minor — Copilot evidence does not show the expanded step list.** The roadmap
   line for 2.3 says the first expanded step read "Reviewed SKILL.md and checked
   delivery-status.md", but all four Copilot screenshots show the collapsed
   "Completed 10 steps" header. The amended criterion (receipt + result line) is
   fully evidenced, so this does not affect the verdict; a future live check should
   capture the expanded step.
2. **Minor — `--force` is silently accepted on an already-`installed` link.**
   `harness install --force` when `state === "installed"` returns `changed: false`
   without noting the flag was unnecessary (`scripts/agento.mjs` `case "harness"`).
   Harmless; a `message` would be friendlier.
3. **Info — environment, not code.** `doctor --plugin-root /home/david/DP/agento-plugin`
   is overall `warn` because of the pre-existing `model-profile` check ("the git
   filter's copied script in …/agento-plugin/.git/agento is missing or older than
   this CLI"); the `harness` check itself is `ok`. Unrelated to this delivery.
4. **Info — security review.** The only filesystem mutations are `fs.unlinkSync` on
   a path `lstat` just reported as a symlink, `fs.mkdirSync` of the skills directory,
   and `fs.symlinkSync`; real directories and files are never removed, and tests
   assert it. No secrets are read or printed. Paths come from `--plugin-root`,
   `AGENTO_COPILOT_SKILLS_DIR`, or `os.homedir()` only.

## Follow-ups

- `harness-docs` (planned initiative member): README/CHANGELOG/install docs for the
  `harness` subcommand and the Local takeover, plus the "Read skill · agento" label
  observation now recorded in `docs/copilot-harness.md`.
- Consider a `message` on `harness install --force` when the link is already
  `installed` (finding 2).
- Capture the expanded Copilot step list in the next live router check so the
  "Reviewed SKILL.md…" rendering is photographed (finding 1).
