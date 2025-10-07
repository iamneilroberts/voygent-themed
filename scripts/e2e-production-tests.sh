#!/bin/bash
#
# E2E Production Tests for VoyGent
# Tests the live production deployment at https://voygent.app
#
# Usage:
#   ./scripts/e2e-production-tests.sh              # Run full test suite
#   ./scripts/e2e-production-tests.sh --theme heritage   # Run specific theme
#   ./scripts/e2e-production-tests.sh --skip-cleanup    # Skip cleanup (for debugging)
#
# Requirements:
#   - curl (HTTP client)
#   - jq (JSON parser)
#   - wrangler (Cloudflare CLI, for database verification)
#
# Notes:
#   - Tests run against production and incur real AI costs (~$0.05-0.10 per run)
#   - Test data is automatically cleaned up unless --skip-cleanup is specified
#   - Results are saved to reports/e2e-test-report-{timestamp}.json
#

set -e  # Exit on error
set -o pipefail  # Pipe failures propagate

# Configuration
BASE_URL="https://voygent.app"
RUN_ID="e2e-run-$(date +%s)"
REPORT_FILE="reports/e2e-test-report-$(date +%s).json"
SKIP_CLEANUP=false

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_DURATION=0
TOTAL_COST=0

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Arrays to track test data
declare -a TEST_USER_IDS
declare -a TEST_TRIP_IDS
declare -a TEST_RESULTS

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --theme)
      SPECIFIC_THEME="$2"
      shift 2
      ;;
    --skip-cleanup)
      SKIP_CLEANUP=true
      shift
      ;;
    --help)
      echo "Usage: $0 [--theme THEME] [--skip-cleanup] [--help]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Source helper scripts
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/test-helpers/api-calls.sh"

# Print test header
echo "=================================="
echo "VoyGent Production E2E Tests"
echo "Base URL: $BASE_URL"
echo "Run ID: $RUN_ID"
echo "=================================="
echo ""

# Helper function to run a test
run_test() {
  local test_name="$1"
  local test_function="$2"

  TESTS_RUN=$((TESTS_RUN + 1))
  echo -n "Test $TESTS_RUN: $test_name ... "

  local start_time=$(date +%s%N)

  if $test_function; then
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 )) # milliseconds
    TOTAL_DURATION=$((TOTAL_DURATION + duration))

    echo -e "${GREEN}✓ PASS${NC} (${duration}ms)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 ))

    echo -e "${RED}✗ FAIL${NC} (${duration}ms)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

# T014: Generate test report
generate_test_report() {
  local timestamp=$(date +%s)
  local report_file="reports/e2e-test-report-${timestamp}.json"

  # Calculate cleanup status
  local cleanup_success=false
  local remaining_records=0
  if [ "$SKIP_CLEANUP" != true ]; then
    remaining_records=$(verify_cleanup "e2e-test-%")
    if [ "$remaining_records" -eq 0 ]; then
      cleanup_success=true
    fi
  fi

  # Calculate average cost
  local avg_cost=0
  if [ $TESTS_RUN -gt 0 ]; then
    avg_cost=$(echo "scale=6; $TOTAL_COST / $TESTS_RUN" | bc)
  fi

  # Generate JSON report
  cat > "$report_file" <<EOF
{
  "runId": "$RUN_ID",
  "timestamp": $timestamp,
  "environment": {
    "targetUrl": "$BASE_URL",
    "testerHost": "$(hostname)",
    "gitCommit": "$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
  },
  "summary": {
    "total": $TESTS_RUN,
    "passed": $TESTS_PASSED,
    "failed": $TESTS_FAILED,
    "skipped": 0,
    "duration": $TOTAL_DURATION,
    "totalCost": $TOTAL_COST
  },
  "performance": {
    "avgResponseTime": $(echo "scale=2; $TOTAL_DURATION / $TESTS_RUN" | bc || echo 0),
    "totalDuration": $TOTAL_DURATION
  },
  "costs": {
    "totalCost": $TOTAL_COST,
    "avgCostPerTrip": $avg_cost
  },
  "cleanup": {
    "cleanupSuccess": $cleanup_success,
    "remainingRecords": $remaining_records,
    "testUserIds": $(printf '%s\n' "${TEST_USER_IDS[@]}" | jq -R . | jq -s .),
    "testTripIds": $(printf '%s\n' "${TEST_TRIP_IDS[@]}" | jq -R . | jq -s .)
  }
}
EOF

  echo ""
  echo "Test report saved to: $report_file"
}

# Cleanup function (runs on exit)
cleanup_and_exit() {
  local exit_code=$?

  if [ "$SKIP_CLEANUP" = true ]; then
    echo ""
    echo -e "${YELLOW}⚠ Cleanup skipped (--skip-cleanup flag)${NC}"
    echo "To cleanup manually, run: ./scripts/test-helpers/cleanup-data.sh"
  else
    echo ""
    echo "Running cleanup..."
    source "$SCRIPT_DIR/test-helpers/cleanup-data.sh"
    cleanup_test_data "e2e-test-%"
  fi

  # Generate test report
  generate_test_report

  # Print summary
  echo ""
  echo "=================================="
  echo "Test Summary"
  echo "=================================="
  echo -e "Total Tests:  $TESTS_RUN"
  echo -e "${GREEN}Passed:       $TESTS_PASSED${NC}"
  echo -e "${RED}Failed:       $TESTS_FAILED${NC}"
  echo -e "Duration:     ${TOTAL_DURATION}ms"
  echo -e "Total Cost:   \$$(printf "%.4f" $TOTAL_COST)"
  echo ""

  if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
  else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
  fi
}

# Set trap to run cleanup on exit
trap cleanup_and_exit EXIT

# =======================
# Test Functions
# =======================

# T005: Test template listing
test_template_listing() {
  local response=$(api_get "/api/templates")

  if ! check_response_valid "$response"; then
    return 1
  fi

  if ! validate_response_fields "$response" ".templates"; then
    return 1
  fi

  local template_count=$(echo "$response" | jq '.templates | length')
  if [ "$template_count" -lt 1 ]; then
    echo "Expected at least 1 template, got $template_count" >&2
    return 1
  fi

  return 0
}

# T006: Test heritage theme
test_heritage_theme() {
  local user_id="e2e-test-$(date +%s)-heritage"
  local fixture=$(cat "$SCRIPT_DIR/test-fixtures/heritage-input.txt")

  TEST_USER_IDS+=("$user_id")

  local response=$(curl -s --max-time 60 -X POST "${BASE_URL}/api/trips" \
    -d "theme=heritage" \
    -d "text=$fixture" \
    -d "userId=$user_id")

  if ! check_response_valid "$response"; then
    return 1
  fi

  if ! validate_response_fields "$response" ".tripId" ".intake" ".options" ".diagnostics"; then
    return 1
  fi

  local theme=$(json_extract "$response" ".intake.theme")
  if [ "$theme" != "heritage" ]; then
    echo "Expected theme=heritage, got $theme" >&2
    return 1
  fi

  local options_count=$(echo "$response" | jq '.options | length')
  if [ "$options_count" -lt 2 ] || [ "$options_count" -gt 4 ]; then
    echo "Expected 2-4 options, got $options_count" >&2
    return 1
  fi

  local cost=$(extract_cost "$response")
  TOTAL_COST=$(echo "$TOTAL_COST + $cost" | bc)

  local trip_id=$(json_extract "$response" ".tripId")
  TEST_TRIP_IDS+=("$trip_id")

  return 0
}

# T007: Test TV/movie theme
test_tvmovie_theme() {
  local user_id="e2e-test-$(date +%s)-tvmovie"
  local fixture=$(cat "$SCRIPT_DIR/test-fixtures/tvmovie-input.txt")

  TEST_USER_IDS+=("$user_id")

  local response=$(curl -s --max-time 60 -X POST "${BASE_URL}/api/trips" \
    -d "theme=tvmovie" \
    -d "text=$fixture" \
    -d "userId=$user_id")

  if ! check_response_valid "$response"; then
    return 1
  fi

  if ! validate_response_fields "$response" ".tripId" ".intake" ".options"; then
    return 1
  fi

  local theme=$(json_extract "$response" ".intake.theme")
  if [ "$theme" != "tvmovie" ]; then
    echo "Expected theme=tvmovie, got $theme" >&2
    return 1
  fi

  local cost=$(extract_cost "$response")
  TOTAL_COST=$(echo "$TOTAL_COST + $cost" | bc)

  local trip_id=$(json_extract "$response" ".tripId")
  TEST_TRIP_IDS+=("$trip_id")

  return 0
}

# T008: Test historical theme
test_historical_theme() {
  local user_id="e2e-test-$(date +%s)-historical"
  local fixture=$(cat "$SCRIPT_DIR/test-fixtures/historical-input.txt")

  TEST_USER_IDS+=("$user_id")

  local response=$(curl -s --max-time 60 -X POST "${BASE_URL}/api/trips" \
    -d "theme=historical" \
    -d "text=$fixture" \
    -d "userId=$user_id")

  if ! check_response_valid "$response"; then
    return 1
  fi

  if ! validate_response_fields "$response" ".tripId" ".intake" ".options"; then
    return 1
  fi

  local theme=$(json_extract "$response" ".intake.theme")
  if [ "$theme" != "historical" ]; then
    echo "Expected theme=historical, got $theme" >&2
    return 1
  fi

  local cost=$(extract_cost "$response")
  TOTAL_COST=$(echo "$TOTAL_COST + $cost" | bc)

  local trip_id=$(json_extract "$response" ".tripId")
  TEST_TRIP_IDS+=("$trip_id")

  return 0
}

# T009: Test culinary theme
test_culinary_theme() {
  local user_id="e2e-test-$(date +%s)-culinary"
  local fixture=$(cat "$SCRIPT_DIR/test-fixtures/culinary-input.txt")

  TEST_USER_IDS+=("$user_id")

  local response=$(curl -s --max-time 60 -X POST "${BASE_URL}/api/trips" \
    -d "theme=culinary" \
    -d "text=$fixture" \
    -d "userId=$user_id")

  if ! check_response_valid "$response"; then
    return 1
  fi

  if ! validate_response_fields "$response" ".tripId" ".intake" ".options"; then
    return 1
  fi

  local theme=$(json_extract "$response" ".intake.theme")
  if [ "$theme" != "culinary" ]; then
    echo "Expected theme=culinary, got $theme" >&2
    return 1
  fi

  local cost=$(extract_cost "$response")
  TOTAL_COST=$(echo "$TOTAL_COST + $cost" | bc)

  local trip_id=$(json_extract "$response" ".tripId")
  TEST_TRIP_IDS+=("$trip_id")

  return 0
}

# T010: Test adventure theme
test_adventure_theme() {
  local user_id="e2e-test-$(date +%s)-adventure"
  local fixture=$(cat "$SCRIPT_DIR/test-fixtures/adventure-input.txt")

  TEST_USER_IDS+=("$user_id")

  local response=$(curl -s --max-time 60 -X POST "${BASE_URL}/api/trips" \
    -d "theme=adventure" \
    -d "text=$fixture" \
    -d "userId=$user_id")

  if ! check_response_valid "$response"; then
    return 1
  fi

  if ! validate_response_fields "$response" ".tripId" ".intake" ".options"; then
    return 1
  fi

  local theme=$(json_extract "$response" ".intake.theme")
  if [ "$theme" != "adventure" ]; then
    echo "Expected theme=adventure, got $theme" >&2
    return 1
  fi

  local cost=$(extract_cost "$response")
  TOTAL_COST=$(echo "$TOTAL_COST + $cost" | bc)

  local trip_id=$(json_extract "$response" ".tripId")
  TEST_TRIP_IDS+=("$trip_id")

  return 0
}

# T011: Test database persistence verification
test_database_persistence() {
  # Use first trip ID from the test run
  if [ ${#TEST_TRIP_IDS[@]} -eq 0 ]; then
    echo "No trip IDs available to verify" >&2
    return 1
  fi

  local trip_id="${TEST_TRIP_IDS[0]}"

  # Query production database
  local db_result=$(npx wrangler d1 execute voygent-themed \
    --command "SELECT id, status, intake_json, options_json, diagnostics FROM themed_trips WHERE id = '$trip_id'" \
    --remote --json 2>/dev/null)

  if [ -z "$db_result" ]; then
    echo "Failed to query database" >&2
    return 1
  fi

  # Check if record exists
  local record_count=$(echo "$db_result" | jq '.[0].results | length')
  if [ "$record_count" -ne 1 ]; then
    echo "Expected 1 record, got $record_count" >&2
    return 1
  fi

  # Validate status
  local status=$(echo "$db_result" | jq -r '.[0].results[0].status')
  if [ "$status" != "options_ready" ]; then
    echo "Expected status=options_ready, got $status" >&2
    return 1
  fi

  # Validate JSON fields parse correctly
  local intake_json=$(echo "$db_result" | jq -r '.[0].results[0].intake_json')
  if ! echo "$intake_json" | jq -e . >/dev/null 2>&1; then
    echo "intake_json is not valid JSON" >&2
    return 1
  fi

  local options_json=$(echo "$db_result" | jq -r '.[0].results[0].options_json')
  if ! echo "$options_json" | jq -e . >/dev/null 2>&1; then
    echo "options_json is not valid JSON" >&2
    return 1
  fi

  return 0
}

# T012: Test error handling
test_error_handling_missing_input() {
  local response=$(curl -s --max-time 60 -X POST "${BASE_URL}/api/trips" \
    -d "userId=test-error-user")

  # Should get error response
  local error=$(echo "$response" | jq -r '.error // empty')
  if [ -z "$error" ]; then
    echo "Expected error response, got none" >&2
    return 1
  fi

  if [[ ! "$error" =~ "No input provided" ]]; then
    echo "Expected 'No input provided' error, got: $error" >&2
    return 1
  fi

  return 0
}

# =======================
# Run Tests
# =======================

echo "=== Core API Tests ==="
echo ""

run_test "Template listing" test_template_listing
run_test "Heritage theme trip creation" test_heritage_theme
run_test "TV/Movie theme trip creation" test_tvmovie_theme
run_test "Historical theme trip creation" test_historical_theme
run_test "Culinary theme trip creation" test_culinary_theme
run_test "Adventure theme trip creation" test_adventure_theme

echo ""
echo "=== Validation Tests ==="
echo ""

run_test "Database persistence verification" test_database_persistence
run_test "Error handling (missing input)" test_error_handling_missing_input
