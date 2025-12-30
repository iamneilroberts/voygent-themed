/**
 * POST /api/trips/:id/confirm-destinations
 * Confirm destinations and trigger Phase 2 (trip building)
 * This is the critical phase gate enforced by Constitution principle II
 */

import { Env, createDatabaseClient, Destination, TripPreferences } from '../../../lib/db';
import { createLogger } from '../../../lib/logger';
import { createPhaseGate } from '../../../lib/phase-gate';
import { createTripBuilderService } from '../../../services/trip-builder-service';

interface ConfirmDestinationsRequest {
  confirmed_destinations: string[];
  preferences?: TripPreferences;
}

export async function onRequestPost(context: { request: Request; env: Env; params: { id: string }; waitUntil: (promise: Promise<any>) => void }): Promise<Response> {
  const logger = createLogger();
  const db = createDatabaseClient(context.env);
  const phaseGate = createPhaseGate(db, logger);

  const tripId = context.params.id;
  logger.info(`=== CONFIRM DESTINATIONS START: trip ${tripId} ===`);

  try {
    // Parse request body
    const body = await context.request.json() as ConfirmDestinationsRequest;
    logger.info(`Request body: ${JSON.stringify(body)}`);

    if (!body.confirmed_destinations || body.confirmed_destinations.length === 0) {
      return new Response(
        JSON.stringify({ error: 'confirmed_destinations array cannot be empty' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    logger.info(`Confirming destinations for trip ${tripId}: ${body.confirmed_destinations.join(', ')}`);

    // Check if trip is eligible for confirmation
    const eligibilityCheck = await phaseGate.checkConfirmationEligibility(tripId);
    if (!eligibilityCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: eligibilityCheck.error!.message,
          code: eligibilityCheck.error!.code,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate that confirmed destinations match research destinations
    const trip = eligibilityCheck.trip!;
    const researchDestinations: Destination[] = trip.research_destinations
      ? JSON.parse(trip.research_destinations)
      : [];

    const researchDestinationNames = researchDestinations.map(d => d.name.toLowerCase());
    const invalidDestinations = body.confirmed_destinations.filter(
      dest => !researchDestinationNames.includes(dest.toLowerCase())
    );

    if (invalidDestinations.length > 0) {
      return new Response(
        JSON.stringify({
          error: `Invalid destinations: ${invalidDestinations.join(', ')}. Must match research destinations.`,
          code: 'INVALID_DESTINATIONS',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Update preferences if provided
    if (body.preferences) {
      const currentPreferences = trip.preferences_json
        ? JSON.parse(trip.preferences_json)
        : {};

      const updatedPreferences = { ...currentPreferences, ...body.preferences };

      await db.updatePreferences(tripId, updatedPreferences);
      logger.info(`Updated preferences for trip ${tripId}`);
    }

    // Confirm destinations (sets destinations_confirmed = 1, status = 'building_trip')
    await db.confirmDestinations(tripId, body.confirmed_destinations);

    logger.info(`Destinations confirmed for trip ${tripId}. Phase 2 gate opened.`);

    // Get template for trip building
    const template = await db.getTemplate(trip.template_id);
    if (!template) {
      throw new Error('Template not found');
    }

    // Get final preferences
    const finalPreferences: TripPreferences = body.preferences
      ? { ...(trip.preferences_json ? JSON.parse(trip.preferences_json) : {}), ...body.preferences }
      : (trip.preferences_json ? JSON.parse(trip.preferences_json) : {});

    // Trigger Phase 2 trip building in background (async)
    logger.info(`Creating TripBuilderService for trip ${tripId}...`);

    let tripBuilderService;
    try {
      tripBuilderService = createTripBuilderService(context.env, db, logger);
      logger.info(`TripBuilderService created successfully`);
    } catch (serviceError) {
      logger.error(`Failed to create TripBuilderService: ${serviceError}`);
      await logger.logTelemetry(db, tripId, 'phase2_service_error', {
        details: { error: String(serviceError) }
      });
      throw serviceError;
    }

    // Use waitUntil to ensure trip building completes even after response is sent
    context.waitUntil(
      tripBuilderService.buildTripOptions({
        tripId,
        template,
        confirmedDestinations: body.confirmed_destinations,
        preferences: finalPreferences,
      }).catch(async (error) => {
        logger.error(`Background trip building failed for trip ${tripId}: ${error}`);
        await logger.logTelemetry(db, tripId, 'phase2_error', {
          details: { error: String(error), stack: error instanceof Error ? error.stack : '' }
        });
      })
    );

    return new Response(
      JSON.stringify({
        status: 'building_trip',
        progress_message: 'Finding flights and hotels...',
        estimated_completion: 120, // seconds
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    logger.error(`Failed to confirm destinations for trip ${tripId}: ${errorMessage}\n${errorStack}`);

    // Log to telemetry for debugging
    await logger.logTelemetry(db, tripId, 'confirm_error', {
      details: { error: errorMessage },
    });

    return new Response(
      JSON.stringify({ error: `Failed to confirm destinations: ${errorMessage}` }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// CORS preflight
export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
