/**
 * POST /api/agent/quotes - Submit agent quote for handoff document
 * GET /api/agent/quotes - List agent's assigned quotes
 *
 * Phase 8, Tasks T047, T048
 *
 * Allows travel agents to:
 * - Submit quotes for handoff documents
 * - View their assigned handoffs
 * - Update quote status
 */

import { logEvent } from '../lib/logger';

interface SubmitQuoteRequest {
  handoffId: string;
  agentId: string;
  quoteUsd: number;
  notes?: string;
}

export async function onRequestPost(context: {
  request: Request;
  env: any;
}): Promise<Response> {
  const { request, env } = context;

  try {
    const body: SubmitQuoteRequest = await request.json();

    await logEvent(env.DB, {
      correlationId: body.handoffId,
      level: 'info',
      category: 'agent',
      message: 'Agent quote submission',
      metadata: {
        handoffId: body.handoffId,
        agentId: body.agentId,
        quoteUsd: body.quoteUsd
      }
    });

    // Validate required fields
    if (!body.handoffId || !body.agentId || !body.quoteUsd) {
      return new Response(JSON.stringify({
        error: 'Missing required fields',
        required: ['handoffId', 'agentId', 'quoteUsd']
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (body.quoteUsd <= 0) {
      return new Response(JSON.stringify({
        error: 'Invalid quote amount',
        details: 'Quote must be greater than 0'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get handoff document
    const handoff = await env.DB.prepare(`
      SELECT
        id,
        trip_id,
        total_estimate_usd,
        quote_status,
        expires_at
      FROM handoff_documents
      WHERE id = ?
    `).bind(body.handoffId).first();

    if (!handoff) {
      await logEvent(env.DB, {
        correlationId: body.handoffId,
        level: 'warn',
        category: 'agent',
        message: 'Handoff document not found',
        metadata: { handoffId: body.handoffId }
      });

      return new Response(JSON.stringify({
        error: 'Handoff document not found',
        handoffId: body.handoffId
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(handoff.expires_at);

    if (now > expiresAt) {
      await logEvent(env.DB, {
        correlationId: body.handoffId,
        level: 'warn',
        category: 'agent',
        message: 'Handoff document expired',
        metadata: { handoffId: body.handoffId, expiresAt: handoff.expires_at }
      });

      return new Response(JSON.stringify({
        error: 'Handoff document has expired',
        handoffId: body.handoffId,
        expiresAt: handoff.expires_at
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate quote is >= estimate (agent adds their margin on top)
    if (body.quoteUsd < handoff.total_estimate_usd) {
      await logEvent(env.DB, {
        correlationId: body.handoffId,
        level: 'warn',
        category: 'agent',
        message: 'Quote below estimated cost',
        metadata: {
          handoffId: body.handoffId,
          quoteUsd: body.quoteUsd,
          estimateUsd: handoff.total_estimate_usd
        }
      });

      return new Response(JSON.stringify({
        error: 'Quote must be at least the estimated cost',
        quoteUsd: body.quoteUsd,
        minimumUsd: handoff.total_estimate_usd
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update handoff with agent quote
    const quotedAt = new Date().toISOString();

    const result = await env.DB.prepare(`
      UPDATE handoff_documents
      SET
        agent_id = ?,
        agent_quote_usd = ?,
        agent_notes = ?,
        quote_status = 'quoted',
        quoted_at = ?
      WHERE id = ?
    `).bind(
      body.agentId,
      body.quoteUsd,
      body.notes || null,
      quotedAt,
      body.handoffId
    ).run();

    if (!result.success) {
      throw new Error('Failed to update handoff document');
    }

    await logEvent(env.DB, {
      correlationId: body.handoffId,
      level: 'info',
      category: 'agent',
      message: 'Quote submitted successfully',
      metadata: {
        handoffId: body.handoffId,
        agentId: body.agentId,
        quoteUsd: body.quoteUsd
      }
    });

    return new Response(JSON.stringify({
      success: true,
      handoffId: body.handoffId,
      tripId: handoff.trip_id,
      quoteUsd: body.quoteUsd,
      quotedAt,
      message: 'Quote submitted successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    await logEvent(env.DB, {
      correlationId: 'unknown',
      level: 'error',
      category: 'agent',
      message: 'Quote submission failed',
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

export async function onRequestGet(context: {
  request: Request;
  env: any;
}): Promise<Response> {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const agentId = url.searchParams.get('agentId');
    const status = url.searchParams.get('status') || 'all';

    if (!agentId) {
      return new Response(JSON.stringify({
        error: 'Missing required parameter',
        required: ['agentId']
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await logEvent(env.DB, {
      correlationId: agentId,
      level: 'info',
      category: 'agent',
      message: 'Agent quotes list requested',
      metadata: { agentId, status }
    });

    // Build query based on status filter
    let query = `
      SELECT
        h.id,
        h.trip_id,
        h.user_id,
        h.total_estimate_usd,
        h.agent_quote_usd,
        h.agent_notes,
        h.quote_status,
        h.created_at,
        h.quoted_at,
        h.expires_at
      FROM handoff_documents h
      WHERE h.agent_id = ?
    `;

    const params: any[] = [agentId];

    if (status !== 'all') {
      query += ` AND h.quote_status = ?`;
      params.push(status);
    }

    query += ` ORDER BY h.created_at DESC`;

    const { results } = await env.DB.prepare(query)
      .bind(...params)
      .all();

    await logEvent(env.DB, {
      correlationId: agentId,
      level: 'debug',
      category: 'agent',
      message: 'Agent quotes retrieved',
      metadata: { agentId, count: results.length }
    });

    return new Response(JSON.stringify({
      agentId,
      quotes: results,
      count: results.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    await logEvent(env.DB, {
      correlationId: 'unknown',
      level: 'error',
      category: 'agent',
      message: 'Agent quotes list failed',
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
