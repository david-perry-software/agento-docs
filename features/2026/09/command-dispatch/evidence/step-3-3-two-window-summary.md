# Step 3.3 two-window verification

Verified on 2026-09-19 with separate VS Code Extension Host processes using the built `commandDispatcher.js` and `filePendingDispatchStore.js`.

- Primary-folder handoff: source PID `1920003` routed `/agento continue source-dispatch` to `/tmp/agento-command-dispatch-evidence/product`; target PID `1919749` consumed it on focus and submitted `workbench.action.chat.open` with `{ "query": "/agento continue source-dispatch", "mode": "agent" }`. A later expired record was discarded and not submitted. See [step-3-3-primary-folder.jsonl](step-3-3-primary-folder.jsonl).
- Companion-workspace handoff: source PID `1915694` routed `/agento continue evidence-dispatch` to `/tmp/agento-command-dispatch-evidence/product-worktrees/plan-evidence.code-workspace`; target PID `1915410` consumed it on focus and submitted `workbench.action.chat.open` with `{ "query": "/agento continue evidence-dispatch", "mode": "agent" }`. See [step-3-3-companion-workspace.jsonl](step-3-3-companion-workspace.jsonl).
- Focus checks after consumption did not produce a second `submitted` event in either trace.

Focused automated proof: `npm --prefix extension run test:unit` passed 56/56 after introducing the shared file-backed pending store.
