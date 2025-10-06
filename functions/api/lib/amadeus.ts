/**
 * Amadeus API Client
 * Feature: 001-web-search-integration
 *
 * Primary provider for flights and hotels.
 * Uses OAuth2 client credentials flow, caches token for 30min.
 */

import { getCached, setCached, TTL, generateQueryHash } from './cache';
import type { D1Database } from '@cloudflare/workers-types';

interface AmadeusEnv {
  AMADEUS_CLIENT_ID: string;
  AMADEUS_CLIENT_SECRET: string;
  AMADEUS_API_URL: string; // https://test.api.amadeus.com or https://api.amadeus.com
}

interface AmadeusToken {
  access_token: string;
  expires_at: number; // Unix timestamp
}

let tokenCache: AmadeusToken | null = null;

/**
 * Get OAuth2 access token (caches for 30min)
 */
async function getAccessToken(env: AmadeusEnv): Promise<string> {
  // Check in-memory cache
  if (tokenCache && tokenCache.expires_at > Date.now()) {
    return tokenCache.access_token;
  }

  // Request new token
  const response = await fetch(`${env.AMADEUS_API_URL}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.AMADEUS_CLIENT_ID,
      client_secret: env.AMADEUS_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    throw new Error(`Amadeus auth failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number };

  // Cache token (subtract 60s buffer)
  tokenCache = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };

  return data.access_token;
}

/**
 * Search flights (Amadeus Flight Offers Search)
 */
export async function searchFlights(
  env: AmadeusEnv & { DB: D1Database },
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
  const queryHash = await generateQueryHash({ provider: 'amadeus-flights', from, to, month, adults, route_type });

  // Check cache
  const cached = await getCached(env.DB, 'amadeus', queryHash);
  if (cached) {
    return { ...JSON.parse(cached.response_json), cached: true, cache_age_seconds: cached.cache_age_seconds };
  }

  // Fetch from Amadeus API
  const token = await getAccessToken(env);

  // Amadeus expects departureDate, not month - use first day of month
  const departureDate = `${month}-01`;
  const returnDate = route_type === 'round_trip' ? `${month}-08` : undefined; // Example: 7-day trip

  const url = new URL(`${env.AMADEUS_API_URL}/v2/shopping/flight-offers`);
  url.searchParams.set('originLocationCode', from);
  url.searchParams.set('destinationLocationCode', to);
  url.searchParams.set('departureDate', departureDate);
  if (returnDate) {
    url.searchParams.set('returnDate', returnDate);
  }
  url.searchParams.set('adults', adults.toString());
  url.searchParams.set('currencyCode', 'USD');
  url.searchParams.set('max', '50');  // Increased from 10 to 50 to get more options

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Amadeus flight search failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Normalize to Flight Offer format
  const offers = data.data || [];
  if (offers.length === 0) {
    throw new Error('No flight offers found');
  }

  // Sort offers by price (cheapest first)
  const sortedOffers = offers
    .map((offer: any) => ({
      price: parseFloat(offer.price?.total || 0),
      carrier: offer.validatingAirlineCodes?.[0] || 'Unknown',
      offer
    }))
    .filter((o: any) => o.price > 0)
    .sort((a: any, b: any) => a.price - b.price);

  if (sortedOffers.length === 0) {
    throw new Error('No valid flight offers found');
  }

  const prices = sortedOffers.map((o: any) => o.price);
  const cheapestOffer = sortedOffers[0];

  const result = {
    provider: 'amadeus',
    route: `${from}-${to} ${route_type === 'round_trip' ? 'round-trip' : 'one-way'}`,
    offers: [
      {
        price_low: prices[0] || 0,
        price_median: prices[Math.floor(prices.length / 2)] || 0,
        price_high: prices[prices.length - 1] || 0,
        carrier: cheapestOffer.carrier,
        route_type,
        estimate_date: new Date().toISOString(),
      },
    ],
    cached: false,
  };

  // Store in cache
  await setCached(env.DB, 'amadeus', queryHash, params, JSON.stringify(result), TTL.FLIGHTS);

  return result;
}

/**
 * Search hotels (Amadeus Hotel Search)
 */
export async function searchHotels(
  env: AmadeusEnv & { DB: D1Database },
  params: {
    city: string;
    country?: string; // ISO-2 country code (e.g., 'GB', 'FR', 'IE')
    checkin: string; // YYYY-MM-DD
    nights: number;
    luxury?: 'budget' | 'comfort' | 'premium' | 'luxury';
    adults?: number;
  }
) {
  const { city, country, checkin, nights, luxury = 'comfort', adults = 2 } = params;

  // Generate cache key
  const queryHash = await generateQueryHash({ provider: 'amadeus-hotels', city, checkin, nights, luxury, adults });

  // Check cache
  const cached = await getCached(env.DB, 'amadeus', queryHash);
  if (cached) {
    return { ...JSON.parse(cached.response_json), cached: true, cache_age_seconds: cached.cache_age_seconds };
  }

  // Fetch from Amadeus API
  const token = await getAccessToken(env);

  // Step 1: Resolve city to IATA code using smart resolver
  const { resolveCityToAirport } = await import('./city-resolver');

  const resolution = await resolveCityToAirport(env, {
    city,
    country,
    amadeusToken: token
  });

  const cityCode = resolution.cityCode;
  console.log(`[Amadeus Hotels] Resolved ${city}, ${country || '?'} → ${cityCode} (${resolution.method}: ${resolution.source})`);

  // Step 2: Get hotel list by city
  const hotelListUrl = new URL(`${env.AMADEUS_API_URL}/v1/reference-data/locations/hotels/by-city`);
  hotelListUrl.searchParams.set('cityCode', cityCode);
  hotelListUrl.searchParams.set('radius', '50');
  hotelListUrl.searchParams.set('radiusUnit', 'KM');
  hotelListUrl.searchParams.set('ratings', '3,4,5'); // Only 3+ star hotels

  const hotelListResponse = await fetch(hotelListUrl.toString(), {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!hotelListResponse.ok) {
    const errorBody = await hotelListResponse.text();
    throw new Error(`Amadeus hotel list failed: ${hotelListResponse.status} ${hotelListResponse.statusText} - ${errorBody}`);
  }

  const hotelListData = await hotelListResponse.json();

  console.log(`[Amadeus Hotels] Hotel list returned ${hotelListData.data?.length || 0} hotels for ${cityCode}`);

  const hotelIds = (hotelListData.data || []).slice(0, 10).map((h: any) => h.hotelId).filter(Boolean).join(',');

  if (!hotelIds) {
    console.error(`[Amadeus Hotels] No hotels found for ${city} (${cityCode}) - trying web search fallback`);

    // Fallback: Web search for hotels
    const { default: serper } = await import('./serper');
    const { default: tavily } = await import('./tavily');

    try {
      const searchQuery = `hotels in ${city} ${country || ''} booking price`;
      const searchResult = env.SERPER_API_KEY
        ? await serper.webSearch(env, { q: searchQuery, max_results: 3 })
        : env.TAVILY_API_KEY
        ? await tavily.webSearch(env, { q: searchQuery, max_results: 3 })
        : null;

      if (searchResult?.results?.length > 0) {
        // Return generic hotel data from web search
        const hotels = searchResult.results.slice(0, 3).map((result: any, idx: number) => ({
          hotel_id: `web-${idx}`,
          name: result.title?.split('-')?.[0]?.trim() || `Hotel ${idx + 1}`,
          city,
          nightly_price_low: 100,
          nightly_price_high: 200,
          star_rating: 3,
          budget_tier: luxury,
          amenities: ['WiFi', 'Breakfast'],
          source: 'web_search',
          booking_url: result.url
        }));

        console.log(`[Amadeus Hotels] Web search fallback returned ${hotels.length} results`);

        return {
          hotels,
          cached: false,
          fallback: 'web_search'
        };
      }
    } catch (webError) {
      console.error(`[Amadeus Hotels] Web search fallback also failed:`, webError);
    }

    throw new Error(`No hotels found in ${city}`);
  }

  console.log(`[Amadeus Hotels] Using hotel IDs: ${hotelIds}`);

  // Step 3: Get hotel offers for these hotels
  const checkout = new Date(new Date(checkin).getTime() + nights * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const url = new URL(`${env.AMADEUS_API_URL}/v3/shopping/hotel-offers`);
  url.searchParams.set('hotelIds', hotelIds);
  url.searchParams.set('checkInDate', checkin);
  url.searchParams.set('checkOutDate', checkout);
  url.searchParams.set('adults', adults.toString());
  url.searchParams.set('currency', 'USD');

  console.log(`[Amadeus Hotels] Searching: ${city} (${cityCode}), ${checkin} - ${checkout}, ${adults} adults, ${hotelIds.split(',').length} hotels`);

  const response = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Amadeus hotel offers failed: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  const data = await response.json();

  // Normalize to Hotel Listing format (limit to 2-3)
  const hotels = (data.data || []).slice(0, 3).map((hotel: any) => {
    const offer = hotel.offers?.[0];
    const price = parseFloat(offer?.price?.total || 0) / nights;

    return {
      hotel_id: hotel.hotel?.hotelId || crypto.randomUUID(),
      name: hotel.hotel?.name || 'Unknown Hotel',
      city,
      nightly_price_low: Math.floor(price * 0.9),
      nightly_price_high: Math.ceil(price * 1.1),
      star_rating: hotel.hotel?.rating || 3,
      budget_tier: luxury,
      provider: 'amadeus',
      availability_disclaimer: 'availability not guaranteed',
    };
  });

  if (hotels.length === 0) {
    throw new Error('No hotels found');
  }

  const result = {
    provider: 'amadeus',
    city,
    checkin,
    nights,
    hotels,
    cached: false,
  };

  // Store in cache
  await setCached(env.DB, 'amadeus', queryHash, params, JSON.stringify(result), TTL.HOTELS);

  return result;
}
