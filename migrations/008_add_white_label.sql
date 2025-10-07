-- Migration 008: Add white-label support for agencies
-- This migration adds the agencies table and extends themed_trips for white-label branding

-- Create agencies table for white-label branding
CREATE TABLE IF NOT EXISTS agencies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  custom_domain TEXT UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#667eea',
  accent_color TEXT DEFAULT '#764ba2',
  contact_email TEXT,
  contact_phone TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Add agency_id column to themed_trips for routing to agency agent pools
-- Using ALTER TABLE ADD COLUMN which is safe and non-destructive
-- NOTE: This will error if column already exists, which is expected behavior for migrations
ALTER TABLE themed_trips ADD COLUMN agency_id TEXT REFERENCES agencies(id);

-- Add handoff_json column to store complete traveler intake data
-- NOTE: This will error if column already exists, which is expected behavior for migrations
ALTER TABLE themed_trips ADD COLUMN handoff_json TEXT;
