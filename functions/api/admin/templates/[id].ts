// Admin Template Single Operations
// GET /api/admin/templates/[id] - Get single template
// PUT /api/admin/templates/[id] - Update template
// DELETE /api/admin/templates/[id] - Deactivate template

import { TemplateService } from '../../lib/services/template-service';

export async function onRequestGet(context: { request: Request; env: any; params: { id: string } }): Promise<Response> {
  const { env, params } = context;

  try {
    const template = await TemplateService.getTemplate(env.DB, params.id);

    if (!template) {
      return new Response(JSON.stringify({ error: 'Template not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(template), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPut(context: { request: Request; env: any; params: { id: string } }): Promise<Response> {
  const { request, env, params } = context;

  try {
    const data = await request.json();
    const template = await TemplateService.updateTemplate(env.DB, params.id, data);

    return new Response(JSON.stringify(template), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    const status = error.message.includes('not found') ? 404
      : error.message.includes('Validation failed') ? 400
      : 500;

    return new Response(JSON.stringify({
      error: error.message,
      fieldErrors: error.message.includes('Validation failed')
        ? error.message.split(': ')[1]?.split(', ').map((e: string) => {
            const [field, message] = e.split(': ');
            return { field, message };
          })
        : []
    }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestDelete(context: { request: Request; env: any; params: { id: string } }): Promise<Response> {
  const { env, params } = context;

  try {
    await TemplateService.deactivateTemplate(env.DB, params.id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Template deactivated successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    const status = error.message.includes('not found') ? 404 : 500;
    return new Response(JSON.stringify({ error: error.message }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
