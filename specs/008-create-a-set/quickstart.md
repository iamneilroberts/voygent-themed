# Quickstart: E2E Production Tests

**Feature**: End-to-End Production Tests for Cloudflare VoyGent
**Target**: Production environment at https://voygent.app

## Overview

This guide shows you how to run end-to-end tests against the production VoyGent deployment. These tests make real HTTP requests to the live production API, verify trip generation across all themes, and validate database persistence.

**⚠️ Important**: These tests run against production and incur real AI costs (~$0.05-0.10 per full run). Test data is automatically cleaned up after execution.

---

## Prerequisites

### Required
1. **Production Access**: Access to voygent.app (publicly available)
2. **Command Line Tools**:
   - `curl` - HTTP client for API requests
   - `jq` - JSON parsing and validation
   - `wrangler` - Cloudflare CLI for database verification (optional)
3. **Permissions** (for database verification):
   - Cloudflare account access
   - Wrangler authenticated: `wrangler login`

### Optional
- `node` and `npm` - If using TypeScript test suite (future)
- Git - For checking out test code

---

## Quick Start (5 minutes)

### 1. Run the E2E Test Suite

```bash
# Navigate to project root
cd /home/neil/dev/lite-voygent-claude

# Make test script executable (first time only)
chmod +x scripts/e2e-production-tests.sh

# Run full E2E test suite
./scripts/e2e-production-tests.sh
```

**Expected Output**:
```
==================================
VoyGent Production E2E Tests
Base URL: https://voygent.app
Test Run ID: e2e-run-1759854000
==================================

Test 1: List templates ... ✓ PASS (0.8s)
Test 2: Heritage theme trip ... ✓ PASS (18.2s)
Test 3: TV/Movie theme trip ... ✓ PASS (20.1s)
Test 4: Historical theme trip ... ✓ PASS (17.5s)
Test 5: Culinary theme trip ... ✓ PASS (19.3s)
Test 6: Adventure theme trip ... ✓ PASS (16.8s)
Test 7: Error handling ... ✓ PASS (0.5s)
Test 8: Database verification ... ✓ PASS (2.1s)

==================================
Test Summary
==================================
Total Tests:  8
Passed:       8
Failed:       0
Duration:     95.3s
Total Cost:   $0.042
==================================
✓ All tests passed!
```

### 2. View Test Report

```bash
# View detailed test report
cat reports/e2e-test-report-1759854000.json | jq '.'
```

### 3. Cleanup (Automatic)

Test data is automatically cleaned up at the end of the test run. To manually verify cleanup:

```bash
# Check for remaining test data
./scripts/verify-cleanup.sh
```

---

## Running Specific Tests

### Test Only One Theme

```bash
# Run only heritage theme test
./scripts/e2e-production-tests.sh --theme heritage

# Run only culinary theme test
./scripts/e2e-production-tests.sh --theme culinary
```

### Test Specific Endpoints

```bash
# Test only API availability (templates endpoint)
./scripts/e2e-production-tests.sh --test api-availability

# Test only database persistence
./scripts/e2e-production-tests.sh --test database-verification
```

### Skip Cleanup (for debugging)

```bash
# Run tests but keep test data in production database
./scripts/e2e-production-tests.sh --skip-cleanup
```

**⚠️ Warning**: If you skip cleanup, manually delete test data afterward:
```bash
./scripts/cleanup-e2e-data.sh
```

---

## Manual Testing

If you want to test individual API calls manually:

### Test Template Listing

```bash
curl -s "https://voygent.app/api/templates" | jq '.'
```

**Expected**: JSON response with `templates` array containing 5 themes.

### Test Trip Creation (Heritage Theme)

```bash
curl -s -X POST "https://voygent.app/api/trips" \
  -d "theme=heritage" \
  -d "text=Williams family from Scotland, interested in ancestral heritage" \
  -d "userId=manual-test-$(date +%s)" \
  | jq '.'
```

**Expected**: JSON response with `tripId`, `intake`, `options` (2-4), `diagnostics`.

### Verify Database Persistence

```bash
# Get trip ID from previous step (replace with actual tripId)
TRIP_ID="abc123xyz"

# Query production database
wrangler d1 execute voygent-themed \
  --command "SELECT id, status, template FROM themed_trips WHERE id = '$TRIP_ID'" \
  --remote --json | jq '.'
```

**Expected**: 1 row with status `options_ready` and template matching your theme.

---

## Understanding Test Results

### Test Status Codes
- **✓ PASS**: Test completed successfully, all assertions passed
- **✗ FAIL**: Test failed, see error details in report
- **⊘ SKIP**: Test was skipped (e.g., due to dependency failure)
- **⚠ WARN**: Test passed but with warnings (e.g., slow response time)

### Performance Metrics
- **Duration**: Time from request start to response received (milliseconds)
- **Cost**: Estimated AI cost for this request (USD)
- **Cold Start**: First request after idle may be slower (+2-5 seconds)

### Test Report Fields

```json
{
  "runId": "e2e-run-1759854000",
  "summary": {
    "total": 8,        // Total tests executed
    "passed": 7,       // Tests that passed all assertions
    "failed": 1,       // Tests that failed
    "skipped": 0,      // Tests skipped
    "duration": 95300, // Total test run time (ms)
    "totalCost": 0.042 // Total AI costs incurred (USD)
  },
  "performance": {
    "avgResponseTime": 18500, // Average API response time
    "maxResponseTime": 32000, // Slowest response
    "minResponseTime": 800    // Fastest response
  },
  "cleanup": {
    "cleanupSuccess": true,    // Cleanup completed successfully
    "remainingRecords": 0      // Test records left in database
  },
  "failures": []               // Array of failed test details
}
```

---

## Troubleshooting

### Test Timeout

**Problem**: Test fails with "Request timeout after 60 seconds"

**Causes**:
- Cold start: First request after idle can take 20-30 seconds
- Production load: API may be slow during high traffic
- AI provider rate limits: OpenAI/Anthropic throttling

**Solutions**:
- Retry the test: `./scripts/e2e-production-tests.sh --retry-failed`
- Check production logs: `wrangler pages deployment list`
- Wait a few minutes and try again (cold start will resolve)

### Authentication Error

**Problem**: "Cloudflare authentication required"

**Solution**:
```bash
# Login to Cloudflare
wrangler login

# Verify access
wrangler pages project list
```

### Cleanup Failed

**Problem**: "Warning: 3 test trips remain" in test output

**Causes**:
- Network error during cleanup
- Database connection timeout
- Test script interrupted

**Solution**:
```bash
# Manually run cleanup script
./scripts/cleanup-e2e-data.sh

# Verify cleanup succeeded
wrangler d1 execute voygent-themed \
  --command "SELECT COUNT(*) FROM themed_trips WHERE user_id LIKE 'e2e-test-%'" \
  --remote
```

### High Costs

**Problem**: Test run costs more than expected (>$0.10)

**Causes**:
- Using expensive models (Claude Opus instead of Haiku)
- Complex inputs generating long responses
- Multiple retries due to failures

**Solutions**:
- Check production PROVIDER_MODE setting (should be "cheap")
- Review diagnostics in test report for per-test costs
- Limit test frequency to reduce cumulative costs

### Tests Flaky (Pass Sometimes, Fail Sometimes)

**Problem**: Same test passes on some runs, fails on others

**Causes**:
- Cold start variability (first request slower)
- AI provider response variability (different output each time)
- Network latency fluctuations

**Solutions**:
- Tests should account for production variability (wide time/cost ranges)
- Retry failed tests: `./scripts/e2e-production-tests.sh --retry-failed`
- Mark flaky tests appropriately in assertions (use ranges, not exact values)

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Production Tests

on:
  workflow_dispatch:  # Manual trigger
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install dependencies
        run: |
          sudo apt-get install -y jq
          npm install -g wrangler

      - name: Authenticate Cloudflare
        run: |
          echo "${{ secrets.CLOUDFLARE_API_TOKEN }}" | wrangler login --api-token

      - name: Run E2E tests
        run: ./scripts/e2e-production-tests.sh

      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: e2e-test-report
          path: reports/e2e-test-report-*.json

      - name: Notify on failure
        if: failure()
        run: echo "E2E tests failed! Check test report for details."
```

### Run After Deployment

```yaml
name: Deploy and Test

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to production
        run: npx wrangler pages deploy public

  e2e-test:
    needs: deploy
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run E2E tests
        run: ./scripts/e2e-production-tests.sh
```

---

## Best Practices

### Test Execution
1. **Run infrequently**: E2E tests incur real costs, run only after deployments or major changes
2. **Monitor costs**: Track cumulative costs over time, alert if costs spike
3. **Test during low traffic**: Run during off-peak hours to minimize production impact
4. **Use wide tolerance ranges**: Account for cold starts and variability

### Data Management
1. **Always cleanup**: Ensure test data is removed from production database
2. **Use unique IDs**: Generate fresh user IDs for each test run to avoid collisions
3. **Verify cleanup**: Check that no test data remains after test run
4. **Monitor database size**: Track production database size to detect cleanup issues

### Debugging
1. **Save test reports**: Keep historical test reports for trend analysis
2. **Check diagnostics**: Review cost and performance data in test responses
3. **Inspect production logs**: Use Cloudflare dashboard to view API logs
4. **Reproduce manually**: Use manual curl commands to isolate issues

---

## Next Steps

- **View detailed test results**: `cat reports/e2e-test-report-*.json | jq '.'`
- **Add custom tests**: Edit `scripts/e2e-production-tests.sh` to add new test scenarios
- **Set up CI/CD**: Configure GitHub Actions to run tests automatically
- **Monitor trends**: Track test performance and costs over time

---

## Quick Reference

### Common Commands

```bash
# Run full E2E test suite
./scripts/e2e-production-tests.sh

# Run specific theme
./scripts/e2e-production-tests.sh --theme heritage

# Skip cleanup (for debugging)
./scripts/e2e-production-tests.sh --skip-cleanup

# Manual cleanup
./scripts/cleanup-e2e-data.sh

# View test report
cat reports/e2e-test-report-*.json | jq '.summary'

# Check production database
wrangler d1 execute voygent-themed \
  --command "SELECT COUNT(*) FROM themed_trips WHERE user_id LIKE 'e2e-test-%'" \
  --remote
```

### Production URLs

- **Production Site**: https://voygent.app
- **API Base**: https://voygent.app/api
- **Templates**: https://voygent.app/api/templates
- **Trip Creation**: https://voygent.app/api/trips (POST)
- **Trip Listing**: https://voygent.app/api/trips?userId={id} (GET)

### Support

For questions or issues with E2E tests:
1. Check test report for detailed error messages
2. Review production logs in Cloudflare dashboard
3. Consult data-model.md for API contracts
4. Check research.md for implementation details
