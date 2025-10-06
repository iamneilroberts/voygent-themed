/**
 * Professional Handoff Endpoint
 * GET /api/handoff/:id
 * Feature: 001-web-search-integration
 *
 * Generates JSON export for travel professional booking.
 * Includes ancestry context, hotels, airfare, cost estimate, and complete itinerary.
 */

interface Env {
  DB: any;
}

export async function onRequest(context: { request: Request; env: Env; params: { id: string } }) {
  const { request, env, params } = context;

  // Only allow GET
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const tripId = params.id;

    // Query heritage_trips
    const trip = await env.DB
      .prepare(
        `SELECT id, intake_json, options_json, itinerary_json, variants_json, created_at
         FROM heritage_trips
         WHERE id = ?`
      )
      .bind(tripId)
      .first();

    if (!trip) {
      return new Response(
        JSON.stringify({
          error: 'Trip not found',
          details: `No trip found with id ${tripId}`,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse JSON fields
    const intake = trip.intake_json ? JSON.parse(trip.intake_json as string) : {};
    const options = trip.options_json ? JSON.parse(trip.options_json as string) : {};
    const itinerary = trip.itinerary_json ? JSON.parse(trip.itinerary_json as string) : {};
    const variants = trip.variants_json ? JSON.parse(trip.variants_json as string) : {};

    // Build Pro Handoff JSON
    const handoff = {
      trip_id: trip.id,
      created_at: new Date((trip.created_at as number) * 1000).toISOString(),
      intake: {
        surnames: intake.surnames || [],
        suspected_origins: intake.suspected_origins || [],
        immigration_window: intake.immigration_window,
        party: intake.party || {},
        duration_days: intake.duration_days,
        target_month: intake.target_month,
        departure_airport: intake.departure_airport,
        transport_pref: intake.transport_pref,
        hotel_type: intake.hotel_type,
        luxury_level: intake.luxury_level,
        activity_level: intake.activity_level,
        interests: intake.interests || [],
      },
      ancestry_context: intake.ancestry_context || null,
      selected_option: options.selected || null,
      itinerary: itinerary || {},
      hotels_shown: itinerary.hotels_shown || [],
      hotels_selected: variants.hotels_selected || [],
      airfare_estimate: variants.airfare_estimate || null,
      cost_estimate: variants.cost_estimate || null,
    };

    // Set Content-Disposition header for download
    const filename = `trip-${tripId}-handoff.json`;

    return new Response(JSON.stringify(handoff, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Handoff generation error:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
