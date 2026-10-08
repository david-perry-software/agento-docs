# Review: collapsed-tree-default

Verdict: approve

Reviewed 2026-10-08 against product `b3eac7b` (code PR #96) and companion `e29439b`
(artifact PR #32), both on `feature/collapsed-tree-default`. `origin/main` is an
ancestor of both halves (`git merge-base --is-ancestor` exit 0 in each); both halves
were clean before review and stayed clean after the gate reruns. Window check:
`agento.mjs session` → `role: build`, `delivery.slug: collapsed-tree-default`;
`agento.mjs doctor --for review-feature` → `ok` (gh authenticated, origin reachable,
artifact repo present).

Skills consulted: none — no matching domain (no `.agents/skills/` in the product
repository; AGENTS.md has no `## Agento` skills table).

Gate rerun by the Reviewer (all from the product worktree at `b3eac7b`):

| Check | Result | Baseline (plan / step 1.1) |
| --- | --- | --- |
| `git ls-files '*.sh' \| xargs pnpm dlx shellcheck` | exit 0, no findings | exit 0, no findings |
| `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | exit 0, 340/340 | 340/340 |
| `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` | exit 0 | — |
| `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` | exit 0 | — |
| `cd extension && npm run build` | exit 0 | exit 0 |
| `cd extension && npm run test:unit` | exit 0, 124/124 | 119/119 |
| `cd extension && npm run test:electron` | exit 0; in-repo, companion, workspace scenarios passed | 3/3 |
| `node --test tests/extension-bundle.test.mjs` | exit 0, 4/4 | — |
| `grep -rn 'Expanded\|"expanded"' extension/src` | no output, exit 1 | — |
| `grep -n -i collapsed docs/extension.md CHANGELOG.md` | `docs/extension.md:21`, `CHANGELOG.md:7` | — |

The lint baseline was green, so the full gate applies (§5); the fresh run matches it
exactly. The +5 unit cases are all from this delivery: 3 in
`extension/test/unit/treeItemIds.test.ts`, 1 in `initiativeTreeProvider.test.ts`
(collapsed/idParts), 1 in `extensionIntegration.test.ts` (single scope). No `.vsix`
was packaged during review; `extension/*.vsix` is absent.

## Acceptance checklist results

1. **Every collapsible node starts `Collapsed`; no `Expanded` left in `extension/src`** —
   pass. The grep prints nothing. `deliveryTreeProvider.ts`, `sessionDoctorProvider.ts`,
   and `initiativeTreeProvider.ts` now create groups with
   `TreeItemCollapsibleState.Collapsed`; `initiativeTreePresentation.ts` narrows
   `collapsible` to `"none" | "collapsed"`. The Electron suite's `assertCollapsedGroup`
   covers every Deliveries group (Planned, Building, In Review, Shipped), the
   `agento-extension` initiative, its four status groups, and the Session, Companion,
   Warnings, and Doctor groups. All three scenarios pass.
2. **Group ids stay stable across a refresh, including a count change** — pass.
   `suite.ts` captures `readyGroupId` while the label is `Ready (1)` and asserts the same
   id after the refresh to `Ready (2)`. The unit test "one tree id scope yields identical
   ids for the same parts" passes. Ids are built only from stable keys: lifecycle,
   initiative slug, group kind, and session group id.
3. **Every new or reloaded window gets fresh ids** — pass. `createTreeIdScope()` defaults
   to `randomUUID()`, and the unit test "two tree id scopes yield different ids" passes.
   `extensionIntegration.test.ts` asserts that `createTreeIdScope(` appears exactly once
   in `src/extension.ts` and that `treeId` is passed to all three provider constructors.
4. **Leaf rows are unchanged (`None`, no `id`, same labels, commands, and context
   values)** — pass. The diff touches only the group branches of `getTreeItem`. Leaf,
   message, error, and row code is byte-identical to `origin/main`. Electron
   `assertLeaf` checks delivery and initiative-member leaves for `None` and
   `id === undefined`. The unit spec test checks `collapsible: "none"` with no `idParts`
   for diagnostics, members, and the empty and error rows. All existing label,
   command, and context-value assertions pass unchanged.
5. **Real VS Code: all groups collapsed after a window reload** — pass. Step 3.4 links
   [evidence/step-3-4-collapsed-after-reload.png](evidence/step-3-4-collapsed-after-reload.png),
   which exists (455 338 bytes). I viewed it: Deliveries (Paused, Shipped), Initiatives
   (agento-extension, external-artifact-repo, workflow-orchestration), and
   Session & Doctor (Session, Companion, Doctor) are all collapsed, and no secrets are
   visible. This is a `(manual)` step under §1/§3 because the agent cannot drive the
   user's VS Code window. The Electron assertions are the machine-checkable half.
6. **`docs/extension.md` and `CHANGELOG.md` describe the default** — pass. The grep
   matches both files. The docs sentence and the `## Unreleased` "Changed." entry state
   both halves of the behavior: collapsed per window, and stable within a window.
7. **Full gate green against the recorded baseline; both trees clean** — pass. See the
   table above. Every result matches or exceeds the baseline, and
   `git status --porcelain --untracked-files=all` is empty in both halves.

## Plan vs implementation

- The implementation follows Approach steps 1–7 file for file. The 12 changed product
  files are exactly the plan's affected-files list plus
  `extension/test/unit/extensionIntegration.test.ts`, which acceptance item 3 names.
- One documented ordering deviation: the single `createTreeIdScope()` in `activate()`
  landed in step 2.2 rather than 2.5, because the new constructor parameter would not
  compile without it. Roadmap 2.2 records this, and 2.5 still adds the source-shape
  assertion. No effect on the outcome.
- Step 4.1 ran before manual step 3.4. Roadmap 4.1 records this and re-confirms after
  3.4 that HEAD was unchanged at `b3eac7b`. My rerun at the same HEAD reproduces every
  4.1 result.
- No undocumented changes. `scripts/` is untouched, so `extension/cli/` needs no
  re-copy (`npm run build` → `copy-cli` left the tree clean).

## Roadmap audit

I spot-checked all 11 ticked boxes against the code and found no falsely ticked boxes
and no repairs needed:

- 1.1: the recorded baseline is consistent with the plan's planning baseline. The
  Reviewer rerun is green.
- 2.1–2.5: each is present in the diff exactly as described (`treeItemIds.ts`, the
  provider constructors and ids, the `idParts` specs, the single scope in `activate()`,
  the source-shape test). Unit count is 124 as recorded.
- 3.1: the Electron assertions are present and pass in all three scenarios.
- 3.2: the docs and CHANGELOG lines match the recorded line numbers.
- 3.3: the `.vsix` was a byproduct, deleted after 3.4 by design. It is not present now,
  and the 3.4 evidence attests that it was installed. The step names the absolute path
  and size.
- 3.4 `(manual)`: has a linked evidence file that exists and shows the required state
  (§3 satisfied).
- 4.1: reproduced exactly (see the gate table).
- There are no `(manual, post-ship)` steps.

## Findings

1. **Minor — explicit initiative ids turn a duplicate initiative slug into a hard tree
   error.**
   - **Where:** `extension/src/initiativeTreePresentation.ts` (`idParts:
     ["initiative", element.item.slug]` and `["group", element.initiativeSlug, kind]`).
   - **What changed:** the initiative slug is the breakdown directory's basename
     (`parseBreakdown` in `scripts/agento.mjs`). Two `initiatives/<yyyy>/<mm>/<slug>/`
     directories with the same basename would yield identical `TreeItem.id`s. VS Code
     rejects duplicate ids in one tree, so the Initiatives view would fail to render.
     Before this change, label-derived handles were de-duplicated by the workbench.
   - **Why it is minor:** `/agento new-initiative` reserves the slug before writing
     (step 5: `agento.mjs initiative <slug>` must be `missing`), so only hand-created
     directories can collide. The CLI already resolves `initiative <slug>` to the first
     match, so that state is degraded anyway.
   - **Not blocking.** Recorded as a follow-up.
2. **Nit — Session & Doctor leaf rows have no explicit `None`/no-`id` assertion.** The
   rows' code is unchanged (verified in the diff), and the plan only required explicit
   leaf assertions for deliveries and members, so this is not an acceptance gap.

No security findings. The nonce is `crypto.randomUUID()`, used only as an opaque
tree-handle prefix. Nothing is persisted, logged, or derived from user input.

## Follow-ups

- Make tree ids robust to duplicate initiative slugs: key initiative and group ids on
  the breakdown's `dir` rather than its basename slug, or surface duplicate initiative
  slugs as a CLI diagnostic the way `status` reports `duplicates` for deliveries.
