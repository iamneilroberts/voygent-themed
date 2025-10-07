// GET /api/trips/:id/progress - Get real-time progress for trip generation

interface Env {
  DB: D1Database;
}

export async function onRequestGet(context: { params: { id: string }; env: Env }) {
  const { params, env } = context;
  const tripId = params.id;

  try {
    // Query progress from database
    const result = await env.DB.prepare(
      'SELECT progress_step, progress_message, progress_percent, status FROM themed_trips WHERE id = ?'
    ).bind(tripId).first();

    if (!result) {
      return new Response(JSON.stringify({
        error: 'Trip not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Determine if complete
    const complete = result.status === 'options_ready' || result.status === 'selected' || result.status === 'booked';

    return new Response(JSON.stringify({
      step: result.progress_step || 'unknown',
      message: result.progress_message || 'Processing...',
      percent: result.progress_percent || 0,
      complete,
      status: result.status
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error: any) {
    console.error('Error fetching progress:', error);

    return new Response(JSON.stringify({
      error: 'Failed to fetch progress',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
