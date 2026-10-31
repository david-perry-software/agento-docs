#!/usr/bin/env bash
# Output-parity harness for the cli-command-modules pure-move refactor.
#
# Extracts the base CLI (product ad9e8f3) into a temp dir, runs a fixed list of
# read-only invocations against both CLIs from the product worktree, and diffs
# stdout, stderr, and exit codes. Exit 0 = byte-identical; exit 1 = drift.
#
# Usage: evidence/parity.sh [PRODUCT_ROOT]
#   PRODUCT_ROOT defaults to the git toplevel of the current working directory,
#   so the normal invocation is:
#     cd <product-worktree> && bash <artifact-half>/features/2026/10/cli-command-modules/evidence/parity.sh
#
# Faithfulness notes (the harness is an evidence artifact, not product code):
#   * The base CLI's PLUGIN_ROOT is the temp dir, so the product's skills/,
#     .github/, and templates/ are symlinked in: `policy` and `next`/dispatch
#     read those directly from PLUGIN_ROOT.
#   * Every invocation passes `--plugin-root <PRODUCT_ROOT>` so doctor/models/
#     harness probe the real clone with both CLIs (their default PLUGIN_ROOT
#     differs between base and current).
#   * The base tree path is normalized to the checkout path.
#   * `metrics` carries a wall-clock timestamp and elapsed seconds, so
#     `generatedAt` and `"seconds"` values are normalized on both sides.

set -u

BASE_COMMIT="ad9e8f3"

PRODUCT_ROOT="${1:-}"
if [ -z "$PRODUCT_ROOT" ]; then
  PRODUCT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi
PRODUCT_ROOT="$(cd "$PRODUCT_ROOT" && pwd)"

# Invocation list: one entry per line; the line is the full argv after `node <cli>`.
# `--root <PRODUCT_ROOT> --plugin-root <PRODUCT_ROOT>` are appended by the harness.
INVOCATIONS=(
  "config"
  "find cli-command-modules"
  "status"
  "status feature"
  "session"
  "paths feature cli-command-modules"
  "ports x"
  "doctor"
  "doctor --for ship"
  "policy --list"
  "policy 9"
  "preflight new-feature"
  "next"
  "initiative"
  "metrics"
  "models list"
  "models pins"
  "harness status"
  "release"
  "unknown-cmd"
  ""
)

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git -C "$PRODUCT_ROOT" archive "$BASE_COMMIT" scripts | tar -x -C "$TMP"
ln -s "$PRODUCT_ROOT/skills" "$TMP/skills"
ln -s "$PRODUCT_ROOT/.github" "$TMP/.github"
ln -s "$PRODUCT_ROOT/templates" "$TMP/templates"

BASE_CLI="$TMP/scripts/agento.mjs"
CUR_CLI="$PRODUCT_ROOT/scripts/agento.mjs"

# Normalize the base tree path and the two wall-clock fields in `metrics`.
normalize() {
  sed -E \
    -e "s|$TMP|$PRODUCT_ROOT|g" \
    -e 's/"generatedAt": "[^"]*"/"generatedAt": "<TS>"/' \
    -e 's/"seconds": [0-9]+/"seconds": <N>/g'
}

FAILED=0
INDEX=0
for INV in "${INVOCATIONS[@]}"; do
  INDEX=$((INDEX + 1))
  BASE_OUT="$TMP/base-$INDEX.out"
  BASE_ERR="$TMP/base-$INDEX.err"
  CUR_OUT="$TMP/cur-$INDEX.out"
  CUR_ERR="$TMP/cur-$INDEX.err"

  if [ -n "$INV" ]; then
    # shellcheck disable=SC2086
    (cd "$PRODUCT_ROOT" && node "$BASE_CLI" $INV --root "$PRODUCT_ROOT" --plugin-root "$PRODUCT_ROOT") >"$BASE_OUT" 2>"$BASE_ERR"
    BASE_CODE=$?
    # shellcheck disable=SC2086
    (cd "$PRODUCT_ROOT" && node "$CUR_CLI" $INV --root "$PRODUCT_ROOT" --plugin-root "$PRODUCT_ROOT") >"$CUR_OUT" 2>"$CUR_ERR"
    CUR_CODE=$?
  else
    (cd "$PRODUCT_ROOT" && node "$BASE_CLI" --root "$PRODUCT_ROOT" --plugin-root "$PRODUCT_ROOT") >"$BASE_OUT" 2>"$BASE_ERR"
    BASE_CODE=$?
    (cd "$PRODUCT_ROOT" && node "$CUR_CLI" --root "$PRODUCT_ROOT" --plugin-root "$PRODUCT_ROOT") >"$CUR_OUT" 2>"$CUR_ERR"
    CUR_CODE=$?
  fi

  normalize <"$BASE_OUT" >"$BASE_OUT.norm"
  normalize <"$BASE_ERR" >"$BASE_ERR.norm"
  normalize <"$CUR_OUT" >"$CUR_OUT.norm"
  normalize <"$CUR_ERR" >"$CUR_ERR.norm"

  LABEL="${INV:-<no command>}"
  if [ "$BASE_CODE" != "$CUR_CODE" ]; then
    echo "MISMATCH (exit code) [$LABEL]: base=$BASE_CODE cur=$CUR_CODE"
    FAILED=1
  fi
  if ! diff -u "$BASE_OUT.norm" "$CUR_OUT.norm" >"$TMP/diff-$INDEX" 2>&1; then
    echo "MISMATCH (stdout) [$LABEL]:"
    cat "$TMP/diff-$INDEX"
    FAILED=1
  fi
  if ! diff -u "$BASE_ERR.norm" "$CUR_ERR.norm" >"$TMP/diff-err-$INDEX" 2>&1; then
    echo "MISMATCH (stderr) [$LABEL]:"
    cat "$TMP/diff-err-$INDEX"
    FAILED=1
  fi
done

if [ "$FAILED" -ne 0 ]; then
  echo "PARITY FAILED (base $BASE_COMMIT vs branch)"
  exit 1
fi

echo "PARITY OK: all ${#INVOCATIONS[@]} invocations byte-identical (stdout, stderr, exit code)"
echo "base commit: $BASE_COMMIT"
echo "branch cli:  $CUR_CLI"
