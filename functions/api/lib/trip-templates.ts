// Trip Template System for VoyGent
// Supports multiple trip themes: heritage, tv/movies, historical, culinary, etc.
// All templates are stored in the D1 database.

export interface TripTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  intakePrompt: string;              // Custom intake normalizer prompt
  optionsPrompt: string;              // Custom options generator prompt
  researchSynthesisPrompt?: string;   // Custom research synthesis prompt (NEW)
  researchQueryTemplate?: string;     // Search query template (NEW)
  requiredFields: string[];           // Fields that MUST be extracted
  optionalFields: string[];           // Fields that are nice to have
  exampleInputs: string[];            // Example user inputs for this theme
  tags?: string[];                    // Search/filter tags
  isFeatured?: boolean;               // Show in featured section
  displayOrder?: number;              // Order in featured section
}

// Default template ID for fallback
const DEFAULT_TEMPLATE_ID = 'heritage';

interface TemplateRow {
  id: string;
  name: string;
  description: string;
  icon: string;
  intake_prompt: string;
  options_prompt: string;
  research_synthesis_prompt?: string;
  research_query_template?: string;
  required_fields: string;
  optional_fields: string;
  example_inputs: string;
  is_active: number;
  tags?: string;
  is_featured?: number;
  display_order?: number;
}

const FALLBACK_TEMPLATES: Record<string, TripTemplate> = {
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
    requiredFields: ['surnames', 'suspected_origins', 'party', 'duration_days'],
    optionalFields: ['immigration_window', 'target_month', 'departure_airport', 'sources'],
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

function cloneFallbackTemplate(template: TripTemplate): TripTemplate {
  return {
    ...template,
    requiredFields: [...template.requiredFields],
    optionalFields: [...template.optionalFields],
    exampleInputs: [...template.exampleInputs],
    tags: template.tags ? [...template.tags] : undefined
  };
}

function parseJsonArray(value: string | null, fallback: string[] = []): string[] {
  if (!value) return [...fallback];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [...fallback];
  } catch {
    return [...fallback];
  }
}

function rowToTemplate(row: TemplateRow): TripTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    intakePrompt: row.intake_prompt,
    optionsPrompt: row.options_prompt,
    researchSynthesisPrompt: row.research_synthesis_prompt || undefined,
    researchQueryTemplate: row.research_query_template || undefined,
    requiredFields: parseJsonArray(row.required_fields),
    optionalFields: parseJsonArray(row.optional_fields),
    exampleInputs: parseJsonArray(row.example_inputs),
    tags: row.tags ? parseJsonArray(row.tags) : undefined,
    isFeatured: row.is_featured === 1,
    displayOrder: row.display_order
  };
}

function normalizeTemplate(template: TripTemplate): TripTemplate {
  return {
    id: template.id.trim(),
    name: template.name.trim(),
    description: template.description.trim(),
    icon: template.icon.trim(),
    intakePrompt: template.intakePrompt.trim(),
    optionsPrompt: template.optionsPrompt.trim(),
    requiredFields: (template.requiredFields || []).map(f => f.trim()).filter(Boolean),
    optionalFields: (template.optionalFields || []).map(f => f.trim()).filter(Boolean),
    exampleInputs: (template.exampleInputs || []).map(f => f.trim()).filter(Boolean)
  };
}

function detectTemplateId(input: string, explicitTheme?: string): string {
  if (explicitTheme) return explicitTheme;

  const lowerInput = input.toLowerCase();

  if (lowerInput.match(/game of thrones|harry potter|lord of the rings|star wars|filming location|movie|tv show|series/i)) {
    return 'tvmovie';
  }

  if (lowerInput.match(/wwii|world war|battle|historical|revolution|ancient|empire|medieval/i)) {
    return 'historical';
  }

  if (lowerInput.match(/food|cuisine|cooking class|wine tour|michelin|restaurant|culinary|market/i)) {
    return 'culinary';
  }

  if (lowerInput.match(/hiking|safari|adventure|climbing|kayaking|wildlife|camping|national park/i)) {
    return 'adventure';
  }

  if (lowerInput.match(/surname|ancestry|family|genealogy|heritage|roots|immigrant/i)) {
    return 'heritage';
  }

  return DEFAULT_TEMPLATE_ID;
}

export async function listTemplates(db: D1Database, includeInactive: boolean = false): Promise<TripTemplate[]> {
  const query = includeInactive
    ? `SELECT * FROM trip_templates ORDER BY name`
    : `SELECT * FROM trip_templates WHERE is_active = 1 ORDER BY name`;

  try {
    const result = await db.prepare(query).all();
    const rows = (result.results || []) as TemplateRow[];

    if (rows.length === 0) {
      return Object.values(FALLBACK_TEMPLATES).map(cloneFallbackTemplate);
    }

    return rows.map(rowToTemplate);
  } catch (error: any) {
    console.warn('[Templates] Failed to list templates from DB, using fallbacks:', error?.message || error);
    return Object.values(FALLBACK_TEMPLATES).map(cloneFallbackTemplate);
  }
}

export async function getTemplate(id: string, db: D1Database, includeInactive: boolean = true): Promise<TripTemplate | null> {
  const query = includeInactive
    ? `SELECT * FROM trip_templates WHERE id = ?`
    : `SELECT * FROM trip_templates WHERE id = ? AND is_active = 1`;

  try {
    const row = await db.prepare(query).bind(id).first<TemplateRow>();

    if (row) {
      return rowToTemplate(row);
    }
  } catch (error: any) {
    console.warn(`[Templates] Failed to load template "${id}" from DB:`, error?.message || error);
  }

  const fallback = FALLBACK_TEMPLATES[id] || FALLBACK_TEMPLATES[DEFAULT_TEMPLATE_ID];
  if (fallback) {
    return cloneFallbackTemplate(fallback);
  }

  return null;
}

export async function selectTemplate(input: string, explicitTheme: string | undefined, db: D1Database): Promise<TripTemplate> {
  const templateId = detectTemplateId(input, explicitTheme);
  const template = await getTemplate(templateId, db, true);

  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  return template;
}

export async function upsertTemplate(db: D1Database, template: TripTemplate): Promise<TripTemplate> {
  const normalized = normalizeTemplate(template);

  if (!normalized.id || !normalized.name || !normalized.intakePrompt || !normalized.optionsPrompt) {
    throw new Error('Missing required template fields');
  }

  await db.prepare(
    `INSERT INTO trip_templates
      (id, name, description, icon, intake_prompt, options_prompt, required_fields, optional_fields, example_inputs, is_active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, unixepoch())
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      icon = excluded.icon,
      intake_prompt = excluded.intake_prompt,
      options_prompt = excluded.options_prompt,
      required_fields = excluded.required_fields,
      optional_fields = excluded.optional_fields,
      example_inputs = excluded.example_inputs,
      is_active = 1,
      updated_at = unixepoch()`
  ).bind(
    normalized.id,
    normalized.name,
    normalized.description,
    normalized.icon,
    normalized.intakePrompt,
    normalized.optionsPrompt,
    JSON.stringify(normalized.requiredFields),
    JSON.stringify(normalized.optionalFields),
    JSON.stringify(normalized.exampleInputs)
  ).run();

  const saved = await getTemplate(normalized.id, db, true);
  if (!saved) {
    throw new Error('Failed to persist template');
  }

  return saved;
}

export async function deactivateTemplate(db: D1Database, id: string): Promise<void> {
  await db.prepare(
    `UPDATE trip_templates SET is_active = 0, updated_at = unixepoch() WHERE id = ?`
  ).bind(id).run();
}

export async function deleteTemplate(db: D1Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM trip_templates WHERE id = ?`).bind(id).run();
}
