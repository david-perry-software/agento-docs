# Step 5.1 — always-on after measurement

Measured 2026-10-11 in the product half on `feature/policy-on-demand` after steps
2.1–4.3.

```console
$ grep -l '^applyTo: "\*\*"' .github/instructions/*.md
.github/instructions/agento-core.instructions.md
.github/instructions/ai-skills.instructions.md
$ wc -l -c $(grep -l '^applyTo: "\*\*"' .github/instructions/*.md)
  38 2129 .github/instructions/agento-core.instructions.md
  18  961 .github/instructions/ai-skills.instructions.md
  56 3090 total
```

| | Files | Lines | Bytes |
| --- | --- | --- | --- |
| Before ([step 1.1](step-1-1-baseline.md)) | `delivery-policy`, `command-invocation`, `ai-skills` | 517 | 32 063 |
| After | `agento-core`, `ai-skills` | 56 | 3 090 |
| Change | | −461 (−89 %) | −28 973 (−90 %) |

The after total (3 090 bytes) is within the 4 096-byte acceptance limit.
