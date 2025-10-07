# Implementation Tasks: End-to-End Production Tests for Cloudflare VoyGent

**Feature**: 008-create-a-set
**Branch**: `008-create-a-set`
**Created**: 2025-10-07
**Status**: Ready for implementation

## Overview

This document breaks down the implementation of E2E production tests into discrete, actionable tasks. The tests will validate the production deployment at voygent.app using bash/curl scripts that make real HTTP requests to the live API.

**Technology**: Bash + curl + jq (building on existing test-production.sh)
**Target**: Production API at https://voygent.app
**Estimated Tasks**: 15 tasks
**Estimated Duration**: 2-3 days

---

## Task Dependencies

```
Phase 1: Setup (T001-T004) - Can run in parallel [P]
   ↓
Phase 2: Core API Tests (T005-T010) - Can run in parallel [P] after setup
   ↓
Phase 3: Validation (T011-T013) - Sequential, depend on core tests
   ↓
Phase 4: Polish (T014-T015) - Sequential, final tasks
```

---

## Phase 1: Test Infrastructure Setup

### T001 [P]: Create E2E test directory structure
**Priority**: High
**Dependencies**: None
**Estimated Time**: 15 minutes

**Files to Create**:
- `scripts/e2e-production-tests.sh` (main test runner)
- `scripts/test-helpers/` (directory)
- `scripts/test-fixtures/` (directory)
- `reports/` (directory for test output)

**Acceptance Criteria**:
- Directory structure matches plan.md "Bash Script Structure"
- Main test script exists and is executable (`chmod +x`)
- Directories have proper .gitkeep files if needed

**Implementation Notes**:
- Build on existing `test-production.sh` structure
- Add header comments explaining purpose and usage
- Include basic scaffolding for test execution flow

---

### T002 [P]: Create test fixtures for all 5 themes
**Priority**: High
**Dependencies**: None (can run parallel with T001)
**Estimated Time**: 20 minutes

**Files to Create**:
- `scripts/test-fixtures/heritage-input.txt`
- `scripts/test-fixtures/tvmovie-input.txt`
- `scripts/test-fixtures/historical-input.txt`
- `scripts/test-fixtures/culinary-input.txt`
- `scripts/test-fixtures/adventure-input.txt`

**Fixture Content**:
- **Heritage**: "Williams family from Scotland, interested in ancestral heritage sites, 7 days in June"
- **TV/Movie**: "Game of Thrones filming locations in Northern Ireland, Croatia, and Iceland, 10 days"
- **Historical**: "D-Day Normandy historical tour, visiting beaches and museums, 5-7 days"
- **Culinary**: "Italian cuisine in Tuscany, cooking classes and wine tours, 7 days"
- **Adventure**: "Patagonia hiking expedition, Torres del Paine and Fitz Roy, 10-14 days"

**Acceptance Criteria**:
- All 5 fixture files exist
- Each fixture contains realistic, detailed trip description
- Fixtures match examples from spec.md acceptance scenarios
- Content can be read with `cat` command

---

### T003 [P]: Implement HTTP client helper functions
**Priority**: High
**Dependencies**: None (can run parallel with T001-T002)
**Estimated Time**: 30 minutes

**File to Create**:
- `scripts/test-helpers/api-calls.sh`

**Functions to Implement**:
```bash
# Make GET request to production API
# Args: $1=endpoint (e.g., "/api/templates")
# Returns: JSON response
api_get() { ... }

# Make POST request to production API
# Args: $1=endpoint, $2=form_data (e.g., "theme=heritage")
# Returns: JSON response
api_post() { ... }

# Parse JSON response and extract field
# Args: $1=json_string, $2=jq_filter (e.g., ".tripId")
# Returns: extracted value
json_extract() { ... }

# Check if response contains required fields
# Args: $1=json_string, $2=field_list (space-separated)
# Returns: 0 if all present, 1 otherwise
validate_response_fields() { ... }
```

**Acceptance Criteria**:
- Functions use curl with proper options (-s, --max-time 60)
- Handles HTTP status codes correctly
- Returns clean JSON output (no curl progress bars)
- Error handling for network failures, timeouts
- Can be sourced into main test script

---

### T004 [P]: Implement cleanup utility script
**Priority**: High
**Dependencies**: None (can run parallel with T001-T003)
**Estimated Time**: 30 minutes

**File to Create**:
- `scripts/test-helpers/cleanup-data.sh`

**Functions to Implement**:
```bash
# Delete test trips and messages from production database
# Args: $1=user_id_pattern (e.g., "e2e-test-%")
# Returns: 0 on success, 1 on failure
cleanup_test_data() { ... }

# Verify cleanup succeeded
# Args: $1=user_id_pattern
# Returns: count of remaining test records
verify_cleanup() { ... }

# Track test trip IDs for cleanup
# Args: $1=trip_id
track_test_trip() { ... }
```

**Implementation**:
- Use `wrangler d1 execute voygent-themed --remote` for database operations
- Delete themed_messages first (foreign key constraint), then themed_trips
- Query: `DELETE FROM themed_messages WHERE trip_id IN (SELECT id FROM themed_trips WHERE user_id LIKE 'e2e-test-%')`
- Query: `DELETE FROM themed_trips WHERE user_id LIKE 'e2e-test-%'`
- Verification: `SELECT COUNT(*) FROM themed_trips WHERE user_id LIKE 'e2e-test-%'`

**Acceptance Criteria**:
- Cleanup function deletes all test data
- Handles case where no test data exists (no error)
- Verification returns 0 for successful cleanup
- Error messages are clear and helpful
- Can run standalone or from main test script

---

## Phase 2: Core API Tests

### T005 [P]: Implement template listing test
**Priority**: High
**Dependencies**: T001, T003 (needs test structure and HTTP helpers)
**Estimated Time**: 20 minutes

**File to Modify**:
- `scripts/e2e-production-tests.sh`

**Test to Implement**:
- Call `GET /api/templates`
- Validate response has status 200
- Validate response contains `templates` array
- Validate array has at least 1 template
- Validate each template has: id, name, description, icon

**Acceptance Criteria**:
- Test passes with production API
- Uses helper functions from T003
- Reports pass/fail status clearly
- Measures response time (<1 second expected)

---

### T006 [P]: Implement heritage theme test
**Priority**: High
**Dependencies**: T001, T002, T003 (needs structure, fixtures, helpers)
**Estimated Time**: 30 minutes

**File to Modify**:
- `scripts/e2e-production-tests.sh`

**Test to Implement**:
- Generate unique user_id: `e2e-test-$(date +%s)-heritage`
- Read fixture: `scripts/test-fixtures/heritage-input.txt`
- Call `POST /api/trips` with theme=heritage, text={fixture}, userId={user_id}
- Validate response:
  - Status 200
  - Contains: tripId, intake, options, diagnostics
  - intake.theme = "heritage"
  - intake.surnames contains "Williams"
  - options array has 2-4 elements
  - diagnostics.totalCost < 0.10
- Track tripId for cleanup

**Acceptance Criteria**:
- Test passes with production API
- Response time 5-60 seconds
- Cost tracking included
- Trip ID tracked for cleanup

---

### T007 [P]: Implement TV/movie theme test
**Priority**: High
**Dependencies**: T001, T002, T003 (same as T006)
**Estimated Time**: 25 minutes

**File to Modify**:
- `scripts/e2e-production-tests.sh`

**Test to Implement**:
- Generate unique user_id: `e2e-test-$(date +%s)-tvmovie`
- Read fixture: `scripts/test-fixtures/tvmovie-input.txt`
- Call `POST /api/trips` with theme=tvmovie, text={fixture}, userId={user_id}
- Validate response:
  - Status 200
  - intake.theme = "tvmovie"
  - intake.titles contains "Game of Thrones"
  - options include filming locations (Northern Ireland, Croatia, Iceland)

**Acceptance Criteria**:
- Test passes with production API
- Validates multi-country itinerary
- Tracks cost and duration

---

### T008 [P]: Implement historical theme test
**Priority**: High
**Dependencies**: T001, T002, T003 (same as T006-T007)
**Estimated Time**: 25 minutes

**File to Modify**:
- `scripts/e2e-production-tests.sh`

**Test to Implement**:
- Generate unique user_id: `e2e-test-$(date +%s)-historical`
- Read fixture: `scripts/test-fixtures/historical-input.txt`
- Call `POST /api/trips` with theme=historical, text={fixture}, userId={user_id}
- Validate response:
  - Status 200
  - intake.theme = "historical"
  - intake.events contains "D-Day"
  - options include Normandy locations (Omaha Beach, museums)

**Acceptance Criteria**:
- Test passes with production API
- Validates historical site inclusion
- Museums/memorials in itinerary

---

### T009 [P]: Implement culinary theme test
**Priority**: High
**Dependencies**: T001, T002, T003 (same as T006-T008)
**Estimated Time**: 25 minutes

**File to Modify**:
- `scripts/e2e-production-tests.sh`

**Test to Implement**:
- Generate unique user_id: `e2e-test-$(date +%s)-culinary`
- Read fixture: `scripts/test-fixtures/culinary-input.txt`
- Call `POST /api/trips` with theme=culinary, text={fixture}, userId={user_id}
- Validate response:
  - Status 200
  - intake.theme = "culinary"
  - intake.cuisines contains "Italian"
  - options include cooking classes and wine tours

**Acceptance Criteria**:
- Test passes with production API
- Validates culinary activities
- Cooking classes in itinerary

---

### T010 [P]: Implement adventure theme test
**Priority**: High
**Dependencies**: T001, T002, T003 (same as T006-T009)
**Estimated Time**: 25 minutes

**File to Modify**:
- `scripts/e2e-production-tests.sh`

**Test to Implement**:
- Generate unique user_id: `e2e-test-$(date +%s)-adventure`
- Read fixture: `scripts/test-fixtures/adventure-input.txt`
- Call `POST /api/trips` with theme=adventure, text={fixture}, userId={user_id}
- Validate response:
  - Status 200
  - intake.theme = "adventure"
  - intake.destinations contains "Patagonia"
  - options include hiking trails and outdoor activities

**Acceptance Criteria**:
- Test passes with production API
- Validates adventure activities
- National parks/trails in itinerary

---

## Phase 3: Validation Tests

### T011: Implement database persistence verification
**Priority**: High
**Dependencies**: T006-T010 (needs at least one trip created)
**Estimated Time**: 40 minutes

**File to Modify**:
- `scripts/e2e-production-tests.sh`

**Test to Implement**:
- After creating a trip (use heritage test trip ID)
- Query production database:
  ```bash
  wrangler d1 execute voygent-themed \
    --command "SELECT * FROM themed_trips WHERE id = '$TRIP_ID'" \
    --remote --json
  ```
- Validate database record:
  - Record exists (1 row returned)
  - status = "options_ready"
  - intake_json is valid JSON (parse with jq)
  - options_json is valid JSON and has 2-4 options
  - diagnostics is valid JSON and contains cost tracking

**Acceptance Criteria**:
- Test passes with production database
- Validates all JSON fields parse correctly
- Checks database constraints (status, etc.)
- Handles wrangler CLI errors gracefully

---

### T012: Implement error handling tests
**Priority**: Medium
**Dependencies**: T001, T003 (needs test structure and helpers)
**Estimated Time**: 30 minutes

**File to Modify**:
- `scripts/e2e-production-tests.sh`

**Tests to Implement**:
1. **Missing input test**:
   - Call `POST /api/trips` with no text field
   - Expect status 400
   - Expect error message: "No input provided"

2. **Invalid user query test** (if applicable):
   - Call `GET /api/trips` without userId parameter
   - Expect status 400
   - Expect error with details

**Acceptance Criteria**:
- Tests pass with expected error responses
- Validates error message format
- Confirms API doesn't crash on bad input

---

### T013: Implement performance and cost tracking
**Priority**: Medium
**Dependencies**: T006-T010 (needs theme tests)
**Estimated Time**: 30 minutes

**File to Modify**:
- `scripts/e2e-production-tests.sh`

**Implementation**:
- Track duration for each API call:
  ```bash
  start_time=$(date +%s%N)
  # ... make API call ...
  end_time=$(date +%s%N)
  duration=$(( (end_time - start_time) / 1000000 )) # milliseconds
  ```
- Extract cost from diagnostics:
  ```bash
  cost=$(echo "$response" | jq -r '.diagnostics.totalCost')
  ```
- Accumulate totals:
  - Total duration across all tests
  - Total cost across all tests
  - Average cost per theme
  - Min/max response times

**Acceptance Criteria**:
- Tracks duration for all API calls
- Extracts cost from diagnostics
- Reports summary at end of test run
- Validates costs are under $1 for full suite

---

## Phase 4: Polish & Reporting

### T014: Implement test report generation
**Priority**: Medium
**Dependencies**: T005-T013 (needs all tests implemented)
**Estimated Time**: 40 minutes

**File to Modify**:
- `scripts/e2e-production-tests.sh`

**Implementation**:
- Generate JSON test report matching data-model.md structure
- Report fields:
  - runId: `e2e-run-$(date +%s)`
  - timestamp: Unix timestamp
  - environment: targetUrl, testerHost, gitCommit
  - summary: total, passed, failed, skipped, duration, totalCost
  - scenarios: array of all test results
  - performance: avgResponseTime, maxResponseTime, minResponseTime
  - costs: totalCost, costByTheme, avgCostPerTrip
  - cleanup: cleanupSuccess, remainingRecords
  - failures: array of failed test details
- Save to: `reports/e2e-test-report-{timestamp}.json`
- Print summary to console (human-readable)

**Acceptance Criteria**:
- JSON report matches data-model.md TestReport structure
- Report is valid JSON (can be parsed with jq)
- Console output is clear and readable
- Report includes all test results and metrics

---

### T015: Integrate cleanup into test suite
**Priority**: High
**Dependencies**: T004, T006-T010 (needs cleanup script and trip creation)
**Estimated Time**: 20 minutes

**File to Modify**:
- `scripts/e2e-production-tests.sh`

**Implementation**:
- Add cleanup call at end of test suite (in trap for EXIT):
  ```bash
  trap cleanup_and_exit EXIT
  cleanup_and_exit() {
    echo "Running cleanup..."
    source scripts/test-helpers/cleanup-data.sh
    cleanup_test_data "e2e-test-%"
    local remaining=$(verify_cleanup "e2e-test-%")
    if [ "$remaining" -eq 0 ]; then
      echo "✓ Cleanup successful"
    else
      echo "⚠ Warning: $remaining test records remain"
    fi
  }
  ```
- Ensure cleanup runs even if tests fail
- Add `--skip-cleanup` flag for debugging

**Acceptance Criteria**:
- Cleanup runs automatically at end of suite
- Cleanup runs even if tests fail (trap EXIT)
- `--skip-cleanup` flag skips cleanup
- Cleanup success/failure reported clearly

---

## Parallel Execution Examples

### Run Setup Tasks in Parallel
```bash
# All setup tasks can run simultaneously
Task(T001, "Create E2E test directory structure") &
Task(T002, "Create test fixtures for all 5 themes") &
Task(T003, "Implement HTTP client helper functions") &
Task(T004, "Implement cleanup utility script") &
wait  # Wait for all to complete
```

### Run Core API Tests in Parallel
```bash
# After setup, all theme tests can run in parallel
Task(T005, "Implement template listing test") &
Task(T006, "Implement heritage theme test") &
Task(T007, "Implement TV/movie theme test") &
Task(T008, "Implement historical theme test") &
Task(T009, "Implement culinary theme test") &
Task(T010, "Implement adventure theme test") &
wait  # Wait for all to complete
```

---

## Task Checklist

**Phase 1: Setup**
- [x] T001 - Create E2E test directory structure
- [x] T002 - Create test fixtures for all 5 themes
- [x] T003 - Implement HTTP client helper functions
- [x] T004 - Implement cleanup utility script

**Phase 2: Core API Tests**
- [x] T005 - Implement template listing test
- [x] T006 - Implement heritage theme test
- [x] T007 - Implement TV/movie theme test
- [x] T008 - Implement historical theme test
- [x] T009 - Implement culinary theme test
- [x] T010 - Implement adventure theme test

**Phase 3: Validation**
- [x] T011 - Implement database persistence verification
- [x] T012 - Implement error handling tests
- [x] T013 - Implement performance and cost tracking

**Phase 4: Polish**
- [x] T014 - Implement test report generation
- [x] T015 - Integrate cleanup into test suite

---

## Execution Order

**Recommended order for sequential execution**:
1. Phase 1 (T001-T004) - Setup infrastructure
2. Phase 2 (T005-T010) - Implement all theme tests
3. Phase 3 (T011-T013) - Add validation
4. Phase 4 (T014-T015) - Polish and reporting

**Parallel execution**:
- Phase 1: All tasks [P] can run together
- Phase 2: All tasks [P] can run together after Phase 1
- Phase 3-4: Sequential execution required

---

## Testing the Implementation

After all tasks complete, validate the E2E test suite:

```bash
# Run full test suite
./scripts/e2e-production-tests.sh

# Expected output:
# - 8+ tests executed
# - All tests pass
# - Total cost < $1
# - Cleanup successful
# - Test report generated

# Verify test report
cat reports/e2e-test-report-*.json | jq '.summary'

# Verify cleanup
wrangler d1 execute voygent-themed \
  --command "SELECT COUNT(*) FROM themed_trips WHERE user_id LIKE 'e2e-test-%'" \
  --remote
# Expected: 0
```

---

## Notes

- All tasks modify files in the repository root `/home/neil/dev/lite-voygent-claude`
- Tests run against production: https://voygent.app
- Each test run incurs real AI costs (~$0.05-0.10)
- Test data is automatically cleaned up
- Refer to quickstart.md for detailed usage instructions
- Refer to data-model.md for API contracts and data structures
