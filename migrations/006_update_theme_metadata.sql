-- Update existing themes with tags and featured status

UPDATE trip_templates SET
  tags = '["family", "genealogy", "history", "cultural"]',
  is_featured = 1,
  display_order = 1
WHERE id = 'heritage';

UPDATE trip_templates SET
  tags = '["entertainment", "film", "tv", "pop-culture", "guided-tours"]',
  is_featured = 1,
  display_order = 2
WHERE id = 'tvmovie';

UPDATE trip_templates SET
  tags = '["history", "education", "cultural", "museums"]',
  is_featured = 1,
  display_order = 3
WHERE id = 'historical';

UPDATE trip_templates SET
  tags = '["food", "wine", "cooking", "cultural", "luxury"]',
  is_featured = 1,
  display_order = 4
WHERE id = 'culinary';

UPDATE trip_templates SET
  tags = '["outdoor", "nature", "adventure", "hiking", "wildlife"]',
  is_featured = 1,
  display_order = 5
WHERE id = 'adventure';
