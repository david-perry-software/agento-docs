# Review: startup-brief-command

Verdict: approve

Reviewed 2026-11-04 (round 1) in the build worktree
`/home/david/DP/agento-worktrees/plan-20261104-062019` at product `ad4dc23`
(`feature/startup-brief-command`, `origin/main` an ancestor, both halves clean,
`ahead 0 / behind 0` against their remotes). Code diff: `git diff origin/main...HEAD`
(99 files, +2675/−1074; 13 commits, one per roadmap step). Artifact diff: companion
`origin/main..HEAD` (19 commits — one artifact commit per step; the two-commit rule
holds for every step).

Skills consulted: none — no matching domain (AGENTS.md has no `## Agento` skills table;
the work is Node CLI, Markdown customization files, and node:test suites).

## Acceptance checklist results

1. **`policy 1…12` output and `policy --list` byte counts identical to the pre-split
   pins; section text lives in `.github/instructions/policy/NN-*.md`** — **pass**.
   Independent check: sliced `git show origin/main:.github/instructions/delivery-policy.instructions.md`
   on `^## N\. ` and compared each slice to `node scripts/agento.mjs policy N` → "all 12
   `policy N` outputs byte-identical to origin/main sections"; the full `policy 1 … 12`
   output is 18,923 B with sha256 `0f772405bab7945b…`, equal to `FULL_POLICY_SHA` in
   `scripts/lib/policy.test.mjs:32`. `policy --list` bytes: 1280 · 1269 · 2339 · 876 ·
   1496 · 1101 · 2086 · 1168 · 1174 · 2002 · 1235 · 2811 (match plan.md Research).
   `ls .github/instructions/policy/` shows `01-who-does-the-work.md` …
   `12-command-presentation.md`; the index file is 2,832 B. `scripts/lib/policy.test.mjs`
   (3 tests) passed in the full run.
2. **Every customization file ≤ 20,000 B, including `agento-init.prompt.md` and its
   mirror** — **pass**. `find .github/agents .github/prompts .github/instructions
   skills/agento -type f -size +19999c` prints nothing; `wc -c` gives
   `agento-init.prompt.md` 18,100 and `skills/agento/commands/agento-init.md` 18,100.
   The two inline snippets removed from agento-init already exist as
   `templates/agento.json` and `templates/AGENTS-section.md` (the AGENTS section diff
   against the removed block is empty; the json differs only by the `<name>`
   placeholder the prompt tells the agent to fill), so no rule was dropped. The size-gate
   test `every file under the customization roots is ≤ 20,000 bytes` passed.
3. **`brief <command> [<arg>]` exists; for all 26 commands every page ≤ 7,000 B, page 1
   starts with the verbatim §9 receipt, overflow listed as `--page N` / `policy N`** —
   **pass**. `scripts/commands/brief.test.mjs:116` loops over 26 cases in primary,
   non-default-branch, plan, freehand, and build fixture windows asserting `status: ok`,
   every `--page N` ≤ 7,000 B, and `--page 2` named in the footer; `scripts/lib/brief.test.mjs`
   covers receipt-on-page-1-only, footer completeness, priority order, determinism,
   oversized paragraph/line splitting. All passed in the full run. Live in this
   worktree: `brief review-feature startup-brief-command --as-subagent` 4,898 B, first
   line `Receipt: accepted review-feature:startup-brief-command:ad4dc23`, footer
   `On demand: policy 1 … policy 12`; `brief ap startup-brief-command` 6,727 B page 1
   (`--page 1` with header 6,780 B), page 2 5,724 B, page 3 3,175 B, `More:` names
   pages 2 and 3; `brief build-feature startup-brief-command --as-subagent` 6,517 B;
   `brief delivery-status` 6,100 B.
4. **Rejected window → rejected receipt with alternatives, exit 3; unknown command →
   exit 1 listing `/agento <name>` for every command; subagent command without
   `--as-subagent` → only the `Dispatch:` block, no preflight** — **pass**. Live:
   `brief quick-fix x` in this build window printed `Receipt: rejected — wrong window:
   role=build (…); allowed: /agento continue, /agento review-feature
   startup-brief-command, …, /agento ship startup-brief-command (primary window)` and
   exited 3 (`--json` carries `window.allowed` and `window.elsewhere`). `brief nope`
   exited 1 with `"message": "brief: unknown command \"nope\"; known: /agento
   agento-init, /agento ap, …"`. `brief build-feature startup-brief-command` printed
   exactly four lines (`Dispatch: 🔨 Agento Builder`, `copilotModel:`, `subagentModel:`,
   `Prompt: Run \`/agento build-feature startup-brief-command\`: open with \`node
   …/agento.mjs brief build-feature startup-brief-command --as-subagent\` …`), no
   receipt, exit 0. Tests at `brief.test.mjs:35,44,82,89` cover the same paths.
5. **With a slug: roadmap header, ticked/total, first unticked step with `verify:`,
   never plan.md** — **pass**. `scripts/delivery-roadmap-resolver.test.mjs` gained 75
   lines of `currentStep` tests (planned, mid-way, all-ticked, manual, post-ship,
   added, multi-line); `brief.test.mjs:55` asserts the Delivery block and current step.
   Live Delivery block: `artifact dir: features/2026/11/startup-brief-command`,
   `status: in-review`, `branch: feature/startup-brief-command`, `steps: 14/14`,
   `current step: none`; `scripts/commands/brief.mjs:114-141` reads only roadmap
   content (`roadmapContent`), never plan.md. Evidence `step-5-1-live-brief.txt` shows
   the current step was `5.1` when 5.1 ran and `step-5-2-subagent-start.txt` shows `5.2`.
6. **Exactly one `Policy:` line per agent/prompt/mirror in the new form; declared set
   unchanged; `brief --json` included ∪ onDemand equals the line; 40,000 / 24,000
   budget test passes** — **pass**. `grep -rn "load once with" .github/agents
   .github/prompts skills/agento docs README.md` prints nothing. New tests `brief --json
   includes exactly the sections each Policy: line declares` and the retained budget
   test passed. Live `brief review-feature … --json`: included `9`, onDemand
   `1 2 3 4 5 7 8 10 11 12` = the Reviewer's declared `§1, §2, §3, §4, §5, §7, §8, §9,
   §10, §11, §12`.
7. **No agent/prompt/mirror/router instructs reading a file under `<agento-root>` or
   opening with `preflight`/`policy`; router and agento-core state the never-`view`
   rule; Builder and Reviewer state `initial_wait ≥ 120`** — **pass**.
   `grep -rln "Open with one.*preflight\|agento.mjs preflight" .github/agents
   .github/prompts skills/agento` prints nothing; the only `<agento-root>` + `view` hit
   is the rule itself (`skills/agento/SKILL.md:72`,
   `.github/instructions/agento-core.instructions.md:22`);
   `delivery-builder.agent.md:31` and `delivery-reviewer.agent.md:57` carry the
   `initial_wait ≥ 120 — ≥ 300 for this repository's full node suite` sentence. Test
   `no agent, prompt, mirror, or router opens with preflight or reads a file under
   <agento-root>` passed.
8. **Router SKILL.md dispatch table equals `DISPATCH_MODES`** — **pass**. Test `the
   router SKILL.md dispatch table equals DISPATCH_MODES` passed; read both by hand
   (`skills/agento/SKILL.md` §5 table ↔ `scripts/lib/brief.mjs:10-17`): identical
   agent → mode mapping.
9. **Live: `brief build-feature startup-brief-command --as-subagent` prints an accepted
   receipt, the current step, ≤ 7,000 B; router form prints only `Dispatch:`** —
   **pass**. Re-driven here (6,517 B / `Receipt: accepted
   build-feature:startup-brief-command:ad4dc23`; router form = Dispatch block only) and
   recorded by the Builder in `evidence/step-5-1-live-brief.txt` (5,918 B at `90fa1ca`,
   current step 5.1).
10. **Live: a Builder subagent dispatched with the `Dispatch:` prompt reaches its first
    step after exactly one `brief` call and no `view` under `<agento-root>`** —
    **pass** on the recorded transcript `evidence/step-5-2-subagent-start.txt`: one
    bash call (`… brief build-feature startup-brief-command --as-subagent`), no other
    tool call, receipt and current step 5.2 reported verbatim. The transcript notes the
    `task` tool rejected the display-name pin `DeepSeek V4 Pro (deepseek)` and needed
    the `copilotModel` alias — exactly what the router's Dispatch block instructs
    (`copilotModel` for `task`), so the behaviour matches the design. Not re-driven
    independently (it needs a `task` dispatch whose transcript the Reviewer cannot
    capture as a file in this environment); the recorded evidence is accepted as
    sufficient for a non-`(manual)` step whose CLI half (the Dispatch block) I re-ran.
11. **Docs describe `brief`, per-section policy files, the new `Policy:` form, the
    budget, the never-`view` rule** — **pass**. Read the diffs of `docs/architecture.md`
    (policy index, `brief` startup, `Policy:` contract), `docs/commands.md` (`brief`
    reference with flags, 7,000 B budget, exit codes 0/1/3), `docs/copilot-harness.md`
    (router flow via `brief`, never reads under `<agento-root>`, the measured ≈ 8 KB
    offload threshold), `README.md` (brief + on-demand `policy N`). `grep -rn "load once
    with" docs README.md` prints nothing; canonical-spelling tests passed.
12. **Full gate against the baseline (862/862, shellcheck exit 0)** — **pass**, fresh
    run by the Reviewer in this worktree:
    - `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs' 'canvas/**/*.test.mjs'`
      → **891 tests, 891 pass, 0 fail** (166.6 s; baseline 862, +29 from this delivery).
    - `/tmp/shellcheck-v0.10.0/shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh`
      → exit 0, no findings (shellcheck 0.10.0 static binary; not on PATH).
    - Guard smokes 1–5 from AGENTS.md → exit 0, 0, 0, 0, 0.
    - `cd extension && npm run copy-cli && git diff --exit-code --stat extension/cli`
      → exit 0 (byte-identical).
    - `cd extension && npm ci && npm run build && npm run test:unit` → exit 0 / 0 /
      **252 pass, 0 fail**.
    Matches `evidence/step-5-3-full-gate.txt`; no new or undocumented lint findings;
    the plan's full-gate decision (no scoped gate) was honoured.

Score: 12 pass, 0 fail, 0 deferred.

## Plan vs implementation

- Delivered as planned: `scripts/lib/policy.mjs`, `scripts/lib/brief.mjs`,
  `scripts/commands/brief.mjs`, `currentStep` in the roadmap resolver, 12 policy
  section files + index, 6 agents + 26×2 commands + router rewired, docs, extension
  byte copy, 29 new tests.
- One documented deviation: `preflightDocument` / `receiptLines` / `opIdFor` /
  `preflightArgs` moved to a new `scripts/lib/preflight.mjs` (not in the plan's file
  list) because `tests/cli-layout.test.mjs` forbids command-to-command imports. Recorded
  on roadmap step 5.3 and in the 5.3 evidence; the `preflight` command's output is
  unchanged (its tests passed).
- Minor spelling difference, both valid per `briefArgs`: the Reviewer agent opens with
  `brief review-<type> <slug>` while the `review-feature` prompt/mirror say
  `brief review-feature feature <slug>`. Both resolve to the same preflight.
- The agento-init shrink was achieved by pointing at the existing
  `templates/agento.json` and `templates/AGENTS-section.md` rather than embedding
  them; the plan anticipated exactly this.
- No undocumented changes found outside the plan's affected-files list.

## Roadmap audit

Every one of the 14 ticked boxes was spot-checked against the codebase, the test run,
or a live command (details per item above). No falsely ticked box; no `(manual)` or
`(manual, post-ship)` steps exist; no missing-work step needed. `status: in-review`,
`next-step: ""`, `artifact-pr: "#75"` are correct. No repairs made.

## Findings

None at major or blocking severity. Minor (none affects correctness of a page or the
budget guarantee):

1. **Minor — page-1 policy packing leaves budget unused** (`scripts/lib/brief.mjs`,
   `paginateBrief`, the "footer does not fit" shed loop). Included sections are popped
   from the tail until the footer fits, but smaller lower-priority sections are not
   retried. Live `brief review-feature startup-brief-command --as-subagent` is 4,898 B
   with only §9 included, while §2 (1,269 B) plus the footer would still fit under the
   6,744 B content budget. Reserving the footer's byte estimate before the greedy fill
   (or re-running the fill after a shed) would include one to two more sections per
   start.
2. **Minor — `--json` `blocks[].page` placement** (`scripts/lib/brief.mjs`, `finish`).
   `receipt`, `session`, and `delivery` blocks report `page: null` although they are on
   page 1; and a mandatory block starting on a continuation page gets
   `2 + (chunkIndex − flowIndex)`, which assumes one chunk per continuation page while
   `packChunks` may pack several chunks on one page. Not reachable with today's bodies
   (verified: `ap` reports `agent: page 2` and page 2 does start the Autopilot body),
   but the field would mis-number a future longer body. The Markdown pages and the
   `More:` list are unaffected.
3. **Minor — companion roadmap read from `origin/<branch>`** (`scripts/commands/brief.mjs`,
   `roadmapContent`, `resolve.source === "remote"`). In companion mode the Delivery
   block comes from the companion's `origin/<branch>` rather than the
   `companion.path` checkout, so an unpushed companion commit would show a stale
   current step. The two-commit rule keeps `ahead: 0` at every step end, so steady
   state is correct; a Builder mid-step would still see the last pushed state.
4. **Observation — inline-as-agent starts print no policy on page 1.** `brief
   new-feature …` page 1 is 6,100 B with the command body and the `More:` footer (3
   continuation pages for the Planner body) and all nine declared sections — §9
   included — go on demand, because policy is only placed on page 1 and never fills a
   continuation page's trailing space. This is the plan's accepted design ("as long as
   they fit") and the sizing is the `context-trim` feature's job, but letting policy
   spill onto the last continuation page would make the "always" set §9–§12 arrive
   without an extra call.
5. **Cosmetic — evidence byte counts.** `step-5-1-live-brief.txt` records `ap` page 1 as
   both 6,553 B and 6,606 B (two measurement methods); both ≤ 7,000, and my fresh
   measurement is 6,727 B (page 1) / 6,780 B (`--page 1` with its header), still under
   budget after the 5.3 `lib/preflight.mjs` move.

## Follow-ups

- Reserve the footer estimate (or re-run the greedy fill after shedding) in
  `paginateBrief` so page 1 carries every declared section that fits with the footer
  (Finding 1).
- Fix `--json` `blocks[].page`: report `1` for receipt/session/delivery and derive
  continuation page numbers from `packChunks`' actual page assignments (Finding 2).
- In companion mode, read the Delivery block's roadmap from the session record's
  `companion.path` checkout when it is on the mirrored branch, falling back to
  `origin/<branch>` (Finding 3).
- Let policy sections fill the trailing space of the last continuation page so
  inline-as-agent starts receive §9–§12 without an on-demand call (Finding 4; coordinate
  with `context-trim`).
