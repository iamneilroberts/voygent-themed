// /api/templates - Manage trip templates

import { listTemplates, upsertTemplate, type TripTemplate } from '../lib/trip-templates';

interface Env {
  DB: D1Database;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get('includeInactive') === 'true';
    const templates = await listTemplates(env.DB, includeInactive);

    return new Response(JSON.stringify({
      templates: templates.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        icon: t.icon,
        exampleInputs: t.exampleInputs
      }))
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Failed to list templates:', error);
    return new Response(JSON.stringify({
      error: 'Failed to list templates',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  try {
    const body = await request.json() as TripTemplate;
    if (!body || !body.id) {
      return new Response(JSON.stringify({ error: 'Template id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const saved = await upsertTemplate(env.DB, body);

    return new Response(JSON.stringify(saved), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Failed to save template:', error);
    const status = error.message?.includes('Missing required') ? 400 : 500;
    return new Response(JSON.stringify({
      error: 'Failed to save template',
      details: error.message
    }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
