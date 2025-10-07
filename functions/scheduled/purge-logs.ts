/**
 * Scheduled Worker: Log Purge
 * Feature: 006-add-full-logging
 * Schedule: Daily at 3 AM UTC
 *
 * Purges logs older than 1 year to maintain database performance.
 */

export const onSchedule: PagesFunction<Env> = async (context) => {
  const { env } = context;

  try {
    console.log('[Log Purge] Starting log purge');

    const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);

    // Delete logs in batches
    let totalDeleted = 0;
    let batchDeleted = 0;

    do {
      const result = await env.DB.prepare(
        'DELETE FROM logs WHERE timestamp < ? LIMIT 1000'
      ).bind(oneYearAgo).run();

      batchDeleted = result.changes || 0;
      totalDeleted += batchDeleted;

      console.log(`[Log Purge] Deleted ${batchDeleted} logs (total: ${totalDeleted})`);

      // Sleep briefly to avoid overloading
      if (batchDeleted === 1000) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } while (batchDeleted === 1000);

    // Also purge old metrics snapshots
    await env.DB.prepare(
      'DELETE FROM metrics_snapshots WHERE timestamp < ?'
    ).bind(oneYearAgo).run();

    console.log(`[Log Purge] Complete. Deleted ${totalDeleted} logs.`);

    return new Response(`Purged ${totalDeleted} logs`, { status: 200 });
  } catch (error: any) {
    console.error('[Log Purge] Error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
};
