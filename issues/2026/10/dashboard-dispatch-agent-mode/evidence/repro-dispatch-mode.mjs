// Reproduction for issue dashboard-dispatch-agent-mode: every dashboard dispatch path
// submits to workbench.action.chat.open with { query } only — no `mode`, so Chat keeps
// the currently selected agent instead of the command's `agent:` frontmatter.
import { consumePendingCommands, dispatchCommandAction, dispatchCommandToTarget } from
  "/home/david/DP/agento-worktrees/plan-20261002-141659/extension/out/commandDispatcher.js";
import { pendingDispatchKey } from
  "/home/david/DP/agento-worktrees/plan-20261002-141659/extension/out/pendingDispatch.js";

const calls = [];
const executeCommand = async (...args) => { calls.push(args); };
const store = { values: new Map(), get(k) { return this.values.get(k); }, async update(k, v) { v === undefined ? this.values.delete(k) : this.values.set(k, v); } };

// Path 1: in-window action (Deliveries / Session view)
await dispatchCommandAction({ command: "/agento new-feature widget", window: "here", reason: null }, undefined, {
  currentWindow: () => "plan", loadNext: async () => undefined, executeCommand,
  reportError: async () => undefined, reportInfo: async () => undefined, output: { appendLine() {} }, pendingStore: store, openTarget: async () => undefined,
});
// Path 2: dispatchCommandToTarget when the target is the current window (New Plan → start-session)
await dispatchCommandToTarget("/agento review-feature widget", { kind: "folder", path: "/repo" }, "reason", {
  executeCommand, reportInfo: async () => undefined, pendingStore: store, openTarget: async () => undefined,
}, true);
// Path 3: pending command consumed on activation in the new planning window (New Plan → new-feature)
store.values.set(pendingDispatchKey("/repo"), { target: "/repo", command: "/agento new-issue widget", createdAt: Date.now() });
await consumePendingCommands(["/repo"], { pendingStore: store, executeCommand, reportError: async () => undefined, output: { appendLine() {} } });

for (const [command, options] of calls) {
  console.log(JSON.stringify({ command, options, hasMode: Object.hasOwn(options, "mode") }));
}
const missing = calls.filter(([, options]) => !Object.hasOwn(options, "mode")).length;
console.log(`${missing}/${calls.length} chat.open submissions carry no mode (expected 0 once fixed)`);
process.exit(missing ? 1 : 0);
