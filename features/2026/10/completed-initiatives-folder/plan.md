# Completed initiatives move into a collapsed Completed folder in the Initiatives view

## Problem

The Initiatives view lists every initiative as a root row, whether it still has
work left or every member already shipped. As initiatives accumulate, the view
becomes overwhelming: finished initiatives sit beside active ones and push them
out of sight. On this repository today all three initiatives are finished
(`agento.mjs initiative`: `agento-extension` 8/8, `external-artifact-repo` 7/7,
`workflow-orchestration` 7/7, each `done: true`, `valid: true`), yet they occupy
the view exactly as active work would.

The user wants fully completed initiatives grouped under one **Completed** folder
that is collapsed by default; uncompleted initiatives stay as they are.

## Decisions

Clarifying questions asked 2026-10-08 (recommended option marked):

1. *How should the completed-initiatives folder be labelled?* — Options:
   **Completed (N) (recommended)**; Completed; Archive (N). Answer: "Completed (N)"
   (the recommended option).
2. *Where should the folder sit among the root rows of the Initiatives view?* —
   Options: **Last, after all uncompleted initiatives (recommended)**; First, above
   uncompleted initiatives. Answer: "Last, after all uncompleted initiatives" (the
   recommended option).
3. *An initiative whose members are all complete but which has breakdown errors
   (invalid): where does it go?* — Options: **Stay at top level (recommended)** —
   only done AND valid initiatives move into Completed, so errors stay visible;
   Move into Completed. Answer: "Stay at top level" (the recommended option).
4. *When no initiative is completed, what should the view show?* — Options:
   **Hide the folder (recommended)**; Show 'Completed (0)'. Answer: "Hide the
   folder" (the recommended option).
5. *Should the Completed folder start collapsed on every window load, or remember if
   the user expanded it?* — Options: **Collapsed on every load (recommended)** —
   consistent with the existing collapsed-tree-default behavior; Remember expansion
   across reloads. Answer: "Collapsed on every load" (the recommended option).

## Research

Skills consulted: none — no matching domain (no `.agents/skills/` in this repository
and AGENTS.md has no `## Agento` skills table).

- **Completion is already in the model.** The CLI list sets `done:
  features.length > 0 && features.every((f) => f.state === "complete")`
  (`scripts/agento.mjs`, initiative list record). `extension/src/initiativeTreeModel.ts`
  parses it (`parseListItem` → `done`) and carries `done` and `valid` on every
  `InitiativeTreeItem` (`createInitiativeTreeModel`, both the healthy and the
  detail-failure branches). No CLI or model change is needed.
- **Presentation is a pure module.** `extension/src/initiativeTreePresentation.ts`
  defines `InitiativeTreeElement` (`initiative | group | member | diagnostic |
  message`), `initiativeTreeChildren(model, element?)` — root returns one
  `initiative` element per `model.items` in CLI order — and
  `initiativeTreeItemSpec(element, artifactRoot)`, whose spec carries
  `collapsible: "none" | "collapsed"` and optional `idParts`.
- **Provider is generic over the spec.** `extension/src/initiativeTreeProvider.ts`
  `getTreeItem` maps `"collapsed"` → `TreeItemCollapsibleState.Collapsed` and sets
  `item.id = treeId("initiatives", ...spec.idParts)` when present; `getChildren`
  delegates to `initiativeTreeChildren`. A new element kind therefore needs no
  provider change.
- **Collapsed-by-default already works per window.** `extension/src/treeItemIds.ts`
  prefixes ids with a per-activation nonce (delivered by
  `features/2026/10/collapsed-tree-default`), so a node with `collapsible:
  "collapsed"` and stable `idParts` starts collapsed in every new or reloaded window
  and keeps the user's expansion across refreshes in the same window — exactly
  decision 5.
- **Nothing else walks the root.** `initiativeTreeChildren` is only called from the
  provider; no `reveal`/`getParent` is used in `extension/src`. Menus in
  `extension/package.json` key on `viewItem == agento.initiativeMember.ready` /
  `.in-flight` only, so a new folder `contextValue` affects no menu.
- **Tests.** `extension/test/unit/initiativeTreeProvider.test.ts` covers the
  hierarchy, context values/icons, breakdown commands, collapsed/idParts, and
  empty/error rows on a single not-done initiative. The Electron fixture
  (`extension/test/electron/runTest.ts` `writeInitiative`, `writeDeliveries`) has
  one initiative, `agento-extension`, 1/6 complete; `extension/test/electron/suite.ts`
  reads `api.initiatives.getChildren()[0]` as that initiative and asserts the
  Deliveries labels, so adding a completed fixture initiative also adds a member
  delivery to the Deliveries tree and those assertions must be updated.
- **Docs.** `docs/extension.md` `## Initiatives` describes the member groups; the
  intro paragraph states every group starts collapsed. `CHANGELOG.md` has a
  `## Unreleased` section.

Concurrent deliveries: `gh pr list --state open --json number,headRefName` returned
`[]` on 2026-10-08 — no overlapping branches.

Lint and test baseline (2026-10-08, product worktree at `origin/main` `659c0ea`):

- Full-repository shell lint `git ls-files '*.sh' | xargs pnpm dlx shellcheck` —
  exit 0, no findings.
- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` — exit 0, 340/340.
- `cd extension && npm ci` and `npm run build` (copy-cli + tsc) completed with no
  errors in the log; `npm run test:unit` exit 0, 124/124; the product tree stayed
  clean. `test:electron` was not run during planning; the Builder records it in
  step 1.1.
- Overlap decision: the baseline is green, so the full gate applies — no scoped
  gate, no cleanup prerequisite. This delivery touches no shell files.

## Approach

1. **New element kind** in `extension/src/initiativeTreePresentation.ts`:
   `CompletedFolderElement = { kind: "completed"; items: InitiativeTreeItem[] }`,
   added to the `InitiativeTreeElement` union.
2. **Root partition** in `initiativeTreeChildren` (model `ready`, no element): an
   initiative is *completed* when `item.done && item.valid`. Return the
   non-completed initiatives first, in CLI order, then — only when at least one is
   completed — one `{ kind: "completed", items }` element holding the completed
   initiatives in CLI order (decisions 2, 3, 4). Children of the folder are those
   initiatives as ordinary `initiative` elements, so their own groups, members,
   diagnostics, and breakdown commands are unchanged. Empty and error models are
   unchanged.
3. **Folder spec** in `initiativeTreeItemSpec`: label `Completed (<n>)` (decision 1),
   `collapsible: "collapsed"`, `idParts: ["completed"]`, `contextValue:
   "agento.initiativesCompleted"`, icon `archive`, no command, tooltip naming the
   count. The id is stable (no count in it), so expansion survives a count change
   within a window and resets on every new window (decision 5). Nested initiatives
   keep `idParts ["initiative", slug]`, still unique.
4. **Provider**: no change expected — it already maps the spec generically.
5. **Tests** — unit (`extension/test/unit/initiativeTreeProvider.test.ts`): mixed
   model (active, done+valid, done+invalid) → root is `[active, done+invalid,
   completed folder]` in CLI order and the folder holds only the done+valid one;
   all-done model → root is only the folder; no-done model → no folder; folder spec
   (label with count, collapsed, `idParts ["completed"]`, context value, icon, no
   command); a nested initiative's children and spec are identical to a root one.
   Electron: add a second fixture initiative `finished-initiative` whose single
   member `finished-delivery` has a `status: complete` roadmap with `initiative:
   "finished-initiative"`; assert the root is `agento-extension` then a collapsed
   `Completed (1)` folder whose `id` starts with `agento:`, the folder's child is
   `finished-initiative`, and update the Deliveries label assertions for the new
   shipped delivery.
6. **Docs**: `docs/extension.md` `## Initiatives` — fully completed (and valid)
   initiatives are grouped under a collapsed **Completed (N)** folder after the
   active ones; `CHANGELOG.md` `## Unreleased` entry.

Affected files: `extension/src/initiativeTreePresentation.ts`,
`extension/test/unit/initiativeTreeProvider.test.ts`,
`extension/test/electron/runTest.ts`, `extension/test/electron/suite.ts`,
`docs/extension.md`, `CHANGELOG.md` (`extension/src/initiativeTreeProvider.ts` only
if the generic mapping proves insufficient). No CLI (`scripts/`) change, so
`extension/cli/` needs no re-copy.

## Risks

- **Electron fixture ripple.** A completed fixture initiative needs a member roadmap,
  which also appears in the Deliveries tree and the initiative list counts.
  Mitigation: step 3.1 updates the Deliveries label assertions explicitly; the
  `agento-extension` initiative stays first so the existing `getChildren()[0]`
  assertions keep their meaning.
- **Rendered behavior is not machine-observable.** The Electron test reads tree
  items from the provider but cannot see the workbench. Mitigation: one `(manual)`
  step has the user install the built VSIX and attach a screenshot of the real view
  (all three initiatives of this repository are done, so it shows only
  `Completed (3)`, collapsed) — the agent cannot see or drive the user's VS Code UI
  (policy §1).
- **Duplicate ids crash a tree view.** Mitigation: the folder id
  `["completed"]` cannot collide with `["initiative", slug]` or
  `["group", slug, kind]`; each initiative appears exactly once (root or folder).
- **Hidden errors.** A done-but-invalid initiative tucked into a collapsed folder
  would hide its diagnostics. Mitigation: decision 3 keeps it at the top level;
  a unit test pins it.

## Out of scope

- Any change to the Deliveries or Session & Doctor views (Deliveries already groups
  shipped work under its own lifecycle group).
- A setting to show or hide completed initiatives, sorting active initiatives, or
  archiving/moving initiative files.
- Persisting the folder's expansion across windows (rejected by decision 5).
- CLI, prompt, or artifact-format changes.

## Acceptance checklist

- [ ] Initiatives that are `done` and `valid` appear only inside a root-level
  `Completed (N)` folder placed after every other initiative; all others stay at the
  root in CLI order — verify: unit test on a mixed model and Electron assertion on
  the fixture root (`agento-extension`, then `Completed (1)` containing
  `finished-initiative`).
- [ ] A done-but-invalid initiative stays at the root with its diagnostics — verify:
  unit test on the mixed model.
- [ ] No folder is shown when no initiative is completed, and only the folder when
  all are — verify: unit tests for both models.
- [ ] The folder is collapsed with a stable id (`TreeItemCollapsibleState.Collapsed`,
  id starting with `agento:` and ending in `initiatives/completed`), context value
  `agento.initiativesCompleted`, no command — verify: unit spec assertion and
  Electron `getTreeItem` assertion.
- [ ] Initiatives inside the folder behave exactly like root ones (same groups,
  members, ids, context values, breakdown command) — verify: unit test comparing a
  nested initiative's spec and children to the root form; existing unit and Electron
  initiative assertions pass.
- [ ] In a real VS Code window with the built extension, completed initiatives are
  under a collapsed `Completed (N)` folder — verify: roadmap `(manual)` step 3.4
  with linked screenshot evidence.
- [ ] `docs/extension.md` and `CHANGELOG.md` `## Unreleased` describe the folder —
  verify: `grep -n "Completed (N)" docs/extension.md CHANGELOG.md` matches both.
- [ ] Full gate green against the recorded baseline: shellcheck exit 0 no findings;
  node tests exit 0 (≥ 340); guard smokes exit 0; extension `npm run build`,
  `npm run test:unit` (≥ 124, new cases attributed), `npm run test:electron` exit 0;
  both halves clean — verify: roadmap step 4.1 records each result.
