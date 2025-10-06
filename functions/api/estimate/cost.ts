/**
 * Cost Estimation Endpoint
 * POST /api/estimate/cost
 * Feature: 001-web-search-integration
 *
 * Calculates per-person trip cost with 10-15% commission headroom.
 * Stores result in heritage_trips.variants_json.cost_estimate.
 */

import { calculateCostEstimate, type CostEstimateInput } from '../lib/cost-estimator';

interface Env {
  DB: any;
}

export async function onRequest(context: { request: Request; env: Env }) {
  const { request, env } = context;

  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Parse request body
    const input: CostEstimateInput = await request.json();

    // Validate required fields
    if (!input.trip_id) {
      return new Response(
        JSON.stringify({
          error: 'Missing required field',
          details: 'trip_id is required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!input.airfare || !input.hotels) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          details: 'airfare and hotels are required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate commission percentage if provided
    if (input.commission_pct !== undefined && (input.commission_pct < 10 || input.commission_pct > 15)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid commission_pct',
          details: 'commission_pct must be between 10 and 15',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Calculate cost estimate
    const costEstimate = calculateCostEstimate(input);

    // Store in heritage_trips.variants_json.cost_estimate
    const trip = await env.DB
      .prepare('SELECT variants_json FROM heritage_trips WHERE id = ?')
      .bind(input.trip_id)
      .first();

    if (!trip) {
      return new Response(
        JSON.stringify({
          error: 'Trip not found',
          details: `No trip found with id ${input.trip_id}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse existing variants_json
    const variantsJson = trip.variants_json ? JSON.parse(trip.variants_json as string) : {};

    // Add cost_estimate
    variantsJson.cost_estimate = costEstimate;

    // Update trip record
    await env.DB
      .prepare('UPDATE heritage_trips SET variants_json = ?, updated_at = unixepoch() WHERE id = ?')
      .bind(JSON.stringify(variantsJson), input.trip_id)
      .run();

    return new Response(JSON.stringify(costEstimate), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Cost estimation error:', error);

    return new Response(
      JSON.stringify({
        error: 'Cost calculation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
