#!/bin/bash
# Production API Validation Tests for voygent.app
# Tests all 5 themes and validates responses

set -e

BASE_URL="https://voygent.app"
TIMESTAMP=$(date +%s)
USER_ID="prod-test-${TIMESTAMP}"

echo "=================================="
echo "VoyGent Production API Tests"
echo "Base URL: $BASE_URL"
echo "Test User: $USER_ID"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to test API endpoint
test_api() {
  local test_name="$1"
  local method="$2"
  local endpoint="$3"
  local data="$4"
  local expected_field="$5"

  TESTS_RUN=$((TESTS_RUN + 1))
  echo -n "Test $TESTS_RUN: $test_name ... "

  if [ "$method" = "GET" ]; then
    response=$(curl -s "$BASE_URL$endpoint")
  else
    response=$(curl -s -X "$method" "$BASE_URL$endpoint" $data)
  fi

  if echo "$response" | grep -q "$expected_field"; then
    echo -e "${GREEN}✓ PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    echo -e "${RED}✗ FAIL${NC}"
    echo "  Response: $response"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

# Test 1: List templates
echo "=== Template Tests ==="
test_api "List templates" "GET" "/api/templates" "" '"id":"heritage"'

# Test 2-6: Create trip for each theme
echo ""
echo "=== Theme Integration Tests ==="

# Heritage theme
test_api "Heritage theme trip" "POST" "/api/trips" \
  '-d "theme=heritage" -d "text=Williams family from Scotland" -d "userId='$USER_ID'"' \
  '"theme":"heritage"'

# TV/Movie theme
test_api "TV/Movie theme trip" "POST" "/api/trips" \
  '-d "theme=tvmovie" -d "text=Game of Thrones filming locations" -d "userId='$USER_ID'"' \
  '"theme":"tvmovie"'

# Historical theme
test_api "Historical theme trip" "POST" "/api/trips" \
  '-d "theme=historical" -d "text=D-Day Normandy sites in France" -d "userId='$USER_ID'"' \
  '"theme":"historical"'

# Culinary theme
test_api "Culinary theme trip" "POST" "/api/trips" \
  '-d "theme=culinary" -d "text=Italian cuisine in Tuscany" -d "userId='$USER_ID'"' \
  '"theme":"culinary"'

# Adventure theme
test_api "Adventure theme trip" "POST" "/api/trips" \
  '-d "theme=adventure" -d "text=Patagonia hiking and trekking" -d "userId='$USER_ID'"' \
  '"theme":"adventure"'

# Test 7: List trips for user
echo ""
echo "=== Trip Listing Tests ==="
test_api "List user trips" "GET" "/api/trips?userId=$USER_ID" "" '"trips"'

# Test 8: Auto-detect theme (heritage)
echo ""
echo "=== Theme Auto-Detection Tests ==="
test_api "Auto-detect heritage" "POST" "/api/trips" \
  '-d "text=McLeod surname Isle of Skye ancestry genealogy" -d "userId='$USER_ID'"' \
  '"theme":"heritage"'

test_api "Auto-detect culinary" "POST" "/api/trips" \
  '-d "text=French cooking classes in Paris and Lyon" -d "userId='$USER_ID'"' \
  '"theme":"culinary"'

# Summary
echo ""
echo "=================================="
echo "Test Summary"
echo "=================================="
echo -e "Total Tests:  $TESTS_RUN"
echo -e "${GREEN}Passed:       $TESTS_PASSED${NC}"
echo -e "${RED}Failed:       $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
