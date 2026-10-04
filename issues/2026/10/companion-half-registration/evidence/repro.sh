#!/usr/bin/env bash
# Reproduction for issue companion-half-registration.
# Builds a throwaway product + companion pair, then adds the companion half from the
# *product* clone (the dropped-`cd` failure) and shows what `paths` and `session` report.
# Usage: CLI=<agento-root>/scripts/agento.mjs bash repro.sh
set -u
CLI=${CLI:?set CLI to scripts/agento.mjs}
base=$(mktemp -d /tmp/agento-chr-XXXX)
for r in proj proj-docs; do
  git init -q --bare "$base/$r.git"
  git init -q -b main "$base/$r"
  git -C "$base/$r" commit -q --allow-empty -m init
  git -C "$base/$r" remote add origin "$base/$r.git"
  git -C "$base/$r" push -q -u origin main
done
mkdir -p "$base/proj/.github" "$base/wt" "$base/proj-docs-worktrees"
printf '{"worktrees":{"dir":"../wt"},"artifacts":{"repo":{"name":"proj-docs"}}}\n' > "$base/proj/.github/agento.json"
git -C "$base/proj" add -A
git -C "$base/proj" commit -q -m config
git -C "$base/proj" push -q
git -C "$base/proj" worktree add -q --detach "$base/wt/plan-20261004-1" origin/main
# The dropped `cd`: the companion half is added from the product clone.
git -C "$base/proj" worktree add -q --detach "$base/proj-docs-worktrees/plan-20261004-1" origin/main

pick() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const o={};for(const k of process.argv.slice(1))o[k]=j[k];console.log(JSON.stringify(o,null,2))})' "$@"; }

echo "base: $base"
echo "--- companion half origin (expected $base/proj-docs.git)"
git -C "$base/proj-docs-worktrees/plan-20261004-1" remote get-url origin
echo "--- companion clone worktree list"
git -C "$base/proj-docs" worktree list --porcelain
echo "--- product clone worktree list"
git -C "$base/proj" worktree list --porcelain
echo "--- paths plan 20261004-1 (from the primary): companion block"
(cd "$base/proj" && node "$CLI" paths plan 20261004-1 | pick companion)
echo "--- session (from the product half): companion, worktrees, warnings"
(cd "$base/wt/plan-20261004-1" && node "$CLI" session | pick companion worktrees warnings)
