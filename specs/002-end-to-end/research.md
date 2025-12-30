# Research Report: E2E Testing for VoyGent V3 MVP

**Date**: 2025-10-09
**Feature**: End-to-End Test Suite for Full MVP
**Branch**: `002-end-to-end`

## Executive Summary

This document consolidates research findings for implementing a comprehensive E2E test suite for VoyGent V3 using Playwright. Key decisions:

1. **Testing Framework**: Playwright with TypeScript for E2E browser automation, API testing, and mobile viewport emulation
2. **External API Strategy**: Use real APIs (no mocks) for high fidelity, accepting slower execution and API costs
3. **Database Management**: Global setup for migrations + test-level cleanup via Playwright fixtures
4. **Fixture Pattern**: Hybrid approach using Fishery factories + JSON data files with environment-specific configuration
5. **Stability Target**: <5% flakiness via circuit breakers, retry logic, health checks, and idempotent tests
6. **Cost Tracking**: Custom Playwright reporter with per-test cost logging (informational only, non-blocking)

## 1. Playwright Configuration for Cloudflare Pages

### Decision: WebServer Configuration with Automatic wrangler dev Startup

**Rationale**: Playwright's `webServer` configuration automatically starts the local development server before tests and shuts it down after, eliminating manual server management and ensuring tests always run against a fresh instance.

### Implementation

**playwright.config.ts**:
```typescript
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({
  path: path.resolve(__dirname, `.env.${process.env.TEST_ENV || 'test'}`)
});

export default defineConfig({
  testDir: './tests/e2e',

  // Timeout configuration
  timeout: 120000, // 2 minutes per test (includes retries)
  expect: {
    timeout: 10000, // 10 seconds for assertions
  },

  // Test execution
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,

  // Reporting
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results/html-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  // Shared settings for all tests
  use: {
    baseURL: process.env.APP_URL || 'http://localhost:8788',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // Projects for different test scenarios
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-320px',
      use: {
        ...devices['iPhone SE'],
        viewport: { width: 320, height: 568 },
      },
    },
    {
      name: 'tablet-768px',
      use: {
        ...devices['iPad Mini'],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'desktop-1024px',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1024, height: 768 },
      },
    },
  ],

  // Automatically start dev server before tests
  webServer: {
    command: 'npm run dev', // Runs wrangler dev
    url: 'http://localhost:8788',
    timeout: 120000, // 2 minutes to start
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },

  // Global setup/teardown
  globalSetup: require.resolve('./tests/global-setup.ts'),
  globalTeardown: require.resolve('./tests/global-teardown.ts'),
});
```

**Alternatives Considered**:
- **Manual server start**: Error-prone, requires developers to remember to start server
- **Docker containers**: Overhead for local development, complexity
- **Hybrid decision**: Use `webServer` for local/CI, but allow environment override for deployed environments

---

## 2. Database State Management

### Decision: Global Setup for Migrations + Test-Level Cleanup via Fixtures

**Rationale**: Migrations should run once before all tests (expensive operation), but each test should start with clean data (isolation). Using Playwright fixtures ensures automatic cleanup even when tests fail.

### Implementation

**tests/global-setup.ts**:
```typescript
import { FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function globalSetup(config: FullConfig) {
  console.log('\n=== Global Test Setup ===\n');

  // Apply database migrations
  console.log('Applying database migrations...');
  await execAsync('npm run db:migrate');

  // Seed required test data (templates)
  console.log('Seeding test data...');
  await execAsync('npm run db:seed:test');

  console.log('✓ Global setup complete\n');
}

export default globalSetup;
```

**tests/helpers/database.ts**:
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function cleanDatabase() {
  console.log('Cleaning test database...');

  // Delete all trips created during tests
  await execAsync(`npm run db:exec -- "DELETE FROM themed_trips WHERE template_id LIKE 'test-%'"`);

  console.log('✓ Database cleaned');
}

export async function seedTemplates() {
  // Templates are seeded once in global setup
  // This function is for reference only
}
```

**tests/fixtures/playwright/test-fixtures.ts**:
```typescript
import { test as base } from '@playwright/test';
import { cleanDatabase } from '../helpers/database';

type CleanupFixtures = {
  cleanDb: void;
};

export const test = base.extend<CleanupFixtures>({
  cleanDb: [async ({}, use) => {
    // No setup needed before test
    await use();

    // Cleanup after test (even if test fails)
    await cleanDatabase();
  }, { auto: true }], // auto: true means this runs for every test
});

export { expect } from '@playwright/test';
```

**Alternatives Considered**:
- **Database transactions**: Faster but doesn't test real commit behavior
- **Full DB reset per test**: Too slow (migrations take 5-10 seconds)
- **No cleanup**: Data pollution, flaky tests

---

## 3. API Testing with Playwright

### Decision: APIRequestContext + JSON Schema Validation

**Rationale**: Playwright's `APIRequestContext` provides built-in retry logic, timeout handling, and request interception. JSON schema validation ensures API responses match expected structure.

### Implementation

**tests/helpers/api-client.ts**:
```typescript
import { APIRequestContext } from '@playwright/test';

export class APIClient {
  constructor(private request: APIRequestContext) {}

  async getTemplates() {
    const response = await this.request.get('/api/templates');
    return { response, data: await response.json() };
  }

  async createTrip(templateId: string, message: string, preferences?: any) {
    const response = await this.request.post('/api/trips', {
      data: {
        template_id: templateId,
        initial_message: message,
        preferences,
      },
    });
    return { response, data: await response.json() };
  }

  async getTrip(tripId: string) {
    const response = await this.request.get(`/api/trips/${tripId}`);
    return { response, data: await response.json() };
  }

  async confirmDestinations(tripId: string, destinations: string[], preferences: any) {
    const response = await this.request.post(`/api/trips/${tripId}/confirm-destinations`, {
      data: {
        confirmed_destinations: destinations,
        preferences,
      },
    });
    return { response, data: await response.json() };
  }

  async selectTripOption(tripId: string, optionIndex: number) {
    const response = await this.request.post(`/api/trips/${tripId}/select`, {
      data: { option_index: optionIndex },
    });
    return { response, data: await response.json() };
  }
}
```

**tests/schemas/trip-schema.ts**:
```typescript
export const tripSchema = {
  type: 'object',
  required: ['id', 'template_id', 'status', 'created_at'],
  properties: {
    id: { type: 'string' },
    template_id: { type: 'string' },
    status: {
      type: 'string',
      enum: ['chat', 'researching', 'awaiting_confirmation', 'building_trip', 'options_ready', 'option_selected']
    },
    chat_history: { type: 'array' },
    research_destinations: {
      type: ['array', 'null'],
      items: {
        type: 'object',
        required: ['name', 'geographic_context', 'rationale', 'estimated_days'],
        properties: {
          name: { type: 'string' },
          geographic_context: { type: 'string' },
          rationale: { type: 'string' },
          estimated_days: { type: 'number' },
        },
      },
    },
    destinations_confirmed: { type: 'number' },
    options: { type: ['array', 'null'] },
    selected_option_index: { type: ['number', 'null'] },
    created_at: { type: 'string' },
  },
};
```

---

## 4. Asynchronous Operation Testing

### Decision: Polling with `expect.poll()` Pattern

**Rationale**: AI processing and trip building can take 60s-3min. Polling with exponential backoff is more reliable than hard-coded waits and provides better error messages when operations don't complete.

### Implementation

**tests/helpers/polling.ts**:
```typescript
import { expect, APIRequestContext } from '@playwright/test';

export async function pollForTripStatus(
  request: APIRequestContext,
  tripId: string,
  expectedStatus: string,
  timeoutMs: number = 180000 // 3 minutes default
) {
  await expect.poll(
    async () => {
      const response = await request.get(`/api/trips/${tripId}`);
      const trip = await response.json();
      return trip.status;
    },
    {
      message: `Trip ${tripId} did not reach status "${expectedStatus}"`,
      timeout: timeoutMs,
      intervals: [3000, 3000, 3000], // Poll every 3 seconds
    }
  ).toBe(expectedStatus);
}

export async function pollForDestinations(
  request: APIRequestContext,
  tripId: string,
  timeoutMs: number = 60000 // 1 minute default
) {
  return await expect.poll(
    async () => {
      const response = await request.get(`/api/trips/${tripId}`);
      const trip = await response.json();
      return trip.research_destinations || [];
    },
    {
      message: `Trip ${tripId} did not receive destinations`,
      timeout: timeoutMs,
      intervals: [3000, 3000, 3000],
    }
  ).toHaveLength(expect.any(Number));
}
```

---

## 5. Mobile Responsive Testing

### Decision: Device Emulation with Multiple Playwright Projects

**Rationale**: Playwright's device emulation provides accurate viewport sizes and touch simulation. Using projects allows running same tests across multiple viewport sizes in parallel.

### Implementation

Already configured in `playwright.config.ts` (see Section 1).

**tests/e2e/mobile-responsive.spec.ts**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Mobile Responsiveness @mobile', () => {
  test('template cards should be readable on 320px viewport', async ({ page, viewport }) => {
    await page.goto('/');

    // Wait for templates to load
    await expect(page.locator('[data-testid="template-card"]').first()).toBeVisible();

    // Verify no horizontal scrolling
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewport!.width + 5); // Allow 5px tolerance

    // Verify template cards are stacked vertically (not side-by-side)
    const cards = page.locator('[data-testid="template-card"]');
    const count = await cards.count();

    for (let i = 0; i < count - 1; i++) {
      const card1Box = await cards.nth(i).boundingBox();
      const card2Box = await cards.nth(i + 1).boundingBox();

      // Second card should be below first card (not beside it)
      expect(card2Box!.y).toBeGreaterThan(card1Box!.y + card1Box!.height - 10);
    }
  });

  test('touch targets should be at least 44x44px', async ({ page }) => {
    await page.goto('/');

    const buttons = page.locator('button, a[href]');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });
});
```

---

## 6. Performance and Cost Tracking

### Decision: Custom Playwright Reporter with Informational Metrics

**Rationale**: Performance and cost metrics provide visibility for optimization but should never fail tests (per clarification #2 and #4). Custom reporter aggregates metrics after test completion.

### Implementation

**tests/utils/cost-calculator.ts**:
```typescript
export interface ApiCall {
  provider: string;
  endpoint: string;
  statusCode: number;
  duration: number;
  timestamp: number;
  testId: string;
}

export class CostCalculator {
  private calls: ApiCall[] = [];

  recordCall(call: ApiCall): void {
    this.calls.push(call);
  }

  calculateCost(call: ApiCall): number {
    switch (call.provider) {
      case 'amadeus':
        return call.endpoint.includes('flight') ? 0.008 : 0.006;
      case 'viator':
        return 0; // Free tier for testing
      case 'serper':
        return 0.001;
      case 'openrouter':
        return 0.004; // Estimate: $4 per 1M tokens avg
      default:
        return 0;
    }
  }

  getTotalCost(): number {
    return this.calls.reduce((sum, call) => sum + this.calculateCost(call), 0);
  }

  getCostByTest(): Record<string, number> {
    const costByTest: Record<string, number> = {};
    this.calls.forEach(call => {
      const cost = this.calculateCost(call);
      costByTest[call.testId] = (costByTest[call.testId] || 0) + cost;
    });
    return costByTest;
  }
}
```

**tests/utils/metrics-reporter.ts**:
```typescript
import { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

class MetricsReporter implements Reporter {
  private performanceMetrics: Map<string, number[]> = new Map();

  onTestEnd(test: TestCase, result: TestResult) {
    const testId = `${test.parent.title} > ${test.title}`;
    const durations = this.performanceMetrics.get(testId) || [];
    durations.push(result.duration);
    this.performanceMetrics.set(testId, durations);
  }

  onEnd() {
    console.log('\n=== Performance Metrics (Informational) ===\n');

    // Calculate percentiles for each test
    this.performanceMetrics.forEach((durations, testId) => {
      const sorted = durations.sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)] || p95;

      if (p95 > 60000) { // More than 60 seconds
        console.log(`⚠️  ${testId}: p95=${(p95/1000).toFixed(1)}s (slow)`);
      }
    });

    console.log('\n✓ Performance metrics are informational only and do not affect test results\n');
  }
}

export default MetricsReporter;
```

---

## 7. Concurrent User Testing

### Decision: Parallel Workers with Data Isolation

**Rationale**: Playwright's worker model allows running multiple tests in parallel. Using unique test IDs and proper database cleanup ensures tests don't interfere with each other.

### Implementation

**tests/e2e/concurrent-users.spec.ts**:
```typescript
import { test, expect } from '../fixtures/playwright/test-fixtures';
import { APIClient } from '../helpers/api-client';

test.describe('Concurrent Users', () => {
  test('should handle 10 simultaneous trip creations', async ({ request }) => {
    const apiClient = new APIClient(request);

    // Create 10 trips concurrently
    const promises = Array.from({ length: 10 }, async (_, index) => {
      const { response, data } = await apiClient.createTrip(
        'heritage-ancestry-001',
        `Test trip ${index} - ${Date.now()}`, // Unique message
        {
          duration_min: 7,
          duration_max: 14,
          departure_airport: 'JFK',
          travelers: 2,
          luxury_level: 'moderate',
        }
      );

      expect(response.status()).toBe(201);
      expect(data.id).toBeDefined();

      return data.id;
    });

    // Wait for all trips to be created
    const tripIds = await Promise.all(promises);

    // Verify all trips were created successfully
    expect(tripIds).toHaveLength(10);
    expect(new Set(tripIds).size).toBe(10); // All unique IDs
  });
});
```

---

## 8. Test Fixture Patterns

### Decision: Hybrid Approach (Fishery Factories + JSON Data)

**Rationale**: Code-based factories provide type safety and dynamic generation, while JSON files provide environment-specific configuration (template IDs that differ between local/production).

### Implementation

**tests/fixtures/factories/trip.factory.ts**:
```typescript
import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';

interface TripInput {
  template_id: string;
  message: string;
  preferences: {
    duration_min: number;
    duration_max: number;
    departure_airport: string;
    travelers: number;
    luxury_level: 'budget' | 'moderate' | 'luxury';
  };
}

class TripFactory extends Factory<TripInput> {
  heritage() {
    return this.params({
      template_id: 'heritage-ancestry-001', // Will be overridden by config
      message: 'Sullivan family from Cork, Ireland',
    });
  }

  withRandomPreferences() {
    return this.params({
      preferences: {
        duration_min: faker.number.int({ min: 3, max: 7 }),
        duration_max: faker.number.int({ min: 8, max: 21 }),
        departure_airport: faker.helpers.arrayElement(['JFK', 'LAX', 'ORD']),
        travelers: faker.number.int({ min: 1, max: 8 }),
        luxury_level: faker.helpers.arrayElement(['budget', 'moderate', 'luxury']),
      },
    });
  }
}

export const tripFactory = TripFactory.define(() => ({
  template_id: 'test-template-001',
  message: faker.lorem.sentence(),
  preferences: {
    duration_min: 7,
    duration_max: 14,
    departure_airport: 'LAX',
    travelers: 2,
    luxury_level: 'moderate',
  },
}));
```

**tests/fixtures/data/templates.json**:
```json
{
  "local": {
    "heritage-ancestry-001": {
      "id": "heritage-ancestry-001",
      "name": "Heritage & Ancestry"
    }
  },
  "production": {
    "heritage-ancestry-001": {
      "id": "prod-heritage-001",
      "name": "Heritage & Ancestry"
    }
  }
}
```

---

## 9. Real API Testing Patterns

### Decision: Use Real APIs with Retry Logic and Circuit Breakers

**Rationale**: Per clarification #1, tests use real external APIs for higher fidelity. Retry logic handles transient failures, circuit breakers prevent cascading failures when APIs are down.

### Implementation

**tests/utils/circuit-breaker.ts**:
```typescript
export class CircuitBreaker {
  private failureCount: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private nextAttempt: number = Date.now();

  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.failureCount = 0;
      this.state = 'CLOSED';
      return result;
    } catch (error) {
      this.failureCount++;
      if (this.failureCount >= this.threshold) {
        this.state = 'OPEN';
        this.nextAttempt = Date.now() + this.timeout;
      }
      throw error;
    }
  }
}
```

---

## 10. API Key Management

### Decision: Environment Variables with dotenv

**Rationale**: Industry standard for secret management. Keeps keys out of source code, works across all environments, integrates with CI/CD.

### Implementation

**.env.test** (gitignored):
```bash
# External API Keys
AMADEUS_API_KEY=test_key_xxx
AMADEUS_API_SECRET=test_secret_xxx
VIATOR_API_KEY=test_viator_xxx
SERPER_API_KEY=test_serper_xxx
Z_AI_API_KEY=test_zai_xxx
OPENROUTER_API_KEY=test_openrouter_xxx

# App Configuration
APP_URL=http://localhost:8788
DATABASE_URL=.wrangler/state/v3/d1/miniflare-D1DatabaseObject/...
```

**tests/utils/api-config.ts**:
```typescript
export function requireApiKey(keyName: string): string {
  const value = process.env[keyName];

  if (!value) {
    throw new Error(
      `MISSING API KEY: ${keyName} environment variable is not set.\n\n` +
      `To run these tests, you need to:\n` +
      `1. Create a .env.test file in the project root\n` +
      `2. Add ${keyName}=your_api_key_here\n\n` +
      `See README for instructions on obtaining API keys.`
    );
  }

  return value;
}
```

---

## Summary of Key Decisions

| Decision Area | Choice | Rationale |
|--------------|--------|-----------|
| **Testing Framework** | Playwright with TypeScript | Built-in browser automation, API testing, mobile emulation |
| **External APIs** | Real APIs (no mocks) | Higher fidelity per clarification #1 |
| **Database Management** | Global migrations + test-level cleanup | Balance performance (slow migrations) with isolation |
| **Fixture Pattern** | Fishery factories + JSON data | Type safety + environment-specific config |
| **Async Operations** | Polling with `expect.poll()` | Reliable for 60s-3min operations |
| **Mobile Testing** | Device emulation via projects | Accurate viewport testing in parallel |
| **Performance Metrics** | Custom reporter (informational) | Visibility without failing tests (clarification #2) |
| **Cost Tracking** | Custom reporter (informational) | Visibility without blocking execution (clarification #4) |
| **Concurrent Users** | Parallel workers with data isolation | Test scalability with 10 simultaneous trips |
| **API Keys** | Environment variables with dotenv | Industry standard, secure, flexible |
| **Stability** | Circuit breakers + retry + health checks | Achieve <5% flakiness target |

---

## Next Steps

With research complete, proceed to Phase 1:
1. **Generate data-model.md**: Define test entities (TestSuite, TestReport, TestFixture, TestEnvironment)
2. **Generate contracts/**: Define test configuration schemas and expected API response structures
3. **Generate quickstart.md**: Document how to set up and run the E2E test suite
4. **Update agent context**: Add Playwright and testing patterns to `.claude/` files

All "NEEDS CLARIFICATION" items from Technical Context have been resolved through this research.
