/**
 * Admin Logs Query Endpoint
 * Feature: 006-add-full-logging
 * GET /api/admin/logs
 *
 * Returns filtered log entries for the admin dashboard.
 */

import { JWTUtils } from '../lib/jwt-utils';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    // Verify JWT from cookie or Authorization header
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

    // Parse query params
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const severity = url.searchParams.get('severity') || 'ALL';
    const startTime = url.searchParams.get('start_time') ? parseInt(url.searchParams.get('start_time')!) : undefined;
    const endTime = url.searchParams.get('end_time') ? parseInt(url.searchParams.get('end_time')!) : undefined;
    const agencyId = url.searchParams.get('agency_id') || undefined;
    const requestId = url.searchParams.get('request_id') || undefined;
    const correlationId = url.searchParams.get('correlation_id') || undefined;
    const endpoint = url.searchParams.get('endpoint') || undefined;

    // Build SQL query
    let sql = 'SELECT * FROM logs WHERE 1=1';
    const bindings: any[] = [];

    if (severity !== 'ALL') {
      sql += ' AND severity = ?';
      bindings.push(severity);
    }

    if (startTime) {
      sql += ' AND timestamp >= ?';
      bindings.push(startTime);
    }

    if (endTime) {
      sql += ' AND timestamp <= ?';
      bindings.push(endTime);
    }

    if (agencyId) {
      sql += ' AND agency_id = ?';
      bindings.push(agencyId);
    } else if (payload.role === 'agency_admin' && payload.agencyId) {
      // Agency admins can only see their own logs
      sql += ' AND agency_id = ?';
      bindings.push(payload.agencyId);
    }

    if (requestId) {
      sql += ' AND request_id = ?';
      bindings.push(requestId);
    }

    if (correlationId) {
      sql += ' AND correlation_id = ?';
      bindings.push(correlationId);
    }

    if (endpoint) {
      sql += ' AND endpoint = ?';
      bindings.push(endpoint);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    bindings.push(limit);

    // Execute query
    const result = await env.DB.prepare(sql).bind(...bindings).all();

    const response = {
      logs: result.results as any[],
      total: result.results.length,
      page: 1,
      limit
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('[Admin Logs] Query error:', error);
    return new Response(JSON.stringify({ error: 'Query failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
