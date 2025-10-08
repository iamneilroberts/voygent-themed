#!/bin/bash
# Run integration tests for Feature 011
# Phase 12

set -e

echo "=== Feature 011 Integration Tests ==="
echo "Date: $(date)"
echo ""

# Check if local server is running
echo "Checking if development server is running on localhost:8788..."
if ! curl -s http://localhost:8788 > /dev/null 2>&1; then
  echo "❌ Error: Development server not running"
  echo "Please start the server with: npm run dev"
  exit 1
fi

echo "✓ Server is running"
echo ""

# Run integration tests
echo "Running integration tests..."
echo ""

npx vitest run tests/integration/template-driven-workflow.test.ts

echo ""
echo "=== Test Summary ==="
echo "View detailed results above"
echo ""

# Check for test database
echo "Verifying test database..."
npx wrangler d1 execute voygent-test --remote --command="SELECT COUNT(*) as trip_count FROM themed_trips;" 2>&1 | grep -A5 "trip_count"

echo ""
echo "✓ Integration tests complete"
echo ""
echo "Next steps:"
echo "1. Review test results"
echo "2. Check diagnostic logs"
echo "3. Verify handoff documents created"
echo "4. Run: ./scripts/monitor-ab-usage.sh to check A/B deprecation"
