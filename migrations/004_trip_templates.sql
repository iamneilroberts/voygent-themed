-- Migration 004: Trip Templates Table
-- Stores editable theme configurations for the admin dashboard

CREATE TABLE IF NOT EXISTS trip_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  intake_prompt TEXT NOT NULL,
  options_prompt TEXT NOT NULL,
  required_fields TEXT NOT NULL,
  optional_fields TEXT NOT NULL,
  example_inputs TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_trip_templates_active
  ON trip_templates(is_active, name);

