/**
 * Serper.dev API Client
 * Feature: 001-web-search-integration
 *
 * Primary provider for hotel search fallback and general web search.
 * Free tier: 2,500 searches/month
 */

import { getCached, setCached, TTL, generateQueryHash } from './cache';
import type { D1Database } from '@cloudflare/workers-types';

interface SerperEnv {
  SERPER_API_KEY: string;
  SERPER_API_URL: string; // https://google.serper.dev
}

/**
 * Search hotels via Google Hotels (Serper.dev fallback)
 */
export async function searchHotels(
  env: SerperEnv & { DB: D1Database },
  params: {
    city: string;
    checkin: string; // YYYY-MM-DD
    nights: number;
    luxury?: 'budget' | 'comfort' | 'premium' | 'luxury';
    adults?: number;
  }
) {
  const { city, checkin, nights, luxury = 'comfort', adults = 2 } = params;

  // Generate cache key
  const queryHash = await generateQueryHash({ provider: 'serper-hotels', city, checkin, nights, luxury, adults });

  // Check cache
  const cached = await getCached(env.DB, 'serper', queryHash);
  if (cached) {
    return { ...JSON.parse(cached.response_json), cached: true, cache_age_seconds: cached.cache_age_seconds };
  }

  // Fetch from Serper.dev
  const query = `hotels in ${city}`;

  const response = await fetch(`${env.SERPER_API_URL}/search`, {
    method: 'POST',
    headers: {
      'X-API-KEY': env.SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      gl: 'us',
    }),
  });

  if (!response.ok) {
    throw new Error(`Serper hotel search failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Extract hotel cards from organic results
  const hotels = (data.organic || [])
    .filter((result: any) => result.title && result.link)
    .slice(0, 3)
    .map((result: any) => {
      // Extract price if available (rough estimate)
      const priceMatch = result.snippet?.match(/\$(\d+)/);
      const basePrice = priceMatch ? parseInt(priceMatch[1]) : 120;

      return {
        hotel_id: result.link,
        name: result.title,
        city,
        nightly_price_low: Math.floor(basePrice * 0.9),
        nightly_price_high: Math.ceil(basePrice * 1.1),
        star_rating: 3.5, // Default, would need Google Places enrichment for accurate rating
        budget_tier: luxury,
        provider: 'serper',
        booking_reference: result.link,
        availability_disclaimer: 'availability not guaranteed',
      };
    });

  if (hotels.length === 0) {
    throw new Error('No hotels found');
  }

  const result = {
    provider: 'serper',
    city,
    checkin,
    nights,
    hotels,
    cached: false,
  };

  // Store in cache
  await setCached(env.DB, 'serper', queryHash, params, JSON.stringify(result), TTL.HOTELS);

  return result;
}

/**
 * General web search (Serper.dev primary)
 */
export async function webSearch(
  env: SerperEnv & { DB: D1Database },
  params: {
    q: string;
    city?: string;
    month?: string;
    max_results?: number;
  }
) {
  const { q, city, month, max_results = 10 } = params;

  // Generate cache key using city+topic+month composite
  const cacheKey = `${city || 'global'}_${q.slice(0, 20).replace(/\s+/g, '_')}_${month || 'any'}`;
  const queryHash = await generateQueryHash({ provider: 'serper-search', cache_key: cacheKey });

  // Check cache
  const cached = await getCached(env.DB, 'serper', queryHash);
  if (cached) {
    return { ...JSON.parse(cached.response_json), cached: true, cache_age_seconds: cached.cache_age_seconds };
  }

  // Fetch from Serper.dev
  const response = await fetch(`${env.SERPER_API_URL}/search`, {
    method: 'POST',
    headers: {
      'X-API-KEY': env.SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q,
      gl: 'us',
      num: max_results,
    }),
  });

  if (!response.ok) {
    throw new Error(`Serper search failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  const results = (data.organic || []).slice(0, max_results).map((result: any, index: number) => ({
    title: result.title,
    url: result.link,
    snippet: result.snippet,
    position: index + 1,
  }));

  const searchResult = {
    provider: 'serper',
    query: q,
    cache_key: cacheKey,
    results,
    cached: false,
    search_date: new Date().toISOString(),
  };

  // Store in cache with 7-day TTL
  await setCached(env.DB, 'serper', queryHash, params, JSON.stringify(searchResult), TTL.SEARCH);

  return searchResult;
}
