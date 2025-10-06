/**
 * Hotels Provider Endpoint
 * GET /api/providers/hotels
 * Feature: 001-web-search-integration
 *
 * Returns 2-3 hotel listings with Amadeus primary, Serper.dev fallback.
 * Results cached for 24h.
 */

import * as amadeus from '../lib/amadeus';
import * as serper from '../lib/serper';

interface Env {
  DB: any;
  AMADEUS_CLIENT_ID: string;
  AMADEUS_CLIENT_SECRET: string;
  AMADEUS_API_URL: string;
  SERPER_API_KEY: string;
  SERPER_API_URL: string;
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
    const city = url.searchParams.get('city');
    const checkin = url.searchParams.get('checkin');
    const nights = parseInt(url.searchParams.get('nights') || '3');
    const luxury = (url.searchParams.get('luxury') || 'comfort') as 'budget' | 'comfort' | 'premium' | 'luxury';
    const adults = parseInt(url.searchParams.get('adults') || '2');

    // Validate required params
    if (!city || !checkin) {
      return new Response(
        JSON.stringify({
          error: 'Missing required parameters',
          details: 'city and checkin are required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkin)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid date format',
          details: 'checkin must be YYYY-MM-DD',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Try Amadeus first
    let result;
    try {
      result = await amadeus.searchHotels(env, { city, checkin, nights, luxury, adults });
    } catch (error) {
      console.error('Amadeus hotel search failed:', error);

      // Fallback to Serper.dev
      try {
        result = await serper.searchHotels(env, { city, checkin, nights, luxury, adults });
      } catch (serperError) {
        console.error('Serper hotel search failed:', serperError);

        return new Response(
          JSON.stringify({
            error: 'No hotels found',
            details: `Limited availability in ${city} - travel pro will find alternatives`,
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Hotel search error:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
