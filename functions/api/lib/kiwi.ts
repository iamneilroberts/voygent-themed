/**
 * Kiwi Tequila API Client
 * Feature: 001-web-search-integration
 *
 * Fallback provider for flight search when Amadeus unavailable.
 * Free tier: 100 requests/day
 */

import { getCached, setCached, TTL, generateQueryHash } from './cache';
import type { D1Database } from '@cloudflare/workers-types';

interface KiwiEnv {
  KIWI_API_KEY: string;
  KIWI_API_URL: string; // https://api.tequila.kiwi.com
}

/**
 * Search flights (Kiwi Tequila /v2/search)
 */
export async function searchFlights(
  env: KiwiEnv & { DB: D1Database },
  params: {
    from: string; // IATA code
    to: string;   // IATA code
    month: string; // YYYY-MM
    adults?: number;
    route_type?: 'round_trip' | 'one_way';
  }
) {
  const { from, to, month, adults = 2, route_type = 'round_trip' } = params;

  // Generate cache key
  const queryHash = await generateQueryHash({ provider: 'kiwi-flights', from, to, month, adults, route_type });

  // Check cache
  const cached = await getCached(env.DB, 'kiwi', queryHash);
  if (cached) {
    return { ...JSON.parse(cached.response_json), cached: true, cache_age_seconds: cached.cache_age_seconds };
  }

  // Fetch from Kiwi API
  const dateFrom = `${month}-01`;
  const dateTo = `${month}-28`; // Search entire month

  const url = new URL(`${env.KIWI_API_URL}/v2/search`);
  url.searchParams.set('fly_from', from);
  url.searchParams.set('fly_to', to);
  url.searchParams.set('date_from', dateFrom);
  url.searchParams.set('date_to', dateTo);
  if (route_type === 'round_trip') {
    url.searchParams.set('return_from', dateFrom);
    url.searchParams.set('return_to', dateTo);
  }
  url.searchParams.set('adults', adults.toString());
  url.searchParams.set('curr', 'USD');
  url.searchParams.set('limit', '50');

  const response = await fetch(url.toString(), {
    headers: {
      'apikey': env.KIWI_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Kiwi flight search failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Extract prices
  const flights = data.data || [];
  if (flights.length === 0) {
    throw new Error('No flight offers found');
  }

  const prices = flights.map((f: any) => parseFloat(f.price || 0)).filter((p: number) => p > 0);
  prices.sort((a: number, b: number) => a - b);

  const result = {
    provider: 'kiwi',
    route: `${from}-${to} ${route_type === 'round_trip' ? 'round-trip' : 'one-way'}`,
    offers: [
      {
        price_low: prices[0] || 0,
        price_median: prices[Math.floor(prices.length / 2)] || 0,
        price_high: prices[prices.length - 1],
        carrier: flights[0]?.airlines?.[0] || 'Multiple carriers',
        route_type,
        estimate_date: new Date().toISOString(),
      },
    ],
    cached: false,
  };

  // Store in cache
  await setCached(env.DB, 'kiwi', queryHash, params, JSON.stringify(result), TTL.FLIGHTS);

  return result;
}
