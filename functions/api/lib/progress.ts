/**
 * Progress tracking helper for trip generation
 */

interface ProgressUpdate {
  step: string;
  message: string;
  percent: number;
}

/**
 * Update progress in database for a trip
 * @param db - D1 Database instance
 * @param tripId - Trip ID to update
 * @param update - Progress update data
 */
export async function updateProgress(
  db: D1Database,
  tripId: string,
  update: ProgressUpdate
): Promise<void> {
  try {
    await db
      .prepare(
        'UPDATE themed_trips SET progress_step = ?, progress_message = ?, progress_percent = ?, updated_at = unixepoch() WHERE id = ?'
      )
      .bind(update.step, update.message, update.percent, tripId)
      .run();

    console.log(`[Progress] ${tripId}: ${update.percent}% - ${update.message}`);
  } catch (error) {
    console.error(`[Progress] Failed to update progress for ${tripId}:`, error);
    // Don't throw - progress updates should be non-blocking
  }
}

/**
 * Pre-defined progress steps for trip generation
 */
export const PROGRESS_STEPS = {
  intake: {
    step: 'intake',
    message: 'Understanding your preferences...',
    percent: 10
  },
  research: {
    step: 'research',
    message: 'Researching destinations...',
    percent: 40
  },
  options: {
    step: 'options',
    message: 'Creating trip options...',
    percent: 70
  },
  finalizing: {
    step: 'finalizing',
    message: 'Finalizing itinerary...',
    percent: 95
  },
  complete: {
    step: 'complete',
    message: 'Trip ready!',
    percent: 100
  }
};

/**
 * Get theme-specific research message
 */
export function getResearchMessage(theme: string): string {
  const messages: Record<string, string> = {
    heritage: 'Researching family heritage sites...',
    tvmovie: 'Finding filming locations...',
    historical: 'Researching historical sites...',
    culinary: 'Finding culinary destinations...',
    adventure: 'Finding adventure destinations...'
  };
  return messages[theme] || 'Researching destinations...';
}
