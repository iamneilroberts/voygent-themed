-- Migration: Add research_summary column
-- VoyGent V3 - Research Summary Feature
-- Stores the research summary shown to users before destination recommendations

ALTER TABLE themed_trips ADD COLUMN research_summary TEXT;
-- JSON: {
--   queries: string[],           -- Search queries used
--   sources: {title, url}[],     -- Key sources found
--   summary: string              -- Narrative summary of research findings
-- }
