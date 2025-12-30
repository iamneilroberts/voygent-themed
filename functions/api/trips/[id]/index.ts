/**
 * GET /api/trips/:id
 * Returns current trip state including status, progress, and available data
 */

import { Env, createDatabaseClient, Destination, TripOption, ResearchSummary } from '../../../lib/db';
import { createLogger } from '../../../lib/logger';

export async function onRequestGet(context: { env: Env; params: { id: string } }): Promise<Response> {
  const logger = createLogger();
  const db = createDatabaseClient(context.env);

  const tripId = context.params.id;

  try {
    logger.info(`Fetching trip state: ${tripId}`);

    const trip = await db.getTrip(tripId);

    if (!trip) {
      return new Response(
        JSON.stringify({ error: 'Trip not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse JSON fields
    const researchDestinations: Destination[] = trip.research_destinations
      ? JSON.parse(trip.research_destinations)
      : [];

    const researchSummary: ResearchSummary | undefined = trip.research_summary
      ? JSON.parse(trip.research_summary)
      : undefined;

    const confirmedDestinations: string[] = trip.confirmed_destinations
      ? JSON.parse(trip.confirmed_destinations)
      : [];

    const options: TripOption[] = trip.options_json
      ? JSON.parse(trip.options_json)
      : [];

    const userPreferences = trip.preferences_json
      ? JSON.parse(trip.preferences_json)
      : undefined;

    // Parse telemetry logs
    let telemetryLogs = [];
    if (trip.telemetry_logs) {
      try {
        telemetryLogs = JSON.parse(trip.telemetry_logs);
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Build response
    const response = {
      trip_id: trip.id,
      template_id: trip.template_id,
      status: trip.status,
      progress_message: trip.progress_message,
      progress_percent: trip.progress_percent,

      // Phase 1 data
      research_summary: researchSummary,
      research_destinations: researchDestinations,
      destinations_confirmed: trip.destinations_confirmed === 1,
      confirmed_destinations: confirmedDestinations,

      // User preferences
      user_preferences: userPreferences,

      // Phase 2 data
      options: options,
      selected_option_index: trip.selected_option_index,
      total_cost_usd: trip.total_cost_usd,

      // Telemetry (for debug panel)
      ai_cost_usd: trip.ai_cost_usd,
      api_cost_usd: trip.api_cost_usd,
      telemetry_logs: telemetryLogs,

      created_at: trip.created_at,
      updated_at: trip.updated_at,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    logger.error(`Failed to fetch trip ${tripId}: ${error}`);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch trip' }),
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
