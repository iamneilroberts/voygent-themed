/**
 * POST /api/trips/[id]/selections - Track user selections
 * GET /api/trips/[id]/selections - Get user selections
 *
 * Phase 7, Tasks T039-T042
 *
 * Tracks which options (flights, hotels, transport, tours) the user selected.
 * This data is used to build the handoff document for agent quotes.
 */

import { logEvent } from '../../lib/logger';

interface Selection {
  type: 'flight' | 'hotel' | 'transport' | 'tour';
  optionId: string;
  optionData: any;
}

interface SelectionRequest {
  selections: Selection[];
}

export async function onRequestPost(context: {
  request: Request;
  env: any;
  params: { id: string };
}): Promise<Response> {
  const { request, env, params } = context;
  const tripId = params.id;
  const correlationId = tripId;

  try {
    const body: SelectionRequest = await request.json();

    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'request',
      message: 'User selections submitted',
      metadata: {
        tripId,
        selectionCount: body.selections?.length || 0
      }
    });

    if (!body.selections || !Array.isArray(body.selections)) {
      return new Response(JSON.stringify({
        error: 'Invalid request',
        details: 'selections must be an array'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify trip exists
    const trip = await env.DB.prepare(`
      SELECT id FROM themed_trips WHERE id = ?
    `).bind(tripId).first();

    if (!trip) {
      await logEvent(env.DB, {
        correlationId,
        level: 'warn',
        category: 'request',
        message: 'Trip not found',
        metadata: { tripId }
      });

      return new Response(JSON.stringify({
        error: 'Trip not found',
        tripId
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Store each selection
    const now = new Date().toISOString();
    const results = [];

    for (const selection of body.selections) {
      if (!selection.type || !selection.optionId) {
        continue; // Skip invalid selections
      }

      try {
        await env.DB.prepare(`
          INSERT OR REPLACE INTO trip_selections (
            trip_id,
            selection_type,
            option_id,
            option_data,
            selected_at
          ) VALUES (?, ?, ?, ?, ?)
        `).bind(
          tripId,
          selection.type,
          selection.optionId,
          JSON.stringify(selection.optionData || {}),
          now
        ).run();

        results.push({
          type: selection.type,
          optionId: selection.optionId,
          status: 'saved'
        });

        await logEvent(env.DB, {
          correlationId,
          level: 'debug',
          category: 'selection',
          message: 'Selection saved',
          metadata: {
            tripId,
            type: selection.type,
            optionId: selection.optionId
          }
        });
      } catch (err: any) {
        console.error('Failed to save selection:', err);
        results.push({
          type: selection.type,
          optionId: selection.optionId,
          status: 'failed',
          error: err.message
        });
      }
    }

    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'selection',
      message: 'Selections processed',
      metadata: {
        tripId,
        savedCount: results.filter(r => r.status === 'saved').length,
        failedCount: results.filter(r => r.status === 'failed').length
      }
    });

    return new Response(JSON.stringify({
      tripId,
      results,
      message: 'Selections saved successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    await logEvent(env.DB, {
      correlationId,
      level: 'error',
      category: 'request',
      message: 'Selection save failed',
      metadata: { tripId, error: error.message }
    });

    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestGet(context: {
  request: Request;
  env: any;
  params: { id: string };
}): Promise<Response> {
  const { env, params } = context;
  const tripId = params.id;
  const correlationId = tripId;

  try {
    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'request',
      message: 'Selections requested',
      metadata: { tripId }
    });

    // Get all selections for this trip
    const { results } = await env.DB.prepare(`
      SELECT
        selection_type,
        option_id,
        option_data,
        selected_at
      FROM trip_selections
      WHERE trip_id = ?
      ORDER BY selected_at DESC
    `).bind(tripId).all() as { results: any[] };

    const selections = results.map(row => ({
      type: row.selection_type,
      optionId: row.option_id,
      optionData: JSON.parse(row.option_data || '{}'),
      selectedAt: row.selected_at
    }));

    // Group by type
    const grouped = {
      flight: selections.filter(s => s.type === 'flight'),
      hotel: selections.filter(s => s.type === 'hotel'),
      transport: selections.filter(s => s.type === 'transport'),
      tour: selections.filter(s => s.type === 'tour')
    };

    await logEvent(env.DB, {
      correlationId,
      level: 'debug',
      category: 'selection',
      message: 'Selections retrieved',
      metadata: {
        tripId,
        totalCount: selections.length
      }
    });

    return new Response(JSON.stringify({
      tripId,
      selections: grouped,
      totalCount: selections.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    await logEvent(env.DB, {
      correlationId,
      level: 'error',
      category: 'request',
      message: 'Selection retrieval failed',
      metadata: { tripId, error: error.message }
    });

    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
