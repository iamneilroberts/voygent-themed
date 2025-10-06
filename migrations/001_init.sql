-- Voygent Heritage MVP D1 Schema

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  template TEXT DEFAULT 'heritage',
  title TEXT,
  intake_json TEXT,
  options_json TEXT,
  itinerary_json TEXT,
  variants_json TEXT,
  status TEXT DEFAULT 'intake',
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_trips_user ON trips(user_id);
CREATE INDEX idx_trips_created ON trips(created_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0.0,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (trip_id) REFERENCES trips(id)
);

CREATE INDEX idx_messages_trip ON messages(trip_id, created_at);
