/**
 * Metrics Aggregator Module
 * Feature: 006-add-full-logging
 *
 * Computes pre-aggregated metrics for fast dashboard queries.
 * Generates 5-minute snapshots and daily aggregates.
 */

export interface MetricsSnapshot {
  id: string;
  timestamp: number;
  rpm: number;
  error_rate: number;
  avg_response_ms: number;
  active_requests: number;
  agency_id: string | null;
}

export interface DailyAggregate {
  id: string;
  date: string;
  total_requests: number;
  total_errors: number;
  total_cost_usd: number;
  avg_response_ms: number;
  p95_response_ms: number;
  p99_response_ms: number;
  provider_breakdown_json: string | null;
  endpoint_breakdown_json: string | null;
  agency_id: string | null;
}

export class MetricsAggregator {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Compute metrics for the last 5 minutes and store snapshot
   */
  async compute5MinMetrics(agencyId?: string): Promise<MetricsSnapshot> {
    const now = Date.now();
    const fiveMinAgo = now - (5 * 60 * 1000);

    // Query logs from last 5 minutes
    const query = agencyId
      ? `SELECT * FROM logs WHERE timestamp >= ? AND agency_id = ?`
      : `SELECT * FROM logs WHERE timestamp >= ?`;

    const params = agencyId ? [fiveMinAgo, agencyId] : [fiveMinAgo];
    const result = await this.db.prepare(query).bind(...params).all();
    const logs = result.results as any[];

    // Calculate metrics
    const totalLogs = logs.length;
    const errorLogs = logs.filter(l => l.severity === 'ERROR' || l.severity === 'CRITICAL').length;
    const responseLogs = logs.filter(l => l.operation === 'api_response' && l.duration_ms);
    const avgResponse = responseLogs.length > 0
      ? responseLogs.reduce((sum, l) => sum + (l.duration_ms || 0), 0) / responseLogs.length
      : 0;
    const activeLogs = logs.filter(l => l.status === null).length;

    const snapshot: MetricsSnapshot = {
      id: crypto.randomUUID(),
      timestamp: now,
      rpm: Math.round(totalLogs / 5), // Requests per minute
      error_rate: totalLogs > 0 ? errorLogs / totalLogs : 0,
      avg_response_ms: Math.round(avgResponse),
      active_requests: activeLogs,
      agency_id: agencyId || null
    };

    // Insert into metrics_snapshots
    await this.db.prepare(
      `INSERT INTO metrics_snapshots (id, timestamp, rpm, error_rate, avg_response_ms, active_requests, agency_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      snapshot.id,
      snapshot.timestamp,
      snapshot.rpm,
      snapshot.error_rate,
      snapshot.avg_response_ms,
      snapshot.active_requests,
      snapshot.agency_id
    ).run();

    return snapshot;
  }

  /**
   * Compute daily aggregate statistics for a given date
   */
  async computeDailyAggregate(date: string, agencyId?: string): Promise<DailyAggregate> {
    // Parse date (YYYY-MM-DD)
    const startOfDay = new Date(date).getTime();
    const endOfDay = startOfDay + (24 * 60 * 60 * 1000);

    // Query all logs for this day
    const query = agencyId
      ? `SELECT * FROM logs WHERE timestamp >= ? AND timestamp < ? AND agency_id = ?`
      : `SELECT * FROM logs WHERE timestamp >= ? AND timestamp < ?`;

    const params = agencyId ? [startOfDay, endOfDay, agencyId] : [startOfDay, endOfDay];
    const result = await this.db.prepare(query).bind(...params).all();
    const logs = result.results as any[];

    if (logs.length === 0) {
      throw new Error(`No logs found for date ${date}`);
    }

    // Calculate aggregates
    const totalRequests = logs.filter(l => l.operation === 'api_request').length;
    const totalErrors = logs.filter(l => l.severity === 'ERROR' || l.severity === 'CRITICAL').length;
    const responseLogs = logs.filter(l => l.duration_ms !== null);
    const responseTimes = responseLogs.map(l => l.duration_ms).sort((a, b) => a - b);

    const avgResponse = responseTimes.length > 0
      ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
      : 0;
    const p95 = responseTimes.length > 0
      ? responseTimes[Math.floor(responseTimes.length * 0.95)]
      : 0;
    const p99 = responseTimes.length > 0
      ? responseTimes[Math.floor(responseTimes.length * 0.99)]
      : 0;

    // Calculate total cost (from provider logs)
    const providerLogs = logs.filter(l => l.operation.includes('openai_') || l.operation.includes('anthropic_'));
    const totalCost = providerLogs.reduce((sum, l) => {
      try {
        const metadata = JSON.parse(l.metadata || '{}');
        return sum + (metadata.cost_usd || 0);
      } catch {
        return sum;
      }
    }, 0);

    // Provider breakdown
    const providerBreakdown: any = {};
    providerLogs.forEach(l => {
      const provider = l.operation.split('_')[0];
      providerBreakdown[provider] = (providerBreakdown[provider] || 0) + 1;
    });

    // Endpoint breakdown
    const endpointBreakdown: any = {};
    logs.forEach(l => {
      if (l.endpoint) {
        endpointBreakdown[l.endpoint] = (endpointBreakdown[l.endpoint] || 0) + 1;
      }
    });

    const aggregate: DailyAggregate = {
      id: crypto.randomUUID(),
      date,
      total_requests: totalRequests,
      total_errors: totalErrors,
      total_cost_usd: Math.round(totalCost * 100) / 100,
      avg_response_ms: Math.round(avgResponse),
      p95_response_ms: Math.round(p95),
      p99_response_ms: Math.round(p99),
      provider_breakdown_json: JSON.stringify(providerBreakdown),
      endpoint_breakdown_json: JSON.stringify(endpointBreakdown),
      agency_id: agencyId || null
    };

    // Insert into daily_aggregates
    await this.db.prepare(
      `INSERT INTO daily_aggregates (id, date, total_requests, total_errors, total_cost_usd, avg_response_ms, p95_response_ms, p99_response_ms, provider_breakdown_json, endpoint_breakdown_json, agency_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      aggregate.id,
      aggregate.date,
      aggregate.total_requests,
      aggregate.total_errors,
      aggregate.total_cost_usd,
      aggregate.avg_response_ms,
      aggregate.p95_response_ms,
      aggregate.p99_response_ms,
      aggregate.provider_breakdown_json,
      aggregate.endpoint_breakdown_json,
      aggregate.agency_id
    ).run();

    return aggregate;
  }
}
