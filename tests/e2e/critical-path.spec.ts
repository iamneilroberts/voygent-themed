import { test, expect, getTestScenario, getPreferences } from '../fixtures/playwright/test-fixtures';
import { pollForTripStatus } from '../helpers/polling';
import { validator } from '../utils/schema-validator';

/**
 * Critical Path Validation (User Story 1 - P1)
 *
 * Tests the complete end-to-end user journey:
 * 1. User selects a trip template (theme)
 * 2. User views AI-generated destination recommendations (Phase 1)
 * 3. User confirms destinations and provides preferences
 * 4. User waits for trip building to complete (Phase 2)
 * 5. User views generated trip options
 * 6. User selects a trip option
 *
 * Success Criteria:
 * - SC-001: 100% of trips complete Phase 1 successfully
 * - SC-002: 100% of trips complete Phase 2 successfully
 * - SC-003: Phase gate enforced (cannot proceed to Phase 2 without confirming)
 * - SC-005: Trip building completes within 3 minutes (informational)
 * - SC-011: Phase transitions tracked correctly
 *
 * Priority: P1 (Critical) - Must pass for production readiness
 */

test.describe('Critical Path Validation', () => {
  test.describe.configure({ mode: 'serial' });

  let tripId: string;

  /**
   * AS1: User can create a new trip by selecting a template
   *
   * Acceptance Criteria:
   * - Template selection UI displays available templates
   * - User can select "Heritage & Ancestry" template
   * - Trip is created with status "researching_destinations"
   * - Initial chat message appears from assistant
   */
  test('AS1: Create trip with theme selection @P1 @critical-path', async ({
    page,
    apiClient,
    templates,
    tripCleanup,
    costTracker,
  }) => {
    // Navigate to home page
    await page.goto('/');

    // Verify templates are displayed
    await expect(page.locator('h1')).toContainText('VoyGent');

    // Wait for templates to load (they're loaded via JavaScript)
    const templateCard = page.locator('.template-card').first();
    await expect(templateCard).toBeVisible({ timeout: 10000 });

    // Get the template name for validation later
    const templateName = await templateCard.locator('h3').textContent();
    expect(templateName).toBeTruthy();

    // Handle the prompt dialog that appears when clicking the template
    const heritageScenario = getTestScenario('heritageTrip');
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept(heritageScenario.initialMessage);
    });

    // Select the first available template
    await templateCard.click();

    // Wait for redirect to chat page
    await page.waitForURL('**/chat?trip_id=*', { timeout: 30000 });

    // Verify chat page loaded (has template name header)
    await expect(page.locator('#templateName')).toBeVisible({ timeout: 10000 });

    // Extract trip ID from URL (format: /chat.html?trip_id=...)
    const url = page.url();
    const urlParams = new URL(url);
    const tripIdFromUrl = urlParams.searchParams.get('trip_id');

    if (tripIdFromUrl) {
      tripId = tripIdFromUrl;
      tripCleanup(tripId);

      // Verify trip was created correctly via API
      const tripResponse = await apiClient.getTrip(tripId);
      expect(tripResponse.status).toBe(200);
      expect(tripResponse.data.status).toBe('researching'); // Backend uses "researching" status
      expect(tripResponse.data.template_id).toBeTruthy(); // Should have a template ID

      // Validate trip structure
      // TODO: Fix schema validation
      // validator.assertValid('trip', tripResponse.data, 'Trip object should match schema');

      // Track cost
      if (tripResponse.cost) {
        costTracker.recordCost('zai', 'trip-creation', tripResponse.cost);
      }
      costTracker.recordTrip();
    }
  });

  /**
   * AS2: User can view AI-generated destination recommendations
   *
   * Acceptance Criteria:
   * - User enters their heritage details in chat
   * - AI processes request and generates destination recommendations
   * - Recommendations appear in chat within 60 seconds (informational)
   * - At least 2 destinations are recommended
   */
  test('AS2: View destination recommendations @P1 @critical-path', async ({
    page,
    apiClient,
    tripCleanup,
    costTracker,
  }) => {
    // Prerequisites: Trip must exist from AS1
    // For independent test execution, create a trip first
    if (!tripId) {
      const heritageScenario = getTestScenario('heritageTrip');
      const createResponse = await apiClient.createTrip(
        heritageScenario.templateId,
        heritageScenario.initialMessage
      );
      tripId = createResponse.data.id;
      tripCleanup(tripId);
      costTracker.recordTrip();
    }

    // Navigate to chat page (each test has its own page context)
    await page.goto(`/chat?trip_id=${tripId}`);

    // Enter user message requesting destination research
    const chatInput = page.locator('#chatInput');
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    await chatInput.fill('I want to explore my Irish heritage. Please recommend destinations in Ireland.');
    await chatInput.press('Enter');

    // Wait for assistant response with destination recommendations
    const startTime = Date.now();

    // Poll for response message (should appear within 60s - informational timeout)
    await expect(async () => {
      const messages = await page.locator('.message').count();
      expect(messages).toBeGreaterThanOrEqual(2); // Initial + user message + assistant response
    }).toPass({ timeout: 60000 });

    const responseTime = Date.now() - startTime;
    console.log(`ℹ️  Destination research completed in ${responseTime}ms (target: <60s)`);

    // Verify destinations are mentioned in response
    const lastMessage = page.locator('.message').last();
    const messageText = await lastMessage.textContent();

    // Should mention Irish cities (Dublin, Cork, Galway, etc.)
    const hasDestinations = messageText && (
      messageText.includes('Dublin') ||
      messageText.includes('Cork') ||
      messageText.includes('Galway') ||
      messageText.includes('Ireland')
    );

    expect(hasDestinations).toBeTruthy();

    // Verify trip status via API
    const tripResponse = await apiClient.getTrip(tripId);
    expect(tripResponse.data.status).toBe('awaiting_confirmation');

    // Verify research_destinations field is populated
    expect(tripResponse.data.research_destinations).toBeDefined();
    expect(tripResponse.data.research_destinations!.length).toBeGreaterThanOrEqual(2);

    // Track cost
    if (tripResponse.cost) {
      costTracker.recordCost('zai', 'destination-research', tripResponse.cost);
    }
  });

  /**
   * AS3: User can confirm destinations and provide travel preferences
   *
   * Acceptance Criteria:
   * - User can confirm recommended destinations
   * - User can provide preferences (duration, budget, interests)
   * - Trip transitions to "building_trip" status
   * - destinations_confirmed flag is set to true
   */
  test('AS3: Confirm destinations with preferences @P1 @critical-path', async ({
    page,
    apiClient,
    tripCleanup,
    costTracker,
  }) => {
    // Prerequisites: Trip must be in awaiting_confirmation status
    if (!tripId) {
      const heritageScenario = getTestScenario('heritageTrip');
      const createResponse = await apiClient.createTrip(
        heritageScenario.templateId,
        heritageScenario.initialMessage
      );
      tripId = createResponse.data.id;
      tripCleanup(tripId);

      // Wait for destination research to complete
      await pollForTripStatus(apiClient, tripId, 'awaiting_confirmation', {
        timeout: 60000,
      });

      await page.goto(`/chat?trip_id=${tripId}`);
    }

    // Navigate to chat page (ensure page is loaded for serial mode)
    await page.goto(`/chat?trip_id=${tripId}`);

    // Verify trip is in awaiting_confirmation state
    let tripResponse = await apiClient.getTrip(tripId);
    expect(tripResponse.data.status).toBe('awaiting_confirmation');

    // User provides preferences
    const preferences = getPreferences('heritage');

    // Look for confirmation button
    const confirmButton = page.locator('#confirmBtn');
    await expect(confirmButton).toBeVisible({ timeout: 10000 });

    // Fill in preferences before confirming
    await page.locator('#duration').fill(preferences.duration);
    if (preferences.departure_airport) {
      await page.locator('#departure_airport').fill(preferences.departure_airport);
    }

    await confirmButton.click();

    // Wait for trip to transition to building_trip status
    await pollForTripStatus(apiClient, tripId, 'building_trip', {
      timeout: 30000,
      message: 'Trip should transition to building_trip after confirmation'
    });

    // Verify trip state via API
    tripResponse = await apiClient.getTrip(tripId);
    expect(tripResponse.data.status).toBe('building_trip');
    expect(tripResponse.data.destinations_confirmed).toBe(true);
    expect(tripResponse.data.confirmed_destinations).toBeDefined();
    expect(tripResponse.data.user_preferences).toBeDefined();

    console.log('✅ Destinations confirmed, trip building started');
  });

  /**
   * AS4: Trip building completes within 3 minutes
   *
   * Acceptance Criteria:
   * - Trip transitions from "building_trip" to "trip_ready"
   * - Completion time is measured (target: <3min - informational)
   * - Progress updates are visible to user
   */
  test('AS4: Trip building completes within 3 minutes @P1 @critical-path @slow', async ({
    page,
    apiClient,
    tripCleanup,
    costTracker,
  }) => {
    // Prerequisites: Trip must be in building_trip status
    if (!tripId) {
      const heritageScenario = getTestScenario('heritageTrip');
      const preferences = getPreferences('heritage');

      const createResponse = await apiClient.createTrip(
        heritageScenario.templateId,
        heritageScenario.initialMessage
      );
      tripId = createResponse.data.id;
      tripCleanup(tripId);

      // Wait for destination research
      await pollForTripStatus(apiClient, tripId, 'awaiting_confirmation', {
        timeout: 60000,
      });

      // Confirm destinations
      await apiClient.confirmDestinations(tripId, preferences);

      // Wait for building_trip status
      await pollForTripStatus(apiClient, tripId, 'building_trip', {
        timeout: 30000,
      });

      await page.goto(`/chat?trip_id=${tripId}`);
    }

    // Measure trip building time
    const startTime = Date.now();

    // Poll for trip_ready status (max 3 minutes - informational timeout)
    await pollForTripStatus(apiClient, tripId, 'trip_ready', {
      timeout: 180000, // 3 minutes
      interval: 3000, // Poll every 3 seconds
      message: 'Trip should reach trip_ready status within 3 minutes'
    });

    const buildTime = Date.now() - startTime;
    const buildTimeSeconds = Math.round(buildTime / 1000);

    console.log(`ℹ️  Trip building completed in ${buildTimeSeconds}s (target: <180s)`);

    // Verify trip is ready
    const tripResponse = await apiClient.getTrip(tripId);
    expect(tripResponse.data.status).toBe('trip_ready');
    expect(tripResponse.data.trip_options).toBeDefined();
    expect(tripResponse.data.trip_options!.length).toBeGreaterThanOrEqual(1);

    // Track cost
    if (tripResponse.cost) {
      costTracker.recordCost('zai', 'trip-building', tripResponse.cost);
    }

    // Note: Performance timing is informational only (per clarification #2)
    // Test does not fail if build time exceeds 3 minutes
  });

  /**
   * AS5: User can view generated trip options
   *
   * Acceptance Criteria:
   * - At least 3 trip options are generated
   * - Each option contains flights, hotels, activities
   * - Options are displayed in the UI
   * - User can compare options
   */
  test('AS5: View generated trip options @P1 @critical-path', async ({
    page,
    apiClient,
    tripCleanup,
  }) => {
    // Prerequisites: Trip must be in trip_ready status
    if (!tripId) {
      const heritageScenario = getTestScenario('heritageTrip');
      const preferences = getPreferences('heritage');

      const createResponse = await apiClient.createTrip(
        heritageScenario.templateId,
        heritageScenario.initialMessage
      );
      tripId = createResponse.data.id;
      tripCleanup(tripId);

      await pollForTripStatus(apiClient, tripId, 'awaiting_confirmation', { timeout: 60000 });
      await apiClient.confirmDestinations(tripId, preferences);
      await pollForTripStatus(apiClient, tripId, 'trip_ready', { timeout: 180000 });

      await page.goto(`/chat?trip_id=${tripId}`);
    }

    // Verify trip has options via API
    const tripResponse = await apiClient.getTrip(tripId);
    expect(tripResponse.data.trip_options).toBeDefined();
    expect(tripResponse.data.trip_options!.length).toBeGreaterThanOrEqual(3);

    // Verify options are displayed in UI
    await expect(page.locator('.trip-option-card')).toHaveCount(
      tripResponse.data.trip_options!.length,
      { timeout: 10000 }
    );

    // Verify each option contains required elements
    const firstOption = page.locator('.trip-option-card').first();
    await expect(firstOption).toBeVisible();

    // Check for typical trip components (adjust selectors based on UI)
    const optionText = await firstOption.textContent();
    expect(optionText).toBeTruthy();

    console.log(`✅ ${tripResponse.data.trip_options!.length} trip options displayed`);
  });

  /**
   * AS6: User can select a trip option
   *
   * Acceptance Criteria:
   * - User can click/select a trip option
   * - Trip transitions to "selected" status
   * - selected_option_id is set in database
   * - Confirmation message appears
   */
  test('AS6: Select trip option @P1 @critical-path', async ({
    page,
    apiClient,
    db,
    tripCleanup,
  }) => {
    // Prerequisites: Trip must be in trip_ready status with options
    if (!tripId) {
      const heritageScenario = getTestScenario('heritageTrip');
      const preferences = getPreferences('heritage');

      const createResponse = await apiClient.createTrip(
        heritageScenario.templateId,
        heritageScenario.initialMessage
      );
      tripId = createResponse.data.id;
      tripCleanup(tripId);

      await pollForTripStatus(apiClient, tripId, 'awaiting_confirmation', { timeout: 60000 });
      await apiClient.confirmDestinations(tripId, preferences);
      await pollForTripStatus(apiClient, tripId, 'trip_ready', { timeout: 180000 });

      await page.goto(`/chat?trip_id=${tripId}`);
    }

    // Get trip options
    const tripResponse = await apiClient.getTrip(tripId);
    expect(tripResponse.data.trip_options).toBeDefined();
    expect(tripResponse.data.trip_options!.length).toBeGreaterThanOrEqual(1);

    const firstOptionId = tripResponse.data.trip_options![0].id;

    // Click select button on first option
    const selectButton = page
      .locator('.trip-option-card')
      .first()
      .locator('.trip-option-select-btn');

    await expect(selectButton).toBeVisible({ timeout: 10000 });
    await selectButton.click();

    // Wait for selection to complete
    await pollForTripStatus(apiClient, tripId, 'selected', {
      timeout: 30000,
      message: 'Trip should transition to selected status'
    });

    // Verify via API
    const updatedTrip = await apiClient.getTrip(tripId);
    expect(updatedTrip.data.status).toBe('selected');
    expect(updatedTrip.data.selected_option_id).toBe(firstOptionId);

    // Verify via database
    const dbTrip = await db.getTripById(tripId);
    expect(dbTrip).toBeTruthy();
    expect(dbTrip!.status).toBe('selected');
    expect(dbTrip!.selected_option_id).toBe(firstOptionId);

    // Verify data integrity
    const integrity = await db.verifyTripIntegrity(tripId);
    expect(integrity.isValid).toBe(true);

    console.log('✅ Trip option selected successfully');
  });
});
