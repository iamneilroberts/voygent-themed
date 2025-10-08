// Template Validation Service
// Validates template JSON fields and business logic per data-model.md

import { TripTemplate } from '../trip-templates';

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
  warnings: FieldError[];
}

export interface FieldError {
  field: string;
  message: string;
}

export class TemplateValidator {
  /**
   * Validate complete template structure
   */
  static validate(template: Partial<TripTemplate>): ValidationResult {
    const errors: FieldError[] = [];
    const warnings: FieldError[] = [];

    // Required fields
    if (!template.id || template.id.trim().length === 0) {
      errors.push({ field: 'id', message: 'Template ID is required' });
    }
    if (!template.name || template.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Template name is required' });
    }
    if (!template.description || template.description.trim().length === 0) {
      errors.push({ field: 'description', message: 'Description is required' });
    }

    // At least one of the core prompts must be present
    if (!template.intakePrompt && !template.optionsPrompt && !template.workflowPrompt) {
      errors.push({
        field: 'prompts',
        message: 'At least one of intakePrompt, optionsPrompt, or workflowPrompt is required'
      });
    }

    // Validate JSON array fields
    if (template.progressMessages !== undefined) {
      const result = this.validateProgressMessages(template.progressMessages);
      if (!result.valid) errors.push(...result.errors);
    }

    if (template.luxuryLevels !== undefined) {
      const result = this.validateStringArray(template.luxuryLevels, 'luxuryLevels', 1, 6, 20);
      if (!result.valid) errors.push(...result.errors);
    }

    if (template.activityLevels !== undefined) {
      const result = this.validateStringArray(template.activityLevels, 'activityLevels', 1, 6, 20);
      if (!result.valid) errors.push(...result.errors);
    }

    if (template.transportPreferences !== undefined) {
      const result = this.validateStringArray(template.transportPreferences, 'transportPreferences', 1, 10, 20);
      if (!result.valid) errors.push(...result.errors);
    }

    if (template.requiredFields !== undefined) {
      const result = this.validateStringArray(template.requiredFields, 'requiredFields', 1, 20, 50);
      if (!result.valid) errors.push(...result.errors);
    }

    if (template.optionalFields !== undefined) {
      const result = this.validateStringArray(template.optionalFields, 'optionalFields', 0, 20, 50);
      if (!result.valid) errors.push(...result.errors);
    }

    // Validate text length limits
    if (template.workflowPrompt !== undefined) {
      const result = this.validateTextLength(template.workflowPrompt, 'workflowPrompt', 100, 10000);
      if (!result.valid) errors.push(...result.errors);
    }

    if (template.dailyActivityPrompt !== undefined) {
      const result = this.validateTextLength(template.dailyActivityPrompt, 'dailyActivityPrompt', 50, 2000);
      if (!result.valid) errors.push(...result.errors);
    }

    if (template.whyWeSuggestPrompt !== undefined) {
      const result = this.validateTextLength(template.whyWeSuggestPrompt, 'whyWeSuggestPrompt', 50, 1000);
      if (!result.valid) errors.push(...result.errors);
    }

    if (template.searchPlaceholder !== undefined) {
      const result = this.validateTextLength(template.searchPlaceholder, 'searchPlaceholder', 10, 100);
      if (!result.valid) errors.push(...result.errors);
    }

    if (template.searchHelpText !== undefined) {
      const result = this.validateTextLength(template.searchHelpText, 'searchHelpText', 10, 300);
      if (!result.valid) errors.push(...result.errors);
    }

    // Validate business logic
    const businessLogicResult = this.validateBusinessLogic(template);
    errors.push(...businessLogicResult.errors);
    warnings.push(...businessLogicResult.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate progress messages array
   */
  static validateProgressMessages(messages: string[] | null | undefined): ValidationResult {
    const errors: FieldError[] = [];

    if (!messages) {
      return { valid: true, errors: [], warnings: [] };
    }

    if (!Array.isArray(messages)) {
      errors.push({ field: 'progressMessages', message: 'Must be an array' });
      return { valid: false, errors, warnings: [] };
    }

    if (messages.length < 1 || messages.length > 10) {
      errors.push({ field: 'progressMessages', message: 'Must contain 1-10 messages' });
    }

    messages.forEach((msg, index) => {
      if (typeof msg !== 'string') {
        errors.push({ field: `progressMessages[${index}]`, message: 'Must be a string' });
      } else if (msg.length > 100) {
        errors.push({ field: `progressMessages[${index}]`, message: 'Message exceeds 100 characters' });
      }
    });

    return { valid: errors.length === 0, errors, warnings: [] };
  }

  /**
   * Validate string array fields
   */
  static validateStringArray(
    array: string[] | null | undefined,
    fieldName: string,
    minItems: number,
    maxItems: number,
    maxLength: number
  ): ValidationResult {
    const errors: FieldError[] = [];

    if (!array) {
      return { valid: true, errors: [], warnings: [] };
    }

    if (!Array.isArray(array)) {
      errors.push({ field: fieldName, message: 'Must be an array' });
      return { valid: false, errors, warnings: [] };
    }

    if (array.length < minItems) {
      errors.push({ field: fieldName, message: `Must contain at least ${minItems} item(s)` });
    }

    if (array.length > maxItems) {
      errors.push({ field: fieldName, message: `Cannot exceed ${maxItems} items` });
    }

    array.forEach((item, index) => {
      if (typeof item !== 'string') {
        errors.push({ field: `${fieldName}[${index}]`, message: 'Must be a string' });
      } else if (item.length > maxLength) {
        errors.push({ field: `${fieldName}[${index}]`, message: `Exceeds ${maxLength} characters` });
      }
    });

    return { valid: errors.length === 0, errors, warnings: [] };
  }

  /**
   * Validate text length
   */
  static validateTextLength(
    text: string | null | undefined,
    fieldName: string,
    minLength: number,
    maxLength: number
  ): ValidationResult {
    const errors: FieldError[] = [];

    if (!text) {
      return { valid: true, errors: [], warnings: [] };
    }

    if (typeof text !== 'string') {
      errors.push({ field: fieldName, message: 'Must be a string' });
      return { valid: false, errors, warnings: [] };
    }

    if (text.length < minLength) {
      errors.push({ field: fieldName, message: `Must be at least ${minLength} characters` });
    }

    if (text.length > maxLength) {
      errors.push({ field: fieldName, message: `Cannot exceed ${maxLength} characters` });
    }

    return { valid: errors.length === 0, errors, warnings: [] };
  }

  /**
   * Validate business logic rules
   */
  static validateBusinessLogic(template: Partial<TripTemplate>): ValidationResult {
    const errors: FieldError[] = [];
    const warnings: FieldError[] = [];

    // numberOfOptions must be 1-10
    if (template.numberOfOptions !== undefined) {
      if (template.numberOfOptions < 1 || template.numberOfOptions > 10) {
        errors.push({ field: 'numberOfOptions', message: 'Must be between 1 and 10' });
      }
    }

    // tripDaysMin must be >= 1
    if (template.tripDaysMin !== undefined && template.tripDaysMin < 1) {
      errors.push({ field: 'tripDaysMin', message: 'Must be at least 1' });
    }

    // tripDaysMax must be >= tripDaysMin
    if (template.tripDaysMin !== undefined && template.tripDaysMax !== undefined) {
      if (template.tripDaysMax < template.tripDaysMin) {
        errors.push({ field: 'tripDaysMax', message: 'Must be >= tripDaysMin' });
      }
    }

    // estimateMarginPercent must be 10-25
    if (template.estimateMarginPercent !== undefined) {
      if (template.estimateMarginPercent < 10 || template.estimateMarginPercent > 25) {
        errors.push({ field: 'estimateMarginPercent', message: 'Must be between 10 and 25' });
      }
    }

    // Warn if custom luxury levels defined
    if (template.luxuryLevels !== undefined && template.luxuryLevels.length > 0) {
      const defaults = ['budget', 'comfort', 'premium', 'luxury'];
      const hasCustom = template.luxuryLevels.some(level => !defaults.includes(level));
      if (hasCustom) {
        warnings.push({
          field: 'luxuryLevels',
          message: 'Custom luxury levels defined - ensure UI supports these options'
        });
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate template variable syntax
   */
  static validateTemplateVariables(prompt: string, allowedVars: string[]): ValidationResult {
    const errors: FieldError[] = [];
    const warnings: FieldError[] = [];

    // Find all {variable} patterns
    const varPattern = /\{([^}]+)\}/g;
    const matches = [...prompt.matchAll(varPattern)];

    matches.forEach(match => {
      const varName = match[1];
      if (!allowedVars.includes(varName)) {
        warnings.push({
          field: 'templateVariables',
          message: `Unknown variable: {${varName}}. Allowed: ${allowedVars.join(', ')}`
        });
      }
    });

    return { valid: errors.length === 0, errors, warnings };
  }
}
