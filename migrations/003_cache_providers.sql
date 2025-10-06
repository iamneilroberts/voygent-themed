-- Migration 003: Cache Providers Table
-- Feature: 001-web-search-integration
-- Purpose: Store cached API responses from provider endpoints (Amadeus, Kiwi, Serper, Tavily)
-- TTL: 24h (86400s) for flights/hotels, 7d (604800s) for general search

CREATE TABLE IF NOT EXISTS cache_providers (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,           -- 'amadeus', 'kiwi', 'serper', 'tavily'
  query_hash TEXT NOT NULL,         -- SHA-256 of normalized query params
  query_params TEXT NOT NULL,       -- JSON of original params for debugging
  response_json TEXT NOT NULL,      -- Cached API response
  ttl_seconds INTEGER NOT NULL,     -- 86400 (24h) or 604800 (7d)
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(provider, query_hash)
);

-- Index for fast cache lookups
CREATE INDEX IF NOT EXISTS idx_cache_lookup
  ON cache_providers(provider, query_hash, created_at);

-- Index for cleanup queries (WHERE created_at + ttl_seconds < unixepoch())
CREATE INDEX IF NOT EXISTS idx_cache_expiry
  ON cache_providers(created_at, ttl_seconds);
