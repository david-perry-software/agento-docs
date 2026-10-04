// Reproduction probe for issue gate-dashboard-plan-actions.
// Usage: node repro-gate-dashboard-plan-actions.mjs <agento checkout>  (after `cd extension && npm run test:unit`)
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2] ?? ".");
const ext = path.join(root, "extension");
const load = (name) => import(pathToFileURL(path.join(ext, "out", "src", name)).href);
const { runNewPlanFlow, createNewPlanRequest } = await load("newPlanFlow.js");
const { runNewInitiativeFlow } = await load("newInitiativeFlow.js");
const { dispatchCommandToTarget, consumePendingCommands } = await load("commandDispatcher.js");

const gated = ["agento.newPlan", "agento.newInitiative", "agento.planInitiativeMember"];
const manifest = JSON.parse(fs.readFileSync(path.join(ext, "package.json"), "utf8"));
const source = fs.readFileSync(path.join(ext, "src", "extension.ts"), "utf8");

console.log("MANIFEST — menu entries for the gated commands:");
for (const [menu, items] of Object.entries(manifest.contributes.menus)) {
  for (const item of items) if (gated.includes(item.command)) console.log(`  ${menu}: ${item.command} when="${item.when}"`);
}
console.log(`  menus.commandPalette: ${JSON.stringify(manifest.contributes.menus.commandPalette ?? null)}`);
console.log(`  setContext calls in extension/src/extension.ts: ${(source.match(/setContext/g) ?? []).length}`);
console.log(`  openTarget uses forceNewWindow: true: ${/forceNewWindow:\s*true/.test(source)}`);

const primary = { path: "/repo", role: "primary", isManaged: false, dirPrefix: null, repo: "product" };
const build = { path: "/repo-worktrees/issue-x", role: "build", isManaged: true, dirPrefix: "issue", repo: "product" };
const planned = { path: "/repo-worktrees/plan-new", role: "plan", isManaged: true, dirPrefix: "plan", repo: "product" };

function memoryStore() {
  const values = new Map();
  return { values, get: (key) => values.get(key), update: async (key, value) => { if (value === undefined) values.delete(key); else values.set(key, value); } };
}

function crossWindowDeps(store, opened, chatCalls) {
  return {
    executeCommand: async (...args) => { chatCalls.push(args); },
    reportInfo: async () => undefined,
    pendingStore: store,
    openTarget: async (target) => { opened.push(target); },
    chatMode: () => ({ mode: null, reason: "probe" }),
    commandFile: () => ({ file: null, reason: "probe" }),
    output: { appendLine() {} },
  };
}

async function newPlanFrom(label, current) {
  const store = memoryStore();
  const opened = [];
  const chatCalls = [];
  const submitted = [];
  const snapshots = [
    { status: "ok", worktrees: [primary, build], ...current },
    { status: "ok", worktrees: [primary, build, planned], companion: null, workspace: null, ...current },
  ];
  let index = 0;
  const result = await runNewPlanFlow(createNewPlanRequest("feature", "Probe plan"), {
    readSession: async () => snapshots[Math.min(index++, snapshots.length - 1)],
    // Production submitCommand: in-window only when the target is one of this window's folders.
    submitCommand: async (command, target) => {
      submitted.push({ command, target: target.path });
      await dispatchCommandToTarget(command, target, "probe", crossWindowDeps(store, opened, chatCalls), target.path === current.worktree.path);
    },
    pendingStore: store,
    openTarget: async (target) => { opened.push(target); },
    sleep: async () => undefined,
    now: () => Date.now(),
    isCancellationRequested: () => false,
    offerRecovery: async () => undefined,
  }, { pollIntervalMs: 1, timeoutMs: 1000 });
  console.log(`NEW PLAN from ${label}:`);
  console.log(`  submitted: ${JSON.stringify(submitted)}`);
  console.log(`  opened windows: ${JSON.stringify(opened.map((target) => target.path))}`);
  console.log(`  pending dispatch keys: ${JSON.stringify([...store.values.values()].map((record) => [record.target, record.command]))}`);
  console.log(`  in-window chat.open calls: ${JSON.stringify(chatCalls.map((call) => call[1]?.query))}`);
  console.log(`  result: ${result.kind}`);
  return store;
}

const buildStore = await newPlanFrom("role=build window (attached delivery worktree)", { role: "build", worktree: { path: build.path, detached: false } });
await newPlanFrom("role=unmanaged window", { role: "unmanaged", worktree: { path: "/elsewhere/clone", detached: false } });
await newPlanFrom("role=plan, detached window (control: #77 in-window path, stays allowed)", { role: "plan", worktree: { path: planned.path, detached: true } });

const strayCalls = [];
await consumePendingCommands(["/repo"], {
  pendingStore: buildStore,
  executeCommand: async (...args) => { strayCalls.push(args); },
  reportError: async () => undefined,
  output: { appendLine() {} },
  chatMode: () => ({ mode: null, reason: "probe" }),
  commandFile: () => ({ file: null, reason: "probe" }),
});
console.log("STRAY PENDING — primary window /repo activates/focuses later (within the 5 min TTL):");
console.log(`  chat.open: ${JSON.stringify(strayCalls.map((call) => call[1]?.query))}`);

const initiativeStore = memoryStore();
const initiativeOpened = [];
const initiativeResult = await runNewInitiativeFlow({ kind: "brief", text: "Probe brief" }, {
  readSession: async () => ({ status: "ok", role: "build", worktree: { path: build.path, detached: false }, worktrees: [primary, build] }),
  isRegularFile: async () => true,
  dispatch: (command, target) => dispatchCommandToTarget(command, target, "probe", crossWindowDeps(initiativeStore, initiativeOpened, []), false),
});
console.log("NEW INITIATIVE from role=build window:");
console.log(`  result: ${initiativeResult.kind} ${JSON.stringify(initiativeResult.command ?? "")}`);
console.log(`  opened windows: ${JSON.stringify(initiativeOpened.map((target) => target.path))}`);
console.log(`  pending dispatch keys: ${JSON.stringify([...initiativeStore.values.values()].map((record) => [record.target, record.command]))}`);
