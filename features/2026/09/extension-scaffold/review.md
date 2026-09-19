# Review: extension-scaffold

Verdict: request-changes

## Acceptance checklist results

- **Pass** — `extension/package.json` has version `0.5.2`, publisher `david-perry-software`, engine `^1.125.0`, main `./out/extension.js`, no runtime dependencies, and exactly the five planned dev dependencies; `extension/package-lock.json` is tracked. Verified with manifest assertions and `git ls-files`.
- **Pass** — `npm ci`, `npm run build`, and `npm run typecheck` exited 0; `extension/out/extension.js` was produced.
- **Pass** — `node --test tests/extension-bundle.test.mjs` passed 4/4. In a disposable clean clone, appending one byte to `extension/cli/agento.mjs` made the suite fail 1/4, then the clone was discarded.
- **Pass** — In a disposable clean clone, changing `extension/package.json` to `0.5.3` made `node --test tests/customizations.test.mjs` fail 1/22; the assertion in `tests/customizations.test.mjs` names `.claude-plugin/plugin.json`, `package.json`, and `extension/package.json`.
- **Pass** — `cd extension && npm run test:unit` passed all 10 tests, including `CliClient` exit 0/3, malformed JSON, and spawn-failure behavior.
- **Pass** — The same unit run passed all four `RefreshScheduler` tests for coalescing, the 3000 ms clamp, immediate refresh, and disposal.
- **Fail** — `cd extension && npm run test:electron` failed twice. Both VS Code 1.125.0 launches timed out in `extension/test/electron/suite.ts` waiting for the roadmap watcher refresh; the required success summary was never printed.
- **Fail** — `cd extension && npm run package` exited 0, but `unzip -Z1 agento-dashboard-0.5.2.vsix` contained `extension/LICENSE.txt`, not the required `extension/LICENSE`. All other required entries were present and no source, tests, dependencies, source maps, or duplicate `out/src/` paths were present.
- **Pass** — `AGENTS.md`, `CHANGELOG.md`, `.gitignore`, and `extension/README.md` contain the planned command, scaffold, ignore, settings, and bundled-CLI documentation; the 22 customization tests passed as part of the root suite.
- **Pass** — `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` exited 0; the root suite passed 214/214; both guard replay modes exited 0; `git diff --quiet origin/main -- scripts .github commands hooks templates` exited 0.
- **Pass** — After `npm run build`, `npm run copy-cli`, Electron runs, and packaging, `git status --porcelain` was empty in the product half. The companion half was also clean before this review edit.

## Plan vs implementation

- The `@types/vscode` / engine fallback from 1.132 to 1.125 is documented on roadmap step 1.3 and follows the plan's stated risk mitigation.
- The implementation otherwise stays within the planned file set.
- Packaging deviates from the acceptance contract because VSCE renames the repository `LICENSE` to `extension/LICENSE.txt` in the archive. Either the package behavior or the explicit acceptance contract must be reconciled and verified.

## Roadmap audit

- Unticked step 3.1 because its verification fails reproducibly in the reviewer environment.
- Unticked step 3.2 because its claimed archive assertion is false for the generated VSIX.
- Unticked step 4.2 because the final gate is not green while required Electron and packaging acceptance checks fail.
- The remaining ticked steps are supported by the implementation, commit history, and focused or repository-wide checks. There are no manual or post-ship steps.

## Findings

- **Major — roadmap watcher behavior fails its activation test.** `extension/test/electron/suite.ts` creates a roadmap after activation and waits for `RefreshScheduler.onDidRefresh`, but two independent `npm run test:electron` runs timed out. This leaves the scaffold's user-visible file-change refresh behavior unverified and currently failing under the pinned VS Code host. Repair the watcher/test interaction and make the required command pass reliably.
- **Moderate — the packaged license path contradicts acceptance and the ticked roadmap evidence.** `npm run package` emits `extension/LICENSE.txt`; roadmap step 3.2 claimed the required license entry was found, while plan acceptance requires `extension/LICENSE`. Add a packaging assertion to automation and reconcile the expected archive path.

## Follow-ups

- None. Both findings are required delivery work, not deferred follow-ups.