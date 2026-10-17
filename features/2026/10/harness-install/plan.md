# Harness install: `agento.mjs harness install|status|uninstall` and a doctor `harness` check

## Problem

The `/agento <name> [args]` router (`skills/agento/SKILL.md`, shipped by
`agento-router-skill`) only works in a Copilot session once it is linked as the
**user-level** skill `~/.copilot/skills/agento`. Today that link is a by-hand step
(`ln -s <clone>/skills/agento ~/.copilot/skills/agento`, `docs/copilot-harness.md`
"Router skill"), nothing reports whether it is present or which clone it points at,
and the user's machine currently has no link at all (`~/.copilot/skills/` holds only
`use-railway`, checked 2026-10-17). Two plugin checkouts (`agento`, `agento-plugin`)
could each claim it.

This feature adds the CLI side: `agento.mjs harness install|status|uninstall`, which
creates, reports, and removes that link for one explicit plugin root, plus an
informational doctor `harness` check that the Session & Doctor panel shows through
its existing rendering.

It is the `harness-install` member of the `copilot-harness` initiative
([breakdown](../../../../initiatives/2026/10/copilot-harness/breakdown.md), block
`### harness-install`); its requirement `agento-router-skill` is complete.

## Decisions

Clarifying questions asked with the ask-questions tool on 2026-10-17 (recommended
option listed first in each; every answer was the recommended option):

- **Q: What should the doctor `harness` check report when ~/.copilot/skills/agento is
  absent?** A: "warn (informational, not in any command's Needs)" (recommended) —
  like `model-profile`/`hook-wiring`: shown in doctor and the Session & Doctor panel,
  never blocks a preflight.
- **Q: How should `harness install` treat a foreign ~/.copilot/skills/agento (other
  clone, e.g. agento-plugin, or a real directory) and a run from a linked
  worktree?** A: "Refuse foreign entries unless --force (symlinks only; never delete
  a real directory); from a linked worktree, refuse and name the primary clone"
  (recommended).
- **Q: With the link installed, Local also routes /agento through the router and
  loses prompt model switching. How should this member handle it?** A: "Add
  `harness uninstall` (removes only our own link) and have install/status/doctor
  detail name the Local takeover; full docs stay in harness-docs" (recommended).
- **Q: Which platforms must `harness install` support?** A: "Linux and macOS
  (symlink); on Windows use a directory junction, covered by a unit test of the type
  argument only" (recommended).
- **Q: Beyond node:test coverage, should the roadmap include a live check in VS
  Code?** A: "Yes: one (manual) step — you open a Copilot session after `harness
  install` and confirm `/agento delivery-status` prints its receipt, plus the same in
  Local, with screenshots" (recommended).

Carried from the initiative breakdown: CLI + doctor check only — the extension only
surfaces the doctor result (no install action); edit `scripts/`, then
`cd extension && npm run copy-cli`; every member verifies Local too.

## Research

Skills consulted: agent-customization (built-in VS Code skill: user-level skill
locations, `~/.copilot/skills`). The Agento repository has no `.agents/skills/`
directory and its AGENTS.md has no skills table, so no project skill applies
(verified 2026-10-17 on `main` `1d6139d`).

Harness facts (`docs/copilot-harness.md`, VS Code 1.141.0 / Copilot Chat 0.69.0):

- In Copilot, a symlinked user skill `~/.copilot/skills/agento` resolves as
  `/agento` with the full argument tail; plugin prompt commands do not load there and
  the plugin hook's `${CLAUDE_PLUGIN_ROOT}` path did not resolve ("Skill resolution
  with arguments", "Plugin loading").
- **Local takeover** ("Router skill", Phase 2): with the link installed, Local also
  routes `/agento <name>` through the router instead of the plugin prompt command.
  Builder/Reviewer pins survive (`runSubagent` + `subagentModel`); lost are the
  command file's profile-applied prompt `model:` and the agent-mode/pin switch for
  Planner, Architect, Mechanic, Autopilot (inline). Recorded as a known gap for this
  member and `harness-docs` (`agento-router-skill` plan `## Risks`). No Copilot-only
  skill location is known, so this member reports the takeover rather than avoiding
  it.
- The router finds its clone as the `realpath` of the skill directory, two levels up
  (`skills/agento/SKILL.md` "Root discovery"), so the link must point at
  `<clone>/skills/agento` itself, not a copy.

Agento surfaces (code, `main` `1d6139d`):

- `scripts/agento.mjs`:
  - usage header (L1–L36) lists every subcommand; `usage()` (L63) prints it on a
    usage error; `parseArgs` (L91) has `--plugin-root` (L108) but no `--force`;
  - `PLUGIN_ROOT` (L61) is the clone the CLI runs from (a worktree path when run
    from a linked worktree; `extension/cli/` when bundled, which is why the
    extension passes `--plugin-root`: `extension/src/extension.ts` L212);
  - `DOCTOR_CHECKS` (L857–L1010): `{ status, detail, fallback }` per id; the
    informational checks `model-profile` (L944) and `hook-wiring` (L989) are not in
    `CAPABILITY_CHECKS` (L1079), so `doctor --for` / preflight never run them; the
    `model-profile` check already resolves `options.pluginRoot ?? PLUGIN_ROOT` and
    reports `ok` "no Agento plugin clone at …" when the root is not a clone;
  - `LOCAL_DOCTOR_CHECKS` (L1142) lists the checks without external probes (used by
    `dashboard`);
  - `primaryCheckoutOf(pluginRoot)` (L3645) returns the primary clone of a linked
    worktree or `null`; `models apply` uses it to refuse linked worktrees (status
    `worktree`, exit 3) — the pattern `harness install` follows;
  - `case "models"` (L4620) is the verb-dispatch pattern (`verbs` table, usage
    errors, `emit(doc, code)`);
  - `vscodeSettingsPath` (L1013) is the env-override pattern for user-level paths
    (`AGENTO_VSCODE_SETTINGS`).
- `scripts/agento.test.mjs`: `baseEnv` (L77–L84) isolates the user's config and VS
  Code settings through env overrides but not `~/.copilot`; "doctor reports nine
  checks…" (L1439) asserts the exact id list and that all are `ok` with
  `--plugin-root <temp repo>`; `byId`, `runWith`, `restrictedPath`, `okStubs` are the
  helpers.
- `tests/harness-probe/probe.mjs` `ensureSymlink` (L58–L71) is the prior art for
  refuse-foreign symlink creation (HOME from `process.env.HOME || homedir()`).
- `tests/extension-bundle.test.mjs` (L28) asserts `extension/cli/*` is a byte copy of
  `scripts/*`, so `npm run copy-cli` is required after the CLI edit.
- `extension/src/sessionDoctorModel.ts` `parseChecks` (L137) accepts any check id —
  the panel shows a new check with no extension code change.
- `scripts/session-state.mjs` `WINDOW_ROLES` covers slash commands only; `harness` is
  a CLI subcommand with no slash command, so no window role, `COMMAND_NEEDS` row, or
  prompt is added.
- Docs: `docs/copilot-harness.md` "Router skill" says "Until `harness-install`
  automates the link, install it by hand"; AGENTS.md's layout line lists the CLI
  subcommands. `docs/install.md`, `docs/commands.md`, README, CHANGELOG, and the
  version bump belong to `harness-docs`.

**Lint baseline (policy §5).** The full-repository lint is `shellcheck
scripts/hooks/*.sh scripts/wait-for-checks.sh` (AGENTS.md). On 2026-10-17 it could
not run locally: `shellcheck` is not installed (`command -v shellcheck` finds
nothing; exit 127). The authoritative baseline is CI's Shellcheck step on `main`
`1d6139d`: the `ci` run `39009435172` concluded `success` (zero findings). Unit tests on `main` `1d6139d`:
`node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` — exit 0, 554 tests, 554
pass, 0 fail (~266 s).
**Overlap decision:** none — this delivery touches no shell script, so no cleanup is
in scope; the gate is the full-repository Shellcheck (locally when installed, and the
PR's CI Shellcheck step) compared against the zero-finding baseline, plus the full
test suite, the guard replays, and the extension unit tests.

**Concurrent deliveries.** `gh pr list --state open` returned no open PRs on
2026-10-17, so no file overlap.

## Approach

Files touched (product half): `scripts/agento.mjs`, `scripts/agento.test.mjs`,
`extension/cli/agento.mjs` (via `npm run copy-cli` only), `docs/copilot-harness.md`,
`AGENTS.md` (subcommand list). No hook, prompt, command, agent, or extension source
change.

**Paths.**

- Skills dir: `AGENTO_COPILOT_SKILLS_DIR` when set, else
  `path.join(os.homedir(), ".copilot", "skills")`; link = `<skills dir>/agento`.
  `scripts/agento.test.mjs` `baseEnv` sets it to a temp dir so no test touches the
  real `~/.copilot`.
- Plugin root: `--plugin-root <dir>` or `PLUGIN_ROOT`. Expected target =
  `<clone>/skills/agento`, where `<clone>` is `primaryCheckoutOf(root) ?? root`, so a
  status/doctor run from a linked worktree compares against the primary clone.

**Link state** (one pure function, shared by the subcommand and the doctor check),
read with `lstat`/`readlink`/`realpath`:

| state | meaning |
| --- | --- |
| `absent` | nothing at the link path |
| `installed` | a symlink/junction whose `realpath` equals the expected target's `realpath` |
| `foreign` | a symlink/junction resolving elsewhere (another clone such as `agento-plugin`, a probe link) — `target` reported |
| `dangling` | a symlink whose target does not exist — `target` reported |
| `not-a-link` | a real directory or file |

**`agento.mjs harness <status|install|uninstall> [--plugin-root <dir>] [--force]`**
(new `case "harness"`, `verbs` table like `models`; `--force` added to `parseArgs`
and accepted only by `install`). Every document carries `verb`, `link`, `expected`,
`state`, `target`, `pluginRoot`, `changed`, and `localTakeover` (one sentence:
with the link installed, Local sessions also route `/agento` through the router —
Builder/Reviewer keep their pins, Planner/Architect/Mechanic/Autopilot and prompt
`model:` pins do not switch; `harness uninstall` restores the Local prompt
commands).

- `status` — always exit 0; reports the state.
- `install` — refuses (exit 3, nothing written) when: the root has no
  `skills/agento/SKILL.md` (`status: missing`); the root is a linked worktree
  (`status: worktree`, naming `primaryCheckoutOf` and the `--plugin-root` re-run);
  the path is `not-a-link` (`status: refused`, never deleted, even with `--force`);
  the path is `foreign` or `dangling` without `--force` (`status: refused`, naming
  the target and `--force`). `installed` → `ok`, `changed: false`. Otherwise
  (`absent`, or `foreign`/`dangling` with `--force` after unlinking only that link)
  it creates the parent directory and the link →
  `ok`, `changed: true`. Link type: `"junction"` on `win32`, `"dir"` elsewhere,
  from an exported pure `linkType(platform)` helper.
- `uninstall` — `installed` → unlink, `ok`, `changed: true`; `absent` → `ok`,
  `changed: false`; `foreign`/`dangling`/`not-a-link` → `status: refused`, exit 3,
  nothing removed (only our own link is ever removed).

**Doctor `harness` check** (informational: added to `DOCTOR_CHECKS` after
`hook-wiring` and to `LOCAL_DOCTOR_CHECKS`, not to `CAPABILITY_CHECKS`, so
preflight and `doctor --for` never run it):

- root has no `skills/agento/SKILL.md` → `ok`, "no Agento router skill at <root>";
- `installed` → `ok`, detail names the link, the clone, and the Local takeover;
- `absent` → `warn`, "Copilot sessions cannot run /agento …", fallback
  `agento.mjs harness install --plugin-root <clone>`;
- `foreign`/`dangling` → `warn` naming the target, fallback
  `agento.mjs harness install --force --plugin-root <clone>` (or keep the other
  clone's link);
- `not-a-link` → `warn`, fallback "move it away, then `harness install`".

**Tests (`scripts/agento.test.mjs`)** — all in temp dirs via
`AGENTO_COPILOT_SKILLS_DIR` and a temp plugin clone holding `skills/agento/SKILL.md`
and `.github/agents/`:

- `status` for each of the five states;
- `install` from absent (link created, `readlink` = expected), idempotent re-run
  (`changed: false`), foreign refused then `--force` replaces, dangling likewise,
  real directory refused even with `--force` and left intact, linked worktree
  refused naming the primary, root without the skill → `missing`; `--force` on
  `status`/`uninstall` is a usage error; unknown verb is a usage error;
- `uninstall` removes only an `installed` link; foreign/real directory refused and
  untouched; absent is a no-op;
- `linkType("win32") === "junction"`, `linkType("linux") === "dir"`,
  `linkType("darwin") === "dir"`;
- doctor: the full id list gains `harness` (ten checks; the existing test's
  `--plugin-root` temp repo has no skill, so it stays `ok`); a `harness`-specific
  test covers `ok`/`warn` per state and that `doctor --for new-feature` and
  `preflight` do not include `harness`.

**Docs:** `docs/copilot-harness.md` "Router skill" replaces the by-hand `ln -s` with
`node <clone>/scripts/agento.mjs harness install` (and names `status`/`uninstall`
and the Local takeover); AGENTS.md's CLI subcommand list adds `harness`.

**Verification:** after the CLI tests pass, the Builder runs `harness install` from
the primary-clone-equivalent root itself (CLI work, §1): `harness install` refuses
from this linked worktree, so the live link targets the plugin clone the user's VS
Code loads — `harness status` and `doctor` are checked against the real
`~/.copilot/skills`. Copilot and Local chat sessions cannot be driven by the agent's
browser tools, so the live `/agento delivery-status` checks are one `(manual)` step
with screenshots, as in `agento-router-skill`. The link is left installed only if the
user wants it (asked at that step); otherwise `harness uninstall` removes it.

## Risks

- **The live link must point at a clone that has the router.** `harness install`
  refuses linked worktrees, so the live check runs against a primary clone. The
  primary clone (`/home/david/DP/agento`) and the user's `agento-plugin` checkout
  only have `skills/agento` once `agento-router-skill` is on their branch — it is
  merged to `main`, so the Builder confirms `skills/agento/SKILL.md` exists in the
  chosen `--plugin-root` before installing, and pauses `blocked:` if the user's
  loaded clone lacks it (pull needed).
- **Two plugin checkouts (`agento`, `agento-plugin`).** Mitigation: `--plugin-root`
  is explicit and `status`/doctor report which clone the link resolves to; a link to
  the other clone is `foreign` and only `--force` replaces it.
- **Local takeover** (known, accepted in `agento-router-skill`): installing the link
  changes Local `/agento` routing and loses inline-agent model switching. Mitigation:
  every document and the doctor detail say so, and `harness uninstall` reverses it;
  full user docs in `harness-docs`.
- **Deleting user data.** Mitigation: only symlinks/junctions are ever removed —
  `not-a-link` is refused even with `--force`, and `uninstall` removes only an
  `installed` link; tests assert a real directory survives.
- **Tests touching the real `~/.copilot`.** Mitigation: `AGENTO_COPILOT_SKILLS_DIR`
  in `baseEnv`; the live step is the only one that writes the real path.
- **Windows junctions are untested on a real Windows host.** Accepted (decision 4):
  only the type argument is unit-tested.
- **Concurrent deliveries:** none open on 2026-10-17. Mitigation if that changes:
  integrate `origin/main` before every push.

## Out of scope

- An install action or new UI in the VS Code extension (it only surfaces the doctor
  result); extension dispatch in Copilot — `dispatch-copilot-harness`.
- `docs/install.md`, `docs/commands.md`, `docs/hooks.md`, README, CHANGELOG, version
  bump, and the full Local model-switch documentation — `harness-docs`.
- Avoiding the Local takeover (no Copilot-only skill location is known).
- `copilot plugin install`, plugin-skill registration in `.claude-plugin/plugin.json`,
  copying the skill instead of linking it.
- A slash command for `harness`, a `COMMAND_NEEDS` row, or a window role.

## Acceptance checklist

- [ ] `agento.mjs harness status` reports `absent`, `installed`, `foreign`,
  `dangling`, and `not-a-link` with `link`, `expected`, `target`, `pluginRoot`, and
  `localTakeover` — verified by the new state tests in `scripts/agento.test.mjs`.
- [ ] `harness install` creates the link to `<clone>/skills/agento`, is idempotent,
  refuses foreign/dangling without `--force`, refuses a real directory always (left
  intact), refuses a linked worktree naming the primary clone, and reports `missing`
  for a root without the router — verified by the new install tests.
- [ ] `harness uninstall` removes only an `installed` link and refuses everything
  else without touching it — verified by the new uninstall tests.
- [ ] `linkType` returns `junction` on `win32` and `dir` elsewhere — verified by its
  unit test.
- [ ] `doctor` lists ten checks ending in `harness`; `harness` is `warn` when the link
  is absent/foreign/dangling/not-a-link, `ok` when installed or when the root has no
  router; `doctor --for new-feature` and `preflight` do not run it — verified by the
  doctor tests.
- [ ] No test reads or writes the real `~/.copilot` — verified by
  `AGENTO_COPILOT_SKILLS_DIR` in `baseEnv` and a full-suite run with the real
  `~/.copilot/skills` listing unchanged before and after.
- [ ] `extension/cli/` is a byte copy of `scripts/` — verified by
  `tests/extension-bundle.test.mjs` and `cd extension && npm run test:unit`.
- [ ] `docs/copilot-harness.md` documents `harness install|status|uninstall` instead
  of the by-hand `ln -s`, and AGENTS.md lists `harness` — verified by reading them and
  `node --test tests/harness-probe/probe.test.mjs tests/customizations.test.mjs`.
- [ ] Live: after `harness install --plugin-root <the user's loaded clone>`,
  `harness status` reports `installed` and `doctor` shows `harness` `ok` against the
  real `~/.copilot/skills`; a Copilot session's `/agento delivery-status` shows "Read
  skill · agento" and prints the delivery-status receipt, and a Local session's
  `/agento delivery-status` prints its receipt — verified by linked screenshots under
  `evidence/`.
- [ ] Gates: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` exits 0; the
  guard replays from AGENTS.md exit 0; `cd extension && npm run test:unit` exits 0;
  full-repository Shellcheck (locally if installed, and the PR's CI Shellcheck step)
  reports zero findings, matching the baseline — results recorded on the roadmap gate
  steps.
- [ ] Clean handoff: both halves clean (`git status --porcelain
  --untracked-files=all` empty), and the real `~/.copilot/skills/agento` is in the
  state the user chose at the live step.
