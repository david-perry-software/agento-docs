# Step 2.1 — hook parity evidence

Run 2026-10-09 in the build worktree (`feature/hooks-node-port`, product commit
`ca2b67b` plus the uncommitted `tests/hook-parity.test.mjs`):

```
node --test tests/hook-parity.test.mjs
```

Exit 0. Every case runs the wrapper once with `AGENTO_HOOK_IMPL=python` and once with
`AGENTO_HOOK_IMPL=node`; stdout is compared byte for byte.

| Hook | Corpus | Cases | Differences |
| --- | --- | --- | --- |
| delivery guard | `tests/guard-fixtures.txt` (throwaway repo on `feature/replay`) | 101 commands | 0 |
| delivery guard | `tests/guard-fixtures-companion.txt` (`REPLAY_COMPANION` layout, `{companion}` substituted, default `trunk`) | 30 commands | 0 |
| delivery guard | guard-test corpus: roadmap nudge (index, `-a`, pathspecs, redirections, `-F`/`-C`/`--message`/`--`, non-ASCII message), chained `switch`/`checkout`, `stash`, `if … then`, `branch --delete --force`, `reset --hard`, `main-thing`, `--force-with-lease=`, `worktree remove`, `git -C` to a missing dir, `cd ~`, hook-path writes and reads (`rm`, `cp` both ways, `perl -pi`, `git checkout --`, `chmod`, `env … timeout … rm`, `sudo tee`, unbalanced quote), watchers behind prefixes, `gh pr merge` flags, a managed session pair (product-half commit nudge, half/clone `-C` and `cd` forms), edit-tool `filePath` payloads (snake and camel case), malformed / empty / non-object JSON, string `tool_input` | 60 payloads | 0 |
| SessionStart | plain (no work; resumable roadmaps in both roots; quotes/tabs/non-ASCII `next-step` on `main`), custom roots, managed build worktree, session pair (product half, primary, companion clone as cwd, detached half, no half), missing companion clone, worktree config over a primary without `artifacts.repo` and that primary, a non-git directory, malformed payload | 15 payloads | 0 |

Result: **0 differences** for both hooks.

```
ok 1 - parity: guard fixtures (tests/guard-fixtures.txt)
# guard-fixtures.txt: 101 commands
ok 2 - parity: companion guard fixtures (tests/guard-fixtures-companion.txt)
# guard-fixtures-companion.txt: 30 commands
ok 3 - parity: guard-test corpus
# guard-test corpus: 60 payloads
ok 4 - parity: SessionStart corpus
# SessionStart corpus: 15 payloads
# tests 4
# pass 4
# fail 0
```

Switch sanity check (the two runs really are different implementations):
`printf '[1,2]' | AGENTO_HOOK_IMPL=python bash scripts/hooks/delivery-guard.sh`
prints a Python `AttributeError: 'list' object has no attribute 'get'` traceback on
stderr; the same input with `AGENTO_HOOK_IMPL=node` prints 0 bytes. Both print nothing
on stdout (allow), which is the parity being asserted.
