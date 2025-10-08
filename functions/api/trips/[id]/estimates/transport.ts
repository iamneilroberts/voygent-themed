/**
 * POST /api/trips/[id]/estimates/transport - Get ground transport estimates
 *
 * Phase 7, Task T037
 *
 * Returns train/car rental estimates with template-configured margin.
 */

import { PricingService } from '../../../lib/services/pricing-service';
import { logEvent } from '../../../lib/logger';

interface TransportEstimateRequest {
  from: string;
  to: string;
  date: string;
  transportType: 'train' | 'car' | 'bus';
  passengers?: number;
  days?: number; // For car rentals
}

interface TransportOption {
  id: string;
  type: string;
  from: string;
  to: string;
  departureTime?: string;
  arrivalTime?: string;
  duration?: number;
  provider: string;
  vehicleType?: string;
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
    const body: TransportEstimateRequest = await request.json();

    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'provider',
      message: 'Transport estimate requested',
      metadata: {
        tripId,
        type: body.transportType,
        route: `${body.from}-${body.to}`
      }
    });

    // Validate required fields
    if (!body.from || !body.to || !body.date || !body.transportType) {
      return new Response(JSON.stringify({
        error: 'Missing required fields',
        required: ['from', 'to', 'date', 'transportType']
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
        tp.estimate_margin_percent
      FROM themed_trips t
      JOIN trip_templates tp ON t.template_id = tp.id
      WHERE t.id = ?
    `).bind(tripId).first<{
      id: string;
      template_id: string;
      estimate_margin_percent: number;
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

    // TODO: Integrate with train/car rental APIs
    await logEvent(env.DB, {
      correlationId,
      level: 'warn',
      category: 'provider',
      message: 'Transport API integration pending - returning placeholder',
      metadata: { tripId }
    });

    let baseOptions: Omit<TransportOption, 'basePrice' | 'estimatedPrice' | 'marginApplied'>[] = [];

    if (body.transportType === 'train') {
      baseOptions = [
        {
          id: `train_${Date.now()}_1`,
          type: 'train',
          from: body.from,
          to: body.to,
          departureTime: `${body.date}T09:00:00Z`,
          arrivalTime: `${body.date}T12:30:00Z`,
          duration: 210,
          provider: 'National Rail'
        },
        {
          id: `train_${Date.now()}_2`,
          type: 'train',
          from: body.from,
          to: body.to,
          departureTime: `${body.date}T14:00:00Z`,
          arrivalTime: `${body.date}T17:45:00Z`,
          duration: 225,
          provider: 'Express Rail'
        }
      ];
    } else if (body.transportType === 'car') {
      const days = body.days || 1;
      baseOptions = [
        {
          id: `car_${Date.now()}_1`,
          type: 'car',
          from: body.from,
          to: body.to,
          provider: 'Enterprise',
          vehicleType: 'Compact'
        },
        {
          id: `car_${Date.now()}_2`,
          type: 'car',
          from: body.from,
          to: body.to,
          provider: 'Hertz',
          vehicleType: 'Standard'
        },
        {
          id: `car_${Date.now()}_3`,
          type: 'car',
          from: body.from,
          to: body.to,
          provider: 'Budget',
          vehicleType: 'Economy'
        }
      ];
    } else if (body.transportType === 'bus') {
      baseOptions = [
        {
          id: `bus_${Date.now()}_1`,
          type: 'bus',
          from: body.from,
          to: body.to,
          departureTime: `${body.date}T10:00:00Z`,
          arrivalTime: `${body.date}T15:00:00Z`,
          duration: 300,
          provider: 'Coach Lines'
        }
      ];
    }

    // Apply pricing with margin
    const options: TransportOption[] = baseOptions.map((opt, index) => {
      let basePrice = 50;

      if (body.transportType === 'train') {
        basePrice = 45 + (index * 10) + ((body.passengers || 1) * 30);
      } else if (body.transportType === 'car') {
        basePrice = (40 + (index * 15)) * (body.days || 1);
      } else if (body.transportType === 'bus') {
        basePrice = 25 + ((body.passengers || 1) * 15);
      }

      const pricing = PricingService.addMargin(basePrice, marginPercent);

      return {
        ...opt,
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
      'transport',
      options[0]?.id || 'none',
      JSON.stringify({ request: body, options }),
      new Date().toISOString()
    ).run().catch((err: any) => {
      console.warn('Failed to track transport options:', err.message);
    });

    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'provider',
      message: 'Transport estimates returned',
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
      message: 'Transport estimate failed',
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
