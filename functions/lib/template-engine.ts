/**
 * Template Engine
 * VoyGent V3 - Template-Driven Architecture
 *
 * Interpolates template fields with user-provided values.
 * Supports placeholders like {surname}, {region}, {departure_airport}, etc.
 *
 * Implements Constitution principle I: Template-Driven Architecture.
 */

import { TripTemplate, TripPreferences } from './db';

export interface TemplateContext {
  surname?: string;
  region?: string;
  departure_airport?: string;
  luxury_level?: string;
  activity_level?: string;
  number_of_options?: number;
  duration?: string;
  [key: string]: any;  // Allow additional context values
}

/**
 * Template Engine Class
 */
export class TemplateEngine {
  /**
   * Interpolate template string with context values
   *
   * @param template - Template string with {placeholder} syntax
   * @param context - Key-value pairs to replace placeholders
   * @returns Interpolated string
   *
   * @example
   * interpolate("Sullivan family from {region}", { region: "Cork" })
   * // => "Sullivan family from Cork"
   */
  interpolate(template: string | null | undefined, context: TemplateContext): string {
    if (!template) return '';

    let result = template;

    // Replace all {key} placeholders with context values
    Object.keys(context).forEach((key) => {
      const value = context[key];
      if (value !== undefined && value !== null) {
        const placeholder = `{${key}}`;
        result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value));
      }
    });

    return result;
  }

  /**
   * Extract context from user message and preferences
   *
   * @param userMessage - Initial user message (e.g., "Sullivan family from Cork, Ireland")
   * @param preferences - Trip preferences from preferences panel
   * @returns Context object for template interpolation
   */
  extractContext(userMessage: string, preferences?: TripPreferences): TemplateContext {
    const context: TemplateContext = {};

    // Extract surname (basic heuristic: first capitalized word)
    const surnameMatch = userMessage.match(/\b([A-Z][a-z]+)\b/);
    if (surnameMatch) {
      context.surname = surnameMatch[1];
    }

    // Extract region (look for "from [Region]" pattern)
    const regionMatch = userMessage.match(/from\s+([A-Z][a-zA-Z\s,]+)/i);
    if (regionMatch) {
      context.region = regionMatch[1].trim();
    }

    // Add preferences to context
    if (preferences) {
      if (preferences.departure_airport) {
        context.departure_airport = preferences.departure_airport;
      }
      if (preferences.luxury_level) {
        context.luxury_level = preferences.luxury_level;
      }
      if (preferences.activity_level) {
        context.activity_level = preferences.activity_level;
      }
      if (preferences.duration) {
        context.duration = preferences.duration;
      }
      if (preferences.travelers_adults !== undefined) {
        context.travelers_adults = preferences.travelers_adults;
      }
      if (preferences.travelers_children !== undefined) {
        context.travelers_children = preferences.travelers_children;
      }
      if (preferences.departure_date) {
        context.departure_date = preferences.departure_date;
      }
    }

    return context;
  }

  /**
   * Build research queries from template
   *
   * @param template - Template with research_query_template
   * @param context - Context extracted from user input
   * @returns Array of web search query strings
   */
  buildResearchQueries(template: TripTemplate, context: TemplateContext): string[] {
    if (!template.research_query_template) {
      return [];
    }

    // Template format: "query1, query2, query3"
    const queryTemplates = template.research_query_template.split(',').map((q) => q.trim());

    // Interpolate each query template
    return queryTemplates.map((queryTemplate) => this.interpolate(queryTemplate, context));
  }

  /**
   * Build destination criteria prompt
   *
   * @param template - Template with destination_criteria_prompt
   * @param context - Context extracted from user input
   * @returns Interpolated criteria prompt
   */
  buildDestinationCriteria(template: TripTemplate, context: TemplateContext): string {
    return this.interpolate(template.destination_criteria_prompt, context);
  }

  /**
   * Build research synthesis prompt
   *
   * @param template - Template with research_synthesis_prompt
   * @param context - Context extracted from user input
   * @returns Interpolated synthesis prompt
   */
  buildResearchSynthesis(template: TripTemplate, context: TemplateContext): string {
    return this.interpolate(template.research_synthesis_prompt, context);
  }

  /**
   * Build destination confirmation prompt
   *
   * @param template - Template with destination_confirmation_prompt
   * @param context - Context extracted from user input
   * @returns Interpolated confirmation prompt
   */
  buildDestinationConfirmation(template: TripTemplate, context: TemplateContext): string {
    return this.interpolate(template.destination_confirmation_prompt, context);
  }

  /**
   * Build trip options prompt (Phase 2)
   *
   * @param template - Template with options_prompt
   * @param context - Context including number_of_options, departure_airport, luxury_level
   * @returns Interpolated options prompt
   */
  buildOptionsPrompt(template: TripTemplate, context: TemplateContext): string {
    // Add number_of_options from template if not in context
    const fullContext: TemplateContext = {
      ...context,
      number_of_options: context.number_of_options ?? template.number_of_options,
    };

    return this.interpolate(template.options_prompt, fullContext);
  }

  /**
   * Build daily activity prompt (Phase 2)
   *
   * @param template - Template with daily_activity_prompt
   * @param context - Context for interpolation
   * @returns Interpolated activity prompt
   */
  buildDailyActivityPrompt(template: TripTemplate, context: TemplateContext): string {
    return this.interpolate(template.daily_activity_prompt, context);
  }

  /**
   * Parse template constraints (JSON fields)
   *
   * @param template - Template with JSON constraint fields
   * @returns Parsed constraints
   */
  parseConstraints(template: TripTemplate): {
    luxuryLevels: string[];
    activityLevels: string[];
    requiredFields: string[];
    optionalFields: string[];
    exampleInputs: string[];
  } {
    return {
      luxuryLevels: template.luxury_levels ? JSON.parse(template.luxury_levels) : [],
      activityLevels: template.activity_levels ? JSON.parse(template.activity_levels) : [],
      requiredFields: template.required_fields ? JSON.parse(template.required_fields) : [],
      optionalFields: template.optional_fields ? JSON.parse(template.optional_fields) : [],
      exampleInputs: template.example_inputs ? JSON.parse(template.example_inputs) : [],
    };
  }
}

/**
 * Create template engine instance
 */
export function createTemplateEngine(): TemplateEngine {
  return new TemplateEngine();
}
