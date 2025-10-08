/**
 * POST /api/trips/[id]/estimates/flights - Get flight price estimates
 *
 * Phase 7, Task T035
 *
 * Returns Amadeus flight options with template-configured margin applied.
 * Tracks all options shown to user for handoff document.
 */

import { PricingService } from '../../../lib/services/pricing-service';
import { logEvent } from '../../../lib/logger';

interface FlightEstimateRequest {
  from: string;
  to: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  children?: number;
  cabinClass?: string;
}

interface FlightOption {
  id: string;
  from: string;
  to: string;
  departureTime: string;
  arrivalTime: string;
  carrier: string;
  flightNumber: string;
  cabinClass: string;
  duration: number;
  stops: number;
  basePrice: number;
  estimatedPrice: number;
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
    const body: FlightEstimateRequest = await request.json();

    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'provider',
      message: 'Flight estimate requested',
      metadata: {
        tripId,
        route: `${body.from}-${body.to}`,
        departure: body.departureDate
      }
    });

    // Validate required fields
    if (!body.from || !body.to || !body.departureDate || !body.adults) {
      return new Response(JSON.stringify({
        error: 'Missing required fields',
        required: ['from', 'to', 'departureDate', 'adults']
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
        tp.flight_search_instructions
      FROM themed_trips t
      JOIN trip_templates tp ON t.template_id = tp.id
      WHERE t.id = ?
    `).bind(tripId).first<{
      id: string;
      template_id: string;
      estimate_margin_percent: number;
      flight_search_instructions: string | null;
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

    // TODO: Integrate with Amadeus Flight Offers API
    // For now, return placeholder data
    await logEvent(env.DB, {
      correlationId,
      level: 'warn',
      category: 'amadeus',
      message: 'Amadeus integration pending - returning placeholder',
      metadata: { tripId }
    });

    // Placeholder flight options
    const baseOptions: Omit<FlightOption, 'basePrice' | 'estimatedPrice' | 'marginApplied'>[] = [
      {
        id: `flight_${Date.now()}_1`,
        from: body.from,
        to: body.to,
        departureTime: `${body.departureDate}T10:00:00Z`,
        arrivalTime: `${body.departureDate}T18:30:00Z`,
        carrier: 'American Airlines',
        flightNumber: 'AA123',
        cabinClass: body.cabinClass || 'economy',
        duration: 510,
        stops: 0
      },
      {
        id: `flight_${Date.now()}_2`,
        from: body.from,
        to: body.to,
        departureTime: `${body.departureDate}T14:00:00Z`,
        arrivalTime: `${body.departureDate}T22:45:00Z`,
        carrier: 'Delta',
        flightNumber: 'DL456',
        cabinClass: body.cabinClass || 'economy',
        duration: 525,
        stops: 0
      },
      {
        id: `flight_${Date.now()}_3`,
        from: body.from,
        to: body.to,
        departureTime: `${body.departureDate}T08:00:00Z`,
        arrivalTime: `${body.departureDate}T20:30:00Z`,
        carrier: 'United',
        flightNumber: 'UA789',
        cabinClass: body.cabinClass || 'economy',
        duration: 750,
        stops: 1
      }
    ];

    // Apply pricing with margin
    const options: FlightOption[] = baseOptions.map((opt, index) => {
      const basePrice = 450 + (index * 50) + (body.adults * 100);
      const pricing = PricingService.addMargin(basePrice, marginPercent);

      return {
        ...opt,
        basePrice: pricing.base,
        estimatedPrice: pricing.estimated,
        marginApplied: pricing.marginApplied
      };
    });

    // Track options shown (for handoff document)
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
      'flight',
      options[0].id,
      JSON.stringify({ request: body, options }),
      new Date().toISOString()
    ).run().catch((err: any) => {
      // Table may not exist yet - non-blocking
      console.warn('Failed to track flight options:', err.message);
    });

    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'amadeus',
      message: 'Flight estimates returned',
      metadata: {
        tripId,
        optionCount: options.length,
        marginPercent
      }
    });

    return new Response(JSON.stringify({
      tripId,
      options,
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
      message: 'Flight estimate failed',
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
