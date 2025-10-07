#!/usr/bin/env node
// Script to populate trip_templates table from FALLBACK_TEMPLATES

const templates = {
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
  }
};

// Generate SQL INSERT statements
for (const [key, template] of Object.entries(templates)) {
  const sql = `INSERT INTO trip_templates (
    id, name, description, icon,
    intake_prompt, options_prompt,
    research_synthesis_prompt, research_query_template,
    required_fields, optional_fields, example_inputs,
    tags, is_featured, display_order
  ) VALUES (
    '${template.id}',
    '${template.name.replace(/'/g, "''")}',
    '${template.description.replace(/'/g, "''")}',
    '${template.icon}',
    '${template.intakePrompt.replace(/'/g, "''")}',
    '${template.optionsPrompt.replace(/'/g, "''")}',
    '${template.researchSynthesisPrompt.replace(/'/g, "''")}',
    '${template.researchQueryTemplate.replace(/'/g, "''")}',
    '${JSON.stringify(template.requiredFields)}',
    '${JSON.stringify(template.optionalFields)}',
    '${JSON.stringify(template.exampleInputs)}',
    '${JSON.stringify(template.tags)}',
    ${template.isFeatured ? 1 : 0},
    ${template.displayOrder}
  );`;

  console.log(sql);
  console.log('');
}
