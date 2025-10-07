/**
 * Request Quote Endpoint
 * POST /api/trips/:id/request-quote
 *
 * Handles traveler intake form submission and creates handoff record for agents.
 * Stores complete traveler details + trip information in themed_trips.handoff_json.
 */

interface Env {
  DB: D1Database;
}

interface TravelerIntakeForm {
  primary_name: string;
  email: string;
  phone?: string;
  travelers?: string; // All travelers with ages
  passport_status?: string;
  restrictions?: string; // Dietary/medical
  airline_loyalty?: string;
  hotel_loyalty?: string;
  contact_method?: string;
  agency_id?: string; // For white-label routing
}

interface ThemedTrip {
  id: string;
  user_id: string | null;
  template: string;
  title: string | null;
  intake_json: string | null;
  options_json: string | null;
  itinerary_json: string | null;
  variants_json: string | null;
  status: string;
  created_at: number;
  updated_at: number;
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
  params: { id: string };
}): Promise<Response> {
  const { request, env, params } = context;
  const tripId = params.id;

  try {
    const formData: TravelerIntakeForm = await request.json();

    console.log('[Request Quote] Processing quote request for trip:', tripId);

    // Validate required fields
    if (!formData.primary_name || !formData.email) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          details: 'primary_name and email are required'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Basic email validation
    if (!formData.email.includes('@')) {
      return new Response(
        JSON.stringify({
          error: 'Invalid email',
          details: 'Please provide a valid email address'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Load existing trip
    const trip = await env.DB.prepare('SELECT * FROM themed_trips WHERE id = ?')
      .bind(tripId)
      .first<ThemedTrip>();

    if (!trip) {
      console.log('[Request Quote] Trip not found:', tripId);
      return new Response(
        JSON.stringify({
          error: 'Trip not found'
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Build handoff payload
    const handoffPayload = {
      traveler: {
        primary_name: formData.primary_name,
        email: formData.email,
        phone: formData.phone || null,
        all_travelers: formData.travelers || null,
        passport_status: formData.passport_status || null,
        restrictions: formData.restrictions || null,
        airline_loyalty: formData.airline_loyalty || null,
        hotel_loyalty: formData.hotel_loyalty || null,
        contact_method: formData.contact_method || 'email'
      },
      trip: {
        theme: trip.template, // Using 'template' field from database
        intake: trip.intake_json ? JSON.parse(trip.intake_json) : {},
        research: trip.options_json ? JSON.parse(trip.options_json) : {}, // Research stored in options_json
        itinerary: trip.itinerary_json ? JSON.parse(trip.itinerary_json) : {},
        variants: trip.variants_json ? JSON.parse(trip.variants_json) : {}
      },
      requested_at: new Date().toISOString(),
      agency_id: formData.agency_id || null
    };

    console.log('[Request Quote] Storing handoff payload for trip:', tripId);

    // Store handoff payload and update status
    const result = await env.DB.prepare(
      'UPDATE themed_trips SET handoff_json = ?, status = ?, updated_at = unixepoch() WHERE id = ?'
    )
      .bind(JSON.stringify(handoffPayload), 'quote_requested', tripId)
      .run();

    if (!result.success) {
      throw new Error('Failed to update trip with handoff data');
    }

    console.log('[Request Quote] Quote request submitted successfully for trip:', tripId);

    // TODO: Notify agent pool (separate feature)
    // This would send email/notification to agents about new quote request

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Quote request submitted successfully'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('[Request Quote] Error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to submit quote request',
        details: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
