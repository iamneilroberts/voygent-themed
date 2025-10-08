/**
 * POST /api/trips/[id]/estimates/tours - Get tour/activity price estimates
 *
 * Phase 7, Task T038
 *
 * Returns TripAdvisor tour options with template-configured margin.
 */

import { PricingService } from '../../../lib/services/pricing-service';
import { TourService } from '../../../lib/services/tour-service';
import { logEvent } from '../../../lib/logger';

interface TourEstimateRequest {
  location: string;
  query?: string;
  category?: string;
}

interface TourOption {
  id: string;
  name: string;
  description: string;
  location: string;
  provider: string;
  duration: number;
  category: string;
  rating: number;
  reviewCount: number;
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
    const body: TourEstimateRequest = await request.json();

    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'provider',
      message: 'Tour estimate requested',
      metadata: {
        tripId,
        location: body.location,
        query: body.query
      }
    });

    // Validate required fields
    if (!body.location) {
      return new Response(JSON.stringify({
        error: 'Missing required fields',
        required: ['location']
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
        tp.tour_search_instructions
      FROM themed_trips t
      JOIN trip_templates tp ON t.template_id = tp.id
      WHERE t.id = ?
    `).bind(tripId).first<{
      id: string;
      template_id: string;
      estimate_margin_percent: number;
      tour_search_instructions: string | null;
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

    // TODO: Integrate with TripAdvisor API via TourService
    await logEvent(env.DB, {
      correlationId,
      level: 'warn',
      category: 'tripadvisor',
      message: 'TripAdvisor API integration pending - returning placeholder',
      metadata: { tripId }
    });

    // Placeholder tour options
    const baseTours = [
      {
        id: `tour_${Date.now()}_1`,
        name: 'Heritage Walking Tour',
        description: 'Explore historic sites and ancestral landmarks with an expert guide',
        location: body.location,
        provider: 'Local Heritage Tours',
        duration: 180,
        category: 'Cultural',
        rating: 4.7,
        reviewCount: 245,
        basePricePerPerson: 45
      },
      {
        id: `tour_${Date.now()}_2`,
        name: 'Castle & Clan History Tour',
        description: 'Full-day tour visiting castles and learning about clan history',
        location: body.location,
        provider: 'Scottish Heritage Co',
        duration: 480,
        category: 'Historical',
        rating: 4.9,
        reviewCount: 412,
        basePricePerPerson: 120
      },
      {
        id: `tour_${Date.now()}_3`,
        name: 'Genealogy Research Workshop',
        description: 'Interactive workshop on tracing your family roots',
        location: body.location,
        provider: 'Ancestry Guides',
        duration: 120,
        category: 'Educational',
        rating: 4.5,
        reviewCount: 98,
        basePricePerPerson: 65
      }
    ];

    // Apply pricing with margin
    const options: TourOption[] = baseTours.map(tour => {
      const pricing = PricingService.addMargin(tour.basePricePerPerson, marginPercent);

      return {
        id: tour.id,
        name: tour.name,
        description: tour.description,
        location: tour.location,
        provider: tour.provider,
        duration: tour.duration,
        category: tour.category,
        rating: tour.rating,
        reviewCount: tour.reviewCount,
        basePrice: pricing.base,
        estimatedPrice: pricing.estimated,
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
      'tour',
      options[0].id,
      JSON.stringify({ request: body, options }),
      new Date().toISOString()
    ).run().catch((err: any) => {
      console.warn('Failed to track tour options:', err.message);
    });

    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'tripadvisor',
      message: 'Tour estimates returned',
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
      message: 'Tour estimate failed',
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
