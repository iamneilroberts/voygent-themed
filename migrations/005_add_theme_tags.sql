-- Add tags and featured status to trip_templates

ALTER TABLE trip_templates ADD COLUMN tags TEXT DEFAULT '[]';
ALTER TABLE trip_templates ADD COLUMN is_featured INTEGER DEFAULT 0;
ALTER TABLE trip_templates ADD COLUMN display_order INTEGER DEFAULT 0;
