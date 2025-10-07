-- Add progress tracking columns to themed_trips table

ALTER TABLE themed_trips ADD COLUMN progress_step TEXT DEFAULT 'intake';
ALTER TABLE themed_trips ADD COLUMN progress_message TEXT DEFAULT 'Starting...';
ALTER TABLE themed_trips ADD COLUMN progress_percent INTEGER DEFAULT 0;

-- Update existing trips to have default progress
UPDATE themed_trips SET progress_step = 'complete', progress_message = 'Trip complete', progress_percent = 100
WHERE status = 'options_ready' OR status = 'selected' OR status = 'booked';
