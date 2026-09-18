# Probe after fix — #47 guard-branch-delete-on-main (2026-09-18, product HEAD 38fb601)

Direct invocation of `scripts/hooks/delivery-guard.sh` against a throwaway repo
(`git init -b main`, one empty commit) checked out on `main`. Script:
`/tmp/agento-probe-on-main.sh` (the §2 probe from `repro-2026-09-18.md`, extended to
three commands; written with an edit tool because the guard denies command lines that
quote the offending text). Each command is fed as
`{"tool_name":"run_in_terminal","tool_input":{"command":"<cmd>"},"cwd":"<tmp>"}`.

Output of `bash /tmp/agento-probe-on-main.sh`:

    guard: /home/david/DP/agento-worktrees/plan-20260918-223902/scripts/hooks/delivery-guard.sh @ 38fb601
    branch: main

    command: git push origin --delete feature/copyable-command-blocks
    (no output -> allow)

    command: git push origin --delete main
    {"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "Deleting main on the remote is forbidden."}}

    command: git push origin HEAD:feature/x
    {"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "Direct commits/pushes to main are forbidden; use a work branch and a pull request."}}

Result: the delete of the non-default branch is now allowed from `main` (no
`"permissionDecision": "deny"`); deleting `main` itself and a content push
(`HEAD:feature/x`) from `main` both remain denied.
