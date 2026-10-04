#!/usr/bin/env bash
# Reproduction for ship-untracked-byproducts: an owner worktree dirty only with
# untracked byproducts (one inside an untracked directory, one at the top level).
# Usage: CLI=<product checkout>/scripts/agento.mjs bash repro.sh
set -u
: "${CLI:?set CLI to the agento.mjs under test}"
tmp=$(mktemp -d /tmp/agento-repro-XXXX)
trap 'rm -rf "$tmp"' EXIT
redact() { sed "s#$tmp#<tmp>#g"; }

git init -q --bare "$tmp/origin.git"
git init -q -b trunk "$tmp/product"
cd "$tmp/product" || exit 1
git config user.email repro@example.test
git config user.name repro
mkdir -p .github features/2026/10/widget
printf '{"branches":{"default":"trunk"},"worktrees":{"dir":"../product-worktrees"}}\n' > .github/agento.json
printf 'status: in-review\nbranch: feature/widget\nnext-step: review\n' > features/2026/10/widget/roadmap.md
git add -A && git commit -q -m init
git remote add origin "$tmp/origin.git"
git push -q -u origin trunk
owner="$tmp/product-worktrees/feature-widget"
git worktree add -q -b feature/widget "$owner"
git -C "$owner" push -q -u origin feature/widget
mkdir -p "$owner/features/2026/09/other-slug/evidence"
printf 'png' > "$owner/features/2026/09/other-slug/evidence/step-1-1-x.png"
printf 'png' > "$owner/evidence"

{
  echo '$ git -C <owner> status --porcelain --untracked-files=all'
  git -C "$owner" status --porcelain --untracked-files=all
  echo '$ git -C <owner> status --porcelain --untracked-files=no'
  git -C "$owner" status --porcelain --untracked-files=no
  echo '$ git -C <owner> rev-list --count @{upstream}..HEAD'
  git -C "$owner" rev-list --count '@{upstream}..HEAD'
  echo '$ git -C <owner> clean -n            # no -d: misses files inside untracked directories'
  git -C "$owner" clean -n
  echo '$ git -C <owner> clean -n -d'
  git -C "$owner" clean -n -d
  echo '$ agento.mjs ship-preflight feature widget'
  node "$CLI" ship-preflight feature widget
  echo "exit=$?"
} 2>&1 | redact
