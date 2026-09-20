# Reproduction commands and outputs

Date: 2026-09-20

## 1) In-review transition resolves to reviewer command

Command:

```bash
node --input-type=module -e "import { deriveNext } from './scripts/session-state.mjs'; const out = deriveNext({ role: 'build', worktree: { path: '/tmp/wt', branch: 'feature/widget' }, delivery: { type:'feature', slug:'widget', status:'in-review', reviewVerdict:null, postShipPending:0 }, lifecycle:'in-review', owner:null, reviewFresh:null, candidates:[], requestedSlug:'widget', config:{ branches:{ default:'main' } } }); console.log(JSON.stringify(out, null, 2));"
```

Observed output is saved in `derive-next-in-review.json` and includes:

- `"invocation": "/agento review-feature widget"`
- `"reason": "status in-review with no verdict yet: the Reviewer runs in this window"`

## 2) Builder/Reviewer handoff metadata is non-forwarding

Command:

```bash
rg -n "send:\\s*false|handoffs:" .github/agents/delivery-builder.agent.md .github/agents/delivery-reviewer.agent.md
```

Observed output is saved in `handoff-send-false.txt` and includes:

- `.github/agents/delivery-builder.agent.md:13:    send: false`
- `.github/agents/delivery-reviewer.agent.md:13:    send: false`

## 3) Autopilot contract expects in-review to proceed to review phase

Command:

```bash
rg -n "in-review|skip straight to the review phase|invoke the .*Reviewer" .github/agents/delivery-autopilot.agent.md
```

Observed output is saved in `autopilot-review-loop-spec.txt` and includes lines documenting:

- `status: in-review` skip-straight-to-review behavior
- review-loop continuation expectations

## 4) Additional validation attempts

- `node --test scripts/agento.test.mjs --test-name-pattern "next: review freshness decides between ship, re-review, and the fix handoff"` passed.
- `npm --prefix extension run test:unit` currently fails in this environment with `tsc: not found` (missing extension dependency setup), so extension-level runtime verification was not completed in this planning session.
