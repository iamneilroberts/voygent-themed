-- Seed: Additional Featured Trip Templates
-- VoyGent V3 - Template-Driven Architecture
-- Adds TV/Film, Historical, Culinary, Adventure, and Romance templates

-- TV & Movie Locations
INSERT OR REPLACE INTO trip_templates (
  id, name, description, icon,
  search_placeholder, search_help_text, featured,
  research_query_template, destination_criteria_prompt,
  research_synthesis_prompt, destination_confirmation_prompt,
  intake_prompt, options_prompt, daily_activity_prompt,
  flight_search_instructions, hotel_search_instructions, tour_search_instructions,
  number_of_options, trip_days_min, trip_days_max,
  luxury_levels, activity_levels,
  required_fields, optional_fields, example_inputs,
  is_active
) VALUES (
  'tvmovie-001',
  'TV & Movie Locations',
  'Visit filming locations from your favorite shows and movies with behind-the-scenes tours.',
  '🎬',
  'E.g., Game of Thrones filming locations in Croatia',
  'Enter the name of a TV show, movie, or franchise you''d like to explore filming locations for.',
  1,

  -- Phase 1: Research
  '{show_name} filming locations behind the scenes tours travel guide where was {show_name} filmed',
  'You are researching TV/movie filming locations. Focus on: (1) Actual filming sites accessible to tourists, (2) Behind-the-scenes tours and fan experiences, (3) Cities/regions with multiple filming locations, (4) Studio tours if applicable. Prioritize iconic scenes and accessible locations.',
  'Synthesize search results into 2-4 destination recommendations for filming locations. For each include: (1) Location name and what scenes were filmed there, (2) Tour options available, (3) Best time to visit, (4) Other attractions nearby. Present as an exciting itinerary for fans.',
  'Present the filming locations to the user with enthusiasm. Explain which iconic scenes were filmed at each location. Ask if they want to include all locations or focus on specific ones.',

  -- Phase 2: Trip Building
  'Welcome! Let''s plan an amazing trip to visit filming locations from your favorite show or movie. Tell me what you''d like to explore!',
  'Generate {number_of_options} trip options for visiting filming locations. Include: (1) Flights to primary filming region, (2) Hotels near key filming sites, (3) Official tours and fan experiences, (4) Day-by-day itinerary visiting iconic scenes, (5) Cost breakdown. Mix guided tours with self-exploration.',
  'For each day, balance famous filming locations with local attractions. Include: exact filming sites, photo opportunities at iconic scenes, behind-the-scenes tours, and free time to explore the area. Note any filming-related cafes, shops, or experiences.',

  -- API Instructions
  'Search round-trip flights to the nearest major airport to filming locations. Include flexible date options.',
  'Search hotels in central locations near filming sites. Include options near key scenes for photo opportunities.',
  'Search for official filming location tours, behind-the-scenes experiences, and fan-focused activities. Prioritize highly-rated guided tours.',

  -- Constraints
  3, 5, 14,
  '["Budget", "Comfort", "Luxury"]',
  '["Relaxed", "Moderate", "Active"]',
  '["duration", "departure_airport"]',
  '["travelers_adults", "travelers_children", "traveler_ages", "luxury_level", "activity_level", "departure_date", "home_country", "transportation_preference", "driving_comfort"]',
  '["Game of Thrones in Croatia", "Lord of the Rings New Zealand", "Harry Potter UK locations", "Breaking Bad Albuquerque"]',
  1
);

-- Historical Sites
INSERT OR REPLACE INTO trip_templates (
  id, name, description, icon,
  search_placeholder, search_help_text, featured,
  research_query_template, destination_criteria_prompt,
  research_synthesis_prompt, destination_confirmation_prompt,
  intake_prompt, options_prompt, daily_activity_prompt,
  flight_search_instructions, hotel_search_instructions, tour_search_instructions,
  number_of_options, trip_days_min, trip_days_max,
  luxury_levels, activity_levels,
  required_fields, optional_fields, example_inputs,
  is_active
) VALUES (
  'historical-001',
  'Historical Sites',
  'Explore significant historical locations, battlefields, and UNESCO World Heritage sites.',
  '⚔️',
  'E.g., WWII D-Day beaches in Normandy',
  'Enter a historical period, event, or location you''d like to explore.',
  1,

  -- Phase 1: Research
  '{historical_topic} historical sites museums tours travel guide {region} history',
  'You are researching historical travel destinations. Focus on: (1) Major historical sites and battlefields, (2) Museums with significant collections, (3) UNESCO World Heritage sites, (4) Expert-guided historical tours. Prioritize authentic historical experiences and educational value.',
  'Synthesize search results into 2-4 destination recommendations. For each include: (1) Historical significance and key events, (2) Museums and interpretive centers, (3) Guided tour options with historians, (4) Recommended duration. Present with historical context.',
  'Present the historical destinations with their significance. Explain the key events that happened at each location. Ask which sites interest them most and if they have specific historical interests to focus on.',

  -- Phase 2: Trip Building
  'Welcome! I''ll help you plan a meaningful journey through history. What historical period or events would you like to explore?',
  'Generate {number_of_options} trip options visiting historical sites. Include: (1) Flights to the region, (2) Hotels near historical districts, (3) Expert-guided historical tours, (4) Museum visits with context, (5) Day-by-day chronological or thematic itinerary. Balance education with experience.',
  'For each day, provide historical context for sites visited. Include: specific battlefields or monuments, museum highlights, expert-guided tours, and time for reflection. Add relevant historical details and recommended reading.',

  -- API Instructions
  'Search flights to nearest airport to primary historical sites. Consider multi-city if visiting different historical regions.',
  'Search hotels in historic districts or near major sites. Include options with historical character.',
  'Search for historian-led tours, battlefield visits, museum tours, and historical reenactments where available.',

  -- Constraints
  3, 4, 14,
  '["Budget", "Comfort", "Luxury"]',
  '["Relaxed", "Moderate", "Active"]',
  '["duration", "departure_airport"]',
  '["travelers_adults", "travelers_children", "traveler_ages", "luxury_level", "activity_level", "departure_date", "home_country", "transportation_preference", "driving_comfort"]',
  '["WWII Normandy D-Day beaches", "Roman Empire sites in Italy", "American Civil War battlefields", "Ancient Egypt pyramids and temples"]',
  1
);

-- Culinary Experiences
INSERT OR REPLACE INTO trip_templates (
  id, name, description, icon,
  search_placeholder, search_help_text, featured,
  research_query_template, destination_criteria_prompt,
  research_synthesis_prompt, destination_confirmation_prompt,
  intake_prompt, options_prompt, daily_activity_prompt,
  flight_search_instructions, hotel_search_instructions, tour_search_instructions,
  number_of_options, trip_days_min, trip_days_max,
  luxury_levels, activity_levels,
  required_fields, optional_fields, example_inputs,
  is_active
) VALUES (
  'culinary-001',
  'Culinary Experiences',
  'Discover world-class food and wine destinations with cooking classes and local tastings.',
  '🍽️',
  'E.g., Italian cuisine in Tuscany',
  'Enter a cuisine type, food region, or culinary experience you''d like to explore.',
  1,

  -- Phase 1: Research
  '{cuisine} {region} restaurants food tours cooking classes wine tastings local markets travel',
  'You are researching culinary travel destinations. Focus on: (1) Renowned restaurants and local eateries, (2) Cooking classes and culinary schools, (3) Food markets and local producers, (4) Wine regions and tastings, (5) Food tours and experiences. Prioritize authentic local cuisine.',
  'Synthesize search results into 2-4 destination recommendations. For each include: (1) Signature dishes and specialties, (2) Top restaurants and markets, (3) Cooking class options, (4) Wine/beverage experiences. Present as a delicious culinary journey.',
  'Present the culinary destinations with their food highlights. Explain signature dishes and what makes each region special. Ask about dietary preferences and specific culinary interests.',

  -- Phase 2: Trip Building
  'Welcome! Let''s plan a delicious culinary adventure. What cuisines or food experiences interest you?',
  'Generate {number_of_options} culinary trip options. Include: (1) Flights to food region, (2) Hotels near culinary districts, (3) Cooking classes and food tours, (4) Restaurant reservations for notable venues, (5) Market visits and wine tastings. Balance structured classes with free exploration.',
  'For each day, plan meals as experiences: morning market visits, cooking classes, lunch at local favorites, afternoon tastings, memorable dinners. Include specific restaurant recommendations, dish suggestions, and food markets to explore.',

  -- API Instructions
  'Search flights to nearest airport to culinary region. Consider arrival times for market visits.',
  'Search hotels in culinary districts or near food markets. Include boutique hotels with notable restaurants.',
  'Search for cooking classes, food tours, wine tastings, market tours, and culinary experiences. Prioritize authentic local experiences.',

  -- Constraints
  3, 4, 12,
  '["Budget", "Comfort", "Luxury"]',
  '["Relaxed", "Moderate", "Active"]',
  '["duration", "departure_airport"]',
  '["travelers_adults", "travelers_children", "traveler_ages", "luxury_level", "dietary_restrictions", "departure_date", "home_country", "transportation_preference", "driving_comfort"]',
  '["Italian cuisine in Tuscany", "Japanese food culture in Tokyo", "French wine and cheese in Bordeaux", "Street food tour in Bangkok"]',
  1
);

-- Adventure & Outdoor
INSERT OR REPLACE INTO trip_templates (
  id, name, description, icon,
  search_placeholder, search_help_text, featured,
  research_query_template, destination_criteria_prompt,
  research_synthesis_prompt, destination_confirmation_prompt,
  intake_prompt, options_prompt, daily_activity_prompt,
  flight_search_instructions, hotel_search_instructions, tour_search_instructions,
  number_of_options, trip_days_min, trip_days_max,
  luxury_levels, activity_levels,
  required_fields, optional_fields, example_inputs,
  is_active
) VALUES (
  'adventure-001',
  'Adventure & Outdoor',
  'Experience thrilling outdoor adventures from hiking and safaris to water sports.',
  '🏔️',
  'E.g., Hiking in Patagonia',
  'Enter an outdoor activity or adventure destination you''d like to experience.',
  1,

  -- Phase 1: Research
  '{activity} {destination} outdoor adventure tours guides best time travel',
  'You are researching adventure travel destinations. Focus on: (1) Best locations for the activity, (2) Reputable tour operators and guides, (3) Difficulty levels and fitness requirements, (4) Best seasons and weather conditions, (5) Safety considerations. Prioritize quality experiences with experienced operators.',
  'Synthesize search results into 2-4 destination recommendations. For each include: (1) Adventure highlights and activities, (2) Difficulty and fitness level needed, (3) Best time to visit, (4) Recommended guides/operators. Present with excitement about the adventure.',
  'Present the adventure destinations with their thrills. Explain what makes each location special for this activity. Ask about fitness level, experience, and any specific adventure goals.',

  -- Phase 2: Trip Building
  'Welcome! Let''s plan an unforgettable outdoor adventure. What activities or destinations excite you?',
  'Generate {number_of_options} adventure trip options. Include: (1) Flights to adventure base, (2) Accommodation appropriate for activity (lodges, camps, etc.), (3) Guided adventure experiences, (4) Equipment rental if needed, (5) Rest days between intense activities. Match difficulty to stated fitness level.',
  'For each day, balance adventure with recovery. Include: main activity with timing, difficulty rating, what''s included, rest periods, and backup options for weather. Note required gear and physical demands.',

  -- API Instructions
  'Search flights to nearest airport to adventure base. Consider baggage for outdoor gear.',
  'Search for adventure lodges, eco-camps, or hotels near activity areas. Include options with outdoor amenities.',
  'Search for guided adventures, equipment rental, multi-day treks, and outdoor experiences. Prioritize highly-rated operators with safety records.',

  -- Constraints
  3, 5, 21,
  '["Budget", "Comfort", "Luxury"]',
  '["Moderate", "Active", "Intense"]',
  '["duration", "departure_airport", "activity_level"]',
  '["travelers_adults", "travelers_children", "traveler_ages", "fitness_level", "experience_level", "departure_date", "home_country", "transportation_preference", "driving_comfort"]',
  '["Hiking Patagonia Torres del Paine", "Safari in Tanzania", "Scuba diving Great Barrier Reef", "Trekking to Everest Base Camp"]',
  1
);

-- Romance & Honeymoon
INSERT OR REPLACE INTO trip_templates (
  id, name, description, icon,
  search_placeholder, search_help_text, featured,
  research_query_template, destination_criteria_prompt,
  research_synthesis_prompt, destination_confirmation_prompt,
  intake_prompt, options_prompt, daily_activity_prompt,
  flight_search_instructions, hotel_search_instructions, tour_search_instructions,
  number_of_options, trip_days_min, trip_days_max,
  luxury_levels, activity_levels,
  required_fields, optional_fields, example_inputs,
  is_active
) VALUES (
  'romance-001',
  'Romance & Honeymoon',
  'Plan the perfect romantic getaway or honeymoon with intimate experiences.',
  '💑',
  'E.g., Honeymoon in the Maldives',
  'Enter your dream romantic destination or the type of romantic experience you''re seeking.',
  1,

  -- Phase 1: Research
  '{destination} romantic honeymoon couples resort intimate dining sunset experiences luxury',
  'You are researching romantic travel destinations. Focus on: (1) Couples resorts and romantic accommodations, (2) Private dining and sunset experiences, (3) Couples spa and wellness, (4) Intimate activities and excursions, (5) Special occasion arrangements. Prioritize privacy and romance.',
  'Synthesize search results into 2-4 romantic destination recommendations. For each include: (1) Why it''s perfect for couples, (2) Most romantic accommodations, (3) Special experiences available, (4) Best time to visit. Present with romantic appeal.',
  'Present the romantic destinations highlighting what makes each special for couples. Ask about the occasion (honeymoon, anniversary, etc.) and what romantic experiences matter most to them.',

  -- Phase 2: Trip Building
  'Welcome! Let''s plan an unforgettable romantic escape. Tell me about your dream getaway and the occasion you''re celebrating.',
  'Generate {number_of_options} romantic trip options. Include: (1) Flights with comfortable seating, (2) Romantic accommodations (overwater bungalows, suites, etc.), (3) Couples experiences (spa, dining, sunset cruises), (4) Private excursions, (5) Special touches for the occasion. Focus on intimacy and memorable moments.',
  'For each day, create romantic moments: leisurely mornings, couples activities, sunset experiences, intimate dinners. Include private time, spa treatments, and special occasion arrangements. Balance adventure with relaxation.',

  -- API Instructions
  'Search flights with premium economy or business class options for comfort. Consider arrival times for romantic effect.',
  'Search for romantic resorts, overwater bungalows, adult-only properties, and honeymoon suites. Prioritize properties known for romance.',
  'Search for couples spa, private dining, sunset cruises, romantic excursions, and special occasion experiences.',

  -- Constraints
  3, 5, 14,
  '["Comfort", "Luxury", "Ultra-Luxury"]',
  '["Relaxed", "Moderate"]',
  '["duration", "departure_airport"]',
  '["occasion", "luxury_level", "interests", "departure_date", "home_country", "transportation_preference", "driving_comfort"]',
  '["Honeymoon in Maldives", "Anniversary in Paris", "Romantic escape to Santorini", "Couples retreat in Bali"]',
  1
);
