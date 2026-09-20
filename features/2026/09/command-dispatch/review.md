# Review: command-dispatch

Verdict: approve

## Acceptance checklist results

- Pass — live `node scripts/agento.mjs status --pr` preserves the existing delivery record and emits CLI-derived `allowed[]`/`elsewhere[]`, including `/agento ap command-dispatch`; 130 focused root tests pass and bundled `agento.mjs` plus `session-state.mjs` match source byte-for-byte.
- Pass — delivery and Session models project CLI actions in order with exact command, window, and reason values; projection and malformed-record unit coverage passes, and no TypeScript lifecycle-command matrix exists.
- Pass — unit and Electron checks submit the exact selected same-window command through `workbench.action.chat.open` with `mode: "agent"` and do not execute lifecycle work in the extension.
- Pass — Session and delivery cross-window actions revalidate `next <slug>`, use `/agento continue <slug>`, honor CLI folder/workspace targets, prefer an existing `.code-workspace`, and reject non-primary ship routes. The repaired Electron case records `session-doctor-panel` as the loaded slug and opens `/fixture/primary`.
- Pass — pending records are target-keyed, atomically written and consumed before submission, expire after five minutes, and surface stale, malformed, mismatched, open-target, and Chat failures. Separate-process evidence proves focus consumption without duplicate submission.
- Pass — successful cross-window routing offers `Focus target`; source inspection and tests show no Chat-output reading or remote cancellation.
- Pass — all 56 extension unit tests cover CLI projection, malformed records, routing outcomes, primary-only ship, workspace preference, target matching, expiry, atomic consumption, and Session delivery-slug preservation.
- Pass — both in-repo and companion Electron scenarios pass and prove exact Session and delivery in-window Chat queries in agent mode; the repaired Session cross-window case also proves slug-aware target routing.
- Pass — extension and architecture documentation cover action sources, routing, expiry, companion workspaces, and limitations; the packaged VSIX contains all dispatch modules and all version sources remain `0.5.2`.
- Pass — the complete green baseline is preserved: shellcheck exits 0; root tests pass 214/214; both replay-guard modes exit 0; extension build and 56 unit tests pass; both Electron scenarios pass; VSIX packaging and its 14-entry assertion pass; PR #54 CI is successful.

## Plan vs implementation

Skills consulted: none — no matching domain, consistent with the repository's missing `## Agento` skills table.

The implementation matches the planned CLI-owned action model, dynamic action surfaces, in-window submission, revalidated cross-window routing, pending-record lifecycle, documentation, and package contents. The repaired Session model retains `deliverySlug`, and the action source forwards it so Session cross-window choices call `next <slug>` before routing.

One implementation detail differs from the initial approach: cross-window records use atomic JSON files under extension global storage instead of `globalState`. This resolves the documented multi-process visibility risk while preserving target keys, five-minute expiry, consume-before-submit behavior, and restricted file permissions. The committed two-window traces use distinct source and target Extension Host PIDs and demonstrate primary-folder and companion-workspace focus consumption.

Both product and companion branches are clean, synchronized with their remote feature branches, and contain `origin/main`. Code PR #54 and artifact PR #11 are open drafts with `CLEAN` merge state; code PR CI is successful.

## Roadmap audit

- Pass 1.1 — `session-doctor-panel` is complete, and both delivery halves contain their defaults.
- Pass 1.2 — focused CLI tests and live `status --pr` prove additive action metadata and AP-aware rows.
- Pass 1.3 — extension build and bundle tests pass; copied CLI files are byte-identical.
- Pass 2.1 — action projection tests cover ordered allowed/elsewhere/AP/empty/malformed records.
- Pass 2.2 — routing tests cover here, primary, secondary, workspace preference, fallback, ship rejection, and stale targets.
- Pass 2.3 — pending-store tests cover atomic consumption, duplicate prevention, expiry, malformed and mismatched records.
- Pass 3.1 — manifest and integration tests verify generic delivery and Session action surfaces backed by CLI records.
- Pass 3.2 — both Electron fixture layouts submit exact canonical queries in agent mode.
- Pass 3.3 — routing/store tests pass and committed `evidence/step-3-3-*.jsonl` traces prove separate-process folder and companion-workspace focus handoffs, expiry, and no duplicate submission.
- Pass 4.1 — extension, architecture, command, and changelog documentation match behavior; version remains `0.5.2`.
- Pass 4.2 — every documented full repository and extension gate passes on committed HEAD.
- Pass 4.3 — committed unit and Electron coverage proves Session delivery-slug propagation, `next <slug>` loading, and CLI-target opening.
- Pass 4.4 — `tests/session-context.test.mjs` contains the AP-aware expectation at committed HEAD; the clean 214-test run and PR #54 CI both pass.

No roadmap repairs were required; all 13 ticks are supported and `next-step` is correctly empty.

## Findings

- None.

## Follow-ups

- None.