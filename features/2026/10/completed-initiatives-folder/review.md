# Review: completed-initiatives-folder

Verdict: approve

Reviewed 2026-10-08 against product `016eaba` (code PR #97, draft, CI `test`
SUCCESS) and companion `77f5797` (artifact PR #33, draft), both on
`feature/completed-initiatives-folder`. `origin/main` is an ancestor of HEAD in both
halves; both halves were clean before and after verification
(`git status --porcelain --untracked-files=all` empty).

Skills consulted: none — no matching domain (no `.agents/skills/` in this repository
and AGENTS.md has no `## Agento` skills table).

Verification run by the Reviewer (2026-10-08, product `016eaba`):

| Check | Result | Baseline (plan / step 1.1) |
| --- | --- | --- |
| `git ls-files '*.sh' \| xargs pnpm dlx shellcheck` | exit 0, no findings | exit 0, no findings |
| `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | exit 0, 340/340 | 340/340 |
| `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` | exit 0 | exit 0 |
| `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` | exit 0 | exit 0 |
| `cd extension && npm run build` | exit 0 | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` / `-p tsconfig.test.json` (TypeScript 5.9.3) | exit 0 / exit 0 | — |
| `npm run test:unit` | exit 0, 128/128 (+4 new, tests 75–78) | 124/124 |
| `npm run test:electron` | exit 0; in-repo, companion, workspace scenarios passed (VS Code 1.125.0) | exit 0 |
| `node --test tests/extension-bundle.test.mjs` | exit 0, 4/4 | 4/4 (step 4.1) |
| `agento.mjs initiative` on this repository | `agento-extension`, `external-artifact-repo`, `workflow-orchestration` all `done: true`, `valid: true` | same |

## Acceptance checklist results

- **pass** — Done+valid initiatives appear only inside a trailing root `Completed (N)`
  folder; all others stay at the root in CLI order. Code:
  `extension/src/initiativeTreePresentation.ts` `initiativeTreeChildren` partitions
  on `item.done && item.valid` and appends `{ kind: "completed", items }` only when
  non-empty. Unit test 75 ("moves done and valid initiatives into a trailing
  Completed folder") asserts root `[active, done-invalid,
  completed:shipped-one,shipped-two]` and folder children in CLI order; Electron
  suite asserts root labels `["agento-extension", "Completed (1)"]` and folder
  children `["finished-initiative"]` — passed in the in-repo and companion
  scenarios.
- **pass** — A done-but-invalid initiative stays at the root with its diagnostics:
  unit test 75 asserts `done-invalid` at the root and its children
  `["diagnostic", "group"]`.
- **pass** — No folder when none is completed, only the folder when all are: unit
  test 76 asserts `["completed:a,b"]` for all-done and `["a", "b"]` for a model of
  one active and one done-but-invalid initiative.
- **pass** — Folder collapsed with a stable id, context value, no command: unit test
  77 deep-equals the spec (`Completed (2)`, `collapsible: "collapsed"`, `idParts:
  ["completed"]`, `contextValue: "agento.initiativesCompleted"`, icon `archive`,
  tooltip, no `command`) and checks the singular tooltip; the Electron suite's
  `assertCollapsedGroup` asserts `TreeItemCollapsibleState.Collapsed` and an id
  matching `^agento:`, plus `/initiatives\/completed$/`, the context value, and
  `command === undefined`.
- **pass** — Initiatives inside the folder behave like root ones: unit test 78
  deep-equals the nested element, its spec, and its children with the root form;
  the Electron suite asserts the nested initiative's `contextValue ===
  "agento.initiative"`; the pre-existing `getChildren()[0]` initiative assertions
  still pass. Ids stay unique (`["completed"]` vs `["initiative", slug]` vs
  `["group", slug, kind]`; each initiative appears exactly once).
- **pass** — Real VS Code window: step 3.4's linked
  [evidence/step-3-4-completed-folder.png](evidence/step-3-4-completed-folder.png)
  (inspected) shows the Agento container's Initiatives view with a single collapsed
  `Completed (3)` row and the archive icon, matching this repository's three
  done+valid initiatives; no secrets visible. The Reviewer cannot drive the user's
  VS Code UI (§1), so the behavior was re-verified independently through the unit
  tests and the Electron run above, which exercise the same provider in a real
  extension host.
- **pass** — Docs: `docs/extension.md` `## Initiatives` (line 53) and `CHANGELOG.md`
  `## Unreleased` (line 6) both contain `**Completed (N)**` and describe placement,
  collapse, the hidden-when-empty rule, and the done-but-invalid exception.
- **pass** — Full gate green against the recorded baseline: every command in the
  table above re-run by the Reviewer with matching or improved counts; both halves
  clean.

## Plan vs implementation

- Implementation matches the plan's Approach items 1–6 exactly; the provider
  (`extension/src/initiativeTreeProvider.ts`) is unchanged, as predicted.
- Steps 2.1 and 2.2 landed in one commit (`1eca226`), documented on the roadmap
  line (the new element kind does not type-check until the spec handles it).
- Step 3.4 says "Install from VSIX…" in the user's VS Code; the agent installed the
  VSIX with `code --install-extension … --force` at the user's request instead, and
  the user reloaded and captured the screenshot. Equivalent outcome, documented on
  the step line, consistent with §1 (the agent runs what its CLI can).
- No undocumented changes: the diff touches exactly the six planned files.

## Roadmap audit

- All 9 ticked steps spot-checked against the code and re-run results; none falsely
  ticked.
- 3.3: the `.vsix` byproduct is absent from the worktree and was never committed.
- 3.4 `(manual)`: evidence file present at
  `evidence/step-3-4-completed-folder.png`, linked from the step line, completion
  date noted (§3).
- No `(manual, post-ship)` steps. No repairs made; no steps added.

## Findings

- **Info (not a code defect)** — The editor's single problem (⊗ 1) while
  `extension/src/initiativeTreePresentation.ts` was open is a language-server
  diagnostic on line 1, `import path from "node:path";`: "Cannot find name
  'node:path'. Do you need to install type definitions for node?". It is not
  reproducible by the compiler: `npx tsc --noEmit -p tsconfig.json` and
  `-p tsconfig.test.json` both exit 0, `npm run build` exits 0, and
  `extension/node_modules/@types/node` is installed. Line 1 is unchanged from
  `origin/main`, and the identical import in nine other `extension/src` files
  (e.g. `treeItemIds.ts`, `deliveryTreeProvider.ts`) reports no problem. The
  screenshot shows the file open in a pending chat-edit diff view, so this is stale
  TypeScript server state for that document; *TypeScript: Restart TS Server* (or
  accepting/closing the chat-edit diff) clears it. No action on the branch.
- No other findings. The change is a small, pure presentation partition; it adds
  no new commands, menus, I/O, or inputs, so there is no security surface.

## Follow-ups

- none
