# Agento Mission Control — a Copilot SDK canvas companion to the sidebar

## Problem

The Agento sidebar is a set of VS Code tree views (Deliveries, Initiatives, Session &
Doctor, Model Profiles) plus a role-colored Window banner (`extension/src/`). It
works, but it is text in rows. Lifecycle lanes, initiative dependency waves, phase
timing, and which worktree owns what are hard to take in at a glance, and an agent
working in chat cannot see or drive the sidebar at all.

VS Code 1.142 (installed here: `code --version` → `1.142.0`) added **canvases**
(Preview, `chat.canvases.enabled`). A canvas is an interactive web surface beside the
chat in Copilot-harness sessions, and both the user and the agent can see and drive
it. This feature adds **Agento Mission Control**, a canvas with five panels: delivery
kanban, initiative wave graph, timeline, worktree and window map, and live activity
feed. Its buttons dispatch only the commands the CLI already allows in the current
window. The canvas is installed by `agento.mjs harness install` and opened with a new
canonical command, `/agento mission-control`, or from an "Open Mission Control"
title action on the Deliveries view.

Seed: the session plan `65c9aec0-…/plan.md` (canvas research, architecture, and the
five confirmed decisions reproduced below).

## Decisions

Confirmed with the user before planning (seed session):

| Topic | Decision |
| --- | --- |
| Relationship | **Complement**: a new "Agento Mission Control" canvas. The sidebar stays and gains an "Open Mission Control" action. |
| Panels (v1) | Delivery kanban, initiative wave graph, timeline/Gantt, worktree and window map, live activity feed. (Doctor and Model Profiles are not in v1.) |
| Interactivity | **Read + dispatch**: buttons send only the commands the CLI lists as `allowed` for this window. The agent can call `refresh`, `focus`, `get_snapshot`, and `post_note`. No direct artifact edits. |
| Install | **Harness link**: `agento.mjs harness install` also links `~/.copilot/extensions/agento-mission-control` to the clone's canvas dir, the same way it links the router skill. `status`, `uninstall`, and doctor cover it. |
| Vehicle | **One Agento feature** via `/agento new-feature`, seeded with that plan. |

Planning clarification (2026-10-23, asked with the ask-questions tool; the user
chose the recommended option, listed first, every time):

1. **Feature slug?** Options: `mission-control-canvas` (recommended),
   `agento-mission-control`, `mission-control`. → **`mission-control-canvas`**.
2. **If the spike shows VS Code 1.142 does not follow a symlinked
   `~/.copilot/extensions/` dir?** Options: harness writes a stamped copy
   (recommended; keeps the user-scope install, and status/doctor detect a stale copy
   by its version stamp) / scaffold into the target repo's `.github/extensions/` via
   agento-init / pause the build and re-plan. → **Harness writes a stamped copy.**
3. **Live canvas verification?** (This session has no canvas tools, and
   `chat.canvases.enabled` is unset in the user's settings.) Options: a `(manual)`
   step where the user enables `chat.canvases.enabled`, opens a Copilot-harness
   session, runs `/agento mission-control`, exercises refresh, focus, and post_note
   plus a reopen, and attaches a screenshot (recommended) / the Builder writes the
   setting and the user only opens the canvas and screenshots / a
   `(manual, post-ship)` exception. → **(manual) step, user-driven.**
4. **Where is `/agento mission-control` allowed?** Options: every window role, like
   `/agento delivery-status` (recommended; opening is read-only, and dispatch buttons
   stay limited to that window's `allowed[]`) / primary and managed worktrees only.
   → **Every window role (`ANY`).**
5. **Where do the canvas node:test suites live?** Options: next to the modules
   (`canvas/**/*.test.mjs`), with that glob added to the test command in AGENTS.md,
   package.json, and CI (recommended; mirrors `scripts/`) / under `tests/canvas/`.
   → **`canvas/**/*.test.mjs`, glob added in all three places.**

## Research

Skills consulted: `create-canvas` (VS Code's built-in Copilot skill,
`/usr/share/code/resources/app/extensions/copilot/assets/prompts/skills/create-canvas/SKILL.md`).
This repository has no `.agents/skills/` and no `## Agento` skills table in AGENTS.md,
so no project skill covers the domain.

**Canvas contract (create-canvas skill, VS Code 1.142 notes, `github/awesome-copilot`
`extensions/git-worktree-explorer`):**

- An `extension.mjs` (ES module) imports `createCanvas`, `CanvasError`, and
  `joinSession` from `@github/copilot-sdk/extension`. The runtime resolves that
  module, so there is no `package.json` and no install. Never write to stdout; use
  `session.log()`.
- `open(ctx)` returns `{ title, status, url }` for an HTTP server bound to
  `127.0.0.1` on an ephemeral port. It must be idempotent per `instanceId`, and a
  reopen must reuse or safely replace the live server and reload state. `onClose`
  stops the instance's servers, but hosts may only hide a view, so nothing may
  depend on `onClose` running.
- `actions[]` are agent-callable, each with its own JSON Schema. Names must not start
  with `canvas.`. Expected failures throw `new CanvasError(code, message)`. Omit
  `inputSchema` when the canvas takes no input.
- `session.send({ prompt })` pushes a prompt into the chat, and
  `ctx.session.workingDirectory` is the session worktree.
- Private durable data lives in `extension-data/<canvas-id>/` under
  `$COPILOT_HOME` (exactly as given when non-empty) or `~/.copilot`. It is keyed by
  domain identity, written atomically (unique tmp file plus rename), and carries a
  format marker and version. Corrupt data is reported and never overwritten.
- Discovery scopes are project `.github/extensions/` and user
  `~/.copilot/extensions/` (honoring `COPILOT_HOME`). Canvases run only in **local
  Copilot-harness sessions**. Validation is `node --check`, then
  `extensions_reload`, then `list_canvas_capabilities`, then `open_canvas` with a
  stable `instanceId`, then `invoke_canvas_action`, then a reopen to confirm
  preserved state.
- This planning session has none of the canvas tools (`tool_search` finds no
  `open_canvas` or `list_canvas_capabilities`), and `~/.config/Code/User/settings.json`
  has no `chat.canvases.enabled`. Live verification is therefore a user step
  (Decision 3).

**Codebase (Explore subagent and direct reads):**

- *Data source.* `agento.mjs dashboard` (`scripts/agento.mjs:4542-4555`) returns
  `{status, session, doctor, deliveries, initiatives, metrics, timings}`. A run on
  this repo gave 76 `deliveries.items`, each with `type, slug, status, steps,
  reviewVerdict, postShipPending, lifecycle, owner, workspace, companion, allowed,
  elsewhere, pr, companionPr, initiative, nextStep`. It also gave 7
  `initiatives.details`, and `metrics.items` (76) plus `metrics.aggregate {count,
  complete, median}`. Every value the panels need is already derived by the CLI, so
  the canvas adds no CLI fields. No recorded dashboard fixture exists in the repo
  (dashboard tests are generated in `scripts/agento.test.mjs:7694-7770`).
- *Harness.* `scripts/harness.mjs` exports `linkType` (junction on win32, dir
  elsewhere) and `linkState(link, expected)`, which returns `absent | installed |
  foreign | dangling | not-a-link`. `harnessFacts` (`scripts/agento.mjs:1075-1089`)
  resolves the primary clone of a linked worktree. `copilotSkillsDir` honors
  `AGENTO_COPILOT_SKILLS_DIR` (the test override) but not `COPILOT_HOME`
  (`scripts/agento.mjs:1068-1072`). The `harness` verbs (`scripts/agento.mjs:
  4979-5019`) are idempotent: foreign or dangling targets are refused without
  `--force`, a real directory is never deleted, and install refuses a linked
  worktree (status `worktree`). They emit `{status, verb, link, expected, state,
  target, pluginRoot, changed, localTakeover}`. The doctor `harness` check is
  informational (`scripts/agento.mjs:1050-1062`). Tests:
  `scripts/agento.test.mjs:1615-1715` (about 5).
- *Window roles.* `WINDOW_ROLES` in `scripts/session-state.mjs:445-477` has
  `"delivery-status": ANY`, and `deriveAllowed` (`:427-441`) reads that table. A new
  command must also be added to `COMMAND_NEEDS` (`scripts/agento.mjs:1167+`, used by
  `doctor --for` and `preflight`), get a `.github/prompts/<name>.prompt.md` and a
  `skills/agento/commands/<name>.md` mirror, and appear in every enumerated list
  (README, `docs/commands.md`, and the extension's command lists in
  `extension/src/commandAgent.ts`, `commandActions.ts`, `dispatchRouting.ts`).
  `tests/customizations.test.mjs` enforces prompt/mirror parity, `Needs:`/`Fallback:`
  lines, and the canonical spelling.
- *Extension.* Deliveries view title actions live in `extension/package.json`
  `contributes.menus["view/title"]` with `when: view == agento.deliveries`.
  `extension/src/commandDispatcher.ts:24-157` opens chat through
  `workbench.action.chat.open` with `{query, mode, attachFiles, modelSelector}`.
  Test patterns: `extension/test/unit/{commandDispatcher,commandActions,commandAgent,dispatchRouting,extensionIntegration}.test.ts`
  and `extension/test/electron/suite.ts`. `npm run copy-cli` copies only `scripts/`,
  so `canvas/` needs no copying.
- *Role colors.* Semantic ids `agento.role.{primary,plan,build,freehand,unmanaged,unavailable}`
  are defined in `extension/src/statusStyle.ts:29-42`, with hex defaults in
  `extension/package.json:568-628` (asserted by `extension/test/unit/statusStyle.test.ts:17-23`).
  The vanilla-JS canvas cannot import TypeScript, so it carries its own constants and
  a parity test keeps them equal to the extension's.
- *Plugin staging.* `.claude-plugin/plugin.json` declares only agents and
  `hooks/hooks.json`. Nothing indicates that the host auto-loads
  `com.github.copilot/extensions/` or `extensions/` under the plugin root, and there is
  no `.vscodeignore` or `files` list. A root-level `canvas/` is the placement least
  likely to be double-loaded. The spike confirms it against the staged copy under
  `~/.config/Code/agentPlugins/`.
- *Release convention.* Each feature bumps the minor version in `package.json`,
  `.claude-plugin/plugin.json`, `extension/package.json`, and
  `extension/package-lock.json` and adds a CHANGELOG version section (for example
  `ff31328`). The release later stamps the date. The current version is 0.14.0, so
  this feature ships 0.15.0.
- *Concurrent delivery.* `gh pr list --state open` → `[]`, so there is no file
  overlap with open delivery branches.
- *Ports.* `agento.mjs ports mission-control-canvas` → `WEB_PORT 3103`,
  `API_PORT 4103`.

**Dev link (step 1.1, 2026-10-23).** The spike canvas lives at
`canvas/agento-mission-control/` in this worktree and is reachable to the local
Copilot harness through the user-scope dev link
`~/.copilot/extensions/agento-mission-control` →
`/home/david/DP/agento-worktrees/plan-20261023-204459/canvas/agento-mission-control`
(a directory symlink; `COPILOT_HOME` is `/home/david/.copilot`, so the link sits in
the user-scope discovery directory). It is removed in step 9.2; after release the
user runs `agento.mjs harness install` on the registered clone instead.

**Lint baseline (policy §5), run 2026-10-23 at `97b2889` (origin/main):**

- `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` → exit 127
  (`shellcheck: command not found`; it is not installed locally and there is no
  sudo). CI's `Shellcheck` job runs it on every PR, and CI is green on `main` at
  `97b2889` (`gh run list --branch main`), so the baseline is **0 findings** as CI
  reports it.
- `cd extension && npm ci && npm run typecheck` (`tsc --noEmit`, the extension's only
  static check) → exit 0, 0 findings.
- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → exit 0, 657/657 pass.
- There is no ESLint configuration in the repository.
- **Overlap decision:** the baseline is clean, so no cleanup is needed and **the full
  gate applies** (no scoped gate). This delivery adds no shell scripts. Shellcheck is
  verified through the PR's CI `Shellcheck` job via `scripts/wait-for-checks.sh pr
  <n>`.

**Spike findings so far (2026-10-23, the step 1.2 attempt):**

- (i) User-scope discovery follows the symlinked dir: **yes**. The Copilot host
  discovered the spike through `~/.copilot/extensions/agento-mission-control` → this
  worktree's `canvas/agento-mission-control`, with one
  `=== launch … module=/home/david/.copilot/extensions/agento-mission-control/extension.mjs ===`
  per session (extensions launch once per session). No stamped copy is needed so far.
- (ii) Startup failed on remote session setup. The host log showed
  `[extension-bootstrap] Failed to load extension: Error: Request session.resume
  failed … Failed to set up remote session.` → `exit code=1
  disposition=startup-failure`, so the canvas never registered and the canvas tools
  were absent. Fix: pass `remoteSession: "off"` to `joinSession` (the extension
  process has its sensitive env stripped, so remote-export setup during resume fails).
  Step 5.1's wiring must keep the same `remoteSession: "off"` in `joinSession`.
- (iii) `session.send` submit-vs-fill and theme variables: **resolved 2026-10-24** —
  see the "Spike results" block below.

**Spike results (2026-10-24, step 1.3; evidence `evidence/step-1-2-spike-canvas.png`):**

- (a) Canvas listed / single load: **yes — 1 entry**. `list_canvas_capabilities`
  returned canvasId `agento-mission-control`, extensionId
  `user:agento-mission-control`, displayName "Agento Mission Control", one action
  `ping`. `open_canvas` (instanceId `spike`, input `{}`) returned title
  "Mission Control (spike)", status "spike probe", url `http://127.0.0.1:38437/`.
  `invoke_canvas_action ping` returned `{"ok": true, "canvas": "agento-mission-control"}`.
  The plugin host's staged copy (`~/.config/Code/agentPlugins/file-home-david-DP-agento-plugin/`,
  latest `1a16a70f607`) has **no `canvas/` directory**, and the single
  `list_canvas_capabilities` entry confirms the root-level `canvas/` placement is
  **not double-loaded**.
- (b) Prompt dispatch: **submitted** (not only filled into the input) — clicking
  "Send test prompt" ran `/agento delivery-status` as a full chat turn the agent
  answered; the chat input stayed empty.
- (c) Theme variables: **not received** — both `--vscode-editor-background` and
  `--vscode-foreground` computed to `""` in the canvas page.
- (d) Manifest: **no `copilot-extension.json` needed** — the create-canvas skill only
  needs `extension.mjs`, and discovery through the user-scope link worked without one.

Resulting choices: install mode **link** (symlinked dir is followed, so the stamped
copy of Decision 2 is not needed — step 6.2 is obsolete); dispatch button label
**"Run"** (`session.send` submits); theme strategy **the canvas's own theme**
(light/dark via `prefers-color-scheme`), not VS Code variables; and **no
`copilot-extension.json` manifest**.

## Approach

**Layout.** The canvas sits at the repository root in `canvas/agento-mission-control/`,
deliberately not under `com.github.copilot/extensions/` or `.github/extensions/`, so
a host that stages the plugin cannot load it twice:

```
canvas/agento-mission-control/
  extension.mjs     wiring only: joinSession + createCanvas(defineMissionControl(...))
  canvas.mjs        defineMissionControl({ createCanvas, CanvasError, deps }) — description,
                    actions, open/onClose; testable with fakes (the SDK is unavailable in node:test)
  cli.mjs           runs <clone>/scripts/agento.mjs dashboard [--pr] in the session cwd
                    (execFile, 30 s timeout); <clone> = realpath(import.meta.url) two levels up
                    in link mode, or the stamp's clone in copy mode
  snapshot.mjs      normalize(dashboard) → view model; diff(prev, next) → feed events
  watch.mjs         debounced fs.watch on artifact roots, product + companion git refs and
                    worktrees; --pr refresh only on open, manual refresh, and a 5-minute interval
  store.mjs         $COPILOT_HOME/extension-data/agento-mission-control/<repo-key>.json
                    (feed history, agent notes, UI prefs); atomic tmp+rename;
                    { format: "agento-mission-control", version: 1 }; corrupt → reported, kept
  server.mjs        127.0.0.1:0 — GET / (page), GET /state, GET /events (SSE),
                    POST /dispatch, POST /refresh; OPTIONS refused
  dev.mjs           standalone dev server over fixtures/dashboard.json with a stub session
                    (prints dispatched prompts) for local:3103 UI verification
  public/           index.html, styles.css, app.js, roles.js,
                    panels/{board,graph,timeline,worktrees,feed}.js — vanilla JS + SVG, no CDN/deps
  fixtures/         dashboard.json (sanitized recording of `agento.mjs dashboard`)
  *.test.mjs        node:test suites
```

A `copilot-extension.json` manifest is added only if the spike (1.2) shows discovery
requires one. The create-canvas skill needs only `extension.mjs`.

**View model (snapshot.mjs).** The kanban lanes are Planned (`status: planned`),
Building (`in-progress` or `paused`), In Review (`in-review`), and Shipped
(`complete`, with the most recent N shown and the rest collapsed). Each card carries
the type, slug, step progress `{done, total}`, `pr`/`companionPr` chips,
`reviewVerdict`, the `owner` worktree and its role, `postShipPending`, `allowed[]`,
and `elsewhere[]`. Initiatives become `{waves[], nodes[], edges[{from, to, kind:
requires|recommendedAfter, blocking}], next}` from `initiatives.details`. The
timeline holds per-delivery phase bands from `metrics.items`, plus `aggregate.median`
markers and a `running` flag for a "now" line. Worktrees are grouped by role, cover
product and companion `session.worktrees[]`, link to the delivery they own, and mark
the current window. `diff(prev, next)` emits status changes, step ticks, PR opened,
verdict recorded, worktrees created or removed, and initiative members unblocked. The
canvas computes nothing the CLI already derives.

**Agent actions (canvas.mjs).**

| Action | Input schema | Effect |
| --- | --- | --- |
| `refresh` | `{ pr?: boolean }` | Re-run the dashboard, push it to clients, return lane counts |
| `get_snapshot` | `{}` | Lane counts, in-flight deliveries with steps and allowed commands, and each initiative's `next` |
| `focus` | `{ kind: "delivery"\|"initiative"\|"worktree", id: string }` | SSE `focus` event that scrolls to and highlights the node; `CanvasError("not-found")` when unknown |
| `post_note` | `{ text: string (≤ 500), slug?: string, level?: "info"\|"success"\|"warn" }` | Escaped agent note appended to the persisted feed |

`open()` is idempotent per `instanceId` (live servers are kept in a Map). Feed and
notes are keyed by `<repo-key>` = a hash of the primary clone path, so every window of
a repo shares the same history. `/agento mission-control` opens with the stable
`instanceId` `mission-control`. Storage failures throw `CanvasError("storage")`.

**Dispatch safety (server.mjs).** `POST /dispatch {command}` is accepted only when
all of the following hold:

1. `Host` is exactly `127.0.0.1:<port>`, which blocks DNS rebinding.
2. `Origin` is the server's own origin.
3. `Content-Type` is `application/json`. OPTIONS is refused, so a cross-site
   simple-request form post cannot reach the server.
4. `command` exactly equals an entry in the current snapshot's union of
   `session.allowed[]` and the delivery cards' `allowed[]`.

It then calls `session.send({ prompt: command })` once. `elsewhere[]` commands are
rendered disabled with "runs in <window> window" and are never sendable. There are
no secrets, the URL carries no credentials, and every rendered value is escaped.

**UI.** The page uses semantic landmarks, one region per panel, keyboard-reachable
buttons with visible focus, and an `aria-live` status line. It has its own light and
dark themes via `prefers-color-scheme`, or VS Code theme variables if the spike shows
they reach the page. `prefers-reduced-motion` disables the progress-ring and pulse
animations. Role colors live in `public/roles.js`, and a test keeps them equal to the
`agento.role.*` defaults in `extension/package.json`.

**Harness (scripts/agento.mjs, scripts/harness.mjs).** A second, optional link
`<extensionsDir>/agento-mission-control` → `<clone>/canvas/agento-mission-control`.
`extensionsDir` resolves in this order:

1. `AGENTO_COPILOT_EXTENSIONS_DIR` (the test override).
2. `$COPILOT_HOME/extensions` when `COPILOT_HOME` is non-empty.
3. `~/.copilot/extensions`.

`install` creates both links idempotently. `--force` replaces a foreign or dangling
target for either link, and a real directory is never deleted. `status` reports both
links. `uninstall` removes each link only if it is `installed`. The harness JSON gains
`canvas: {link, expected, state, target, changed}`. A new informational doctor check,
`canvas`, reports `ok` when installed and `warn` otherwise, with the `harness
install` fallback. It is a warning, not a failure, because `/agento` works without
the canvas. **Stamped-copy mode** (Decision 2) is built only if the spike shows
symlinks are not followed. In that mode `install` copies the dir and writes
`.agento-stamp.json` (`{format, version, clone, sha256}`). States become `installed |
stale | foreign | not-a-link`, `install` refreshes a stale copy, `uninstall` removes
only a stamped copy, and `cli.mjs` reads `clone` from the stamp.

**Command.** `/agento mission-control` gets `.github/prompts/mission-control.prompt.md`
and `skills/agento/commands/mission-control.md`. It needs `terminal`, uses
`agent: agent`, and its window check requires role `any`. `WINDOW_ROLES` gets
`"mission-control": ANY` and `COMMAND_NEEDS` gets `terminal`. The body runs the
preflight. When `open_canvas` is available, it opens canvas `agento-mission-control`
with `instanceId: "mission-control"`. Otherwise it runs `agento.mjs harness status`
and explains the prerequisites: `chat.canvases.enabled`, a local Copilot-harness
session, and the harness canvas link. Its result line's `next:` is
`/agento delivery-status`.

**Extension.** The command `agento.openMissionControl` ("Open Mission Control",
`$(dashboard)`) is a `view/title` action on `agento.deliveries`. It dispatches
`/agento mission-control` through `commandDispatcher`, and every extension command
list includes the new command.

**Affected files.** New: `canvas/agento-mission-control/**`,
`.github/prompts/mission-control.prompt.md`, and
`skills/agento/commands/mission-control.md`. Changed: `scripts/agento.mjs`,
`scripts/harness.mjs`, `scripts/session-state.mjs`, their tests,
`tests/customizations.test.mjs` (only if a list needs it), `extension/package.json`,
`extension/src/{extension,commandActions,commandAgent,dispatchRouting}.ts`, extension
unit and electron tests, `extension/cli/` (via `copy-cli`), `package.json`,
`.github/workflows/ci.yml`, `.claude-plugin/plugin.json`, `AGENTS.md`, `README.md`,
`docs/{extension,commands,install,copilot-harness}.md`, and `CHANGELOG.md`.

## Risks

- **The canvas API is a Preview and may differ from the docs.** Mitigation: a Phase 1
  spike against the real VS Code 1.142 runtime before any panel work. `extension.mjs`
  stays wiring-only, and all logic is in SDK-free modules tested with fakes.
- **User-scope discovery may not follow a symlinked dir.** Mitigation: the spike
  answers this. If it doesn't, the stamped-copy mode (Decision 2, step 6.2) replaces
  the link, with stale detection in `status` and doctor.
- **`session.send` may only fill the chat input instead of submitting.** Mitigation:
  the spike records which. If it only fills, the button is labelled "Send to chat"
  instead of "Run".
- **The canvas page may not receive VS Code theme CSS variables.** Mitigation: ship
  our own light and dark theme via `prefers-color-scheme`, and use VS Code variables
  only if the spike shows they arrive.
- **The plugin host's staged copy might auto-load the canvas twice.** Mitigation: the
  root-level `canvas/` placement, and the spike checks the staged plugin dir and that
  `list_canvas_capabilities` shows one entry.
- **Dispatch from a web page could be abused (CSRF, DNS rebinding, injected
  commands).** Mitigation: the four checks above, exact-match allowlist against the
  live snapshot, escaping everywhere, and dedicated server tests for every rejection
  path.
- **Dashboard cost (about 0.8 s and 200 KB per call on this repo).** Mitigation:
  debounced watch-driven refresh, `--pr` (gh) only on open, manual refresh, and a
  5-minute interval. An in-flight refresh coalesces later triggers.
- **Concurrent sessions share the private store.** Mitigation: records keyed by
  repo, atomic tmp+rename writes, a version marker, and corrupt files reported and
  never overwritten.
- **Dev link during the build.** The spike and the live check need
  `~/.copilot/extensions/agento-mission-control` pointing at this worktree's canvas
  dir. The registered plugin clone is `/home/david/DP/agento-plugin`, and
  `~/.copilot/extensions/` does not exist today. Mitigation: the Builder records the
  dev link in step 1.1 and removes it in step 9.2. After release the user runs
  `agento.mjs harness install` on their registered clone, as documented in
  `docs/install.md`.
- **Early user pause.** Step 1.2 is a `(manual)` step at the start of the build.
  This is accepted: the spike de-risks everything after it.
- **Concurrent deliveries.** There are no open PRs today. Integrate `origin/main` by
  merge before every push.

## Out of scope

- Doctor and Model Profiles panels.
- Direct artifact edits from the canvas (ticking steps, reordering initiative members).
- Builder and Autopilot automatically calling `post_note` while they work.
- Shipping the canvas through the Copilot app plugin marketplace, or as a
  project-scope `.github/extensions/` scaffold via agento-init.
- Retiring the sidebar tree views.
- Making the router-skill link honor `COPILOT_HOME` (only the new canvas link does;
  record this as a follow-up).

## Acceptance checklist

- [ ] The spike results (user-scope symlink discovery, `session.send` submit vs fill,
  theme variables, single load despite plugin staging) are recorded in plan.md
  `## Research` with the chosen install mode. Verify: `grep -n "Spike results"
  plan.md` and the evidence `evidence/step-1-2-spike-canvas.png`.
- [ ] `snapshot.mjs` maps the recorded dashboard fixture into lanes, initiative
  waves/edges/next, timeline bands, and worktree groups, and `diff` emits each of the
  six feed event kinds. Verify: `node --test
  canvas/agento-mission-control/snapshot.test.mjs`.
- [ ] `store.mjs` writes atomically under `$COPILOT_HOME/extension-data/agento-mission-control/`,
  validates its format and version marker, and refuses to overwrite corrupt or unknown
  data. Verify: `node --test canvas/agento-mission-control/store.test.mjs`.
- [ ] `POST /dispatch` calls `session.send` exactly once for a command in the live
  `allowed` union and rejects a wrong Host, a foreign Origin, a non-JSON body, OPTIONS
  preflight, an `elsewhere` command, and any non-allowed command. Verify: `node --test
  canvas/agento-mission-control/server.test.mjs`.
- [ ] The canvas definition has the four actions with JSON schemas (none prefixed
  `canvas.`), an idempotent `open` per `instanceId`, `CanvasError` for an unknown
  focus id, an oversize note, or a storage failure, and an `onClose` that stops the
  server. Verify: `node --test canvas/agento-mission-control/canvas.test.mjs` and
  `node --check` on every `canvas/**/*.mjs`.
- [ ] All five panels render the fixture on `local:3103` (`dev.mjs`) in light and
  dark themes. Allowed buttons dispatch exactly their command, `elsewhere` buttons are
  disabled with the window named, and reduced motion stops the animations. Verify:
  browser-driven screenshots under `evidence/` (steps 4.2–4.7).
- [ ] Canvas role colors equal the extension's `agento.role.*` defaults. Verify: the
  `roles` parity test.
- [ ] `agento.mjs harness install|status|uninstall` manages the canvas link (or the
  stamped copy) alongside the router link under `AGENTO_COPILOT_EXTENSIONS_DIR` /
  `$COPILOT_HOME/extensions` / `~/.copilot/extensions`, with `--force` and
  never-delete-real-dir semantics, and doctor's `canvas` check reports ok or warn.
  Verify: `node --test scripts/agento.test.mjs`.
- [ ] `/agento mission-control` exists as a prompt and router mirror, is allowed in
  every window role, and its preflight is `ok`. Verify: `node --test
  tests/customizations.test.mjs scripts/session-state.test.mjs` and `node
  scripts/agento.mjs preflight mission-control` → `status: ok`.
- [ ] The Deliveries view has an "Open Mission Control" title action that dispatches
  `/agento mission-control`. Verify: `cd extension && npm run test:unit && npm run
  test:electron`.
- [ ] Live in a Copilot-harness session, `/agento mission-control` opens the canvas,
  `refresh`, `focus`, and `post_note` work, an allowed button dispatches, and a reopen
  with the same `instanceId` shows the preserved feed. Verify:
  `evidence/step-9-1-live-canvas.png` and the user's confirmation on step 9.1.
- [ ] Docs (`docs/extension.md`, `docs/commands.md`, `docs/install.md`,
  `docs/copilot-harness.md`, AGENTS.md layout and test command, README) and a
  CHANGELOG 0.15.0 entry describe the canvas, its command, its install, and the
  canvases setting. The version is 0.15.0 in all four version files. Verify: `grep`
  checks in step 8.2.
- [ ] Full gate (no scoped gate; the baseline is clean):
  `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'`
  exits 0. The five guard replays from AGENTS.md pass. `cd extension && npm run typecheck && npm run
  test:unit && npm run test:electron` exits 0. The PR's CI (including `Shellcheck`) is
  green via `scripts/wait-for-checks.sh pr <n>`, with 0 findings compared to the
  baseline of 0. The dev link is removed, and `git status --porcelain
  --untracked-files=all` is empty in both halves.
