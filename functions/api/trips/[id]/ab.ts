// DEPRECATED: PATCH /api/trips/:id/ab - Generate A/B variants based on preferences
//
// This endpoint is deprecated as of Feature 011 and will be removed after 30 days.
// Use the new template-driven options workflow instead:
// - POST /api/trips (creates trip with research)
// - PATCH /api/trips/:id/research (mark research viewed)
// - POST /api/trips/:id/options (generates options)
//
// Deprecation date: 2025-10-08
// Removal date: 2025-11-08

import { logEvent } from '../../lib/logger';

interface Env {
  DB: D1Database;
}

export async function onRequestPatch(context: { request: Request; env: Env; params: { id: string } }) {
  const { env, params } = context;

  const tripId = params.id;

  try {
    // Log deprecation warning
    await logEvent(env.DB, {
      correlationId: tripId,
      level: 'warn',
      category: 'request',
      message: 'DEPRECATED: A/B endpoint called',
      metadata: {
        tripId,
        deprecationDate: '2025-10-08',
        removalDate: '2025-11-08',
        migrationPath: '/api/trips/:id/options'
      }
    });

    // Return deprecation warning
    return new Response(JSON.stringify({
      error: 'Endpoint deprecated',
      message: 'The A/B comparison endpoint has been deprecated as of 2025-10-08 and will be removed on 2025-11-08.',
      migration: {
        newWorkflow: [
          'POST /api/trips (creates trip with research)',
          'PATCH /api/trips/:id/research (mark research viewed)',
          'POST /api/trips/:id/options (generates options)'
        ],
        documentation: 'See specs/011-transform-voygent-to/ for migration guide'
      },
      deprecationWarning: 'Please migrate to the new template-driven options workflow'
    }), {
      status: 410, // Gone
      headers: {
        'Content-Type': 'application/json',
        'Deprecation': 'true',
        'Sunset': 'Wed, 08 Nov 2025 00:00:00 GMT'
      }
    });

  } catch (error: any) {
    console.error('Error in deprecated A/B endpoint:', error);

    await logEvent(env.DB, {
      correlationId: tripId,
      level: 'error',
      category: 'request',
      message: 'Error in deprecated A/B endpoint',
      metadata: { tripId, error: error.message }
    });

    return new Response(JSON.stringify({
      error: 'Endpoint deprecated',
      message: 'This endpoint is no longer supported. Please use the new template-driven workflow.'
    }), {
      status: 410,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
