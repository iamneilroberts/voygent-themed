/**
 * POST /api/trips/[id]/options - Generate trip options
 *
 * Phase 6, Task T033
 *
 * This endpoint enforces the research-first gate:
 * - If trip has research, user must view it before generating options
 * - Uses template's workflow_prompt or options_prompt to generate options
 */

import { ResearchService } from '../../lib/services/research-service';
import { OptionsService } from '../../lib/services/options-service';
import { logEvent } from '../../lib/logger';

interface GenerateOptionsRequest {
  preferences?: {
    luxuryLevel?: string;
    activityLevel?: string;
    transport?: string;
    days?: number;
    budget?: number;
  };
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
    const body: GenerateOptionsRequest = await request.json().catch(() => ({}));

    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'request',
      message: 'Options generation requested',
      metadata: { tripId, preferences: body.preferences }
    });

    // 1. Check research gate
    const canGenerate = await ResearchService.canGenerateOptions(env.DB, tripId);

    if (!canGenerate) {
      await logEvent(env.DB, {
        correlationId,
        level: 'warn',
        category: 'research',
        message: 'Research gate blocked options generation',
        metadata: { tripId }
      });

      return new Response(JSON.stringify({
        error: 'Research must be viewed before generating options',
        tripId,
        requiresAction: 'view_research'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Get trip and template data
    const trip = await env.DB.prepare(`
      SELECT
        t.id,
        t.template_id,
        t.intake_json,
        t.research_summary,
        t.status,
        tp.workflow_prompt,
        tp.options_prompt,
        tp.number_of_options,
        tp.luxury_levels,
        tp.activity_levels,
        tp.transport_preferences,
        tp.trip_days_min,
        tp.trip_days_max
      FROM themed_trips t
      JOIN trip_templates tp ON t.template_id = tp.id
      WHERE t.id = ?
    `).bind(tripId).first<{
      id: string;
      template_id: string;
      intake_json: string;
      research_summary: string | null;
      status: string;
      workflow_prompt: string | null;
      options_prompt: string | null;
      number_of_options: number;
      luxury_levels: string;
      activity_levels: string;
      transport_preferences: string;
      trip_days_min: number;
      trip_days_max: number;
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

    // Parse intake data
    const intakeData = JSON.parse(trip.intake_json);

    // 3. Generate options using OptionsService
    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'options',
      message: 'Starting options generation',
      metadata: { tripId, numberOfOptions: trip.number_of_options }
    });

    const result = await OptionsService.generateOptions(
      env.DB,
      tripId,
      {
        id: trip.template_id,
        workflowPrompt: trip.workflow_prompt || undefined,
        optionsPrompt: trip.options_prompt || undefined,
        numberOfOptions: trip.number_of_options,
        luxuryLevels: trip.luxury_levels ? JSON.parse(trip.luxury_levels) : undefined,
        activityLevels: trip.activity_levels ? JSON.parse(trip.activity_levels) : undefined,
        transportPreferences: trip.transport_preferences ? JSON.parse(trip.transport_preferences) : undefined,
        tripDaysMin: trip.trip_days_min,
        tripDaysMax: trip.trip_days_max
      },
      intakeData,
      trip.research_summary || undefined,
      body.preferences,
      {
        OPENAI_API_KEY: env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
        ZAI_API_KEY: env.ZAI_API_KEY
      }
    );

    if (!result.success) {
      await logEvent(env.DB, {
        correlationId,
        level: 'error',
        category: 'options',
        message: 'Options generation failed',
        metadata: { tripId, error: result.error }
      });

      return new Response(JSON.stringify({
        error: 'Failed to generate options',
        details: result.error
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await logEvent(env.DB, {
      correlationId,
      level: 'info',
      category: 'options',
      message: 'Options generated successfully',
      metadata: {
        tripId,
        optionCount: result.options?.length || 0
      }
    });

    return new Response(JSON.stringify({
      tripId,
      options: result.options,
      status: 'options_ready',
      message: 'Trip options generated successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    await logEvent(env.DB, {
      correlationId,
      level: 'error',
      category: 'request',
      message: 'Options generation failed',
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
