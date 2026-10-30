# Review: lean-command-context

Verdict: approve

Reviewed 2026-10-30 (round 1) against plan.md and roadmap.md at companion HEAD, code
at product `f7721a7` (`feature/lean-command-context`, PR david-perry-software/agento#137;
companion PR agento-docs#71). `origin/main` (`3ec4e5e`) is an ancestor of both halves;
both halves were clean, `ahead: 0`, `behind: 0` at review start.

Verification I ran myself in the product checkout:

- `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'` →
  exit 0, **838 tests, 838 pass, 0 fail** (baseline 827/827; +11 new tests).
- All five AGENTS.md guard smokes (`replay-guard.sh` default, `REPLAY_COMPANION=1`,
  `REPLAY_FORMAT=copilot`, `REPLAY_FORMAT=copilot REPLAY_COMPANION=1`,
  `REPLAY_FORMAT=copilot` with `guard-fixtures-copilot.txt`) → each exit 0.
- `cd extension && npm run test:unit` → exit 0, 251 pass, 0 fail.
- `command -v shellcheck` → not installed; `git diff --stat origin/main...HEAD` touches
  no `.sh` file, so the plan's "unavailable; no shell file changed" record holds.
- Negative test for the declared-sections test: dropping `§11` from
  `doctor.prompt.md`'s `Policy:` line in a scratch edit made
  "every agent, prompt, and mirror declares its policy sections on one Policy: line"
  fail with `declared set must equal {1,9,10,11,12} ∪ cited`; the edit was reverted
  and the tree is clean.

## Acceptance checklist results

1. **`policy` printer** — **pass.** `node scripts/agento.mjs policy 1 9` prints one
   header line then the `## 1.` and `## 9.` sections (the test compares byte-for-byte
   against file slices and checks `9 1 9 1` dedupes/sorts to the same output).
   `policy 13`, `policy x`, and bare `policy` each exit 1 (run by hand). `policy
   --list` returns 12 entries; `// --- policy` block in `scripts/agento.test.mjs`.
2. **One `Policy:` line per agent/prompt/mirror, mechanically derived set** — **pass.**
   `tests/customizations.test.mjs` "every agent, prompt, and mirror declares its policy
   sections on one Policy: line" asserts exactly one line, `§` list == `policy` args,
   set == {1,9,10,11,12} ∪ cited (∪ agent-cited), and every §N in `policy --list`.
   `grep -rn "Policy: read" .github skills` → 0 hits. `cmp` of all 26 prompt/mirror
   pairs succeeds. Negative test above confirms the test bites.
3. **Core ≤ 40 lines and router skill point at the `Policy:` line** — **pass.**
   `wc -l .github/instructions/agento-core.instructions.md` = 39; `grep "Read it
   once"` → nothing; the core now says "Load the sections a command's (or … the
   agent's) `Policy:` line declares … load any other cited §N on demand with
   `agento.mjs policy N`". `skills/agento/SKILL.md` step 5 gained the paragraph
   covering inline, inline-as-agent, and subagent modes.
4. **§9/§10/§11 shrunk to model-performed rules; reference moved; `Duplicate
   submission:` lines** — **pass.** Removed-sentence comparison (`git diff
   origin/main...HEAD -- .github/instructions/delivery-policy.instructions.md` vs
   `docs/architecture.md` "## Policy reference"):
   - §9 receipt variants, op-id grammar, idempotency table → architecture.md verbatim
     (test "the moved receipts/preflight/window reference lives in
     docs/architecture.md" pins the headings). Kept: print verbatim / stop on
     rejected with §12 blocks / duplicate receipt form / `Result:` spellings incl.
     paused & session break.
   - §10 vocabulary, hard/soft, Declaration contract, "When doctor runs" →
     architecture.md; new "`Policy:` line contract" added there. Kept: trust the
     preflight doctor verdict, Standard fallbacks, Recommended choice. "Never
     discovered mid-command" survives in §1.
   - §11 numbered procedure and record catalogue → architecture.md. Kept: mismatch →
     receipt + blocks, write nothing; record replaces git inspection;
     worktree-mutating commands use `preflight --full`/`agento.mjs session` for
     `worktrees[]`; branch-condition sentence. The `unmanaged` fix path lives in the
     CLI reason string (`session-state.mjs:492`) and in brief `window.primary`;
     "hosted is no exemption" and "never carve out an exception for `main`" are
     subsumed by "stop on rejected, write nothing".
   - `§9 + §10 + §11` = 1,174 + 2,002 + 1,235 = **4,411 bytes** (≤ 5,000).
   - 26/26 prompts carry exactly one `Duplicate submission:` line equal to the docs
     table row (test "every command carries exactly one Duplicate submission: line
     matching its idempotency-table row"; `mission-control` row added to the table).
     `grep -rn "idempotency row" .github skills` → 0.
5. **Brief preflight by default, `--full` unchanged, no prompt reads a dropped
   field** — **pass.** `scripts/agento.test.mjs` "preflight defaults to the brief
   document; --full keeps the pre-change shape" pins both key sets; the original
   13-key assertion now runs under `--full`. `tests/customizations.test.mjs` "every
   session.X/window.X/doctor.X field a prompt, agent, or mirror names exists in the
   brief preflight document" runs against a fixture repo. The 4.1 inventory (commit
   `f631624`) moved `worktrees[]`/`worktrees[0].path` consumers to `agento.mjs
   session` and `config` consumers to `agento.mjs config`; `grep -rn -- --full
   .github skills` → no prompt needs it. `start-session`, `close-session`, and `ship`
   obtain ownership through their CLI subcommands; `start-freehand` reads
   `agento.mjs session`'s `worktrees[]`.
6. **Brief output ≤ 2,500 bytes in a plan window with ≥ 3 worktrees** — **pass.**
   Test "brief preflight output stays ≤ 2,500 bytes in a plan window with ≥ 3
   registered worktrees" passes. Builder's manual plan-window run: 1,698 bytes
   (commit `50694ef`). My run in this *promoted build* window: `preflight
   new-feature` = 2,653 bytes and `preflight review-feature feature
   lean-command-context` = 3,234 bytes (both carry a populated `session.delivery`
   and the latter a `resolve` section, which a plan window does not); `--full` =
   10,745 bytes. The acceptance text says "recorded in the PR" — the number is in the
   step commit and now here, not in PR #137's body (see Findings #2).
7. **No agent file grows; total agent bytes down; removals are restatements** —
   **pass.** `wc -c` at `3ec4e5e` → HEAD: copilot-mechanic 10,893→10,849 (−44),
   delivery-autopilot 9,549→9,442 (−107), delivery-builder 11,200→10,852 (−348),
   delivery-planner 14,143→12,597 (−1,546), delivery-reviewer 8,569→7,930 (−639),
   initiative-architect 10,145→9,551 (−594); **total 64,499→61,221 (−3,278)**.
   Commits `9bbf9a5` and `8b0ae52` list each removed passage → owner. Diff audit:
   Builder keeps `reverify`/`integration-conflict` handling; Reviewer step 8 keeps
   rejected/failed/reauth handling and the one-comment rule; Planner step 1 keeps the
   `plan`/promoted-`build` requirement and "from the detached `origin/main` HEAD" in
   step 5; Architect delegates publish-pr mechanics to the CLI usage line. Nothing
   model-performed was dropped without an owner (see Findings #1 for the one hint
   lost).
8. **Context-budget test (≤ 40,000 each, mean ≤ 24,000); before/after table in
   plan.md and PR body** — **pass.** Test "every command's declared context stays
   within the budget" passes. I recomputed independently: n=26, **mean 20,502, max
   33,291 (`new-issue`)**, matching the plan.md "Build addendum" table (26 rows,
   before/after/delta). The table is in plan.md, not in PR #137's body (Findings #2).
9. **`extension/cli/` matches `scripts/`** — **pass.** `cmp` of every non-test
   `scripts/*.mjs` against `extension/cli/` succeeds (test files are not part of the
   bundle by design); `tests/extension-bundle.test.mjs` is in the green full suite.
10. **Full gate** — **pass.** 838/838, five guard smokes exit 0, extension unit 251/251,
    shellcheck unavailable with no shell file changed (all run by me, above).
11. **Docs** — **pass.** `docs/architecture.md` (:62-68 per-section load, :134+ "Policy
    reference" incl. `Policy:` line contract), `docs/commands.md` (:659, :663),
    `README.md` (:64, :74), `CHANGELOG.md` (:7-11) describe `agento.mjs policy`, the
    `Policy:` line, and `preflight --full`.

## Plan vs implementation

- Approach 1–7 implemented as written; section numbering §1–§12 unchanged; mirrors and
  extension copy byte-identical.
- Deviation (benign): the plan said `Fallback:` pointer lines become "Standard
  fallbacks: delivery-policy §10." — done in all 32 files. The `<agento-root>`
  derivation clause that rode on the old `Policy: read …` line was not re-homed
  (Findings #1).
- Deviation (benign): acceptance items 6, 7, 8 name "the PR body" as a recording
  surface; the Builder recorded the numbers in plan.md and step commit messages
  instead, and PR #137's body carries only the plan link (Findings #2). The roadmap
  never had a PR-body step, so this is plan/roadmap drift, not a false tick.
- Undocumented but in scope: the idempotency table gained a `/agento mission-control`
  row (commit `58833a2` names it); brief output adds `window.primary` for
  `role: unmanaged` (tested).

## Roadmap audit

All 18 ticked steps spot-checked against the codebase; **no falsely ticked box**, no
`(manual)` steps, no repairs made.

- 1.1 `policy` case + `policySections()` + tests ✓ · 2.1 32 `Policy:` lines, 0 `Policy:
  read` ✓ · 2.2 core 39 lines, SKILL.md step 5 ✓ · 2.3 test + negative check ✓ ·
  3.1 verbatim blocks in architecture.md ✓ · 3.2 26 `Duplicate submission:` lines,
  0 "idempotency row" ✓ · 3.3 4,411 bytes ✓ · 3.4 test ✓ · 4.1 inventory in
  `f631624` ✓ · 4.2 brief/`--full` tests ✓ · 4.3 field test + manual number ✓ ·
  5.1/5.2 bytes down, owners in commits ✓ · 6.1 test ✓ · 6.2 table matches recompute
  ✓ · 7.1 docs greps ✓ · 7.2 `cmp` ✓ · 8.1 gate recorded, reproduced ✓.

## Findings

1. **Minor — `<agento-root>` derivation hint lost in three prompts.** The old
   `Policy: read …` line ended with "`<agento-root>` comes from the session context
   line `Agento CLI: node <agento-root>/scripts/agento.mjs`". The new line drops it.
   The six agents still carry an "announced in the session context as `Agento CLI:`"
   mention elsewhere, and `skills/agento/SKILL.md` §3 defines root discovery for CLI
   harnesses, but `.github/prompts/commit-current-changes.prompt.md`,
   `finish-freehand.prompt.md`, and `mission-control.prompt.md` (all `agent: "agent"`)
   now use `<agento-root>` three times each with no definition in the file, the core,
   or the policy. The SessionStart `Agento CLI:` line makes the inference easy, so no
   behavior is blocked. Suggested home: one sentence in the `Policy:` line contract
   (docs/architecture.md) and the core (at 39/40 lines, one line is available).
2. **Minor — PR #137 body lacks the recording surfaces acceptance items 6–8 name.**
   The before/after context table (plan.md Build addendum), the agent `wc -c` deltas
   (reproduced above), and the manual brief size (1,698 bytes, commit `50694ef`) are
   durable in the companion half and git history but not in the code PR body, which
   holds only the plan link. Informational for ship; `gh pr edit 137 --body` can add
   them.
3. **Informational — local step pointers dropped with the duplicate parentheticals.**
   Prompts previously said e.g. "(… step 1 recovers it from repository state)" /
   "(see step 2 for the suffix rule)" after "idempotency row"; the `Duplicate
   submission:` line now carries the semantics without the in-file step pointer. No
   rule lost.
4. **Informational — Planner step 1 wording.** "clean, detached, and at `origin/main`"
   became "Start from a synchronized `main`"; the detached-at-`origin/main` state is
   what `start-session` creates, step 5 still says "from the detached `origin/main`
   HEAD", and `plan-publish` rejects `outside-slug` changes. No rule lost.

No security findings: `policy` reads only the plugin's own policy file under
`PLUGIN_ROOT`; `emitRaw` mirrors `emit`'s EAGAIN loop; no new secrets, network, or
shell surface.

## Follow-ups

- Re-home the `<agento-root>` derivation sentence (Findings #1) in the `Policy:` line
  contract and/or the always-on core so `agent: "agent"` prompts define it.
- Optionally add the before/after context table, agent byte deltas, and manual brief
  size to PR #137's body before ship (Findings #2).
