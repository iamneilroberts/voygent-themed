-- Seed: Heritage & Ancestry Trip Template
-- VoyGent V3 - Template-Driven Architecture
-- This demonstrates the template-driven system with a complete Heritage template

INSERT OR REPLACE INTO trip_templates (
  id,
  name,
  description,
  icon,
  search_placeholder,
  search_help_text,
  featured,

  -- Phase 1: Research Prompts
  research_query_template,
  destination_criteria_prompt,
  research_synthesis_prompt,
  destination_confirmation_prompt,

  -- Phase 2: Trip Building Prompts
  intake_prompt,
  options_prompt,
  daily_activity_prompt,

  -- API Integration Instructions
  flight_search_instructions,
  hotel_search_instructions,
  tour_search_instructions,

  -- Trip Constraints
  number_of_options,
  trip_days_min,
  trip_days_max,
  luxury_levels,
  activity_levels,

  -- Required/Optional Fields
  required_fields,
  optional_fields,

  -- Example Inputs
  example_inputs,

  is_active
) VALUES (
  'heritage-ancestry-001',
  'Heritage & Ancestry',
  'Trace your family roots and explore ancestral homelands with personalized genealogy-focused itineraries.',
  '🌳',
  'E.g., Sullivan family from Cork, Ireland',
  'Tell us your family surname, region of origin, or specific ancestral story you''d like to explore.',
  1,

  -- Phase 1: Research Prompts
  'genealogy records {surname} {region}, immigration history {surname} {region}, historical sites {region} family heritage',
  'You are researching heritage destinations for family ancestry exploration. Focus on: (1) Cities/towns with genealogical archives and records, (2) Regions with significant {surname} family history, (3) Cultural sites relevant to ancestral heritage, (4) Accessibility for international travelers. Prioritize destinations with strong genealogy resources and documented family connections.',
  'Synthesize search results into 2-4 destination recommendations. For each destination include: (1) Name and geographic context, (2) Key genealogy sites (archives, libraries, historical societies), (3) Why it''s relevant to this family''s heritage, (4) Travel logistics (airports, accommodation availability), (5) Estimated days needed. Format as a conversational presentation with rationale.',
  'Present the recommended destinations to the user in a friendly, conversational tone. Explain why each location is significant for their family history. Ask if they would like to proceed with these destinations, add/remove any, or learn more about specific locations before confirming.',

  -- Phase 2: Trip Building Prompts
  'Welcome! I''m here to help you plan a meaningful heritage trip to explore your family''s ancestral roots. Let''s start by learning about your family history and what you hope to discover.',
  'Generate {number_of_options} distinct trip options with varying price points and experiences. Each option should include: (1) Flights from {departure_airport} to primary destination, (2) Hotels in each confirmed destination (match {luxury_level}), (3) Heritage-focused tours (genealogy research assistance, historical site visits, cultural experiences), (4) Day-by-day itinerary balancing research time and cultural exploration, (5) Total cost breakdown. Ensure diversity in hotel choices and tour selections across options.',
  'For each day, create a balanced schedule: Morning (genealogy research or historical site), Afternoon (cultural activity or guided tour), Evening (free time or optional dining experience). Include specific heritage sites, archives, museums, and cultural landmarks relevant to the family''s ancestry. Provide realistic time allocations and travel logistics between activities.',

  -- API Integration Instructions
  'Search for round-trip flights from {departure_airport} to the primary destination (closest international airport). Prefer direct flights or minimal connections. Return results with 3-5 options across different price points.',
  'Search for hotels in each confirmed destination. Filter by star rating matching luxury level: Budget=2-3 stars, Comfort=3-4 stars, Luxury=4-5 stars. Prioritize central locations near genealogy archives and historical districts. Include breakfast if available.',
  'Search for heritage and cultural tours: genealogy research services, historical walking tours, ancestral village visits, cultural workshops (cooking, music, language), museum guided tours. Filter by high ratings (4.0+) and relevance to family history themes.',

  -- Trip Constraints
  3,  -- number_of_options
  7,  -- trip_days_min
  14,  -- trip_days_max
  '["Budget", "Comfort", "Luxury"]',  -- luxury_levels (JSON)
  '["Relaxed", "Moderate", "Active"]',  -- activity_levels (JSON)

  -- Required/Optional Fields
  '["duration", "departure_airport"]',  -- required_fields (JSON)
  '["travelers_adults", "travelers_children", "luxury_level", "activity_level", "departure_date"]',  -- optional_fields (JSON)

  -- Example Inputs
  '["Sullivan family from Cork, Ireland", "Searching for my Italian roots in Tuscany", "Polish ancestry, grandmother from Krakow", "Scottish heritage, clan MacLeod connections"]',  -- example_inputs (JSON)

  1  -- is_active
);

-- Add more templates here in the future:
-- INSERT OR REPLACE INTO trip_templates (...) VALUES (...);  -- wine-001
-- INSERT OR REPLACE INTO trip_templates (...) VALUES (...);  -- film-001
