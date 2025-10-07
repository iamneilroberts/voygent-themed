/**
 * Admin Export Endpoint
 * Feature: 006-add-full-logging
 * GET /api/admin/export
 *
 * Exports logs as JSON file for download.
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
    const startDate = url.searchParams.get('start_date') || '';
    const endDate = url.searchParams.get('end_date') || '';
    const severity = url.searchParams.get('severity') || 'ALL';
    const agencyId = url.searchParams.get('agency_id') || undefined;

    if (!startDate || !endDate) {
      return new Response(JSON.stringify({ error: 'start_date and end_date required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Convert dates to timestamps
    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime() + (24 * 60 * 60 * 1000); // End of day

    // Build query
    let sql = 'SELECT * FROM logs WHERE timestamp >= ? AND timestamp < ?';
    const bindings: any[] = [startTime, endTime];

    if (severity !== 'ALL') {
      sql += ' AND severity = ?';
      bindings.push(severity);
    }

    if (agencyId) {
      sql += ' AND agency_id = ?';
      bindings.push(agencyId);
    }

    sql += ' ORDER BY timestamp ASC';

    const result = await env.DB.prepare(sql).bind(...bindings).all();

    const exportData = {
      logs: result.results as any[],
      exported_at: Date.now(),
      filters: {
        start_date: startDate,
        end_date: endDate,
        severity,
        agency_id: agencyId,
        format: 'json'
      },
      total_count: result.results.length
    };

    const filename = `voygent-logs-${startDate}-to-${endDate}.json`;

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (error: any) {
    console.error('[Admin Export] Error:', error);
    return new Response(JSON.stringify({ error: 'Export failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
