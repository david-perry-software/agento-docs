# dashboard-cli timing evidence

Measured 2026-10-09 on this machine against the live GitHub API (real `gh`), three
wall-clock runs per command (`spawnSync("node", [cli, …args], { cwd })`, process
start to exit), median reported. "Primary" is `/home/david/DP/agento` on `main`
(`1377a18`); "build" is the build worktree
`/home/david/DP/agento-worktrees/plan-20261009-064342` on `feature/dashboard-cli`.
`main` CLI = `/home/david/DP/agento/scripts/agento.mjs`; branch CLI = this
branch's `scripts/agento.mjs`. Network latency varies by a few hundred ms between
runs; compare within one table.

## Breakdown baseline (agento-hardening, `main` `4b38ce5`)

| `session --pr` | `doctor` | `status --pr` | `initiative` | `initiative <slug>` | sum |
| --- | --- | --- | --- | --- | --- |
| 979 | 1 286 | 1 465 | 92 | 86 | 3 908 |

## Round 1 — step 2.4 (code as of steps 2.1–2.3: doctor probes queued ahead of PR lookups)

### `main` CLI, primary cwd (today's refresh)

| command | runs (ms) | median (ms) | exit |
| --- | --- | --- | --- |
| `session --pr` | 985 / 897 / 1023 | 985 | 0 |
| `doctor` | 1201 / 1189 / 1289 | 1201 | 0 |
| `status --pr` | 1254 / 1177 / 1313 | 1254 | 0 |
| `initiative` | 68 / 65 / 71 | 68 | 0 |
| `initiative agento-hardening` | 78 / 76 / 78 | 78 | 0 |

Slowest standalone median 1 254 ms; sum 3 586 ms.

### Branch CLI, primary cwd

| command | runs (ms) | median (ms) | exit |
| --- | --- | --- | --- |
| `session --pr` | 821 / 848 / 823 | 823 | 0 |
| `doctor` | 1334 / 1313 / 1269 | 1313 | 0 |
| `status --pr` | 1339 / 1157 / 1152 | 1157 | 0 |
| `initiative` | 66 / 65 / 68 | 66 | 0 |
| `initiative agento-hardening` | 75 / 75 / 74 | 75 | 0 |
| `dashboard --pr` | 1398 / 1400 / 1433 | 1400 | 0 |

Slowest standalone median 1 313 ms; sum 3 434 ms.
dashboard --pr median ≤ slowest standalone median: no (1 400 > 1 313; ≤ sum: yes)

### Branch CLI, build cwd

| command | runs (ms) | median (ms) | exit |
| --- | --- | --- | --- |
| `session --pr` | 1241 / 1353 / 1166 | 1241 | 0 |
| `doctor` | 1157 / 1355 / 1407 | 1355 | 0 |
| `status --pr` | 1422 / 1364 / 1367 | 1367 | 0 |
| `initiative` | 68 / 70 / 64 | 68 | 0 |
| `initiative agento-hardening` | 75 / 72 / 77 | 75 | 0 |
| `dashboard --pr` | 1146 / 1131 / 1174 | 1146 | 0 |

Slowest standalone median 1 367 ms; sum 4 106 ms.
dashboard --pr median ≤ slowest standalone median: yes (1 146 ≤ 1 367)

### Diagnosis

Single calls from the primary: `gh --version` 33 ms, `gh auth status` 484 ms,
`git ls-remote … origin main` 380 ms, `code --version` 81 ms, `python3 --version`
4 ms, `gh pr view` 375–982 ms. The pool held the four doctor probes first, so the
slowest PR lookup started only after `git ls-remote` finished. Once the pool order
was fixed, `dashboard --pr`'s own timings still showed `doctor` at ≈ 220 ms after
the prefetch: the local `model-profile` check, which spawns one `git show` per
pinned file, ran serially after the network wait. Step 2.7 (added) fixes both.

## Round 2 — step 2.7 (PR lookups queued right after `gh --version`; local doctor checks and the initiatives section computed while the pool runs)

### Branch CLI, primary cwd

| command | runs (ms) | median (ms) | exit |
| --- | --- | --- | --- |
| `session --pr` | 965 / 904 / 916 | 916 | 0 |
| `doctor` | 1265 / 1190 / 1185 | 1190 | 0 |
| `status --pr` | 1322 / 1247 / 1573 | 1322 | 0 |
| `initiative` | 64 / 65 / 65 | 65 | 0 |
| `initiative agento-hardening` | 73 / 75 / 72 | 73 | 0 |
| `dashboard --pr` | 1101 / 986 / 1069 | 1069 | 0 |

Slowest standalone median 1 322 ms; sum 3 566 ms; `dashboard --pr` in-process
`timings.total` median 1 023 ms.
dashboard --pr median ≤ slowest standalone median: yes (1 069 ≤ 1 322; ≤ sum 3 566: yes)

### `main` CLI, build cwd (today's refresh from a build window)

| command | runs (ms) | median (ms) | exit |
| --- | --- | --- | --- |
| `session --pr` | 1416 / 1355 / 1243 | 1355 | 0 |
| `doctor` | 1279 / 1196 / 1222 | 1222 | 0 |
| `status --pr` | 1612 / 1477 / 1396 | 1477 | 0 |
| `initiative` | 67 / 66 / 67 | 67 | 0 |
| `initiative agento-hardening` | 79 / 75 / 77 | 77 | 0 |

Slowest standalone median 1 477 ms; sum 4 198 ms.

### Branch CLI, build cwd

| command | runs (ms) | median (ms) | exit |
| --- | --- | --- | --- |
| `session --pr` | 1287 / 1210 / 1204 | 1210 | 0 |
| `doctor` | 1151 / 1186 / 1207 | 1186 | 0 |
| `status --pr` | 1231 / 1337 / 1436 | 1337 | 0 |
| `initiative` | 66 / 64 / 64 | 64 | 0 |
| `initiative agento-hardening` | 75 / 74 / 75 | 75 | 0 |
| `dashboard --pr` | 761 / 777 / 796 | 777 | 0 |

Slowest standalone median 1 337 ms; sum 3 872 ms; `dashboard --pr` in-process
`timings.total` median 732 ms.
dashboard --pr median ≤ slowest standalone median: yes (777 ≤ 1 337; ≤ sum 3 872: yes)

## Summary

One `dashboard --pr` spawn replaces the extension's five-plus spawns per refresh.
Against today's `main` CLI the refresh drops from 3 586 ms of process time (critical
path 1 254 ms) to 1 069 ms from the primary, and from 4 198 ms (critical path
1 477 ms) to 777 ms from a build worktree.
