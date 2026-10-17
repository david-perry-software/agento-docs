```yaml
status: planned
branch: feature/harness-install
last-updated: 2026-10-17
next-step: "1.1"
initiative: "copilot-harness"
artifact-pr: "#56"
```

# Roadmap: harness-install

## Phase 1: CLI and tests

- [ ] 1.1 Add `AGENTO_COPILOT_SKILLS_DIR` (a fresh temp dir) to `baseEnv` in `scripts/agento.test.mjs`, then add the failing tests from plan.md `## Approach` "Tests": `harness status` for all five states, `install` (create, idempotent, foreign/dangling refused then `--force`, real directory refused even with `--force` and intact, linked worktree refused naming the primary, root without `skills/agento/SKILL.md` → `missing`), `uninstall` (only an `installed` link removed; others refused and untouched; absent no-op), usage errors (unknown verb, `--force` on `status`/`uninstall`), and `linkType` — verify: `node --test scripts/agento.test.mjs` fails only on the new `harness` tests; every pre-existing test still passes
- [ ] 1.2 Implement in `scripts/agento.mjs`: the skills-dir resolver (`AGENTO_COPILOT_SKILLS_DIR`, else `~/.copilot/skills`), the expected target (`primaryCheckoutOf(root) ?? root` + `skills/agento`), the pure link-state function (`absent`/`installed`/`foreign`/`dangling`/`not-a-link`), the exported `linkType(platform)`, `--force` in `parseArgs`, `case "harness"` with `status|install|uninstall` and the documents/exit codes from plan.md (including `localTakeover`), and the usage-header line for `harness` — verify: `node --test scripts/agento.test.mjs` passes every `harness` test
- [ ] 1.3 Add the doctor `harness` check: update the "doctor reports nine checks" test to ten ids ending in `harness`, add a `harness`-check test (`ok` without a router at the root and when installed with the Local-takeover detail; `warn` with the right fallback for absent, foreign, dangling, not-a-link; absent from `doctor --for new-feature` and `preflight new-feature` checks), then add the check to `DOCTOR_CHECKS` after `hook-wiring` and to `LOCAL_DOCTOR_CHECKS`, not to `CAPABILITY_CHECKS` — verify: `node --test scripts/agento.test.mjs` exits 0
- [ ] 1.4 Bundle the CLI: `cd extension && npm run copy-cli` — verify: `node --test tests/extension-bundle.test.mjs` exits 0 and `cd extension && npm run test:unit` exits 0 (the Session & Doctor model parses the new check with no source change)
- [ ] 1.5 Docs: in `docs/copilot-harness.md` "Router skill", replace the by-hand `ln -s` with `node <clone>/scripts/agento.mjs harness install` (naming `status`, `uninstall`, `--plugin-root`, `--force`, and the Local takeover); add `harness` to AGENTS.md's `scripts/` subcommand list — verify: `node --test tests/harness-probe/probe.test.mjs tests/customizations.test.mjs` exits 0 and `grep -n "ln -s" docs/copilot-harness.md` no longer shows the router link as the install method

## Phase 2: Live verification

- [ ] 2.1 Pick the live plugin root: the clone the user's VS Code loads Agento from (`chat.pluginLocations` in user settings; expected `/home/david/DP/agento-plugin` or `/home/david/DP/agento`) — record it on this line; confirm it is a primary clone containing `skills/agento/SKILL.md` (this branch's CLI is always run from this worktree with `--plugin-root <root>`); if the loaded clone lacks the router, pause `blocked: <clone> needs a pull of main` — verify: `test -f <root>/skills/agento/SKILL.md` exits 0
- [ ] 2.2 Live CLI check against the real `~/.copilot/skills`: from this worktree run `node scripts/agento.mjs harness status --plugin-root <root>` (expect `absent`, or report the existing state), `harness install` with no `--plugin-root` (expect `status: worktree` naming the primary clone, nothing written), then `harness install --plugin-root <root>`, `harness status --plugin-root <root>`, and `doctor --plugin-root <root>` — verify: `install` reports `changed: true`, `status` reports `installed`, `readlink -f ~/.copilot/skills/agento` prints `<root>/skills/agento`, doctor's `harness` check is `ok`; outputs recorded on this line
- [ ] 2.3 (manual) In the primary window, reload the window, open a new chat with Session Target **Copilot** and send `/agento delivery-status`; then open a new chat with Session Target **Local** and send `/agento delivery-status`; screenshot each reply; then say whether to keep the link installed — verify: `evidence/step-2-3-copilot-delivery-status.png` shows "Read skill · agento" and the delivery-status receipt and result line; `evidence/step-2-3-local-delivery-status.png` shows the delivery-status receipt; the user's keep/remove choice is recorded on this line
- [ ] 2.4 Apply the user's choice: keep the link, or run `node scripts/agento.mjs harness uninstall --plugin-root <root>` — verify: `harness status --plugin-root <root>` reports `installed` (kept) or `absent` (removed), matching 2.3's recorded choice

## Phase 3: Gates

- [ ] 3.1 Run the full gates: `node --test 'scripts/**/*.test.mjs' 'tests/**/*.test.mjs'` (with `ls -la ~/.copilot/skills` captured before and after to prove the suite never touches it), the five guard replays listed in AGENTS.md, `cd extension && npm run test:unit`, and `shellcheck scripts/hooks/*.sh scripts/wait-for-checks.sh` when installed (else record `not installed` and rely on 3.2) — verify: all exit 0; the `~/.copilot/skills` listing is identical; pass counts and shellcheck result recorded on this line, compared against the plan's baseline
- [ ] 3.2 Integrate `origin/main`, push, and wait for CI — verify: `scripts/wait-for-checks.sh pr <n>` reports the `ci` run green (unit tests, Shellcheck with zero findings matching the `main` `1d6139d` baseline, guard replays)
- [ ] 3.3 Clean handoff — verify: `git status --porcelain --untracked-files=all` is empty in both halves and `harness status --plugin-root <root>` matches the choice recorded in 2.3
