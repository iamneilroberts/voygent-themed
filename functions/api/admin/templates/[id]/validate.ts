// Template Validation Endpoint
// POST /api/admin/templates/[id]/validate

import { TemplateService } from '../../../lib/services/template-service';

export async function onRequestPost(context: { request: Request; env: any; params: { id: string } }): Promise<Response> {
  const { request } = context;

  try {
    const data = await request.json();
    const result = TemplateService.validateTemplate(data);

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
