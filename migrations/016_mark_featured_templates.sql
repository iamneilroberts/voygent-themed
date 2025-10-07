-- Migration 016: Mark Primary Templates as Featured
-- Feature: 010-display-13-templates
-- Purpose: Set is_featured and display_order for the original 5 primary templates

-- Heritage is already featured (from migration 015)
-- Romance is already featured (from migration 015 with display_order 10)

-- Update the other 4 original templates to be featured
UPDATE trip_templates SET is_featured = 1, display_order = 2 WHERE id = 'tvmovie';
UPDATE trip_templates SET is_featured = 1, display_order = 3 WHERE id = 'historical';
UPDATE trip_templates SET is_featured = 1, display_order = 4 WHERE id = 'culinary';
UPDATE trip_templates SET is_featured = 1, display_order = 5 WHERE id = 'adventure';
