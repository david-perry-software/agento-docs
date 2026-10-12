# Step 1.1 — always-on baseline

Measured 2026-10-11 in the product half at the branch base `c73fc40` (content identical
to `origin/main` `54ffd54`).

## `applyTo: "**"` instruction files

```console
$ grep -l '^applyTo: "\*\*"' .github/instructions/*.md
.github/instructions/ai-skills.instructions.md
.github/instructions/command-invocation.instructions.md
.github/instructions/delivery-policy.instructions.md
$ wc -l -c $(grep -l '^applyTo: "\*\*"' .github/instructions/*.md)
   18   961 .github/instructions/ai-skills.instructions.md
   60  1919 .github/instructions/command-invocation.instructions.md
  439 29183 .github/instructions/delivery-policy.instructions.md
  517 32063 total
```

## VS Code 1.136.0 bundle facts

`/usr/share/code/resources/app/out/vs/workbench/workbench.desktop.main.js`
(`code --version` → `1.136.0`):

```console
$ grep -oE '\[[A-Za-z]{1,3}\.INCLUDE_REFERENCED_INSTRUCTIONS\]:\{[^}]{0,400}' "$B"
[Ha.INCLUDE_REFERENCED_INSTRUCTIONS]:{type:"boolean",title:d(10173,null),markdownDescription:d(10172,null),default:!1,restricted:!0,disallowConfigurationDefault:!0,tags:["prompts","reusable prompts","prompt snippets","instructions"]
$ grep -oE 'pluginRootEnvVars:\[[^]]*\]' "$B" | sort -u
pluginRootEnvVars:[]
pluginRootEnvVars:["PLUGIN_ROOT","CLAUDE_PLUGIN_ROOT"]
```

- `chat.includeReferencedInstructions` defaults to `false` (`default:!1`), is
  `restricted`, and disallows configuration defaults, so linked instruction files are
  not loaded unless the user enables it.
- Claude-format plugin hooks receive `PLUGIN_ROOT` and `CLAUDE_PLUGIN_ROOT`; the other
  hook source gets none (`pluginRootEnvVars:[]`).
