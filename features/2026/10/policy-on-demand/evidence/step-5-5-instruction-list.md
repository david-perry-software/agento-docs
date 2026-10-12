# Step 5.5 — VS Code's discovered instruction list (replaces manual step 5.2)

- Date: 2026-10-11
- VS Code: 1.136.0 (`code --version`)
- Window: the `policy-on-demand` build window
  (`plan-20261011-200239.code-workspace`) after *Developer: Reload Window*
- Source: the instruction listing VS Code injects into the agent's context for this
  workspace (the `<instructions>` block of the agent's system context), copied by the
  Autopilot from its own context. The copy omits the `<description>` of four entries
  and shortens the delivery-policy description with "…"; the Builder's own injected
  listing in the same window has the same eight `<file>` / `<applyTo>` pairs.

## Captured listing

```
<instruction>
<file>vscode-userdata:/home/david/.config/Code/User/prompts/screenshots-location.instructions.md</file>
<description>Where to find the user's screenshots when they mention or attach one</description>
<applyTo>**</applyTo>
</instruction>
<instruction>
<file>/home/david/DP/agento-worktrees/plan-20261011-200239/.github/instructions/agento-core.instructions.md</file>
<description>Agento always-on core: where the full delivery policy lives and when to read it, the work boundary, secrets, git musts, receipts, and the canonical /agento command spelling with the redirect rule for old forms</description>
<applyTo>**</applyTo>
</instruction>
<instruction>
<file>/home/david/DP/agento-worktrees/plan-20261011-200239/.github/instructions/ai-skills.instructions.md</file>
<description>Skills-first policy: load the matching installed AI skill before domain work</description>
<applyTo>**</applyTo>
</instruction>
<instruction>
<file>/home/david/DP/agento-worktrees/plan-20261011-200239/.github/instructions/concurrent-delivery.instructions.md</file>
<applyTo>features/**,issues/**</applyTo>
</instruction>
<instruction>
<file>/home/david/DP/agento-worktrees/plan-20261011-200239/.github/instructions/delivery-artifacts.instructions.md</file>
<applyTo>features/**,issues/**,initiatives/**</applyTo>
</instruction>
<instruction>
<file>/home/david/DP/agento-worktrees/plan-20261011-200239/.github/instructions/delivery-policy.instructions.md</file>
<description>Use when running any /agento command or acting as an Agento agent (Planner, Builder, Reviewer, Autopilot, Architect, Mechanic): the full delivery policy — …</description>
<applyTo>.github/agents/**,.github/prompts/**,.github/instructions/**,commands/**</applyTo>
</instruction>
<instruction>
<file>/home/david/DP/agento-docs-worktrees/plan-20261011-200239/.github/instructions/agento-concurrency.instructions.md</file>
<applyTo>features/**,issues/**</applyTo>
</instruction>
<instruction>
<file>/home/david/DP/agento-docs-worktrees/plan-20261011-200239/.github/instructions/agento.instructions.md</file>
<applyTo>features/**,issues/**,initiatives/**</applyTo>
</instruction>
```

For contrast, the listing VS Code injected at the start of the Autopilot session,
before the build, showed `command-invocation.instructions.md` and
`delivery-policy.instructions.md` both with `<applyTo>**</applyTo>`.

## Frontmatter on disk

Product half (`/home/david/DP/agento-worktrees/plan-20261011-200239`):

```
$ grep -H '^applyTo:' .github/instructions/*.md
.github/instructions/agento-core.instructions.md:applyTo: "**"
.github/instructions/ai-skills.instructions.md:applyTo: "**"
.github/instructions/concurrent-delivery.instructions.md:applyTo: "features/**,issues/**"
.github/instructions/delivery-artifacts.instructions.md:applyTo: "features/**,issues/**,initiatives/**"
.github/instructions/delivery-policy.instructions.md:applyTo: ".github/agents/**,.github/prompts/**,.github/instructions/**,commands/**"
$ grep -l '^applyTo: "\*\*"' .github/instructions/*.md
.github/instructions/agento-core.instructions.md
.github/instructions/ai-skills.instructions.md
```

Companion half (`/home/david/DP/agento-docs-worktrees/plan-20261011-200239`):

```
$ grep -H '^applyTo:' .github/instructions/*.md
.github/instructions/agento-concurrency.instructions.md:applyTo: "features/**,issues/**"
.github/instructions/agento.instructions.md:applyTo: "features/**,issues/**,initiatives/**"
```

## Comparison

| Instruction file | Repository | Listing `applyTo` | Disk `applyTo` | Always-on | Match |
| --- | --- | --- | --- | --- | --- |
| `screenshots-location.instructions.md` | user profile (not this repository) | `**` | — | yes | n/a |
| `agento-core.instructions.md` | product | `**` | `"**"` | yes | yes |
| `ai-skills.instructions.md` | product | `**` | `"**"` | yes | yes |
| `concurrent-delivery.instructions.md` | product | `features/**,issues/**` | `"features/**,issues/**"` | no | yes |
| `delivery-artifacts.instructions.md` | product | `features/**,issues/**,initiatives/**` | `"features/**,issues/**,initiatives/**"` | no | yes |
| `delivery-policy.instructions.md` | product | `.github/agents/**,.github/prompts/**,.github/instructions/**,commands/**` | same | no | yes |
| `command-invocation.instructions.md` | product | absent | absent (file deleted in 2.3) | — | yes |
| `agento-concurrency.instructions.md` | companion | `features/**,issues/**` | `"features/**,issues/**"` | no | yes |
| `agento.instructions.md` | companion | `features/**,issues/**,initiatives/**` | `"features/**,issues/**,initiatives/**"` | no | yes |

Result: VS Code applies `**` to exactly two repository files, `agento-core` and
`ai-skills` (plus the user-profile `screenshots-location`), the same two that
`grep -l '^applyTo: "\*\*"'` lists on disk. `delivery-policy` carries its narrowed
`applyTo` and `command-invocation` is gone.
