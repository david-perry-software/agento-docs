# Review: extension-scaffold

Verdict: approve

## Acceptance checklist results

- **Pass** — Manifest assertions confirmed version `0.5.2`, publisher `david-perry-software`, engine `^1.125.0`, main `./out/extension.js`, no runtime dependencies, exactly the five planned dev dependencies, both commands, and the 3000 ms configuration minimum. `git ls-files extension/package-lock.json` confirmed the lockfile is tracked.
- **Pass** — `cd extension && npm ci && npm run build && npm run typecheck` exited 0 and produced `out/extension.js`.
- **Pass** — The root suite passed the four bundle tests. In an isolated `git archive` copy, appending one byte to `extension/cli/agento.mjs` made `node --test tests/extension-bundle.test.mjs` fail 1/4 with `extension/cli/agento.mjs differs from scripts/agento.mjs`.
- **Pass** — In a separate isolated archive, changing `extension/package.json` to `0.5.3` made `node --test tests/customizations.test.mjs` fail 1/22 with an assertion naming `.claude-plugin/plugin.json`, `package.json`, and `extension/package.json`.
- **Pass** — `cd extension && npm run test:unit` passed 10/10, including `CliClient` exit 0/3 JSON behavior, malformed output, and missing-node diagnostics.
- **Pass** — The same unit run passed all four scheduler checks: coalesced reasons, the 3000 ms clamp, immediate refresh cancellation, and no emission after disposal.
- **Pass** — Four consecutive `cd extension && npm run test:electron` runs launched and validated VS Code 1.125.0, printed `Extension activation test passed: active, commands, CLI session, watcher refresh`, and exited 0. `extension/test/electron/suite.ts` only resolves that watcher check after observing the exact absolute roadmap path with a `create` or `change` reason.
- **Pass** — `cd extension && npm run package` exited 0 and its automated archive assertion found all 13 required extension entries, byte-identical `extension/LICENSE.txt`, and clean exclusions. An independent `unzip -Z1` inspection found 15 total archive entries, no `src/`, `test/`, `node_modules/`, `out/src/`, or source maps; `cmp` confirmed generated `extension/LICENSE` equals the root `LICENSE` and archived `extension/LICENSE.txt` equals generated `extension/LICENSE`.
- **Pass** — Direct manifest, grep, and ignore checks confirmed the extension layout and five commands in `AGENTS.md`, the Unreleased changelog entry, both settings and the bundled `PLUGIN_ROOT` note in `extension/README.md`, and all three generated paths ignored by `.gitignore`.
- **Pass** — `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` exited 0; the root suite passed 214/214 in the product worktree; both replay-guard modes exited 0; and `git diff --quiet origin/main -- scripts .github commands hooks templates` exited 0.
- **Pass** — After builds, four Electron runs, copy, and packaging, the product worktree remained clean. A detached checkout with no `extension/node_modules` or `extension/out` also passed the root suite 214/214, and the companion was clean and synchronized before this review edit.

## Plan vs implementation

- The `@types/vscode` / engine fallback from 1.132 to 1.125 is documented on roadmap step 1.3 and follows the plan's stated risk mitigation.
- VSCE canonicalizes the extensionless source license to `extension/LICENSE.txt`. The plan, roadmap, and automated package assertion now consistently require that archive path and verify its bytes, resolving the round-one contract mismatch.
- The product diff is confined to `.gitignore`, `AGENTS.md`, `CHANGELOG.md`, `extension/`, and `tests/`; the protected `scripts`, `.github`, `commands`, `hooks`, and `templates` areas have no diff. No undocumented implementation scope was found.
- Skills consulted: none — no matching domain, consistent with the plan's recorded skills research.

## Roadmap audit

- **1.1 pass** — manifest, contribution, ignore, README, TypeScript, and media files exist and focused invariants passed.
- **1.2 pass** — copy script regenerated exactly four CLI files plus `LICENSE`; byte guards passed and the worktree stayed clean.
- **1.3 pass** — lockfile install, build, output-file check, and typecheck passed with the documented 1.125 fallback.
- **1.4 pass** — bundle and version guards passed normally and failed under both isolated negative probes with the expected messages.
- **1.5 pass** — phase-one artifacts remain represented in the current green, synchronized branch; both defaults are ancestors.
- **2.1 pass** — all `CliClient` unit and integration behaviors passed.
- **2.2 pass** — all scheduler timing and disposal behaviors passed.
- **2.3 pass** — real repository/worktree git-dir resolution passed; watcher implementation and typecheck passed.
- **2.4 pass** — activation wiring, command contributions, build, and typecheck passed; the host test exercised the exported API.
- **2.5 pass** — phase-two artifacts remain represented in the current green, synchronized branch; both defaults are ancestors.
- **3.1 pass** — four consecutive pinned-host activation runs passed and each required the expected roadmap watcher event reason.
- **3.2 pass** — package command, automated archive assertion, independent archive listing, license byte checks, and exclusion checks passed.
- **3.3 pass** — phase-three artifacts remain represented in the current green, synchronized branch; both defaults are ancestors.
- **4.1 pass** — direct documentation checks passed and the root suite includes 22/22 customization tests.
- **4.2 pass** — shellcheck, root 214/214, clean-checkout 214/214, both guards, extension typecheck/unit tests, repeated Electron tests, packaging, diff scope, and synchronization all passed.
- **5.1 pass** — the workspace-glob watcher remediation passed four consecutive VS Code 1.125.0 runs with the exact expected path reason.
- **5.2 pass** — the package assertion codifies VSCE's canonical license path, verifies byte identity, and rejects the planned exclusions.
- All 17 ticks are truthful. No roadmap repairs, missing-work steps, manual steps, or post-ship exceptions were found.

## Findings

- None. The two round-one findings are remediated and independently verified.

## Follow-ups

- None.