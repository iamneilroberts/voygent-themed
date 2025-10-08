/**
 * GET /api/trips/[id]/research - Get research status
 * PATCH /api/trips/[id]/research - Mark research as viewed
 *
 * Phase 6, Tasks T031, T032
 */

import { logEvent } from '../../lib/logger';

interface ResearchStatus {
  tripId: string;
  hasResearch: boolean;
  researchSummary?: string;
  researchViewed: boolean;
  canGenerateOptions: boolean;
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
      message: 'Research status requested',
      metadata: { tripId }
    });

    // Get trip research data
    const trip = await env.DB.prepare(`
      SELECT
        id,
        research_summary,
        research_viewed,
        status
      FROM themed_trips
      WHERE id = ?
    `).bind(tripId).first<{
      id: string;
      research_summary: string | null;
      research_viewed: number;
      status: string;
    }>();

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

    const hasResearch = !!trip.research_summary;
    const researchViewed = trip.research_viewed === 1;
    const canGenerateOptions = researchViewed || !hasResearch;

    const response: ResearchStatus = {
      tripId: trip.id,
      hasResearch,
      researchViewed,
      canGenerateOptions
    };

    // Include research summary if present
    if (hasResearch && trip.research_summary) {
      response.researchSummary = trip.research_summary;
    }

    await logEvent(env.DB, {
      correlationId,
      level: 'debug',
      category: 'research',
      message: 'Research status retrieved',
      metadata: {
        tripId,
        hasResearch,
        researchViewed,
        canGenerateOptions
      }
    });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    await logEvent(env.DB, {
      correlationId,
      level: 'error',
      category: 'request',
      message: 'Research status failed',
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

export async function onRequestPatch(context: {
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
      message: 'Mark research as viewed',
      metadata: { tripId }
    });

    // Check if trip exists and has research
    const trip = await env.DB.prepare(`
      SELECT
        id,
        research_summary,
        research_viewed
      FROM themed_trips
      WHERE id = ?
    `).bind(tripId).first<{
      id: string;
      research_summary: string | null;
      research_viewed: number;
    }>();

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

    if (!trip.research_summary) {
      await logEvent(env.DB, {
        correlationId,
        level: 'warn',
        category: 'research',
        message: 'No research to mark as viewed',
        metadata: { tripId }
      });

      return new Response(JSON.stringify({
        error: 'No research available for this trip',
        tripId
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Already viewed?
    if (trip.research_viewed === 1) {
      await logEvent(env.DB, {
        correlationId,
        level: 'debug',
        category: 'research',
        message: 'Research already marked as viewed',
        metadata: { tripId }
      });

      return new Response(JSON.stringify({
        success: true,
        tripId,
        message: 'Research already viewed',
        canGenerateOptions: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Mark as viewed
    const result = await env.DB.prepare(`
      UPDATE themed_trips
      SET research_viewed = 1
      WHERE id = ?
    `).bind(tripId).run();

    if (!result.success) {
      throw new Error('Failed to update research_viewed flag');
    }

    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'research',
      message: 'Research marked as viewed',
      metadata: { tripId }
    });

    return new Response(JSON.stringify({
      success: true,
      tripId,
      message: 'Research marked as viewed',
      canGenerateOptions: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    await logEvent(env.DB, {
      correlationId,
      level: 'error',
      category: 'request',
      message: 'Mark research viewed failed',
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
