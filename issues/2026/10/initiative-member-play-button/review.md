# Review: initiative-member-play-button

Verdict: request-changes

Reviewed 2026-10-03, product branch `issue/initiative-member-play-button` at
`5de7202` (code PR #83), companion branch at `61e73f4` (artifact PR #24), issue #82.
`origin/main` is an ancestor of both HEADs (`git merge-base --is-ancestor`, exit 0).

Skills consulted: none — no matching domain (no `.agents/skills/` in the repository
and no `## Agento` skills table in AGENTS.md).

Verification re-run by the Reviewer (product checkout, 2026-10-03):

| Check | Exit | Result |
| --- | --- | --- |
| `cd extension && npm run typecheck` | 0 | no findings |
| `cd extension && npm run test:unit` | 0 | 110 tests, 110 pass, 0 fail (incl. `initiativeMemberActions.test.ts`) |
| `cd extension && npm run test:electron` | 0 | in-repo, companion, workspace scenarios passed |
| `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | 0 | 274 tests, 274 pass, 0 fail |
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
   dispatched — fail (verification incomplete).** The verify line requires "unit test
   asserts empty `actions`; electron/unit assertion on the message path". The first
   half exists ("in-flight member without a matching delivery resolves to empty
   actions"). No test asserts the message path: `grep -rn "No Agento actions"
   extension/test` returns nothing, and no test executes `agento.showActions` with a
   member element. The slug-naming message and the early `return` before
   `pickCommandAction` are verified only by code reading. A missing verification is a
   failing verification.
5. **Ready / Blocked / Complete unchanged — pass.** Manifest `deepEqual` keeps the
   `planInitiativeMember` ready entry and adds no blocked/complete entry; the resolver
   returns `null` for ready/blocked/complete members (unit test "other members and
   non-member elements resolve to null"); `initiativeTreeProvider` tests pass within
   the 110/110 unit run.
6. **Docs describe the in-flight play action — pass.** `docs/extension.md`
   (Initiatives paragraph), `extension/README.md` (Initiatives and Commands
   sections), `CHANGELOG.md` **Fixed** entry referencing #82.
7. **Full gate — pass.** Exit codes in the table above, re-run by the Reviewer.

## Plan vs implementation

- Matches `## Approach` steps 1–7: vscode-free resolver
  (`extension/src/initiativeMemberActions.ts`), command wiring, manifest entry,
  regression test, electron assertion, docs/changelog, no `extension/cli/` change.
- Deviation (benign, undocumented): the empty-actions message now names the slug for
  **Deliveries** rows too (`source?.slug` is set by `deliveryActionSource`), not only
  for initiative members. Harmless and arguably better; worth one line in the
  Resolution.
- Deviation (benign): `deliveryActionSource` in `extension/src/actionPicker.ts` was
  widened to accept `InitiativeTreeElement`; it still matches only
  `kind: "delivery"`. Documented in the Resolution.
- Gap: the plan's "electron/unit assertion on the message path" (acceptance item 4)
  was not carried into any roadmap step — step 2.2's verify is typecheck + source
  regexes only.

## Roadmap audit

- Spot-checked all 11 ticked steps against the code and commits: 1.1/1.2
  (`9809449`, body quotes the failure), 2.1 (`b92e606`), 2.2 (`a83444a`), 2.3
  (`4394f73`), 3.1 (`c90dcbe`), 3.2 (`runTest.ts` iterates three scenarios; Reviewer
  run printed 3 "scenario passed" lines), 4.1 (`691e7ab`), 4.2 (`5de7202`), 4.3
  (exit codes reproduced), 4.4 (Resolution written, both halves integrated and
  pushed, `companion.dirty: false`, `ahead: 0`). No falsely ticked boxes.
- Added step 5.1 `(added 2026-10-03)` for the missing message-path assertion and
  updated `next-step`; `status` stays `in-review`.

## Findings

1. **Medium — acceptance item 4 lacks its planned verification.** No automated test
   covers `agento.showActions` with an in-flight member that has no Deliveries row:
   neither the slug-naming information message nor the "dispatches nothing" early
   return is asserted. Suggested fix (electron suite, which already holds the
   `vscode` API): construct an in-flight `member` element whose slug has no
   Deliveries row, temporarily replace `vscode.window.showInformationMessage` with a
   recorder, `await vscode.commands.executeCommand("agento.showActions", element)`,
   restore it, and assert one message equal to `No Agento actions are available for
   <slug> in this window.` and that no picker/dispatch occurred. Optionally the same
   harness can assert that a member with a matching delivery does not use the
   session's actions.
2. **Minor — `extension/README.md` Commands paragraph reflow.** The edit leaves a
   short line ("…or the Session &\nDoctor title opens a picker in\nthe exact order…").
   Cosmetic; reflow when touching the file.

No security findings: the change reads in-memory tree state only, executes no shell,
and the dispatched commands remain CLI-derived and revalidated with
`agento.mjs next <slug>`.

## Follow-ups

- None.
