-- Migration: Create themed_trips table
-- VoyGent V3 - Template-Driven Architecture
-- This table stores individual trip planning sessions with conversational state

CREATE TABLE IF NOT EXISTS themed_trips (
  -- Identification
  id TEXT PRIMARY KEY,  -- UUID v4
  template_id TEXT NOT NULL,  -- Foreign key to trip_templates.id

  -- Chat Conversation (Constitution required)
  chat_history TEXT,  -- JSON: [{role: 'user'|'assistant', content: string, timestamp: number}]

  -- Phase 1: Research (Constitution required)
  research_destinations TEXT,  -- JSON: Destination[] with name, context, rationale, estimated_days
  destinations_confirmed INTEGER DEFAULT 0,  -- Phase gate (0 or 1)
  confirmed_destinations TEXT,  -- JSON: string[] of confirmed destination names

  -- User Preferences (from preferences panel)
  preferences_json TEXT,  -- JSON: {duration, travelers_adults, travelers_children, luxury_level, activity_level, departure_airport, departure_date}

  -- Phase 2: Trip Building
  options_json TEXT,  -- JSON: TripOption[] with flights, hotels, tours, total_cost_usd
  selected_option_index INTEGER,  -- 1-based index matching option_index in options_json
  final_itinerary TEXT,  -- JSON: DailyItinerary[] with activities, hotels, meals
  total_cost_usd REAL,  -- Total cost of selected option

  -- User-Facing Progress (Constitution required)
  status TEXT DEFAULT 'chat',  -- 'chat', 'researching', 'awaiting_confirmation', 'building_trip', 'options_ready', 'option_selected', 'handoff_sent'
  progress_message TEXT,  -- User-facing: "Researching heritage destinations..."
  progress_percent INTEGER DEFAULT 0,  -- 0-100

  -- Admin Telemetry (Constitution required: admin-only access)
  ai_cost_usd REAL DEFAULT 0.0,  -- Cumulative AI provider costs
  api_cost_usd REAL DEFAULT 0.0,  -- Cumulative booking API costs (Amadeus, Viator)
  telemetry_logs TEXT,  -- JSON: [{timestamp, event, provider, model, tokens, cost, duration_ms}]

  -- User Contact (for handoff to travel agent)
  user_contact_json TEXT,  -- JSON: {name, email, phone}
  special_requests TEXT,  -- Free-form text from user

  -- Metadata
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),

  -- Foreign key constraint
  FOREIGN KEY (template_id) REFERENCES trip_templates(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trips_template ON themed_trips(template_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON themed_trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_created ON themed_trips(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_destinations_confirmed ON themed_trips(destinations_confirmed);
