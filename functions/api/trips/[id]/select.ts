// PATCH /api/trips/:id/select - Select an option (A/B/C/D)
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
  SERPER_API_KEY?: string;
  SERPER_API_URL?: string;
}

export async function onRequestPatch(context: { request: Request; env: Env; params: { id: string } }) {
  const { request, env, params } = context;

  try {
    const body = await request.json();
    const { optionKey, selectedHotels } = body; // optionKey: 'A', 'B', 'C', or 'D', selectedHotels: optional array

    // If selectedHotels is provided, update the itinerary with hotel selections (T036)
    if (selectedHotels) {
      const trip = await getTrip(env.DB, params.id);
      if (!trip || !trip.itinerary_json) {
        return new Response(JSON.stringify({ error: 'Trip or itinerary not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const itinerary = JSON.parse(trip.itinerary_json);
      itinerary.selected_hotels = selectedHotels;

      await updateTrip(env.DB, params.id, {
        itinerary_json: JSON.stringify(itinerary)
      });

      return new Response(JSON.stringify({
        tripId: params.id,
        selectedHotels,
        status: 'hotels_selected'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Otherwise, proceed with option selection (T034)
    if (!optionKey || !['A', 'B', 'C', 'D'].includes(optionKey)) {
      return new Response(JSON.stringify({ error: 'Invalid option key (must be A, B, C, or D)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const trip = await getTrip(env.DB, params.id);
    if (!trip || !trip.options_json) {
      return new Response(JSON.stringify({ error: 'Trip or options not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const optionsData = JSON.parse(trip.options_json);
    const options = optionsData.options || optionsData;
    const selectedOption = options.find((opt: any) => opt.key === optionKey);

    if (!selectedOption) {
      return new Response(JSON.stringify({ error: `Option ${optionKey} not found` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Extract cities from the selected option's days
    const intakeData = trip.intake_json ? JSON.parse(trip.intake_json) : {};

    // Convert target_month to next year's date
    const getNextYearDate = (monthName: string | null): string => {
      if (!monthName) {
        // Default to 6 months out if no month specified
        return new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
        return new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      }

      // If target month has passed this year, use next year; otherwise use this year if far enough out
      const targetYear = (targetMonth < currentMonth || (targetMonth === currentMonth && now.getDate() > 15))
        ? currentYear + 1
        : currentYear;

      // Use 15th of the month as default check-in date
      return new Date(targetYear, targetMonth, 15).toISOString().slice(0, 10);
    };

    const checkInDate = intakeData.checkin || getNextYearDate(intakeData.target_month);
    const luxuryLevel = (intakeData.luxury_level || 'comfort').toLowerCase() as 'budget' | 'comfort' | 'premium' | 'luxury';

    // Extract unique cities from option days (with country codes)
    const citiesWithCountry = selectedOption.days?.reduce((acc: any[], day: any) => {
      if (day.city && !acc.find(c => c.city === day.city)) {
        acc.push({ city: day.city, country: day.country });
      }
      return acc;
    }, []) || [];

    // Fetch hotels for each city in parallel (T034)
    const hotelsPerCity = await Promise.all(
      citiesWithCountry.map(async ({ city, country }: any, index: number) => {
        // Calculate check-in date for this city (assuming sequential days)
        const cityCheckinDate = new Date(new Date(checkInDate).getTime() + index * 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        try {
          const hotelData = await amadeus.searchHotels(env, {
            city,
            country, // Pass country code to disambiguate (e.g., York, GB vs New York, US)
            checkin: cityCheckinDate,
            nights: 3, // Default 3 nights per city
            luxury: luxuryLevel,
            adults: intakeData.party?.adults || 2
          });

          return {
            city,
            hotels: hotelData.hotels || []
          };
        } catch (error) {
          console.error(`Failed to fetch hotels for ${city}:`, error);
          return {
            city,
            hotels: [],
            error: 'Hotels unavailable - travel pro will provide options'
          };
        }
      })
    );

    // Create itinerary draft with hotel options
    const itineraryDraft = {
      title: selectedOption.title,
      overview: selectedOption.whyOverall,
      days: selectedOption.days,
      hotels: hotelsPerCity, // Add hotel options per city
      budget: {
        lodging: luxuryLevel,
        notes: 'Estimated based on intake preferences'
      },
      assumptions: selectedOption.assumptions || []
    };

    await updateTrip(env.DB, params.id, {
      itinerary_json: JSON.stringify(itineraryDraft),
      status: 'option_selected'
    });

    return new Response(JSON.stringify({
      tripId: params.id,
      selectedOption: optionKey,
      itinerary: itineraryDraft,
      status: 'option_selected'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in PATCH /api/trips/:id/select:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
