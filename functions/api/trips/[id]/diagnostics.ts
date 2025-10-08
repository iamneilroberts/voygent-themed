/**
 * GET /api/trips/[id]/diagnostics - Get complete diagnostics for trip
 *
 * Phase 9, Task T051
 *
 * Returns comprehensive diagnostic information including:
 * - All logs for this trip (via correlation_id)
 * - Provider calls and costs
 * - Template used
 * - Research workflow
 * - Options generation
 * - Price estimates
 * - Handoff status
 */

import { DiagnosticService } from '../../lib/services/diagnostic-service';
import { logEvent } from '../../lib/logger';

export async function onRequestGet(context: {
  request: Request;
  env: any;
  params: { id: string };
}): Promise<Response> {
  const { env, params } = context;
  const tripId = params.id;

  try {
    // Get diagnostic data using DiagnosticService
    const diagnostics = await DiagnosticService.getTripDiagnostics(env.DB, tripId);

    if (!diagnostics.success) {
      return new Response(JSON.stringify({
        error: diagnostics.error || 'Failed to retrieve diagnostics',
        tripId
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Log diagnostic access (non-blocking)
    await logEvent(env.DB, {
      correlationId: tripId,
      level: 'debug',
      category: 'diagnostics',
      message: 'Diagnostics accessed',
      metadata: { tripId }
    }).catch(() => {});

    return new Response(JSON.stringify(diagnostics.data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    await logEvent(env.DB, {
      correlationId: tripId,
      level: 'error',
      category: 'diagnostics',
      message: 'Diagnostics retrieval failed',
      metadata: { tripId, error: error.message }
    }).catch(() => {});

    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
