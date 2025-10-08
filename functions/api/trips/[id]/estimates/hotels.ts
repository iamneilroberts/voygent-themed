/**
 * POST /api/trips/[id]/estimates/hotels - Get hotel price estimates
 *
 * Phase 7, Task T036
 *
 * Returns Amadeus hotel options with template-configured margin applied.
 */

import { PricingService } from '../../../lib/services/pricing-service';
import { logEvent } from '../../../lib/logger';

interface HotelEstimateRequest {
  city: string;
  checkin: string;
  checkout: string;
  adults: number;
  rooms?: number;
  luxuryLevel?: string;
}

interface HotelOption {
  id: string;
  name: string;
  address: string;
  city: string;
  rating: number;
  amenities: string[];
  roomType: string;
  checkin: string;
  checkout: string;
  nights: number;
  basePricePerNight: number;
  estimatedPricePerNight: number;
  totalBasePrice: number;
  totalEstimatedPrice: number;
  marginApplied: number;
}

export async function onRequestPost(context: {
  request: Request;
  env: any;
  params: { id: string };
}): Promise<Response> {
  const { request, env, params } = context;
  const tripId = params.id;
  const correlationId = tripId;

  try {
    const body: HotelEstimateRequest = await request.json();

    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'provider',
      message: 'Hotel estimate requested',
      metadata: {
        tripId,
        city: body.city,
        checkin: body.checkin,
        checkout: body.checkout
      }
    });

    // Validate required fields
    if (!body.city || !body.checkin || !body.checkout || !body.adults) {
      return new Response(JSON.stringify({
        error: 'Missing required fields',
        required: ['city', 'checkin', 'checkout', 'adults']
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calculate nights
    const checkinDate = new Date(body.checkin);
    const checkoutDate = new Date(body.checkout);
    const nights = Math.ceil((checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24));

    if (nights <= 0) {
      return new Response(JSON.stringify({
        error: 'Invalid date range',
        details: 'Checkout must be after checkin'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get trip and template margin
    const trip = await env.DB.prepare(`
      SELECT
        t.id,
        t.template_id,
        tp.estimate_margin_percent,
        tp.hotel_search_instructions
      FROM themed_trips t
      JOIN trip_templates tp ON t.template_id = tp.id
      WHERE t.id = ?
    `).bind(tripId).first<{
      id: string;
      template_id: string;
      estimate_margin_percent: number;
      hotel_search_instructions: string | null;
    }>();

    if (!trip) {
      await logEvent(env.DB, {
        correlationId,
        level: 'warn',
        category: 'request',
        message: 'Trip not found',
        metadata: { tripId }
      });

      return new Response(JSON.stringify({
        error: 'Trip not found',
        tripId
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const marginPercent = trip.estimate_margin_percent || 17;

    // TODO: Integrate with Amadeus Hotel Search API
    await logEvent(env.DB, {
      correlationId,
      level: 'warn',
      category: 'amadeus',
      message: 'Amadeus integration pending - returning placeholder',
      metadata: { tripId }
    });

    // Placeholder hotel options
    const baseHotels = [
      {
        id: `hotel_${Date.now()}_1`,
        name: 'Heritage Inn',
        address: '123 Main St',
        city: body.city,
        rating: 4.5,
        amenities: ['WiFi', 'Breakfast', 'Parking'],
        roomType: 'Standard Double',
        basePricePerNight: 120
      },
      {
        id: `hotel_${Date.now()}_2`,
        name: 'Castle View Hotel',
        address: '456 Historic Lane',
        city: body.city,
        rating: 4.8,
        amenities: ['WiFi', 'Breakfast', 'Spa', 'Bar'],
        roomType: 'Deluxe King',
        basePricePerNight: 180
      },
      {
        id: `hotel_${Date.now()}_3`,
        name: 'Budget Stay',
        address: '789 Economy Rd',
        city: body.city,
        rating: 3.8,
        amenities: ['WiFi', 'Parking'],
        roomType: 'Standard Queen',
        basePricePerNight: 85
      }
    ];

    // Apply pricing with margin
    const options: HotelOption[] = baseHotels.map(hotel => {
      const totalBasePrice = hotel.basePricePerNight * nights;
      const pricing = PricingService.addMargin(totalBasePrice, marginPercent);
      const estimatedPricePerNight = pricing.estimated / nights;

      return {
        ...hotel,
        checkin: body.checkin,
        checkout: body.checkout,
        nights,
        estimatedPricePerNight: Math.round(estimatedPricePerNight * 100) / 100,
        totalBasePrice: pricing.base,
        totalEstimatedPrice: pricing.estimated,
        marginApplied: pricing.marginApplied
      };
    });

    // Track options shown
    await env.DB.prepare(`
      INSERT INTO trip_option_tracking (
        trip_id,
        option_type,
        option_id,
        option_data,
        shown_at
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(
      tripId,
      'hotel',
      options[0].id,
      JSON.stringify({ request: body, options }),
      new Date().toISOString()
    ).run().catch((err: any) => {
      console.warn('Failed to track hotel options:', err.message);
    });

    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'amadeus',
      message: 'Hotel estimates returned',
      metadata: {
        tripId,
        optionCount: options.length,
        marginPercent,
        nights
      }
    });

    return new Response(JSON.stringify({
      tripId,
      options,
      nights,
      marginPercent,
      disclaimer: 'Prices are estimates only. Final quotes provided by travel agent.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    await logEvent(env.DB, {
      correlationId,
      level: 'error',
      category: 'request',
      message: 'Hotel estimate failed',
      metadata: { tripId, error: error.message }
    });

    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
