// Admin Template CRUD Endpoints
// GET /api/admin/templates - List templates
// POST /api/admin/templates - Create template

import { TemplateService } from '../../lib/services/template-service';

export async function onRequestGet(context: { request: Request; env: any }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  const isActive = url.searchParams.get('is_active');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  try {
    const result = await TemplateService.listTemplates(env.DB, {
      isActive: isActive === 'false' ? false : isActive === 'true' ? true : undefined,
      limit: Math.min(limit, 100),
      offset
    });

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context: { request: Request; env: any }): Promise<Response> {
  const { request, env } = context;

  try {
    const data = await request.json();
    const template = await TemplateService.createTemplate(env.DB, data);

    return new Response(JSON.stringify(template), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    const status = error.message.includes('Validation failed') ? 400 : 500;
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
