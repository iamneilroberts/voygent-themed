-- Migration 009: Add Research Synthesis Prompts to Trip Templates
-- Adds theme-specific research synthesis prompts for better AI-generated summaries

ALTER TABLE trip_templates ADD COLUMN research_synthesis_prompt TEXT DEFAULT NULL;
ALTER TABLE trip_templates ADD COLUMN research_query_template TEXT DEFAULT NULL;

-- Update existing templates with research prompts
UPDATE trip_templates SET research_synthesis_prompt =
'Based on these web search results about the {input} surname, identify the ACTUAL geographic origins and create a travel-focused summary.

IMPORTANT:
- Determine the TRUE ancestral homeland(s) from the search results (could be Scotland, Ireland, England, Wales, Germany, France, Scandinavia, etc.)
- If multiple countries are mentioned, include ALL relevant destinations
- List specific castles, heritage sites, and towns in EACH country of origin
- Provide geographic diversity - don''t assume Scotland unless search results confirm it

Web search results:
{search_results}

Create a 2-3 paragraph summary (150-200 words) that:
1. States the confirmed country/countries of origin
2. Lists specific heritage sites, castles, and towns to visit in EACH location
3. Offers travel recommendations across all ancestral regions'
WHERE id = 'heritage';

UPDATE trip_templates SET research_query_template = '{input} surname origin ancestral homeland castle heritage sites where to visit travel'
WHERE id = 'heritage';

UPDATE trip_templates SET research_synthesis_prompt =
'Based on these web search results about {input} filming locations, create a comprehensive travel guide summary.

Focus on:
- Actual filming locations that can be visited
- Towns, landmarks, and regions where scenes were shot
- Multiple countries/regions if the show/film had diverse locations
- Practical visit information (tours available, accessibility, best times to visit)

Web search results:
{search_results}

Create a 2-3 paragraph summary (150-200 words) that:
1. Identifies all major filming locations by country/region
2. Lists specific sites, towns, and landmarks from the show/film
3. Provides practical travel tips for visiting these locations'
WHERE id = 'tvmovie';

UPDATE trip_templates SET research_query_template = '{input} filming locations where to visit travel guide tours'
WHERE id = 'tvmovie';

UPDATE trip_templates SET research_synthesis_prompt =
'Based on these web search results about {input}, create a historical travel summary.

Focus on:
- Key historical sites, battlefields, museums related to this event
- Geographic locations across multiple countries if relevant
- Monuments, memorials, and commemorative sites
- Educational opportunities and guided tours

Web search results:
{search_results}

Create a 2-3 paragraph summary (150-200 words) that:
1. Identifies primary historical sites and their locations
2. Lists museums, monuments, and commemorative locations
3. Provides travel recommendations for experiencing this history'
WHERE id = 'historical';

UPDATE trip_templates SET research_query_template = '{input} historical sites museums where to visit travel guide'
WHERE id = 'historical';
