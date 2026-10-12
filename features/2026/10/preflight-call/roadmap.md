```yaml
status: in-progress
branch: feature/preflight-call
last-updated: 2026-10-12
next-step: "3.1"
artifact-pr: "#47"
initiative: "spend-reduction"
```

## Phase 1: CLI subcommand

- [x] 1.1 Add `agento.mjs preflight <command> [<type> <slug>]` to
  `scripts/agento.mjs`: a `WINDOW_ROLES` table (command → required role + §11
  branch conditions), an `opId(command, subject)` helper, and the `preflight` case
  composing `sessionRecord()`, `doctorDocument(command)`, `resolveWithLayout(type,
  slug)` when a slug is passed, the `config` document, and ready-to-print `receipt`
  + `preflightLines` strings; add the usage header line — verify: `node
  scripts/agento.mjs preflight delivery-status` in the primary checkout prints the
  named sections (`session`, `window`, `doctor`, `resolve`, `config`, `opId`,
  `receipt`, `preflightLines`) and exits 0, `preflight new-feature` there exits 3
  with the §9 window rejection (its window line requires role `plan`), and `node
  scripts/agento.mjs preflight nope` is a usage error (exit 1) (verify repaired
  2026-10-12: the planned `preflight new-feature` exit 0 contradicted new-feature's
  own §11 window line; `WINDOW_ROLES` lives in `scripts/session-state.mjs` beside
  `deriveAllowed`, and `preflight` also accepts `<type>/<slug>` or a bare `<slug>`
  resolved like `find`)

- [x] 1.2 Add the `preflight` test group to `scripts/agento.test.mjs` — output
  shape, op-id derivation, `window` verdict rows (match and mismatch), `resolve`
  embedding (present with a slug, `null` without), `receipt`/`preflightLines`
  strings, and exit codes (0 ok/warn, 3 fail/rejected) — verify: `node --test
  scripts/agento.test.mjs` passes

## Phase 2: Rewire prompts and agents

- [x] 2.1 Rewrite the 25 `.github/prompts/*.prompt.md` files to open with one
  `node <agento-root>/scripts/agento.mjs preflight <name> [<type> <slug>]` call
  and print the returned `receipt`/`preflightLines`, removing their separate
  `session`/`doctor --for`/`resolve`/`rev-parse` opening calls; keep the
  `commands/<name>.md` mirrors byte-identical — verify: `node --test
  tests/customizations.test.mjs` passes

- [x] 2.2 Rewrite the 6 `.github/agents/*.agent.md` files the same way, keeping
  the `Needs:`/`Fallback:` declarations and the `Policy:` read line — verify:
  `node --test tests/customizations.test.mjs` passes and
  `grep -R "doctor --for" .github/prompts .github/agents` shows no hand-run
  opening calls remain (only the preflight-based flow)

## Phase 3: Policy wording, docs, extension copy

- [ ] 3.1 Update §9–§11 wording in
  `.github/instructions/delivery-policy.instructions.md`: §9 op-id is returned by
  the CLI; §10 "When `doctor` runs" runs inside the `preflight` call; §11 step 1
  runs `preflight` — keeping every `## N.` anchor and all §9 spellings — verify:
  `node --test tests/customizations.test.mjs` passes (canary and `§N` tests)

- [ ] 3.2 Regenerate `extension/cli/` and update `docs/commands.md` and
  `CHANGELOG.md` for the new subcommand — verify: `cd extension && npm run
  copy-cli && npm run test:unit` passes and the `agento.test.mjs` usage test still
  passes

## Phase 4: Full gate

- [ ] 4.1 Run the full repository gate and compare against the recorded baseline —
  verify: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` (447+ tests,
  0 fail), both replay-guard runs exit 0, `git ls-files '*.sh' | xargs pnpm dlx
  shellcheck` exits 0 with no new findings

## Follow-ups

- `deriveAllowed` lists `/agento new-feature` and `/agento new-issue` in the
  primary window's `allowed[]` (`CREATE` in `scripts/session-state.mjs`), while both
  commands' §11 window line requires role `plan` (or a promoted `build`); a
  `preflight new-feature` rejection from the primary therefore offers the rejected
  command as an alternative. Pre-existing; align the table with the window lines.
