# Review: harness-docs

Verdict: approve

Reviewed 2026-10-18 on product `feature/harness-docs` @ `52a444a` (code PR #120, CI run
`39104787526` success) and companion `feature/harness-docs` @ `d84e29b` (artifact PR
#58). `origin/main` (`4dc0e3e`) is an ancestor of the product head and the companion's
`origin/main` (`d9d4346`) of its head; both trees were clean and in sync with their
remotes at the start of the review. Skills consulted: none — no matching domain (the
repository has no `.agents/skills/` and AGENTS.md carries no skills table; the change is
Markdown and JSON metadata).

Scope confirmed: `git diff origin/main...HEAD --stat` lists 14 files — nine docs/README/
AGENTS/CHANGELOG files, the three manifests, and `extension/package-lock.json` — 265
insertions, 50 deletions; nothing under `scripts/`, `extension/src/`, `hooks/`,
`.github/`, or `skills/` changed on this branch (the #122 runtime changes arrived via
the `2ac4d70` merge of `origin/main` and are not in the three-dot diff).

## Acceptance checklist results

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | docs/install.md Copilot harness section (install/status/uninstall/--force, Local takeover + model-switch gap, per-harness verification incl. doctor `harness`) | pass | docs/install.md L61–L105 and L133–L138 read against `scripts/agento.mjs` L1014–L1028 (doctor check: `ok` installed, `fail` absent/foreign/dangling/not-a-link with `harness install` / `install --force` fallbacks) and L4662–L4694 (`--force` only with install; refusal states `missing`, `worktree`, `not-a-link`, `foreign`/`dangling`); `grep -c "harness install\|Session Target\|harness uninstall" docs/install.md` = 9. One minor imprecision (Finding 2). |
| 2 | hooks.md, architecture.md, extension.md, commands.md describe the Copilot harness per steps 1.2–1.5; commands.md doctor list has `hook-wiring` and `harness` | pass | hooks.md grep = 4 (tool-name normalisation matches `TOOL_CLASS` in `scripts/hooks/delivery-guard.mjs` L55–L59; three Copilot replay commands match AGENTS.md); architecture.md grep = 14, "Two harnesses" table + dispatch rule match `skills/agento/SKILL.md` §5; extension.md `Copilot\|harness` count 4 → 13; commands.md L409–L420 lists `hook-wiring`, `harness` with `fail` wording matching L1020–L1026, and L487–L499 documents the `harness` subcommand fields `{ status, verb, link, expected, state, target, pluginRoot, changed, localTakeover }` exactly as emitted at L4670. |
| 3 | model-profiles.md documents `copilotModel` and the `runSubagent`/`task` rule | pass | docs/model-profiles.md L141–L153 vs `modelsPins()` `scripts/agento.mjs` L3711–L3729 (`copilotModel` = `copilotModels[subagentModel] ?? null`) and SKILL.md §5 subagent rule; grep count 15. |
| 4 | copilot-harness.md: dispatch "predates the router" as hypothesis, ask-user reconciliation, 12-row acceptance section | pass | L385–L391 ("stated, untested hypothesis"); L124–L130 and L341–L347 (ask-user: model tool set vs harness-rendered card); `## Two-harness acceptance (harness-docs)` has exactly 12 data rows (six checks × two harnesses) and a Known-limitations list. |
| 5 | README.md links copilot-harness.md and names `harness install`; AGENTS.md layout lists `skills/` | pass | `grep -c "copilot-harness.md\|harness install" README.md` = 3; AGENTS.md L24–L28 `skills/` bullet names the router skill and `skills/agento/commands/`. |
| 6 | Five version fields are `0.8.0` | pass | `grep -n '"version": "0.8.0"'` hits `.claude-plugin/plugin.json:4`, `package.json:3`, `extension/package.json:5`, `extension/package-lock.json:3` and `:9`; `tests/customizations.test.mjs` version-parity test passes in the suite run below. |
| 7 | CHANGELOG first heading `## 0.8.0 (<date>)` with Copilot-harness **Added** entry; no `## Unreleased` | pass | `grep -n "^## " CHANGELOG.md` → `3:## 0.8.0 (2026-10-17)`, next `397:## 0.7.0 (2026-10-02)`; the Added entry (L5–L18) names `harness install`; #122's Breaking entry sits inside 0.8.0. Date remark in Finding 1. |
| 8 | Node suite ≥ baseline; five replays, extension build, `test:unit` exit 0 | pass | Fresh runs this review: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` → tests 566, pass 566, fail 0 (baseline 565); replays 1–5 (`replay-guard.sh` Local, companion, Copilot, Copilot+companion, Copilot fixtures) each exit 0 with 0 `MISMATCH`; `cd extension && npm ci && npm run build && npm run test:unit` → build exit 0, 167 pass / 0 fail. |
| 9 | PR CI green, Shellcheck zero findings (scoped gate vs zero-finding baseline) | pass | `scripts/wait-for-checks.sh pr 120` → `pass=1 fail=0 pending=0 … RESULT: success`; run `39104787526` on `52a444a`: steps `Shellcheck: success`, `Unit tests: success`, all four `Guard fixture replay*: success`. Shellcheck is unavailable locally (`command -v shellcheck` empty), so CI is the authoritative run, as the plan recorded. |
| 10 | `harness status` `installed`, doctor `harness` `ok` for `/home/david/DP/agento-plugin` at `origin/main` | pass | Re-run this review: plugin clone HEAD `4dc0e3e` = `origin/main`, clean; `harness status --plugin-root /home/david/DP/agento-plugin` → `state: installed`, `target: /home/david/DP/agento-plugin/skills/agento`; `doctor --plugin-root …` → `harness` `status: ok`. |
| 11 | soshiki Copilot session: receipt, `Agento CLI:` line, push denied, hook-file approval, Planner via new-feature, dashboard dispatch | pass | Manual (§1: only the user sets Session Target and types in chat); evidence files all present and inspected: `step-3-12-copilot-delivery-status.png`, `-context-line.png`, `-push-denied.png` (denial text visible), `-hook-approval-card.png` ("Allow tool call? … kind: hook", Manual permissions), `-hook-skipped-not-created.png`, `-dashboard-new-chat.png`, `-dashboard-existing-chat.png` (duplicate receipt inside the same Copilot chat), `step-3-6-copilot-new-feature.png`; `step-3-12-guard-debug.jsonl` records `Write …/.github/hooks/x.json → ask`. |
| 12 | Same six checks in a Local session | pass | `step-3-7-local-*.png` (6 files) present; `step-3-7-local-new-feature.png` inspected: Local session, `Receipt: accepted new-feature:plan-20261017-183454:897c27bf`, question card 1/5 unanswered. |
| 13 | Throwaway soshiki session closed; no leftover worktree/branch; primary clean | pass | `git -C /home/david/DP/soshiki worktree list` has no `plan-20261017-183454`; `status --porcelain` empty; `branch -a`, `ls-remote --heads origin` in soshiki and soshiki-docs: 0 `smoke` matches; `.github/hooks/x.json` absent. |
| 14 | No file outside docs/, README.md, AGENTS.md, CHANGELOG.md, and version fields changed | pass | `git diff origin/main...HEAD --stat` (14 files listed above); the lockfile change is the two root `version` lines only. |

## Plan vs implementation

- Delivered as planned: eight Phase 1 doc steps, the 0.8.0 bump, the CHANGELOG entry,
  the two-harness acceptance, and the final gate. The plan's "docs-only, no runtime
  change" boundary holds (item 14).
- Mid-build deviation, documented: #122 (`dispatch-router-only`) landed on `main`
  during the build; the branch merged it (`2ac4d70`) and added steps 1.9–1.14, 2.3,
  3.10–3.12 to re-align every doc with "router is the only `/agento` path in every
  session". Each re-alignment grep from those steps was re-run here and passes
  (nothing matches the retired phrasings; `skills/agento/commands` appears where
  required). The historical `commands/<name>.md` mention at docs/copilot-harness.md
  L398 is inside the #121 observation record and correctly describes the pre-#122
  layout.
- Four guard findings surfaced during acceptance and were recorded as known
  limitations in docs/copilot-harness.md and plan.md `## Risks` rather than fixed —
  consistent with the plan's "The guard fix itself is a runtime change" risk. Only the
  fourth (#123) has a filed issue; the other three are listed under Follow-ups below
  so `/agento triage-followups` can file them.
- The acceptance-table prose in docs/copilot-harness.md says Copilot checks ran under
  Manual permissions; the push-denial screenshot shows the Allow-all mode active for
  that part of the session (Finding 4). Results are unaffected (deny is
  mode-independent in both harnesses).

## Roadmap audit

- All 30 boxes spot-checked against the code and evidence: every Phase 1/2 `verify:`
  grep re-run and passing; 3.1/3.10/4.1 gates re-run fresh (above); 3.2/3.11 state
  re-read from the plugin clone; 3.3/3.8 confirmed via soshiki worktree/branch
  listings; 3.5, 3.6, 3.7, 3.12 `(manual)` ticks each carry linked evidence files that
  exist in `evidence/` (26 files, every path referenced from the roadmap and the
  acceptance table resolves) and a completion date on the line.
- 3.4 is `[x]` as an `~obsolete~` marking per the artifact contract; its sub-bullets
  still said "3.4 stays unticked". Repair: appended a Reviewer note (2026-10-18)
  clarifying that the tick is the obsolete marking, not a completion claim, and that
  3.12 carries the acceptance. No false ticks found; no missing-work steps added.

## Findings

Ordered by severity; none above minor.

1. **Minor — CHANGELOG heading date predates the build's end.** CHANGELOG.md L3 reads
   `## 0.8.0 (2026-10-17)`, but the build ran into 2026-10-18 (steps 1.9–1.14, 2.3,
   3.9–3.12 and the final gate). plan.md `## Risks` accepted the build-date heading
   with "re-dated in a later step if the build spans days", which did not happen.
   Acceptance item 7 only requires `## 0.8.0 (<date>)`, so this does not block; the
   date can be set at ship.
2. **Minor — link target described as a file.** docs/install.md L65–L66: "a symlink to
   the plugin clone's `skills/agento/SKILL.md`". The link's target is the directory
   `<clone>/skills/agento` (`harnessFacts().expected`, `scripts/agento.mjs` L1048;
   `harness status` prints `target: /home/david/DP/agento-plugin/skills/agento`).
   AGENTS.md, SKILL.md §3, and docs/architecture.md say it correctly.
3. **Minor — "read-only false deny" is characterised too broadly.** docs/copilot-harness.md
   Known limitations and plan.md `## Risks` say "a plain read-only `ls`/`cat`/`grep` of
   `.github/hooks/*` is denied". Both evidence screenshots
   (`step-3-4-copilot-hook-read-false-deny.png`,
   `step-3-12-copilot-hook-read-false-deny-allow-all.png`) show the denied command was
   `ls -la .github/hooks/ 2>&1; for f in .github/hooks/*.json; do echo …; cat "$f"; done …`:
   the segment `for f in .github/hooks/*.json` starts with `for`, which is not in the
   guard's `READ_ONLY` set (`scripts/hooks/delivery-guard.mjs` L85–L92), so the hook
   path in that segment is treated as a write. A plain `ls -la .github/hooks` alone
   was **allowed** (`step-3-12-guard-debug.jsonl` lines 1–2). The same class bit this
   review: `{ ./scripts/hooks/replay-guard.sh < … > /tmp/x; … }` was denied because
   the segment's first word is `{`. The precise trigger — shell grouping/loop
   keywords preceding a protected path — belongs in the guard follow-up issue.
4. **Minor — permission-mode attribution in the acceptance prose.** docs/copilot-harness.md
   L54–L56 says Copilot checks ran under Manual permissions "with the Allow-all
   contrast noted below"; `step-3-12-copilot-push-denied.png` (01:47) shows the status
   bar on **Allow all**, while the hook-file card and dashboard screenshots (01:53–01:57)
   show Manual permissions. So the receipt, context-line, and push checks ran under
   Allow all. Outcomes are unchanged (deny fails closed in both modes).
5. **Minor — wording tension in architecture "Pieces".** docs/architecture.md L43–L44
   still opens with "**Prompts** (`.github/prompts/`) are the slash commands" immediately
   before the new router bullet stating neither harness loads them. Accurate as "the
   source the `skills/agento/commands/` mirrors are generated from", but a reader may
   trip. Pre-existing sentence inside the edited section.

No security issues: no secrets in docs or evidence (screenshots inspected show no
tokens); no runtime code changed.

## Follow-ups

- Re-date the `## 0.8.0 (…)` heading to the ship date when `/agento ship harness-docs`
  merges (Finding 1).
- docs/install.md L65–L66: say the link targets the `skills/agento` directory (Finding 2).
- Guard hardening (plan.md `## Risks`, docs/copilot-harness.md Known limitations) —
  three findings still without a GitHub issue: (a) HydraFusion multi-solver tool
  execution outside the hook path (step 3.4 non-denial); (b) hook process `cwd` is the
  staged plugin root while the payload `cwd` is the repository (step 3.5 debug entry);
  (c) false deny of hook-path reads inside `for`/`{` grouping segments (Finding 3 — the
  `READ_ONLY` first-word check should skip shell keywords). #123 covers the fourth
  (Copilot `ask` under Allow all → deny for hook-file writes).
- docs/copilot-harness.md acceptance prose: attribute Allow all to the receipt/context/
  push checks and Manual permissions to the hook-file and dashboard checks (Finding 4).
- Local existing-chat dashboard dispatch opened a fresh chat rather than appending
  (step 3.7, `step-3-7-local-dashboard-existing-chat.png`); recorded as observed in the
  acceptance table — worth a small investigation of `workbench.action.chat.open`
  behaviour in Local when a chat is already open.
- docs/architecture.md L43–L44: reword the Prompts bullet as the source of the command
  mirrors (Finding 5).
