Source: inline argument to `/agento new-initiative` — 2026-09-18

Build a VS Code extension that gives Agento a graphical control surface: see every delivery and initiative, and create plans, start builds, run autopilot, ship, and close sessions from clickable actions instead of typing slash commands.

Why: /agento delivery-status is the only dashboard today and every action is a chat command typed into the right window by hand. Users want the same information as a live view plus buttons that dispatch the correct command into the correct window.

What it is: a VS Code extension (TypeScript, public vscode API, packaged as a VSIX) living in this repository under extension/, released alongside the agent plugin. It is not a second agent plugin and does not modify VS Code. The agent plugin stays the execution engine; the extension is a dashboard, launcher, and window router only.

Hard constraints:
- All state comes from the Agento CLI (scripts/agento.mjs: session --pr, status, next, initiative, ship-preflight --pr, doctor, paths, ports). The extension never re-derives lifecycle, ownership, allowed commands, or next transition; it renders the JSON. Actions offered per window are exactly the record's allowed[] and elsewhere[] (policy §11), never a hand-maintained list.
- The extension bundles its own copy of scripts/agento.mjs, agento-config.mjs, session-state.mjs, and delivery-roadmap-resolver.mjs at build time; a test in tests/ fails when the bundled copy diverges from scripts/. Versions in extension/package.json, package.json, and .claude-plugin/plugin.json stay in lockstep, enforced by a test.
- Commands are dispatched by submitting the canonical /agento <name> text into Copilot Chat in agent mode (workbench.action.chat.open), in the window next.window names: here, the primary (worktrees[0].path), or the owning secondary (the managed worktrees[] entry on delivery.branch, opened as its .code-workspace in companion mode). Cross-window dispatch prefers /agento continue <slug> so the CLI picks the concrete command; the UI never runs /agento ship anywhere but the primary and never marks PRs ready or merges itself.
- Companion mode (artifacts.repo set) is first-class: show companionPr beside pr, the companion half's dirty/ahead/behind, and open pairs via the .code-workspace file.
- Refresh from file-system and git events on roadmap.md, review.md, and .git refs in the product and companion checkouts; no background polling faster than a few seconds.
- No secrets displayed or logged; doctor output is shown as-is with fallbacks, the extension never repairs the environment.
- Node >= 20, no runtime dependencies beyond the vscode API; unit tests with node:test for the pure parts, extension tests with @vscode/test-electron for activation and view rendering; the repo's existing test and shellcheck commands stay green; AGENTS.md gains the extension's build, test, and package commands.

Features I expect the dashboard to cover:
- Deliveries tree: one node per roadmap with type, slug, lifecycle, ticks/total, status, PR and companion PR state, owning worktree, initiative; grouped by lifecycle in the CLI's order.
- Initiatives tree: per initiative complete/total, in-flight, ready members with blockedBy, the CLI's next, done flag, anomalies.
- Per-node actions from allowed[]/elsewhere[]: start-session (plan or build), new-feature, new-issue, build, review, ap, ship, close-session, continue; each labelled with the window it runs in.
- New plan flow: a form for a feature or issue description that runs /agento start-session in the primary, opens the new window, and submits /agento new-feature or /agento new-issue there.
- Session and doctor panel: role, worktree, branch, lifecycle, warnings, each doctor check with status and fallback.
- Status bar item summarising in-flight deliveries and the current window's role.

Out of scope:
- Cancelling a chat request running in another window (no public API); the UI focuses that window and points at the stop button. Resume is /agento continue.
- Reading chat output or receipts; progress is only what roadmap.md and git show.
- Replacing or wrapping the agents, prompts, hooks, or CLI semantics; any CLI change is additive JSON.
- A standalone web UI, a fork of VS Code, Marketplace publishing automation (packaging a VSIX is enough for now).

Definition of done: a user installs the plugin and the VSIX, opens a repository initialised with /agento agento-init, sees deliveries and initiatives with correct lifecycle and PR state in both in-repo and companion layouts, and can create a plan, start a build, run autopilot, ship, and close a session from the UI with every command landing in the window the CLI's session record says it belongs to.
