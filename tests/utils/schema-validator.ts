import Ajv, { ValidateFunction, ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';

/**
 * JSON Schema Validation Utility for VoyGent V3 E2E Tests
 *
 * Provides utilities for validating API responses against JSON schemas
 * Uses AJV (Another JSON Validator) with format support
 *
 * Usage:
 *   const validator = createValidator();
 *   const isValid = validator.validate(tripSchema, tripData);
 *   if (!isValid) {
 *     console.error(validator.getErrors());
 *   }
 */

/**
 * Trip schema definition
 * Validates the structure of trip objects returned by API
 */
export const tripSchema = {
  type: 'object',
  required: ['id', 'template_id', 'status', 'created_at', 'updated_at'],
  properties: {
    id: { type: 'string', minLength: 1 },
    template_id: { type: 'string', minLength: 1 },
    status: {
      type: 'string',
      enum: [
        'researching_destinations',
        'awaiting_confirmation',
        'building_trip',
        'trip_ready',
        'selected',
        'error'
      ]
    },
    chat_history: {
      type: 'array',
      items: {
        type: 'object',
        required: ['role', 'content'],
        properties: {
          role: { type: 'string', enum: ['user', 'assistant'] },
          content: { type: 'string' }
        }
      }
    },
    research_destinations: {
      type: ['array', 'null'],
      items: { type: 'string' }
    },
    destinations_confirmed: { type: ['boolean', 'null'] },
    confirmed_destinations: {
      type: ['array', 'null'],
      items: { type: 'string' }
    },
    user_preferences: {
      type: ['object', 'null']
    },
    trip_options: {
      type: ['array', 'null'],
      items: { type: 'object' }
    },
    selected_option_id: {
      type: ['string', 'null']
    },
    telemetry_logs: {
      type: ['array', 'null'],
      items: { type: 'object' }
    },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' }
  }
} as const;

/**
 * Template schema definition
 * Validates the structure of template objects returned by API
 */
export const templateSchema = {
  type: 'object',
  required: [
    'id',
    'name',
    'description',
    'initial_message',
    'research_prompt_template',
    'trip_building_prompt_template'
  ],
  properties: {
    id: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    description: { type: 'string' },
    initial_message: { type: 'string' },
    research_prompt_template: { type: 'string' },
    trip_building_prompt_template: { type: 'string' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' }
  }
} as const;

/**
 * Templates list schema
 * Validates the response from GET /api/templates
 */
export const templatesListSchema = {
  type: 'array',
  items: templateSchema
} as const;

/**
 * Error response schema
 * Validates error responses from API
 */
export const errorSchema = {
  type: 'object',
  required: ['error'],
  properties: {
    error: { type: 'string' },
    message: { type: 'string' },
    code: { type: ['string', 'number'] },
    details: { type: 'object' }
  }
} as const;

/**
 * Schema Validator class
 * Wraps AJV validator with convenience methods
 */
export class SchemaValidator {
  private ajv: Ajv;
  private validators: Map<string, ValidateFunction> = new Map();
  private lastErrors: ErrorObject[] | null = null;

  constructor() {
    // Initialize AJV with strict mode and format support
    this.ajv = new Ajv({
      allErrors: true, // Collect all errors
      strict: true, // Strict schema validation
      strictTypes: false, // Allow union types
      validateFormats: true, // Validate format keywords
    });

    // Add format support (date-time, email, uri, etc.)
    addFormats(this.ajv);

    // Pre-compile common schemas
    this.validators.set('trip', this.ajv.compile(tripSchema));
    this.validators.set('template', this.ajv.compile(templateSchema));
    this.validators.set('templates-list', this.ajv.compile(templatesListSchema));
    this.validators.set('error', this.ajv.compile(errorSchema));
  }

  /**
   * Validate data against a schema
   *
   * @param schemaOrName - JSON schema object or pre-compiled schema name
   * @param data - Data to validate
   * @returns true if valid, false otherwise
   */
  validate(schemaOrName: object | string, data: unknown): boolean {
    let validator: ValidateFunction;

    if (typeof schemaOrName === 'string') {
      // Use pre-compiled validator
      const precompiled = this.validators.get(schemaOrName);
      if (!precompiled) {
        throw new Error(`No pre-compiled validator found for "${schemaOrName}"`);
      }
      validator = precompiled;
    } else {
      // Compile schema on the fly
      validator = this.ajv.compile(schemaOrName);
    }

    const isValid = validator(data);
    this.lastErrors = validator.errors || null;

    return isValid;
  }

  /**
   * Get validation errors from last validation
   */
  getErrors(): ErrorObject[] | null {
    return this.lastErrors;
  }

  /**
   * Get human-readable error messages from last validation
   */
  getErrorMessages(): string[] {
    if (!this.lastErrors) return [];

    return this.lastErrors.map(error => {
      const path = error.instancePath || 'root';
      return `${path}: ${error.message}`;
    });
  }

  /**
   * Assert that data is valid against schema
   * Throws error with details if validation fails
   */
  assertValid(schemaOrName: object | string, data: unknown, message?: string): void {
    const isValid = this.validate(schemaOrName, data);

    if (!isValid) {
      const errorMessages = this.getErrorMessages().join('\n  ');
      const errorDetail = message
        ? `${message}\n  Validation errors:\n  ${errorMessages}`
        : `Schema validation failed:\n  ${errorMessages}`;

      throw new Error(errorDetail);
    }
  }

  /**
   * Validate a trip object
   */
  validateTrip(data: unknown): boolean {
    return this.validate('trip', data);
  }

  /**
   * Validate a template object
   */
  validateTemplate(data: unknown): boolean {
    return this.validate('template', data);
  }

  /**
   * Validate a templates list
   */
  validateTemplatesList(data: unknown): boolean {
    return this.validate('templates-list', data);
  }

  /**
   * Validate an error response
   */
  validateError(data: unknown): boolean {
    return this.validate('error', data);
  }
}

/**
 * Create a schema validator instance
 */
export function createValidator(): SchemaValidator {
  return new SchemaValidator();
}

/**
 * Global validator instance (singleton)
 * Can be imported and reused across tests
 */
export const validator = createValidator();
