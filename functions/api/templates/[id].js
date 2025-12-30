/**
 * GET /api/templates/:id
 * Returns complete template configuration including all prompts and constraints
 */
import { createDatabaseClient } from '../../lib/db';
import { createLogger } from '../../lib/logger';
import { createTemplateEngine } from '../../lib/template-engine';
export async function onRequestGet(context) {
    const logger = createLogger();
    const db = createDatabaseClient(context.env);
    const templateEngine = createTemplateEngine();
    const templateId = context.params.id;
    try {
        logger.info(`Fetching template: ${templateId}`);
        const template = await db.getTemplate(templateId);
        if (!template) {
            return new Response(JSON.stringify({ error: 'Template not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        // Parse constraint JSON fields
        const constraints = templateEngine.parseConstraints(template);
        // Return complete template with parsed constraints
        const response = {
            id: template.id,
            name: template.name,
            description: template.description,
            icon: template.icon,
            search_placeholder: template.search_placeholder,
            search_help_text: template.search_help_text,
            number_of_options: template.number_of_options,
            trip_days_min: template.trip_days_min,
            trip_days_max: template.trip_days_max,
            luxury_levels: constraints.luxuryLevels,
            activity_levels: constraints.activityLevels,
            required_fields: constraints.requiredFields,
            optional_fields: constraints.optionalFields,
            example_inputs: constraints.exampleInputs,
        };
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }
    catch (error) {
        logger.error(`Failed to fetch template ${templateId}: ${error}`);
        return new Response(JSON.stringify({ error: 'Failed to fetch template' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
