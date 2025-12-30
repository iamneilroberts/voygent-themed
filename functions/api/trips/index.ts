/**
 * POST /api/trips
 * Creates a new trip planning session
 */

import { Env, createDatabaseClient, TripPreferences } from '../../lib/db';
import { createLogger } from '../../lib/logger';
import { createResearchService } from '../../services/research-service';

interface CreateTripRequest {
  template_id: string;
  initial_message: string;
  preferences?: TripPreferences;
}

export async function onRequestPost(context: { request: Request; env: Env; waitUntil: (promise: Promise<any>) => void }): Promise<Response> {
  const logger = createLogger();
  const db = createDatabaseClient(context.env);

  try {
    // Parse request body
    const body = await context.request.json() as CreateTripRequest;

    if (!body.template_id || !body.initial_message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: template_id and initial_message' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    logger.info(`Creating trip with template ${body.template_id}`);

    // Validate template exists
    const template = await db.getTemplate(body.template_id);
    if (!template) {
      return new Response(
        JSON.stringify({ error: 'Template not found' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate trip ID
    const tripId = crypto.randomUUID();

    // Create trip in database
    const trip = await db.createTrip(
      tripId,
      body.template_id,
      body.initial_message,
      body.preferences
    );

    logger.info(`Created trip ${tripId}`);

    // Start research in background (async)
    const researchService = createResearchService(context.env, db, logger);

    // Use waitUntil to ensure research completes even after response is sent
    context.waitUntil(
      researchService.researchDestinations({
        tripId,
        userMessage: body.initial_message,
        template,
        preferences: body.preferences,
      }).catch((error) => {
        logger.error(`Background research failed for trip ${tripId}: ${error}`);
      })
    );

    // Return trip ID immediately
    return new Response(
      JSON.stringify({
        id: tripId,
        trip_id: tripId,  // Backwards compatibility
        status: 'researching',
        progress_message: 'Researching destinations...',
      }),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    logger.error(`Failed to create trip: ${error}`);
    return new Response(
      JSON.stringify({ error: 'Failed to create trip' }),
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
