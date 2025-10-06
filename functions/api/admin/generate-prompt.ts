// POST /api/admin/generate-prompt - Generate theme prompts using AI

import { selectProvider, callProvider } from '../lib/provider';

interface Env {
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { type, theme } = body;

    if (!theme || !theme.id || !theme.name || !theme.description) {
      return new Response(JSON.stringify({
        error: 'Missing required theme fields'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const provider = selectProvider(0, env, 'cheap');

    if (type === 'intake' || type === 'both') {
      const intakeSystemPrompt = `You are an expert at writing intake normalization prompts for travel planning systems. Your task is to create a detailed prompt that will extract structured information from user inputs about ${theme.name} trips.

The prompt should:
1. Explain the role clearly
2. List all possible input formats
3. Specify the exact JSON output structure with all required and optional fields
4. Include validation rules
5. Be clear and concise`;

      const intakeUserPrompt = `Create an intake normalizer prompt for a "${theme.name}" trip theme.

Description: ${theme.description}

Required fields to extract: ${theme.requiredFields?.join(', ') || 'destinations, party, duration_days'}
Optional fields: ${theme.optionalFields?.join(', ') || 'target_month, departure_airport'}

Common fields for all themes:
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

The prompt should instruct the AI to output ONLY valid JSON with theme="${theme.id}" and all the fields above.`;

      const intakeResponse = await callProvider(provider, {
        systemPrompt: intakeSystemPrompt,
        userPrompt: intakeUserPrompt,
        maxTokens: 1500,
        temperature: 0.7
      });

      if (type === 'intake') {
        return new Response(JSON.stringify({
          intakePrompt: intakeResponse.content.trim()
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // If 'both', continue to generate options prompt
      const optionsSystemPrompt = `You are an expert at writing trip options generator prompts. Create a concise prompt that will generate 2-4 ${theme.name} trip options based on normalized intake data.`;

      const optionsUserPrompt = `Create an options generator prompt for "${theme.name}" trips.

Description: ${theme.description}

The prompt should instruct the AI to:
1. Generate 2-4 diverse trip options
2. Focus on ${theme.name.toLowerCase()}-specific experiences
3. Include practical tips and logistics
4. Tailor options to the party size, duration, and preferences from the intake
5. Provide accurate, realistic recommendations

Keep it concise (2-3 sentences).`;

      const optionsResponse = await callProvider(provider, {
        systemPrompt: optionsSystemPrompt,
        userPrompt: optionsUserPrompt,
        maxTokens: 300,
        temperature: 0.7
      });

      return new Response(JSON.stringify({
        intake: intakeResponse.content.trim(),
        options: optionsResponse.content.trim()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate options prompt only
    if (type === 'options') {
      const optionsSystemPrompt = `You are an expert at writing trip options generator prompts. Create a concise prompt that will generate 2-4 ${theme.name} trip options based on normalized intake data.`;

      const optionsUserPrompt = `Create an options generator prompt for "${theme.name}" trips.

Description: ${theme.description}

The prompt should instruct the AI to:
1. Generate 2-4 diverse trip options
2. Focus on ${theme.name.toLowerCase()}-specific experiences
3. Include practical tips and logistics
4. Tailor options to the party size, duration, and preferences from the intake
5. Provide accurate, realistic recommendations

Keep it concise (2-3 sentences).`;

      const optionsResponse = await callProvider(provider, {
        systemPrompt: optionsSystemPrompt,
        userPrompt: optionsUserPrompt,
        maxTokens: 300,
        temperature: 0.7
      });

      return new Response(JSON.stringify({
        optionsPrompt: optionsResponse.content.trim()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: 'Invalid type. Must be "intake", "options", or "both"'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error generating prompt:', error);

    return new Response(JSON.stringify({
      error: 'Failed to generate prompt',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
