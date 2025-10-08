-- Migration 020: Extend trip_templates for prompt-driven template system
-- Adds 16 new columns for UI verbiage, workflow control, config arrays, and provider instructions

-- UI Verbiage (3 columns)
ALTER TABLE trip_templates ADD COLUMN search_placeholder TEXT DEFAULT 'Enter your destination or theme...';
ALTER TABLE trip_templates ADD COLUMN search_help_text TEXT DEFAULT 'Describe what kind of trip you''re looking for';
ALTER TABLE trip_templates ADD COLUMN progress_messages TEXT DEFAULT NULL;

-- Workflow Control (6 columns)
ALTER TABLE trip_templates ADD COLUMN workflow_prompt TEXT DEFAULT NULL;
ALTER TABLE trip_templates ADD COLUMN daily_activity_prompt TEXT DEFAULT NULL;
ALTER TABLE trip_templates ADD COLUMN why_we_suggest_prompt TEXT DEFAULT NULL;
ALTER TABLE trip_templates ADD COLUMN number_of_options INTEGER DEFAULT 4 CHECK(number_of_options BETWEEN 1 AND 10);
ALTER TABLE trip_templates ADD COLUMN trip_days_min INTEGER DEFAULT 3 CHECK(trip_days_min >= 1);
ALTER TABLE trip_templates ADD COLUMN trip_days_max INTEGER DEFAULT 14 CHECK(trip_days_max >= trip_days_min);

-- Config Arrays (3 columns)
ALTER TABLE trip_templates ADD COLUMN luxury_levels TEXT DEFAULT '["budget","comfort","premium","luxury"]';
ALTER TABLE trip_templates ADD COLUMN activity_levels TEXT DEFAULT '["relaxed","moderate","active","intense"]';
ALTER TABLE trip_templates ADD COLUMN transport_preferences TEXT DEFAULT '["flights","trains","car","mixed"]';

-- Provider Instructions (4 columns)
ALTER TABLE trip_templates ADD COLUMN tour_search_instructions TEXT DEFAULT NULL;
ALTER TABLE trip_templates ADD COLUMN hotel_search_instructions TEXT DEFAULT NULL;
ALTER TABLE trip_templates ADD COLUMN flight_search_instructions TEXT DEFAULT NULL;
ALTER TABLE trip_templates ADD COLUMN estimate_margin_percent INTEGER DEFAULT 17 CHECK(estimate_margin_percent BETWEEN 10 AND 25);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_templates_active ON trip_templates(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_templates_name ON trip_templates(name);
