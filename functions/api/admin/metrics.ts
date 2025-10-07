/**
 * Admin Metrics Endpoint
 * Feature: 006-add-full-logging
 * GET /api/admin/metrics
 *
 * Returns live and historical metrics for the admin dashboard.
 */

import { JWTUtils } from '../lib/jwt-utils';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

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

    // Parse query
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || '5m';
    const agencyId = url.searchParams.get('agency_id') || undefined;

    if (period === '5m') {
      // Live metrics - get latest snapshot
      let sql = 'SELECT * FROM metrics_snapshots';
      const bindings: any[] = [];

      if (agencyId) {
        sql += ' WHERE agency_id = ?';
        bindings.push(agencyId);
      } else {
        sql += ' WHERE agency_id IS NULL';
      }

      sql += ' ORDER BY timestamp DESC LIMIT 1';

      const snapshot = await env.DB.prepare(sql).bind(...bindings).first();

      if (!snapshot) {
        // Return empty metrics if no snapshot exists yet
        return new Response(JSON.stringify({
          timestamp: Date.now(),
          rpm: 0,
          error_rate: 0,
          avg_response_ms: 0,
          active_requests: 0,
          recent_errors: []
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get recent errors
      const errors = await env.DB.prepare(
        `SELECT id, timestamp, correlation_id as trip_id, operation as error_type, severity, message, agency_id
         FROM logs
         WHERE severity IN ('ERROR', 'CRITICAL')
         ORDER BY timestamp DESC
         LIMIT 20`
      ).all();

      const response = {
        timestamp: snapshot.timestamp as number,
        rpm: snapshot.rpm as number,
        error_rate: snapshot.error_rate as number,
        avg_response_ms: snapshot.avg_response_ms as number,
        active_requests: snapshot.active_requests as number,
        recent_errors: errors.results as any[]
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Historical metrics - get daily aggregates
      const days = period === '7d' ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0];

      let sql = 'SELECT * FROM daily_aggregates WHERE date >= ?';
      const bindings: any[] = [startDateStr];

      if (agencyId) {
        sql += ' AND agency_id = ?';
        bindings.push(agencyId);
      } else {
        sql += ' AND agency_id IS NULL';
      }

      sql += ' ORDER BY date ASC';

      const result = await env.DB.prepare(sql).bind(...bindings).all();
      const aggregates = result.results as any[];

      // Calculate summary
      const summary = {
        total_requests: aggregates.reduce((sum, a) => sum + a.total_requests, 0),
        total_errors: aggregates.reduce((sum, a) => sum + a.total_errors, 0),
        total_cost_usd: aggregates.reduce((sum, a) => sum + a.total_cost_usd, 0),
        avg_error_rate: aggregates.length > 0
          ? aggregates.reduce((sum, a) => sum + (a.total_errors / Math.max(a.total_requests, 1)), 0) / aggregates.length
          : 0,
        avg_response_ms: aggregates.length > 0
          ? aggregates.reduce((sum, a) => sum + a.avg_response_ms, 0) / aggregates.length
          : 0
      };

      const response = {
        period,
        data_points: aggregates,
        summary
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error: any) {
    console.error('[Admin Metrics] Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch metrics' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
