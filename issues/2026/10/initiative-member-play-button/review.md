# Review: initiative-member-play-button

Verdict: approve

Review round 2, 2026-10-03. Product branch `issue/initiative-member-play-button` at
`506b39c` (code PR #83, draft, open), companion branch at `d55adf9` (artifact PR #24,
draft, open), issue #82. After `git fetch origin` in both halves, `origin/main` is an
ancestor of both HEADs (`git merge-base --is-ancestor`, exit 0); both halves are level
with their remote branches; session record `companion.dirty: false`, `ahead: 0`.

Round 1 (`request-changes`) raised Finding 1 (medium: no message-path assertion for
acceptance item 4), Finding 2 (minor: README reflow), and an undocumented deviation.
The Builder addressed them in roadmap steps 5.1–5.4 (product commits `77fe7cf`,
`506b39c`; companion commits `c6f1da9`..`d55adf9`).

Skills consulted: none — no matching domain (no `.agents/skills/` in the repository
and no `## Agento` skills table in AGENTS.md).

Verification re-run by the Reviewer at `506b39c` (product checkout, 2026-10-03):

| Check | Exit | Result |
| --- | --- | --- |
| `cd extension && npm run typecheck` | 0 | no findings |
| `cd extension && npm run test:unit` | 0 | 110 tests, 110 pass, 0 fail (incl. `initiativeMemberActions.test.ts`) |
| `cd extension && npm run test:electron` | 0 | "Electron in-repo scenario passed", "Electron companion scenario passed", "Electron workspace scenario passed"; no `AssertionError` |
| `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | 0 | 274 tests, 274 pass, 0 fail |
| `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` | 0 | guard smoke green (no hook changes in this delivery) |
| `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` | n/a | `command -v shellcheck` exit 1 — not installed; matches the recorded 127 baseline; no shell files changed |

Lint gate (§5): baseline green for everything runnable, full gate planned; fresh
results identical to the baseline — no new findings.

## Acceptance checklist results

1. **Regression test fails before, passes after — pass.**
   `extension/test/unit/initiativeMemberActions.test.ts` line 1 carries
   `// Regression test for #82 initiative-member-play-button`. At `9809449` the
   imported module does not exist (`git cat-file -e
   9809449:extension/src/initiativeMemberActions.ts` → exit 128) and
   `origin/main:extension/package.json` has 0 `initiativeMember.in-flight` entries,
   so the test cannot pass there; the commit body quotes `error TS2307: Cannot find
   module '../../src/initiativeMemberActions.js'`. Passes now (unit run above).
2. **Manifest inline entry — pass.** `extension/package.json` adds
   `{ command: agento.showActions, when: view == agento.initiatives && viewItem ==
   agento.initiativeMember.in-flight, group: inline }`; the three-entry `deepEqual`
   in `extensionIntegration.test.ts` passes.
3. **`agento.showActions` on an in-flight member opens the matching delivery's
   actions, never session actions — pass (as the verify line defines it).** Resolver
   unit test "in-flight member resolves to the matching delivery's actions" passes;
   the electron suite asserts `building-delivery`'s member `contextValue` is
   `agento.initiativeMember.in-flight` and that the resolver's actions deep-equal
   the Deliveries row's (non-empty) actions in both in-repo and companion scenarios.
   The `element?.kind === "member"` branch in `extension/src/extension.ts`
   (`registerCommand("agento.showActions", …)`) never reaches the session fallback.
4. **No matching delivery → informational message naming the slug, nothing
   dispatched — pass.** Unit half: "in-flight member without a matching delivery
   resolves to empty actions". Message path (new in `77fe7cf`):
   `assertOrphanMemberShowsMessage` in `extension/test/electron/suite.ts` clones the
   in-flight `building-delivery` member with slug `orphan-delivery`, asserts the
   resolver returns `{ slug, actions: [] }`, replaces `vscode.window.showInformationMessage`
   and `vscode.window.showQuickPick` with recorders (restored in `finally`), executes
   `agento.showActions` with the element, and asserts exactly one message
   `No Agento actions are available for orphan-delivery in this window.` and no
   picker. The recorder can only capture the message if the stub reaches the
   extension's `vscode` API object, so the passing `deepEqual` also proves the stub is
   effective. Dispatch is reachable only through `pickCommandAction` →
   `showQuickPick` (`extension/src/actionPicker.ts`), so "no picker" implies nothing
   dispatched. Called from `run()`, it executes in the in-repo and companion
   scenarios, both passing in the Reviewer's run.
5. **Ready / Blocked / Complete unchanged — pass.** Manifest `deepEqual` keeps the
   `planInitiativeMember` ready entry and adds no blocked/complete entry; the resolver
   returns `null` for ready/blocked/complete members (unit test "other members and
   non-member elements resolve to null"); `initiativeTreeProvider` tests pass within
   the 110/110 unit run.
6. **Docs describe the in-flight play action — pass.** `docs/extension.md`
   (Initiatives paragraph), `extension/README.md` (Initiatives and Commands
   sections, the latter now reflowed), `CHANGELOG.md` **Fixed** entry referencing #82.
7. **Full gate — pass.** Exit codes in the table above, re-run by the Reviewer.

## Plan vs implementation

- Matches `## Approach` steps 1–7: vscode-free resolver
  (`extension/src/initiativeMemberActions.ts`), command wiring, manifest entry,
  regression test, electron assertion, docs/changelog, no `extension/cli/` change.
- Deviation (benign, now documented): the empty-actions message names the slug for
  **Deliveries** rows too (`source?.slug` is set by `deliveryActionSource`). plan.md
  `## Resolution` line 230 records it (step 5.3).
- Deviation (benign, documented): `deliveryActionSource` in
  `extension/src/actionPicker.ts` was widened to accept `InitiativeTreeElement`; it
  still matches only `kind: "delivery"`.
- Round-1 gap closed: the message-path assertion is now roadmap step 5.1 and is in
  the electron suite.
- Source unchanged since round 1: `git diff 5de7202..506b39c` touches only
  `extension/test/electron/suite.ts` and `extension/README.md`.

## Roadmap audit

- Steps 1.1–4.4: audited in round 1 (commits `9809449`..`5de7202`); the code they
  cover is unchanged since, and the Reviewer's gate run reproduces their exit codes.
- 5.1: `77fe7cf` adds `assertOrphanMemberShowsMessage` (+23 lines,
  `extension/test/electron/suite.ts` only) and calls it after the existing
  `building-delivery` assertions; electron exit 0 reproduced.
- 5.2: `506b39c` — `git diff --word-diff=porcelain 77fe7cf..506b39c --
  extension/README.md` shows no added or removed words; the paragraph's lines are
  83–85 characters with the last line `dispatch.`.
- 5.3: plan.md `## Resolution` line 230 reads "The slug-named message applies to
  Deliveries rows too, since `deliveryActionSource` also supplies a slug."
- 5.4: gate exit codes reproduced (table above); `origin/main` an ancestor of both
  HEADs; both halves pushed; `companion.dirty: false`, `ahead: 0`.
- All 15 ticked steps hold. No falsely ticked boxes and no `(manual)` steps.
  Roadmap repair: `next-step` updated to the ship handoff; `status` stays `in-review`.

## Findings

None open.

Round-1 findings resolved:

1. Medium — acceptance item 4 lacked its message-path verification → resolved by
   step 5.1 (`77fe7cf`); see acceptance item 4.
2. Minor — `extension/README.md` Commands paragraph short line → resolved by
   step 5.2 (`506b39c`), whitespace-only.

No security findings: the change reads in-memory tree state only, executes no shell,
and the dispatched commands remain CLI-derived and revalidated with
`agento.mjs next <slug>`.

## Follow-ups

- None.
