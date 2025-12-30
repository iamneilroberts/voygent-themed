# Playwright Best Practices for Cloudflare Pages E2E Testing

## Executive Summary

This document provides research-backed best practices for building an end-to-end test suite for a Cloudflare Pages application using Playwright. The guidance covers configuration, database management, API testing, asynchronous operations, mobile testing, performance tracking, and concurrent execution.

**Target Environment:**
- Node.js 18+ with Cloudflare Pages Functions (serverless TypeScript)
- D1 (SQLite) database backend
- Vanilla HTML/CSS/JavaScript frontend
- Local testing against `wrangler dev` server

---

## 1. Playwright Configuration for Cloudflare Pages

### Decision: Use `webServer` Configuration with Custom Timeout

Configure Playwright to automatically start and wait for the `wrangler dev` server before running tests using the built-in `webServer` option.

### Rationale

- **Automated lifecycle management**: Playwright handles server startup/shutdown automatically
- **Intelligent readiness detection**: Built-in polling waits for 2xx/3xx status codes before tests run
- **CI/CD compatibility**: `reuseExistingServer` option prevents conflicts in different environments
- **Official support**: Wrangler 4.26.0+ officially supports Playwright with local development

### Implementation

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test configuration
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  use: {
    // Base URL for all tests
    baseURL: 'http://localhost:8788',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // Web server configuration for wrangler dev
  webServer: {
    command: 'npm run dev', // Should run: wrangler pages dev
    url: 'http://localhost:8788',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes for D1 initialization
    stdout: 'pipe',
    stderr: 'pipe',
  },

  // Projects for different test types and environments
  projects: [
    // Setup project for database initialization
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },

    // Desktop Chrome
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },

    // Mobile viewports
    {
      name: 'mobile-small',
      use: {
        ...devices['iPhone SE'],
        viewport: { width: 320, height: 568 }
      },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-medium',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 390, height: 844 }
      },
      dependencies: ['setup'],
    },
    {
      name: 'tablet',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 1024, height: 1366 }
      },
      dependencies: ['setup'],
    },
  ],
});
```

### Environment Switching Pattern

```typescript
// config/environments.ts
export const environments = {
  local: {
    baseURL: 'http://localhost:8788',
    apiURL: 'http://localhost:8788/api',
  },
  staging: {
    baseURL: 'https://staging.voygent.pages.dev',
    apiURL: 'https://staging.voygent.pages.dev/api',
  },
  production: {
    baseURL: 'https://voygent.app',
    apiURL: 'https://voygent.app/api',
  },
};

// In playwright.config.ts
const env = process.env.TEST_ENV || 'local';
const config = environments[env];

export default defineConfig({
  use: {
    baseURL: config.baseURL,
  },
  // Only use webServer for local development
  webServer: env === 'local' ? {
    command: 'npm run dev',
    url: config.baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  } : undefined,
});
```

### Alternatives Considered

1. **Manual server management**: Requires separate terminal window, error-prone
2. **Docker Compose**: Adds complexity, not needed for Cloudflare Pages local dev
3. **Custom polling scripts**: Reinvents built-in `webServer` functionality

---

## 2. Database State Management

### Decision: Use Project Dependencies with Custom Fixtures for Database Setup/Teardown

Implement a setup project that runs before tests to handle migrations and seeding, combined with custom fixtures for test-level database isolation.

### Rationale

- **Project dependencies** integrate with Playwright's test runner (traces, HTML reports)
- **Fixtures** provide automatic cleanup even when tests fail
- **D1 local persistence** in Wrangler v3+ requires explicit cleanup between test runs
- **Seed data separation** allows testing both with and without template data

### Implementation

#### Global Setup for Migrations

```typescript
// tests/global.setup.ts
import { test as setup } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';

setup('apply database migrations', async () => {
  console.log('Applying D1 migrations...');

  // Reset local D1 database by dropping tables
  const resetSql = path.join(__dirname, '../db/reset.sql');
  execSync(`wrangler d1 execute voygent-test --local --file=${resetSql}`, {
    stdio: 'inherit',
  });

  // Apply migrations
  execSync('wrangler d1 migrations apply voygent-test --local', {
    stdio: 'inherit',
  });

  console.log('Migrations applied successfully');
});

setup('seed test fixtures', async () => {
  console.log('Seeding test data...');

  const seedSql = path.join(__dirname, '../db/seed-test.sql');
  execSync(`wrangler d1 execute voygent-test --local --file=${seedSql}`, {
    stdio: 'inherit',
  });

  console.log('Test data seeded successfully');
});
```

#### Database Reset SQL Scripts

```sql
-- db/reset.sql
-- Drop all tables for clean slate
DROP TABLE IF EXISTS trips;
DROP TABLE IF EXISTS itineraries;
DROP TABLE IF EXISTS templates;
DROP TABLE IF EXISTS template_sections;
```

```sql
-- db/seed-test.sql
-- Insert test templates
INSERT INTO templates (id, name, description, category, created_at)
VALUES
  ('test-adventure-001', 'Adventure Seeker', 'For thrill-seekers and outdoor enthusiasts', 'adventure', CURRENT_TIMESTAMP),
  ('test-cultural-001', 'Cultural Explorer', 'Immerse in local culture and traditions', 'cultural', CURRENT_TIMESTAMP);

INSERT INTO template_sections (template_id, section_name, prompts)
VALUES
  ('test-adventure-001', 'activities', '["What outdoor activities interest you?", "Do you prefer water or land activities?"]'),
  ('test-cultural-001', 'interests', '["What aspects of culture interest you most?", "Any specific traditions you want to experience?"]');
```

#### Custom Database Fixture

```typescript
// tests/fixtures/database.ts
import { test as base } from '@playwright/test';
import { execSync } from 'child_process';

interface DatabaseFixtures {
  cleanDatabase: void;
  isolatedDatabase: void;
}

export const test = base.extend<DatabaseFixtures>({
  // Fixture that cleans database after each test
  cleanDatabase: async ({}, use) => {
    await use();

    // Teardown: clean up test data
    execSync(`wrangler d1 execute voygent-test --local --command="DELETE FROM trips WHERE id LIKE 'test-%'"`, {
      stdio: 'inherit',
    });
  },

  // Fixture that provides complete isolation (slower)
  isolatedDatabase: async ({}, use) => {
    // Setup: Reset to clean state
    execSync('wrangler d1 execute voygent-test --local --file=db/reset.sql', {
      stdio: 'inherit',
    });
    execSync('wrangler d1 migrations apply voygent-test --local', {
      stdio: 'inherit',
    });

    await use();

    // Teardown: Reset again
    execSync('wrangler d1 execute voygent-test --local --file=db/reset.sql', {
      stdio: 'inherit',
    });
  },
});
```

#### Usage in Tests

```typescript
// tests/e2e/trip-creation.spec.ts
import { test } from '../fixtures/database';
import { expect } from '@playwright/test';

// Use cleanDatabase fixture for lightweight cleanup
test('should create trip successfully', async ({ page, cleanDatabase }) => {
  await page.goto('/');

  // Test creates trip with id 'test-trip-001'
  await page.fill('[data-testid="trip-name"]', 'My Test Trip');
  await page.click('[data-testid="create-trip"]');

  await expect(page.locator('[data-testid="trip-created"]')).toBeVisible();

  // cleanDatabase fixture will delete 'test-trip-001' after test
});

// Use isolatedDatabase for tests requiring complete isolation
test('should handle concurrent trip creation', async ({ page, isolatedDatabase }) => {
  // This test runs with completely fresh database
  await page.goto('/');

  // Test implementation...
});
```

### Best Practices

1. **Prefix test data IDs**: Use `test-` prefix for easy cleanup (e.g., `test-trip-001`)
2. **Seed once, clean often**: Seed templates in global setup, clean trip data per test
3. **Use transactions**: Wrap test data creation in transactions when possible
4. **Avoid cross-test dependencies**: Each test should be able to run independently

### Alternatives Considered

1. **Global setup/teardown only**: Doesn't provide test-level isolation
2. **beforeEach/afterEach hooks**: Fixtures are more robust (handle failures better)
3. **In-memory SQLite**: Doesn't match D1's exact behavior and limitations
4. **Remote D1 bindings**: Slower, requires network, shares data across machines

---

## 3. API Testing with Playwright

### Decision: Use `APIRequestContext` with Custom Matchers and Schema Validation

Leverage Playwright's built-in API testing capabilities combined with AJV for JSON schema validation.

### Rationale

- **Integrated testing**: Test both API and UI in same framework
- **Shared authentication**: Storage state is interchangeable between browser and API contexts
- **Built-in assertions**: `expect(response).toBeOK()` and related matchers
- **Industry standard validation**: AJV is the most widely used JSON schema validator

### Implementation

#### API Test Setup

```typescript
// tests/fixtures/api.ts
import { test as base, expect } from '@playwright/test';
import Ajv from 'ajv';

interface APIFixtures {
  apiContext: import('@playwright/test').APIRequestContext;
  validateSchema: (data: any, schema: object) => void;
}

export const test = base.extend<APIFixtures>({
  apiContext: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({
      baseURL: 'http://localhost:8788',
      extraHTTPHeaders: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    await use(context);
    await context.dispose();
  },

  validateSchema: async ({}, use) => {
    const ajv = new Ajv({ allErrors: true });

    const validator = (data: any, schema: object) => {
      const validate = ajv.compile(schema);
      const valid = validate(data);

      if (!valid) {
        throw new Error(
          `Schema validation failed:\n${JSON.stringify(validate.errors, null, 2)}`
        );
      }
    };

    await use(validator);
  },
});

export { expect };
```

#### Testing Success Responses

```typescript
// tests/api/trips.spec.ts
import { test, expect } from '../fixtures/api';

// Define JSON schemas
const tripSchema = {
  type: 'object',
  required: ['id', 'name', 'status', 'createdAt'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string', minLength: 1 },
    status: { type: 'string', enum: ['draft', 'processing', 'completed', 'failed'] },
    templateId: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    budget: { type: 'number', minimum: 0 },
  },
};

const tripsListSchema = {
  type: 'object',
  required: ['trips', 'total'],
  properties: {
    trips: {
      type: 'array',
      items: tripSchema,
    },
    total: { type: 'number', minimum: 0 },
  },
};

test('GET /api/trips should return list of trips', async ({ apiContext, validateSchema }) => {
  const response = await apiContext.get('/api/trips');

  // Validate status code
  expect(response.ok()).toBeTruthy();
  expect(response.status()).toBe(200);

  // Validate response body
  const body = await response.json();
  validateSchema(body, tripsListSchema);

  // Additional assertions
  expect(body.trips).toBeInstanceOf(Array);
  expect(body.total).toBeGreaterThanOrEqual(0);
});

test('POST /api/trips should create new trip', async ({ apiContext, validateSchema }) => {
  const tripData = {
    name: 'Test Trip to Japan',
    templateId: 'test-adventure-001',
    budget: 5000,
  };

  const response = await apiContext.post('/api/trips', {
    data: tripData,
  });

  expect(response.status()).toBe(201);

  const body = await response.json();
  validateSchema(body, tripSchema);

  expect(body.name).toBe(tripData.name);
  expect(body.status).toBe('draft');
  expect(body.id).toBeTruthy();
});
```

#### Testing Error Responses

```typescript
// tests/api/error-handling.spec.ts
import { test, expect } from '../fixtures/api';

const errorSchema = {
  type: 'object',
  required: ['error', 'message'],
  properties: {
    error: { type: 'string' },
    message: { type: 'string' },
    details: { type: 'object' },
  },
};

test('POST /api/trips should return 400 for invalid data', async ({ apiContext, validateSchema }) => {
  const invalidData = {
    name: '', // Empty name should be invalid
  };

  const response = await apiContext.post('/api/trips', {
    data: invalidData,
  });

  expect(response.status()).toBe(400);

  const body = await response.json();
  validateSchema(body, errorSchema);

  expect(body.error).toBe('ValidationError');
  expect(body.message).toContain('name');
});

test('GET /api/trips/:id should return 404 for non-existent trip', async ({ apiContext, validateSchema }) => {
  const response = await apiContext.get('/api/trips/non-existent-id');

  expect(response.status()).toBe(404);

  const body = await response.json();
  validateSchema(body, errorSchema);

  expect(body.error).toBe('NotFoundError');
});

test('should return 403 for unauthorized access', async ({ apiContext, validateSchema }) => {
  // Assuming authentication is required for deleting trips
  const response = await apiContext.delete('/api/trips/some-id', {
    headers: {
      'Authorization': 'Bearer invalid-token',
    },
  });

  expect(response.status()).toBe(403);

  const body = await response.json();
  validateSchema(body, errorSchema);

  expect(body.error).toBe('ForbiddenError');
});

test('should handle 500 internal server errors', async ({ page }) => {
  // Track server errors during UI interactions
  const serverErrors: string[] = [];

  page.on('response', async (response) => {
    if (response.status() >= 500) {
      serverErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto('/');
  // Perform actions that might trigger server error...

  expect(serverErrors).toHaveLength(0); // Should have no 500 errors
});
```

#### Testing CORS Headers

```typescript
// tests/api/cors.spec.ts
import { test, expect } from '../fixtures/api';

test('should include correct CORS headers', async ({ apiContext }) => {
  const response = await apiContext.get('/api/trips', {
    headers: {
      'Origin': 'https://voygent.app',
    },
  });

  expect(response.ok()).toBeTruthy();

  const headers = response.headers();

  // Validate CORS headers
  expect(headers['access-control-allow-origin']).toBe('https://voygent.app');
  expect(headers['access-control-allow-credentials']).toBe('true');
  expect(headers['vary']).toContain('Origin');
});

test('should handle preflight OPTIONS request', async ({ apiContext }) => {
  const response = await apiContext.fetch('/api/trips', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://voygent.app',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type',
    },
  });

  expect(response.status()).toBe(204);

  const headers = response.headers();
  expect(headers['access-control-allow-methods']).toContain('POST');
  expect(headers['access-control-allow-headers']).toContain('Content-Type');
  expect(headers['access-control-max-age']).toBeTruthy();
});
```

### Best Practices

1. **Separate API and UI tests**: API tests run faster and provide better error messages
2. **Test contracts, not implementations**: Use schema validation for API contracts
3. **Test all status codes**: Don't just test happy paths (200), test errors (400, 404, 500)
4. **Validate response headers**: Check Content-Type, CORS, caching headers
5. **Use realistic test data**: Match production data patterns

### Alternatives Considered

1. **Postman/Newman**: Separate tool, doesn't share code with UI tests
2. **Supertest**: Node.js specific, doesn't test deployed endpoints
3. **Manual curl scripts**: Not automated, no schema validation
4. **OpenAPI generators**: Adds complexity, requires maintaining spec files

---

## 4. Asynchronous Operation Testing

### Decision: Use `expect.poll()` for Long-Running Operations with Custom Intervals

Implement polling-based testing using Playwright's built-in `expect.poll()` with custom retry intervals for AI processing and API operations.

### Rationale

- **Non-blocking**: Polls periodically instead of blocking the entire timeout
- **Configurable intervals**: Can start with short intervals and back off to longer ones
- **Auto-retry logic**: Built into Playwright, handles transient failures
- **Avoids flakiness**: No hard-coded waits, responds to actual state changes

### Implementation

#### Polling for Trip Processing Status

```typescript
// tests/e2e/trip-processing.spec.ts
import { test, expect } from '@playwright/test';

test('should process trip within 3 minutes', async ({ page, apiContext }) => {
  // Start trip creation
  await page.goto('/');
  await page.fill('[data-testid="trip-name"]', 'AI Generated Trip');
  await page.selectOption('[data-testid="template-select"]', 'test-adventure-001');
  await page.click('[data-testid="start-processing"]');

  // Get trip ID from UI
  const tripId = await page.locator('[data-testid="trip-id"]').textContent();

  // Poll for completion with custom intervals
  await expect.poll(
    async () => {
      const response = await apiContext.get(`/api/trips/${tripId}`);
      const trip = await response.json();
      return trip.status;
    },
    {
      message: 'Trip should complete processing',
      timeout: 3 * 60 * 1000, // 3 minutes max
      intervals: [
        2_000,  // Check after 2s
        5_000,  // Then 5s
        10_000, // Then 10s
        15_000, // Then 15s for remainder
      ],
    }
  ).toMatch(/^(completed|failed)$/); // Accept either completed or failed as "finished"

  // Verify final state
  const response = await apiContext.get(`/api/trips/${tripId}`);
  const trip = await response.json();

  if (trip.status === 'completed') {
    expect(trip.itinerary).toBeTruthy();
    expect(trip.itinerary.days).toBeInstanceOf(Array);
  } else {
    // If failed, check for error message
    expect(trip.error).toBeTruthy();
  }
});
```

#### Testing with Explicit Timeouts

```typescript
// tests/e2e/async-operations.spec.ts
import { test, expect } from '@playwright/test';

test('should update UI when processing completes', async ({ page }) => {
  // Set extended timeout for this specific test
  test.setTimeout(4 * 60 * 1000); // 4 minutes total

  await page.goto('/trips/test-trip-001');
  await page.click('[data-testid="generate-itinerary"]');

  // Wait for processing indicator
  await expect(page.locator('[data-testid="processing-spinner"]')).toBeVisible();

  // Poll for completion indicator with auto-retry
  await expect(page.locator('[data-testid="itinerary-content"]')).toBeVisible({
    timeout: 3 * 60 * 1000, // 3 minutes for processing
  });

  // Verify itinerary was generated
  const dayCards = page.locator('[data-testid="day-card"]');
  await expect(dayCards).toHaveCount.toBeGreaterThan(0);
});
```

#### Custom Async Assertions

```typescript
// tests/utils/async-assertions.ts
import { expect } from '@playwright/test';

/**
 * Poll an API endpoint until it returns expected data
 */
export async function waitForApiCondition<T>(
  fetcher: () => Promise<T>,
  condition: (data: T) => boolean,
  options: {
    timeout?: number;
    intervals?: number[];
    message?: string;
  } = {}
) {
  const {
    timeout = 60_000,
    intervals = [1_000, 2_000, 5_000],
    message = 'Condition should be met',
  } = options;

  await expect.poll(
    async () => {
      const data = await fetcher();
      return condition(data);
    },
    { timeout, intervals, message }
  ).toBeTruthy();
}

// Usage in tests
test('should wait for itinerary generation', async ({ apiContext }) => {
  const tripId = 'test-trip-001';

  await waitForApiCondition(
    async () => {
      const response = await apiContext.get(`/api/trips/${tripId}`);
      return await response.json();
    },
    (trip) => trip.status === 'completed' && trip.itinerary !== null,
    {
      timeout: 3 * 60 * 1000,
      intervals: [2_000, 5_000, 10_000],
      message: 'Trip should have generated itinerary',
    }
  );
});
```

#### Testing Timeout Scenarios

```typescript
// tests/e2e/timeout-handling.spec.ts
import { test, expect } from '@playwright/test';

test('should show timeout error after 3 minutes', async ({ page }) => {
  test.setTimeout(4 * 60 * 1000); // 4 min total

  // Simulate a request that will timeout
  await page.goto('/trips/test-timeout-trip');
  await page.click('[data-testid="generate-itinerary"]');

  // Check that timeout error appears
  await expect(page.locator('[data-testid="timeout-error"]')).toBeVisible({
    timeout: 3.5 * 60 * 1000, // Wait slightly longer than app timeout
  });

  const errorMessage = await page.locator('[data-testid="timeout-error"]').textContent();
  expect(errorMessage).toContain('took longer than expected');
});
```

#### Avoid Anti-Patterns

```typescript
// ❌ BAD: Hard-coded waits
test('bad example - hard coded wait', async ({ page }) => {
  await page.click('[data-testid="submit"]');
  await page.waitForTimeout(60_000); // Don't do this!
  await expect(page.locator('[data-testid="result"]')).toBeVisible();
});

// ✅ GOOD: Poll for actual condition
test('good example - poll for condition', async ({ page }) => {
  await page.click('[data-testid="submit"]');
  await expect(page.locator('[data-testid="result"]')).toBeVisible({
    timeout: 60_000,
  });
});

// ❌ BAD: Multiple small waits
test('bad example - multiple waits', async ({ page }) => {
  for (let i = 0; i < 180; i++) {
    await page.waitForTimeout(1000);
    const status = await page.locator('[data-testid="status"]').textContent();
    if (status === 'completed') break;
  }
});

// ✅ GOOD: Single poll with intervals
test('good example - single poll', async ({ page }) => {
  await expect.poll(
    async () => await page.locator('[data-testid="status"]').textContent(),
    { timeout: 180_000, intervals: [1_000, 5_000, 10_000] }
  ).toBe('completed');
});
```

### Best Practices

1. **Use `expect.poll()` for API polling**: Clean, built-in solution
2. **Configure appropriate intervals**: Start short (2s), back off to longer (15s)
3. **Set realistic timeouts**: Match your SLAs (e.g., 3 min for AI processing)
4. **Test timeout scenarios**: Verify app handles timeouts gracefully
5. **Avoid `waitForTimeout()`**: Use condition-based waiting instead
6. **Use `test.slow()` for slow tests**: Triples timeout automatically

### Alternatives Considered

1. **Hard-coded `waitForTimeout()`**: Makes tests slower and brittle
2. **Custom polling loops**: Reinvents built-in functionality
3. **WebSocket connections**: Adds complexity, not supported in Cloudflare Pages
4. **Server-Sent Events**: Similar complexity to WebSockets

---

## 5. Mobile Responsive Testing

### Decision: Use Device Emulation with Multiple Projects and Custom Viewport Testing

Configure separate Playwright projects for different viewport sizes using device emulation, combined with custom tests for responsive behavior.

### Rationale

- **Accurate emulation**: Playwright simulates userAgent, viewport, deviceScaleFactor, and touch
- **Built-in device library**: Pre-configured for popular devices (iPhone, iPad, Android)
- **Touch interaction testing**: Enables testing of touch-specific features
- **Parallel execution**: Each viewport can run in parallel as separate project

### Implementation

#### Viewport Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'mobile-small',
      use: {
        ...devices['iPhone SE'], // 375x667 viewport
        viewport: { width: 320, height: 568 }, // Override to test minimum
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'mobile-medium',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'tablet',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 768, height: 1024 },
        isMobile: false, // Tablets typically don't use mobile layout
        hasTouch: true,
      },
    },
    {
      name: 'tablet-large',
      use: {
        viewport: { width: 1024, height: 1366 },
        isMobile: false,
        hasTouch: true,
      },
    },
  ],
});
```

#### Testing Touch Target Sizes

```typescript
// tests/e2e/accessibility.spec.ts
import { test, expect } from '@playwright/test';

/**
 * Minimum touch target size per WCAG 2.5.5 (Level AAA)
 */
const MIN_TOUCH_TARGET_SIZE = 44; // pixels

test.describe('Touch Target Sizes', () => {
  test('all buttons should meet 44x44px minimum', async ({ page }) => {
    await page.goto('/');

    // Get all interactive elements
    const buttons = page.locator('button, a, input[type="button"], input[type="submit"], [role="button"]');
    const count = await buttons.count();

    const violations: string[] = [];

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const box = await button.boundingBox();

      if (box) {
        const { width, height } = box;

        // Check if button meets minimum size
        if (width < MIN_TOUCH_TARGET_SIZE || height < MIN_TOUCH_TARGET_SIZE) {
          const text = await button.textContent();
          const label = text?.trim() || await button.getAttribute('aria-label') || 'unlabeled';
          violations.push(
            `Button "${label}" is ${width}x${height}px (minimum: ${MIN_TOUCH_TARGET_SIZE}x${MIN_TOUCH_TARGET_SIZE}px)`
          );
        }
      }
    }

    // Report all violations at once
    expect(violations, `Found ${violations.length} touch target violations:\n${violations.join('\n')}`).toHaveLength(0);
  });

  test('touch targets should have adequate spacing', async ({ page }) => {
    await page.goto('/');

    const buttons = page.locator('button:visible, a:visible');
    const count = await buttons.count();

    const boxes = [];
    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box) boxes.push(box);
    }

    // Check spacing between adjacent buttons (minimum 8px per best practices)
    const MIN_SPACING = 8;
    const violations: string[] = [];

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const box1 = boxes[i];
        const box2 = boxes[j];

        // Calculate distance between boxes
        const horizontalGap = Math.max(0, Math.min(
          Math.abs(box2.x - (box1.x + box1.width)),
          Math.abs(box1.x - (box2.x + box2.width))
        ));
        const verticalGap = Math.max(0, Math.min(
          Math.abs(box2.y - (box1.y + box1.height)),
          Math.abs(box1.y - (box2.y + box2.height))
        ));

        if (horizontalGap < MIN_SPACING && verticalGap < MIN_SPACING) {
          violations.push(`Buttons ${i} and ${j} are too close (gap: ${Math.min(horizontalGap, verticalGap)}px)`);
        }
      }
    }

    expect(violations).toHaveLength(0);
  });
});
```

#### Testing for Horizontal Scrolling

```typescript
// tests/e2e/responsive-layout.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Responsive Layout', () => {
  test('should not have horizontal scrolling on mobile', async ({ page }) => {
    await page.goto('/');

    // Check document-level scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll, 'Page should not have horizontal scroll').toBe(false);
  });

  test('should not have overflowing elements', async ({ page }) => {
    await page.goto('/');

    // Get viewport width
    const viewportSize = page.viewportSize();
    const viewportWidth = viewportSize?.width || 0;

    // Check all visible elements
    const elements = page.locator('body *:visible');
    const count = await elements.count();

    const overflowing: string[] = [];

    for (let i = 0; i < count; i++) {
      const element = elements.nth(i);
      const box = await element.boundingBox();

      if (box) {
        const rightEdge = box.x + box.width;
        if (rightEdge > viewportWidth) {
          const tag = await element.evaluate((el) => el.tagName);
          const className = await element.getAttribute('class');
          overflowing.push(`<${tag} class="${className}"> extends ${rightEdge - viewportWidth}px beyond viewport`);
        }
      }
    }

    expect(overflowing, `Found ${overflowing.length} overflowing elements:\n${overflowing.join('\n')}`).toHaveLength(0);
  });

  test('should adapt layout for different viewports', async ({ page }) => {
    await page.goto('/');

    // Check that navigation menu changes behavior
    const menuButton = page.locator('[data-testid="mobile-menu-button"]');
    const desktopNav = page.locator('[data-testid="desktop-nav"]');

    const viewport = page.viewportSize();

    if (viewport && viewport.width < 768) {
      // Mobile: should have hamburger menu
      await expect(menuButton).toBeVisible();
      await expect(desktopNav).not.toBeVisible();
    } else {
      // Desktop: should have regular nav
      await expect(menuButton).not.toBeVisible();
      await expect(desktopNav).toBeVisible();
    }
  });
});
```

#### Testing Touch Interactions

```typescript
// tests/e2e/touch-interactions.spec.ts
import { test, expect } from '@playwright/test';

// Only run on projects with touch enabled
test.skip(({ isMobile }) => !isMobile, 'Mobile-only test');

test('should support swipe gestures', async ({ page }) => {
  await page.goto('/trips/test-trip-001/itinerary');

  const carousel = page.locator('[data-testid="day-carousel"]');
  await expect(carousel).toBeVisible();

  // Get first day card position
  const firstCard = page.locator('[data-testid="day-card"]').first();
  const initialBox = await firstCard.boundingBox();

  // Perform swipe gesture
  await carousel.hover();
  await page.mouse.down();
  await page.mouse.move(initialBox!.x - 200, initialBox!.y);
  await page.mouse.up();

  // Wait for animation
  await page.waitForTimeout(500);

  // Verify card moved
  const finalBox = await firstCard.boundingBox();
  expect(finalBox!.x).toBeLessThan(initialBox!.x);
});

test('should support tap-to-expand interactions', async ({ page }) => {
  await page.goto('/trips/test-trip-001/itinerary');

  const dayCard = page.locator('[data-testid="day-card"]').first();
  await expect(dayCard).toBeVisible();

  // Tap to expand
  await dayCard.tap();

  // Verify expansion
  const details = page.locator('[data-testid="day-details"]').first();
  await expect(details).toBeVisible();

  // Tap again to collapse
  await dayCard.tap();
  await expect(details).not.toBeVisible();
});
```

#### Dynamic Viewport Testing

```typescript
// tests/e2e/viewport-switching.spec.ts
import { test, expect } from '@playwright/test';

test('should handle viewport resize gracefully', async ({ page }) => {
  // Start at desktop size
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');

  // Verify desktop layout
  await expect(page.locator('[data-testid="desktop-nav"]')).toBeVisible();

  // Resize to tablet
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(300); // Allow CSS transitions

  // Layout should adapt
  await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();

  // Resize to mobile
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(300);

  // Should still be usable
  await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
});
```

### Best Practices

1. **Test at boundary widths**: 320px (minimum), 768px (tablet), 1024px (desktop)
2. **Use device emulation**: Simulates real device characteristics
3. **Test touch interactions**: Use `.tap()` on touch-enabled projects
4. **Check for overflow**: Verify no horizontal scrolling on mobile
5. **Validate touch targets**: Ensure 44x44px minimum size per WCAG
6. **Test orientation changes**: Test both portrait and landscape
7. **Use visual regression testing**: Capture screenshots at each breakpoint

### Alternatives Considered

1. **Real device testing**: Expensive, slower, harder to maintain
2. **BrowserStack/Sauce Labs**: Additional cost, external dependency
3. **Manual testing**: Not automated, doesn't scale
4. **Responsive screenshots only**: Doesn't test interactivity

---

## 6. Performance and Cost Tracking

### Decision: Use Custom Reporter with Performance Timing API and Test Metadata

Implement a custom Playwright reporter that collects performance metrics and operation costs, generating reports without failing tests.

### Rationale

- **Custom reporters** integrate with Playwright's lifecycle hooks
- **Navigation Timing API** provides accurate page load metrics
- **Test metadata** (annotations) can store operation costs
- **Informational metrics** guide optimization without blocking deployment

### Implementation

#### Performance Metrics Fixture

```typescript
// tests/fixtures/performance.ts
import { test as base } from '@playwright/test';

interface PerformanceMetrics {
  navigationStart: number;
  responseEnd: number;
  domContentLoaded: number;
  loadComplete: number;
  duration: number;
}

interface PerformanceFixtures {
  captureMetrics: () => Promise<PerformanceMetrics>;
  trackCost: (operation: string, cost: number) => void;
}

export const test = base.extend<PerformanceFixtures>({
  captureMetrics: async ({ page }, use) => {
    const capture = async (): Promise<PerformanceMetrics> => {
      const metrics = await page.evaluate(() => {
        const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

        return {
          navigationStart: perf.fetchStart,
          responseEnd: perf.responseEnd,
          domContentLoaded: perf.domContentLoadedEventEnd,
          loadComplete: perf.loadEventEnd,
          duration: perf.duration,
        };
      });

      return metrics;
    };

    await use(capture);
  },

  trackCost: async ({}, use, testInfo) => {
    const costs: { operation: string; cost: number }[] = [];

    const track = (operation: string, cost: number) => {
      costs.push({ operation, cost });
      testInfo.annotations.push({
        type: 'cost',
        description: `${operation}: $${cost.toFixed(4)}`,
      });
    };

    await use(track);

    // Attach costs summary to test
    const totalCost = costs.reduce((sum, item) => sum + item.cost, 0);
    testInfo.attachments.push({
      name: 'costs.json',
      contentType: 'application/json',
      body: Buffer.from(JSON.stringify({
        costs,
        total: totalCost,
      }, null, 2)),
    });
  },
});
```

#### Using Performance Fixtures in Tests

```typescript
// tests/e2e/performance.spec.ts
import { test, expect } from '../fixtures/performance';

test('should load home page within performance budget', async ({ page, captureMetrics }) => {
  await page.goto('/');

  const metrics = await captureMetrics();

  // Log metrics without failing test
  console.log('Performance metrics:', metrics);

  // Set performance budgets (soft assertions via console warnings)
  const BUDGETS = {
    responseEnd: 500,      // Server response: 500ms
    domContentLoaded: 1500, // DOM ready: 1.5s
    loadComplete: 3000,     // Full load: 3s
  };

  if (metrics.responseEnd - metrics.navigationStart > BUDGETS.responseEnd) {
    console.warn(`⚠️  Response time ${metrics.responseEnd - metrics.navigationStart}ms exceeds budget of ${BUDGETS.responseEnd}ms`);
  }

  if (metrics.domContentLoaded > BUDGETS.domContentLoaded) {
    console.warn(`⚠️  DOM load ${metrics.domContentLoaded}ms exceeds budget of ${BUDGETS.domContentLoaded}ms`);
  }

  if (metrics.duration > BUDGETS.loadComplete) {
    console.warn(`⚠️  Page load ${metrics.duration}ms exceeds budget of ${BUDGETS.loadComplete}ms`);
  }

  // Test still passes - metrics are informational only
  expect(page.locator('body')).toBeVisible();
});

test('should track AI processing costs', async ({ page, trackCost }) => {
  await page.goto('/');

  // Create trip
  await page.fill('[data-testid="trip-name"]', 'Cost Tracking Test');
  await page.click('[data-testid="start-processing"]');

  const startTime = Date.now();

  // Wait for processing
  await page.locator('[data-testid="itinerary-content"]').waitFor({
    timeout: 3 * 60 * 1000,
  });

  const duration = (Date.now() - startTime) / 1000; // seconds

  // Estimate costs (example: OpenAI GPT-4 pricing)
  const INPUT_COST_PER_1K = 0.03;   // $0.03 per 1K input tokens
  const OUTPUT_COST_PER_1K = 0.06;  // $0.06 per 1K output tokens

  // Rough estimates
  const estimatedInputTokens = 2000;  // Template + user inputs
  const estimatedOutputTokens = 4000; // Generated itinerary

  const inputCost = (estimatedInputTokens / 1000) * INPUT_COST_PER_1K;
  const outputCost = (estimatedOutputTokens / 1000) * OUTPUT_COST_PER_1K;
  const totalCost = inputCost + outputCost;

  // Track costs (will be included in report)
  trackCost('AI Itinerary Generation', totalCost);

  // Log timing
  console.log(`AI processing took ${duration}s (estimated cost: $${totalCost.toFixed(4)})`);

  // Test passes regardless of cost
  await expect(page.locator('[data-testid="itinerary-content"]')).toBeVisible();
});
```

#### Custom Reporter Implementation

```typescript
// tests/reporters/performance-reporter.ts
import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
} from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

interface PerformanceData {
  testName: string;
  project: string;
  status: string;
  duration: number;
  costs: { operation: string; cost: number }[];
  totalCost: number;
}

class PerformanceReporter implements Reporter {
  private data: PerformanceData[] = [];
  private outputDir: string;

  constructor(options: { outputDir?: string } = {}) {
    this.outputDir = options.outputDir || 'test-results/performance';
  }

  onBegin(config: FullConfig, suite: Suite) {
    console.log(`Starting performance tracking for ${suite.allTests().length} tests`);

    // Create output directory
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  onTestEnd(test: TestCase, result: TestResult) {
    // Extract cost data from attachments
    const costsAttachment = result.attachments.find(a => a.name === 'costs.json');
    let costs: { operation: string; cost: number }[] = [];
    let totalCost = 0;

    if (costsAttachment && costsAttachment.body) {
      const costsData = JSON.parse(costsAttachment.body.toString());
      costs = costsData.costs || [];
      totalCost = costsData.total || 0;
    }

    this.data.push({
      testName: test.title,
      project: test.parent.project()?.name || 'unknown',
      status: result.status,
      duration: result.duration,
      costs,
      totalCost,
    });
  }

  onEnd(result: FullResult) {
    // Calculate summary statistics
    const totalTests = this.data.length;
    const totalDuration = this.data.reduce((sum, d) => sum + d.duration, 0);
    const totalCost = this.data.reduce((sum, d) => sum + d.totalCost, 0);
    const avgDuration = totalDuration / totalTests;

    const summary = {
      timestamp: new Date().toISOString(),
      totalTests,
      totalDuration: `${(totalDuration / 1000).toFixed(2)}s`,
      avgDuration: `${(avgDuration / 1000).toFixed(2)}s`,
      totalCost: `$${totalCost.toFixed(4)}`,
      tests: this.data,
    };

    // Write JSON report
    const jsonPath = path.join(this.outputDir, 'performance-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));

    // Write HTML report
    const htmlPath = path.join(this.outputDir, 'performance-report.html');
    fs.writeFileSync(htmlPath, this.generateHTML(summary));

    // Console summary
    console.log('\n=== Performance Summary ===');
    console.log(`Total tests: ${totalTests}`);
    console.log(`Total duration: ${summary.totalDuration}`);
    console.log(`Average duration: ${summary.avgDuration}`);
    console.log(`Total estimated cost: ${summary.totalCost}`);
    console.log(`\nDetailed report: ${htmlPath}`);
  }

  private generateHTML(summary: any): string {
    const rows = summary.tests.map((test: PerformanceData) => `
      <tr>
        <td>${test.testName}</td>
        <td>${test.project}</td>
        <td class="status-${test.status}">${test.status}</td>
        <td>${(test.duration / 1000).toFixed(2)}s</td>
        <td>$${test.totalCost.toFixed(4)}</td>
        <td>${test.costs.map(c => `${c.operation}: $${c.cost.toFixed(4)}`).join('<br>')}</td>
      </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Performance Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .summary-item { margin: 5px 0; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
    .status-passed { color: green; font-weight: bold; }
    .status-failed { color: red; font-weight: bold; }
    .status-skipped { color: orange; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Performance & Cost Report</h1>

  <div class="summary">
    <div class="summary-item"><strong>Generated:</strong> ${summary.timestamp}</div>
    <div class="summary-item"><strong>Total Tests:</strong> ${summary.totalTests}</div>
    <div class="summary-item"><strong>Total Duration:</strong> ${summary.totalDuration}</div>
    <div class="summary-item"><strong>Average Duration:</strong> ${summary.avgDuration}</div>
    <div class="summary-item"><strong>Total Cost:</strong> ${summary.totalCost}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Test Name</th>
        <th>Project</th>
        <th>Status</th>
        <th>Duration</th>
        <th>Cost</th>
        <th>Operations</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>
    `.trim();
  }
}

export default PerformanceReporter;
```

#### Reporter Configuration

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    [path.resolve(__dirname, 'tests/reporters/performance-reporter.ts'), {
      outputDir: 'test-results/performance',
    }],
  ],
});
```

### Best Practices

1. **Use annotations for metadata**: Store costs, timing, and other data
2. **Attach JSON for detailed data**: Use `testInfo.attachments` for structured data
3. **Separate informational from blocking metrics**: Don't fail tests on performance budgets
4. **Generate visual reports**: HTML reports are easier to share with stakeholders
5. **Track trends over time**: Store historical data for regression detection
6. **Measure real user metrics**: Use Navigation Timing API for accurate data

### Alternatives Considered

1. **Lighthouse integration**: Requires separate runs, less integration with test flow
2. **Third-party APM tools**: Additional cost, external dependency
3. **Manual timing with console.log**: Not structured, hard to aggregate
4. **Browser DevTools programmatic API**: More complex, Chromium-only

---

## 7. Concurrent User Testing

### Decision: Use Playwright Workers with Test-Level Parallelization and Data Isolation

Configure Playwright to run tests in parallel using multiple workers, with proper database isolation to prevent race conditions.

### Rationale

- **Default parallelization**: Playwright runs test files in parallel by default
- **Worker isolation**: Each worker gets its own browser and database connection
- **Scalability**: Can simulate 10+ concurrent users easily
- **Safety**: Proper data isolation prevents flaky tests from state collisions

### Implementation

#### Worker Configuration

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import os from 'os';

export default defineConfig({
  // Worker configuration
  workers: process.env.CI ? 2 : Math.floor(os.cpus().length / 2),
  fullyParallel: true, // Run tests within files in parallel too

  // Retry configuration
  retries: process.env.CI ? 2 : 0,

  // Test timeout
  timeout: 30 * 1000, // 30s default per test

  use: {
    // Test options
    trace: 'on-first-retry',
  },
});
```

#### Concurrent Trip Creation Test

```typescript
// tests/e2e/concurrent-users.spec.ts
import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'parallel' }); // Enable parallel execution within this file

test.describe('Concurrent Trip Creation', () => {
  // Create 10 tests that will run in parallel
  for (let i = 1; i <= 10; i++) {
    test(`user ${i} should create trip successfully`, async ({ page, browser }) => {
      // Each test gets unique trip ID to prevent collisions
      const tripId = `test-concurrent-trip-${i}-${Date.now()}`;
      const tripName = `Concurrent User ${i} Trip`;

      await page.goto('/');

      // Fill form with unique data
      await page.fill('[data-testid="trip-id"]', tripId);
      await page.fill('[data-testid="trip-name"]', tripName);
      await page.selectOption('[data-testid="template-select"]', 'test-adventure-001');

      // Submit form
      await page.click('[data-testid="create-trip"]');

      // Verify creation
      await expect(page.locator('[data-testid="trip-created"]')).toBeVisible();

      // Verify trip appears in list
      await page.goto('/trips');
      await expect(page.locator(`[data-testid="trip-${tripId}"]`)).toBeVisible();

      // Verify name is correct
      const displayedName = await page.locator(`[data-testid="trip-${tripId}"] .trip-name`).textContent();
      expect(displayedName).toBe(tripName);
    });
  }
});
```

#### Database Isolation Strategy

```typescript
// tests/fixtures/isolated-data.ts
import { test as base } from '@playwright/test';
import crypto from 'crypto';

interface IsolatedDataFixtures {
  uniqueId: string;
  uniqueTripName: string;
}

export const test = base.extend<IsolatedDataFixtures>({
  // Generate unique ID for each test
  uniqueId: async ({}, use, testInfo) => {
    const id = `test-${testInfo.workerIndex}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    await use(id);
  },

  // Generate unique trip name
  uniqueTripName: async ({ uniqueId }, use) => {
    const name = `Test Trip ${uniqueId}`;
    await use(name);
  },
});

// Usage in tests
test('should handle concurrent updates', async ({ page, uniqueId, uniqueTripName }) => {
  await page.goto('/');
  await page.fill('[data-testid="trip-id"]', uniqueId);
  await page.fill('[data-testid="trip-name"]', uniqueTripName);
  // ... rest of test
});
```

#### Testing Database Concurrency

```typescript
// tests/e2e/database-concurrency.spec.ts
import { test, expect } from '../fixtures/isolated-data';

test.describe.configure({ mode: 'parallel' });

test.describe('Database Concurrency', () => {
  test('should handle concurrent reads without errors', async ({ page, apiContext }) => {
    // Seed data once (in beforeAll)
    const tripId = 'test-shared-trip-001';

    // Simulate multiple concurrent reads
    const reads = Array.from({ length: 20 }, async (_, i) => {
      const response = await apiContext.get(`/api/trips/${tripId}`);
      expect(response.ok()).toBeTruthy();
      return response.json();
    });

    // All reads should succeed
    const results = await Promise.all(reads);
    expect(results).toHaveLength(20);

    // All results should be identical
    const firstResult = JSON.stringify(results[0]);
    results.forEach((result) => {
      expect(JSON.stringify(result)).toBe(firstResult);
    });
  });

  test('should handle concurrent writes with unique data', async ({ apiContext, uniqueId }) => {
    // Create trip
    const response = await apiContext.post('/api/trips', {
      data: {
        id: uniqueId,
        name: `Trip ${uniqueId}`,
        templateId: 'test-adventure-001',
      },
    });

    expect(response.status()).toBe(201);

    // Verify it was created
    const getResponse = await apiContext.get(`/api/trips/${uniqueId}`);
    expect(getResponse.ok()).toBeTruthy();
  });

  test('should prevent duplicate trip IDs', async ({ apiContext, uniqueId }) => {
    // Create trip
    const tripData = {
      id: uniqueId,
      name: `Trip ${uniqueId}`,
      templateId: 'test-adventure-001',
    };

    const response1 = await apiContext.post('/api/trips', { data: tripData });
    expect(response1.status()).toBe(201);

    // Try to create duplicate
    const response2 = await apiContext.post('/api/trips', { data: tripData });
    expect(response2.status()).toBe(409); // Conflict

    const error = await response2.json();
    expect(error.error).toContain('already exists');
  });
});
```

#### Load Testing Pattern

```typescript
// tests/load/concurrent-processing.spec.ts
import { test, expect } from '../fixtures/isolated-data';

test.describe.configure({ mode: 'parallel' });

test.describe('Load Test: 10 Simultaneous Trips', () => {
  const NUM_CONCURRENT_TRIPS = 10;

  for (let i = 1; i <= NUM_CONCURRENT_TRIPS; i++) {
    test(`process trip ${i} of ${NUM_CONCURRENT_TRIPS}`, async ({
      page,
      apiContext,
      uniqueId,
      uniqueTripName
    }) => {
      test.setTimeout(4 * 60 * 1000); // 4 minutes per test

      console.log(`Starting trip ${i} (ID: ${uniqueId})`);

      // Create trip
      const createResponse = await apiContext.post('/api/trips', {
        data: {
          id: uniqueId,
          name: uniqueTripName,
          templateId: 'test-adventure-001',
          budget: 5000,
        },
      });

      expect(createResponse.status()).toBe(201);
      const trip = await createResponse.json();

      // Start processing
      const processResponse = await apiContext.post(`/api/trips/${uniqueId}/process`);
      expect(processResponse.status()).toBe(202); // Accepted

      // Poll for completion
      const startTime = Date.now();

      await expect.poll(
        async () => {
          const response = await apiContext.get(`/api/trips/${uniqueId}`);
          const data = await response.json();
          return data.status;
        },
        {
          timeout: 3 * 60 * 1000, // 3 minutes
          intervals: [2_000, 5_000, 10_000],
          message: `Trip ${i} should complete processing`,
        }
      ).toMatch(/^(completed|failed)$/);

      const duration = (Date.now() - startTime) / 1000;
      console.log(`Trip ${i} completed in ${duration}s`);

      // Verify final state
      const finalResponse = await apiContext.get(`/api/trips/${uniqueId}`);
      const finalTrip = await finalResponse.json();

      expect(['completed', 'failed']).toContain(finalTrip.status);

      if (finalTrip.status === 'completed') {
        expect(finalTrip.itinerary).toBeTruthy();
      }
    });
  }

  // Summary test that runs after all parallel tests
  test.afterAll(async () => {
    console.log(`\nCompleted load test with ${NUM_CONCURRENT_TRIPS} concurrent trips`);
  });
});
```

#### Avoiding Race Conditions

```typescript
// tests/utils/database-locks.ts
import { APIRequestContext } from '@playwright/test';

/**
 * Acquire a distributed lock for testing
 * (Simplified example - production would use Redis or similar)
 */
export async function withLock<T>(
  apiContext: APIRequestContext,
  lockName: string,
  timeout: number,
  fn: () => Promise<T>
): Promise<T> {
  const lockId = `lock-${Date.now()}-${Math.random()}`;

  // Try to acquire lock
  const acquireResponse = await apiContext.post('/api/locks', {
    data: { name: lockName, id: lockId, timeout },
  });

  if (!acquireResponse.ok()) {
    throw new Error(`Failed to acquire lock: ${lockName}`);
  }

  try {
    return await fn();
  } finally {
    // Release lock
    await apiContext.delete(`/api/locks/${lockId}`);
  }
}

// Usage
test('should handle shared resource safely', async ({ apiContext }) => {
  await withLock(apiContext, 'test-templates', 30000, async () => {
    // Only one test can modify templates at a time
    await apiContext.post('/api/templates', { data: { /* ... */ } });
  });
});
```

### Best Practices

1. **Use unique IDs per test**: Prefix with worker index and timestamp
2. **Enable `fullyParallel`**: Maximize parallelization for faster runs
3. **Configure appropriate workers**: Use half of CPU cores locally, 1-2 in CI
4. **Avoid shared mutable state**: Each test should work with its own data
5. **Use project dependencies for setup**: Ensure migrations run before parallel tests
6. **Test with minimum 2 workers**: Validates parallel-safety of tests
7. **Monitor for race conditions**: Look for flaky tests that pass/fail intermittently

### Performance Expectations

```typescript
// Serial execution (1 worker):
// 10 tests × 30s each = 300s (5 minutes)

// Parallel execution (5 workers):
// 10 tests ÷ 5 workers × 30s = 60s (1 minute)
// 80% time reduction!
```

### Alternatives Considered

1. **Artillery/k6 load testing**: Separate tool, doesn't test full UI workflow
2. **Sequential execution only**: Too slow for CI/CD pipelines
3. **Manual data cleanup between tests**: Error-prone, incomplete
4. **Shared test database**: Requires complex locking, slower

---

## Summary and Recommendations

### Recommended Test Structure

```
tests/
├── e2e/                          # End-to-end UI tests
│   ├── trip-creation.spec.ts
│   ├── trip-processing.spec.ts
│   ├── itinerary-display.spec.ts
│   ├── responsive-layout.spec.ts
│   └── accessibility.spec.ts
├── api/                          # API-only tests
│   ├── trips.spec.ts
│   ├── templates.spec.ts
│   ├── error-handling.spec.ts
│   └── cors.spec.ts
├── load/                         # Load and concurrent tests
│   └── concurrent-processing.spec.ts
├── fixtures/                     # Reusable fixtures
│   ├── database.ts
│   ├── api.ts
│   ├── performance.ts
│   └── isolated-data.ts
├── reporters/                    # Custom reporters
│   └── performance-reporter.ts
├── utils/                        # Test utilities
│   ├── async-assertions.ts
│   └── database-locks.ts
├── schemas/                      # JSON schemas for validation
│   ├── trip.schema.json
│   └── template.schema.json
└── global.setup.ts               # Global setup (migrations)
```

### Recommended npm Scripts

```json
{
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui",
    "test:headed": "playwright test --headed",
    "test:api": "playwright test tests/api",
    "test:e2e": "playwright test tests/e2e",
    "test:load": "playwright test tests/load --workers=10",
    "test:mobile": "playwright test --project=mobile-small --project=mobile-medium",
    "test:debug": "playwright test --debug",
    "test:report": "playwright show-report",
    "test:perf-report": "open test-results/performance/performance-report.html"
  }
}
```

### Key Takeaways

1. **Configuration**: Use `webServer` to auto-start wrangler dev with appropriate timeout
2. **Database**: Use project dependencies for migrations, fixtures for test isolation
3. **API Testing**: Use `APIRequestContext` with AJV for schema validation
4. **Async Operations**: Use `expect.poll()` with custom intervals, avoid hard waits
5. **Mobile Testing**: Use device emulation with multiple projects for different viewports
6. **Performance**: Use custom reporters for metrics without failing tests
7. **Concurrency**: Use workers with unique test data to simulate concurrent users

### Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [AJV JSON Schema Validator](https://ajv.js.org/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Web Performance APIs](https://developer.mozilla.org/en-US/docs/Web/API/Performance)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-09
**Research Date**: October 2024 - January 2025
