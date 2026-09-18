# Reviewer verification — #47 guard-branch-delete-on-main (2026-09-18, product HEAD `dbd9ddf`)

Independent re-drive by the Reviewer in the build worktree
`/home/david/DP/agento-worktrees/plan-20260918-223902`. Probe inputs were written with
an edit tool to `/tmp` and fed by file path / stdin (the guard denies command lines
that quote the offending text).

## Gate (compared against plan.md `## Research` baseline)

| Command | Baseline | Fresh run |
|---|---|---|
| `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` | exit 0, 0 findings | exit 0, 0 findings |
| `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` | 206/206 | `# tests 206`, `# pass 206`, `# fail 0`, exit 0 |
| `./scripts/hooks/replay-guard.sh < tests/guard-fixtures.txt` | exit 0, 0 MISMATCH (104 lines) | exit 0, 0 MISMATCH, 97 verdicts (110 lines incl. comments/blanks) |
| `REPLAY_COMPANION=1 ./scripts/hooks/replay-guard.sh < tests/guard-fixtures-companion.txt` | exit 0, 0 MISMATCH (45 lines) | exit 0, 0 MISMATCH, 30 verdicts (48 lines) |

No new or undocumented findings.

## Exposing test confirmed against the pre-fix guard

Guard extracted from `e8f4da6` (`git archive e8f4da6 | tar -x -C /tmp/agento-e8f4da6`)
and run against the current fixtures:

    git switch main && git push origin --delete feature/x   -> deny  (expected allow) MISMATCH
    git switch main && git push origin :feature/x           -> deny  (expected allow) MISMATCH
    git switch main && git push origin -d feature/x         -> deny  (expected allow) MISMATCH
    3 fixture(s) did not match their expected verdict        exit=1

    (companion) … switch trunk && … push origin --delete feature/x -> deny (expected allow) MISMATCH
    (companion) … switch trunk && … push origin :feature/x         -> deny (expected allow) MISMATCH
    2 fixture(s) did not match their expected verdict        exit=1

## Direct on-`main` probe (`bash /tmp/agento-review-probe-on-main.sh`)

Throwaway repo `git init -b main` + one empty commit; guard at `dbd9ddf`; `branch: main`.

    git push origin --delete feature/copyable-command-blocks        (no output -> allow)
    git push origin :feature/copyable-command-blocks                (no output -> allow)
    git push origin -d feature/copyable-command-blocks              (no output -> allow)
    git push origin --delete main            deny "Deleting main on the remote is forbidden."
    git push origin :main                    deny "Deleting main on the remote is forbidden."
    git push origin HEAD:feature/x           deny "Direct commits/pushes to main are forbidden; …"
    git push origin feature/x:feature/y      deny "Direct commits/pushes to main are forbidden; …"
    git push origin HEAD:main                deny "Direct commits/pushes to main are forbidden; …"
    git push origin main                     deny "Direct commits/pushes to main are forbidden; …"
    git push origin                          deny "Direct commits/pushes to main are forbidden; …"
    git push                                 deny "Direct commits/pushes to main are forbidden; …"
    git -C /home/david/DP/agento-docs push origin --delete feature/copyable-command-blocks   (no output -> allow)

## Regex edge probes (`./scripts/hooks/replay-guard.sh < /tmp/agento-review-edge-fixtures.txt`)

Expected values are the *desired* verdicts; `MISMATCH` marks a gap, not a fixture failure.

    git push origin :refs/heads/main                                         -> allow   (pre-existing: line-381 rule matches only `:main`)
    git switch main && git push origin :refs/heads/main                      -> allow  (expected deny) MISMATCH
    git switch main && git push origin --delete refs/heads/main              -> allow  (expected deny) MISMATCH
    git switch main && git push origin -d main                               -> deny
    git switch main && git push --delete origin main                         -> deny
    git switch main && git push --delete origin feature/x                    -> allow
    git switch main && git push origin +:feature/x                           -> deny   (force rule)
    git switch main && git push origin --delete feature/x --force            -> deny   (force rule)
    git switch main && git push origin -d feature/x main                     -> deny   (push_to_default)
    git switch main && git push origin feature/x :feature/y                  -> allow  (expected deny) MISMATCH
    git switch main && git push origin --dry-run                             -> deny
    git switch main && git push origin main:feature/x                        -> deny
    git switch main && git push origin refs/heads/main:refs/heads/feature/x  -> deny
    git switch main && git push origin --delete feature/main-thing           -> allow

Interpretation: `HEAD:<ref>`, `src:dst`, bare `main`, `HEAD:main`, and mixed
delete+default pushes all stay denied. Two minor gaps remain, both recorded as
Follow-ups in roadmap.md / review.md: the fully-qualified `refs/heads/<default>` delete
spelling was never caught by the line-381 rule (allowed from any non-default branch
before this change; the on-`main` blanket rule incidentally covered it and no longer
does), and a *mixed* content-plus-delete refspec list (`feature/x :feature/y`) from
`main` is now allowed because `is_delete_push` tests for the presence of a delete
refspec rather than for delete-only.
