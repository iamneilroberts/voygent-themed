/**
 * POST /api/trips/[id]/handoff - Create handoff document for agent quote
 * GET /api/trips/[id]/handoff - Get handoff document
 *
 * Phase 8, Tasks T043, T044
 *
 * Creates comprehensive handoff document with:
 * - Chat history (last 100 messages)
 * - Research summary
 * - User preferences
 * - All options shown (flights, hotels, transport, tours)
 * - Selected options
 * - Daily itinerary
 * - Total estimate with margin
 */

import { HandoffService } from '../../lib/services/handoff-service';
import { logEvent } from '../../lib/logger';

export async function onRequestPost(context: {
  request: Request;
  env: any;
  params: { id: string };
}): Promise<Response> {
  const { request, env, params } = context;
  const tripId = params.id;
  const correlationId = tripId;

  try {
    const body = await request.json().catch(() => ({}));
    const userId = body.userId || 'anonymous';

    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'handoff',
      message: 'Handoff document creation requested',
      metadata: { tripId, userId }
    });

    // Verify trip exists and has required data
    const trip = await env.DB.prepare(`
      SELECT
        id,
        template_id,
        intake_json,
        research_summary,
        options_json,
        status
      FROM themed_trips
      WHERE id = ?
    `).bind(tripId).first();

    if (!trip) {
      await logEvent(env.DB, {
        correlationId,
        level: 'warn',
        category: 'handoff',
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

    if (trip.status !== 'options_ready' && trip.status !== 'selected') {
      await logEvent(env.DB, {
        correlationId,
        level: 'warn',
        category: 'handoff',
        message: 'Trip not ready for handoff',
        metadata: { tripId, status: trip.status }
      });

      return new Response(JSON.stringify({
        error: 'Trip must have options generated before handoff',
        tripId,
        currentStatus: trip.status
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if handoff already exists
    const existingHandoff = await env.DB.prepare(`
      SELECT id, quote_status, created_at
      FROM handoff_documents
      WHERE trip_id = ?
    `).bind(tripId).first();

    if (existingHandoff) {
      await logEvent(env.DB, {
        correlationId,
        level: 'info',
        category: 'handoff',
        message: 'Handoff document already exists',
        metadata: { tripId, handoffId: existingHandoff.id }
      });

      return new Response(JSON.stringify({
        handoffId: existingHandoff.id,
        tripId,
        quoteStatus: existingHandoff.quote_status,
        createdAt: existingHandoff.created_at,
        message: 'Handoff document already exists'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create handoff document using HandoffService
    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'handoff',
      message: 'Assembling handoff document',
      metadata: { tripId }
    });

    const result = await HandoffService.createHandoffDocument(
      env.DB,
      tripId,
      userId
    );

    if (!result.success || !result.handoffId) {
      await logEvent(env.DB, {
        correlationId,
        level: 'error',
        category: 'handoff',
        message: 'Handoff creation failed',
        metadata: { tripId, error: result.error }
      });

      return new Response(JSON.stringify({
        error: 'Failed to create handoff document',
        details: result.error
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'handoff',
      message: 'Handoff document created successfully',
      metadata: { tripId, handoffId: result.handoffId }
    });

    return new Response(JSON.stringify({
      handoffId: result.handoffId,
      tripId,
      quoteStatus: 'pending',
      expiresAt: result.expiresAt,
      message: 'Handoff document created successfully'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    await logEvent(env.DB, {
      correlationId,
      level: 'error',
      category: 'handoff',
      message: 'Handoff creation failed',
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
      category: 'handoff',
      message: 'Handoff document requested',
      metadata: { tripId }
    });

    // Get handoff document
    const handoff = await env.DB.prepare(`
      SELECT * FROM handoff_documents WHERE trip_id = ?
    `).bind(tripId).first();

    if (!handoff) {
      await logEvent(env.DB, {
        correlationId,
        level: 'warn',
        category: 'handoff',
        message: 'Handoff document not found',
        metadata: { tripId }
      });

      return new Response(JSON.stringify({
        error: 'Handoff document not found',
        tripId,
        suggestion: 'Create handoff document with POST request'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse JSON fields
    const document = {
      id: handoff.id,
      tripId: handoff.trip_id,
      userId: handoff.user_id,
      chatHistory: JSON.parse(handoff.chat_history || '[]'),
      researchSummary: handoff.research_summary,
      userPreferences: JSON.parse(handoff.user_preferences || '{}'),
      allFlightOptions: JSON.parse(handoff.all_flight_options || '[]'),
      selectedFlightId: handoff.selected_flight_id,
      allHotelOptions: JSON.parse(handoff.all_hotel_options || '[]'),
      selectedHotelIds: handoff.selected_hotel_ids ? JSON.parse(handoff.selected_hotel_ids) : null,
      allTransportOptions: handoff.all_transport_options ? JSON.parse(handoff.all_transport_options) : null,
      selectedTransportIds: handoff.selected_transport_ids ? JSON.parse(handoff.selected_transport_ids) : null,
      dailyItinerary: JSON.parse(handoff.daily_itinerary || '[]'),
      totalEstimateUsd: handoff.total_estimate_usd,
      marginPercent: handoff.margin_percent,
      agentId: handoff.agent_id,
      agentQuoteUsd: handoff.agent_quote_usd,
      agentNotes: handoff.agent_notes,
      quoteStatus: handoff.quote_status,
      pdfUrl: handoff.pdf_url,
      jsonExport: handoff.json_export,
      createdAt: handoff.created_at,
      quotedAt: handoff.quoted_at,
      expiresAt: handoff.expires_at
    };

    await logEvent(env.DB, {
      correlationId,
      level: 'debug',
      category: 'handoff',
      message: 'Handoff document retrieved',
      metadata: { tripId, handoffId: document.id }
    });

    return new Response(JSON.stringify(document), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    await logEvent(env.DB, {
      correlationId,
      level: 'error',
      category: 'handoff',
      message: 'Handoff retrieval failed',
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
