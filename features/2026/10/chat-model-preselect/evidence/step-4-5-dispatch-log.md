# Step 4.5 dispatch log (2026-10-23)

Extension Development Host on the product worktree, dev extension loaded
2026-10-22 21:09:03. Setting: `agento.chatModelPreselect` (Workspace tab, lives in
the worktree's gitignored `.vscode/settings.json`). Three `/agento delivery-status`
dispatches, one per case.

## Agento output channel

Source: `/home/david/.config/Code/logs/20261020T092728/window13/exthost/output_logging_20261022T210903/4-Agento.log`

```
48: cli: next chat-model-preselect -> exit 0 in 168 ms
49: cli: models resolve delivery-status --role secondary --plugin-root /home/david/DP/agento-plugin -> exit 0 in 260 ms
...
62: cli: next chat-model-preselect -> exit 0 in 140 ms
63: cli: models resolve delivery-status --role secondary --plugin-root /home/david/DP/agento-plugin -> exit 0 in 261 ms
...
76: cli: next chat-model-preselect -> exit 0 in 140 ms
77: cli: models resolve delivery-status --role secondary --plugin-root /home/david/DP/agento-plugin -> exit 0 in 270 ms
```

Each `models resolve delivery-status` is preceded by a `next chat-model-preselect`
and there is no `dispatch: no model` line in the channel — a selector was sent each
time.

## VS Code renderer log (model selection events)

Source: `/home/david/.config/Code/logs/20261020T092728/window13/renderer.log`.
Relevant fields from the `[ChatModelSelection]` lines:

- **Copilot case.** `2026-10-23 09:21:47.801 event=set-model sessionKey="agent-host-copilotcli" model="agent-host-copilotcli:claude-opus-5.5"` → `09:21:47.818 event=explicit-selection-applied` (footer "9:22 AM · Claude Opus 5.5 · 38.4 credits").
- **Local case (first).** `2026-10-23 09:23:54.599 event=set-model sessionKey="local" model="copilot/claude-opus-5.5"` → `09:23:54.612 event=explicit-selection-applied`.
- **Local case (second).** `2026-10-23 09:27:23.516 event=set-model sessionKey="local" model="copilot/claude-opus-5.5"` → `09:27:23.525 event=explicit-selection-applied` (footer "9:28 AM · Claude Opus 5.5 · 40.4 credits").

`models resolve delivery-status --role secondary` returns
`qualified: Claude Opus 5.5 (copilot)`, `copilotModel: claude-opus-5.5`.
