-- Migration 021: Create handoff_documents table for travel agent handoff
-- Stores comprehensive trip context for agent quotes including all options shown to user

CREATE TABLE IF NOT EXISTS handoff_documents (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES themed_trips(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,

  -- Complete trip context
  chat_history TEXT NOT NULL,          -- JSON: [{role, content, timestamp}] - last 100 messages
  research_summary TEXT NOT NULL,      -- Full AI research synthesis
  user_preferences TEXT NOT NULL,      -- JSON: {luxury_level, activity_level, transport, days, budget, special_requests}

  -- All travel options shown to user
  all_flight_options TEXT NOT NULL,    -- JSON array of all flights shown
  selected_flight_id TEXT DEFAULT NULL,
  all_hotel_options TEXT NOT NULL,     -- JSON array of all hotels shown
  selected_hotel_ids TEXT DEFAULT NULL, -- JSON array of selected hotel IDs
  all_transport_options TEXT DEFAULT NULL, -- JSON array
  selected_transport_ids TEXT DEFAULT NULL, -- JSON array

  -- Final itinerary
  daily_itinerary TEXT NOT NULL,       -- JSON array of daily plans with why_we_suggest
  total_estimate_usd REAL NOT NULL,
  margin_percent INTEGER NOT NULL,

  -- Agent interaction
  agent_id TEXT DEFAULT NULL,          -- Travel agent who claimed the quote
  agent_quote_usd REAL DEFAULT NULL,
  agent_notes TEXT DEFAULT NULL,
  quote_status TEXT DEFAULT 'pending' CHECK(quote_status IN ('pending', 'quoted', 'booked', 'cancelled')),

  -- Export formats
  pdf_url TEXT DEFAULT NULL,           -- Cloudflare R2 URL
  json_export TEXT DEFAULT NULL,       -- Complete structured data

  -- Metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  quoted_at DATETIME DEFAULT NULL,
  expires_at DATETIME NOT NULL         -- 30 days from creation
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_handoff_trip ON handoff_documents(trip_id);
CREATE INDEX IF NOT EXISTS idx_handoff_agent ON handoff_documents(agent_id, quote_status);
CREATE INDEX IF NOT EXISTS idx_handoff_status ON handoff_documents(quote_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_handoff_expires ON handoff_documents(expires_at) WHERE quote_status = 'pending';
