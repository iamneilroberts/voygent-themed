#!/usr/bin/env node

/**
 * Export FALLBACK_TEMPLATES from trip-templates.ts to SQL INSERT statements
 *
 * This script reads the TypeScript file, extracts the template definitions,
 * and generates SQL INSERT statements for the database.
 */

import fs from 'fs';
import path from 'path';

// Template data extracted from trip-templates.ts
const FALLBACK_TEMPLATES = {
  heritage: {
    id: 'heritage',
    name: 'Heritage & Ancestry',
    description: 'Explore your family roots and ancestral homelands',
    icon: '🌳',
    intakePrompt: `ROLE: Heritage Trip Intake Normalizer

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
}`,
    optionsPrompt: 'Generate 2-4 heritage trip options focusing on ancestral homelands, surname origins, and family history sites. Include cathedrals, cemeteries, archives, and regional museums.',
    researchSynthesisPrompt: `You are a genealogy and heritage travel expert. Analyze the provided research about this surname and synthesize key insights for trip planning.

Focus on:
1. Geographic origins and migration patterns
2. Historical sites, castles, and ancestral homes
3. Regional cultural heritage and traditions
4. Relevant museums, archives, and genealogy resources

Provide a concise summary (2-3 paragraphs) highlighting the most relevant travel destinations and experiences.`,
    researchQueryTemplate: '{surname} family heritage sites ancestral homes castles historical tours travel destinations',
    requiredFields: ['surnames', 'party'],
    optionalFields: ['suspected_origins', 'immigration_window', 'target_month', 'departure_airport', 'sources', 'duration_days'],
    exampleInputs: [
      'McLeod family from Isle of Skye, Scotland - 2 adults, 7 days in June',
      'https://www.ancestry.com/family-tree/person/tree/123456789/person/987654321',
      "O'Brien surname, possibly from County Clare, Ireland"
    ],
    tags: ['family', 'genealogy', 'history', 'cultural'],
    isFeatured: true,
    displayOrder: 1
  },
  tvmovie: {
    id: 'tvmovie',
    name: 'TV & Movie Locations',
    description: 'Visit filming locations from your favorite shows and films',
    icon: '🎬',
    intakePrompt: `ROLE: TV/Movie Location Trip Intake Normalizer

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
  "specific_scenes": string[],           // e.g., ["King's Landing", "Winterfell"]
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
}`,
    optionsPrompt: 'Generate 2-4 TV/movie location trip options. Focus on authentic filming locations, behind-the-scenes experiences, and photo opportunities. Include practical tips for visiting each site.',
    researchSynthesisPrompt: `You are a film location travel expert. Analyze the provided research about filming locations for this TV show or movie and synthesize key insights for trip planning.

Focus on:
1. Actual filming locations and their accessibility
2. Behind-the-scenes tours and experiences available
3. Best times to visit and avoid crowds
4. Related attractions and secondary locations

Provide a concise summary (2-3 paragraphs) highlighting the most iconic and visitable filming locations.`,
    researchQueryTemplate: '{title} filming locations tour guide visitor information',
    requiredFields: ['titles', 'party', 'duration_days'],
    optionalFields: ['specific_scenes', 'fan_level', 'visited_locations', 'target_month'],
    exampleInputs: [
      'Game of Thrones filming locations - Northern Ireland and Croatia, 10 days',
      'Lord of the Rings New Zealand tour, superfan, 14 days',
      'Harry Potter London locations, family with kids (8, 11), 5 days'
    ],
    tags: ['entertainment', 'film', 'tv', 'pop-culture', 'guided-tours'],
    isFeatured: true,
    displayOrder: 2
  },
  historical: {
    id: 'historical',
    name: 'Historical Events',
    description: 'Walk through history at significant event locations',
    icon: '⚔️',
    intakePrompt: `ROLE: Historical Event Trip Intake Normalizer

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
}`,
    optionsPrompt: 'Generate 2-4 historical event trip options. Focus on key sites, museums, memorials, and educational experiences. Include expert guides where available. Provide historical context for each location.',
    researchSynthesisPrompt: `You are a historical travel expert. Analyze the provided research about this historical event or period and synthesize key insights for trip planning.

Focus on:
1. Key historical sites, battlefields, and monuments
2. Museums and interpretive centers with relevant exhibits
3. Expert-led tours and educational programs
4. Primary and secondary locations of significance

Provide a concise summary (2-3 paragraphs) highlighting the most historically significant and accessible sites.`,
    researchQueryTemplate: '{event} historical sites museums tours visitor information',
    requiredFields: ['events', 'party', 'duration_days'],
    optionalFields: ['time_periods', 'educational_depth', 'target_month'],
    exampleInputs: [
      'WWII sites in France - D-Day beaches, Paris liberation, 8 days',
      'Ancient Rome tour - Colosseum, Forum, Pompeii, 10 days',
      'American Revolution sites - Boston, Philadelphia, Yorktown, 7 days'
    ],
    tags: ['history', 'education', 'cultural', 'museums'],
    isFeatured: true,
    displayOrder: 3
  },
  culinary: {
    id: 'culinary',
    name: 'Culinary & Food Tours',
    description: 'Explore regional cuisines and food traditions',
    icon: '🍴',
    intakePrompt: `ROLE: Culinary Trip Intake Normalizer

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
}`,
    optionsPrompt: 'Generate 2-4 culinary trip options. Focus on authentic local experiences, cooking classes, market tours, wine regions, and Michelin-starred restaurants. Include practical dining tips and reservations guidance.',
    researchSynthesisPrompt: `You are a culinary travel expert. Analyze the provided research about this cuisine or food region and synthesize key insights for trip planning.

Focus on:
1. Signature dishes and regional specialties
2. Top restaurants, markets, and food halls
3. Cooking schools and hands-on food experiences
4. Wine regions, breweries, and beverage experiences

Provide a concise summary (2-3 paragraphs) highlighting the most authentic and memorable culinary experiences.`,
    researchQueryTemplate: '{cuisine} {region} restaurants cooking classes food tours markets',
    requiredFields: ['cuisines', 'party', 'duration_days'],
    optionalFields: ['regions', 'dietary_restrictions', 'cooking_classes', 'wine_tours'],
    exampleInputs: [
      'Italian food tour - Tuscany and Emilia-Romagna, cooking classes, 10 days',
      'French wine regions - Bordeaux, Burgundy, Champagne, 14 days',
      'Tokyo ramen and sushi tour, vegetarian options, 7 days'
    ],
    tags: ['food', 'wine', 'cooking', 'cultural', 'luxury'],
    isFeatured: true,
    displayOrder: 4
  },
  adventure: {
    id: 'adventure',
    name: 'Adventure & Outdoor',
    description: 'Hiking, wildlife, and outdoor exploration',
    icon: '🏔️',
    intakePrompt: `ROLE: Adventure Trip Intake Normalizer

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
  "activities": string[],                // e.g., ["Hiking", "Wildlife safari"]
  "destinations": string[],              // e.g., ["Patagonia", "Banff"]
  "fitness_level": "beginner|intermediate|advanced"|null,
  "party": { "adults": int, "children": int[], "accessibility": "none|light|wheelchair|other" },
  "duration_days": int|null,
  "target_month": string|null,
  "departure_airport": string|null,
  "transport": { "rail": bool, "car_ok": bool, "driver_guide_ok": bool },
  "travel_pace": "relaxed|moderate|exploratory"|null,
  "luxury_level": "Backpack|Savvy|Comfort|Boutique|OccasionalLuxe"|null,
  "activity_level": "gentle|moderate|ambitious"|null,
  "interests": string[],
  "lodging_style": "camping|lodges|hotels"|null,
  "notes": string[],
  "assumptions": string[]
}`,
    optionsPrompt: 'Generate 2-4 outdoor adventure trip options. Mix guided and self-guided days, highlight safety considerations, and include realistic pacing for the declared fitness level.',
    researchSynthesisPrompt: `You are an adventure travel expert. Analyze the provided research about this destination or activity and synthesize key insights for trip planning.

Focus on:
1. Best trails, routes, and adventure activities available
2. Difficulty levels and required fitness/experience
3. Best seasons and weather considerations
4. Guided services, permits, and safety requirements

Provide a concise summary (2-3 paragraphs) highlighting the most rewarding and accessible adventure experiences.`,
    researchQueryTemplate: '{destination} {activity} hiking trails tours permits best time visit',
    requiredFields: ['activities', 'party', 'duration_days'],
    optionalFields: ['destinations', 'fitness_level', 'lodging_style', 'target_month'],
    exampleInputs: [
      'Patagonia hiking and glacier trek, experienced hikers, 12 days',
      'Kenya safari with teenager, moderate fitness, 9 days',
      'Swiss Alps via ferrata and mountain biking, adventurous couple, 8 days'
    ],
    tags: ['outdoor', 'nature', 'adventure', 'hiking', 'wildlife'],
    isFeatured: true,
    displayOrder: 5
  }
};

/**
 * Escape single quotes for SQL by replacing ' with ''
 */
function escapeSql(str) {
  if (str === null || str === undefined) {
    return 'NULL';
  }
  return "'" + String(str).replace(/'/g, "''") + "'";
}

/**
 * Convert a template object to a SQL INSERT statement
 */
function templateToSql(template) {
  const id = escapeSql(template.id);
  const name = escapeSql(template.name);
  const description = escapeSql(template.description);
  const icon = escapeSql(template.icon);
  const intakePrompt = escapeSql(template.intakePrompt);
  const optionsPrompt = escapeSql(template.optionsPrompt);
  const researchSynthesisPrompt = template.researchSynthesisPrompt
    ? escapeSql(template.researchSynthesisPrompt)
    : 'NULL';
  const researchQueryTemplate = template.researchQueryTemplate
    ? escapeSql(template.researchQueryTemplate)
    : 'NULL';
  const requiredFields = escapeSql(JSON.stringify(template.requiredFields));
  const optionalFields = escapeSql(JSON.stringify(template.optionalFields));
  const exampleInputs = escapeSql(JSON.stringify(template.exampleInputs));
  const tags = template.tags ? escapeSql(JSON.stringify(template.tags)) : 'NULL';
  const isFeatured = template.isFeatured ? 1 : 0;
  const displayOrder = template.displayOrder || 'NULL';

  return `INSERT INTO trip_templates (
  id,
  name,
  description,
  icon,
  intake_prompt,
  options_prompt,
  research_synthesis_prompt,
  research_query_template,
  required_fields,
  optional_fields,
  example_inputs,
  tags,
  is_featured,
  display_order,
  is_active,
  created_at
) VALUES (
  ${id},
  ${name},
  ${description},
  ${icon},
  ${intakePrompt},
  ${optionsPrompt},
  ${researchSynthesisPrompt},
  ${researchQueryTemplate},
  ${requiredFields},
  ${optionalFields},
  ${exampleInputs},
  ${tags},
  ${isFeatured},
  ${displayOrder},
  1,
  unixepoch()
);`;
}

/**
 * Generate SQL file with DELETE and INSERT statements
 */
function generateSql() {
  const sqlStatements = [];

  // Add header comment
  sqlStatements.push('-- VoyGent Trip Templates');
  sqlStatements.push('-- Generated from FALLBACK_TEMPLATES in trip-templates.ts');
  sqlStatements.push(`-- Generated at: ${new Date().toISOString()}`);
  sqlStatements.push('');

  // Delete existing templates
  sqlStatements.push('-- Clear existing templates');
  sqlStatements.push('DELETE FROM trip_templates;');
  sqlStatements.push('');

  // Add each template
  sqlStatements.push('-- Insert templates');
  const templateIds = ['heritage', 'tvmovie', 'historical', 'culinary', 'adventure'];

  templateIds.forEach(templateId => {
    const template = FALLBACK_TEMPLATES[templateId];
    sqlStatements.push('');
    sqlStatements.push(`-- Template: ${template.name} (${template.id})`);
    sqlStatements.push(templateToSql(template));
  });

  return sqlStatements.join('\n');
}

/**
 * Main execution
 */
function main() {
  try {
    const sql = generateSql();
    const outputPath = '/tmp/insert_templates.sql';

    fs.writeFileSync(outputPath, sql, 'utf8');

    console.log('Successfully generated SQL file:');
    console.log(`  Output: ${outputPath}`);
    console.log(`  Templates: ${Object.keys(FALLBACK_TEMPLATES).length}`);
    console.log('');
    console.log('You can now run this SQL against your database:');
    console.log(`  cat ${outputPath} | sqlite3 your-database.db`);
  } catch (error) {
    console.error('Error generating SQL:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
