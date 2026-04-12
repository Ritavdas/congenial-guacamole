#!/usr/bin/env bash
# check-test-coverage.sh — Verify new/modified source files have tests
#
# Scoped to: src/lib/*.ts and src/app/api/**/*.ts
# Override: Add "// @no-test-required" to the top of a file to skip
#
# Exit codes:
#   0 — all files covered
#   1 — missing tests found

set -euo pipefail

BASE_REF="${1:-origin/main}"

# Get changed/added .ts files in enforced directories (exclude test files themselves)
changed_files=$(git diff --name-only --diff-filter=ACM "$BASE_REF"...HEAD -- \
  'src/lib/*.ts' \
  'src/app/api/**/*.ts' \
  | grep -v '\.test\.' \
  | grep -v '\.spec\.' \
  || true)

if [ -z "$changed_files" ]; then
  echo "✅ No enforced source files changed — skipping test coverage check."
  exit 0
fi

missing=()

for file in $changed_files; do
  # Check for @no-test-required override
  if head -5 "$file" | grep -q '@no-test-required'; then
    echo "⏭️  $file — skipped (@no-test-required)"
    continue
  fi

  # Derive expected test file path
  # src/lib/extract.ts → src/lib/extract.test.ts
  # src/app/api/extension/save/route.ts → src/app/api/extension/save/route.test.ts
  #   OR covered by src/__tests__/pipelines/*.test.ts (check both)
  test_file="${file%.ts}.test.ts"

  if [ -f "$test_file" ]; then
    echo "✅ $file → $test_file"
  else
    # Also check __tests__/pipelines/ for integration tests that cover API routes
    basename_no_ext=$(basename "${file%.ts}")
    found_in_tests=$(find src/__tests__ -name "*.test.ts" -exec grep -l "$basename_no_ext\|$(basename "$(dirname "$file")")" {} \; 2>/dev/null | head -1 || true)

    if [ -n "$found_in_tests" ]; then
      echo "✅ $file → $found_in_tests (integration test)"
    else
      echo "❌ $file — no test file found"
      missing+=("$file")
    fi
  fi
done

echo ""

if [ ${#missing[@]} -gt 0 ]; then
  echo "⚠️  ${#missing[@]} file(s) missing tests:"
  for f in "${missing[@]}"; do
    echo "   - $f"
  done
  echo ""
  echo "Options:"
  echo "  1. Add a test file: ${missing[0]%.ts}.test.ts"
  echo "  2. Add '// @no-test-required' to the top of the file to skip"
  exit 1
else
  echo "✅ All changed source files have test coverage."
  exit 0
fi
