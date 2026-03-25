#!/bin/bash

# Pre-commit compliance check hook for Standards & Compliance system.
#
# This script runs before commits to check staged HTML files against
# the compliance checks. Blocks commit if any critical violations found.
#
# SETUP INSTRUCTIONS:
# 1. Copy this script to your .git/hooks directory:
#    cp scripts/pre-commit-check.sh .git/hooks/pre-commit
#
# 2. Make it executable:
#    chmod +x .git/hooks/pre-commit
#
# 3. Ensure the Command Center backend is running on http://localhost:8000
#
# ENVIRONMENT:
# - CC_BACKEND_URL: Backend URL (default: http://localhost:8000)
# - SKIP_CC_CHECK: Set to 1 to skip this hook (for emergency commits)
#
# The hook will:
# 1. Find all staged .html files
# 2. Call the API for each file
# 3. Show violations summary
# 4. Block commit if any critical violations (exit code 1)
# 5. Allow commit if all pass (exit code 0)

set -euo pipefail

# Configuration
CC_BACKEND_URL="${CC_BACKEND_URL:-http://localhost:8000}"
SKIP_CHECKS="${SKIP_CC_CHECK:-0}"

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Allow skipping checks with SKIP_CC_CHECK=1
if [ "$SKIP_CHECKS" = "1" ]; then
    echo -e "${YELLOW}⚠️  Skipping compliance checks (SKIP_CC_CHECK=1)${NC}"
    exit 0
fi

# Check if backend is running
if ! curl -s "$CC_BACKEND_URL/docs" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Command Center backend not running at $CC_BACKEND_URL${NC}"
    echo "    Skipping compliance checks. Start the backend with: python -m uvicorn main:app --reload"
    exit 0
fi

# Find staged HTML files (relative to git root)
GIT_ROOT=$(git rev-parse --show-toplevel)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.html$' || true)

if [ -z "$STAGED_FILES" ]; then
    echo "No HTML files to check."
    exit 0
fi

echo "Checking staged HTML files for compliance violations..."

OVERALL_PASS=true
FAILED_FILES=()

# Check each file
while IFS= read -r file; do
    # Get relative path from git root
    REL_PATH="${file#./}"

    # Call the compliance check API
    RESPONSE=$(curl -s -X POST "$CC_BACKEND_URL/api/standards/check" \
        -H "Content-Type: application/json" \
        -d "{\"file_path\": \"$REL_PATH\"}" || echo "{\"pass_check\": false, \"error\": \"API request failed\"}")

    # Check if response indicates a pass
    PASS=$(echo "$RESPONSE" | grep -o '"pass_check":true' || echo "")

    if [ -z "$PASS" ]; then
        OVERALL_PASS=false
        FAILED_FILES+=("$REL_PATH")

        # Extract violation summary from response
        CRITICAL_COUNT=$(echo "$RESPONSE" | grep -o '"has_critical":true' || echo "")

        if [ -n "$CRITICAL_COUNT" ]; then
            echo -e "${RED}✗ $REL_PATH${NC} — CRITICAL violations found"
        else
            echo -e "${YELLOW}⚠ $REL_PATH${NC} — violations found (non-critical)"
        fi
    else
        echo -e "${GREEN}✓ $REL_PATH${NC}"
    fi
done <<< "$STAGED_FILES"

echo ""

# Summary
if [ "$OVERALL_PASS" = true ]; then
    echo -e "${GREEN}All files pass compliance checks. Commit allowed.${NC}"
    exit 0
else
    echo -e "${RED}❌ Compliance check FAILED${NC}"
    echo ""
    echo "Failed files:"
    for file in "${FAILED_FILES[@]}"; do
        echo "  - $file"
    done
    echo ""
    echo "To see details, run:"
    echo "  curl -X POST http://localhost:8000/api/standards/check -H 'Content-Type: application/json' -d '{\"file_path\": \"<file>\"}'"
    echo ""
    echo "To skip this check (emergency only): SKIP_CC_CHECK=1 git commit ..."
    echo ""
    exit 1
fi
