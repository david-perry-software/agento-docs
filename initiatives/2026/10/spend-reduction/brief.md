Source: inline argument to /agento new-initiative — 2026-10-11

## Plan: Cut Agento token spend

Three levers, each its own member feature: stop loading the full delivery policy into every request, turn the multi-step git choreography into single `agento.mjs` calls (the pattern `start-session`, `close-session`, and `ship` already follow), and collapse per-command preflight into one call. The first removes a fixed per-turn cost; the other two cut tool round-trips, and every round-trip re-sends the whole context.

**Findings**
- `delivery-policy.instructions.md` (~280 lines, ~6K tokens) is `applyTo: "**"`, so it rides along on every request in every repo with the plugin, including unrelated chats; `command-invocation` adds ~60 lines the same way.
- The SessionStart context block appeared twice in one session (plugin- plus workspace-mode wiring, or per workspace folder).
- Builder resume and per-step commit/integrate/push (two-commit rule across both halves), Planner step 8 publish, Reviewer step 8 publish, and five PR→wait→merge flows are still prose procedures the model executes call by call.
- Every command runs `session` + `doctor --for` + `resolve` (+ `rev-parse` for the op-id) before doing any work.

**Members**

*Wave 1 (parallel)*
1. **policy-on-demand** — keep a ≤40-line always-on core (work boundary, git musts, secrets, receipt one-liner); move §2–§12 into referenced, non-auto-applied file(s) keeping `§N` anchors; trim command-invocation to the redirect rule; dedupe SessionStart. Update the canary and cite tests in customizations.test.mjs. Risk: confirm VS Code loads instruction files linked from agent/prompt bodies.
2. **preflight-call** — `agento.mjs preflight <command> [<type> <slug>]` returning session, window-check verdict (with allowed/elsewhere), doctor for that command, resolve, config, and the op-id; every prompt/agent switches to it; update the `doctor --for` test, the needs-table test, and §9–§11 wording.

*Wave 2 (requires preflight-call)*
3. **builder-step-cli** — `agento.mjs sync <type> <slug>` (fetch + merge-integrate both halves, never rebase, conflict → abort with files) and `agento.mjs step-commit <type> <slug> --step N.M --message-file <f>` (two-commit rule, integrate, push product then companion, draft PRs if missing, clean/ahead-0). Security: the guard can't see in-process git, so the CLI enforces the same rules (no default-branch commit, roadmap in the commit). Largest payoff — runs every step.
4. **publish-cli** — `plan-publish`, `review-publish` (`--edit-last` comment), and one shared `publish-pr` (PR, bounded wait with exit 2 pending, `--merge`, sync, delete branch) used by commit-current-changes, finish-freehand, quick-fix, new-initiative, triage-followups.

**Verification**
1. Baseline now, compare after each member: `wc -c` of always-applied instruction files; tool-call count of one reference `/agento ap` run from the chat debug log (`main.jsonl`).
2. Per feature: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'`, both guard replays, `shellcheck`, `cd extension && npm run copy-cli && npm run test:unit`.
3. A "one `agento.mjs` call, no hand-run fallback" test for each CLI-ified prompt/agent, like the existing `ship`/`close-session` tests.

**Excluded by choice:** prompt/agent prose trimming, model re-pinning (Autopilot and `ship` stay on Opus), and a Reviewer probe subagent.
