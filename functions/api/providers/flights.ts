/**
 * Flights Provider Endpoint
 * GET /api/providers/flights
 * Feature: 001-web-search-integration
 *
 * Returns flight offers with Amadeus primary, Kiwi fallback.
 * Results cached for 24h.
 */

import * as amadeus from '../lib/amadeus';
import * as kiwi from '../lib/kiwi';

interface Env {
  DB: any;
  AMADEUS_CLIENT_ID: string;
  AMADEUS_CLIENT_SECRET: string;
  AMADEUS_API_URL: string;
  KIWI_API_KEY: string;
  KIWI_API_URL: string;
}

export async function onRequest(context: { request: Request; env: Env }) {
  const { request, env } = context;

  // Only allow GET
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Parse query params
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const month = url.searchParams.get('month');
    const adults = parseInt(url.searchParams.get('adults') || '2');
    const route_type = (url.searchParams.get('route_type') || 'round_trip') as 'round_trip' | 'one_way';

    // Validate required params
    if (!from || !to || !month) {
      return new Response(
        JSON.stringify({
          error: 'Missing required parameters',
          details: 'from, to, and month are required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate IATA codes
    const iataPattern = /^[A-Z]{3}$/;
    if (!iataPattern.test(from) || !iataPattern.test(to)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid IATA code',
          details: 'from and to must be 3-letter airport codes',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid month format',
          details: 'month must be YYYY-MM',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Try Amadeus first
    let result;
    try {
      result = await amadeus.searchFlights(env, { from, to, month, adults, route_type });
    } catch (error) {
      console.error('Amadeus flight search failed:', error);

      // Fallback to Kiwi
      try {
        result = await kiwi.searchFlights(env, { from, to, month, adults, route_type });
      } catch (kiwiError) {
        console.error('Kiwi flight search failed:', kiwiError);

        return new Response(
          JSON.stringify({
            error: 'Provider unavailable',
            details: 'Both Amadeus and Kiwi APIs failed',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Flight search error:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
