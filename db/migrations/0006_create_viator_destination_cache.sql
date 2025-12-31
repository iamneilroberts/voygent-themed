-- Viator destination cache for destination IDs
-- Caches results from Viator Destinations API to avoid repeated lookups
-- Mirrors the pattern used for Amadeus location_cache

CREATE TABLE IF NOT EXISTS viator_destination_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  search_term TEXT NOT NULL,           -- Original search term (e.g., "Cork", "Dublin")
  destination_id TEXT NOT NULL,        -- Viator destination ID (e.g., "684", "470")
  destination_name TEXT,               -- Full name from API (e.g., "Cork, Ireland")
  destination_type TEXT,               -- Type (e.g., "CITY", "REGION", "COUNTRY")
  parent_id TEXT,                      -- Parent destination ID for hierarchy
  cached_at INTEGER DEFAULT (unixepoch()),

  -- Index for fast lookups by search term
  UNIQUE(search_term)
);

CREATE INDEX IF NOT EXISTS idx_viator_dest_cache_search ON viator_destination_cache(search_term);
