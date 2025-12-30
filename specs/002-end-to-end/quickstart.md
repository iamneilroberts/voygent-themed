# Quick Start Guide: E2E Test Suite

**Date**: 2025-10-09
**Feature**: End-to-End Test Suite for Full MVP
**Branch**: `002-end-to-end`

This guide will help you set up and run the E2E test suite for VoyGent V3 locally.

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** installed (`node --version`)
- **npm** installed (`npm --version`)
- **wrangler CLI** installed (`npx wrangler --version`)
- **Git** installed (`git --version`)
- **API keys** for external services (see API Key Setup below)

---

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd voygent-v3
```

### 2. Install Dependencies

```bash
npm install
```

This installs all dependencies including:
- Playwright (E2E testing framework)
- wrangler (Cloudflare development server)
- fishery (test fixture factories)
- @faker-js/faker (test data generation)

### 3. Install Playwright Browsers

```bash
npx playwright install chromium
```

This downloads the Chromium browser for Playwright tests.

---

## API Key Setup

### 1. Create `.env.test` File

Create a `.env.test` file in the project root (**this file is gitignored**):

```bash
touch .env.test
```

### 2. Add API Keys

Add the following API keys to `.env.test`:

```bash
# External API Keys (Required for E2E tests)
AMADEUS_API_KEY=your_amadeus_api_key_here
AMADEUS_API_SECRET=your_amadeus_api_secret_here
VIATOR_API_KEY=your_viator_api_key_here
SERPER_API_KEY=your_serper_api_key_here
Z_AI_API_KEY=your_zai_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here

# App Configuration
APP_URL=http://localhost:8788
TEST_ENV=test
```

### 3. Obtain API Keys

#### Amadeus API (Flight/Hotel Search)
1. Visit https://developers.amadeus.com/
2. Sign up for a free test account
3. Create a new app in the dashboard
4. Copy API Key and API Secret

#### Viator API (Tours/Activities)
1. Visit https://www.viator.com/partner
2. Sign up for the Partner API
3. Request API credentials from Viator support
4. Copy API Key

#### Serper API (Web Search)
1. Visit https://serper.dev/
2. Sign up for an account
3. Copy API Key from dashboard (free tier: 2,500 searches/month)

#### Z.AI API (AI Generation)
1. Visit https://z.ai/
2. Sign up for an account
3. Copy API Key from dashboard

#### OpenRouter API (AI Generation Fallback)
1. Visit https://openrouter.ai/
2. Sign up for an account
3. Copy API Key from dashboard

**Note**: You can start with just Amadeus and Serper to run basic tests. Add other keys as needed.

---

## Database Setup

### 1. Apply Migrations

```bash
npm run db:migrate
```

This creates the necessary database tables (`trip_templates`, `themed_trips`).

### 2. Seed Test Data

```bash
npm run db:seed:test
```

This seeds the database with test templates (Heritage & Ancestry, Culinary Adventure).

### 3. Verify Database

```bash
npm run db:query -- "SELECT * FROM trip_templates;"
```

You should see the seeded templates.

---

## Running Tests

### Run All Tests

```bash
npm run test:e2e
```

This runs the entire E2E test suite against your local development server.

**What happens**:
1. Playwright starts `wrangler dev` automatically
2. Waits for server to be ready (up to 2 minutes)
3. Runs all tests in parallel (4 workers by default)
4. Generates HTML and JSON reports
5. Shuts down the dev server

### Run Specific Test Suite

```bash
# Run only critical path tests
npx playwright test critical-path

# Run only API endpoint tests
npx playwright test api-endpoints

# Run only mobile responsiveness tests
npx playwright test mobile-responsive
```

### Run Tests in Specific Browser/Viewport

```bash
# Desktop Chrome
npx playwright test --project=desktop-chromium

# Mobile 320px
npx playwright test --project=mobile-320px

# Tablet 768px
npx playwright test --project=tablet-768px
```

### Run Tests in Debug Mode

```bash
# Open Playwright Inspector
npx playwright test --debug

# Run with headed browser (see what's happening)
npx playwright test --headed

# Slow down execution (useful for watching tests)
npx playwright test --headed --slow-mo=500
```

### Run Tests with UI

```bash
npx playwright test --ui
```

This opens Playwright's interactive UI where you can:
- Run tests one by one
- See test execution in real-time
- Inspect test results
- View traces and screenshots

---

## Viewing Test Results

### HTML Report

After tests complete, open the HTML report:

```bash
npx playwright show-report
```

This opens an interactive report in your browser showing:
- Pass/fail status for all tests
- Execution times
- Screenshots (for failures)
- Playwright traces (for failures)

### JSON Report

View raw test results:

```bash
cat test-results/results.json | jq
```

### Cost Report

View API cost breakdown:

```bash
cat test-results/cost-reports/cost-report-*.json | jq
```

Or open the HTML cost report in your browser:

```bash
open test-results/cost-reports/cost-report-*.html
```

---

## Common Issues and Solutions

### Issue: "MISSING API KEY" Error

**Problem**: `.env.test` file is missing or API keys are not set.

**Solution**:
1. Verify `.env.test` exists in project root
2. Check that all required API keys are set
3. Ensure no extra spaces around `=` in `.env.test`

### Issue: "Cannot start wrangler dev" Error

**Problem**: Port 8788 is already in use.

**Solution**:
```bash
# Find and kill process on port 8788
lsof -i :8788
kill -9 <PID>

# Or change port in .env.test
APP_URL=http://localhost:8789
```

### Issue: "Database locked" Error

**Problem**: Another process is using the D1 database.

**Solution**:
```bash
# Stop all wrangler processes
pkill -f wrangler

# Remove lock file
rm -f .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.db-wal
```

### Issue: Tests Timeout After 2 Minutes

**Problem**: External APIs are slow or unavailable.

**Solution**:
1. Check API health:
   ```bash
   npm run test:health-check
   ```
2. Increase timeout in `playwright.config.ts`:
   ```typescript
   timeout: 180000, // 3 minutes
   ```
3. Run tests with fewer workers:
   ```bash
   npx playwright test --workers=1
   ```

### Issue: "Rate limited (429)" Errors

**Problem**: Too many concurrent API calls.

**Solution**:
1. Run tests with fewer workers:
   ```bash
   npx playwright test --workers=2
   ```
2. Add delays between tests:
   ```typescript
   test.beforeEach(async () => {
     await page.waitForTimeout(1000); // 1 second delay
   });
   ```

### Issue: High API Costs

**Problem**: Tests are making too many expensive API calls.

**Solution**:
1. Review cost report to identify expensive tests
2. Reduce test data (fewer trips, shorter searches)
3. Run expensive tests less frequently
4. Consider using cheaper API tiers for testing

---

## Test Configuration

### playwright.config.ts

Main test configuration file. Key settings:

```typescript
{
  timeout: 120000,        // 2 minutes per test
  retries: 2,             // Retry failed tests twice
  workers: 4,             // Run 4 tests in parallel
  fullyParallel: true,    // Parallelize all tests
}
```

### Test Tags

Filter tests by tags:

```bash
# Run only tests that require external APIs
npx playwright test --grep @requiresApi

# Skip mobile tests
npx playwright test --grep-invert @mobile

# Run only P1 tests
npx playwright test --grep @P1
```

### Environment Variables

Override configuration via environment variables:

```bash
# Run against staging environment
APP_URL=https://staging.voygent.app TEST_ENV=staging npx playwright test

# Disable retries
npx playwright test --retries=0

# Run with more workers
npx playwright test --workers=8
```

---

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/e2e-tests.yml`:

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install chromium

      - name: Run E2E tests
        env:
          AMADEUS_API_KEY: ${{ secrets.AMADEUS_API_KEY }}
          AMADEUS_API_SECRET: ${{ secrets.AMADEUS_API_SECRET }}
          VIATOR_API_KEY: ${{ secrets.VIATOR_API_KEY }}
          SERPER_API_KEY: ${{ secrets.SERPER_API_KEY }}
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/

      - name: Check production readiness
        run: |
          READY=$(jq -r '.productionReadiness.isReady' test-results/report.json)
          if [ "$READY" != "true" ]; then
            echo "Build is not production-ready"
            exit 1
          fi
```

---

## Next Steps

### 1. Run Your First Test

```bash
npm run test:e2e
```

### 2. Review Test Report

```bash
npx playwright show-report
```

### 3. Explore Test Files

Look at test files in `tests/e2e/`:
- `critical-path.spec.ts` - Full user journey tests
- `api-endpoints.spec.ts` - API contract tests
- `performance.spec.ts` - Performance and concurrency tests
- `data-integrity.spec.ts` - Database validation tests
- `mobile-responsive.spec.ts` - Mobile UI tests

### 4. Write Your Own Test

Create a new test file in `tests/e2e/`:

```typescript
import { test, expect } from '../fixtures/playwright/test-fixtures';

test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('VoyGent');
  });
});
```

### 5. Learn More

- [Playwright Documentation](https://playwright.dev/)
- [spec.md](./spec.md) - Feature specification
- [data-model.md](./data-model.md) - Test entities
- [research.md](./research.md) - Testing patterns and best practices

---

## Support

If you encounter issues:

1. Check this guide's Common Issues section
2. Review the [research.md](./research.md) for detailed patterns
3. Check Playwright documentation: https://playwright.dev/
4. Open an issue in the repository

---

## Success Criteria

Your E2E test suite is working correctly when:

- ✅ All tests run without setup errors
- ✅ P1 tests pass at 100% (Critical Path, API Validation)
- ✅ P2 tests pass at 95%+ (Performance, Data Integrity)
- ✅ Flakiness rate is <5%
- ✅ Test suite completes in <10 minutes
- ✅ Cost reports show reasonable API costs (<$1 per run)

**Production Readiness**: Per clarification #3, a build is production-ready when P1 pass rate is 100% AND P2 pass rate is ≥95% AND flakiness is <5%.

Happy testing! 🎉
