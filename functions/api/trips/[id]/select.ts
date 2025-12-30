/**
 * POST /api/trips/:id/select
 * Select a trip option from the generated options
 * Generates transportation recommendations based on user preferences
 */

import { Env, createDatabaseClient, TripOption, TripPreferences } from '../../../lib/db';
import { createLogger } from '../../../lib/logger';
import { createPhaseGate } from '../../../lib/phase-gate';
import { createTransportationService } from '../../../services/transportation-service';

interface SelectTripOptionRequest {
  option_index: number;
}

export async function onRequestPost(context: { request: Request; env: Env; params: { id: string } }): Promise<Response> {
  const logger = createLogger();
  const db = createDatabaseClient(context.env);
  const phaseGate = createPhaseGate(db, logger);

  const tripId = context.params.id;

  try {
    // Parse request body
    const body = await context.request.json() as SelectTripOptionRequest;

    if (!body.option_index || body.option_index < 1) {
      return new Response(
        JSON.stringify({ error: 'option_index must be a positive integer (1-based)' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    logger.info(`Selecting option ${body.option_index} for trip ${tripId}`);

    // Check if trip is eligible for option selection
    const eligibilityCheck = await phaseGate.checkOptionSelectionEligibility(tripId);
    if (!eligibilityCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: eligibilityCheck.error!.message,
          code: eligibilityCheck.error!.code,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const trip = eligibilityCheck.trip!;

    // Get trip options
    const options: TripOption[] = trip.options_json ? JSON.parse(trip.options_json) : [];

    // Find selected option
    const selectedOption = options.find(opt => opt.option_index === body.option_index);
    if (!selectedOption) {
      return new Response(
        JSON.stringify({
          error: `Option ${body.option_index} not found. Available options: ${options.map(o => o.option_index).join(', ')}`,
          code: 'INVALID_OPTION_INDEX',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Select the option
    await db.selectTripOption(tripId, body.option_index);

    logger.info(`Option ${body.option_index} selected for trip ${tripId}`);

    // Get preferences and destinations for transportation recommendation
    const preferences: TripPreferences = trip.preferences_json ? JSON.parse(trip.preferences_json) : {};
    const destinations: string[] = trip.confirmed_destinations ? JSON.parse(trip.confirmed_destinations) : [];

    // Generate transportation recommendations
    let transportationRecommendation = null;
    try {
      const transportService = createTransportationService(context.env, db, logger);
      transportationRecommendation = await transportService.generateRecommendation({
        tripId,
        selectedOption,
        destinations,
        preferences,
      });

      // Update option with transportation recommendation
      selectedOption.transportation = transportationRecommendation;

      // Save updated options back to database
      const updatedOptions = options.map(o =>
        o.option_index === body.option_index ? selectedOption : o
      );
      await db.updateTripOptions(tripId, updatedOptions);

      logger.info(`Transportation recommendation generated: ${transportationRecommendation.primary_mode}`);
    } catch (error) {
      logger.warn(`Transportation recommendation failed, continuing without it: ${error}`);
    }

    // Return selected option and detailed itinerary
    const detailedItinerary = generateDetailedItinerary(selectedOption);

    return new Response(
      JSON.stringify({
        selected_option: selectedOption,
        detailed_itinerary: detailedItinerary,
        transportation: transportationRecommendation,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    logger.error(`Failed to select option for trip ${tripId}: ${error}`);
    return new Response(
      JSON.stringify({ error: 'Failed to select trip option' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Generate detailed day-by-day itinerary
 * This is a simplified version - in production, use AI to generate detailed activities
 */
function generateDetailedItinerary(option: TripOption): any[] {
  const itinerary: any[] = [];

  // Calculate total days from hotels
  let totalNights = 0;
  option.hotels.forEach(hotel => {
    totalNights += hotel.nights;
  });
  const totalDays = totalNights + 1;

  // Generate basic day-by-day structure
  let currentDay = 1;
  let currentHotelIndex = 0;
  let nightsInCurrentHotel = 0;

  for (let day = 1; day <= totalDays; day++) {
    const hotel = option.hotels[currentHotelIndex];

    itinerary.push({
      day,
      date: null, // Would be calculated from actual dates
      city: hotel?.city || 'Unknown',
      activities: [
        {
          time: 'Morning',
          description: day === 1 ? 'Arrival and hotel check-in' : 'Explore local area',
          type: 'free time',
          cost_usd: null,
        },
        {
          time: 'Afternoon',
          description: day === totalDays ? 'Departure' : 'Scheduled tour or activity',
          type: 'tour',
          cost_usd: null,
        },
      ],
      hotel: hotel ? {
        name: hotel.name,
        address: hotel.city,
      } : null,
      meals_included: ['Breakfast'],
      estimated_cost_usd: 0,
    });

    nightsInCurrentHotel++;
    if (hotel && nightsInCurrentHotel >= hotel.nights) {
      currentHotelIndex++;
      nightsInCurrentHotel = 0;
    }
  }

  return itinerary;
}

// CORS preflight
export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
