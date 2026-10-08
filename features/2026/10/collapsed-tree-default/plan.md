# Agento dashboard trees start collapsed in every new window

## Problem

Every collapsible node in the Agento activity-bar container opens expanded: the
Deliveries lifecycle groups, each initiative and its Ready / In flight / Blocked /
Complete groups, and the Session & Doctor groups. On a repository with many
deliveries and initiatives the three views are a long wall of rows the moment a
window opens. The user wants every folder in the Agento UI collapsed by default
whenever a window opens (new or reloaded), expanding only what they click.

## Decisions

Clarifying questions asked 2026-10-08 (recommended option marked):

1. *Which collapsible nodes should start collapsed?* — Options: **All group nodes in
   all three views (recommended)**; Deliveries and Initiatives only; the three view
   sections themselves. Answer: "All group nodes in all three views" (the
   recommended option).
2. *After the user expands a node, should it stay expanded across refreshes in the
   same window?* — Options: **Yes — keep user expansion across refreshes (stable
   ids) (recommended)**; No — every refresh re-collapses. Answer: "Yes — keep user
   expansion across refreshes (stable ids)" (the recommended option).
3. *VS Code may restore remembered expansion when a window reopens. What should a
   new/reopened window show?* — Options: **Always all collapsed on every window open
   (recommended)**; Collapsed by default, but VS Code may restore prior expansion.
   Answer: "Always all collapsed on every window open" (the recommended option).
4. *Any node that should stay expanded by default?* — Options: **None — everything
   collapsed (recommended)**; Session & Doctor 'Warnings' group when present; the
   group containing the current window's delivery. Answer: "None — everything
   collapsed" (the recommended option).

## Research

Skills consulted: none — no matching domain (no `.agents/skills/` in this repository
and AGENTS.md has no `## Agento` skills table).

Collapsible nodes today, all hard-coded `Expanded`, none with a `TreeItem.id`:

- Deliveries lifecycle groups — `vscode.TreeItemCollapsibleState.Expanded` in
  `extension/src/deliveryTreeProvider.ts` (`getTreeItem`, `element.kind === "group"`);
  the group carries a stable `lifecycle` key from `extension/src/deliveryTreeModel.ts`
  (`{ lifecycle, label: lifecycleLabel(lifecycle), items }`).
- Initiatives — `collapsible: "expanded"` for the `initiative` and `group` specs in
  `extension/src/initiativeTreePresentation.ts` (`initiativeTreeItemSpec`; the type is
  `collapsible: "none" | "expanded"`), mapped to `Expanded`/`None` in
  `extension/src/initiativeTreeProvider.ts`. Group labels embed a live count
  (`Ready (1)` → `Ready (2)`, asserted in `extension/test/electron/suite.ts`), so the
  label-derived handle changes whenever a member moves.
- Session & Doctor groups (`session`, `companion`, `warnings`, `doctor`) —
  `Expanded` in `extension/src/sessionDoctorProvider.ts`.
- The three providers are constructed once per activation in
  `extension/src/extension.ts` (`new DeliveryTreeProvider(…)`,
  `new InitiativeTreeProvider(…)`, `new SessionDoctorProvider()`) and bound with
  `createTreeView` (no `showCollapseAll`, no `getParent`).
- Views declared in `extension/package.json` `contributes.views.agento`; no
  `visibility` field; `extensionIntegration.test.ts` asserts that array exactly.

VS Code tree behavior that shapes the design (TreeItem API docs): a node's handle is
its `id` when set, otherwise derived from its label and parent path; expansion state
(including what the workbench remembers for a view across a reload) is keyed by that
handle. Therefore:

- Changing the initial state to `Collapsed` alone does not satisfy decision 3 —
  remembered handles could reopen expanded — and does not satisfy decision 2 for
  initiative groups, whose label (hence handle) changes with the count.
- A stable `id` keeps a user's expansion across `onDidChangeTreeData` refreshes in
  the same window (decision 2); prefixing it with a nonce generated once per
  extension activation makes every new or reloaded window see handles it has never
  stored, so everything opens collapsed (decision 3).

Concurrent deliveries: `gh pr list --state open` returned `[]` on 2026-10-08 — no
overlapping branches.

Lint and test baseline (2026-10-08, product worktree at `origin/main` `f312d71`):

- Full-repository shell lint `git ls-files '*.sh' | xargs pnpm dlx shellcheck` —
  exit 0, no findings (system `shellcheck` is not installed; `pnpm dlx` is the
  route the previous deliveries used).
- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` — exit 0, 340/340.
- `cd extension && npm ci` exit 0; `npm run build` (tsc + copy-cli) exit 0;
  `npm run test:unit` exit 0, 119/119. `test:electron` not run during planning;
  the Builder records it in step 1.1.
- Overlap decision: the baseline is green, so the full gate applies — no scoped
  gate, no cleanup prerequisite. This delivery touches no shell files.

## Approach

1. **Per-activation tree id scope** — new `extension/src/treeItemIds.ts` exporting
   `createTreeIdScope(nonce = randomUUID()): (...parts: string[]) => string`, which
   returns `agento:<nonce>:<parts joined by "/">`. One scope is created in
   `activate()` and passed to the three provider constructors, so all three views
   share one nonce per window and a fresh one on every new/reloaded window.
2. **Deliveries** — `DeliveryTreeProvider(roadmapRoot, treeId)`; lifecycle groups
   get `TreeItemCollapsibleState.Collapsed` and `item.id = treeId("deliveries",
   "group", group.lifecycle)`. Leaf and message rows unchanged.
3. **Initiatives** — `InitiativeTreeItemSpec.collapsible` becomes
   `"none" | "collapsed"`; the initiative and group specs return `"collapsed"`. Add
   `idParts?: string[]` to the spec — `["initiative", slug]` and
   `["group", initiativeSlug, group.kind]` — and the provider sets
   `item.id = treeId("initiatives", ...spec.idParts)` when present and maps
   `"collapsed"` to `Collapsed`. `InitiativeTreeProvider(artifactRoot, treeId)`.
4. **Session & Doctor** — `SessionDoctorProvider(treeId)`; groups become
   `Collapsed` with `item.id = treeId("sessionDoctor", "group", element.id)`.
5. Ids are set only on collapsible nodes; leaves keep label-derived handles, which
   avoids any duplicate-id risk (a duplicate `id` makes VS Code reject the tree).
6. **Tests** — unit: `treeItemIds.test.ts` (same scope → identical ids; two scopes →
   different ids; format), `initiativeTreeProvider.test.ts` asserts `collapsible:
   "collapsed"` and the `idParts` for initiative and group specs and `"none"` for
   members, diagnostics, and messages. Electron (`extension/test/electron/suite.ts`):
   every Deliveries, Initiatives (initiative + group), and Session & Doctor group
   item reports `collapsibleState === Collapsed` and an `id` starting with
   `agento:`; the initiative group id for `ready` is identical before and after the
   existing `Ready (1)` → `Ready (2)` refresh; delivery and member leaves stay
   `None`.
7. **Docs** — `docs/extension.md`: one sentence per view (or one shared sentence)
   that groups start collapsed in every new window and keep the user's expansion
   while the window stays open; `CHANGELOG.md` `## Unreleased` entry.

Affected files: `extension/src/treeItemIds.ts` (new),
`extension/src/deliveryTreeProvider.ts`, `extension/src/initiativeTreePresentation.ts`,
`extension/src/initiativeTreeProvider.ts`, `extension/src/sessionDoctorProvider.ts`,
`extension/src/extension.ts`, `extension/test/unit/treeItemIds.test.ts` (new),
`extension/test/unit/initiativeTreeProvider.test.ts`,
`extension/test/electron/suite.ts`, `docs/extension.md`, `CHANGELOG.md`. No CLI
(`scripts/`) change, so `extension/cli/` needs no re-copy.

## Risks

- **Rendered behavior is not machine-observable.** The Electron test reads
  `TreeItem.collapsibleState` and `id` from the providers but cannot see what the
  workbench renders or restores after a real reload. Mitigation: unit + Electron
  assertions cover the contract, and one `(manual)` step has the user install the
  built VSIX, expand groups, reload the window, and attach a screenshot showing all
  groups collapsed — the agent cannot see or drive the user's VS Code UI (policy §1).
- **Duplicate ids crash a tree view.** Mitigation: ids only on group nodes, whose
  keys are unique by construction (lifecycle, initiative slug, initiative slug +
  group kind, session group id); leaves stay label-derived.
- **Expansion lost on refresh** if an id embeds anything volatile (label, count).
  Mitigation: ids use only stable keys; the Electron refresh assertion pins it.
- **`TreeItem.id` changes handles for existing context-menu / `when` clauses.**
  Mitigation: `contextValue` is untouched; `viewItem ==` menus key off it, not the
  handle.

## Out of scope

- Collapsing or hiding the three view *sections* (Deliveries, Initiatives,
  Session & Doctor) themselves.
- A "Collapse All" title button (`showCollapseAll`), auto-revealing the current
  delivery, or any per-node expanded exception.
- Persisting the user's expansion across windows or reloads (explicitly rejected
  by decision 3).
- CLI, prompt, or artifact-format changes.

## Acceptance checklist

- [ ] Every collapsible node in all three views — Deliveries lifecycle groups,
  initiatives, initiative status groups, Session & Doctor groups — is created with
  `TreeItemCollapsibleState.Collapsed`, and no `TreeItemCollapsibleState.Expanded`
  remains in `extension/src` — verify: Electron suite assertions pass and
  `grep -rn "Expanded\|\"expanded\"" extension/src` returns nothing.
- [ ] Group nodes carry stable ids that survive a refresh in the same window,
  including a label/count change — verify: Electron assertion that the initiative
  `ready` group id is identical before and after the `Ready (1)` → `Ready (2)`
  refresh; unit test that one scope yields identical ids for the same parts.
- [ ] Every new or reloaded window gets fresh group ids, so no remembered expansion
  is restored — verify: `treeItemIds.test.ts` shows two scopes yield different ids;
  `activate()` creates exactly one scope passed to all three providers
  (`extensionIntegration.test.ts` source-shape assertion).
- [ ] Leaf rows (deliveries, initiative members, diagnostics, messages, Session &
  Doctor rows, errors) are unchanged: `None`, no `id`, same labels, commands, and
  context values — verify: existing unit and Electron assertions pass unchanged,
  plus explicit `None` assertions for delivery and member leaves.
- [ ] In a real VS Code window with the built extension, all Agento groups are
  collapsed after a window reload even when some were expanded before — verify:
  roadmap `(manual)` step 3.4 with linked screenshot evidence.
- [ ] `docs/extension.md` and `CHANGELOG.md` `## Unreleased` describe the default —
  verify: `grep -n -i "collapsed" docs/extension.md CHANGELOG.md` matches both.
- [ ] Full gate green against the recorded baseline: shellcheck exit 0 no findings;
  node tests exit 0 (≥ 340); extension `npm run build`, `npm run test:unit`
  (≥ 119, new cases attributed), `npm run test:electron` exit 0; both trees clean —
  verify: roadmap step 4.1 records each result.
