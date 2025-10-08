// Template CRUD Service
// Service layer for template operations with validation

import { TripTemplate, getTemplate, listTemplates, deactivateTemplate as dbDeactivateTemplate } from '../trip-templates';
import { TemplateValidator } from '../validators/template-validator';

export class TemplateService {
  /**
   * List all templates with pagination
   */
  static async listTemplates(
    db: D1Database,
    options?: {
      isActive?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ templates: TripTemplate[]; total: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const templates = await listTemplates(db, options?.isActive === false);

    // Apply pagination
    const paginated = templates.slice(offset, offset + limit);

    return {
      templates: paginated,
      total: templates.length
    };
  }

  /**
   * Get single template by ID
   */
  static async getTemplate(db: D1Database, id: string): Promise<TripTemplate | null> {
    return await getTemplate(id, db, true);
  }

  /**
   * Create new template with validation
   */
  static async createTemplate(db: D1Database, data: Partial<TripTemplate>): Promise<TripTemplate> {
    // Validate before creating
    const validation = TemplateValidator.validate(data);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
    }

    // Generate ID if not provided
    if (!data.id) {
      data.id = this.generateTemplateId(data.name || 'template');
    }

    // Set defaults
    const template: Partial<TripTemplate> = {
      ...data,
      icon: data.icon || '✈️',
      numberOfOptions: data.numberOfOptions || 4,
      tripDaysMin: data.tripDaysMin || 3,
      tripDaysMax: data.tripDaysMax || 14,
      estimateMarginPercent: data.estimateMarginPercent || 17,
      luxuryLevels: data.luxuryLevels || ['budget', 'comfort', 'premium', 'luxury'],
      activityLevels: data.activityLevels || ['relaxed', 'moderate', 'active', 'intense'],
      transportPreferences: data.transportPreferences || ['flights', 'trains', 'car', 'mixed']
    };

    // Insert into database
    await db.prepare(`
      INSERT INTO trip_templates (
        id, name, description, icon, intake_prompt, options_prompt,
        research_synthesis_prompt, research_query_template,
        required_fields, optional_fields, example_inputs,
        search_placeholder, search_help_text, progress_messages,
        workflow_prompt, daily_activity_prompt, why_we_suggest_prompt,
        number_of_options, trip_days_min, trip_days_max,
        luxury_levels, activity_levels, transport_preferences,
        tour_search_instructions, hotel_search_instructions, flight_search_instructions,
        estimate_margin_percent, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      template.id,
      template.name,
      template.description,
      template.icon,
      template.intakePrompt || '',
      template.optionsPrompt || '',
      template.researchSynthesisPrompt || null,
      template.researchQueryTemplate || null,
      JSON.stringify(template.requiredFields || []),
      JSON.stringify(template.optionalFields || []),
      JSON.stringify(template.exampleInputs || []),
      template.searchPlaceholder || null,
      template.searchHelpText || null,
      template.progressMessages ? JSON.stringify(template.progressMessages) : null,
      template.workflowPrompt || null,
      template.dailyActivityPrompt || null,
      template.whyWeSuggestPrompt || null,
      template.numberOfOptions,
      template.tripDaysMin,
      template.tripDaysMax,
      JSON.stringify(template.luxuryLevels),
      JSON.stringify(template.activityLevels),
      JSON.stringify(template.transportPreferences),
      template.tourSearchInstructions || null,
      template.hotelSearchInstructions || null,
      template.flightSearchInstructions || null,
      template.estimateMarginPercent
    ).run();

    const created = await getTemplate(template.id as string, db, true);
    if (!created) {
      throw new Error('Failed to create template');
    }

    return created;
  }

  /**
   * Update existing template with validation
   */
  static async updateTemplate(db: D1Database, id: string, data: Partial<TripTemplate>): Promise<TripTemplate> {
    // Get existing template
    const existing = await getTemplate(id, db, true);
    if (!existing) {
      throw new Error(`Template not found: ${id}`);
    }

    // Merge with updates
    const updated = { ...existing, ...data };

    // Validate
    const validation = TemplateValidator.validate(updated);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
    }

    // Build UPDATE query with only provided fields
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description);
    }
    if (data.icon !== undefined) {
      fields.push('icon = ?');
      values.push(data.icon);
    }
    if (data.intakePrompt !== undefined) {
      fields.push('intake_prompt = ?');
      values.push(data.intakePrompt);
    }
    if (data.optionsPrompt !== undefined) {
      fields.push('options_prompt = ?');
      values.push(data.optionsPrompt);
    }
    if (data.workflowPrompt !== undefined) {
      fields.push('workflow_prompt = ?');
      values.push(data.workflowPrompt);
    }
    if (data.dailyActivityPrompt !== undefined) {
      fields.push('daily_activity_prompt = ?');
      values.push(data.dailyActivityPrompt);
    }
    if (data.whyWeSuggestPrompt !== undefined) {
      fields.push('why_we_suggest_prompt = ?');
      values.push(data.whyWeSuggestPrompt);
    }
    if (data.searchPlaceholder !== undefined) {
      fields.push('search_placeholder = ?');
      values.push(data.searchPlaceholder);
    }
    if (data.searchHelpText !== undefined) {
      fields.push('search_help_text = ?');
      values.push(data.searchHelpText);
    }
    if (data.progressMessages !== undefined) {
      fields.push('progress_messages = ?');
      values.push(JSON.stringify(data.progressMessages));
    }
    if (data.numberOfOptions !== undefined) {
      fields.push('number_of_options = ?');
      values.push(data.numberOfOptions);
    }
    if (data.tripDaysMin !== undefined) {
      fields.push('trip_days_min = ?');
      values.push(data.tripDaysMin);
    }
    if (data.tripDaysMax !== undefined) {
      fields.push('trip_days_max = ?');
      values.push(data.tripDaysMax);
    }
    if (data.luxuryLevels !== undefined) {
      fields.push('luxury_levels = ?');
      values.push(JSON.stringify(data.luxuryLevels));
    }
    if (data.activityLevels !== undefined) {
      fields.push('activity_levels = ?');
      values.push(JSON.stringify(data.activityLevels));
    }
    if (data.transportPreferences !== undefined) {
      fields.push('transport_preferences = ?');
      values.push(JSON.stringify(data.transportPreferences));
    }
    if (data.tourSearchInstructions !== undefined) {
      fields.push('tour_search_instructions = ?');
      values.push(data.tourSearchInstructions);
    }
    if (data.hotelSearchInstructions !== undefined) {
      fields.push('hotel_search_instructions = ?');
      values.push(data.hotelSearchInstructions);
    }
    if (data.flightSearchInstructions !== undefined) {
      fields.push('flight_search_instructions = ?');
      values.push(data.flightSearchInstructions);
    }
    if (data.estimateMarginPercent !== undefined) {
      fields.push('estimate_margin_percent = ?');
      values.push(data.estimateMarginPercent);
    }

    if (fields.length === 0) {
      return existing; // No changes
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await db.prepare(`
      UPDATE trip_templates SET ${fields.join(', ')} WHERE id = ?
    `).bind(...values).run();

    const result = await getTemplate(id, db, true);
    if (!result) {
      throw new Error('Failed to update template');
    }

    return result;
  }

  /**
   * Deactivate template (soft delete)
   */
  static async deactivateTemplate(db: D1Database, id: string): Promise<void> {
    const existing = await getTemplate(id, db, true);
    if (!existing) {
      throw new Error(`Template not found: ${id}`);
    }

    await dbDeactivateTemplate(db, id);
  }

  /**
   * Duplicate template with "(Copy)" suffix
   */
  static async duplicateTemplate(db: D1Database, id: string): Promise<TripTemplate> {
    const original = await getTemplate(id, db, true);
    if (!original) {
      throw new Error(`Template not found: ${id}`);
    }

    // Create copy with new ID and modified name
    const copy: Partial<TripTemplate> = {
      ...original,
      id: this.generateTemplateId(original.name + ' Copy'),
      name: original.name + ' (Copy)'
    };

    return await this.createTemplate(db, copy);
  }

  /**
   * Validate template without saving
   */
  static validateTemplate(data: Partial<TripTemplate>): {
    valid: boolean;
    errors: Array<{ field: string; message: string }>;
    warnings: Array<{ field: string; message: string }>;
  } {
    return TemplateValidator.validate(data);
  }

  /**
   * Generate template ID from name
   */
  private static generateTemplateId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }
}
