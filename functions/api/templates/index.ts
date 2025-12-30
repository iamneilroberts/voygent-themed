/**
 * GET /api/templates
 * Returns list of featured trip templates for homepage display
 */

import { Env, createDatabaseClient } from '../../lib/db';
import { createLogger } from '../../lib/logger';

export async function onRequestGet(context: { env: Env }): Promise<Response> {
  const logger = createLogger();
  const db = createDatabaseClient(context.env);

  try {
    logger.info('Fetching featured templates');

    const templates = await db.getFeaturedTemplates();

    // Return template info for homepage cards and intake form
    const templateCards = templates.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      icon: template.icon,
      search_placeholder: template.search_placeholder,
      search_help_text: template.search_help_text,
      required_fields: template.required_fields,
      optional_fields: template.optional_fields,
    }));

    return new Response(JSON.stringify({ templates: templateCards }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    logger.error(`Failed to fetch templates: ${error}`);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch templates' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
