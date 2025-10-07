/**
 * Scheduled Worker: Daily Aggregate
 * Feature: 006-add-full-logging
 * Schedule: Daily at 4 AM UTC
 *
 * Computes daily aggregate statistics for historical trend analysis.
 */

import { MetricsAggregator } from '../api/lib/metrics-aggregator';

export const onSchedule: PagesFunction<Env> = async (context) => {
  const { env } = context;

  try {
    console.log('[Daily Aggregate] Running daily aggregation');

    // Get yesterday's date (YYYY-MM-DD)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    const aggregator = new MetricsAggregator(env.DB);

    // Compute global aggregate
    const aggregate = await aggregator.computeDailyAggregate(dateStr);
    console.log('[Daily Aggregate] Completed for', dateStr, aggregate);

    return new Response('Daily aggregate completed', { status: 200 });
  } catch (error: any) {
    console.error('[Daily Aggregate] Error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
};
