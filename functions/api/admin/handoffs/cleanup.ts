/**
 * POST /api/admin/handoffs/cleanup - Cleanup expired handoff documents
 *
 * Phase 8, Task T049
 *
 * Archives or deletes expired handoff documents (30+ days old, status=pending).
 * Should be run daily via cron trigger.
 */

import { logEvent } from '../../lib/logger';

export async function onRequestPost(context: {
  request: Request;
  env: any;
}): Promise<Response> {
  const { env } = context;
  const correlationId = crypto.randomUUID();

  try {
    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'admin',
      message: 'Handoff cleanup initiated',
      metadata: {}
    });

    const now = new Date().toISOString();

    // Find expired pending handoffs
    const { results: expiredHandoffs } = await env.DB.prepare(`
      SELECT id, trip_id, expires_at
      FROM handoff_documents
      WHERE quote_status = 'pending'
        AND expires_at < ?
    `).bind(now).all();

    if (expiredHandoffs.length === 0) {
      await logEvent(env.DB, {
        correlationId,
        level: 'info',
        category: 'admin',
        message: 'No expired handoffs to cleanup',
        metadata: {}
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'No expired handoffs found',
        cleanedCount: 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'admin',
      message: 'Found expired handoffs',
      metadata: { count: expiredHandoffs.length }
    });

    // Update status to 'cancelled' instead of deleting
    // (keeps data for analytics, but marks as inactive)
    const result = await env.DB.prepare(`
      UPDATE handoff_documents
      SET quote_status = 'cancelled'
      WHERE quote_status = 'pending'
        AND expires_at < ?
    `).bind(now).run();

    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'admin',
      message: 'Handoff cleanup completed',
      metadata: {
        cleanedCount: result.meta.changes || 0,
        expiredIds: expiredHandoffs.map((h: any) => h.id)
      }
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Expired handoffs cleaned up',
      cleanedCount: result.meta.changes || 0,
      handoffs: expiredHandoffs.map((h: any) => ({
        id: h.id,
        tripId: h.trip_id,
        expiredAt: h.expires_at
      }))
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    await logEvent(env.DB, {
      correlationId,
      level: 'error',
      category: 'admin',
      message: 'Handoff cleanup failed',
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
