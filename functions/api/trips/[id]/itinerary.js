/**
 * POST /api/trips/:id/itinerary
 * Generate daily itinerary for a selected trip option (on-demand)
 */
import { createDatabaseClient } from '../../../lib/db';
import { createLogger } from '../../../lib/logger';
import { createTripBuilderService } from '../../../services/trip-builder-service';
export async function onRequestPost(context) {
    const tripId = context.params.id;
    const logger = createLogger();
    const db = createDatabaseClient(context.env);
    try {
        const body = await context.request.json();
        const { option_index } = body;
        if (option_index === undefined || option_index === null) {
            return new Response(JSON.stringify({ error: 'option_index is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        // Get trip state
        const trip = await db.getTrip(tripId);
        if (!trip) {
            return new Response(JSON.stringify({ error: 'Trip not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }
        // Parse options
        const options = trip.options_json ? JSON.parse(trip.options_json) : [];
        if (options.length === 0) {
            return new Response(JSON.stringify({ error: 'No trip options available' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        // Find the requested option
        const option = options.find(o => o.option_index === option_index);
        if (!option) {
            return new Response(JSON.stringify({ error: `Option ${option_index} not found` }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }
        // Check if itinerary already exists
        if (option.daily_itinerary && option.daily_itinerary.length > 0) {
            return new Response(JSON.stringify({
                success: true,
                option_index,
                daily_itinerary: option.daily_itinerary,
                cached: true,
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }
        // Get destinations and duration
        const destinations = trip.confirmed_destinations
            ? JSON.parse(trip.confirmed_destinations)
            : [];
        const preferences = trip.preferences_json ? JSON.parse(trip.preferences_json) : {};
        const tripDays = parseInt(preferences.duration?.match(/\d+/)?.[0] || '7');
        // Generate daily itinerary
        const tripBuilder = createTripBuilderService(context.env, db, logger);
        const updatedOption = await tripBuilder.generateDailyItinerary(tripId, option, destinations, tripDays);
        // Update the option in the database
        const updatedOptions = options.map(o => o.option_index === option_index ? updatedOption : o);
        await db.updateTripOptions(tripId, updatedOptions);
        logger.info(`Generated daily itinerary for trip ${tripId} option ${option_index}`);
        return new Response(JSON.stringify({
            success: true,
            option_index,
            daily_itinerary: updatedOption.daily_itinerary || [],
            cached: false,
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }
    catch (error) {
        logger.error(`Failed to generate itinerary for trip ${tripId}: ${error}`);
        await logger.logTelemetry(db, tripId, 'itinerary_error', {
            details: { error: error instanceof Error ? error.message : String(error) },
        });
        return new Response(JSON.stringify({
            error: 'Failed to generate itinerary',
            details: error instanceof Error ? error.message : 'Unknown error',
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
// CORS preflight
export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
