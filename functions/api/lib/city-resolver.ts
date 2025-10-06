/**
 * Smart City Resolver
 * Resolves city names to IATA airport codes using:
 * 1. Direct Amadeus city search with country filtering
 * 2. Web search for nearest airport
 * 3. Caching to avoid repeated lookups
 */

import { getCached, setCached, generateQueryHash } from './cache';
import type { D1Database } from '@cloudflare/workers-types';

interface CityResolverEnv {
  DB?: D1Database;
  AMADEUS_API_URL: string;
  SERPER_API_KEY?: string;
  SERPER_API_URL?: string;
}

/**
 * Resolve city to IATA airport code
 */
export async function resolveCityToAirport(
  env: CityResolverEnv,
  params: {
    city: string;
    country?: string; // ISO-2 code (GB, FR, etc.)
    amadeusToken: string;
  }
): Promise<{ cityCode: string; method: 'amadeus' | 'web-search' | 'fallback'; source: string }> {
  const { city, country, amadeusToken } = params;

  // Generate cache key
  const cacheKey = await generateQueryHash({ type: 'city-resolution', city, country });

  // Check cache first (only if DB is available)
  if (env.DB) {
    const cached = await getCached(env.DB, 'city-resolution', cacheKey);
    if (cached) {
      const result = JSON.parse(cached.response_json);
      return { ...result, cached: true };
    }
  }

  // Step 1: Try Amadeus city search
  const amadeusResult = await searchAmadeusCity(env, city, country, amadeusToken);
  if (amadeusResult) {
    if (env.DB) {
      await setCached(env.DB, 'city-resolution', cacheKey, { city, country }, JSON.stringify(amadeusResult), 604800); // 7 days
    }
    return amadeusResult;
  }

  // Step 2: If Amadeus fails and we have Serper, try web search
  if (env.SERPER_API_KEY && env.SERPER_API_URL) {
    const webSearchResult = await searchNearestAirport(env, city, country);
    if (webSearchResult) {
      if (env.DB) {
        await setCached(env.DB, 'city-resolution', cacheKey, { city, country }, JSON.stringify(webSearchResult), 604800); // 7 days
      }
      return webSearchResult;
    }
  }

  // Step 3: Fallback to regional defaults
  const fallback = getFallbackAirport(city, country);
  if (env.DB) {
    await setCached(env.DB, 'city-resolution', cacheKey, { city, country }, JSON.stringify(fallback), 86400); // 1 day
  }
  return fallback;
}

/**
 * Search Amadeus for city IATA code
 */
async function searchAmadeusCity(
  env: CityResolverEnv,
  city: string,
  country: string | undefined,
  token: string
): Promise<{ cityCode: string; method: 'amadeus'; source: string } | null> {
  try {
    const url = new URL(`${env.AMADEUS_API_URL}/v1/reference-data/locations`);
    url.searchParams.set('keyword', city);
    url.searchParams.set('subType', 'CITY,AIRPORT');

    const response = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.data || data.data.length === 0) return null;

    // Filter by country if provided - STRICT matching required
    if (country) {
      const matchingLocation = data.data.find((loc: any) =>
        loc.address?.countryCode?.toUpperCase() === country.toUpperCase()
      );

      if (matchingLocation) {
        console.log(`[City Resolver] Amadeus match: ${city}, ${country} → ${matchingLocation.iataCode}`);
        return {
          cityCode: matchingLocation.iataCode,
          method: 'amadeus',
          source: `${matchingLocation.name}, ${matchingLocation.address?.countryCode}`
        };
      }

      // If country specified but no match, return null to try web search
      console.warn(`[City Resolver] No ${country} match for ${city} in Amadeus, found: ${data.data[0]?.address?.countryCode}. Will try web search.`);
      return null;
    }

    // Use first result only if no country filtering
    const firstResult = data.data[0];
    if (firstResult?.iataCode) {
      return {
        cityCode: firstResult.iataCode,
        method: 'amadeus',
        source: `${firstResult.name}, ${firstResult.address?.countryCode}`
      };
    }

    return null;
  } catch (error) {
    console.error(`[City Resolver] Amadeus search failed for ${city}:`, error);
    return null;
  }
}

/**
 * Use web search to find nearest major airport
 */
async function searchNearestAirport(
  env: CityResolverEnv,
  city: string,
  country?: string
): Promise<{ cityCode: string; method: 'web-search'; source: string } | null> {
  try {
    const countryName = getCountryName(country);
    const query = countryName
      ? `nearest major airport to ${city}, ${countryName} IATA code`
      : `nearest major airport to ${city} IATA code`;

    const response = await fetch(`${env.SERPER_API_URL}/search`, {
      method: 'POST',
      headers: {
        'X-API-KEY': env.SERPER_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 3 }),
    });

    if (!response.ok) return null;

    const data = await response.json();

    // Extract IATA codes from search results
    const snippet = data.organic?.[0]?.snippet || data.answerBox?.answer || '';
    const iataMatch = snippet.match(/\b([A-Z]{3})\b/);

    if (iataMatch) {
      const airportCode = iataMatch[1];
      console.log(`[City Resolver] Web search: ${city}, ${country} → ${airportCode} via "${snippet.substring(0, 100)}..."`);

      return {
        cityCode: airportCode,
        method: 'web-search',
        source: `Web search: ${data.organic?.[0]?.title || 'search result'}`
      };
    }

    return null;
  } catch (error) {
    console.error(`[City Resolver] Web search failed for ${city}:`, error);
    return null;
  }
}

/**
 * Fallback to regional airport for major regions
 */
function getFallbackAirport(
  city: string,
  country?: string
): { cityCode: string; method: 'fallback'; source: string } {
  // Default to major hub by country
  const countryDefaults: Record<string, string> = {
    'GB': 'LHR', // London Heathrow
    'IE': 'DUB', // Dublin
    'FR': 'CDG', // Paris
    'DE': 'FRA', // Frankfurt
    'IT': 'FCO', // Rome
    'ES': 'MAD', // Madrid
    'NL': 'AMS', // Amsterdam
    'BE': 'BRU', // Brussels
  };

  const fallbackCode = (country && countryDefaults[country.toUpperCase()]) || 'LHR';

  console.warn(`[City Resolver] Using fallback for ${city}, ${country} → ${fallbackCode}`);

  return {
    cityCode: fallbackCode,
    method: 'fallback',
    source: `Country default for ${country || 'unknown'}`
  };
}

/**
 * Convert ISO-2 country code to full name for search queries
 */
function getCountryName(code?: string): string | undefined {
  if (!code) return undefined;

  const countryNames: Record<string, string> = {
    'GB': 'United Kingdom',
    'IE': 'Ireland',
    'FR': 'France',
    'DE': 'Germany',
    'IT': 'Italy',
    'ES': 'Spain',
    'NL': 'Netherlands',
    'BE': 'Belgium',
    'CH': 'Switzerland',
    'AT': 'Austria',
    'PT': 'Portugal',
    'GR': 'Greece',
  };

  return countryNames[code.toUpperCase()];
}
