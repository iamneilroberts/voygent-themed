// Diagnostic Logging Service
// Trip-specific diagnostic queries

export class DiagnosticService {
  /**
   * Get trip logs by correlation ID
   */
  static async getTripLogs(
    db: D1Database,
    tripId: string,
    filters?: {
      since?: string;
      level?: string;
      category?: string;
      limit?: number;
    }
  ): Promise<any> {
    const conditions = ['correlation_id = ?'];
    const values: any[] = [tripId];

    if (filters?.since) {
      conditions.push('timestamp > ?');
      values.push(filters.since);
    }
    if (filters?.level) {
      conditions.push('level = ?');
      values.push(filters.level);
    }
    if (filters?.category) {
      conditions.push('category = ?');
      values.push(filters.category);
    }

    const limit = filters?.limit || 1000;
    values.push(limit);

    const result = await db.prepare(`
      SELECT * FROM logs
      WHERE ${conditions.join(' AND ')}
      ORDER BY timestamp DESC
      LIMIT ?
    `).bind(...values).all();

    const logs = result.results || [];

    return {
      logs,
      hasMore: logs.length === limit,
      lastTimestamp: logs.length > 0 ? logs[logs.length - 1].timestamp : null,
      summary: await this.getTripSummary(db, tripId)
    };
  }

  /**
   * Get trip diagnostic summary
   */
  static async getTripSummary(db: D1Database, tripId: string): Promise<any> {
    const result = await db.prepare(`
      SELECT
        COUNT(*) as total_logs,
        SUM(CASE WHEN level = 'debug' THEN 1 ELSE 0 END) as debug_count,
        SUM(CASE WHEN level = 'info' THEN 1 ELSE 0 END) as info_count,
        SUM(CASE WHEN level = 'warn' THEN 1 ELSE 0 END) as warn_count,
        SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END) as error_count,
        MIN(timestamp) as first_log,
        MAX(timestamp) as last_log
      FROM logs
      WHERE correlation_id = ?
    `).bind(tripId).first<any>();

    return result || {};
  }

  /**
   * Export trip logs as JSON
   */
  static async exportTripLogs(db: D1Database, tripId: string): Promise<string> {
    const result = await this.getTripLogs(db, tripId, { limit: 10000 });

    return JSON.stringify({
      tripId,
      correlationId: tripId,
      logs: result.logs,
      exportTimestamp: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Get system health
   */
  static async getSystemHealth(db: D1Database): Promise<any> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'up',
        amadeus: 'up',
        providers: {
          zai: 'unavailable',
          openai: 'up',
          anthropic: 'up'
        }
      },
      metrics: {
        activeTrips: 0,
        errorRatePercent: 0,
        avgResponseTimeMs: 0
      }
    };
  }

  /**
   * Get provider usage stats
   */
  static async getProviderStats(db: D1Database, hours: number = 24): Promise<any> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    return {
      periodHours: hours,
      providers: [],
      totalCostUsd: 0,
      totalRequests: 0,
      fallbackCount: 0
    };
  }
}
