// Reproduction probe for issue plan-play-button-handoff, run against the compiled extension (out/src).
import { readFileSync } from "node:fs";
const root = process.argv[2];
const { runNewPlanFlow, createInitiativePlanRequest } = await import(`${root}/extension/out/src/newPlanFlow.js`);
const { dispatchCommandToTarget } = await import(`${root}/extension/out/src/commandDispatcher.js`);

const store = () => { const m = new Map(); return { get: (k) => m.get(k), update: async (k, v) => { if (v === undefined) m.delete(k); else m.set(k, v); } }; };
const primary = { path: "/repo", role: "primary", isManaged: false, dirPrefix: null, repo: "product" };
const here = { path: "/repo-worktrees/plan-here", role: "plan", isManaged: true, dirPrefix: "plan", repo: "product" };
const fresh = { path: "/repo-worktrees/plan-new", role: "plan", isManaged: true, dirPrefix: "plan", repo: "product" };

// Defect 1: an unpromoted plan window (role plan, detached) still starts a new session in the primary.
{
  const current = { status: "ok", role: "plan", worktree: { ...here, branch: null, detached: true }, worktrees: [primary, here], companion: null, workspace: null };
  const submitted = [];
  const snapshots = [current, { ...current, worktrees: [primary, here, fresh] }, { ...current, worktrees: [primary, here, fresh] }];
  let i = 0;
  const result = await runNewPlanFlow(createInitiativePlanRequest("agento-extension", "new-plan-flow"), {
    readSession: async () => snapshots[Math.min(i++, snapshots.length - 1)],
    submitCommand: async (command, target) => { submitted.push({ command, target }); },
    pendingStore: store(), openTarget: async () => undefined, sleep: async () => undefined, now: () => 0,
    isCancellationRequested: () => false, offerRecovery: async () => undefined,
  }, { pollIntervalMs: 1000, timeoutMs: 300000 });
  console.log("DEFECT 1 — plan-role detached window, play button:");
  console.log("  submitted:", JSON.stringify(submitted));
  console.log("  result:", result.kind, JSON.stringify(result.target ?? null));
  console.log("  expected: one submit of the /agento new-feature command to the current window, no /agento start-session");
}

// Defect 2: chat.open receives only { query, mode } — no attachFiles for commands/<name>.md.
{
  const calls = [];
  await dispatchCommandToTarget("/agento start-session", { kind: "folder", path: "/repo" }, "reason", {
    executeCommand: async (...args) => { calls.push(args); }, reportInfo: async () => undefined, pendingStore: store(),
    openTarget: async () => undefined, chatMode: () => ({ mode: "agent" }), output: { appendLine() {} },
  }, true);
  console.log("DEFECT 2 — in-window dispatch of /agento start-session:");
  console.log("  chat.open args:", JSON.stringify(calls));
  console.log("  attachFiles present:", calls.some(([, o]) => o && "attachFiles" in o));
}

// Defect 3: production default timeout vs. the 2026-10-02 20:35 run (workspace file written ~122 s after submit).
{
  const ext = readFileSync(`${root}/extension/src/extension.ts`, "utf8");
  const match = ext.match(/options: NewPlanFlowOptions = \{ pollIntervalMs: (\d+), timeoutMs: (\d+) \}/);
  const [pollIntervalMs, timeoutMs] = [Number(match[1]), Number(match[2])];
  const submitAt = Date.parse("2026-10-02T20:35:14.000Z");
  const workspaceAt = Date.parse("2026-10-02T20:37:16.546Z");
  let now = submitAt;
  const noPlan = { status: "ok", role: "primary", worktree: { ...primary, branch: "main", detached: false }, worktrees: [primary], companion: null, workspace: null };
  const withPlan = { ...noPlan, worktrees: [primary, fresh] };
  const target = { status: "ok", worktrees: [primary, fresh], companion: { registered: true }, workspace: { path: `${fresh.path}.code-workspace`, exists: true } };
  let reads = 0;
  const result = await runNewPlanFlow(createInitiativePlanRequest("agento-extension", "new-plan-flow"), {
    readSession: async (cwd) => { reads++; if (cwd) return target; return reads === 1 ? noPlan : (now >= workspaceAt ? withPlan : noPlan); },
    submitCommand: async () => undefined, pendingStore: store(), openTarget: async () => undefined,
    sleep: async (ms) => { now += ms; }, now: () => now, isCancellationRequested: () => false, offerRecovery: async () => undefined,
  }, { pollIntervalMs, timeoutMs });
  console.log("DEFECT 3 — production default", JSON.stringify({ pollIntervalMs, timeoutMs }), "against a start-session that finishes at 20:37:16.546Z:");
  console.log("  deadline:", new Date(submitAt + timeoutMs).toISOString());
  console.log("  result:", result.kind, "—", result.reason ?? JSON.stringify(result.target));
}
