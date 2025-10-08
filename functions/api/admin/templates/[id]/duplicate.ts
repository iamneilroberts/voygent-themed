// Template Duplication Endpoint
// POST /api/admin/templates/[id]/duplicate

import { TemplateService } from '../../../lib/services/template-service';

export async function onRequestPost(context: { request: Request; env: any; params: { id: string } }): Promise<Response> {
  const { env, params } = context;

  try {
    const template = await TemplateService.duplicateTemplate(env.DB, params.id);

    return new Response(JSON.stringify(template), {
      status: 201,
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
