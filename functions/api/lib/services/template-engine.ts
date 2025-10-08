// Template Variable Replacement Service
// Replaces template variables like {surnames}, {regions}, {input} with actual values
// Includes sanitization to prevent injection per quickstart.md:391-401

export interface TemplateContext {
  surnames?: string[];
  regions?: string[];
  input?: any;  // Full intake object
  search_results?: string;  // Research summary
  preferences?: any;  // User preferences
  [key: string]: any;  // Allow additional context
}

export class TemplateEngine {
  /**
   * Replace all variables in a template string with context values
   */
  static replaceVariables(template: string, context: TemplateContext): string {
    if (!template) return '';

    let result = template;

    // Replace {surnames} - join with " and "
    if (context.surnames && Array.isArray(context.surnames)) {
      const sanitized = context.surnames.map(s => this.sanitizeString(s));
      result = result.replace(/\{surnames\}/g, sanitized.join(' and '));
    }

    // Replace {regions} - join with ", "
    if (context.regions && Array.isArray(context.regions)) {
      const sanitized = context.regions.map(r => this.sanitizeString(r));
      result = result.replace(/\{regions\}/g, sanitized.join(', '));
    }

    // Replace {input} - JSON stringify entire intake
    if (context.input !== undefined) {
      const sanitized = this.sanitizeJson(context.input);
      result = result.replace(/\{input\}/g, JSON.stringify(sanitized, null, 2));
    }

    // Replace {search_results} - research summary
    if (context.search_results !== undefined) {
      const sanitized = this.sanitizeString(context.search_results);
      result = result.replace(/\{search_results\}/g, sanitized);
    }

    // Replace {preferences} - JSON stringify preferences
    if (context.preferences !== undefined) {
      const sanitized = this.sanitizeJson(context.preferences);
      result = result.replace(/\{preferences\}/g, JSON.stringify(sanitized, null, 2));
    }

    // Replace any other {key} patterns with context values
    const varPattern = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
    result = result.replace(varPattern, (match, varName) => {
      if (context[varName] !== undefined) {
        if (typeof context[varName] === 'string') {
          return this.sanitizeString(context[varName]);
        } else if (typeof context[varName] === 'object') {
          return JSON.stringify(this.sanitizeJson(context[varName]), null, 2);
        } else {
          return String(context[varName]);
        }
      }
      // Leave unmatched variables as-is
      return match;
    });

    return result;
  }

  /**
   * Sanitize string to prevent injection attacks
   * Removes potentially dangerous characters and limits length
   */
  static sanitizeString(value: string): string {
    if (typeof value !== 'string') return '';

    // Remove null bytes, control characters, and potential script injections
    let sanitized = value
      .replace(/\0/g, '')  // Null bytes
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')  // Control characters
      .replace(/<script[^>]*>.*?<\/script>/gi, '')  // Script tags
      .replace(/javascript:/gi, '')  // JavaScript protocol
      .replace(/on\w+\s*=/gi, '');  // Event handlers

    // Limit length to prevent DoS
    if (sanitized.length > 10000) {
      sanitized = sanitized.substring(0, 10000) + '...';
    }

    return sanitized.trim();
  }

  /**
   * Sanitize JSON object recursively
   */
  static sanitizeJson(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeJson(item));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Sanitize key (prevent prototype pollution)
        const safeKey = key.replace(/^__proto__|constructor|prototype$/gi, '_');
        sanitized[safeKey] = this.sanitizeJson(value);
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Extract variable names from a template
   */
  static extractVariables(template: string): string[] {
    if (!template) return [];

    const varPattern = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
    const matches = [...template.matchAll(varPattern)];
    const variables = matches.map(match => match[1]);

    // Return unique variables
    return [...new Set(variables)];
  }

  /**
   * Validate that all required variables are present in context
   */
  static validateContext(template: string, context: TemplateContext): {
    valid: boolean;
    missing: string[];
  } {
    const required = this.extractVariables(template);
    const provided = Object.keys(context);

    const missing = required.filter(varName => {
      // Check if variable exists in context
      if (!provided.includes(varName)) {
        // Check for special arrays that might be empty
        if (varName === 'surnames' && context.surnames?.length === 0) return false;
        if (varName === 'regions' && context.regions?.length === 0) return false;
        return true;
      }
      return false;
    });

    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Build context from intake and preferences
   */
  static buildContext(intake: any, preferences?: any, researchSummary?: string): TemplateContext {
    const context: TemplateContext = {
      input: intake
    };

    // Extract common fields
    if (intake.surnames) {
      context.surnames = Array.isArray(intake.surnames) ? intake.surnames : [intake.surnames];
    }

    if (intake.regions || intake.suspected_origins) {
      context.regions = Array.isArray(intake.regions || intake.suspected_origins)
        ? (intake.regions || intake.suspected_origins)
        : [intake.regions || intake.suspected_origins];
    }

    if (intake.destination || intake.destinations) {
      context.destination = intake.destination || (Array.isArray(intake.destinations) ? intake.destinations[0] : intake.destinations);
    }

    if (researchSummary) {
      context.search_results = researchSummary;
    }

    if (preferences) {
      context.preferences = preferences;
      // Also expose individual preference fields
      context.luxury_level = preferences.luxuryLevel || preferences.luxury_level;
      context.activity_level = preferences.activityLevel || preferences.activity_level;
      context.days = preferences.days;
      context.adults = preferences.adults;
    }

    return context;
  }

  /**
   * Replace variables in multiple template fields
   */
  static replaceInTemplate(template: {
    intakePrompt?: string;
    optionsPrompt?: string;
    workflowPrompt?: string;
    dailyActivityPrompt?: string;
    whyWeSuggestPrompt?: string;
    researchSynthesisPrompt?: string;
    tourSearchInstructions?: string;
    hotelSearchInstructions?: string;
    flightSearchInstructions?: string;
  }, context: TemplateContext): typeof template {
    const result: typeof template = {};

    for (const [key, value] of Object.entries(template)) {
      if (typeof value === 'string') {
        result[key as keyof typeof template] = this.replaceVariables(value, context) as any;
      } else {
        result[key as keyof typeof template] = value as any;
      }
    }

    return result;
  }
}
