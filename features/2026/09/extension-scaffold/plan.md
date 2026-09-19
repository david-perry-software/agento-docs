# Extension scaffold: the `extension/` package, bundled CLI, client, and refresh scheduler

## Problem

The `agento-extension` initiative
([breakdown](../../../../initiatives/2026/09/agento-extension/breakdown.md), member
`### extension-scaffold`) needs a VS Code extension under `extension/` before any tree
view, panel, or dispatcher can exist. Today the repository has no `extension/`
directory, no TypeScript, no `node_modules`, and no way to run the Agento CLI from
inside an extension host. This member delivers the foundation every wave-2 member
builds on: the package manifest with the "Agento" view container, a plain `tsc`
build, a build step that copies the four CLI modules into `extension/cli/`, a
`CliClient` that spawns the bundled CLI and parses its JSON, a debounced refresh
scheduler fed by file-system watchers, `@vscode/vsce` packaging, an activation test
with `@vscode/test-electron`, and the two repository-level guards the brief demands —
a byte-compare test that fails when the bundled copy diverges from `scripts/`, and a
three-way version lockstep assertion across `extension/package.json`, `package.json`,
and `.claude-plugin/plugin.json`. The user-visible surface after this member is an
empty "Agento" activity-bar container with a welcome view, two commands
(`Agento: Refresh`, `Agento: Show Output`), and an output channel that logs the CLI
calls the scheduler triggers; nothing renders delivery state yet.

## Decisions

- **Dependency install.** Q: Should the Builder be allowed to run `npm install` inside
  `extension/` (creating `extension/package-lock.json` and a gitignored
  `extension/node_modules/`)? The root package has no dependencies today. A: "Yes,
  extension/ owns its own package.json + lockfile" (root `package.json` stays
  dependency-free; `extension/` is its own npm package with devDependencies only).
- **Electron test scope.** Q: How should the `@vscode/test-electron` activation test be
  run and gated in this delivery? A: "Separate npm script, Builder runs locally
  (xvfb-run if headless), excluded from root `node --test` glob" (matches breakdown
  Q4; the roadmap verify step records the local run output as evidence).
- **Version lockstep.** Q: The scaffold must put `extension/package.json` in lockstep
  with `package.json` and `.claude-plugin/plugin.json` (currently 0.5.2). Confirm: no
  version bump in this delivery, all three stay 0.5.2? A: "Yes, all three stay at the
  current version" (the bump happens in `extension-acceptance` per initiative Q1).
- **Bundle copy trigger.** Q: When should `extension/cli/` (the bundled copy of the four
  CLI modules) be regenerated, and should the copy be committed to git? A: "Copy on
  `npm run build` (prebuild step), committed to git, byte-compare test guards drift"
  (a stale commit fails the default root test command).
- **Minimum VS Code version.** Q: Which `engines.vscode` should the scaffold pin? A:
  "Match the installed VS Code (1.132.0) as `^1.132.0`" (tightest pin; later members
  can lower it if needed).

## Research

Skills consulted: none — no matching domain (the repository has no `.agents/skills/`
directory and `AGENTS.md` has no `## Agento` skills table).

**Lint baseline (policy §5).** Run 2026-09-18 in the product half at `8bf5a50`
(`origin/main`):

- `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` → exit 0, no findings.
- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → exit 0, `# tests 210`,
  `# pass 210`, `# fail 0`.

Overlap decision: the baseline is green, so there is nothing to clean up. The full
gate is the repository's own commands plus the new `extension/` commands this plan
adds; no scoped gate is needed. The Builder reruns the full-repository commands at
every integration step and the final gate must show 0 failures with a total above
210 (the new `tests/extension-bundle.test.mjs` adds tests).

**Concurrent deliveries.** `gh pr list --state open` in both the product and the
companion repository returned `[]` on 2026-09-18; no open delivery branch overlaps
this plan's files. `feature/extension-scaffold` existed in neither clone nor origin
before this session reserved it.

**Repository facts the design rests on.**

- Root `package.json` L1–16: `"version": "0.5.2"`, `"type": "module"`, `scripts.test` = `node --test 'scripts/**/*.test.mjs'
  'tests/**/*.test.mjs'`, `scripts.lint:hooks` = shellcheck, `engines.node >=20`, no
  `dependencies`/`devDependencies`. `.claude-plugin/plugin.json` L4 `"version":
  "0.5.2"`. Both globs exclude `extension/`, so extension tests never run under the
  root command unless placed in `tests/`.
- `tests/customizations.test.mjs` L447–471: the test "plugin manifest uses suffix-less
  command names…" already asserts `plugin.version === pkg.version` (L471). The
  three-way assertion joins it there. L373–383 `guidanceFiles` is a fixed list
  (README, AGENTS.md, agents, prompts, instructions, `commands/*.md`, `docs/*.md`,
  `templates/*.md`) scanned for bare `/<name>` command spellings (L386–393) — the
  AGENTS.md edits must use `/agento <name>` forms; `extension/README.md` is not
  scanned but follows the same rule.
- `.github/workflows/ci.yml`: runs the root test command, shellcheck, and the guard
  replay on `ubuntu-24.04` / Node 22. It does not run `npm install` anywhere, so
  `tests/extension-bundle.test.mjs` must need no dependencies and must not require a
  prior extension build — it compares committed files only.
- `.gitignore`: `node_modules/`, `.vscode/`, `.env*`, `*.log`. `node_modules/` already
  matches `extension/node_modules/`; `extension/out/`, `extension/.vscode-test/`, and
  `*.vsix` must be added.
- `scripts/agento.mjs` imports only `./agento-config.mjs`,
  `./delivery-roadmap-resolver.mjs`, `./session-state.mjs` (L29–34);
  `delivery-roadmap-resolver.mjs` imports `./agento-config.mjs` and
  `./session-state.mjs` (L4–5); the other two import only `node:*`. The four files are
  therefore a closed set — copying them side by side into `extension/cli/` keeps every
  relative import valid. `--root <dir>` (L20–21, L58) selects the checkout; the CLI
  always prints one JSON document with exit 0/1/3 (L2–5), so the client parses stdout
  regardless of exit code.
- `PLUGIN_ROOT` (L37) is `path.dirname(path.dirname(import.meta.url))`; for the bundled
  copy that is `extension/`. Its uses: `next`'s `dispatchFor()` (L976–989) returns
  `{ prompt, agent: null }` when the command file is missing — no throw; `migrate`
  (L888) reads `templates/agento.json` — the extension never calls `migrate`;
  `config.pluginRoot` (L998) is informational. Documented as a known property of the
  bundle, not a defect.
- `scripts/agento.test.mjs` L18–43 (`makeRepo`, `cloneWithOrigin`) is the pattern for
  a throwaway git repo with a bare origin; the extension's node:test integration
  test for `CliClient` builds the same kind of fixture in `os.tmpdir()` and runs the
  bundled CLI against it.
- `scripts/hooks/session-context.sh` L17 derives `AGENTO_ROOT` from the hook's own
  location; the extension does not depend on the hooks.
- `CHANGELOG.md` L3 already has `## Unreleased` (added by `cli-dashboard-json`); this
  member appends an entry there, no version bump.
- Toolchain on the planning machine (2026-09-18): `node v22.22.3`, `npm 10.9.8`,
  `code 1.132.0`, `DISPLAY=:0` (a display is present, so `@vscode/test-electron` can
  run without `xvfb-run`; `xvfb-run` is not installed and is only the headless
  fallback).
- `agento.mjs doctor --for new-feature` and `--for continue`: every check `ok`
  (node, git-remote, gh, code, python3, worktrees-dir, artifact-repo).

**VS Code API facts used.**

- Contributed views activate their extension implicitly; `activationEvents:
  ["onStartupFinished"]` additionally activates the extension in every window so the
  watchers and the output channel exist before a view is opened (later members add
  the status bar item, which needs this).
- In the extension host `process.execPath` is the Electron binary, not Node; the
  client spawns the `node` executable named by the `agento.nodePath` setting (default
  `"node"`, resolved via `PATH`).
- `vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(base, glob))`
  accepts a base `Uri` outside the workspace folders; the scheduler uses it for a
  companion checkout that is not itself a workspace folder and for the real git
  directory of a worktree (where `.git` is a file containing `gitdir: <path>`).
- `@vscode/test-electron`'s `runTests({ extensionDevelopmentPath, extensionTestsPath,
  launchArgs, version })` loads `extensionTestsPath` and awaits its exported
  `run(): Promise<void>`; a plain `assert`-based `run()` needs no mocha.
- `@vscode/vsce package` runs the `vscode:prepublish` script, refuses to continue
  without a `LICENSE` file in non-interactive mode unless `--skip-license` is given,
  and `--no-dependencies` skips the `npm list` production-dependency walk (correct
  here: there are none).
- `@vscode/vsce`'s `LicenseProcessor` appends `.txt` when an extension-root license
  has no extension, so the generated `extension/LICENSE` source is intentionally
  archived as `extension/LICENSE.txt`; the package assertion compares their bytes.

## Approach

Everything new lives under `extension/` except the two repository-level guards and
the small doc/ignore edits listed at the end. No file under `scripts/`, `.github/`,
`commands/`, `hooks/`, or `templates/` changes.

### 1. Package layout

```
extension/
  package.json          name agento-dashboard, publisher david-perry-software, version 0.5.2,
                        engines.vscode ^1.132.0, main ./out/extension.js,
                        activationEvents [onStartupFinished], no dependencies,
                        devDependencies: typescript, @types/vscode, @types/node,
                        @vscode/vsce, @vscode/test-electron
  package-lock.json     committed
  tsconfig.json         strict, module Node16, target ES2022, rootDir src, outDir out,
                        sourceMap, include src/**/*
  .vscodeignore         src/**, test/**, out/test/**, node_modules/**, .vscode-test/**,
                        tsconfig.json, scripts/**, **/*.map, package-lock.json
  README.md             what the extension is (dashboard/launcher/router over the CLI),
                        what the scaffold shows, build/test/package commands
  LICENSE               byte copy of ../LICENSE (written by the copy step)
  scripts/copy-cli.mjs  copies ../scripts/{agento,agento-config,session-state,
                        delivery-roadmap-resolver}.mjs → cli/ and ../LICENSE → LICENSE;
                        removes any other file in cli/; the only writer of cli/
  scripts/assert-vsix.mjs  checks packaged runtime files and exclusions, including
                          byte-identical extension/LICENSE.txt license content
  cli/                  the four bundled modules, committed
  src/extension.ts      activate/deactivate; exports the API { client, scheduler, output }
  src/cliClient.ts      CliClient + pure helpers buildCliArgs, parseCliOutput
  src/refreshScheduler.ts  RefreshScheduler (pure debounce, injectable timers)
  src/watchers.ts       createWatchers(folders, companionRoot, gitDirs) → Disposable[]
  src/gitDir.ts         resolveGitDir(folder): reads .git file or dir → { gitDir, commonDir }
  test/unit/*.test.ts   node:test suites for the pure parts + one CLI integration test
  test/electron/runTest.ts   @vscode/test-electron launcher (version 1.132.0, fixture workspace)
  test/electron/suite.ts     exported run(): activation assertions
```

`package.json` scripts: `copy-cli` (`node scripts/copy-cli.mjs`), `build` (`npm run
copy-cli && tsc -p ./`), `watch` (`tsc -w -p ./`), `typecheck` (`tsc --noEmit -p
./`), `test:unit` (`npm run build && node --test 'out/test/unit/**/*.test.js'`),
`test:electron` (`npm run build && node out/test/electron/runTest.js`), `test`
(`npm run test:unit && npm run test:electron`), `package` (`vsce package
--no-dependencies && node scripts/assert-vsix.mjs`), `vscode:prepublish` (`npm run
build`).

Contributions: `viewsContainers.activitybar` `agento` (title "Agento", icon
`$(checklist)` via a codicon-referencing SVG or `media/agento.svg`), `views.agento`
one view `agento.overview` (name "Overview"), `viewsWelcome` for `agento.overview`
("Agento reads delivery state from the bundled CLI. Views arrive in later members.
[Refresh](command:agento.refresh) · [Show output](command:agento.showOutput)"),
`commands` `agento.refresh` ("Agento: Refresh") and `agento.showOutput` ("Agento:
Show Output"), `configuration` `agento.nodePath` (string, default `"node"`) and
`agento.refreshDebounceMs` (number, default 3000, minimum 3000 — the brief's "no
polling faster than a few seconds" is enforced by clamping, never lowered).

### 2. `CliClient`

```ts
export interface CliResult { code: number; json: unknown; stderr: string }
export function buildCliArgs(cliPath: string, args: string[], root: string): string[]
  // [cliPath, ...args, "--root", root]; rejects args containing "--root"
export function parseCliOutput(stdout: string): unknown  // JSON.parse or throws CliParseError with the first 200 chars
export class CliClient {
  constructor(opts: { nodePath: string; cliPath: string; output: vscode.OutputChannel; timeoutMs?: number })
  run(args: string[], root: string): Promise<CliResult>
}
```

`run` uses `child_process.execFile(nodePath, buildCliArgs(...), { cwd: root, timeout,
maxBuffer: 16 MiB, env: process.env })`, resolves for exit codes 0, 1, and 3 (the CLI
prints JSON on all three), logs one line per call to the output channel (`cli:
<args> → exit <code> in <ms> ms`), and rejects with a `CliError` naming the exit code
and stderr only when stdout is not JSON or the process could not be spawned (e.g.
`node` missing — the message says to set `agento.nodePath`). The bundled CLI path is
`path.join(context.extensionPath, "cli", "agento.mjs")`. Nothing is interpreted:
callers receive the parsed JSON as-is.

### 3. `RefreshScheduler`

Pure class with an injectable `setTimeout`/`clearTimeout` pair: `schedule(reason)`
records the reason and (re)arms a trailing debounce of `max(3000,
agento.refreshDebounceMs)` ms; when it fires, `onDidRefresh` emits `{ reasons:
string[] }` once. `refreshNow(reason)` cancels the pending timer and emits
immediately (bound to `agento.refresh`). `dispose()` clears the timer. No interval,
no polling.

### 4. Watchers

`createWatchers({ folders, extraRoots, gitDirs, onEvent })` creates, per root,
`vscode.workspace.createFileSystemWatcher(new RelativePattern(root, "**/roadmap.md"))`
and the same for `**/review.md`; per resolved git directory, watchers for `HEAD` and
`refs/**` (RelativePattern with the git dir as base — for a worktree, `resolveGitDir`
reads the `.git` file, watches that `gitdir` for `HEAD` and the `commondir` for
`refs/**`, so branch pushes and merges in the shared repository trigger a refresh).
`extraRoots` is the companion checkout when it is not already a workspace folder: on
activation the extension runs `config` once per workspace folder and, when
`artifactsRoot !== root`, adds `artifactsRoot` (and its git dir) to the watched set.
Create/change/delete all call `scheduler.schedule("<kind> <path>")`. The watcher set
is rebuilt on `workspace.onDidChangeWorkspaceFolders`.

### 5. Activation

`activate(context)`: create the output channel "Agento"; read settings; construct
`CliClient` and `RefreshScheduler`; register `agento.refresh` and `agento.showOutput`;
create watchers; subscribe to `onDidRefresh` with a handler that runs `session` for
the first workspace folder and logs `session: role=<role> lifecycle=<lifecycle>
delivery=<slug|none>` (or the CLI error) — this is the scaffold's only consumer and
proves the pipeline end to end; call `scheduler.refreshNow("activate")`. Return the
API `{ client, scheduler, output }` so the electron test and later members'
tests can reach them. `deactivate()` disposes through `context.subscriptions`.

### 6. Tests

- `extension/test/unit/cliClient.test.ts`: `buildCliArgs` (order, `--root` rejection),
  `parseCliOutput` (valid JSON; non-JSON throws with excerpt), and an integration
  test that creates a temp git repo with `.github/agento.json`, spawns the bundled
  `cli/agento.mjs` through a `CliClient` built with a stub output channel, and asserts
  `session` → `code 0`, `json.role === "primary"`, and `find nope` → `code 3`,
  `json.status === "missing"` (exit 3 still resolves).
- `extension/test/unit/refreshScheduler.test.ts`: fake timers; three `schedule` calls
  within the window emit once with all three reasons; a `refreshDebounceMs` of 500
  is clamped to 3000; `refreshNow` cancels the pending timer; `dispose` never emits.
- `extension/test/unit/gitDir.test.ts`: a normal repo (`.git` directory) and a
  worktree (`.git` file) created with real `git` in a temp dir resolve to the right
  `gitDir`/`commonDir`.
- `extension/test/electron/suite.ts`: opens `extension/test/fixtures/workspace`
  (a committed minimal repo layout with `.github/agento.json` — a git repo is
  initialised into it at test start under `os.tmpdir()` copy so nothing in the source
  tree is a nested git repo); asserts the extension is present and `isActive` after
  `activate()`, `agento.refresh` and `agento.showOutput` are in
  `commands.getCommands(true)`, the exported `client.run(["session"], fixture)`
  returns `code 0` with a string `role`, and `scheduler.schedule` followed by fake
  clock is not needed — it asserts one `onDidRefresh` event arrives within
  `refreshDebounceMs + 2000` ms after touching `roadmap.md` in the fixture.
- `tests/extension-bundle.test.mjs` (root, node:test, no dependencies): the set of
  files in `extension/cli/` equals exactly the four names; each is byte-identical
  (`Buffer.equals`) to `scripts/<name>`; `extension/LICENSE` equals `LICENSE`;
  `extension/package.json` has no `dependencies` key (or an empty object), its
  `engines.vscode` matches `/^\^1\.\d+\.\d+$/`, and `extension/scripts/copy-cli.mjs`
  is the only file mentioning `cli/` under `extension/scripts/`.
- `tests/customizations.test.mjs` L471 extended: read `extension/package.json` and
  assert its `version` equals `pkg.version` too, with a message naming all three
  files.

### 7. Repository edits outside `extension/`

- `.gitignore`: add `extension/out/`, `extension/.vscode-test/`, `*.vsix`.
- `AGENTS.md`: layout bullet for `extension/` (dashboard/launcher/router over the
  CLI; `extension/cli/` is a generated byte copy of `scripts/` — edit `scripts/`, then
  `npm run copy-cli`), and `## Commands` gains `Extension build`, `Extension unit
  tests`, `Extension activation test`, and `Extension package` lines (each `cd
  extension && npm run …`), plus `Extension install` (`cd extension && npm ci`).
- `CHANGELOG.md` `## Unreleased`: one **Added** entry for the scaffold.
- No `docs/` changes: `docs/extension.md`, README, and `docs/architecture.md`
  sections belong to `extension-acceptance` per the breakdown.

## Risks

- **`@types/vscode` for 1.132 may not be published.** `vsce` refuses to package when
  `@types/vscode` is newer than `engines.vscode`, and `npm install` fails when the
  requested `@types/vscode` range has no match. Mitigation: the Builder installs the
  newest `@types/vscode` whose major.minor ≤ 1.132 and, if that is lower than 1.132,
  sets `engines.vscode` to `^1.<that minor>.0` and records the actual value on the
  roadmap step with `(added <date>)` — the decision "match the installed VS Code" is
  honoured as "the highest available that the installed VS Code satisfies".
- **`@vscode/test-electron` needs a download and a display.** The planning machine
  has `DISPLAY=:0`; headless machines need `xvfb-run -a npm run test:electron`.
  Mitigation: CI is out of scope (breakdown Q4); the electron script is separate
  from the root test command; the download lands in the gitignored
  `extension/.vscode-test/`; the Builder records the local run's summary output on
  the roadmap step as evidence.
- **Bundled `PLUGIN_ROOT` differs from the plugin's.** `next.dispatch` from the
  bundled copy names `extension/commands/<name>.md`, which does not exist. Impact:
  none for the extension (it never follows dispatch files); documented in
  `extension/README.md` so later members do not rely on `dispatch` from the bundle.
- **Watching a worktree's git directory outside the workspace.** Recursive watchers
  with a base outside the workspace folders are more expensive and may be limited on
  some platforms. Mitigation: only `HEAD` (non-recursive) and `refs/**` under the
  resolved git/common dir are watched; the ≥ 3 s debounce absorbs bursts; a watcher
  that fails to create is logged and skipped, never fatal.
- **Node not on the extension host's `PATH`.** Mitigation: `agento.nodePath` setting;
  the client's spawn error names it; the electron test runs where `node` is on `PATH`.
- **Root CI has no `npm install`.** `tests/extension-bundle.test.mjs` reads committed
  files only and never imports from `extension/`; the customizations test reads
  `extension/package.json` as JSON. Neither needs `extension/node_modules/` or a
  prior build, so `.github/workflows/ci.yml` stays green unchanged; the final gate
  confirms it by running the root test command from a fresh `git worktree add
  --detach <tmp> HEAD` checkout of the branch (no `node_modules/`, no `out/`).
- **Drift between `scripts/` and `extension/cli/`.** Every later change to
  `scripts/*.mjs` must be followed by `npm run copy-cli`; the byte-compare test makes
  a forgotten copy a red root test. The Builder agent's own gate runs the root test
  command, so the guard is exercised from this member onwards.

## Out of scope

- Any tree view, panel, status bar item, or command dispatch (`deliveries-tree`,
  `initiatives-tree`, `session-doctor-panel`, `command-dispatch`, `new-plan-flow`).
- Installing the VSIX into the user's VS Code, Marketplace publishing, a version
  bump, `docs/extension.md`, README and `docs/architecture.md` sections, and the
  end-to-end fixture suite (`extension-acceptance`).
- CI wiring for the electron tests (breakdown Q4).
- ESLint/Prettier: `tsc --strict` is the only static check for TypeScript in this
  member; a linter is a follow-up if later members want one.
- Any change to `scripts/`, hooks, prompts, agents, or instructions.

## Acceptance checklist

- [ ] `extension/package.json` exists with `"version": "0.5.2"`, `"publisher"`,
  `"engines": { "vscode": "^1.<minor>.0" }`, `"main": "./out/extension.js"`, no
  `dependencies`, and exactly the devDependencies `typescript`, `@types/vscode`,
  `@types/node`, `@vscode/vsce`, `@vscode/test-electron`; `extension/package-lock.json`
  is committed — verify: `node -e` JSON read of the three fields; `git ls-files
  extension/package-lock.json` non-empty.
- [ ] `cd extension && npm ci && npm run build` exits 0 and produces
  `extension/out/extension.js`; `npm run typecheck` exits 0 — verify: command exit
  codes and `test -f extension/out/extension.js`.
- [ ] `extension/cli/` contains exactly `agento.mjs`, `agento-config.mjs`,
  `session-state.mjs`, `delivery-roadmap-resolver.mjs`, each byte-identical to
  `scripts/<name>`; `tests/extension-bundle.test.mjs` passes and fails when one byte
  of `extension/cli/agento.mjs` is changed (demonstrated once, then reverted) —
  verify: `node --test tests/extension-bundle.test.mjs` before/after a temporary edit.
- [ ] The three versions are asserted equal: editing `extension/package.json` to
  `0.5.3` makes `node --test tests/customizations.test.mjs` fail with a message naming
  the three files (demonstrated once, then reverted) — verify: the failing run's
  assertion message.
- [ ] `CliClient.run(["session"], <fixture repo>)` resolves with `code 0` and JSON
  containing `role`; `run(["find","nope"], …)` resolves with `code 3` and `status:
  "missing"`; non-JSON stdout rejects with `CliParseError` — verify: `cd extension &&
  npm run test:unit` passes and its output lists those tests.
- [ ] `RefreshScheduler` coalesces events into one `onDidRefresh` per debounce window,
  clamps the debounce to ≥ 3000 ms, and never emits after `dispose()` — verify:
  `npm run test:unit` output lists the scheduler tests as passing.
- [ ] `cd extension && npm run test:electron` passes locally: the extension activates
  in a fixture workspace, registers `agento.refresh` and `agento.showOutput`, the
  exported client runs `session` successfully, and touching `roadmap.md` in the
  fixture produces one refresh within the debounce window — verify: the run's
  summary line on the roadmap step.
- [ ] `cd extension && npm run package` exits 0 and the VSIX lists
  `extension/cli/agento.mjs`, `extension/cli/agento-config.mjs`,
  `extension/cli/session-state.mjs`, `extension/cli/delivery-roadmap-resolver.mjs`,
  every compiled runtime module, `extension/package.json`, and VSCE's canonical
  `extension/LICENSE.txt` entry byte-identical to the generated `extension/LICENSE`,
  with no `extension/src/`, `extension/test/`, `extension/node_modules/`, source-map,
  or duplicate `extension/out/src/` entries — verify: the automated assertion run by
  `npm run package`.
- [ ] `AGENTS.md` `## Commands` lists the extension's install, build, unit-test,
  activation-test, and package commands and the layout section has an `extension/`
  bullet; `CHANGELOG.md` `## Unreleased` has the scaffold entry; `.gitignore`
  ignores `extension/out/`, `extension/.vscode-test/`, `*.vsix` — verify: `grep`
  for each string; `node --test tests/customizations.test.mjs` passes.
- [ ] Repository gate unchanged and green: `shellcheck scripts/hooks/*.sh
  scripts/wait-for-checks.sh` exit 0; `node --test 'scripts/**/*.test.mjs'
  'tests/**/*.test.mjs'` 0 failures with total > 210; `git diff --stat origin/main --
  scripts .github commands hooks templates` is empty — verify: command output at the
  final gate.
- [ ] `git status --porcelain` in the product half is clean after `npm run build`
  and `npm run copy-cli` (the committed `extension/cli/` and `extension/LICENSE` are
  current) — verify: empty output.
