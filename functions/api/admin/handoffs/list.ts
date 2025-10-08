/**
 * GET /api/admin/handoffs/list - List all handoff documents (admin view)
 *
 * Phase 8, Task T050
 *
 * Admin endpoint to view all handoffs with filtering and pagination.
 */

import { logEvent } from '../../lib/logger';

export async function onRequestGet(context: {
  request: Request;
  env: any;
}): Promise<Response> {
  const { request, env } = context;
  const correlationId = crypto.randomUUID();

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'all';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'admin',
      message: 'Handoffs list requested',
      metadata: { status, limit, offset }
    });

    // Build query
    let query = `
      SELECT
        h.id,
        h.trip_id,
        h.user_id,
        h.total_estimate_usd,
        h.margin_percent,
        h.agent_id,
        h.agent_quote_usd,
        h.quote_status,
        h.created_at,
        h.quoted_at,
        h.expires_at
      FROM handoff_documents h
    `;

    const params: any[] = [];

    if (status !== 'all') {
      query += ` WHERE h.quote_status = ?`;
      params.push(status);
    }

    query += ` ORDER BY h.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const { results } = await env.DB.prepare(query)
      .bind(...params)
      .all();

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM handoff_documents`;
    if (status !== 'all') {
      countQuery += ` WHERE quote_status = ?`;
    }

    const countResult = await env.DB.prepare(countQuery)
      .bind(...(status !== 'all' ? [status] : []))
      .first<{ total: number }>();

    await logEvent(env.DB, {
      correlationId,
      level: 'debug',
      category: 'admin',
      message: 'Handoffs list retrieved',
      metadata: {
        count: results.length,
        total: countResult?.total || 0
      }
    });

    return new Response(JSON.stringify({
      handoffs: results,
      total: countResult?.total || 0,
      limit,
      offset,
      status
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    await logEvent(env.DB, {
      correlationId,
      level: 'error',
      category: 'admin',
      message: 'Handoffs list failed',
      metadata: { error: error.message }
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
