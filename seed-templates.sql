-- Seed trip_templates table with all default themes

INSERT OR REPLACE INTO trip_templates
  (id, name, description, icon, intake_prompt, options_prompt, required_fields, optional_fields, example_inputs, is_active)
VALUES
  (
    'heritage',
    'Heritage & Ancestry',
    'Explore your family roots and ancestral homelands',
    '🌳',
    'ROLE: Heritage Trip Intake Normalizer

INPUTS MAY INCLUDE:
- Surnames and family names
- Suspected ancestral origins (countries, regions, cities)
- Genealogy URLs (Ancestry, FamilySearch, MyHeritage, WikiTree)
- Immigration history, dates, anecdotes
- Uploaded documents (PDFs, images, family records)

TASK:
Extract all relevant information and produce a structured JSON output.

CRITICAL: Output ONLY valid JSON. No prose, no markdown code blocks. Start with { and end with }.

OUTPUT JSON ONLY:
{
  "theme": "heritage",
  "surnames": string[],
  "suspected_origins": string[],
  "immigration_window": string|null,
  "party": { "adults": int, "children": int[], "accessibility": "none|light|wheelchair|other" },
  "duration_days": int|null,
  "target_month": string|null,
  "departure_airport": string|null,
  "transport": { "rail": bool, "car_ok": bool, "driver_guide_ok": bool },
  "travel_pace": "relaxed|moderate|exploratory"|null,
  "luxury_level": "Backpack|Savvy|Comfort|Boutique|OccasionalLuxe"|null,
  "activity_level": "gentle|moderate|ambitious"|null,
  "interests": string[],
  "sources": [{ "kind":"url|file|text|image", "value":string, "notes":string }],
  "notes": string[],
  "assumptions": string[]
}',
    'Generate 2-4 heritage trip options focusing on ancestral homelands, surname origins, and family history sites. Include cathedrals, cemeteries, archives, and regional museums.',
    '["surnames","suspected_origins","party","duration_days"]',
    '["immigration_window","target_month","departure_airport","sources"]',
    '["McLeod family from Isle of Skye, Scotland - 2 adults, 7 days in June","https://www.ancestry.com/family-tree/person/tree/123456789/person/987654321","O''Brien surname, possibly from County Clare, Ireland"]',
    1
  ),
  (
    'tvmovie',
    'TV & Movie Locations',
    'Visit filming locations from your favorite shows and films',
    '🎬',
    'ROLE: TV/Movie Location Trip Intake Normalizer

INPUTS MAY INCLUDE:
- TV show or movie titles
- Specific scenes or episodes of interest
- Actor/character preferences
- Already-visited locations vs. must-see locations
- Fan level (casual viewer vs. superfan)

TASK:
Extract all relevant information and produce a structured JSON output.

CRITICAL: Output ONLY valid JSON. No prose, no markdown code blocks. Start with { and end with }.

OUTPUT JSON ONLY:
{
  "theme": "tvmovie",
  "titles": string[],                    // e.g., ["Game of Thrones", "The Crown"]
  "specific_scenes": string[],           // e.g., ["King''s Landing", "Winterfell"]
  "fan_level": "casual|enthusiast|superfan"|null,
  "party": { "adults": int, "children": int[], "accessibility": "none|light|wheelchair|other" },
  "duration_days": int|null,
  "target_month": string|null,
  "departure_airport": string|null,
  "transport": { "rail": bool, "car_ok": bool, "driver_guide_ok": bool },
  "travel_pace": "relaxed|moderate|exploratory"|null,
  "luxury_level": "Backpack|Savvy|Comfort|Boutique|OccasionalLuxe"|null,
  "activity_level": "gentle|moderate|ambitious"|null,
  "interests": string[],                 // e.g., ["Behind-the-scenes tours", "Photo ops", "Guided tours"]
  "visited_locations": string[],         // Locations already visited
  "notes": string[],
  "assumptions": string[]
}',
    'Generate 2-4 TV/movie location trip options. Focus on authentic filming locations, behind-the-scenes experiences, and photo opportunities. Include practical tips for visiting each site.',
    '["titles","party","duration_days"]',
    '["specific_scenes","fan_level","visited_locations","target_month"]',
    '["Game of Thrones filming locations - Northern Ireland and Croatia, 10 days","Lord of the Rings New Zealand tour, superfan, 14 days","Harry Potter London locations, family with kids (8, 11), 5 days"]',
    1
  ),
  (
    'historical',
    'Historical Events',
    'Walk through history at significant event locations',
    '⚔️',
    'ROLE: Historical Event Trip Intake Normalizer

INPUTS MAY INCLUDE:
- Historical events or periods of interest
- Specific battles, treaties, movements
- Time periods (e.g., "Roman Empire", "WWII", "Renaissance")
- Educational level (casual interest vs. deep dive)
- Preferred regions or countries

TASK:
Extract all relevant information and produce a structured JSON output.

CRITICAL: Output ONLY valid JSON. No prose, no markdown code blocks. Start with { and end with }.

OUTPUT JSON ONLY:
{
  "theme": "historical",
  "events": string[],                    // e.g., ["D-Day Normandy", "Battle of Waterloo"]
  "time_periods": string[],              // e.g., ["WWII", "Napoleonic Wars"]
  "educational_depth": "overview|moderate|deep_dive"|null,
  "party": { "adults": int, "children": int[], "accessibility": "none|light|wheelchair|other" },
  "duration_days": int|null,
  "target_month": string|null,
  "departure_airport": string|null,
  "transport": { "rail": bool, "car_ok": bool, "driver_guide_ok": bool },
  "travel_pace": "relaxed|moderate|exploratory"|null,
  "luxury_level": "Backpack|Savvy|Comfort|Boutique|OccasionalLuxe"|null,
  "activity_level": "gentle|moderate|ambitious"|null,
  "interests": string[],                 // e.g., ["Museums", "Battlefields", "Archives", "Guided tours"]
  "notes": string[],
  "assumptions": string[]
}',
    'Generate 2-4 historical event trip options. Focus on key sites, museums, memorials, and educational experiences. Include expert guides where available. Provide historical context for each location.',
    '["events","party","duration_days"]',
    '["time_periods","educational_depth","target_month"]',
    '["WWII sites in France - D-Day beaches, Paris liberation, 8 days","Ancient Rome tour - Colosseum, Forum, Pompeii, 10 days","American Revolution sites - Boston, Philadelphia, Yorktown, 7 days"]',
    1
  ),
  (
    'culinary',
    'Culinary & Food Tours',
    'Explore regional cuisines and food traditions',
    '🍴',
    'ROLE: Culinary Trip Intake Normalizer

INPUTS MAY INCLUDE:
- Cuisine types or regional food interests
- Dietary restrictions or preferences
- Cooking class interest vs. dining only
- Market tours, wine regions, farm visits
- Food expertise level (beginner foodie vs. chef/expert)

TASK:
Extract all relevant information and produce a structured JSON output.

CRITICAL: Output ONLY valid JSON. No prose, no markdown code blocks. Start with { and end with }.

OUTPUT JSON ONLY:
{
  "theme": "culinary",
  "cuisines": string[],                  // e.g., ["Italian", "French", "Japanese"]
  "regions": string[],                   // e.g., ["Tuscany", "Provence", "Kyoto"]
  "dietary_restrictions": string[],      // e.g., ["vegetarian", "gluten-free", "kosher"]
  "cooking_classes": bool,
  "wine_tours": bool,
  "market_tours": bool,
  "expertise_level": "beginner|intermediate|expert"|null,
  "party": { "adults": int, "children": int[], "accessibility": "none|light|wheelchair|other" },
  "duration_days": int|null,
  "target_month": string|null,
  "departure_airport": string|null,
  "transport": { "rail": bool, "car_ok": bool, "driver_guide_ok": bool },
  "travel_pace": "relaxed|moderate|exploratory"|null,
  "luxury_level": "Backpack|Savvy|Comfort|Boutique|OccasionalLuxe"|null,
  "activity_level": "gentle|moderate|ambitious"|null,
  "interests": string[],
  "notes": string[],
  "assumptions": string[]
}',
    'Generate 2-4 culinary trip options. Focus on authentic local experiences, cooking classes, market tours, wine regions, and Michelin-starred restaurants. Include practical dining tips and reservations guidance.',
    '["cuisines","party","duration_days"]',
    '["regions","dietary_restrictions","cooking_classes","wine_tours"]',
    '["Italian food tour - Tuscany and Emilia-Romagna, cooking classes, 10 days","French wine regions - Bordeaux, Burgundy, Champagne, 14 days","Tokyo ramen and sushi tour, vegetarian options, 7 days"]',
    1
  ),
  (
    'adventure',
    'Adventure & Outdoor',
    'Hiking, wildlife, and outdoor exploration',
    '🏔️',
    'ROLE: Adventure Trip Intake Normalizer

INPUTS MAY INCLUDE:
- Activity types (hiking, climbing, kayaking, safari, etc.)
- Fitness level and experience
- Wildlife interests
- National parks or specific trails
- Camping vs. lodging preferences

TASK:
Extract all relevant information and produce a structured JSON output.

CRITICAL: Output ONLY valid JSON. No prose, no markdown code blocks. Start with { and end with }.

OUTPUT JSON ONLY:
{
  "theme": "adventure",
  "activities": string[],                // e.g., ["hiking", "wildlife viewing", "kayaking"]
  "locations": string[],                 // e.g., ["Patagonia", "Swiss Alps", "Serengeti"]
  "fitness_level": "beginner|intermediate|advanced"|null,
  "camping_ok": bool,
  "wildlife_interests": string[],        // e.g., ["Big 5", "Birds", "Marine life"]
  "party": { "adults": int, "children": int[], "accessibility": "none|light|wheelchair|other" },
  "duration_days": int|null,
  "target_month": string|null,
  "departure_airport": string|null,
  "transport": { "rail": bool, "car_ok": bool, "driver_guide_ok": bool },
  "travel_pace": "relaxed|moderate|exploratory"|null,
  "luxury_level": "Backpack|Savvy|Comfort|Boutique|OccasionalLuxe"|null,
  "activity_level": "gentle|moderate|ambitious"|null,
  "interests": string[],
  "notes": string[],
  "assumptions": string[]
}',
    'Generate 2-4 adventure trip options. Focus on national parks, hiking trails, wildlife viewing, and outdoor activities. Include difficulty levels, required gear, and best seasons. Balance adventure with comfort based on luxury level.',
    '["activities","locations","party","duration_days"]',
    '["fitness_level","camping_ok","wildlife_interests","target_month"]',
    '["Patagonia hiking - Torres del Paine, glaciers, 12 days, moderate fitness","African safari - Kenya and Tanzania, Big 5, luxury lodges, 10 days","Swiss Alps hiking - Interlaken, Zermatt, intermediate trails, 8 days"]',
    1
  );
