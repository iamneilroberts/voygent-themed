/**
 * Scheduled Worker: Metrics Snapshot
 * Feature: 006-add-full-logging
 * Schedule: Every 5 minutes
 *
 * Computes 5-minute metrics snapshots for fast dashboard queries.
 */

import { MetricsAggregator } from '../api/lib/metrics-aggregator';

export const onSchedule: PagesFunction<Env> = async (context) => {
  const { env } = context;

  try {
    console.log('[Metrics Snapshot] Running scheduled metrics aggregation');

    const aggregator = new MetricsAggregator(env.DB);

    // Compute global metrics
    const globalMetrics = await aggregator.compute5MinMetrics();
    console.log('[Metrics Snapshot] Global metrics:', globalMetrics);

    // TODO: Compute per-agency metrics if needed
    // const agencies = await env.DB.prepare('SELECT DISTINCT id FROM agencies').all();
    // for (const agency of agencies.results) {
    //   await aggregator.compute5MinMetrics(agency.id as string);
    // }

    return new Response('Metrics snapshot completed', { status: 200 });
  } catch (error: any) {
    console.error('[Metrics Snapshot] Error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
};
