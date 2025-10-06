/**
 * Cache Helper Library
 * Feature: 001-web-search-integration
 *
 * Provides caching layer for provider API responses using D1 cache_providers table.
 * TTL: 24h (86400s) for flights/hotels, 7d (604800s) for general search
 */

import { D1Database } from '@cloudflare/workers-types';

export interface CacheEntry {
  provider: string;
  query_hash: string;
  response_json: string;
  cached: boolean;
  cache_age_seconds?: number;
}

/**
 * Generate SHA-256 hash of query parameters for cache key
 */
export async function generateQueryHash(params: Record<string, any>): Promise<string> {
  // Normalize params: sort keys, stringify
  const normalized = JSON.stringify(params, Object.keys(params).sort());

  // SHA-256 hash
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Check if cache entry is still valid based on TTL
 */
export function isCacheValid(createdAt: number, ttlSeconds: number): boolean {
  const now = Math.floor(Date.now() / 1000); // unixepoch
  return (now - createdAt) < ttlSeconds;
}

/**
 * Get cached response if valid
 */
export async function getCached(
  db: D1Database,
  provider: string,
  queryHash: string
): Promise<CacheEntry | null> {
  const result = await db
    .prepare(
      `SELECT provider, query_hash, response_json, created_at, ttl_seconds
       FROM cache_providers
       WHERE provider = ? AND query_hash = ?
       LIMIT 1`
    )
    .bind(provider, queryHash)
    .first();

  if (!result) {
    return null;
  }

  const createdAt = result.created_at as number;
  const ttlSeconds = result.ttl_seconds as number;

  // Check if still valid
  if (!isCacheValid(createdAt, ttlSeconds)) {
    // Expired - delete and return null
    await db
      .prepare('DELETE FROM cache_providers WHERE provider = ? AND query_hash = ?')
      .bind(provider, queryHash)
      .run();
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const cacheAgeSeconds = now - createdAt;

  return {
    provider,
    query_hash: queryHash,
    response_json: result.response_json as string,
    cached: true,
    cache_age_seconds: cacheAgeSeconds,
  };
}

/**
 * Store response in cache with TTL
 */
export async function setCached(
  db: D1Database,
  provider: string,
  queryHash: string,
  queryParams: Record<string, any>,
  responseJson: string,
  ttlSeconds: number
): Promise<void> {
  const id = crypto.randomUUID();
  const queryParamsStr = JSON.stringify(queryParams);

  await db
    .prepare(
      `INSERT INTO cache_providers (id, provider, query_hash, query_params, response_json, ttl_seconds)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider, query_hash)
       DO UPDATE SET
         response_json = excluded.response_json,
         created_at = unixepoch(),
         ttl_seconds = excluded.ttl_seconds`
    )
    .bind(id, provider, queryHash, queryParamsStr, responseJson, ttlSeconds)
    .run();
}

/**
 * TTL constants
 */
export const TTL = {
  FLIGHTS: 86400, // 24 hours
  HOTELS: 86400,  // 24 hours
  SEARCH: 604800, // 7 days
} as const;
