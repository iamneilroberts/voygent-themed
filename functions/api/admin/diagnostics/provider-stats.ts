/**
 * GET /api/admin/diagnostics/provider-stats - Provider usage statistics
 *
 * Phase 9, Task T055
 *
 * Returns aggregated statistics about provider usage:
 * - Call counts per provider
 * - Error rates
 * - Average costs
 * - Token usage
 * - Success/failure rates
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
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    let dateFilter = '';
    const params: any[] = [];

    if (startDate && endDate) {
      dateFilter = ' AND timestamp >= ? AND timestamp <= ?';
      params.push(startDate, endDate);
    } else if (startDate) {
      dateFilter = ' AND timestamp >= ?';
      params.push(startDate);
    }

    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'admin',
      message: 'Provider stats requested',
      metadata: { startDate, endDate }
    });

    // Get provider logs grouped by operation and severity
    const { results: providerLogs } = await env.DB.prepare(`
      SELECT
        operation,
        severity,
        COUNT(*) as count,
        metadata
      FROM logs
      WHERE (operation IN ('provider', 'amadeus', 'tripadvisor', 'research'))
        ${dateFilter}
      GROUP BY operation, severity
    `).bind(...params).all();

    // Get detailed provider call data from metadata
    const { results: detailedLogs } = await env.DB.prepare(`
      SELECT metadata
      FROM logs
      WHERE (operation IN ('provider', 'amadeus', 'tripadvisor'))
        AND metadata IS NOT NULL
        ${dateFilter}
      LIMIT 1000
    `).bind(...params).all();

    // Parse metadata to extract costs and token counts
    const providerStats: any = {
      openai: { calls: 0, errors: 0, totalCost: 0, totalTokens: 0 },
      anthropic: { calls: 0, errors: 0, totalCost: 0, totalTokens: 0 },
      zai: { calls: 0, errors: 0, totalCost: 0, totalTokens: 0 },
      amadeus: { calls: 0, errors: 0 },
      tripadvisor: { calls: 0, errors: 0 }
    };

    for (const log of detailedLogs) {
      try {
        const metadata = JSON.parse(log.metadata);

        if (metadata.provider) {
          const provider = metadata.provider.toLowerCase();
          if (providerStats[provider]) {
            providerStats[provider].calls++;

            if (metadata.costUsd) {
              providerStats[provider].totalCost += metadata.costUsd;
            }

            if (metadata.tokensIn || metadata.tokensOut) {
              providerStats[provider].totalTokens +=
                (metadata.tokensIn || 0) + (metadata.tokensOut || 0);
            }
          }
        }
      } catch (e) {
        // Skip invalid metadata
      }
    }

    // Add error counts from aggregated logs
    for (const log of providerLogs) {
      if (log.severity === 'ERROR') {
        if (log.operation === 'amadeus' && providerStats.amadeus) {
          providerStats.amadeus.errors += log.count;
        } else if (log.operation === 'tripadvisor' && providerStats.tripadvisor) {
          providerStats.tripadvisor.errors += log.count;
        }
      }
    }

    // Calculate derived metrics
    const stats = Object.entries(providerStats).map(([provider, data]: [string, any]) => ({
      provider,
      calls: data.calls,
      errors: data.errors,
      successRate: data.calls > 0 ? ((data.calls - data.errors) / data.calls * 100).toFixed(2) : '0.00',
      totalCostUsd: data.totalCost?.toFixed(4) || '0.0000',
      avgCostPerCall: data.calls > 0 ? (data.totalCost / data.calls).toFixed(4) : '0.0000',
      totalTokens: data.totalTokens || 0,
      avgTokensPerCall: data.calls > 0 ? Math.round(data.totalTokens / data.calls) : 0
    }));

    // Calculate totals
    const totals = {
      totalCalls: stats.reduce((sum, s) => sum + s.calls, 0),
      totalErrors: stats.reduce((sum, s) => sum + s.errors, 0),
      totalCost: stats.reduce((sum, s) => sum + parseFloat(s.totalCostUsd), 0).toFixed(4),
      totalTokens: stats.reduce((sum, s) => sum + s.totalTokens, 0)
    };

    await logEvent(env.DB, {
      correlationId,
      level: 'debug',
      category: 'admin',
      message: 'Provider stats retrieved',
      metadata: { totalCalls: totals.totalCalls }
    });

    return new Response(JSON.stringify({
      dateRange: {
        start: startDate || 'all time',
        end: endDate || 'now'
      },
      stats,
      totals,
      generatedAt: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    await logEvent(env.DB, {
      correlationId,
      level: 'error',
      category: 'admin',
      message: 'Provider stats failed',
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
