import { expect, APIRequestContext, Page } from '@playwright/test';
import { Trip, ApiClient } from './api-client';

/**
 * Polling Helper for VoyGent V3 E2E Tests
 *
 * Provides utilities for polling async operations:
 * - Trip status transitions
 * - DOM element appearance/state changes
 * - API response conditions
 *
 * Uses Playwright's expect.poll() for robust async assertions with retries
 */

export interface PollingOptions {
  timeout?: number; // Maximum time to wait (default: 180000ms = 3 minutes)
  interval?: number; // Polling interval (default: 3000ms = 3 seconds)
  message?: string; // Custom error message on timeout
}

/**
 * Poll for a trip to reach a specific status
 *
 * @param apiClient - VoyGent API client
 * @param tripId - Trip ID to poll
 * @param expectedStatus - Status to wait for
 * @param options - Polling configuration
 */
export async function pollForTripStatus(
  apiClient: ApiClient,
  tripId: string,
  expectedStatus: Trip['status'],
  options: PollingOptions = {}
): Promise<Trip> {
  const {
    timeout = 180000, // 3 minutes default
    interval = 3000, // 3 seconds default
    message = `Trip ${tripId} did not reach status "${expectedStatus}" within timeout`,
  } = options;

  let lastTrip: Trip | null = null;

  await expect
    .poll(
      async () => {
        const response = await apiClient.getTrip(tripId);
        lastTrip = response.data;

        // Check for error state
        if (response.data.status === 'error') {
          throw new Error(`Trip ${tripId} entered error state while waiting for ${expectedStatus}`);
        }

        return response.data.status;
      },
      {
        message,
        timeout,
        intervals: [interval, interval, interval], // Consistent polling interval
      }
    )
    .toBe(expectedStatus);

  // Return the trip data once status is reached
  if (!lastTrip) {
    throw new Error('Failed to retrieve trip data');
  }

  return lastTrip;
}

/**
 * Poll for a DOM element to appear and contain specific text
 *
 * @param page - Playwright page context
 * @param selector - CSS selector for the element
 * @param expectedText - Text to wait for (partial match)
 * @param options - Polling configuration
 */
export async function pollForElementText(
  page: Page,
  selector: string,
  expectedText: string,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = 60000, // 1 minute default for UI
    message = `Element "${selector}" did not contain text "${expectedText}" within timeout`,
  } = options;

  await expect
    .poll(
      async () => {
        const element = page.locator(selector);
        const count = await element.count();

        if (count === 0) {
          return null;
        }

        const text = await element.first().textContent();
        return text || '';
      },
      {
        message,
        timeout,
      }
    )
    .toContain(expectedText);
}

/**
 * Poll for a DOM element to have a specific attribute value
 *
 * @param page - Playwright page context
 * @param selector - CSS selector for the element
 * @param attribute - Attribute name to check
 * @param expectedValue - Expected attribute value
 * @param options - Polling configuration
 */
export async function pollForElementAttribute(
  page: Page,
  selector: string,
  attribute: string,
  expectedValue: string,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = 60000,
    message = `Element "${selector}" attribute "${attribute}" did not equal "${expectedValue}" within timeout`,
  } = options;

  await expect
    .poll(
      async () => {
        const element = page.locator(selector);
        const value = await element.getAttribute(attribute);
        return value;
      },
      {
        message,
        timeout,
      }
    )
    .toBe(expectedValue);
}

/**
 * Poll for a condition to become true
 * Generic polling utility for custom conditions
 *
 * @param condition - Async function that returns boolean
 * @param options - Polling configuration
 */
export async function pollForCondition(
  condition: () => Promise<boolean>,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = 60000,
    message = 'Condition did not become true within timeout',
  } = options;

  await expect
    .poll(
      async () => {
        return await condition();
      },
      {
        message,
        timeout,
      }
    )
    .toBe(true);
}

/**
 * Poll for a value to match an expected value
 * Generic polling utility for any async value
 *
 * @param getValue - Async function that returns a value
 * @param expectedValue - Expected value
 * @param options - Polling configuration
 */
export async function pollForValue<T>(
  getValue: () => Promise<T>,
  expectedValue: T,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = 60000,
    message = `Value did not match expected value within timeout`,
  } = options;

  await expect
    .poll(
      async () => {
        return await getValue();
      },
      {
        message,
        timeout,
      }
    )
    .toBe(expectedValue);
}

/**
 * Poll for an array to have a specific length
 *
 * @param getArray - Async function that returns an array
 * @param expectedLength - Expected array length
 * @param options - Polling configuration
 */
export async function pollForArrayLength<T>(
  getArray: () => Promise<T[]>,
  expectedLength: number,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = 60000,
    message = `Array length did not reach ${expectedLength} within timeout`,
  } = options;

  await expect
    .poll(
      async () => {
        const array = await getArray();
        return array.length;
      },
      {
        message,
        timeout,
      }
    )
    .toBe(expectedLength);
}

/**
 * Poll for an array to have at least a minimum length
 *
 * @param getArray - Async function that returns an array
 * @param minLength - Minimum expected array length
 * @param options - Polling configuration
 */
export async function pollForArrayMinLength<T>(
  getArray: () => Promise<T[]>,
  minLength: number,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = 60000,
    message = `Array length did not reach minimum ${minLength} within timeout`,
  } = options;

  await expect
    .poll(
      async () => {
        const array = await getArray();
        return array.length;
      },
      {
        message,
        timeout,
      }
    )
    .toBeGreaterThanOrEqual(minLength);
}

/**
 * Wait for a specific amount of time (use sparingly - prefer polling)
 *
 * @param ms - Milliseconds to wait
 */
export async function wait(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}
