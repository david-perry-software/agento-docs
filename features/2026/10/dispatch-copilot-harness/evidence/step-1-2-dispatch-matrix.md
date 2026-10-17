# Step 1.2 — Dispatch probe matrix

Completion date: 2026-10-17

The user ran the dispatch probe (`Agento Probe: Dispatch variant`) in the
`[Extension Development Host] agento` window the Builder opened via
`code --new-window --extensionDevelopmentPath=<worktree>/tests/harness-probe/dispatch-probe
/home/david/DP/agento`, once with the chat Session Target set to **Copilot** and
once with it set to **Local**.

The plan's selection rule (`plan.md` `## Approach` §2) picks the first variant in
the preference order **V1, V3, V4, V8, V6, V2, V5** that submits in both harnesses.
V1 — today's `{ query, mode: "agent", attachFiles }` payload — submitted in both,
so the rule selected V1 and the remaining variants V2–V8 were **not run** (they are
unnecessary under the rule).

The Copilot Session Target was confirmed by the user: "Everything I did earlier
and screenshotted was in Copilot. The Copilot logo goes away once chat begins."
The Copilot screenshot shows `Chat with Copilot` and `Agent Claude Opus 5.5`; the
Local screenshot shows `Local` in the chat footer.

## Matrix

| Variant | Harness | Filled | Submitted | Receipt printed | Agent mode | Attachment shown | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| V1 | Copilot | yes | yes | yes — `Receipt: accepted delivery-status:main:2a39ba1` | Agent (`Agent Claude Opus 5.5`) | yes — `delivery-status.md` | [step-1-2-copilot-v1.png](step-1-2-copilot-v1.png) |
| V1 | Local | yes | yes | yes — `Receipt: accepted delivery-status:main:2a39ba1` | Agent | yes — `delivery-status.md` | [step-1-2-local-v1.png](step-1-2-local-v1.png) |
| V2 | — | not run (V1 selected by the rule) | | | | | |
| V3 | — | not run (V1 selected by the rule) | | | | | |
| V4 | — | not run (V1 selected by the rule) | | | | | |
| V5 | — | not run (V1 selected by the rule) | | | | | |
| V6 | — | not run (V1 selected by the rule) | | | | | |
| V7 | — | not run (V1 selected by the rule) | | | | | |
| V8 | — | not run (V1 selected by the rule) | | | | | |

## Runs

### V1 — Copilot

- Filled the chat input with `/agento delivery-status` and attached
  `delivery-status.md`; Agent mode selected (`Agent Claude Opus 5.5`).
- Submitted automatically; the turn ran and printed
  `Receipt: accepted delivery-status:main:2a39ba1` (13 steps in 56 s).
- Probe output channel log:
  ```
  [V1] open {"query":"/agento delivery-status","mode":"agent","attachFiles":[{"$mid":1,"path":"/home/david/DP/agento-plugin/commands/delivery-status.md","scheme":"file"}]}
  [V1] settled undefined in 25 ms
  ```

### V1 — Local

- Filled the chat input with `/agento delivery-status` and attached
  `delivery-status.md`; Agent mode selected.
- Submitted automatically; the turn ran and printed
  `Receipt: accepted delivery-status:main:2a39ba1` (30 steps in 3 m 3 s).
- Probe output channel log:
  ```
  [V1] open {"query":"/agento delivery-status","mode":"agent","attachFiles":[{"$mid":1,"path":"/home/david/DP/agento-plugin/commands/delivery-status.md","scheme":"file"}]}
  [V1] settled undefined in 21 ms
  ```

## Selection

Chosen variant: **V1** — the first variant in the preference order that submits in
both Copilot and Local, and today's existing payload. No `chatOpenOptions` code
change is required.
