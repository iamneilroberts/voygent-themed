/**
 * POST /api/admin/diagnostics/export - Export diagnostic data
 *
 * Phase 9, Task T053
 *
 * Exports comprehensive diagnostic data for analysis:
 * - All trips within date range
 * - Provider usage and costs
 * - Error rates
 * - Performance metrics
 */

import { logEvent } from '../../lib/logger';

interface ExportRequest {
  startDate: string;
  endDate: string;
  format?: 'json' | 'csv';
}

export async function onRequestPost(context: {
  request: Request;
  env: any;
}): Promise<Response> {
  const { request, env } = context;
  const correlationId = crypto.randomUUID();

  try {
    const body: ExportRequest = await request.json();

    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'admin',
      message: 'Diagnostic export requested',
      metadata: {
        startDate: body.startDate,
        endDate: body.endDate,
        format: body.format || 'json'
      }
    });

    if (!body.startDate || !body.endDate) {
      return new Response(JSON.stringify({
        error: 'Missing required fields',
        required: ['startDate', 'endDate']
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const format = body.format || 'json';

    // Get all trips in date range
    const { results: trips } = await env.DB.prepare(`
      SELECT
        id,
        template_id,
        user_id,
        status,
        created_at,
        intake_json,
        research_summary
      FROM themed_trips
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
    `).bind(body.startDate, body.endDate).all();

    // Get logs for these trips
    const tripIds = trips.map((t: any) => t.id);
    let allLogs: any[] = [];

    if (tripIds.length > 0) {
      // Get logs in batches to avoid query limits
      const batchSize = 50;
      for (let i = 0; i < tripIds.length; i += batchSize) {
        const batch = tripIds.slice(i, i + batchSize);
        const placeholders = batch.map(() => '?').join(',');

        const { results } = await env.DB.prepare(`
          SELECT *
          FROM logs
          WHERE correlation_id IN (${placeholders})
        `).bind(...batch).all();

        allLogs = allLogs.concat(results);
      }
    }

    // Calculate statistics
    const stats = {
      totalTrips: trips.length,
      totalLogs: allLogs.length,
      errorCount: allLogs.filter((l: any) => l.level === 'error').length,
      warnCount: allLogs.filter((l: any) => l.level === 'warn').length,
      providerCalls: allLogs.filter((l: any) => l.category === 'provider' || l.category === 'amadeus').length,
      templateUsage: trips.reduce((acc: any, t: any) => {
        acc[t.template_id] = (acc[t.template_id] || 0) + 1;
        return acc;
      }, {})
    };

    if (format === 'csv') {
      // Generate CSV
      const csvRows = [
        'Trip ID,Template ID,User ID,Status,Created At,Error Count,Log Count'
      ];

      for (const trip of trips) {
        const tripLogs = allLogs.filter((l: any) => l.correlation_id === trip.id);
        const errorCount = tripLogs.filter((l: any) => l.level === 'error').length;

        csvRows.push([
          trip.id,
          trip.template_id,
          trip.user_id,
          trip.status,
          trip.created_at,
          errorCount,
          tripLogs.length
        ].join(','));
      }

      const csv = csvRows.join('\n');

      await logEvent(env.DB, {
        correlationId,
        level: 'info',
        category: 'admin',
        message: 'CSV export generated',
        metadata: { tripCount: trips.length }
      });

      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="diagnostics-${body.startDate}-to-${body.endDate}.csv"`
        }
      });
    }

    // JSON export
    const exportData = {
      dateRange: {
        start: body.startDate,
        end: body.endDate
      },
      stats,
      trips: trips.map((t: any) => ({
        ...t,
        intake_json: t.intake_json ? JSON.parse(t.intake_json) : null,
        logs: allLogs.filter((l: any) => l.correlation_id === t.id).map((l: any) => ({
          ...l,
          metadata: l.metadata ? JSON.parse(l.metadata) : null
        }))
      })),
      exportedAt: new Date().toISOString()
    };

    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'admin',
      message: 'JSON export generated',
      metadata: { tripCount: trips.length }
    });

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="diagnostics-${body.startDate}-to-${body.endDate}.json"`
      }
    });

  } catch (error: any) {
    await logEvent(env.DB, {
      correlationId,
      level: 'error',
      category: 'admin',
      message: 'Diagnostic export failed',
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
