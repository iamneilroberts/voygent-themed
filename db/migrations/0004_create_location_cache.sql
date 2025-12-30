-- Location cache for Amadeus airport/city codes
-- Caches results from Amadeus Location API to avoid repeated lookups

CREATE TABLE IF NOT EXISTS location_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  search_term TEXT NOT NULL,           -- Original search term (e.g., "Edinburgh", "Isle of Skye")
  iata_code TEXT NOT NULL,             -- IATA code (e.g., "EDI", "INV")
  location_type TEXT NOT NULL,         -- 'AIRPORT' or 'CITY'
  location_name TEXT,                  -- Full name from API (e.g., "Edinburgh Airport")
  country_code TEXT,                   -- ISO country code (e.g., "GB", "IE")
  cached_at INTEGER DEFAULT (unixepoch()),

  -- Index for fast lookups by search term
  UNIQUE(search_term, location_type)
);

CREATE INDEX IF NOT EXISTS idx_location_cache_search ON location_cache(search_term);
