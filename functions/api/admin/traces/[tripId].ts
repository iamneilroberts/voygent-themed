/**
 * Admin Traces Endpoint
 * Feature: 006-add-full-logging
 * GET /api/admin/traces/:tripId
 *
 * Returns complete request trace for a specific trip ID.
 */

import { JWTUtils } from '../../lib/jwt-utils';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;

  try {
    // Verify JWT
    const authHeader = request.headers.get('Authorization');
    const cookieHeader = request.headers.get('Cookie');
    let token: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (cookieHeader) {
      const match = cookieHeader.match(/admin_token=([^;]+)/);
      token = match ? match[1] : null;
    }

    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const payload = await JWTUtils.verifyToken(token, env.JWT_SECRET || 'dev-secret-key');
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const tripId = params.tripId as string;

    // Query all logs for this trip
    const result = await env.DB.prepare(
      'SELECT * FROM logs WHERE correlation_id = ? ORDER BY timestamp ASC'
    ).bind(tripId).all();

    const logs = result.results as any[];

    if (logs.length === 0) {
      return new Response(JSON.stringify({ error: 'Trip not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calculate summary
    const totalDuration = logs
      .filter(l => l.duration_ms)
      .reduce((sum, l) => sum + (l.duration_ms || 0), 0);
    const errorCount = logs.filter(l => l.severity === 'ERROR' || l.severity === 'CRITICAL').length;
    const status = errorCount > 0 ? 'failure' :
                   logs.some(l => l.status === 'failure') ? 'partial' : 'success';

    const response = {
      trip_id: tripId,
      logs,
      summary: {
        total_operations: logs.length,
        total_duration_ms: totalDuration,
        error_count: errorCount,
        status
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('[Admin Traces] Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch trace' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
