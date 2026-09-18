# Step 5.7 — session converted to companion mode (2026-09-18)

Product HEAD: 4d54703 on feature/artifact-history-migration; companion half HEAD: 06babcf.

## `node scripts/agento.mjs config` (build worktree)

```json
{
  "root": "/home/david/DP/agento-worktrees/plan-20260917-231812",
  "configSource": "/home/david/DP/agento-worktrees/plan-20260917-231812/.github/agento.json",
  "artifactsRoot": "/home/david/DP/agento-docs",
  "artifacts": null
}
```

## `node scripts/agento.mjs session --pr` (build worktree, trimmed)

```json
{
  "role": "build",
  "companion": {
    "path": "/home/david/DP/agento-docs-worktrees/plan-20260917-231812",
    "branch": "feature/artifact-history-migration",
    "detached": false,
    "dirty": false,
    "ahead": 0,
    "behind": 0,
    "registered": true
  },
  "delivery": {
    "roadmap": "features/2026/09/artifact-history-migration/roadmap.md",
    "status": "in-progress",
    "artifactPr": "#1",
    "steps": {
      "ticked": 18,
      "total": 24
    }
  },
  "pr": 45,
  "companionPr": 1,
  "lifecycle": "building",
  "warnings": []
}
```

## `node scripts/agento.mjs doctor --for build-feature` (exit 0)

```json
{
  "status": "warn",
  "checks": [
    {
      "id": "node",
      "status": "ok",
      "detail": "node v22.22.3"
    },
    {
      "id": "git-remote",
      "status": "ok",
      "detail": "origin https://github.com/david-perry-software/agento.git, main reachable"
    },
    {
      "id": "gh",
      "status": "ok",
      "detail": "gh version 2.45.0 (2025-07-18 Ubuntu 2.45.0-1ubuntu0.3); authenticated"
    },
    {
      "id": "python3",
      "status": "ok",
      "detail": "Python 3.12.3"
    },
    {
      "id": "worktrees-dir",
      "status": "ok",
      "detail": "/home/david/DP/agento-worktrees writable"
    },
    {
      "id": "artifact-repo",
      "status": "warn",
      "detail": "/home/david/DP/agento-docs (agento-docs), origin https://github.com/david-perry-software/agento-docs.git, main present; stale in-repo roots: features/, issues/, initiatives/"
    }
  ]
}
```

The `artifact-repo` `warn` names the stale in-repo roots still present in the primary (`main`); expected until the code PR merges.

## `node scripts/agento.mjs ship-preflight feature artifact-history-migration --pr --root /home/david/DP/agento` (this branch's CLI against the primary on `main`, trimmed)

```json
{
  "status": "ok",
  "layout": "branch",
  "artifactsRoot": "/home/david/DP/agento-docs",
  "branch": "feature/artifact-history-migration",
  "owner": {
    "path": "/home/david/DP/agento-worktrees/plan-20260917-231812",
    "role": "build",
    "dirPrefix": "plan",
    "id": "20260917-231812"
  },
  "companion": {
    "path": "/home/david/DP/agento-docs-worktrees/plan-20260917-231812",
    "branch": "feature/artifact-history-migration",
    "dirty": false,
    "ahead": 0
  },
  "companionGaps": [],
  "pr": {
    "number": 45,
    "isDraft": true,
    "state": "OPEN"
  },
  "companionPr": {
    "number": 1,
    "isDraft": true,
    "state": "OPEN"
  },
  "warnings": []
}
```

Note: `cd /home/david/DP/agento && node scripts/agento.mjs …` runs `main`'s pre-migration CLI (no `layoutFor`) and reports `no-resolvable-roadmap`; the branch's CLI with `--root` is the faithful check, and is what `/agento ship` runs after the PR merges.

## `node scripts/agento.mjs initiative external-artifact-repo --root /home/david/DP/agento-docs-worktrees/plan-20260917-231812` (trimmed)

```json
{
  "status": "ok",
  "errors": [],
  "features": [
    {
      "slug": "artifact-repo-config",
      "wave": 1,
      "state": "complete"
    },
    {
      "slug": "artifact-repo-init",
      "wave": 2,
      "state": "complete"
    },
    {
      "slug": "artifact-repo-hooks",
      "wave": 2,
      "state": "complete"
    },
    {
      "slug": "paired-artifact-worktrees",
      "wave": 2,
      "state": "complete"
    },
    {
      "slug": "mirrored-artifact-branches",
      "wave": 3,
      "state": "complete"
    },
    {
      "slug": "ship-dual-merge",
      "wave": 4,
      "state": "complete"
    },
    {
      "slug": "artifact-history-migration",
      "wave": 5,
      "state": "in-progress"
    }
  ]
}
```

Without `--root <half>` the build worktree resolves `artifactsRoot` to the companion clone (`main`), which carries no artifacts until agento-docs#1 merges, so `initiative` reports `missing` there; `session` already derives the delivery from the half (`companionHalfOf`). Recorded as a follow-up in roadmap.md.
