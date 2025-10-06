// PATCH /api/trips/:id/ab - Generate A/B variants based on preferences
import { getTrip, updateTrip, saveMessage } from '../../lib/db';
import { selectProvider, callProvider } from '../../lib/provider';
import { OPTION_SELECTOR_TO_AB } from '../../lib/prompts';
import * as amadeus from '../../lib/amadeus';

interface Env {
  DB: D1Database;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  AMADEUS_CLIENT_ID?: string;
  AMADEUS_CLIENT_SECRET?: string;
  AMADEUS_API_URL?: string;
}

export async function onRequestPatch(context: { request: Request; env: Env; params: { id: string } }) {
  const { request, env, params } = context;

  try {
    const body = await request.json();
    const { transport, luxury, activity, accessibility } = body;

    const trip = await getTrip(env.DB, params.id);
    if (!trip || !trip.itinerary_json) {
      return new Response(JSON.stringify({ error: 'Trip or itinerary not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const currentItinerary = JSON.parse(trip.itinerary_json);
    const intake = trip.intake_json ? JSON.parse(trip.intake_json) : {};

    // Build user preferences object
    const preferences = {
      transport: transport || intake.transport,
      luxury: luxury || intake.luxury_level || 'Comfort',
      activity: activity || intake.activity_level || 'moderate',
      accessibility: accessibility || intake.party?.accessibility || 'none'
    };

    // Call provider to generate A/B variants (use SMART if context is large)
    const contextSize = JSON.stringify(currentItinerary).length / 4;
    const provider = selectProvider(contextSize, env);

    const prompt = `${OPTION_SELECTOR_TO_AB}

Current itinerary:
${JSON.stringify(currentItinerary, null, 2)}

User preferences:
${JSON.stringify(preferences, null, 2)}`;

    const response = await callProvider(provider, {
      systemPrompt: OPTION_SELECTOR_TO_AB,
      userPrompt: prompt,
      maxTokens: 900,
      temperature: 0.8
    });

    // Parse A/B variants
    let variantsJson;
    try {
      console.log('[A/B Variants] Raw AI response:', response.content.substring(0, 500));

      // Try to extract JSON - handle markdown code blocks
      let jsonText = response.content;

      // Remove markdown code blocks if present
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      // Find JSON object
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[A/B Variants] No JSON found in response');
        throw new Error('No JSON found in response');
      }

      variantsJson = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (!variantsJson.variantA || !variantsJson.variantB) {
        console.error('[A/B Variants] Invalid structure, missing variants');
        throw new Error('Invalid variants structure');
      }
    } catch (e: any) {
      console.error('[A/B Variants] Parse error:', e.message);
      return new Response(JSON.stringify({
        error: 'Failed to parse variants JSON',
        details: e.message,
        raw: response.content.substring(0, 1000)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch flight pricing for each variant
    const intakeData = trip.intake_json ? JSON.parse(trip.intake_json) : {};
    const origin = intakeData.origin_airport || 'JFK'; // Default if not specified

    // Convert target_month to YYYY-MM format for next year
    const getNextYearMonth = (monthName: string | null): string => {
      if (!monthName) {
        // Default to 6 months out if no month specified
        return new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7);
      }

      const monthMap: Record<string, number> = {
        'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5,
        'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11
      };

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const targetMonth = monthMap[monthName];

      if (targetMonth === undefined) {
        return new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7);
      }

      // If target month has passed this year, use next year
      const targetYear = (targetMonth < currentMonth || (targetMonth === currentMonth && now.getDate() > 15))
        ? currentYear + 1
        : currentYear;

      const monthStr = String(targetMonth + 1).padStart(2, '0');
      return `${targetYear}-${monthStr}`;
    };

    const travelMonth = intakeData.month || getNextYearMonth(intakeData.target_month);
    const adults = intakeData.party?.adults || 2;

    // Enrich each variant with flight pricing
    const enrichedVariants = await Promise.all(
      [variantsJson.variantA, variantsJson.variantB].map(async (variant) => {
        if (!variant || !variant.cities || variant.cities.length === 0) return variant;

        // Use first city as primary destination for flight pricing
        const primaryCity = variant.cities[0];

        // Map city names to airport codes (UK/Europe heritage destinations)
        const cityToAirport: Record<string, string> = {
          // Scotland
          'Edinburgh': 'EDI',
          'Glasgow': 'GLA',
          'Inverness': 'INV',
          'Isle of Skye': 'INV', // Nearest airport
          'Aberdeen': 'ABZ',
          'Dundee': 'DND',

          // England
          'London': 'LHR',
          'York': 'MAN', // Manchester is nearest major airport to York
          'Manchester': 'MAN',
          'Birmingham': 'BHX',
          'Liverpool': 'LPL',
          'Newcastle': 'NCL',
          'Bristol': 'BRS',

          // Ireland
          'Dublin': 'DUB',
          'Cork': 'ORK',
          'Shannon': 'SNN',
          'Galway': 'SNN', // Nearest airport

          // Wales
          'Cardiff': 'CWL',

          // France
          'Paris': 'CDG',
          'Lyon': 'LYS',
          'Marseille': 'MRS',

          // Germany
          'Berlin': 'BER',
          'Munich': 'MUC',
          'Frankfurt': 'FRA',
          'Hamburg': 'HAM',

          // Italy
          'Rome': 'FCO',
          'Milan': 'MXP',
          'Venice': 'VCE',
        };

        const destinationAirport = cityToAirport[primaryCity] || 'LHR'; // Default to London if unknown

        try {
          const flightData = await amadeus.searchFlights(env, {
            from: origin,
            to: destinationAirport,
            month: travelMonth,
            adults,
            route_type: 'round_trip'
          });

          const offer = flightData.offers?.[0];
          return {
            ...variant,
            flights: {
              price_low: offer?.price_low || 0,
              price_high: offer?.price_high || 0,
              carrier: offer?.carrier || 'Unknown',
              route: `${origin}-${destinationAirport}`,
              disclaimer: 'Estimated pricing - final quote by travel professional'
            },
            total_estimate: Math.round((offer?.price_low || 0) * adults + (variant.estimated_budget || 2000))
          };
        } catch (error) {
          console.error(`Failed to fetch flights for ${primaryCity}:`, error);
          return {
            ...variant,
            flights: {
              price_low: 0,
              price_high: 0,
              carrier: 'Unknown',
              route: `${origin}-${destinationAirport}`,
              disclaimer: 'Flight pricing unavailable - travel pro will provide quote'
            },
            total_estimate: variant.estimated_budget || 3000
          };
        }
      })
    );

    const enrichedVariantsJson = {
      variantA: enrichedVariants[0],
      variantB: enrichedVariants[1]
    };

    // Update trip with enriched variants
    await updateTrip(env.DB, params.id, {
      variants_json: JSON.stringify(enrichedVariantsJson),
      status: 'ab_ready'
    });

    // Save message
    await saveMessage(
      env.DB,
      params.id,
      'assistant',
      response.content,
      0,
      response.tokensOut,
      response.costUsd
    );

    return new Response(JSON.stringify({
      tripId: params.id,
      variantA: enrichedVariantsJson.variantA,
      variantB: enrichedVariantsJson.variantB,
      status: 'ab_ready'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in PATCH /api/trips/:id/ab:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
