/**
 * GET /api/trips/[id]/logs - Stream logs for trip in real-time
 *
 * Phase 9, Task T052
 *
 * Returns logs for this trip, optionally filtered by level/category.
 * Supports real-time streaming for diagnostic window.
 */

import { logEvent } from '../../lib/logger';

export async function onRequestGet(context: {
  request: Request;
  env: any;
  params: { id: string };
}): Promise<Response> {
  const { request, env, params } = context;
  const tripId = params.id;

  try {
    const url = new URL(request.url);
    const level = url.searchParams.get('level') || 'all';
    const category = url.searchParams.get('category') || 'all';
    const since = url.searchParams.get('since'); // ISO timestamp
    const limit = parseInt(url.searchParams.get('limit') || '100');

    // Build query
    let query = `
      SELECT
        id,
        correlation_id,
        timestamp,
        severity,
        operation,
        message,
        metadata,
        request_id
      FROM logs
      WHERE correlation_id = ?
    `;

    const params: any[] = [tripId];

    if (level !== 'all') {
      query += ` AND severity = ?`;
      params.push(level.toUpperCase());
    }

    if (category !== 'all') {
      query += ` AND operation = ?`;
      params.push(category);
    }

    if (since) {
      query += ` AND timestamp > ?`;
      params.push(since);
    }

    query += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(Math.min(limit, 1000)); // Max 1000 logs

    const { results } = await env.DB.prepare(query)
      .bind(...params)
      .all();

    // Parse metadata JSON
    const logs = results.map((row: any) => ({
      id: row.id,
      timestamp: row.timestamp,
      level: row.severity?.toLowerCase() || 'info',
      category: row.operation,
      message: row.message,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      requestId: row.request_id
    }));

    // Log access (non-blocking)
    await logEvent(env.DB, {
      correlationId: tripId,
      level: 'debug',
      category: 'diagnostics',
      message: 'Logs accessed',
      metadata: {
        tripId,
        level,
        category,
        count: logs.length
      }
    }).catch(() => {});

    return new Response(JSON.stringify({
      tripId,
      logs,
      count: logs.length,
      filters: {
        level: level !== 'all' ? level : undefined,
        category: category !== 'all' ? category : undefined,
        since: since || undefined
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error: any) {
    await logEvent(env.DB, {
      correlationId: tripId,
      level: 'error',
      category: 'diagnostics',
      message: 'Logs retrieval failed',
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
