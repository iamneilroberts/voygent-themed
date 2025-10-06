// /api/templates/[id] - Manage individual templates

import { getTemplate, upsertTemplate, deactivateTemplate, deleteTemplate, type TripTemplate } from '../lib/trip-templates';

interface Env {
  DB: D1Database;
}

export async function onRequestGet(context: { params: { id: string }; env: Env }) {
  const { params, env } = context;
  const themeId = params.id;

  if (!themeId) {
    return new Response(JSON.stringify({
      error: 'Theme ID required'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const template = await getTemplate(themeId, env.DB, true);

    if (!template) {
      return new Response(JSON.stringify({
        error: 'Theme not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(template), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Failed to load template:', error);
    return new Response(JSON.stringify({
      error: 'Failed to load template',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPut(context: { params: { id: string }; request: Request; env: Env }) {
  const { params, request, env } = context;
  const themeId = params.id;

  if (!themeId) {
    return new Response(JSON.stringify({ error: 'Theme ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json() as TripTemplate;
    const data = { ...body, id: themeId };
    const saved = await upsertTemplate(env.DB, data);

    return new Response(JSON.stringify(saved), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Failed to update template:', error);
    const status = error.message?.includes('Missing required') ? 400 : 500;
    return new Response(JSON.stringify({
      error: 'Failed to update template',
      details: error.message
    }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestDelete(context: { params: { id: string }; request: Request; env: Env }) {
  const { params, request, env } = context;
  const themeId = params.id;

  if (!themeId) {
    return new Response(JSON.stringify({ error: 'Theme ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = new URL(request.url);
    const hard = url.searchParams.get('hard') === 'true';

    if (hard) {
      await deleteTemplate(env.DB, themeId);
    } else {
      await deactivateTemplate(env.DB, themeId);
    }

    return new Response(null, { status: 204 });
  } catch (error: any) {
    console.error('Failed to delete template:', error);
    return new Response(JSON.stringify({
      error: 'Failed to delete template',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
