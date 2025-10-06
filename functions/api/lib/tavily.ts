/**
 * Tavily Search API Client
 * Feature: 001-web-search-integration
 *
 * Fallback provider for general web search when Serper.dev unavailable.
 * Free tier: 1,000 requests/month
 */

import { getCached, setCached, TTL, generateQueryHash } from './cache';
import type { D1Database } from '@cloudflare/workers-types';

interface TavilyEnv {
  TAVILY_API_KEY: string;
  TAVILY_API_URL: string; // https://api.tavily.com
}

/**
 * General web search (Tavily fallback)
 */
export async function webSearch(
  env: TavilyEnv & { DB: D1Database },
  params: {
    q: string;
    city?: string;
    month?: string;
    max_results?: number;
    search_depth?: 'basic' | 'advanced';
  }
) {
  const { q, city, month, max_results = 10, search_depth = 'basic' } = params;

  // Generate cache key using city+topic+month composite
  const cacheKey = `${city || 'global'}_${q.slice(0, 20).replace(/\s+/g, '_')}_${month || 'any'}`;
  const queryHash = await generateQueryHash({ provider: 'tavily-search', cache_key: cacheKey });

  // Check cache
  const cached = await getCached(env.DB, 'tavily', queryHash);
  if (cached) {
    return { ...JSON.parse(cached.response_json), cached: true, cache_age_seconds: cached.cache_age_seconds };
  }

  // Fetch from Tavily API
  const response = await fetch(`${env.TAVILY_API_URL}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: env.TAVILY_API_KEY,
      query: q,
      search_depth,
      max_results,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  const results = (data.results || []).map((result: any) => ({
    title: result.title,
    url: result.url,
    snippet: result.content,
    relevance_score: result.score,
  }));

  const searchResult = {
    provider: 'tavily',
    query: q,
    cache_key: cacheKey,
    results,
    cached: false,
    search_date: new Date().toISOString(),
  };

  // Store in cache with 7-day TTL
  await setCached(env.DB, 'tavily', queryHash, params, JSON.stringify(searchResult), TTL.SEARCH);

  return searchResult;
}
