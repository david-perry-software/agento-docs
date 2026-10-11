#!/usr/bin/env bash
# Reproduces #107 ship-conflict-gate without touching the checkout:
# feeds the values GitHub really emits for a conflicting PR
# (mergeStateStatus DIRTY, mergeable CONFLICTING) to the existing hard-gap test
# in a throwaway copy of HEAD. On the defective CLI the audit returns
# awaiting-confirm with gaps.hard == [] and the test fails (exit 1).
# Usage: AGENTO=<product checkout> bash repro.sh
set -u
AGENTO=${AGENTO:-$(git rev-parse --show-toplevel)}
T=$(mktemp -d /tmp/ship-conflict-repro-XXXX)
git -C "$AGENTO" archive HEAD | tar -x -C "$T"
sed -i 's/{ pr: { mergeStateStatus: "CONFLICTING" } }/{ pr: { mergeStateStatus: "DIRTY", mergeable: "CONFLICTING" } }/' "$T/scripts/agento.test.mjs"
(cd "$T" && node --test --test-name-pattern='every hard gap code in the in-repo layout' scripts/agento.test.mjs)
status=$?
rm -rf "$T"
echo "exit=$status"
