// GET /api/trips/:id - Get trip by ID
// PATCH /api/trips/:id - Update trip title/intake
import { getTrip, updateTrip, listTrips } from '../../lib/db';

interface Env {
  DB: D1Database;
}

export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }) {
  const { env, params, request } = context;

  try {
    // Check if this is a list request (no ID, has query params)
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!params.id && userId) {
      // List trips for user
      const trips = await listTrips(env.DB, userId);
      return new Response(JSON.stringify({ trips }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get single trip
    const trip = await getTrip(env.DB, params.id);

    if (!trip) {
      return new Response(JSON.stringify({ error: 'Trip not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      id: trip.id,
      userId: trip.user_id,
      template: trip.template,
      title: trip.title,
      intake: trip.intake_json ? JSON.parse(trip.intake_json) : null,
      options: trip.options_json ? JSON.parse(trip.options_json) : null,
      itinerary: trip.itinerary_json ? JSON.parse(trip.itinerary_json) : null,
      variants: trip.variants_json ? JSON.parse(trip.variants_json) : null,
      status: trip.status,
      createdAt: trip.created_at,
      updatedAt: trip.updated_at
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in GET /api/trips/:id:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPatch(context: { request: Request; env: Env; params: { id: string } }) {
  const { request, env, params } = context;

  try {
    const body = await request.json();
    const { title, intake } = body;

    const trip = await getTrip(env.DB, params.id);
    if (!trip) {
      return new Response(JSON.stringify({ error: 'Trip not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const updates: any = {};
    if (title) updates.title = title;
    if (intake) updates.intake_json = JSON.stringify(intake);

    await updateTrip(env.DB, params.id, updates);

    return new Response(JSON.stringify({ success: true, tripId: params.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in PATCH /api/trips/:id:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
