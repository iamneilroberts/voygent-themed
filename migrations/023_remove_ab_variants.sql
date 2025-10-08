-- Migration 023: Remove A/B comparison column
-- DO NOT RUN until after 2025-11-08 (30 days after deprecation)
-- First verify zero usage with scripts/monitor-ab-usage.sh

-- Check for any trips still using variants_json
-- Run this query first to ensure no data loss:
-- SELECT COUNT(*) FROM themed_trips WHERE variants_json IS NOT NULL;

-- Remove deprecated column
ALTER TABLE themed_trips DROP COLUMN variants_json;

-- Note: The /api/trips/[id]/ab.ts endpoint should be deleted at the same time
