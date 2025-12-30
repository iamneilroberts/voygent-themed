-- Migration: Create trip_templates table
-- VoyGent V3 - Template-Driven Architecture
-- This table stores ALL trip theme behavior (Heritage, Wine & Food, Film Locations, etc.)

CREATE TABLE IF NOT EXISTS trip_templates (
  -- Identification
  id TEXT PRIMARY KEY,  -- e.g., 'heritage-001', 'wine-001'
  name TEXT NOT NULL,  -- Display name: "Heritage & Ancestry"
  description TEXT NOT NULL,  -- Homepage card description
  icon TEXT NOT NULL,  -- Emoji or icon identifier

  -- UI Configuration
  search_placeholder TEXT NOT NULL,  -- "E.g., Sullivan family from Cork, Ireland"
  search_help_text TEXT,  -- Additional guidance for user input
  featured INTEGER DEFAULT 0,  -- Show on homepage (0 or 1)

  -- Phase 1: Research Prompts (Constitution required)
  research_query_template TEXT,  -- Template for web search queries, supports {surname}, {region}
  destination_criteria_prompt TEXT,  -- Criteria for AI destination selection
  research_synthesis_prompt TEXT,  -- How to synthesize search results
  destination_confirmation_prompt TEXT,  -- Prompt for presenting recommendations to user

  -- Phase 2: Trip Building Prompts
  intake_prompt TEXT NOT NULL,  -- Initial conversation prompt
  options_prompt TEXT NOT NULL,  -- How to generate trip options (2-4 variants)
  daily_activity_prompt TEXT,  -- Guidance for day-by-day itinerary creation

  -- API Integration Instructions
  flight_search_instructions TEXT,  -- Amadeus API search criteria
  hotel_search_instructions TEXT,  -- Amadeus hotel criteria (star rating, amenities)
  tour_search_instructions TEXT,  -- Viator search criteria (types, themes)

  -- Trip Constraints
  number_of_options INTEGER DEFAULT 3,  -- How many trip options to generate (2-4)
  trip_days_min INTEGER DEFAULT 3,
  trip_days_max INTEGER DEFAULT 21,
  luxury_levels TEXT,  -- JSON: ["Budget", "Comfort", "Luxury"]
  activity_levels TEXT,  -- JSON: ["Relaxed", "Moderate", "Active"]

  -- Required/Optional Fields (for preferences panel)
  required_fields TEXT,  -- JSON: ["duration", "departure_airport"]
  optional_fields TEXT,  -- JSON: ["travelers_adults", "luxury_level"]

  -- Example Inputs (for UI help text)
  example_inputs TEXT,  -- JSON: ["Sullivan family from Cork", "Irish roots in Galway"]

  -- Metadata
  is_active INTEGER DEFAULT 1,  -- Template enabled (0 or 1)
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_templates_featured ON trip_templates(featured, is_active);
CREATE INDEX IF NOT EXISTS idx_templates_active ON trip_templates(is_active);
