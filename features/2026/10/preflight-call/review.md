# Review: preflight-call

Verdict: approve

Reviewed 2026-10-12 at product `d630063` (code PR #110) and companion `b8e56c7`
(artifact PR #47). `origin/main` is an ancestor of both halves; both halves are on
`feature/preflight-call`, clean, 0 ahead / 0 behind. Op-id
`review-feature:preflight-call:d630063`.

Skills consulted: none — no matching domain (the repository has no `.agents/skills/`
and no skills table in AGENTS.md); prompt/agent structure judged against
`tests/customizations.test.mjs`.

## Acceptance checklist results

1. **pass (with the documented deviation)** — `preflight` returns the named sections.
   Run with this branch's CLI from the primary checkout (`/home/david/DP/agento`, on
   `main`): `preflight delivery-status` exits 0 with keys
   `status,command,opId,subject,receipt,preflightLines,session,window,doctor,resolve,config,root,configSource`
   and `Receipt: accepted delivery-status:main:3582bdb`. The item's literal command,
   `preflight new-feature`, exits 3 there with the same keys — correctly, because
   new-feature's own window line requires role `plan`. The Builder recorded this verify
   repair on roadmap step 1.1; the plan.md text was not amended (see Plan vs
   implementation).
2. **pass** — exit 3 with the §9 spellings. In this build window: `preflight
   review-feature other-slug` → exit 3, `Receipt: rejected — wrong window: this build
   window holds preflight-call, not other-slug (…); allowed: …, /agento ship
   preflight-call (primary window)`; `preflight ship preflight-call` → exit 3, `wrong
   window: role=build (…)`. Hard doctor fail covered by
   `scripts/agento.test.mjs` "preflight turns doctor warn into preflight lines (exit 0)
   and a hard fail into the capability receipt (exit 3)" (no `gh` →
   `Receipt: rejected — gh: gh CLI not found on PATH; fallback: …`).
3. **pass** — all 25 prompts and 6 agents open with one `agento.mjs preflight` call;
   enforced by the two new customizations tests (`HAND_RUN_OPENING` forbids
   `doctor --for`, `agento.mjs resolve`, bare `agento.mjs session`, and
   `rev-parse --short HEAD`). `grep -Rn "doctor --for" .github/prompts .github/agents`
   → no matches (exit 1). All 25 `commands/<name>.md` mirrors are byte-identical
   (`cmp`, 0 mismatches).
4. **pass** — customizations tests pass within the full run below, including the
   rewritten preflight tests, the unchanged needs-table test, and the new
   "the CLI WINDOW_ROLES table agrees with every command's window check line" test.
5. **pass** — `scripts/agento.test.mjs` passes within the full run, including four new
   `preflight` tests (shape/op-id/section parity, window mismatch + §11 branch/clean
   conditions + build-window slug check, doctor warn/fail mapping, usage errors).
6. **pass** — `doctor --for review-feature` standalone: exit 0,
   `for: {"command":"review-feature","needs":["terminal","browser","gh","network"]}`,
   checks `node,git-remote,gh,worktrees-dir,session-workspace,artifact-repo`; the
   preflight test asserts `json.doctor` deep-equals the standalone `doctor --for`
   document.
7. **pass** — full gate, fresh run against the green baseline (447 tests at `3582bdb`):
   - `timeout 400 node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → exit 0,
     453 tests, 453 pass, 0 fail.
   - `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` → exit 0.
   - `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` → exit 0.
   - `git ls-files '*.sh' | xargs pnpm dlx shellcheck` → exit 0, no output.
   - `cd extension && npm run copy-cli && npm run test:unit` → both exit 0, 167 tests,
     167 pass; `git status --porcelain` empty afterwards (the committed
     `extension/cli/` copy was already current).

## Plan vs implementation

- **Deviation (documented):** acceptance item 1 and the original step 1.1 verify
  expected `preflight new-feature` to exit 0 in the primary checkout; that contradicts
  new-feature's §11 line (`requires role plan`). The Builder repaired the roadmap
  verify (step 1.1 note) to use `preflight delivery-status` and assert the exit-3
  rejection for new-feature. Correct call; plan.md item 1 still carries the old text.
- **Deviation (documented):** `WINDOW_ROLES` and `windowVerdict` live in
  `scripts/session-state.mjs` beside `deriveAllowed` rather than in `agento.mjs`; the
  policy §11 pointer was updated to match.
- **Additive (documented):** `preflight` also accepts `<type>/<slug>` and a bare
  `<slug>` (resolved like `find`); `config`/`resolve`/`find` cases were refactored onto
  the shared `configDocument()` / `resolveDocument()` helpers with unchanged output
  (existing resolve/find tests pass).
- **Additive (documented):** policy §1 capability bullet corrected to name the
  preflight call (step 3.1 note).
- No undocumented changes found: the diff (65 files) is confined to the CLI,
  session-state, prompts/agents/mirrors, policy §1/§9–§11, docs/commands.md,
  CHANGELOG.md, the regenerated `extension/cli/`, and the two test files.

## Roadmap audit

All seven ticked boxes spot-checked against the code and re-run where executable:

- 1.1 ✓ — `preflight` case, `opIdFor`, `receiptLines`, `preflightDocument` in
  `scripts/agento.mjs`; `WINDOW_ROLES`/`windowVerdict` in `scripts/session-state.mjs`;
  usage header line present; `preflight nope` exits 1.
- 1.2 ✓ — four `preflight` tests in `scripts/agento.test.mjs`.
- 2.1 ✓ / 2.2 ✓ — enforced by the new customizations tests; grep clean.
- 3.1 ✓ — §9 op-id paragraph, §10 "When `doctor` runs", §11 step 1–3 updated; all
  `## N.` anchors intact (customizations `§N` tests pass).
- 3.2 ✓ — `docs/commands.md`, `CHANGELOG.md`, `extension/cli/` current.
- 4.1 ✓ — reproduced above (453/453, guards 0, shellcheck 0, extension 167/167).

No falsely ticked boxes; no missing steps; no `(manual)` or `(manual, post-ship)`
steps. Repairs made: two review follow-ups appended to the roadmap's `## Follow-ups`.

## Findings

No finding above minor severity.

1. **Minor — Autopilot no-slug path is ambiguous.**
   `.github/agents/delivery-autopilot.agent.md` step 1 says to run `preflight ap
   <slug>` and "stop on a `resolve.status` other than `ok`", then "when the invocation
   names no slug … the slug is the session record's `delivery.slug`". Run without a
   slug (the Reviewer's "Continue unattended" handoff), `preflight ap` returns
   `resolve: null` and op-id `ap:plan-20261012-052102:d630063` (verified in this
   window), so a literal reading stops, and the op-id differs from the slugged
   `ap:preflight-call:…` for the same operation. Suggested fix: when no slug is passed
   and the role is in the command's `slugRoles`, have `preflightDocument` default the
   slug to `session.delivery.slug` (resolve + op-id), or state in the agent that a
   null `resolve` is resolved from the record.
2. **Minor (pre-existing, already a roadmap follow-up) — self-referencing rejection.**
   `CREATE` in `scripts/session-state.mjs` lists `/agento new-feature` and
   `/agento new-issue` for the primary window, so `preflight new-feature` from the
   primary rejects with `allowed: … /agento new-feature …` (verified). Now that the
   window check is mechanical, the contradiction is user-visible.
3. **Nit — `resolve` section shape varies.** With `<type> <slug>` or `<type>/<slug>`
   the section has no `type` key (`resolve.type` → `undefined`, verified with
   `preflight review-feature feature/preflight-call`); a bare slug includes `type`.
   `ship.prompt.md` reads `type` from a bare-slug call, so nothing breaks today.
4. **Nit — plan.md acceptance item 1 text is stale** relative to the roadmap 1.1
   repair (outside the Reviewer's edit scope).
5. **Nit — ship runs the doctor probes twice** (`preflight ship` then the `ship`
   subcommand's own in-process doctor), i.e. two `git ls-remote`/`gh auth status`
   rounds per ship call; acknowledged in `ship.prompt.md` wording.

## Follow-ups

- `preflight` without a slug in a slug-bound window (`ap`, `build-*`, `review-*`,
  `continue`) should default to `session.delivery.slug` for `resolve` and the op-id
  subject, so the Autopilot's no-slug handoff and duplicate detection match the
  slugged invocation (Finding 1).
- Include `type` in the `resolve` section for typed invocations too, so consumers can
  read it uniformly (Finding 3).
- Align `deriveAllowed`'s primary `CREATE` row with new-feature/new-issue's window
  lines (Finding 2; already listed in the roadmap).
