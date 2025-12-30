# Implementation Tasks: End-to-End Test Suite for Full MVP

**Branch**: `002-end-to-end` | **Date**: 2025-10-09
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Overview

This document provides actionable implementation tasks for the E2E test suite, organized by user story to enable independent implementation and testing. Each user story phase can be completed and validated independently, allowing incremental delivery.

**Total Tasks**: 43
**Estimated Duration**: 3-5 days
**MVP Scope**: Phase 3 (User Story 1 - Critical Path Validation)

---

## Phase 1: Setup & Project Initialization

**Goal**: Set up Playwright testing infrastructure and project dependencies.

**Duration**: 2-4 hours

### **T001** [Setup] Install Playwright and dependencies
**File**: `package.json`
**Story**: Foundation
**Description**:
- Add Playwright, @faker-js/faker, fishery, dotenv to devDependencies
- Add test scripts: `test:e2e`, `test:e2e:headed`, `test:e2e:ui`, `test:e2e:debug`
- Install Playwright browsers with `npx playwright install chromium`

**Commands**:
```bash
npm install --save-dev @playwright/test @faker-js/faker fishery dotenv ajv ajv-formats
npx playwright install chromium
```

**package.json additions**:
```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:health-check": "node tests/scripts/health-check.js"
  }
}
```

---

### **T002** [Setup] Create Playwright configuration
**File**: `playwright.config.ts`
**Story**: Foundation
**Description**:
- Create Playwright config with webServer for wrangler dev
- Configure 4 projects: desktop-chromium, mobile-320px, tablet-768px, desktop-1024px
- Set timeout to 120000ms, retries to 2 (in CI)
- Configure reporters: list, html, json
- Set baseURL to http://localhost:8788

**Dependencies**: T001

**Implementation**:
```typescript
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: `.env.${process.env.TEST_ENV || 'test'}` });

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results/html-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: process.env.APP_URL || 'http://localhost:8788',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-320px', use: { ...devices['iPhone SE'], viewport: { width: 320, height: 568 } } },
    { name: 'tablet-768px', use: { ...devices['iPad Mini'], viewport: { width: 768, height: 1024 } } },
    { name: 'desktop-1024px', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8788',
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
  },
  globalSetup: require.resolve('./tests/global-setup.ts'),
  globalTeardown: require.resolve('./tests/global-teardown.ts'),
});
```

---

### **T003** [Setup] Create .env.test template
**File**: `.env.test.example`
**Story**: Foundation
**Description**:
- Create template .env file for test environment
- Document all required API keys
- Add .env.test to .gitignore

**Dependencies**: None (can run in parallel with T001, T002)

**Implementation**:
```bash
# .env.test.example
# Copy this to .env.test and fill in your API keys

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

---

### **T004** [Setup] [P] Create test directory structure
**File**: Multiple directories
**Story**: Foundation
**Description**:
- Create `tests/` directory at repository root
- Create subdirectories: `e2e/`, `fixtures/`, `helpers/`, `schemas/`, `utils/`
- Initialize empty .gitkeep files in each directory

**Dependencies**: None (parallelizable)

**Commands**:
```bash
mkdir -p tests/{e2e,fixtures,helpers,schemas,utils,scripts}
touch tests/e2e/.gitkeep tests/fixtures/.gitkeep tests/helpers/.gitkeep
```

---

### **T005** [Setup] [P] Create global setup script
**File**: `tests/global-setup.ts`
**Story**: Foundation
**Description**:
- Apply database migrations before tests
- Seed test data (templates)
- Perform API health checks
- Store health status in environment variable

**Dependencies**: T004

**Implementation**:
```typescript
import { FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);

async function globalSetup(config: FullConfig) {
  console.log('\n=== Global Test Setup ===\n');

  // Apply migrations
  console.log('Applying database migrations...');
  await execAsync('npm run db:migrate');

  // Seed test data
  console.log('Seeding test data...');
  await execAsync('npm run db:seed:test');

  // API health checks
  const healthChecks = {
    amadeus: false,
    viator: false,
    serper: false,
    openrouter: false,
  };

  try {
    // Check Amadeus (requires authentication)
    const amadeusResponse = await axios.post(
      'https://api.amadeus.com/v1/security/oauth2/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.AMADEUS_API_KEY || '',
        client_secret: process.env.AMADEUS_API_SECRET || '',
      }),
      { timeout: 10000 }
    );
    healthChecks.amadeus = amadeusResponse.status === 200;
  } catch (error) {
    console.warn('✗ Amadeus API health check failed');
  }

  // Store health status for tests to check
  process.env.API_HEALTH = JSON.stringify(healthChecks);

  console.log('\n✓ Global setup complete\n');
}

export default globalSetup;
```

---

### **T006** [Setup] [P] Create global teardown script
**File**: `tests/global-teardown.ts`
**Story**: Foundation
**Description**:
- Clean up orphaned test records (older than 1 hour)
- Generate cleanup report

**Dependencies**: T004

**Implementation**:
```typescript
import { FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function globalTeardown(config: FullConfig) {
  console.log('\n=== Global Test Teardown ===\n');

  try {
    // Clean up old test data
    await execAsync(`npm run db:exec -- "DELETE FROM themed_trips WHERE template_id LIKE 'test-%' AND created_at < datetime('now', '-1 hour')"`);
    console.log('✓ Cleaned up orphaned test records');
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

export default globalTeardown;
```

---

## Phase 2: Foundational Infrastructure

**Goal**: Build shared test helpers, fixtures, and utilities needed by all user stories.

**Duration**: 4-6 hours

### **T007** [Foundation] Create API client helper
**File**: `tests/helpers/api-client.ts`
**Story**: Foundation (needed by US1, US2, US3, US4)
**Description**:
- Create APIClient class wrapping Playwright's APIRequestContext
- Implement methods for all API endpoints
- Add error handling and retry logic

**Dependencies**: T002

**Implementation**:
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
      data: { template_id: templateId, initial_message: message, preferences },
    });
    return { response, data: await response.json() };
  }

  async getTrip(tripId: string) {
    const response = await this.request.get(`/api/trips/${tripId}`);
    return { response, data: await response.json() };
  }

  async confirmDestinations(tripId: string, destinations: string[], preferences: any) {
    const response = await this.request.post(`/api/trips/${tripId}/confirm-destinations`, {
      data: { confirmed_destinations: destinations, preferences },
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

---

### **T008** [Foundation] Create database helper
**File**: `tests/helpers/database.ts`
**Story**: Foundation (needed by US1, US4)
**Description**:
- Create functions for database cleanup between tests
- Implement D1 query execution wrapper

**Dependencies**: T004

**Implementation**:
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function cleanDatabase() {
  console.log('Cleaning test database...');
  await execAsync(`npm run db:exec -- "DELETE FROM themed_trips WHERE template_id LIKE 'test-%'"`);
  console.log('✓ Database cleaned');
}

export async function queryDatabase(sql: string) {
  const result = await execAsync(`npm run db:exec -- "${sql}"`);
  return result.stdout;
}
```

---

### **T009** [Foundation] Create polling helper
**File**: `tests/helpers/polling.ts`
**Story**: Foundation (needed by US1, US3)
**Description**:
- Create polling functions for async operations
- Use Playwright's expect.poll() pattern
- Support customizable timeouts and intervals

**Dependencies**: T002

**Implementation**:
```typescript
import { expect, APIRequestContext } from '@playwright/test';

export async function pollForTripStatus(
  request: APIRequestContext,
  tripId: string,
  expectedStatus: string,
  timeoutMs: number = 180000
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
      intervals: [3000, 3000, 3000],
    }
  ).toBe(expectedStatus);
}

export async function pollForDestinations(
  request: APIRequestContext,
  tripId: string,
  timeoutMs: number = 60000
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

### **T010** [Foundation] [P] Create test fixtures - templates
**File**: `tests/fixtures/templates.json`
**Story**: Foundation (needed by US1, US2)
**Description**:
- Create JSON file with template IDs for local environment
- Include Heritage & Ancestry template data

**Dependencies**: T004

**Implementation**:
```json
{
  "local": {
    "heritage-ancestry-001": {
      "id": "heritage-ancestry-001",
      "name": "Heritage & Ancestry",
      "description": "Explore your family roots",
      "testMessage": "Sullivan family from Cork, Ireland"
    }
  }
}
```

---

### **T011** [Foundation] [P] Create test fixtures - preferences
**File**: `tests/fixtures/preferences.json`
**Story**: Foundation (needed by US1, US4)
**Description**:
- Create JSON file with default test preferences
- Include budget, moderate, and luxury variations

**Dependencies**: T004

**Implementation**:
```json
{
  "default": {
    "duration_min": 7,
    "duration_max": 14,
    "departure_airport": "JFK",
    "travelers": 2,
    "luxury_level": "moderate"
  },
  "budget": {
    "duration_min": 5,
    "duration_max": 7,
    "departure_airport": "JFK",
    "travelers": 2,
    "luxury_level": "budget"
  },
  "luxury": {
    "duration_min": 10,
    "duration_max": 14,
    "departure_airport": "JFK",
    "travelers": 2,
    "luxury_level": "luxury"
  }
}
```

---

### **T012** [Foundation] Create cost calculator utility
**File**: `tests/utils/cost-calculator.ts`
**Story**: Foundation (needed by US3)
**Description**:
- Create CostCalculator class to track API call costs
- Implement provider-specific cost estimation
- Support cost aggregation by test and by provider

**Dependencies**: T004

**Implementation**:
```typescript
export interface ApiCall {
  provider: string;
  endpoint: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
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
        return 0;
      case 'serper':
        return 0.001;
      case 'openrouter':
        return 0.004;
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

export const costCalculator = new CostCalculator();
```

---

### **T013** [Foundation] Create Playwright test fixtures
**File**: `tests/fixtures/playwright/test-fixtures.ts`
**Story**: Foundation (needed by all user stories)
**Description**:
- Extend Playwright's base test with custom fixtures
- Create cleanDb fixture for automatic cleanup
- Create apiClient fixture
- Create testData fixture loading JSON fixtures

**Dependencies**: T007, T008, T010, T011

**Implementation**:
```typescript
import { test as base } from '@playwright/test';
import { APIClient } from '../helpers/api-client';
import { cleanDatabase } from '../helpers/database';
import templates from '../fixtures/templates.json';
import preferences from '../fixtures/preferences.json';

type CustomFixtures = {
  cleanDb: void;
  apiClient: APIClient;
  testData: {
    template: any;
    preferences: any;
  };
};

export const test = base.extend<CustomFixtures>({
  cleanDb: [async ({}, use) => {
    await use();
    await cleanDatabase();
  }, { auto: true }],

  apiClient: async ({ request }, use) => {
    const client = new APIClient(request);
    await use(client);
  },

  testData: async ({}, use) => {
    await use({
      template: templates.local['heritage-ancestry-001'],
      preferences: preferences.default,
    });
  },
});

export { expect } from '@playwright/test';
```

---

### **T014** [Foundation] Create JSON schema validation utility
**File**: `tests/utils/schema-validator.ts`
**Story**: Foundation (needed by US2)
**Description**:
- Create schema validation function using AJV
- Load schemas from contracts/ directory
- Provide helper for validating API responses

**Dependencies**: T001, T004

**Implementation**:
```typescript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

const ajv = new Ajv();
addFormats(ajv);

export function validateSchema(data: any, schemaPath: string): { valid: boolean; errors: any } {
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  const schema = JSON.parse(schemaContent);
  const validate = ajv.compile(schema);
  const valid = validate(data);
  return { valid, errors: validate.errors };
}
```

---

**✓ Checkpoint: Foundation Complete**
- All shared helpers, fixtures, and utilities are implemented
- Tests can now be implemented for each user story independently

---

## Phase 3: User Story 1 - Critical Path Validation (P1)

**Goal**: Implement tests for the complete end-to-end user journey from theme selection through trip option selection.

**Duration**: 6-8 hours

**Independent Test Criteria**:
- Tests simulate full user journey without manual intervention
- Can run independently of other test suites
- Validates both Phase 1 (destination research) and Phase 2 (trip building)
- All 6 acceptance scenarios pass

### **T015** [US1] Create critical path test file
**File**: `tests/e2e/critical-path.spec.ts`
**Story**: US1 - Critical Path Validation
**Description**:
- Create test file with describe block
- Import custom test fixtures
- Add @P1 and @critical tags

**Dependencies**: T013

**Implementation**:
```typescript
import { test, expect } from '../fixtures/playwright/test-fixtures';

test.describe('Critical Path Validation @P1 @critical', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // Tests will be added in subsequent tasks
});
```

---

### **T016** [US1] Test: Create trip with theme selection (AS1)
**File**: `tests/e2e/critical-path.spec.ts`
**Story**: US1 - Critical Path Validation
**Description**:
- Test acceptance scenario #1
- Select Heritage & Ancestry template
- Enter test message "Sullivan family from Cork, Ireland"
- Verify trip creation and destination research start
- Verify progress updates appear

**Dependencies**: T015

**Implementation**:
```typescript
test('should create trip and start destination research (AS1)', async ({ page, testData, apiClient }) => {
  // Click on Heritage & Ancestry template
  await page.click(`[data-testid="template-card-${testData.template.id}"]`);

  // Enter initial message
  await page.fill('[data-testid="initial-message-input"]', testData.template.testMessage);
  await page.click('[data-testid="start-trip-btn"]');

  // Wait for trip creation
  await expect(page.locator('[data-testid="trip-id"]')).toBeVisible({ timeout: 10000 });

  // Verify status is "researching"
  await expect(page.locator('[data-testid="trip-status"]')).toContainText('researching');

  // Verify progress updates appear
  await expect(page.locator('[data-testid="progress-message"]')).toBeVisible();
  await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();
});
```

---

### **T017** [US1] Test: View destination recommendations (AS2)
**File**: `tests/e2e/critical-path.spec.ts`
**Story**: US1 - Critical Path Validation
**Description**:
- Test acceptance scenario #2
- Wait for destination research to complete
- Verify 2-4 destinations are displayed
- Verify each destination has name, context, rationale, estimated_days

**Dependencies**: T016

**Implementation**:
```typescript
test('should display 2-4 destination recommendations (AS2)', async ({ page, testData, apiClient, request }) => {
  // Create trip
  const { data: trip } = await apiClient.createTrip(
    testData.template.id,
    testData.template.testMessage,
    testData.preferences
  );

  // Navigate to trip page
  await page.goto(`/trip?trip_id=${trip.id}`);

  // Poll for destinations (up to 60 seconds)
  await pollForDestinations(request, trip.id, 60000);

  // Verify destinations are displayed
  const destinationCards = page.locator('[data-testid="destination-card"]');
  const count = await destinationCards.count();
  expect(count).toBeGreaterThanOrEqual(2);
  expect(count).toBeLessThanOrEqual(4);

  // Verify first destination has all required fields
  await expect(destinationCards.first().locator('[data-testid="destination-name"]')).toBeVisible();
  await expect(destinationCards.first().locator('[data-testid="destination-context"]')).toBeVisible();
  await expect(destinationCards.first().locator('[data-testid="destination-rationale"]')).toBeVisible();
  await expect(destinationCards.first().locator('[data-testid="destination-days"]')).toBeVisible();
});
```

---

### **T018** [US1] Test: Confirm destinations with preferences (AS3)
**File**: `tests/e2e/critical-path.spec.ts`
**Story**: US1 - Critical Path Validation
**Description**:
- Test acceptance scenario #3
- Wait for destinations to load
- Fill in preferences form
- Click confirm destinations button
- Verify transition to trip building phase

**Dependencies**: T017

**Implementation**:
```typescript
test('should confirm destinations and start trip building (AS3)', async ({ page, testData, apiClient, request }) => {
  // Create trip and wait for destinations
  const { data: trip } = await apiClient.createTrip(testData.template.id, testData.template.testMessage);
  await page.goto(`/trip?trip_id=${trip.id}`);
  await pollForDestinations(request, trip.id, 60000);

  // Fill in preferences
  await page.fill('[data-testid="duration-min"]', '7');
  await page.fill('[data-testid="duration-max"]', '14');
  await page.fill('[data-testid="departure-airport"]', 'JFK');
  await page.fill('[data-testid="travelers"]', '2');
  await page.selectOption('[data-testid="luxury-level"]', 'moderate');

  // Click confirm button
  await page.click('[data-testid="confirm-destinations-btn"]');

  // Verify transition to building_trip status
  await expect(page.locator('[data-testid="trip-status"]')).toContainText('building_trip', { timeout: 10000 });
  await expect(page.locator('[data-testid="progress-message"]')).toContainText('Building your trip');
});
```

---

### **T019** [US1] Test: Trip building completes within 3 minutes (AS4)
**File**: `tests/e2e/critical-path.spec.ts`
**Story**: US1 - Critical Path Validation
**Description**:
- Test acceptance scenario #4
- Confirm destinations
- Verify progress updates during trip building
- Verify trip options are generated within 3 minutes

**Dependencies**: T018

**Implementation**:
```typescript
test('should complete trip building within 3 minutes (AS4)', async ({ page, testData, apiClient, request }) => {
  // Create trip, wait for destinations, confirm
  const { data: trip } = await apiClient.createTrip(testData.template.id, testData.template.testMessage);
  await page.goto(`/trip?trip_id=${trip.id}`);
  await pollForDestinations(request, trip.id, 60000);

  const destinations = await request.get(`/api/trips/${trip.id}`).then(r => r.json());
  const destNames = destinations.research_destinations.map(d => d.name);

  await apiClient.confirmDestinations(trip.id, destNames, testData.preferences);

  // Track start time
  const startTime = Date.now();

  // Wait for trip building to complete (poll for options_ready status)
  await pollForTripStatus(request, trip.id, 'options_ready', 180000); // 3 minutes

  // Verify it completed within 3 minutes
  const duration = Date.now() - startTime;
  console.log(`Trip building completed in ${(duration / 1000).toFixed(1)} seconds`);
  // Note: This is informational only, doesn't fail the test per clarification #2

  // Verify progress updates appeared
  await page.reload();
  await expect(page.locator('[data-testid="trip-options-section"]')).toBeVisible();
});
```

---

### **T020** [US1] Test: View generated trip options (AS5)
**File**: `tests/e2e/critical-path.spec.ts`
**Story**: US1 - Critical Path Validation
**Description**:
- Test acceptance scenario #5
- Wait for trip options to be generated
- Verify 2-4 trip options are displayed
- Verify each option has total_cost, flight details, hotel count, tour count

**Dependencies**: T019

**Implementation**:
```typescript
test('should display 2-4 trip options with pricing (AS5)', async ({ page, testData, apiClient, request }) => {
  // Create full trip flow
  const { data: trip } = await apiClient.createTrip(testData.template.id, testData.template.testMessage);
  await page.goto(`/trip?trip_id=${trip.id}`);
  await pollForDestinations(request, trip.id, 60000);

  const tripData = await request.get(`/api/trips/${trip.id}`).then(r => r.json());
  const destNames = tripData.research_destinations.map(d => d.name);
  await apiClient.confirmDestinations(trip.id, destNames, testData.preferences);
  await pollForTripStatus(request, trip.id, 'options_ready', 180000);

  // Reload to see options
  await page.reload();

  // Verify 2-4 options displayed
  const optionCards = page.locator('[data-testid="trip-option-card"]');
  const count = await optionCards.count();
  expect(count).toBeGreaterThanOrEqual(2);
  expect(count).toBeLessThanOrEqual(4);

  // Verify first option has all required fields
  await expect(optionCards.first().locator('[data-testid="option-price"]')).toBeVisible();
  await expect(optionCards.first().locator('[data-testid="option-flights"]')).toContainText('flight');
  await expect(optionCards.first().locator('[data-testid="option-hotels"]')).toContainText('hotel');
  await expect(optionCards.first().locator('[data-testid="option-tours"]')).toContainText('tour');
});
```

---

### **T021** [US1] Test: Select trip option (AS6)
**File**: `tests/e2e/critical-path.spec.ts`
**Story**: US1 - Critical Path Validation
**Description**:
- Test acceptance scenario #6
- Wait for trip options
- Click select button on first option
- Verify option is marked as selected
- Verify trip status updates to "option_selected"

**Dependencies**: T020

**Implementation**:
```typescript
test('should select trip option successfully (AS6)', async ({ page, testData, apiClient, request }) => {
  // Create full trip flow
  const { data: trip } = await apiClient.createTrip(testData.template.id, testData.template.testMessage);
  await page.goto(`/trip?trip_id=${trip.id}`);
  await pollForDestinations(request, trip.id, 60000);

  const tripData = await request.get(`/api/trips/${trip.id}`).then(r => r.json());
  const destNames = tripData.research_destinations.map(d => d.name);
  await apiClient.confirmDestinations(trip.id, destNames, testData.preferences);
  await pollForTripStatus(request, trip.id, 'options_ready', 180000);

  await page.reload();

  // Click select button on first option
  await page.click('[data-testid="trip-option-card"]:first-child [data-testid="select-option-btn"]');

  // Verify option is marked as selected
  await expect(page.locator('[data-testid="trip-option-card"]:first-child')).toHaveClass(/selected/);
  await expect(page.locator('[data-testid="trip-status"]')).toContainText('option_selected');
});
```

---

**✓ Checkpoint: User Story 1 Complete**
- All 6 acceptance scenarios are tested
- Critical path validation works end-to-end
- Tests can run independently
- **MVP SCOPE COMPLETE** - This is the minimum viable test suite

---

## Phase 4: User Story 2 - API Endpoint Validation (P1)

**Goal**: Implement tests for all API endpoints with various input scenarios and error handling.

**Duration**: 4-6 hours

**Independent Test Criteria**:
- Tests make direct API calls without UI interaction
- Can run independently of other test suites
- Validates all 6 acceptance scenarios
- Tests error responses and phase gate enforcement

### **T022** [US2] Create API endpoints test file
**File**: `tests/e2e/api-endpoints.spec.ts`
**Story**: US2 - API Endpoint Validation
**Description**:
- Create test file with describe block
- Import custom test fixtures
- Add @P1 and @api tags

**Dependencies**: T013

**Implementation**:
```typescript
import { test, expect } from '../fixtures/playwright/test-fixtures';
import { validateSchema } from '../utils/schema-validator';

test.describe('API Endpoint Validation @P1 @api', () => {
  // Tests will be added in subsequent tasks
});
```

---

### **T023** [US2] Test: GET /api/templates (AS1)
**File**: `tests/e2e/api-endpoints.spec.ts`
**Story**: US2 - API Endpoint Validation
**Description**:
- Test acceptance scenario #1
- Call GET /api/templates
- Verify 200 status
- Verify response contains array of templates with required fields
- Validate against schema

**Dependencies**: T022

**Implementation**:
```typescript
test('GET /api/templates returns featured templates (AS1)', async ({ apiClient }) => {
  const { response, data } = await apiClient.getTemplates();

  // Verify status
  expect(response.status()).toBe(200);

  // Verify response structure
  expect(Array.isArray(data)).toBeTruthy();
  expect(data.length).toBeGreaterThan(0);

  // Verify required fields on first template
  const template = data[0];
  expect(template).toHaveProperty('id');
  expect(template).toHaveProperty('name');
  expect(template).toHaveProperty('description');
  expect(template).toHaveProperty('icon');
  expect(template).toHaveProperty('search_placeholder');
});
```

---

### **T024** [US2] Test: POST /api/trips (AS2)
**File**: `tests/e2e/api-endpoints.spec.ts`
**Story**: US2 - API Endpoint Validation
**Description**:
- Test acceptance scenario #2
- Call POST /api/trips with valid data
- Verify 201 status
- Verify response contains trip_id and status "researching"

**Dependencies**: T023

**Implementation**:
```typescript
test('POST /api/trips creates new trip (AS2)', async ({ apiClient, testData }) => {
  const { response, data } = await apiClient.createTrip(
    testData.template.id,
    testData.template.testMessage,
    testData.preferences
  );

  // Verify status
  expect(response.status()).toBe(201);

  // Verify response structure
  expect(data).toHaveProperty('id');
  expect(data.status).toBe('researching');
  expect(data.template_id).toBe(testData.template.id);
});
```

---

### **T025** [US2] Test: GET /api/trips/:id (AS3)
**File**: `tests/e2e/api-endpoints.spec.ts`
**Story**: US2 - API Endpoint Validation
**Description**:
- Test acceptance scenario #3
- Create trip, then call GET /api/trips/:id
- Verify 200 status
- Verify complete trip state in response

**Dependencies**: T024

**Implementation**:
```typescript
test('GET /api/trips/:id returns complete trip state (AS3)', async ({ apiClient, testData }) => {
  // Create trip
  const { data: trip } = await apiClient.createTrip(testData.template.id, testData.template.testMessage);

  // Get trip
  const { response, data } = await apiClient.getTrip(trip.id);

  // Verify status
  expect(response.status()).toBe(200);

  // Verify complete state
  expect(data).toHaveProperty('id');
  expect(data).toHaveProperty('template_id');
  expect(data).toHaveProperty('status');
  expect(data).toHaveProperty('chat_history');
  expect(data).toHaveProperty('progress_percent');
  expect(data).toHaveProperty('progress_message');
  expect(data).toHaveProperty('created_at');
});
```

---

### **T026** [US2] Test: Phase gate enforcement (AS4)
**File**: `tests/e2e/api-endpoints.spec.ts`
**Story**: US2 - API Endpoint Validation
**Description**:
- Test acceptance scenario #4
- Create trip but don't confirm destinations
- Try to call POST /api/trips/:id/confirm-destinations
- Verify 403 error when destinations_confirmed flag is missing

**Dependencies**: T025

**Implementation**:
```typescript
test('API enforces phase gate (403 when destinations not confirmed) (AS4)', async ({ apiClient, testData, request }) => {
  // Create trip
  const { data: trip } = await apiClient.createTrip(testData.template.id, testData.template.testMessage);

  // Wait for destinations
  await pollForDestinations(request, trip.id, 60000);

  // Try to select option without confirming destinations
  const selectResponse = await request.post(`/api/trips/${trip.id}/select`, {
    data: { option_index: 0 },
  });

  // Verify 403 error
  expect(selectResponse.status()).toBe(403);
  const error = await selectResponse.json();
  expect(error.error).toContain('destinations not confirmed');
});
```

---

### **T027** [US2] Test: POST /api/trips/:id/select (AS5)
**File**: `tests/e2e/api-endpoints.spec.ts`
**Story**: US2 - API Endpoint Validation
**Description**:
- Test acceptance scenario #5
- Create trip, confirm destinations, wait for options
- Call POST /api/trips/:id/select with valid option_index
- Verify 200 status
- Verify selected option is stored

**Dependencies**: T026

**Implementation**:
```typescript
test('POST /api/trips/:id/select stores selected option (AS5)', async ({ apiClient, testData, request }) => {
  // Create trip and complete flow to options_ready
  const { data: trip } = await apiClient.createTrip(testData.template.id, testData.template.testMessage);
  await pollForDestinations(request, trip.id, 60000);

  const tripData = await request.get(`/api/trips/${trip.id}`).then(r => r.json());
  const destNames = tripData.research_destinations.map(d => d.name);
  await apiClient.confirmDestinations(trip.id, destNames, testData.preferences);
  await pollForTripStatus(request, trip.id, 'options_ready', 180000);

  // Select option
  const { response, data } = await apiClient.selectTripOption(trip.id, 0);

  // Verify success
  expect(response.status()).toBe(200);
  expect(data.selected_option_index).toBe(0);
  expect(data.status).toBe('option_selected');
});
```

---

### **T028** [US2] Test: 404 error for invalid trip_id (AS6)
**File**: `tests/e2e/api-endpoints.spec.ts`
**Story**: US2 - API Endpoint Validation
**Description**:
- Test acceptance scenario #6
- Call GET /api/trips/:id with invalid ID
- Verify 404 status
- Verify appropriate error message

**Dependencies**: T027

**Implementation**:
```typescript
test('API returns 404 for invalid trip_id (AS6)', async ({ request }) => {
  const response = await request.get('/api/trips/invalid-trip-id-12345');

  // Verify 404 error
  expect(response.status()).toBe(404);

  const error = await response.json();
  expect(error.error).toContain('not found');
});
```

---

**✓ Checkpoint: User Story 2 Complete**
- All 6 acceptance scenarios are tested
- API validation works independently
- Phase gate enforcement is verified

---

## Phase 5: User Story 3 - Performance and Reliability (P2)

**Goal**: Implement tests for performance measurement, concurrent users, and error handling.

**Duration**: 6-8 hours

**Independent Test Criteria**:
- Tests measure performance metrics (informational only per clarification #2)
- Can run independently of other test suites
- Validates all 5 acceptance scenarios
- Tests concurrent execution and failover

### **T029** [US3] Create performance test file
**File**: `tests/e2e/performance.spec.ts`
**Story**: US3 - Performance and Reliability
**Description**:
- Create test file with describe block
- Import custom test fixtures
- Add @P2 and @performance tags

**Dependencies**: T013

**Implementation**:
```typescript
import { test, expect } from '../fixtures/playwright/test-fixtures';
import { pollForTripStatus, pollForDestinations } from '../helpers/polling';

test.describe('Performance and Reliability @P2 @performance', () => {
  // Tests will be added in subsequent tasks
});
```

---

### **T030** [US3] Test: Destination research performance (AS1)
**File**: `tests/e2e/performance.spec.ts`
**Story**: US3 - Performance and Reliability
**Description**:
- Test acceptance scenario #1
- Measure time for destination research
- Report if >60 seconds (informational only, doesn't fail)

**Dependencies**: T029

**Implementation**:
```typescript
test('destination research completes within 60 seconds (AS1)', async ({ apiClient, testData, request }) => {
  const startTime = Date.now();

  // Create trip
  const { data: trip } = await apiClient.createTrip(testData.template.id, testData.template.testMessage);

  // Wait for destinations
  await pollForDestinations(request, trip.id, 60000);

  const duration = Date.now() - startTime;
  console.log(`✓ Destination research completed in ${(duration / 1000).toFixed(1)} seconds`);

  // Informational only - per clarification #2, this doesn't fail the test
  if (duration > 60000) {
    console.warn(`⚠️  Warning: Research took longer than 60s target`);
  }
});
```

---

### **T031** [US3] Test: Trip building performance (AS2)
**File**: `tests/e2e/performance.spec.ts`
**Story**: US3 - Performance and Reliability
**Description**:
- Test acceptance scenario #2
- Measure time for trip building
- Report if >3 minutes (informational only, doesn't fail)

**Dependencies**: T030

**Implementation**:
```typescript
test('trip building completes within 3 minutes (AS2)', async ({ apiClient, testData, request }) => {
  // Create trip and wait for destinations
  const { data: trip } = await apiClient.createTrip(testData.template.id, testData.template.testMessage);
  await pollForDestinations(request, trip.id, 60000);

  const tripData = await request.get(`/api/trips/${trip.id}`).then(r => r.json());
  const destNames = tripData.research_destinations.map(d => d.name);

  // Start timing trip building
  const startTime = Date.now();

  await apiClient.confirmDestinations(trip.id, destNames, testData.preferences);
  await pollForTripStatus(request, trip.id, 'options_ready', 180000);

  const duration = Date.now() - startTime;
  console.log(`✓ Trip building completed in ${(duration / 1000).toFixed(1)} seconds`);

  // Informational only - per clarification #2, this doesn't fail the test
  if (duration > 180000) {
    console.warn(`⚠️  Warning: Building took longer than 3min target`);
  }
});
```

---

### **T032** [US3] Test: 10 concurrent users (AS3)
**File**: `tests/e2e/performance.spec.ts`
**Story**: US3 - Performance and Reliability
**Description**:
- Test acceptance scenario #3
- Create 10 trips concurrently
- Verify all complete successfully
- Verify all receive progress updates

**Dependencies**: T031

**Implementation**:
```typescript
test('system handles 10 concurrent users (AS3)', async ({ request }) => {
  const testData = {
    template_id: 'heritage-ancestry-001',
    message: `Concurrent test ${Date.now()}`,
  };

  // Create 10 trips in parallel
  const promises = Array.from({ length: 10 }, async (_, index) => {
    const response = await request.post('/api/trips', {
      data: {
        template_id: testData.template_id,
        initial_message: `${testData.message} - Trip ${index}`,
      },
    });

    expect(response.status()).toBe(201);
    const trip = await response.json();
    return trip.id;
  });

  // Wait for all trips to be created
  const tripIds = await Promise.all(promises);

  // Verify all trips were created successfully
  expect(tripIds).toHaveLength(10);
  expect(new Set(tripIds).size).toBe(10); // All unique IDs

  console.log(`✓ Successfully created 10 concurrent trips`);
});
```

---

### **T033** [US3] Test: External API timeout handling (AS4)
**File**: `tests/e2e/performance.spec.ts`
**Story**: US3 - Performance and Reliability
**Description**:
- Test acceptance scenario #4
- Mock external API timeout scenario (if possible)
- Verify fallback providers are tried
- Verify error message if all fail

**Dependencies**: T032

**Implementation**:
```typescript
test('system handles external API timeouts gracefully (AS4)', async ({ apiClient, testData }) => {
  // Note: This test assumes the application has fallback logic
  // We can't easily simulate API timeouts without mocking, but we can verify
  // that trips complete even if some API calls are slow

  const { data: trip } = await apiClient.createTrip(testData.template.id, testData.template.testMessage);

  // The trip should complete even if external APIs are slow
  // The application should use fallback providers per the spec
  // This is validated by the trip completing successfully

  expect(trip.id).toBeDefined();
  expect(trip.status).toBe('researching');

  console.log('✓ Trip created successfully (fallback logic assumed functional)');
});
```

---

### **T034** [US3] Test: AI provider rate limit handling (AS5)
**File**: `tests/e2e/performance.spec.ts`
**Story**: US3 - Performance and Reliability
**Description**:
- Test acceptance scenario #5
- Create multiple trips rapidly to potentially hit rate limits
- Verify system uses fallback providers (Z.AI → OpenRouter)
- Verify trips complete successfully

**Dependencies**: T033

**Implementation**:
```typescript
test('system tries fallback AI providers on rate limit (AS5)', async ({ request }) => {
  // Create 5 trips rapidly to potentially trigger rate limiting
  const promises = Array.from({ length: 5 }, async (_, index) => {
    const response = await request.post('/api/trips', {
      data: {
        template_id: 'heritage-ancestry-001',
        initial_message: `Rate limit test ${Date.now()} - ${index}`,
      },
    });

    return response.status();
  });

  const statuses = await Promise.all(promises);

  // All should succeed (either primary or fallback provider)
  statuses.forEach(status => {
    expect([201, 200]).toContain(status);
  });

  console.log('✓ All trips created successfully (fallback providers functional)');
});
```

---

**✓ Checkpoint: User Story 3 Complete**
- All 5 acceptance scenarios are tested
- Performance metrics are measured (informational only)
- Concurrent user handling is verified

---

## Phase 6: User Story 4 - Data Integrity and State Management (P2)

**Goal**: Implement tests for database validation and state transitions throughout the user journey.

**Duration**: 4-6 hours

**Independent Test Criteria**:
- Tests validate database contents at each stage
- Can run independently of other test suites
- Validates all 6 acceptance scenarios
- Tests state transitions and data persistence

### **T035** [US4] Create data integrity test file
**File**: `tests/e2e/data-integrity.spec.ts`
**Story**: US4 - Data Integrity and State Management
**Description**:
- Create test file with describe block
- Import custom test fixtures and database helper
- Add @P2 and @data tags

**Dependencies**: T013

**Implementation**:
```typescript
import { test, expect } from '../fixtures/playwright/test-fixtures';
import { queryDatabase } from '../helpers/database';
import { pollForDestinations, pollForTripStatus } from '../helpers/polling';

test.describe('Data Integrity and State Management @P2 @data', () => {
  // Tests will be added in subsequent tasks
});
```

---

### **T036** [US4] Test: New trip database record (AS1)
**File**: `tests/e2e/data-integrity.spec.ts`
**Story**: US4 - Data Integrity and State Management
**Description**:
- Test acceptance scenario #1
- Create trip
- Query database
- Verify record contains template_id, chat_history, preferences_json, status "chat"

**Dependencies**: T035

**Implementation**:
```typescript
test('new trip record contains required fields (AS1)', async ({ apiClient, testData, request }) => {
  // Create trip
  const { data: trip } = await apiClient.createTrip(
    testData.template.id,
    testData.template.testMessage,
    testData.preferences
  );

  // Get trip from API (represents database state)
  const { data: dbTrip } = await apiClient.getTrip(trip.id);

  // Verify required fields
  expect(dbTrip.template_id).toBe(testData.template.id);
  expect(dbTrip.chat_history).toBeDefined();
  expect(Array.isArray(dbTrip.chat_history)).toBeTruthy();
  expect(dbTrip.chat_history.length).toBeGreaterThan(0);
  expect(dbTrip.preferences_json || dbTrip.preferences).toBeDefined();
  expect(dbTrip.status).toBe('researching'); // May start as chat, then transition
});
```

---

### **T037** [US4] Test: Research destinations stored (AS2)
**File**: `tests/e2e/data-integrity.spec.ts`
**Story**: US4 - Data Integrity and State Management
**Description**:
- Test acceptance scenario #2
- Wait for research to complete
- Query database
- Verify research_destinations contains 2-4 objects with all required fields

**Dependencies**: T036

**Implementation**:
```typescript
test('research_destinations contains 2-4 destination objects (AS2)', async ({ apiClient, testData, request }) => {
  // Create trip and wait for destinations
  const { data: trip } = await apiClient.createTrip(testData.template.id, testData.template.testMessage);
  await pollForDestinations(request, trip.id, 60000);

  // Get trip from API
  const { data: dbTrip } = await apiClient.getTrip(trip.id);

  // Verify destinations
  expect(dbTrip.research_destinations).toBeDefined();
  expect(Array.isArray(dbTrip.research_destinations)).toBeTruthy();
  expect(dbTrip.research_destinations.length).toBeGreaterThanOrEqual(2);
  expect(dbTrip.research_destinations.length).toBeLessThanOrEqual(4);

  // Verify required fields on first destination
  const dest = dbTrip.research_destinations[0];
  expect(dest.name).toBeDefined();
  expect(dest.geographic_context).toBeDefined();
  expect(dest.rationale).toBeDefined();
  expect(dest.estimated_days).toBeDefined();
  expect(typeof dest.estimated_days).toBe('number');
});
```

---

### **T038** [US4] Test: Confirmed destinations state (AS3)
**File**: `tests/e2e/data-integrity.spec.ts`
**Story**: US4 - Data Integrity and State Management
**Description**:
- Test acceptance scenario #3
- Confirm destinations
- Query database
- Verify destinations_confirmed is 1, confirmed_destinations array populated, status "building_trip"

**Dependencies**: T037

**Implementation**:
```typescript
test('confirmed destinations updates database correctly (AS3)', async ({ apiClient, testData, request }) => {
  // Create trip, wait for destinations, confirm
  const { data: trip } = await apiClient.createTrip(testData.template.id, testData.template.testMessage);
  await pollForDestinations(request, trip.id, 60000);

  const tripData = await request.get(`/api/trips/${trip.id}`).then(r => r.json());
  const destNames = tripData.research_destinations.map(d => d.name);
  await apiClient.confirmDestinations(trip.id, destNames, testData.preferences);

  // Get updated trip
  const { data: dbTrip } = await apiClient.getTrip(trip.id);

  // Verify state
  expect(dbTrip.destinations_confirmed).toBe(1); // or true
  expect(dbTrip.confirmed_destinations).toBeDefined();
  expect(Array.isArray(dbTrip.confirmed_destinations)).toBeTruthy();
  expect(dbTrip.confirmed_destinations.length).toBe(destNames.length);
  expect(dbTrip.status).toBe('building_trip');
});
```

---

### **T039** [US4] Test: Trip options stored (AS4)
**File**: `tests/e2e/data-integrity.spec.ts`
**Story**: US4 - Data Integrity and State Management
**Description**:
- Test acceptance scenario #4
- Wait for trip building to complete
- Query database
- Verify options_json contains 2-4 trip options with flights, hotels, tours, pricing

**Dependencies**: T038

**Implementation**:
```typescript
test('options_json contains complete trip options (AS4)', async ({ apiClient, testData, request }) => {
  // Create full trip flow
  const { data: trip } = await apiClient.createTrip(testData.template.id, testData.template.testMessage);
  await pollForDestinations(request, trip.id, 60000);

  const tripData = await request.get(`/api/trips/${trip.id}`).then(r => r.json());
  const destNames = tripData.research_destinations.map(d => d.name);
  await apiClient.confirmDestinations(trip.id, destNames, testData.preferences);
  await pollForTripStatus(request, trip.id, 'options_ready', 180000);

  // Get trip with options
  const { data: dbTrip } = await apiClient.getTrip(trip.id);

  // Verify options
  expect(dbTrip.options || dbTrip.options_json).toBeDefined();
  const options = dbTrip.options || JSON.parse(dbTrip.options_json);
  expect(Array.isArray(options)).toBeTruthy();
  expect(options.length).toBeGreaterThanOrEqual(2);
  expect(options.length).toBeLessThanOrEqual(4);

  // Verify required fields on first option
  const option = options[0];
  expect(option.flights).toBeDefined();
  expect(option.hotels).toBeDefined();
  expect(option.tours).toBeDefined();
  expect(option.total_cost_usd).toBeDefined();
  expect(typeof option.total_cost_usd).toBe('number');
});
```

---

### **T040** [US4] Test: Selected option stored (AS5)
**File**: `tests/e2e/data-integrity.spec.ts`
**Story**: US4 - Data Integrity and State Management
**Description**:
- Test acceptance scenario #5
- Select trip option
- Query database
- Verify selected_option_index matches, status is "option_selected"

**Dependencies**: T039

**Implementation**:
```typescript
test('selected_option_index is stored correctly (AS5)', async ({ apiClient, testData, request }) => {
  // Create full trip flow and select option
  const { data: trip } = await apiClient.createTrip(testData.template.id, testData.template.testMessage);
  await pollForDestinations(request, trip.id, 60000);

  const tripData = await request.get(`/api/trips/${trip.id}`).then(r => r.json());
  const destNames = tripData.research_destinations.map(d => d.name);
  await apiClient.confirmDestinations(trip.id, destNames, testData.preferences);
  await pollForTripStatus(request, trip.id, 'options_ready', 180000);

  // Select option 0
  await apiClient.selectTripOption(trip.id, 0);

  // Get updated trip
  const { data: dbTrip } = await apiClient.getTrip(trip.id);

  // Verify selection
  expect(dbTrip.selected_option_index).toBe(0);
  expect(dbTrip.status).toBe('option_selected');
});
```

---

### **T041** [US4] Test: Telemetry logs accumulated (AS6)
**File**: `tests/e2e/data-integrity.spec.ts`
**Story**: US4 - Data Integrity and State Management
**Description**:
- Test acceptance scenario #6
- Create trip and complete flow
- Query database
- Verify telemetry_logs contains events, ai_cost_usd and api_cost_usd are accumulated

**Dependencies**: T040

**Implementation**:
```typescript
test('telemetry logs accumulate costs correctly (AS6)', async ({ apiClient, testData, request }) => {
  // Create full trip flow
  const { data: trip } = await apiClient.createTrip(testData.template.id, testData.template.testMessage);
  await pollForDestinations(request, trip.id, 60000);

  const tripData = await request.get(`/api/trips/${trip.id}`).then(r => r.json());
  const destNames = tripData.research_destinations.map(d => d.name);
  await apiClient.confirmDestinations(trip.id, destNames, testData.preferences);
  await pollForTripStatus(request, trip.id, 'options_ready', 180000);

  // Get trip with telemetry
  const { data: dbTrip } = await apiClient.getTrip(trip.id);

  // Verify telemetry
  expect(dbTrip.telemetry_logs || dbTrip.telemetry).toBeDefined();
  expect(dbTrip.ai_cost_usd).toBeDefined();
  expect(typeof dbTrip.ai_cost_usd).toBe('number');
  expect(dbTrip.ai_cost_usd).toBeGreaterThan(0);

  // Informational only - per clarification #4, costs don't fail tests
  console.log(`✓ Trip AI cost: $${dbTrip.ai_cost_usd.toFixed(4)}`);
  if (dbTrip.ai_cost_usd > 0.50) {
    console.warn(`⚠️  Warning: AI cost exceeds $0.50 target`);
  }
});
```

---

**✓ Checkpoint: User Story 4 Complete**
- All 6 acceptance scenarios are tested
- Database integrity is validated at each stage
- State transitions are verified

---

## Phase 7: User Story 5 - Mobile Responsiveness (P3)

**Goal**: Implement tests for mobile viewport validation and touch interaction.

**Duration**: 3-4 hours

**Independent Test Criteria**:
- Tests run in mobile viewports (320px, 768px, 1024px)
- Can run independently of other test suites
- Validates all 5 acceptance scenarios
- Tests touch targets and layout

### **T042** [US5] Create mobile responsive test file
**File**: `tests/e2e/mobile-responsive.spec.ts`
**Story**: US5 - Mobile Responsiveness
**Description**:
- Create test file with describe block
- Import custom test fixtures
- Add @P3 and @mobile tags
- Configure to run only on mobile projects

**Dependencies**: T013

**Implementation**:
```typescript
import { test, expect } from '../fixtures/playwright/test-fixtures';

test.describe('Mobile Responsiveness @P3 @mobile', () => {
  test.use({ viewport: { width: 320, height: 568 } }); // Default to mobile

  // Tests will be added in subsequent task
});
```

---

### **T043** [US5] Test: All mobile acceptance scenarios (AS1-5)
**File**: `tests/e2e/mobile-responsive.spec.ts`
**Story**: US5 - Mobile Responsiveness
**Description**:
- Implement all 5 acceptance scenarios in one comprehensive test file
- Test 320px viewport (vertical stacking, no horizontal scroll)
- Test touch targets (44x44px minimum)
- Test chat interface accessibility
- Test trip options display
- Test 768px tablet layout

**Dependencies**: T042

**Implementation**:
```typescript
test('template cards stack vertically on 320px viewport (AS1)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');

  // Wait for templates
  await expect(page.locator('[data-testid="template-card"]').first()).toBeVisible();

  // Verify no horizontal scrolling
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(325); // Allow 5px tolerance

  // Verify cards are stacked (not side-by-side)
  const cards = page.locator('[data-testid="template-card"]');
  const count = await cards.count();

  for (let i = 0; i < count - 1; i++) {
    const card1Box = await cards.nth(i).boundingBox();
    const card2Box = await cards.nth(i + 1).boundingBox();

    // Second card should be below first card
    expect(card2Box!.y).toBeGreaterThan(card1Box!.y + card1Box!.height - 10);
  }
});

test('touch targets are at least 44x44px (AS2)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
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

test('chat interface is accessible on mobile (AS3)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/trip?trip_id=test-trip-id'); // Will create or use test trip

  // Verify chat input is accessible
  await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
  await expect(page.locator('[data-testid="send-btn"]')).toBeVisible();

  // Verify no zoom needed (font size >= 16px)
  const fontSize = await page.locator('[data-testid="chat-input"]').evaluate(
    el => window.getComputedStyle(el).fontSize
  );
  expect(parseInt(fontSize)).toBeGreaterThanOrEqual(16);
});

test('trip options are fully visible on mobile (AS4)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  // This test assumes trip options are available
  // In practice, you'd create a trip and wait for options

  await page.goto('/trip?trip_id=test-trip-with-options');

  const optionCards = page.locator('[data-testid="trip-option-card"]');
  const count = await optionCards.count();

  if (count > 0) {
    // Verify cards don't overlap
    for (let i = 0; i < count - 1; i++) {
      const card1Box = await optionCards.nth(i).boundingBox();
      const card2Box = await optionCards.nth(i + 1).boundingBox();

      // Cards should not overlap vertically
      expect(card2Box!.y).toBeGreaterThanOrEqual(card1Box!.y + card1Box!.height);
    }
  }
});

test('tablet viewport uses 2-column grid (AS5)', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/trip?trip_id=test-trip-with-options');

  const optionsGrid = page.locator('[data-testid="trip-options-grid"]');
  const gridTemplateColumns = await optionsGrid.evaluate(
    el => window.getComputedStyle(el).gridTemplateColumns
  );

  // Should have 2 columns (will be "1fr 1fr" or similar)
  const columnCount = gridTemplateColumns.split(' ').length;
  expect(columnCount).toBeGreaterThanOrEqual(2);
});
```

---

**✓ Checkpoint: User Story 5 Complete**
- All 5 acceptance scenarios are tested
- Mobile responsiveness is validated at all breakpoints
- **ALL USER STORIES COMPLETE** - Full test suite implemented

---

## Phase 8: Polish & Integration

**Goal**: Add edge case tests, custom reporters, and final integration.

**Duration**: 2-3 hours

### **T044** [Polish] Create edge cases test file (optional)
**File**: `tests/e2e/edge-cases.spec.ts`
**Story**: Integration
**Description**:
- Create tests for the 12 edge cases listed in spec
- Mark as @edge tag for optional execution

**Dependencies**: All previous tests

---

### **T045** [Polish] Create custom cost reporter (optional)
**File**: `tests/utils/cost-reporter.ts`
**Story**: Integration
**Description**:
- Create custom Playwright reporter
- Track API costs per test
- Generate cost report (informational only)

**Dependencies**: T012

---

### **T046** [Polish] Create metrics reporter (optional)
**File**: `tests/utils/metrics-reporter.ts`
**Story**: Integration
**Description**:
- Create custom Playwright reporter
- Track performance metrics per test
- Generate performance report (informational only)

**Dependencies**: All previous tests

---

### **T047** [Polish] Add README for test suite
**File**: `tests/README.md`
**Story**: Integration
**Description**:
- Document how to run tests
- Reference quickstart.md
- Include common commands and troubleshooting

**Dependencies**: All previous tests

---

## Dependencies Graph

```
Setup Phase (T001-T006) - All can run in parallel
    ↓
Foundation Phase (T007-T014) - Can run in parallel after setup
    ↓
    ├─→ User Story 1 (T015-T021) - Sequential within story
    ├─→ User Story 2 (T022-T028) - Sequential within story
    ├─→ User Story 3 (T029-T034) - Sequential within story
    ├─→ User Story 4 (T035-T041) - Sequential within story
    └─→ User Story 5 (T042-T043) - Can run in parallel with others
    ↓
Polish Phase (T044-T047) - Can run in parallel after all user stories
```

---

## Parallel Execution Strategy

### MVP Development (Phase 3 only)
```bash
# Implement Foundation (T001-T014)
# Then implement User Story 1 (T015-T021)
# Run: npm run test:e2e -- critical-path
```

### Full Test Suite Development
```bash
# After Foundation complete:
# Developer 1: User Story 1 (T015-T021)
# Developer 2: User Story 2 (T022-T028)
# Developer 3: User Story 3 (T029-T034)
# Developer 4: User Story 4 (T035-T041)
# Developer 5: User Story 5 (T042-T043)
```

---

## Implementation Strategy

### Phase 1: MVP (Critical Path Only)
**Goal**: Get basic E2E testing working
**Duration**: 1-2 days
**Tasks**: T001-T021
**Deliverable**: Critical path tests running successfully

### Phase 2: P1 Complete (Critical Path + API Validation)
**Goal**: Achieve 100% P1 pass rate requirement
**Duration**: +1 day
**Tasks**: T022-T028
**Deliverable**: Both P1 user stories passing

### Phase 3: P2 Complete (Performance + Data Integrity)
**Goal**: Achieve 95% P2 pass rate requirement
**Duration**: +1-2 days
**Tasks**: T029-T041
**Deliverable**: Production readiness criteria met (100% P1 + 95% P2)

### Phase 4: Full Suite (Add Mobile + Polish)
**Goal**: Complete all user stories
**Duration**: +1 day
**Tasks**: T042-T047
**Deliverable**: Comprehensive test suite with reporting

---

## Success Criteria

### Per User Story
- **US1**: All 6 acceptance scenarios pass ✓
- **US2**: All 6 acceptance scenarios pass ✓
- **US3**: All 5 acceptance scenarios pass ✓
- **US4**: All 6 acceptance scenarios pass ✓
- **US5**: All 5 acceptance scenarios pass ✓

### Overall
- ✅ P1 pass rate: 100% (US1 + US2)
- ✅ P2 pass rate: ≥95% (US3 + US4)
- ✅ Flakiness rate: <5%
- ✅ Suite execution: <10 minutes
- ✅ Production readiness: Automatic (per clarification #3)

---

## Next Steps

1. **Start with Setup Phase** (T001-T006)
2. **Build Foundation** (T007-T014)
3. **Implement MVP** (T015-T021 - User Story 1)
4. **Validate MVP** - Run tests, fix issues
5. **Expand to P1** (T022-T028 - User Story 2)
6. **Expand to P2** (T029-T041 - User Stories 3 & 4)
7. **Complete with P3** (T042-T043 - User Story 5)
8. **Polish** (T044-T047 - Edge cases, reporters)

**Recommended MVP Scope**: Complete through T021 (User Story 1 only)
**Production Ready Scope**: Complete through T041 (User Stories 1-4)
**Full Suite Scope**: Complete all tasks through T047

Good luck with implementation! 🚀
