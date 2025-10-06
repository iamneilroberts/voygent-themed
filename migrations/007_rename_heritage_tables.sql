-- Rename heritage-specific tables to be theme-agnostic

-- Rename heritage_trips to themed_trips
ALTER TABLE heritage_trips RENAME TO themed_trips;

-- Rename heritage_messages to themed_messages
ALTER TABLE heritage_messages RENAME TO themed_messages;
