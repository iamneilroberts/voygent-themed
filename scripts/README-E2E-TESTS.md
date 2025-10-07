# E2E Production Tests for VoyGent

This directory contains end-to-end tests for the production VoyGent deployment at https://voygent.app.

## Quick Start

```bash
# Run full E2E test suite
./scripts/e2e-production-tests.sh

# Run with cleanup skipped (for debugging)
./scripts/e2e-production-tests.sh --skip-cleanup

# View test report
cat reports/e2e-test-report-*.json | jq '.'
```

## Files

### Main Test Script
- **e2e-production-tests.sh** - Main test runner that executes all E2E tests

### Helper Scripts
- **test-helpers/api-calls.sh** - HTTP client functions for API requests
- **test-helpers/cleanup-data.sh** - Database cleanup utilities

### Test Fixtures
- **test-fixtures/heritage-input.txt** - Heritage theme test input
- **test-fixtures/tvmovie-input.txt** - TV/Movie theme test input
- **test-fixtures/historical-input.txt** - Historical theme test input
- **test-fixtures/culinary-input.txt** - Culinary theme test input
- **test-fixtures/adventure-input.txt** - Adventure theme test input

## Tests Included

### Core API Tests (T005-T010)
1. Template listing
2. Heritage theme trip creation
3. TV/Movie theme trip creation
4. Historical theme trip creation
5. Culinary theme trip creation
6. Adventure theme trip creation

### Validation Tests (T011-T013)
7. Database persistence verification
8. Error handling (missing input)
9. Performance and cost tracking

## Requirements

- **curl** - HTTP client
- **jq** - JSON parser
- **wrangler** - Cloudflare CLI (for database verification)
- **bc** - Calculator (for cost calculations)

## Test Output

Tests generate:
- Console output with pass/fail status
- Performance metrics (duration, cost)
- JSON test report in `reports/` directory

## Cleanup

Test data is automatically cleaned up unless `--skip-cleanup` is specified.

To manually cleanup orphaned test data:
```bash
./scripts/test-helpers/cleanup-data.sh
```

## Notes

- Tests run against live production at voygent.app
- Each run incurs real AI costs (~$0.05-0.10)
- Test data uses unique user IDs (`e2e-test-{timestamp}`)
- All test data is removed after test completion

## Documentation

For detailed information, see:
- `specs/008-create-a-set/quickstart.md` - Usage guide
- `specs/008-create-a-set/data-model.md` - API contracts
- `specs/008-create-a-set/tasks.md` - Implementation details
