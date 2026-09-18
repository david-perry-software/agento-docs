# Step 6.1 — `/agento agento-init --migrate` prompt smoke (2026-09-18)

Throwaway pair (for the user to delete afterwards):

- product: `david-perry-software/agento-smoke-migrate-20260918`, primary checkout `/tmp/agento-smoke/agento-smoke-migrate-20260918`
- companion: `david-perry-software/agento-smoke-migrate-20260918-docs`, clone `/tmp/agento-smoke/agento-smoke-migrate-20260918-docs`

The steps of `.github/prompts/agento-init.prompt.md` (`## Steps` 1–10 and `## Migration (--migrate)` M1–M9) were driven literally from the smoke primary with this branch's CLI (`node <agento-root>/scripts/agento.mjs`, `<agento-root>` = the `feature/artifact-history-migration` worktree). The seeded history (`features/2026/09/demo/{plan.md,roadmap.md,evidence/step-1-1-demo.png}`, `issues/2026/09/bug/roadmap.md`, `initiatives/2026/09/init/breakdown.md`, five `chore: seed …` commits on `main`) and the empty companion repository predate this run (left by the first attempt of this step, resumed here).

## First pass

| Step | Command / observation | Result |
|---|---|---|
| 1 | `agento.mjs session --root <product>` | `worktree.isPrimary: true`, `role: primary`, branch `main`; not the Agento clone; `gh repo view` → `david-perry-software/agento-smoke-migrate-20260918 PUBLIC`; `HEAD branch: main` |
| 2 | companion name | `agento-smoke-migrate-20260918-docs` (fixed by the roadmap; ask-questions not needed) |
| 3 | `gh repo view <owner>/<name>` | exists → **adopted**; `../<name>` toplevel and `origin` match; `fetch` → `origin/main` absent (empty repository) |
| 4 | scaffold in `mktemp -d`, publish via Contents API, README first | `1540cd7 README.md`, `0901e0b features/.gitkeep`, `25d74d1 issues/.gitkeep`, `75f3fc7 initiatives/.gitkeep`, `b2ceeff .github/instructions/agento.instructions.md` (154 lines: template frontmatter + verbatim delivery-artifacts body); `fetch` + `checkout main` → clone tracks `origin/main` with exactly the five files |
| 5 | `gh api -X POST repos/<owner>/<name>/rulesets` (`pull_request`, `non_fast_forward`, `deletion`, `~DEFAULT_BRANCH`) | id `23677588`, `Agento default branch`, `active` (created — the repository was created by this same step's first attempt) |
| M1 | `agento.mjs migrate ../<name>` (dry run) | exit 0, `mode: dry-run`, `roots: features (3 files, 624 B), issues (1, 185 B), initiatives (1, 181 B)`, `conflicts: []`, `records.roadmaps`: `feature/demo` (complete, initiative `init`), `issue/bug` (complete, `github-issue: 1`); `records.breakdowns`: `init` → `[demo]` |
| M2 | `gh pr list --state open --json headRefName` | `[]` — no in-flight deliveries |
| M3 | `git -C ../<name> switch -c changes/agento-init origin/main` | branch created |
| M4 | `agento.mjs migrate ../<name> --apply` | exit 0, `mode: applied`, `moved: [features, issues, initiatives]`, `configWritten: <product>/.github/agento.json`, `readmeNoteAdded: true`, `records.identical: true`, `records.diff: []`; product tree: 5 deletions + `?? .github/`; companion tree: ` M README.md` + 5 untracked artifact files; README gained `## Migrated history` |
| M5 | `git -C ../<name> add -A && commit && push -u origin changes/agento-init` | `d87904a docs(migration): import delivery artifacts from david-perry-software/agento-smoke-migrate-20260918` |
| M6 | `cd ../<name> && gh pr create --draft --base main --head changes/agento-init …` | <https://github.com/david-perry-software/agento-smoke-migrate-20260918-docs/pull/1> (draft) |
| M7 / 6 | `.github/agento.json` | already present from M4 (template + `artifacts.repo.name: "agento-smoke-migrate-20260918-docs"`, `branches.default: "main"`) |
| M7 / 7 | `AGENTS.md` | created from `templates/AGENTS-section.md`; owner/companion filled; commands/verification/skills `none` (no runnable code); no unfilled `<placeholder>` left |
| M7 / 8 | `scripts/wait-for-checks.sh` | copied from the local clone, `chmod +x` |
| M7 / 9 | product rulesets / branch protection | no branch ruleset, protection `HTTP 404` — **gap recorded**, user not asked (throwaway repository) |
| M7 / 10 | `agento.mjs doctor --root <product>` | overall `ok`; `artifact-repo ok — /tmp/agento-smoke/agento-smoke-migrate-20260918-docs (agento-smoke-migrate-20260918-docs), origin …-docs.git, main present` |
| M7 | `git switch -c changes/agento-init && git add -A && commit && push -u`; `gh pr create` | `77f5aee chore(agento-init): move delivery artifacts to agento-smoke-migrate-20260918-docs` (8 files: config, AGENTS.md, poller added; 5 artifact files removed); <https://github.com/david-perry-software/agento-smoke-migrate-20260918/pull/1>; body links the companion PR and says "**Merge the companion PR first**" |
| M8 | `gh pr edit 1 --body …` inside the clone | **failed** on gh 2.45.0: `GraphQL: Projects (classic) is being deprecated … (repository.pullRequest.projectCards)`; cross-linked instead with `gh api -X PATCH repos/<owner>/<name>/pulls/1 -f body=…` — the companion PR body now ends with the product PR URL (follow-up filed) |
| M9 | report | both PR URLs above; merge order companion → product; `moved: 3 roots`; records: 2 roadmaps, 1 breakdown; README note added; per-file history stays in the product log |

## Verify line

- `git -C <tmp>/<name>-docs ls-tree -r --name-only origin/changes/agento-init` (scaffold files filtered out): `features/2026/09/demo/evidence/step-1-1-demo.png`, `features/2026/09/demo/plan.md`, `features/2026/09/demo/roadmap.md`, `initiatives/2026/09/init/breakdown.md`, `issues/2026/09/bug/roadmap.md` ✔
- product PR body: 1 match for `agento-smoke-migrate-20260918-docs/pull/1`, 1 match for "merge the companion PR first" ✔
- `agento.mjs doctor --root <tmp>/<product>` → `artifact-repo` `ok` ✔

## Second pass (rerun of the steps)

- M1: `{"status":"ok","mode":"nothing-to-migrate","configSet":true}`, exit 0 → M2–M6 skipped per the prompt.
- M3 resume: `git -C ../<name> switch changes/agento-init` → "Your branch is up to date with 'origin/changes/agento-init'".
- M6/M7 resume: `gh pr list --state open --head changes/agento-init` → the existing PR #1 in each repository; nothing created.
- Step 10 rerun: `artifact-repo` `ok`.
- `gh pr list --state all` counts after the second pass: product 1, companion 1 (no new PRs) ✔; both working trees clean.

Neither PR was merged (init never merges). Neither default branch was pushed by git; the companion's `main` was written only by the Contents API bootstrap before its ruleset existed.
