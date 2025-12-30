import { APIRequestContext, expect } from '@playwright/test';

/**
 * API Client Helper for VoyGent V3 E2E Tests
 *
 * Provides typed methods for interacting with VoyGent API endpoints:
 * - GET /api/templates - List available trip templates
 * - POST /api/trips - Create a new trip
 * - GET /api/trips/:id - Get trip details
 * - POST /api/trips/:id/confirm-destinations - Confirm destination research
 * - POST /api/trips/:id/select - Select a trip option
 *
 * All methods include:
 * - Automatic JSON parsing
 * - Error handling
 * - Response validation
 * - Cost tracking (via response headers)
 */

export interface Template {
  id: string;
  name: string;
  description: string;
  initial_message: string;
  research_prompt_template: string;
  trip_building_prompt_template: string;
}

export interface Trip {
  id: string;
  template_id: string;
  status: 'researching_destinations' | 'awaiting_confirmation' | 'building_trip' | 'trip_ready' | 'selected' | 'error';
  chat_history: Array<{ role: 'user' | 'assistant'; content: string }>;
  research_destinations?: string[];
  destinations_confirmed?: boolean;
  confirmed_destinations?: string[];
  user_preferences?: Record<string, any>;
  trip_options?: any[];
  selected_option_id?: string;
  telemetry_logs?: any[];
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  cost?: number; // Extracted from X-API-Cost header if present
}

export class ApiClient {
  constructor(private request: APIRequestContext) {}

  /**
   * GET /api/templates
   * List all available trip templates
   */
  async getTemplates(): Promise<ApiResponse<Template[]>> {
    const response = await this.request.get('/api/templates');

    return {
      data: await response.json(),
      status: response.status(),
      headers: response.headers(),
      cost: this.extractCost(response.headers()),
    };
  }

  /**
   * POST /api/trips
   * Create a new trip with a template
   */
  async createTrip(templateId: string, initialMessage?: string): Promise<ApiResponse<Trip>> {
    const response = await this.request.post('/api/trips', {
      data: {
        template_id: templateId,
        initial_message: initialMessage,
      },
    });

    return {
      data: await response.json(),
      status: response.status(),
      headers: response.headers(),
      cost: this.extractCost(response.headers()),
    };
  }

  /**
   * GET /api/trips/:id
   * Get trip details by ID
   */
  async getTrip(tripId: string): Promise<ApiResponse<Trip>> {
    const response = await this.request.get(`/api/trips/${tripId}`);

    return {
      data: await response.json(),
      status: response.status(),
      headers: response.headers(),
      cost: this.extractCost(response.headers()),
    };
  }

  /**
   * POST /api/trips/:id/confirm-destinations
   * Confirm destination research and provide preferences
   */
  async confirmDestinations(
    tripId: string,
    preferences: Record<string, any>
  ): Promise<ApiResponse<Trip>> {
    const response = await this.request.post(`/api/trips/${tripId}/confirm-destinations`, {
      data: {
        preferences,
      },
    });

    return {
      data: await response.json(),
      status: response.status(),
      headers: response.headers(),
      cost: this.extractCost(response.headers()),
    };
  }

  /**
   * POST /api/trips/:id/select
   * Select a trip option from the generated options
   */
  async selectTripOption(tripId: string, optionId: string): Promise<ApiResponse<Trip>> {
    const response = await this.request.post(`/api/trips/${tripId}/select`, {
      data: {
        option_id: optionId,
      },
    });

    return {
      data: await response.json(),
      status: response.status(),
      headers: response.headers(),
      cost: this.extractCost(response.headers()),
    };
  }

  /**
   * Wait for trip to reach a specific status (with polling)
   * This is a convenience method that polls the API until the trip reaches the expected status
   *
   * @param tripId - Trip ID to poll
   * @param expectedStatus - Status to wait for
   * @param timeoutMs - Maximum time to wait (default: 180000ms = 3 minutes)
   * @param intervalMs - Polling interval (default: 3000ms = 3 seconds)
   */
  async waitForTripStatus(
    tripId: string,
    expectedStatus: Trip['status'],
    timeoutMs: number = 180000,
    intervalMs: number = 3000
  ): Promise<Trip> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const response = await this.getTrip(tripId);

      if (response.data.status === expectedStatus) {
        return response.data;
      }

      if (response.data.status === 'error') {
        throw new Error(`Trip ${tripId} entered error state while waiting for ${expectedStatus}`);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error(
      `Trip ${tripId} did not reach status "${expectedStatus}" within ${timeoutMs}ms timeout`
    );
  }

  /**
   * Assert that a response was successful (status 2xx)
   */
  assertSuccess(response: ApiResponse<any>, message?: string) {
    expect(response.status, message).toBeGreaterThanOrEqual(200);
    expect(response.status, message).toBeLessThan(300);
  }

  /**
   * Assert that a response has a specific status code
   */
  assertStatus(response: ApiResponse<any>, expectedStatus: number, message?: string) {
    expect(response.status, message).toBe(expectedStatus);
  }

  /**
   * Extract cost from response headers
   * Looks for X-API-Cost header (if implemented)
   */
  private extractCost(headers: Record<string, string>): number | undefined {
    const costHeader = headers['x-api-cost'] || headers['X-API-Cost'];
    if (costHeader) {
      const cost = parseFloat(costHeader);
      return isNaN(cost) ? undefined : cost;
    }
    return undefined;
  }
}

/**
 * Create an API client instance from a Playwright request context
 */
export function createApiClient(request: APIRequestContext): ApiClient {
  return new ApiClient(request);
}
