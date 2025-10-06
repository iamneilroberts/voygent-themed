// POST /api/admin/build-theme - Build complete theme from free text description

import { selectProvider, callProvider } from '../lib/provider';

interface Env {
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { description } = body;

    if (!description || description.trim().length < 10) {
      return new Response(JSON.stringify({
        error: 'Please provide a detailed description of your theme (at least 10 characters)'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const provider = selectProvider(0, env, 'cheap');

    // Step 1: Generate theme metadata (ID, name, description, icon, fields)
    const metadataSystemPrompt = `You are an expert at designing trip theme configurations. Given a free-text description of a travel theme, extract and generate all the necessary metadata.

Output ONLY valid JSON with NO markdown code blocks. The JSON must have this exact structure:
{
  "id": "lowercase_id_no_spaces",
  "name": "Proper Theme Name",
  "description": "Brief one-line description",
  "icon": "🎯",
  "requiredFields": ["array", "of", "required", "fields"],
  "optionalFields": ["array", "of", "optional", "fields"],
  "exampleInputs": ["Example input 1", "Example input 2", "Example input 3"]
}

Guidelines:
- id: lowercase, underscore-separated, descriptive (e.g., "wellness", "music_festivals", "wildlife_safari")
- name: 2-4 words, proper case (e.g., "Wellness & Spa", "Music Festivals", "Wildlife Safari")
- description: One sentence, action-oriented (e.g., "Relax and rejuvenate at world-class spas")
- icon: Single emoji that represents the theme
- requiredFields: Theme-specific fields that MUST be extracted (e.g., for wellness: ["spa_types", "treatments"], for music: ["genres", "festivals"])
- optionalFields: Nice-to-have fields (e.g., ["budget_range", "celebrity_sightings"])
- exampleInputs: 3 realistic examples of user queries for this theme

Standard fields (already included for all themes, don't duplicate):
- party, duration_days, target_month, departure_airport, transport, travel_pace, luxury_level, activity_level, interests, notes`;

    const metadataUserPrompt = `Create theme metadata for this travel theme:\n\n${description}`;

    const metadataResponse = await callProvider(provider, {
      systemPrompt: metadataSystemPrompt,
      userPrompt: metadataUserPrompt,
      maxTokens: 800,
      temperature: 0.7
    });

    console.log('[Build Theme] Metadata response:', metadataResponse.content.substring(0, 200));

    // Parse metadata JSON
    let metadata;
    try {
      let jsonStr = metadataResponse.content.trim();

      // Remove markdown code blocks if present
      if (jsonStr.includes('```')) {
        const codeMatch = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (codeMatch) jsonStr = codeMatch[1];
      }

      const firstBrace = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
      }

      metadata = JSON.parse(jsonStr);
    } catch (parseError: any) {
      console.error('[Build Theme] Parse error:', parseError.message);
      return new Response(JSON.stringify({
        error: 'Failed to parse AI response',
        details: parseError.message,
        raw: metadataResponse.content.substring(0, 500)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Step 2: Generate intake prompt
    const intakeSystemPrompt = `You are an expert at writing intake normalization prompts for travel planning systems. Create a detailed prompt that will extract structured information from user inputs about ${metadata.name} trips.

The prompt should:
1. Explain the role clearly
2. List all possible input formats
3. Specify the exact JSON output structure
4. Include validation rules
5. Emphasize JSON-only output (no markdown, no prose)

Output the complete intake prompt as plain text (not wrapped in quotes or code blocks).`;

    const intakeUserPrompt = `Create an intake normalizer prompt for "${metadata.name}" trips.

Description: ${metadata.description}

Required fields to extract: ${metadata.requiredFields.join(', ')}
Optional fields: ${metadata.optionalFields.join(', ')}

Common fields for all themes (always include):
- theme: "${metadata.id}"
- party: { adults: int, children: int[], accessibility: string }
- duration_days: int
- target_month: string
- departure_airport: string
- transport: { rail: bool, car_ok: bool, driver_guide_ok: bool }
- travel_pace: "relaxed|moderate|exploratory"
- luxury_level: "Backpack|Savvy|Comfort|Boutique|OccasionalLuxe"
- activity_level: "gentle|moderate|ambitious"
- interests: string[]
- notes: string[]
- assumptions: string[]

The prompt must instruct the AI to output ONLY valid JSON with all these fields.`;

    const intakeResponse = await callProvider(provider, {
      systemPrompt: intakeSystemPrompt,
      userPrompt: intakeUserPrompt,
      maxTokens: 1500,
      temperature: 0.7
    });

    // Step 3: Generate options prompt
    const optionsSystemPrompt = `You are an expert at writing trip options generator prompts. Create a concise prompt that will generate 2-4 ${metadata.name} trip options.`;

    const optionsUserPrompt = `Create an options generator prompt for "${metadata.name}" trips.

Description: ${metadata.description}

The prompt should instruct the AI to:
1. Generate 2-4 diverse trip options
2. Focus on ${metadata.name.toLowerCase()}-specific experiences
3. Include practical tips and logistics
4. Tailor to party size, duration, and preferences
5. Provide accurate, realistic recommendations

Keep it concise (2-3 sentences). Output as plain text.`;

    const optionsResponse = await callProvider(provider, {
      systemPrompt: optionsSystemPrompt,
      userPrompt: optionsUserPrompt,
      maxTokens: 300,
      temperature: 0.7
    });

    // Combine everything
    const completeTheme = {
      ...metadata,
      intakePrompt: intakeResponse.content.trim(),
      optionsPrompt: optionsResponse.content.trim(),
      sourceDescription: description
    };

    return new Response(JSON.stringify(completeTheme), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error building theme:', error);

    return new Response(JSON.stringify({
      error: 'Failed to build theme',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
