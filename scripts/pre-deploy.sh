#!/bin/bash
set -e

echo "========================================"
echo "  Pre-Deployment Checks"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    exit 1
}

# 1. Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 18 ]; then
    check_pass "Node.js v$(node -v | cut -d'v' -f2)"
else
    check_fail "Node.js 18+ required (found $(node -v))"
fi

# 2. CLI Build
echo ""
echo "Building CLI..."
npm run build
if [ -f "dist/cli/index.js" ]; then
    check_pass "CLI build successful"
else
    check_fail "CLI build failed - dist/cli/index.js not found"
fi

# 3. TypeScript type check
echo ""
echo "Running TypeScript type check..."
npx tsc --noEmit
check_pass "TypeScript types valid"

# 4. CLI smoke test
echo ""
echo "Running CLI smoke tests..."
node dist/cli/index.js --version > /dev/null 2>&1 && check_pass "acc --version works" || check_fail "acc --version failed"
node dist/cli/index.js --help > /dev/null 2>&1 && check_pass "acc --help works" || check_fail "acc --help failed"

# 5. Webapp build (optional)
echo ""
echo "Building webapp..."
if [ -d "webapp" ]; then
    cd webapp
    npm run build
    check_pass "Webapp build successful"
    cd ..
else
    echo "Skipping webapp build (directory not found)"
fi

echo ""
echo "========================================"
echo -e "${GREEN}All pre-deployment checks passed!${NC}"
echo "========================================"
