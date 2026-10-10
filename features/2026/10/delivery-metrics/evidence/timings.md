# delivery-metrics — dashboard timings (step 2.5)

Measured 2026-10-10 with this branch's CLI
(`node /home/david/DP/agento-worktrees/plan-20261010-205716/scripts/agento.mjs`,
product HEAD after step 2.4) on this repository: 56 roadmaps, companion mode, real
`gh` (four non-complete branches looked up with `--pr`), warm git cache. Wall time
per spawn, three runs each, measured with `process.hrtime` around `spawnSync`; the
breakdown is the document's own `timings` (ms). Budget (from
`features/2026/10/dashboard-cli`): `dashboard --pr` median ≤ the slowest standalone
median.

## primary (/home/david/DP/agento, main)

| Command | Run 1 (ms) | Run 2 (ms) | Run 3 (ms) | Median (ms) |
| --- | --- | --- | --- | --- |
| `status --pr` | 1152 | 1111 | 1122 | 1122 |
| `metrics` | 349 | 375 | 344 | 349 |
| `dashboard --pr` | 1021 | 1054 | 1037 | 1037 |

`dashboard --pr` timings breakdown (ms, per run):

- initiatives 49, session 0, doctor 4, deliveries 41, metrics 15, total 961
- initiatives 41, session 0, doctor 4, deliveries 40, metrics 16, total 1002
- initiatives 47, session 0, doctor 4, deliveries 42, metrics 16, total 983

dashboard --pr median ≤ slowest standalone median: yes (1037 ms vs 1122 ms)

## build worktree (plan-20261010-205716)

| Command | Run 1 (ms) | Run 2 (ms) | Run 3 (ms) | Median (ms) |
| --- | --- | --- | --- | --- |
| `status --pr` | 1602 | 1305 | 1267 | 1305 |
| `metrics` | 293 | 332 | 297 | 297 |
| `dashboard --pr` | 840 | 764 | 832 | 832 |

`dashboard --pr` timings breakdown (ms, per run):

- initiatives 45, session 17, doctor 4, deliveries 41, metrics 16, total 787
- initiatives 43, session 22, doctor 4, deliveries 44, metrics 15, total 707
- initiatives 49, session 19, doctor 4, deliveries 42, metrics 15, total 777

dashboard --pr median ≤ slowest standalone median: yes (832 ms vs 1305 ms)

## Reading

The metrics section costs 15–16 ms of synchronous parse and derivation inside the
dashboard; its three kinds of `git log` (one artifact patch log, one branch-only log
for `delivery-metrics`, one product merge log) run asynchronously beside the PR
lookups and are hidden by them. Standalone `metrics` (~300–350 ms wall, mostly node
start-up, the roadmap walk, and the synchronous logs) stays well under `status --pr`.
No `(added)` step is needed.
