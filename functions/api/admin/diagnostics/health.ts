/**
 * GET /api/admin/diagnostics/health - System health check
 *
 * Phase 9, Task T054
 *
 * Returns system health metrics:
 * - Database connectivity
 * - Recent error rates
 * - Provider availability
 * - Active trips count
 * - Template status
 */

import { logEvent } from '../../lib/logger';

export async function onRequestGet(context: {
  request: Request;
  env: any;
}): Promise<Response> {
  const { env } = context;
  const correlationId = crypto.randomUUID();

  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    // Check database connectivity
    let dbHealthy = true;
    try {
      await env.DB.prepare('SELECT 1').first();
    } catch (e) {
      dbHealthy = false;
    }

    // Get recent error rate (last hour)
    const { results: recentErrors } = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM logs
      WHERE level = 'error'
        AND timestamp > ?
    `).bind(oneHourAgo).all();

    const errorCount = recentErrors[0]?.count || 0;

    // Get active trips (created in last 24h)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const { results: activeTrips } = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM themed_trips
      WHERE created_at > ?
    `).bind(oneDayAgo).all();

    const activeTripCount = activeTrips[0]?.count || 0;

    // Get template count
    const { results: templates } = await env.DB.prepare(`
      SELECT COUNT(*) as total, SUM(is_active) as active
      FROM trip_templates
    `).bind().all();

    const templateStats = templates[0] || { total: 0, active: 0 };

    // Get pending handoffs
    const { results: pendingHandoffs } = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM handoff_documents
      WHERE quote_status = 'pending'
        AND expires_at > ?
    `).bind(now.toISOString()).all();

    const pendingHandoffCount = pendingHandoffs[0]?.count || 0;

    // Provider health (check recent provider logs)
    const { results: providerLogs } = await env.DB.prepare(`
      SELECT category, level, COUNT(*) as count
      FROM logs
      WHERE (category = 'provider' OR category = 'amadeus' OR category = 'tripadvisor')
        AND timestamp > ?
      GROUP BY category, level
    `).bind(oneHourAgo).all();

    const providerHealth: any = {};
    for (const log of providerLogs) {
      if (!providerHealth[log.category]) {
        providerHealth[log.category] = { total: 0, errors: 0 };
      }
      providerHealth[log.category].total += log.count;
      if (log.level === 'error') {
        providerHealth[log.category].errors += log.count;
      }
    }

    // Calculate overall health status
    const isHealthy = dbHealthy && errorCount < 10;
    const status = isHealthy ? 'healthy' : 'degraded';

    const health = {
      status,
      timestamp: now.toISOString(),
      database: {
        connected: dbHealthy
      },
      errors: {
        lastHour: errorCount,
        threshold: 10
      },
      trips: {
        activeLast24h: activeTripCount
      },
      templates: {
        total: templateStats.total,
        active: templateStats.active
      },
      handoffs: {
        pending: pendingHandoffCount
      },
      providers: providerHealth
    };

    // Log health check (non-blocking)
    await logEvent(env.DB, {
      correlationId,
      level: 'debug',
      category: 'admin',
      message: 'Health check performed',
      metadata: { status, errorCount }
    }).catch(() => {});

    return new Response(JSON.stringify(health), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, max-age=30'
      }
    });

  } catch (error: any) {
    await logEvent(env.DB, {
      correlationId,
      level: 'error',
      category: 'admin',
      message: 'Health check failed',
      metadata: { error: error.message }
    }).catch(() => {});

    return new Response(JSON.stringify({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
