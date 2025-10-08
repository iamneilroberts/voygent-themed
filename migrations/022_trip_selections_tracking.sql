-- Migration 022: Trip Selection and Option Tracking
-- Support for Phase 7 price estimate APIs
-- Tracks all options shown to user and which ones they selected

-- Table for tracking all options shown (for handoff document)
CREATE TABLE IF NOT EXISTS trip_option_tracking (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  trip_id TEXT NOT NULL REFERENCES themed_trips(id) ON DELETE CASCADE,
  option_type TEXT NOT NULL CHECK(option_type IN ('flight', 'hotel', 'transport', 'tour')),
  option_id TEXT NOT NULL,
  option_data TEXT NOT NULL,  -- JSON: full request + response
  shown_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_option_tracking_trip ON trip_option_tracking(trip_id, shown_at DESC);
CREATE INDEX idx_option_tracking_type ON trip_option_tracking(trip_id, option_type);

-- Table for tracking user selections
CREATE TABLE IF NOT EXISTS trip_selections (
  trip_id TEXT NOT NULL,
  selection_type TEXT NOT NULL CHECK(selection_type IN ('flight', 'hotel', 'transport', 'tour')),
  option_id TEXT NOT NULL,
  option_data TEXT NOT NULL,  -- JSON: selected option details
  selected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (trip_id, selection_type, option_id),
  FOREIGN KEY (trip_id) REFERENCES themed_trips(id) ON DELETE CASCADE
);

CREATE INDEX idx_selections_trip ON trip_selections(trip_id, selected_at DESC);
CREATE INDEX idx_selections_type ON trip_selections(trip_id, selection_type);
