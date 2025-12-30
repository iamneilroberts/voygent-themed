import { test as base, expect } from '@playwright/test';
import { ApiClient, createApiClient } from '../../helpers/api-client';
import { DatabaseHelper, createDatabaseHelper } from '../../helpers/database';
import { CostCalculator } from '../../utils/cost-calculator';
import templatesData from '../templates.json' with { type: 'json' };
import preferencesData from '../preferences.json' with { type: 'json' };

/**
 * Custom Test Fixtures for VoyGent V3 E2E Tests
 *
 * Extends Playwright's base test with VoyGent-specific fixtures:
 * - apiClient: API client for backend calls
 * - db: Database helper for data verification
 * - costTracker: Cost tracking for API calls
 * - templates: Test template data
 * - preferences: Test user preferences data
 * - tripCleanup: Automatic cleanup of created trips
 *
 * Usage:
 *   import { test, expect } from '../fixtures/playwright/test-fixtures';
 *
 *   test('should create a trip', async ({ apiClient, tripCleanup }) => {
 *     const response = await apiClient.createTrip('template-id');
 *     tripCleanup(response.data.id);
 *     // ... test assertions
 *   });
 */

export interface VoyGentTestFixtures {
  apiClient: ApiClient;
  db: DatabaseHelper;
  costTracker: CostCalculator;
  templates: typeof templatesData;
  preferences: typeof preferencesData;
  tripCleanup: (tripId: string) => void;
  tripIds: string[]; // Tracks trip IDs created during test for auto-cleanup
}

/**
 * Extended test with VoyGent fixtures
 */
export const test = base.extend<VoyGentTestFixtures>({
  /**
   * API Client fixture
   * Provides typed methods for interacting with VoyGent API
   */
  apiClient: async ({ request }, use) => {
    const client = createApiClient(request);
    await use(client);
  },

  /**
   * Database helper fixture
   * Provides utilities for database verification and cleanup
   */
  db: async ({}, use) => {
    const dbHelper = createDatabaseHelper();
    await use(dbHelper);
  },

  /**
   * Cost tracker fixture
   * Tracks API costs throughout test execution (informational only)
   */
  costTracker: async ({}, use) => {
    const tracker = new CostCalculator();

    // Use the tracker during test
    await use(tracker);

    // Log summary after test completes
    if (tracker.getTotalApiCalls() > 0) {
      tracker.logSummary();
    }
  },

  /**
   * Templates fixture
   * Provides access to test template data
   */
  templates: async ({}, use) => {
    await use(templatesData);
  },

  /**
   * Preferences fixture
   * Provides access to test user preferences data
   */
  preferences: async ({}, use) => {
    await use(preferencesData);
  },

  /**
   * Trip IDs tracker fixture
   * Automatically tracks trip IDs created during test for cleanup
   */
  tripIds: async ({}, use) => {
    const ids: string[] = [];
    await use(ids);

    // Note: Actual cleanup happens in tripCleanup fixture
  },

  /**
   * Trip cleanup fixture
   * Registers trip IDs for automatic cleanup after test
   * Also provides manual cleanup function
   */
  tripCleanup: async ({ db, tripIds }, use) => {
    // Provide cleanup function to test
    const cleanup = (tripId: string) => {
      if (!tripIds.includes(tripId)) {
        tripIds.push(tripId);
      }
    };

    await use(cleanup);

    // After test completes, clean up all registered trips
    if (tripIds.length > 0) {
      console.log(`\n🧹 Cleaning up ${tripIds.length} trip(s)...`);

      for (const tripId of tripIds) {
        try {
          await db.deleteTripById(tripId);
          console.log(`   ✅ Deleted trip ${tripId}`);
        } catch (error) {
          console.warn(`   ⚠️  Could not delete trip ${tripId}:`, error);
        }
      }
    }
  },
});

/**
 * Re-export expect for convenience
 */
export { expect };

/**
 * Helper to get a template by name from fixtures
 */
export function getTemplateByName(name: string) {
  return templatesData.templates.find(t => t.name === name);
}

/**
 * Helper to get a test scenario from fixtures
 */
export function getTestScenario(scenarioName: keyof typeof templatesData.testScenarios) {
  return templatesData.testScenarios[scenarioName];
}

/**
 * Helper to get preferences by type from fixtures
 */
export function getPreferences(type: keyof typeof preferencesData.preferences) {
  return preferencesData.preferences[type];
}
