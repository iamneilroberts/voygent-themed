/**
 * GET /api/trips/[id]/handoff/export?format=pdf|json - Export handoff document
 *
 * Phase 8, Tasks T045, T046
 *
 * Returns handoff document in PDF or JSON format for agent download.
 */

import { logEvent } from '../../../lib/logger';

export async function onRequestGet(context: {
  request: Request;
  env: any;
  params: { id: string };
}): Promise<Response> {
  const { request, env, params } = context;
  const tripId = params.id;
  const correlationId = tripId;

  try {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';

    if (format !== 'pdf' && format !== 'json') {
      return new Response(JSON.stringify({
        error: 'Invalid format',
        details: 'Format must be "pdf" or "json"'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'handoff',
      message: 'Handoff export requested',
      metadata: { tripId, format }
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
        tripId
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (format === 'json') {
      // Return JSON export
      const jsonExport = {
        handoffId: handoff.id,
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
        createdAt: handoff.created_at,
        quotedAt: handoff.quoted_at,
        expiresAt: handoff.expires_at,
        exportedAt: new Date().toISOString()
      };

      await logEvent(env.DB, {
        correlationId,
        level: 'info',
        category: 'handoff',
        message: 'JSON export generated',
        metadata: { tripId, handoffId: handoff.id }
      });

      return new Response(JSON.stringify(jsonExport, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="handoff-${handoff.id}.json"`
        }
      });
    }

    // PDF export
    // TODO: Generate PDF using library or external service
    await logEvent(env.DB, {
      correlationId,
      level: 'warn',
      category: 'handoff',
      message: 'PDF generation not yet implemented',
      metadata: { tripId, handoffId: handoff.id }
    });

    // For now, return a formatted text version
    const textContent = `
HANDOFF DOCUMENT
================

Handoff ID: ${handoff.id}
Trip ID: ${handoff.trip_id}
Created: ${handoff.created_at}
Expires: ${handoff.expires_at}
Status: ${handoff.quote_status}

RESEARCH SUMMARY
----------------
${handoff.research_summary || 'No research available'}

USER PREFERENCES
----------------
${JSON.stringify(JSON.parse(handoff.user_preferences || '{}'), null, 2)}

DAILY ITINERARY
---------------
${JSON.stringify(JSON.parse(handoff.daily_itinerary || '[]'), null, 2)}

TOTAL ESTIMATE
--------------
$${handoff.total_estimate_usd} USD (includes ${handoff.margin_percent}% margin)

AGENT INFORMATION
-----------------
Agent ID: ${handoff.agent_id || 'Not assigned'}
Quote: ${handoff.agent_quote_usd ? `$${handoff.agent_quote_usd} USD` : 'Pending'}
Notes: ${handoff.agent_notes || 'None'}

---
This is a text representation. PDF generation coming soon.
Export Date: ${new Date().toISOString()}
`;

    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'handoff',
      message: 'Text export generated (PDF placeholder)',
      metadata: { tripId, handoffId: handoff.id }
    });

    return new Response(textContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="handoff-${handoff.id}.txt"`
      }
    });

  } catch (error: any) {
    await logEvent(env.DB, {
      correlationId,
      level: 'error',
      category: 'handoff',
      message: 'Handoff export failed',
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
