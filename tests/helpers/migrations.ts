import type { D1Database } from '@cloudflare/workers-types';

/**
 * Run essential database migrations for tests
 * This creates the minimum schema needed for tests to pass
 * Embedded SQL avoids file system dependencies in Workers environment
 */
export async function runMigrations(db: D1Database): Promise<void> {
  const migrations = [
    // Core tables (from 001_init.sql and 002_heritage_tables.sql)
    `CREATE TABLE IF NOT EXISTS themed_trips (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      agency_id TEXT,
      template TEXT DEFAULT 'heritage',
      title TEXT,
      intake_json TEXT,
      options_json TEXT,
      itinerary_json TEXT,
      variants_json TEXT,
      diagnostics TEXT,
      status TEXT DEFAULT 'intake',
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    )`,

    `CREATE INDEX IF NOT EXISTS idx_themed_trips_user ON themed_trips(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_themed_trips_created ON themed_trips(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_themed_trips_agency ON themed_trips(agency_id)`,

    `CREATE TABLE IF NOT EXISTS themed_messages (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT,
      tokens_in INTEGER DEFAULT 0,
      tokens_out INTEGER DEFAULT 0,
      cost_usd REAL DEFAULT 0.0,
      created_at INTEGER DEFAULT (unixepoch())
    )`,

    `CREATE INDEX IF NOT EXISTS idx_themed_messages_trip ON themed_messages(trip_id, created_at)`,

    // Templates table (from 004_trip_templates.sql and 009_add_research_prompts.sql)
    `CREATE TABLE IF NOT EXISTS trip_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      theme TEXT NOT NULL,
      intake_prompt TEXT,
      options_prompt TEXT,
      researchQueryTemplate TEXT,
      researchSynthesisPrompt TEXT,
      required_fields TEXT,
      optional_fields TEXT,
      example_inputs TEXT,
      tags TEXT,
      is_active INTEGER DEFAULT 1,
      is_featured INTEGER DEFAULT 0,
      display_order INTEGER DEFAULT 999,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    )`,

    // Agencies table (from 008_add_white_label.sql)
    `CREATE TABLE IF NOT EXISTS agencies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      domain TEXT,
      logo_url TEXT,
      primary_color TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    )`,

    // Provider cache (from 003_cache_providers.sql)
    `CREATE TABLE IF NOT EXISTS provider_cache (
      cache_key TEXT PRIMARY KEY,
      response TEXT NOT NULL,
      tokens_in INTEGER DEFAULT 0,
      tokens_out INTEGER DEFAULT 0,
      cost_usd REAL DEFAULT 0.0,
      created_at INTEGER DEFAULT (unixepoch()),
      expires_at INTEGER
    )`,

    `CREATE INDEX IF NOT EXISTS idx_provider_cache_expires ON provider_cache(expires_at)`
  ];

  for (let i = 0; i < migrations.length; i++) {
    try {
      await db.prepare(migrations[i]).run();
    } catch (error: any) {
      console.error(`[TEST] ✗ Migration ${i + 1} failed:`, error.message);
      throw error;
    }
  }

  console.log('[TEST] ✓ Database schema created');
}
