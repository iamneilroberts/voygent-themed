-- Migration 017: Add 4 Missing Featured Templates
-- Feature: 010-display-13-templates
-- Purpose: Add tvmovie, historical, culinary, and adventure as featured templates

-- TV & Movie Locations
INSERT INTO trip_templates (
  id, name, description, icon,
  intake_prompt, options_prompt,
  research_synthesis_prompt, research_query_template,
  required_fields, optional_fields, example_inputs,
  tags, is_featured, display_order, is_active
) VALUES (
  'tvmovie',
  'TV & Movie Locations',
  'Visit filming locations from your favorite shows',
  '🎬',
  'Extract TV/movie interests: show/movie name, specific locations, filming sites, fan experiences, duration, party size.',
  'Generate 2-4 TV/movie trip options featuring filming locations, studio tours, fan experiences, and themed accommodations.',
  'Based on these web search results about {show_name} filming locations, identify key sites, tours, and fan experiences. Web search results: {search_results}. Create a 2-3 paragraph summary listing specific filming locations and recommended tours.',
  '{show_name} filming locations behind the scenes tours travel',
  '["show_name", "party"]',
  '["duration", "target_month"]',
  '{"show_name": "Game of Thrones", "duration": 7, "adults": 2}',
  '["tv", "movies", "filming", "entertainment"]',
  1, 2, 1
);

-- Historical Sites
INSERT INTO trip_templates (
  id, name, description, icon,
  intake_prompt, options_prompt,
  research_synthesis_prompt, research_query_template,
  required_fields, optional_fields, example_inputs,
  tags, is_featured, display_order, is_active
) VALUES (
  'historical',
  'Historical Sites',
  'Explore significant historical locations',
  '⚔️',
  'Extract historical interests: time period, specific events, locations, educational preferences, duration, party size.',
  'Generate 2-4 historical trip options featuring battlefields, museums, UNESCO sites, and guided historical tours.',
  'Based on these web search results about {historical_event} sites, identify key locations, museums, and tours. Web search results: {search_results}. Create a 2-3 paragraph summary listing specific historical sites and recommended experiences.',
  '{historical_event} historical sites museums tours travel',
  '["historical_interest", "party"]',
  '["duration", "target_month"]',
  '{"historical_interest": "WWII Normandy", "duration": 5, "adults": 2}',
  '["history", "museums", "education", "cultural"]',
  1, 3, 1
);

-- Culinary Experiences
INSERT INTO trip_templates (
  id, name, description, icon,
  intake_prompt, options_prompt,
  research_synthesis_prompt, research_query_template,
  required_fields, optional_fields, example_inputs,
  tags, is_featured, display_order, is_active
) VALUES (
  'culinary',
  'Culinary Experiences',
  'Discover food and wine destinations',
  '🍽️',
  'Extract culinary interests: cuisine type, region, cooking classes, wine tours, markets, duration, party size.',
  'Generate 2-4 culinary trip options featuring cooking classes, food tours, wine tastings, and regional cuisine experiences.',
  'Based on these web search results about {cuisine} in {destination}, identify top restaurants, markets, and food experiences. Web search results: {search_results}. Create a 2-3 paragraph summary listing specific culinary highlights and recommended venues.',
  '{cuisine} {destination} restaurants food tours cooking classes travel',
  '["cuisine_interest", "party"]',
  '["destination", "duration", "target_month"]',
  '{"cuisine_interest": "Italian Tuscany", "duration": 6, "adults": 2}',
  '["food", "wine", "cooking", "culinary", "restaurants"]',
  1, 4, 1
);

-- Adventure & Outdoor
INSERT INTO trip_templates (
  id, name, description, icon,
  intake_prompt, options_prompt,
  research_synthesis_prompt, research_query_template,
  required_fields, optional_fields, example_inputs,
  tags, is_featured, display_order, is_active
) VALUES (
  'adventure',
  'Adventure & Outdoor',
  'Explore nature and outdoor activities',
  '🏔️',
  'Extract adventure interests: activity type (hiking/safari/kayaking), destination, difficulty level, duration, party size.',
  'Generate 2-4 adventure trip options featuring outdoor activities, national parks, guided adventures, and nature experiences.',
  'Based on these web search results about {activity} in {destination}, identify top locations, guides, and adventure experiences. Web search results: {search_results}. Create a 2-3 paragraph summary listing specific adventure opportunities and recommended tour operators.',
  '{activity} {destination} outdoor adventures tours travel',
  '["activity_interest", "party"]',
  '["destination", "duration", "difficulty"]',
  '{"activity_interest": "Hiking Patagonia", "duration": 10, "adults": 2}',
  '["adventure", "outdoors", "hiking", "nature", "active"]',
  1, 5, 1
);
