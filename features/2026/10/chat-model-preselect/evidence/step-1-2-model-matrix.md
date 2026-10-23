# Step 1.2 — model probe matrix (M1–M5 × Copilot / Local)

Probe run by the user on 2026-10-22 against VS Code `1.142.0` in an Extension
Development Host window (renderer log
`~/.config/Code/logs/20261020T092728/window12/renderer.log`). Each variant was run
from **Agento Probe: Dispatch with model** with the same target — GPT 5.6 Luna
(`copilot` vendor) — chosen to differ from the picker's current model.

> Note on evidence: the user did not paste the full probe output channel. The
> screenshots show each run's payload and the probe's `settled` line, and the
> observation notes record them; the renderer-log `[ChatModelSelection]` lines below
> are the authoritative per-run record. The probe channel's `settled` value was
> `undefined` (no `chat.open` throw) for every M1–M5 run in both harnesses.

## Matrix

Each row links its screenshot. "Picker" is what the model picker showed after the
run; "Sent" is whether the request was submitted; "Footer" is the model the reply
footer named.

| Variant | Copilot picker | Copilot sent | Copilot footer | Local picker | Local sent | Local footer |
| --- | --- | --- | --- | --- | --- | --- |
| M1 `{ vendor: "copilot", id }` | Auto | yes (router answered) | Claude Sonnet 5.5 — **ignored**; persists a pending remembered model for later Copilot chats ([M1](step-1-2-copilot-M1.png)) | GPT-5.6 Luna | yes | GPT-5.6 Luna (4.4 credits) — **works** ([M1](step-1-2-local-M1.png)) |
| M2 `{ vendor, family }` | Auto | yes | Claude Sonnet 5.5 — **ignored** ([M2](step-1-2-copilot-M2.png)) | GPT-5.6 Luna | yes | GPT-5.6 Luna — **works** ([M2](step-1-2-local-M2.png)) |
| M3 `{ id }` | GPT-5.6 Luna | yes | GPT-5.6 Luna (2.9 credits) — **works** (agent-host entry sorts first) ([M3](step-1-2-copilot-M3.png)) | agent-host entry | **no** — request failed in chat | "The selected model 'agent-host-copilotcli:gpt-5.6-luna' is not available." — **breaks the request**, and `chat.open` does not throw ([M3](step-1-2-local-M3.png)) |
| M4 `mode: "📋 Agento Planner"` + M1 | Auto | yes | Claude Sonnet 5.5 — **ignored** (same vendor mismatch as M1; does not test mode-vs-selector order in Copilot) ([M4](step-1-2-copilot-M4.png)) | GPT-5.6 Luna | yes | GPT-5.6 Luna with Agento Planner selected (Planner pin is Claude Opus 5.5) — **works**; selector beats the agent pin ([M4](step-1-2-local-M4.png)) |
| M5 model-change command then V1 | Auto | yes | GPT-6 Luna (Auto routing) — **ignored** ([M5](step-1-2-copilot-M5.png)) | remembered | yes | GPT-5.6 Luna from remembered selection — **ignored (confounded by remembered model)** ([M5](step-1-2-local-M5.png)) |

### Summary

| Variant | Copilot | Local |
| --- | --- | --- |
| M1 `{ vendor: copilot, id }` | ignored → Auto, poisons remembered agent-host model | works |
| M2 `{ vendor, family }` | ignored → Auto | works |
| M3 `{ id }` | works (agent-host entry sorts first) | **BREAKS** the request ("model not available"), no throw |
| M4 `mode` + M1 | ignored (vendor mismatch) | works; selector beats agent pin |
| M5 model-change command | ignored | ignored |

## Renderer-log evidence (`[ChatModelSelection]`)

Copilot / M1 (18:46): `set-model model="copilot/gpt-5.6-luna"
sessionKey="agent-host-copilotcli" available=31`, then
`explicit-selection-applied model="copilot/gpt-5.6-luna"`, then `initialize (new
conversation) rememberedModel="copilot/gpt-5.6-luna" selection="pending"
resultModel=undefined pendingReference="copilot/gpt-5.6-luna"`.

Copilot / M2 (19:12): `set-model model="copilotcli/gpt-5.6-luna"` → next initialize
`selection="pending" pendingReference="copilotcli/gpt-5.6-luna"`. Footer Claude
Sonnet 5.5 (Auto). `vscode.lm` exposes a `copilotcli` vendor too; it is not the
agent-host session's list either.

Copilot / M3 (19:13): `set-model model="agent-host-copilotcli:gpt-5.6-luna"` →
`explicit-selection-applied`. Reply footer GPT-5.6 Luna. **works** —
`ids.sort().at(0)` picked the agent-host entry.

Copilot / M4 (19:16): `set-model model="copilot/gpt-5.6-luna"` → pending. Footer
Claude Sonnet 5.5. **ignored**.

Side effect: `set-model` runs with `persistSelection=true`; at 19:16:00 a fresh chat
initialized with `resultModel="agent-host-copilotcli:gpt-5.6-luna"`
`resultReason="remembered"`. Preselection changes the remembered model for later
chats in that session type.

Copilot / M5 (19:30): no `set-model` event in the agent-host session around 19:30
(only an initialize at 19:30:53, pending `copilot/gpt-5.6-luna`). Picker Auto;
footer GPT-6 Luna (Auto routing). **ignored**.

Local (sessionKey `local`, available=29) key events:

- 19:46:08 `copilot/gpt-5.6-luna` applied → M1 **works**.
- 19:51:11 `copilot/gpt-5.6-luna` applied → M2 **works** (target vendor was
  `copilot` this time; Copilot M2 used vendor `copilotcli`).
- 19:55:23 `agent-host-copilotcli:gpt-5.6-luna` → the request FAILED in chat with
  "The selected model 'agent-host-copilotcli:gpt-5.6-luna' is not available. Select
  a different model and try again." M3 **breaks the request** and `chat.open` does
  not throw, so a throw-based retry cannot catch it.
- 19:55:46 `copilot/gpt-5.6-luna` applied → M4 **works** (selector beats the agent
  pin; mode-then-model order confirmed in Local).
- 19:57:37 no `set-model` event after it; footer GPT-5.6 Luna came from the
  remembered selection (`initialize resultReason="remembered"`) → M5 **ignored
  (confounded by remembered model)**.

## Harness-detection finding

A new chat session's type comes from `getDefaultNewChatSessionTypeAndReason()`:
internal storage (the remembered session type), policy, and a computed default
(upstream `common/constants.ts` L576–L618). The context key
`chatIsAgentHostSession` exists but extensions cannot read context keys, and
`chat.open` (`IChatViewOpenOptions`) has no session-type option.

→ The extension cannot know which harness it dispatches into; no single selector is
safe in both. A Copilot selector in a Local session breaks the request; a Local
selector in a Copilot session falls back to Auto and persists a pending remembered
model for later Copilot chats. This is why plan.md's per-harness selection rule was
undecidable and the user was asked Q6 (answered 2026-10-22: option 6a, the opt-in
`agento.chatModelPreselect` setting — recorded in plan.md `## Decisions`).
