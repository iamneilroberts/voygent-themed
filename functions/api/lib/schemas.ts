// JSON Schema validation - Manual validation for Cloudflare Workers compatibility
// Note: Ajv uses eval() which is not allowed in Workers environment

import type { TripTemplate } from './trip-templates';

/**
 * Template-driven intake validation
 * Checks required fields based on the template's requiredFields array
 */
export function validateIntake(data: any, template?: TripTemplate): boolean {
  if (!data || typeof data !== 'object') return false;
  if (!data.theme || typeof data.theme !== 'string') return false;

  // Apply common defaults
  if (!data.party || typeof data.party !== 'object') {
    data.party = { adults: 2, children: [], accessibility: 'none' };
  }
  if (typeof data.party.adults !== 'number' || data.party.adults < 1) {
    data.party.adults = 2;
  }
  if (!Array.isArray(data.party.children)) {
    data.party.children = [];
  }

  // If template provided, validate required fields
  if (template && template.requiredFields) {
    for (const field of template.requiredFields) {
      const value = data[field];

      // Check if field exists and has content
      if (value === undefined || value === null) {
        console.warn(`[Validation] Missing required field: ${field}`);
        return false;
      }

      // For array fields, check if non-empty
      if (Array.isArray(value) && value.length === 0) {
        console.warn(`[Validation] Empty required array field: ${field}`);
        return false;
      }

      // For string fields, check if non-empty
      if (typeof value === 'string' && value.trim() === '') {
        console.warn(`[Validation] Empty required string field: ${field}`);
        return false;
      }
    }
  }

  return true;
}

validateIntake.errors = null;

export function validateOption(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  if (!['A', 'B', 'C', 'D'].includes(data.key)) return false;
  if (!data.title || typeof data.title !== 'string') return false;
  if (!Array.isArray(data.days) || data.days.length === 0) return false;
  return true;
}

validateOption.errors = null;

export function validateItinerary(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  if (!data.title || typeof data.title !== 'string') return false;
  if (!Array.isArray(data.days) || data.days.length === 0) return false;
  if (!data.budget || !data.budget.lodging) return false;
  return true;
}

validateItinerary.errors = null;
