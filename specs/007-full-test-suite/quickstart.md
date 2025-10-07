# Quickstart: Running the Voygent Test Suite

**Feature**: 007-full-test-suite
**Phase**: 1 (Design)
**Status**: Complete

## Overview

This guide explains how to set up, run, and maintain the comprehensive test suite for the Voygent platform.

---

## Prerequisites

Before running tests, ensure you have:

1. **Node.js 18+** installed
2. **Wrangler CLI** installed: `npm install -g wrangler`
3. **Test database** provisioned (see Setup section)
4. **Environment variables** configured (API keys, database IDs)

---

## Setup

### 1. Install Dependencies

```bash
npm install --save-dev vitest @cloudflare/vitest-pool-workers
```

### 2. Create Test Database

```bash
# Create test D1 database
wrangler d1 create voygent-test

# Note the database ID from output, add to wrangler.toml:
# [[d1_databases]]
# binding = "TEST_DB"
# database_name = "voygent-test"
# database_id = "YOUR-DATABASE-ID-HERE"
```

### 3. Run Migrations

```bash
# Run all migrations on test database
for migration in migrations/*.sql; do
  wrangler d1 execute voygent-test --file "$migration"
done
```

### 4. Seed Test Data

```bash
# Seed trip templates (required for tests)
wrangler d1 execute voygent-test --file tests/fixtures/seed-templates.sql
```

### 5. Configure Environment

Create `.dev.vars` file with test API keys (can use dummy values since we mock):

```bash
OPENAI_API_KEY=sk-test-key-for-testing
ANTHROPIC_API_KEY=sk-ant-test-key
SERPER_API_KEY=test-serper-key
TAVILY_API_KEY=tvly-test-key
```

---

## Running Tests

### Run Full Test Suite

```bash
npm run test
```

**Expected Output**:
```
✓ tests/unit/template-interpolation.test.ts (6)
✓ tests/unit/template-validation.test.ts (8)
✓ tests/unit/intake-normalization.test.ts (10)
✓ tests/integration/theme-heritage.test.ts (12)
✓ tests/integration/theme-tvmovie.test.ts (10)
...

Test Files  15 passed (15)
     Tests  85 passed (85)
  Start at  12:34:56
  Duration  243.57s (transform 1.2s, setup 5.3s, collect 8.9s, tests 228.1s)
```

---

### Run Specific Theme Tests

**Heritage Theme**:
```bash
npm run test tests/integration/theme-heritage.test.ts
```

**TV/Movie Theme**:
```bash
npm run test tests/integration/theme-tvmovie.test.ts
```

**Historical Theme**:
```bash
npm run test tests/integration/theme-historical.test.ts
```

**Culinary Theme**:
```bash
npm run test tests/integration/theme-culinary.test.ts
```

**Adventure Theme**:
```bash
npm run test tests/integration/theme-adventure.test.ts
```

---

### Run Unit Tests Only

```bash
npm run test tests/unit/
```

**Expected Output**:
```
✓ tests/unit/template-interpolation.test.ts (6)
✓ tests/unit/template-validation.test.ts (8)
✓ tests/unit/intake-normalization.test.ts (10)
✓ tests/unit/error-handling.test.ts (7)
✓ tests/unit/data-integrity.test.ts (9)

Test Files  5 passed (5)
     Tests  40 passed (40)
  Duration  12.45s
```

---

### Run Integration Tests Only

```bash
npm run test tests/integration/
```

**Expected Output**:
```
✓ tests/integration/theme-heritage.test.ts (12)
✓ tests/integration/theme-tvmovie.test.ts (10)
✓ tests/integration/theme-historical.test.ts (10)
✓ tests/integration/theme-culinary.test.ts (9)
✓ tests/integration/theme-adventure.test.ts (10)
✓ tests/integration/research-execution.test.ts (8)
✓ tests/integration/api-endpoints.test.ts (10)
✓ tests/integration/white-label-agency.test.ts (6)
✓ tests/integration/performance.test.ts (5)
✓ tests/integration/trip-generation.test.ts (8)

Test Files  10 passed (10)
     Tests  88 passed (88)
  Duration  231.12s
```

---

### Run in Watch Mode

```bash
npm run test:watch
```

**Use Cases**:
- Actively developing new tests
- Debugging failing tests
- Refactoring code and verifying tests still pass

---

### Generate Coverage Report

```bash
npm run test:coverage
```

**Expected Output**:
```
 % Coverage report from v8
----------------------------|---------|----------|---------|---------|
File                        | % Stmts | % Branch | % Funcs | % Lines |
----------------------------|---------|----------|---------|---------|
All files                   |   85.34 |    78.92 |   89.12 |   85.34 |
 functions/api/lib/         |   92.45 |    88.34 |   95.23 |   92.45 |
  research-executor.ts      |   98.12 |    95.45 |  100.00 |   98.12 |
  research-utils.ts         |  100.00 |   100.00 |  100.00 |  100.00 |
  trip-templates.ts         |   87.23 |    82.11 |   90.12 |   87.23 |
 functions/api/trips/       |   78.92 |    72.34 |   84.56 |   78.92 |
  index.ts                  |   78.92 |    72.34 |   84.56 |   78.92 |
----------------------------|---------|----------|---------|---------|
```

---

## Test Scenarios

### Heritage Theme Scenarios

1. **Basic Surname Search**:
   - Input: "Williams family heritage in Scotland"
   - Expected: Trip options with Scottish heritage sites
   - Validates: Template selection, research execution, trip generation

2. **Detailed Ancestry**:
   - Input: "McLeod surname, interested in castles, Isle of Skye"
   - Expected: Focused options with castles and Skye locations
   - Validates: Interest parsing, location prioritization

3. **Genealogy Document Upload**:
   - Input: Text + genealogy PDF file
   - Expected: Extracts surnames and origins from document
   - Validates: File upload, OCR, genealogy parsing

---

### TV/Movie Theme Scenarios

1. **Popular Series**:
   - Input: "Game of Thrones filming locations"
   - Expected: Options with Northern Ireland, Iceland, Croatia
   - Validates: Filming location research, multi-country itineraries

2. **Classic Film**:
   - Input: "Lord of the Rings New Zealand tour"
   - Expected: Options with Hobbiton, Queenstown, Wellington
   - Validates: Film location accuracy, New Zealand focus

---

### Historical Theme Scenarios

1. **Major Event**:
   - Input: "D-Day historical sites in France"
   - Expected: Options with Normandy beaches, museums, memorials
   - Validates: Historical research, France itineraries

2. **Historical Period**:
   - Input: "Medieval England castles and battlefields"
   - Expected: Options with castles, battle sites, historical towns
   - Validates: Period-specific research, UK focus

---

### Culinary Theme Scenarios

1. **Cuisine + Region**:
   - Input: "Italian cuisine cooking classes in Tuscany"
   - Expected: Options with cooking schools, food tours, wineries
   - Validates: Cuisine research, region focus, activity inclusion

2. **Cuisine Only**:
   - Input: "French food tour"
   - Expected: Options across France (Paris, Lyon, Provence)
   - Validates: Multi-region options when location not specified

---

### Adventure Theme Scenarios

1. **Destination + Activity**:
   - Input: "Patagonia hiking and glacier trekking"
   - Expected: Options with hiking trails, glacier tours, national parks
   - Validates: Activity research, outdoor focus

2. **Activity Only**:
   - Input: "Safari adventure"
   - Expected: Options with African safari destinations
   - Validates: Activity-based destination selection

---

## Performance Benchmarks

### Expected Performance

| Operation | Duration | Cost |
|-----------|----------|------|
| Heritage trip generation | < 20s | < $0.015 |
| TV/Movie trip generation | < 18s | < $0.012 |
| Historical trip generation | < 16s | < $0.010 |
| Culinary trip generation | < 15s | < $0.010 |
| Adventure trip generation | < 15s | < $0.010 |
| Research execution | < 5s | < $0.005 |
| Intake normalization | < 3s | < $0.002 |
| Options generation | < 10s | < $0.008 |

**Note**: Actual times may vary based on AI provider response times (mocked in tests).

---

## Interpreting Test Results

### Successful Test Run

```
✓ tests/integration/theme-heritage.test.ts (12)
  ✓ Heritage Theme Tests (12)
    ✓ generates trip for Williams surname
    ✓ includes Scottish heritage sites
    ✓ executes research with correct query
    ✓ saves research to database
    ...
```

**What to Check**:
- All tests passed (✓)
- No failing tests (✗)
- Duration is reasonable (< 5 minutes total)
- Coverage is above 80%

---

### Failed Test

```
✗ tests/integration/theme-heritage.test.ts (11 failed, 1 passed)
  ✗ Heritage Theme Tests
    ✗ generates trip for Williams surname
      AssertionError: expected 'null' to be truthy
      at validateResearchData (tests/helpers/assertions.ts:45:10)
```

**Debugging Steps**:
1. **Check error message**: Identifies what assertion failed
2. **Review test code**: Look at the specific test scenario
3. **Check fixtures**: Ensure mock data is correct
4. **Run in isolation**: `npm run test tests/integration/theme-heritage.test.ts`
5. **Add console logs**: Add `console.log(trip.diagnostics)` to inspect data
6. **Check database**: Verify test database has correct seed data

---

## Adding New Test Scenarios

### 1. Create Fixture

Add to `tests/fixtures/[theme]-inputs.json`:

```json
{
  "new-scenario": {
    "text": "Your test input here",
    "theme": "heritage",
    "expected": {
      "surnames": ["TestSurname"],
      "suspected_origins": ["TestLocation"]
    }
  }
}
```

### 2. Add Mock Responses

Add to `tests/fixtures/ai-responses.json`:

```json
{
  "new-scenario": {
    "intake": "{\"surnames\": [\"TestSurname\"], ...}",
    "options": "{\"options\": [{...}]}",
    "researchSynthesis": "Research analysis text..."
  }
}
```

### 3. Write Test

Add to `tests/integration/theme-heritage.test.ts`:

```typescript
test('new scenario description', async () => {
  const input = heritageInputs.newScenario;
  const response = await POST('/api/trips', { body: input });

  validateTripStructure(response);
  expect(response.intake.surnames).toContain('TestSurname');
  // Add more assertions...
});
```

### 4. Run Test

```bash
npm run test tests/integration/theme-heritage.test.ts
```

---

## Troubleshooting

### Test Database Not Found

**Error**: `D1_ERROR: no such table: themed_trips`

**Solution**: Run migrations on test database:
```bash
wrangler d1 execute voygent-test --file migrations/001_init.sql
# Repeat for all migrations
```

---

### Mock Provider Not Working

**Error**: `TypeError: mockCallProvider is not a function`

**Solution**: Verify mock is imported and configured:
```typescript
import { mockCallProvider } from '../helpers/mock-providers';

// In test setup
vi.mock('../lib/provider', () => ({
  callProvider: mockCallProvider(aiResponses)
}));
```

---

### Tests Timing Out

**Error**: `Test timed out in 30000ms`

**Solution**: Increase timeout for slow operations:
```typescript
test('slow operation', async () => {
  // ...
}, 60000); // 60 second timeout
```

---

### Database Cleanup Failing

**Error**: `D1_ERROR: database is locked`

**Solution**: Ensure proper cleanup order:
```typescript
afterEach(async () => {
  // Delete children first (messages)
  await db.prepare('DELETE FROM themed_messages WHERE trip_id LIKE ?').bind('test-trip-%').run();

  // Then delete parents (trips)
  await db.prepare('DELETE FROM themed_trips WHERE user_id LIKE ?').bind('test-user-%').run();
});
```

---

## CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/test.yml`:

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: wrangler d1 create voygent-test
      - run: npm run test:ci
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      - uses: actions/upload-artifact@v3
        with:
          name: test-report
          path: test-report.json
```

---

## Best Practices

1. **Run tests before committing**: `git commit` hooks can automate this
2. **Write tests first** (TDD): Define expected behavior before implementation
3. **Keep tests isolated**: Each test should be independent
4. **Use descriptive test names**: "generates trip for Williams surname" not "test1"
5. **Clean up test data**: Always delete test records after tests
6. **Mock external APIs**: Don't call real AI providers or web search in tests
7. **Measure performance**: Track duration and cost trends over time
8. **Update fixtures regularly**: Keep test data realistic and current

---

## Next Steps

After setting up the test suite:

1. **Run baseline**: Execute full suite to establish baseline metrics
2. **Monitor coverage**: Aim for 80%+ coverage on critical paths
3. **Fix failures**: Address any failing tests before proceeding
4. **Add more scenarios**: Expand coverage for edge cases
5. **Integrate CI/CD**: Automate testing on every commit
6. **Track trends**: Monitor performance and cost over time

---

## Summary

**Quick Commands**:
- `npm run test` - Run all tests
- `npm run test:watch` - Watch mode for development
- `npm run test:coverage` - Generate coverage report
- `npm run test tests/integration/theme-heritage.test.ts` - Run specific theme

**Key Files**:
- `tests/fixtures/*.json` - Test data and mock responses
- `tests/helpers/*.ts` - Test utilities and assertions
- `tests/integration/*.test.ts` - Integration test suites
- `tests/unit/*.test.ts` - Unit test suites

**Support**: For issues or questions, see troubleshooting section or check test documentation.
